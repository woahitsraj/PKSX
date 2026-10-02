// SPDX-License-Identifier: AGPL-3.0-only
// Ported from pokeldn v0.4.0 `pokeldn/ldn/esp32.py` (`Radio`, `Info`, the message set) and
// `pokeldn/ldn/esp32_wlan.py`. See ./NOTICE.md.

import type { Board } from '../contract';
import { ascii, concat, readU16le, readU32le, u32le, type Bytes } from './bytes';
import { encodeFrame, FrameReader } from './framing';
import type { Clock, SerialConnection, TradeSerialPort } from './serial-port';

export const RADIO_PROTOCOL_VERSION = 1;
/** pokeldn v0.4.0 `pokeldn-radio.bin`, SHA256 b96e102c…ff9, as tested in #365. */
export const PINNED_FIRMWARE_VERSION = '1.0.0';
/** The classic ESP32 is the only target a Link Trade has been verified on. */
export const SUPPORTED_TARGETS = ['esp32'];

export const CMD_HELLO = 0x01;
export const CMD_BAUD = 0x02;
export const CMD_CHANNEL = 0x03;
export const CMD_STA_JOIN = 0x04;
export const CMD_STOP = 0x05;
export const CMD_ETH_TX = 0x08;
export const MSG_INFO = 0x81;
export const MSG_RESULT = 0x82;
export const MSG_RX_MGMT = 0x84;
export const MSG_RX_ETH = 0x85;
export const MSG_LINK = 0x86;
export const MSG_CREDIT = 0x8b;

const BASE_BAUD = 115200;
export const FAST_BAUD = 921600;
const FLOW_WINDOW = 8192;
const FLOW_STALL_MS = 300;
const FLOW_BLIND_MS = 5000;
const QUEUE_LIMIT = 512;

export class RadioError extends Error {
	constructor(
		readonly code:
			| 'unsupported-board'
			| 'protocol-mismatch'
			| 'firmware-mismatch'
			| 'radio-lost'
			| 'command-failed',
		message: string
	) {
		super(message);
	}
}

export interface Info {
	version: number;
	staMac: Bytes;
	chipRevision: number;
	text: string;
}

export function parseInfo(payload: Uint8Array): Info {
	if (payload.length < 14) throw new RadioError('unsupported-board', 'the board sent a short INFO');
	return {
		version: payload[0],
		staMac: payload.slice(1, 7),
		chipRevision: payload[13],
		text: new TextDecoder().decode(payload.subarray(14))
	};
}

/** -> the board description, or the reason PKSX cannot use this board. */
export function checkBoard(info: Info, baudRate: number, simulated: boolean): Board {
	const words = info.text.split(/\s+/);
	const version = words.find((w) => w.startsWith('version='))?.slice('version='.length) ?? '';
	const target = words[0] === 'pokeldn-radio' ? (words[1] ?? '') : '';
	if (!target) throw new RadioError('unsupported-board', `not a pokeldn radio: ${info.text}`);
	if (info.version !== RADIO_PROTOCOL_VERSION) {
		throw new RadioError(
			'protocol-mismatch',
			`the board speaks protocol ${info.version}; PKSX speaks ${RADIO_PROTOCOL_VERSION}`
		);
	}
	if (!SUPPORTED_TARGETS.includes(target)) {
		throw new RadioError('unsupported-board', `${target} boards are not verified for Link Trade`);
	}
	if (version !== PINNED_FIRMWARE_VERSION) {
		throw new RadioError(
			'firmware-mismatch',
			`the board runs firmware ${version || 'unknown'}; flash ${PINNED_FIRMWARE_VERSION}`
		);
	}
	return {
		protocolVersion: info.version,
		firmwareVersion: version,
		target,
		chipRevision: info.chipRevision,
		baudRate,
		simulated
	};
}

export function staJoinPayload(
	channel: number,
	bssid: Uint8Array,
	ssidHex: string,
	key: Uint8Array,
	mac: Uint8Array
) {
	if (ssidHex.length !== 32 || key.length !== 16) {
		throw new Error('an LDN SSID is 32 hex characters and the key 16 bytes');
	}
	return concat(Uint8Array.of(channel), bssid, ascii(ssidHex), key, mac);
}

type Listener = (type: number, payload: Bytes) => void;

/** Owns one connection to a board: framing, request/reply, credit flow control. */
export class Radio {
	board: Board | null = null;
	private connection: SerialConnection | null = null;
	private reader = new FrameReader();
	private listeners = new Set<Listener>();
	private queue: { type: number; frame: Bytes }[] = [];
	private writing = false;
	private written = 0;
	private credited = 0;
	private lostBytes = 0;
	private creditSeen = 0;
	private flow = false;
	private closed = false;
	private lost: ((error: Error | null) => void) | null = null;

	constructor(
		private port: TradeSerialPort,
		private clock: Clock
	) {}

	onLost(callback: (error: Error | null) => void): void {
		this.lost = callback;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Opens the port, checks HELLO, then switches to the fast baud rate when the board allows. */
	async open(): Promise<Board> {
		await this.connect(BASE_BAUD);
		let info: Info | null = null;
		let baud = BASE_BAUD;
		// A board keeps the fast rate until it loses power, and some boards reboot when the port opens.
		for (const [rate, attempts, timeoutMs] of [
			[BASE_BAUD, 1, 700],
			[FAST_BAUD, 2, 500],
			[BASE_BAUD, 5, 1000]
		] as const) {
			if (rate !== baud) await this.reconnect(rate);
			baud = rate;
			info = await this.hello(attempts, timeoutMs).catch(() => null);
			if (info) break;
		}
		if (!info) throw new RadioError('unsupported-board', 'no pokeldn radio answered HELLO');
		checkBoard(info, baud, this.port.simulated);
		if (baud === BASE_BAUD) {
			await this.request(CMD_BAUD, u32le(FAST_BAUD), MSG_RESULT);
			await this.reconnect(FAST_BAUD);
			// The base rate cannot carry a trade's traffic, so a board that falls back is refused.
			await this.hello(5, 500).catch(() => {
				throw new RadioError('unsupported-board', 'the board did not hold 921600 baud');
			});
		}
		this.board = checkBoard(info, FAST_BAUD, this.port.simulated);
		return this.board;
	}

	async close(): Promise<void> {
		this.closed = true;
		const connection = this.connection;
		this.connection = null;
		await connection?.close().catch(() => undefined);
	}

	/** Queues one command; never waits. Data frames beyond the queue limit are dropped. */
	send(type: number, payload: Uint8Array = new Uint8Array()): void {
		if (this.queue.length >= QUEUE_LIMIT && type === CMD_ETH_TX) return;
		this.queue.push({ type, frame: encodeFrame(type, payload) });
		void this.drain();
	}

	/** Sends a command and returns the next `replyType` payload; a RESULT must name it with code 0. */
	request(type: number, payload: Uint8Array, replyType: number, timeoutMs = 3000): Promise<Bytes> {
		if (this.closed) return Promise.reject(new RadioError('radio-lost', 'the radio is closed'));
		return new Promise((resolve, reject) => {
			const abort = new AbortController();
			const unsubscribe = this.subscribe((got, body) => {
				if (got !== replyType) return;
				if (replyType === MSG_RESULT && body[0] !== type) return;
				finish();
				const code = replyType === MSG_RESULT ? readU32le(body, 1) | 0 : 0;
				if (code)
					reject(
						new RadioError('command-failed', `command 0x${type.toString(16)} failed: ${code}`)
					);
				else resolve(body);
			});
			const finish = () => {
				unsubscribe();
				abort.abort();
			};
			void this.clock.sleep(timeoutMs, abort.signal).then(() => {
				if (abort.signal.aborted) return;
				finish();
				reject(
					new RadioError(
						'radio-lost',
						`no reply 0x${replyType.toString(16)} to 0x${type.toString(16)}`
					)
				);
			});
			this.send(type, payload);
		});
	}

	private async hello(attempts: number, timeoutMs: number): Promise<Info> {
		for (let attempt = 1; ; attempt++) {
			try {
				return parseInfo(await this.request(CMD_HELLO, new Uint8Array(), MSG_INFO, timeoutMs));
			} catch (error) {
				if (attempt >= attempts) {
					throw new RadioError(
						'unsupported-board',
						`no pokeldn radio answered HELLO (${String(error)})`
					);
				}
			}
		}
	}

	private async connect(baud: number): Promise<void> {
		this.reader = new FrameReader();
		const generation = ++this.generation;
		this.connection = await this.port.open(
			baud,
			(chunk) => {
				if (generation === this.generation) this.receive(chunk);
			},
			(error) => {
				if (generation === this.generation && !this.closed) this.lost?.(error);
			}
		);
	}

	private generation = 0;

	private async reconnect(baud: number): Promise<void> {
		await this.waitDrained();
		this.generation++;
		await this.connection?.close().catch(() => undefined);
		await this.connect(baud);
	}

	private async waitDrained(): Promise<void> {
		for (let i = 0; i < 100 && (this.queue.length || this.writing); i++) await this.clock.sleep(10);
	}

	private receive(chunk: Uint8Array): void {
		for (const { type, payload } of this.reader.feed(chunk)) {
			if (type === MSG_CREDIT && payload.length === 4) {
				const credit = readU32le(payload, 0);
				this.creditSeen = this.clock.now();
				if (credit <= this.written) {
					this.lostBytes = Math.min(this.lostBytes, this.written - credit);
					this.credited = Math.max(this.credited, credit + this.lostBytes);
					this.flow = true;
				}
				continue;
			}
			for (const listener of [...this.listeners]) listener(type, payload);
		}
	}

	private async drain(): Promise<void> {
		if (this.writing) return;
		this.writing = true;
		try {
			while (this.queue.length && this.connection) {
				const { type, frame } = this.queue.shift()!;
				const since = this.clock.now();
				let last = this.credited;
				let quietSince = since;
				while (this.flow && this.written - this.credited + frame.length > FLOW_WINDOW) {
					const now = this.clock.now();
					if (this.credited !== last) {
						last = this.credited;
						quietSince = now;
					} else if (
						(now - quietSince > FLOW_STALL_MS &&
							this.creditSeen > quietSince + (FLOW_STALL_MS * 2) / 3) ||
						now - quietSince > FLOW_BLIND_MS
					) {
						// Bytes the board never counted would hold the window shut for good.
						this.lostBytes += this.written - this.credited;
						this.credited = this.written;
						break;
					}
					await this.clock.sleep(20);
				}
				try {
					await this.connection.write(frame);
				} catch (error) {
					this.lost?.(error instanceof Error ? error : new Error(String(error)));
					return;
				}
				this.written += frame.length;
				if (type === CMD_HELLO) {
					this.written = 0;
					this.credited = 0;
					this.lostBytes = 0;
					this.flow = false;
				}
			}
		} finally {
			this.writing = false;
		}
	}
}

export function parseLink(payload: Uint8Array): { up: boolean; reason: number } {
	return { up: payload[0] !== 0, reason: payload.length >= 3 ? readU16le(payload, 1) : 0 };
}
