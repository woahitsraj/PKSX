// SPDX-License-Identifier: AGPL-3.0-only
// Dev builds and tests only. A scripted pokeldn radio with a simulated Sword console behind it,
// following the message order recorded in #365. It is never a supported board and never evidence
// of a hardware trade. See ./NOTICE.md.

import {
	ascii,
	concat,
	equal,
	fromHex,
	randomBytes,
	readU16be,
	readU32le,
	u16le,
	u32be,
	u32le,
	u64be,
	u64le,
	type Bytes
} from './bytes';
import { deriveDataKey, type SwitchKeys } from './crypto';
import { buildUdp } from './ip';
import {
	buildActionFrame,
	decodeAuthenticationFrame,
	decodeChallengeRequest,
	encodeAdvertisement,
	encodeAuthenticationFrame,
	encodeChallengeResponse,
	ethernetFrame,
	ETHERTYPE_LDN,
	readEthertype,
	type NetworkInfo,
	type Participant
} from './ldn';
import { encodeFrame, FrameReader } from './framing';
import {
	ackIds,
	buildAckMessage,
	buildDataMessage,
	buildMessage,
	buildPacket,
	CONNECTION_REQUEST,
	CONNECTION_RESPONSE,
	contiguousThrough,
	JOIN_REQUEST,
	ldnConstantId,
	LOCAL_PROTOCOL,
	MESH_PORT_RELIABLE,
	MESH_PROTOCOL,
	MESSAGE_FLAG_ZLIB,
	openPacket,
	packetIv,
	parsePacket,
	parseReliableMessage,
	PASSPHRASE,
	PIA_PORT,
	RELIABLE_PROTOCOL,
	BROADCAST_RELIABLE_PROTOCOL,
	SNAPSHOT_PROTOCOL,
	SnapshotReceiver,
	SnapshotSender,
	parseSnapshotMessage,
	KIND_ACK,
	KIND_DATA,
	buildSnapshotDone,
	sessionKeys,
	stationLocation,
	STATION_PROTOCOL,
	SWORD_COMM_ID,
	RTT_PROTOCOL,
	type SessionKeys
} from './pia';
import {
	CMD_BAUD,
	CMD_CHANNEL,
	CMD_ETH_TX,
	CMD_HELLO,
	CMD_STA_JOIN,
	CMD_STOP,
	MSG_INFO,
	MSG_LINK,
	MSG_RESULT,
	MSG_RX_ETH,
	MSG_RX_MGMT
} from './radio';
import {
	PortBusyError,
	type Clock,
	type SerialConnection,
	type TradeSerialPort
} from './serial-port';
import {
	boxSyncState,
	buildRpc,
	imReady,
	message,
	parseRpc,
	pokemonOffer,
	pokemonTrade,
	SNAPSHOT_LENGTH,
	sync
} from './swsh';

export type FakeScript = 'trade' | 'cancel' | 'not-ready' | 'drop-after-ladder';

export interface FakeRadioOptions {
	script: FakeScript;
	keys(): Promise<SwitchKeys | null>;
	clock: Clock;
	/** The INFO text, for board and firmware checks. */
	info?: string;
	protocolVersion?: number;
	busy?: boolean;
}

/** What the simulated console saw, for tests. */
export interface FakeObservations {
	staJoinKey: Bytes | null;
	expectedDataKey: Bytes | null;
	offer: Bytes | null;
	snapshot: Bytes | null;
	syncCommands: number[];
}

const CONSOLE_MAC = fromHex('98e2553c83f5');
const CONSOLE_IP = '169.254.100.1';
const JOINER_IP = '169.254.100.2';
const BROADCAST_IP = '169.254.100.255';
const CHANNEL = 11;
const LADDER = [
	'000018fc',
	'00000100',
	'01000100',
	'01000200',
	'02000200',
	'02000300',
	'03000300',
	'03000400',
	'04000400'
];

/** A synthetic encrypted party PK8; never a real Pokemon. */
export function fakePk8(seed: number): Bytes {
	return Uint8Array.from({ length: 0x158 }, (_, i) => (i * 31 + seed * 17 + 1) & 0xff);
}

class Stream {
	private queue: Bytes[] = [];
	private sent = new Map<number, Bytes>();
	private next = 1;
	acked = 1;

	constructor(
		readonly protocol: number,
		readonly port: number,
		private send: (payload: Bytes, protocol: number, port: number) => void
	) {}

	push(payload: Bytes): void {
		this.queue.push(payload);
		this.pump();
	}

	ack(id: number): void {
		this.acked = Math.max(this.acked, id);
		for (const seq of this.sent.keys()) if (seq < this.acked) this.sent.delete(seq);
		this.pump();
	}

	retransmit(): void {
		for (const [seq, payload] of this.sent)
			this.send(buildDataMessage(payload, seq), this.protocol, this.port);
	}

	get idle(): boolean {
		return !this.queue.length && !this.sent.size;
	}

	private pump(): void {
		while (this.queue.length && this.sent.size < 8) {
			const payload = this.queue.shift()!;
			this.sent.set(this.next, payload);
			this.send(buildDataMessage(payload, this.next), this.protocol, this.port);
			this.next++;
		}
	}
}

export class FakeTradeRadio implements TradeSerialPort {
	readonly simulated = true;
	readonly observed: FakeObservations = {
		staJoinKey: null,
		expectedDataKey: null,
		offer: null,
		snapshot: null,
		syncCommands: []
	};
	private onData: ((chunk: Uint8Array) => void) | null = null;
	private onClose: ((error: Error | null) => void) | null = null;
	private reader = new FrameReader();
	private channel = 0;
	private mode: 'idle' | 'sta' = 'idle';
	private stop = new AbortController();
	private network: (Omit<NetworkInfo, 'address' | 'channel'> & { channel: number }) | null = null;
	private keys: SwitchKeys | null = null;
	private joinerMac: Bytes | null = null;
	private pia: SessionKeys | null = null;
	private nonce = 1n;
	private ident = 0;
	private joinerSaid: { protocol: number; port: number; payload: Bytes }[] = [];
	private windows = new Map<string, { seqs: Set<number>; through: number }>();
	private streams = new Map<string, Stream>();
	private snapshotRx = new SnapshotReceiver();
	private snapshotFragments = new Map<number, Bytes>();
	private snapshotAcked = 0;
	private flags = {
		localAcked: false,
		requested: false,
		responded: false,
		stationAcked: false,
		joined: false
	};

	constructor(private options: FakeRadioOptions) {}

	async open(
		_baudRate: number,
		onData: (chunk: Uint8Array) => void,
		onClose: (error: Error | null) => void
	): Promise<SerialConnection> {
		if (this.options.busy) throw new PortBusyError('the simulated port is busy');
		this.onData = onData;
		this.onClose = onClose;
		this.reader = new FrameReader();
		// Boot text and a corrupt frame, as a reset board prints before the first HELLO.
		setTimeout(() => {
			const corrupt = encodeFrame(MSG_LINK, Uint8Array.of(9));
			corrupt[2] ^= 0xff;
			this.onData?.(
				concat(ascii('ets Jul 29 2019 rst:0x1 (POWERON_RESET)\n'), Uint8Array.of(0), corrupt)
			);
		});
		return {
			write: async (data) => {
				for (const { type, payload } of this.reader.feed(data)) void this.command(type, payload);
			},
			close: async () => {
				this.onData = null;
				this.onClose = null;
			}
		};
	}

	private emit(type: number, payload: Uint8Array): void {
		this.onData?.(encodeFrame(type, payload));
	}

	private result(command: number, code = 0): void {
		this.emit(MSG_RESULT, concat(Uint8Array.of(command), u32le(code)));
	}

	private sleep(ms: number): Promise<void> {
		return this.options.clock.sleep(ms, this.stop.signal);
	}

	private get live(): boolean {
		return !this.stop.signal.aborted && this.onData !== null;
	}

	private async command(type: number, payload: Bytes): Promise<void> {
		if (type === CMD_HELLO) {
			const text = this.options.info ?? 'pokeldn-radio esp32 version=1.0.0 idf=v6.1';
			this.emit(
				MSG_INFO,
				concat(
					Uint8Array.of(this.options.protocolVersion ?? 1),
					randomBytes(12),
					Uint8Array.of(3),
					ascii(text)
				)
			);
		} else if (type === CMD_BAUD) {
			this.result(type);
		} else if (type === CMD_CHANNEL) {
			this.channel = payload[0];
			this.result(type);
			if (this.channel === CHANNEL) void this.advertise();
		} else if (type === CMD_STA_JOIN) {
			this.result(type);
			await this.join(payload);
		} else if (type === CMD_STOP) {
			this.stop.abort();
			this.stop = new AbortController();
			this.mode = 'idle';
			this.result(type);
		} else if (type === CMD_ETH_TX) {
			await this.ethernet(payload);
		}
	}

	private async ensureNetwork() {
		if (this.network) return this.network;
		this.keys = await this.options.keys();
		const host: Participant = {
			ipAddress: CONSOLE_IP,
			macAddress: CONSOLE_MAC,
			connected: true,
			name: ascii('Sword'),
			appVersion: 7,
			platform: 0
		};
		const empty = (): Participant => ({
			ipAddress: '0.0.0.0',
			macAddress: new Uint8Array(6),
			connected: false,
			name: new Uint8Array(),
			appVersion: 0,
			platform: 0
		});
		const applicationData = concat(
			randomBytes(4),
			new Uint8Array(8),
			randomBytes(4),
			new Uint8Array(8)
		);
		this.network = {
			protocol: 3,
			localCommunicationId: SWORD_COMM_ID,
			sceneId: 60001,
			ssid: randomBytes(16),
			version: 3,
			nonce: randomBytes(4),
			serverRandom: randomBytes(16),
			securityMode: 1,
			acceptPolicy: 0,
			appVersion: 7,
			maxParticipants: 2,
			numParticipants: 1,
			participants: [host, ...Array.from({ length: 7 }, empty)],
			applicationData,
			challenge: 0x1122334455667788n,
			channel: CHANNEL
		};
		this.pia = await sessionKeys(applicationData);
		return this.network;
	}

	private async advertise(): Promise<void> {
		const network = await this.ensureNetwork();
		if (!this.keys) return;
		while (this.live && (this.channel === CHANNEL || this.mode === 'sta')) {
			const action = await encodeAdvertisement(network, this.keys);
			this.emit(
				MSG_RX_MGMT,
				concat(Uint8Array.of(CHANNEL, 0xc9), buildActionFrame(CONSOLE_MAC, action))
			);
			await this.sleep(100);
		}
	}

	private async join(payload: Bytes): Promise<void> {
		const network = await this.ensureNetwork();
		const key = payload.slice(1 + 6 + 32, 1 + 6 + 32 + 16);
		this.joinerMac = payload.slice(1 + 6 + 32 + 16, 1 + 6 + 32 + 16 + 6);
		this.observed.staJoinKey = key;
		this.observed.expectedDataKey = this.keys
			? await deriveDataKey(this.keys, 3, network.serverRandom, PASSPHRASE)
			: null;
		await this.sleep(50);
		const up = this.observed.expectedDataKey && equal(key, this.observed.expectedDataKey);
		this.emit(MSG_LINK, concat(Uint8Array.of(up ? 1 : 0), u16le(up ? 0 : 0x0f), this.joinerMac));
		if (!up) return;
		this.mode = 'sta';
		void this.advertise();
	}

	private async ethernet(frame: Bytes): Promise<void> {
		const type = readEthertype(frame);
		if (type === ETHERTYPE_LDN) await this.authenticate(frame.subarray(14));
		else if (type === 0x0800) await this.ip(frame.subarray(14));
	}

	private async authenticate(data: Bytes): Promise<void> {
		const network = this.network!;
		const request = await decodeAuthenticationFrame(data, this.keys!, 3);
		if (!request || request.isResponse) return;
		const challenge = await decodeChallengeRequest(request.payload.subarray(64 + 0x24));
		if (!challenge || challenge.token !== network.challenge) return;
		const reply = await encodeChallengeResponse(challenge, 0x0a0b0c0d0e0f1011n);
		const frame = await encodeAuthenticationFrame(
			{
				version: request.version,
				statusCode: 0,
				isResponse: true,
				networkId: network,
				serverRandom: network.serverRandom,
				clientRandom: request.clientRandom,
				payload: concat(new Uint8Array(0x84), reply)
			},
			this.keys!,
			3
		);
		network.participants[1] = {
			ipAddress: JOINER_IP,
			macAddress: this.joinerMac!,
			connected: true,
			name: ascii('PKSX'),
			appVersion: 7,
			platform: 0
		};
		network.numParticipants = 2;
		this.emit(MSG_RX_ETH, ethernetFrame(this.joinerMac!, CONSOLE_MAC, ETHERTYPE_LDN, frame));
		void this.console();
	}

	// --- The console's Pia side ---

	private sendPia(
		payload: Uint8Array,
		protocol: number,
		port = 0,
		flags = 0x09,
		to = JOINER_IP
	): void {
		void (async () => {
			this.nonce++;
			const nonce8 = concat(u32be(0), u32be(Number(this.nonce)));
			const body = buildMessage(payload, protocol, ldnConstantId(CONSOLE_MAC), port, flags, 2n);
			const packet = await buildPacket(
				this.pia!.sessionKey,
				packetIv(this.pia!, CONSOLE_MAC, nonce8, 0),
				body,
				0,
				nonce8
			);
			const target = to === BROADCAST_IP ? new Uint8Array(6).fill(0xff) : this.joinerMac!;
			this.ident++;
			for (const ip of buildUdp(CONSOLE_IP, to, PIA_PORT, PIA_PORT, packet, this.ident)) {
				if (this.live) this.emit(MSG_RX_ETH, ethernetFrame(target, CONSOLE_MAC, 0x0800, ip));
			}
		})();
	}

	private stream(protocol: number, port: number): Stream {
		const id = `${protocol}:${port}`;
		let stream = this.streams.get(id);
		if (!stream) {
			stream = new Stream(protocol, port, (payload, p, q) => this.sendPia(payload, p, q));
			this.streams.set(id, stream);
		}
		return stream;
	}

	private async ip(packet: Bytes): Promise<void> {
		if (packet[9] !== 17 || !this.pia) return;
		const ihl = (packet[0] & 0x0f) * 4;
		const opened = await openPacket(
			this.pia,
			this.joinerMac!,
			packet.subarray(ihl + 8, readU16be(packet, 2))
		);
		if (!opened) return;
		for (const m of await parsePacket(opened.plain)) this.receive(m.protocol, m.port, m.payload);
	}

	private receive(protocol: number, port: number, body: Bytes): void {
		if (protocol === LOCAL_PROTOCOL && body[1] === 0x21) this.flags.localAcked = true;
		else if (protocol === STATION_PROTOCOL) {
			if (body[0] === CONNECTION_REQUEST) this.flags.requested = true;
			if (body[0] === CONNECTION_RESPONSE) this.flags.responded = true;
			if (body[0] === 5) this.flags.stationAcked = true;
		} else if (protocol === MESH_PROTOCOL && port === 0 && body[0] === JOIN_REQUEST) {
			const entry = (mac: Bytes, index: number) =>
				concat(mac, new Uint8Array(0x3e - 6), Uint8Array.of(index, 0));
			this.sendPia(
				concat(
					Uint8Array.of(2, 2, 0, 1, 1, 0, 2, 0, 2, 0, 8, 0),
					u32be(1),
					entry(CONSOLE_MAC, 0),
					entry(this.joinerMac!, 1),
					body.subarray(2, 6)
				),
				MESH_PROTOCOL
			);
			this.flags.joined = true;
		} else if (
			protocol === RELIABLE_PROTOCOL ||
			protocol === BROADCAST_RELIABLE_PROTOCOL ||
			(protocol === MESH_PROTOCOL && port === MESH_PORT_RELIABLE)
		) {
			this.reliable(protocol, port, body);
		} else if (protocol === SNAPSHOT_PROTOCOL) {
			this.snapshot(port, body);
		}
	}

	private reliable(protocol: number, port: number, body: Bytes): void {
		const message = parseReliableMessage(body);
		if (message.isAck) {
			const ids = ackIds(message.payload);
			if (ids.length) this.stream(protocol, port).ack(Math.max(...ids));
			return;
		}
		const id = `${protocol}:${port}`;
		let w = this.windows.get(id);
		if (!w) this.windows.set(id, (w = { seqs: new Set(), through: message.sequence - 1 }));
		if (!w.seqs.has(message.sequence))
			this.joinerSaid.push({ protocol, port, payload: message.payload });
		w.seqs.add(message.sequence);
		w.through = contiguousThrough(w.seqs, w.through);
		this.sendPia(buildAckMessage(w.through + 1), protocol, port, 0x01);
		const command = message.payload;
		if (command.length === 8 && readU32le(command, 0) === 10040)
			this.observed.syncCommands.push(command[7]);
	}

	private snapshot(port: number, body: Bytes): void {
		const got = parseSnapshotMessage(body);
		if (got.kind === KIND_DATA) {
			this.snapshotFragments.set(got.index!, got.body!);
			if (this.snapshotFragments.size === 3) {
				this.observed.snapshot = concat(...[0, 1, 2].map((i) => this.snapshotFragments.get(i)!));
			}
		}
		if (got.kind === KIND_ACK) this.snapshotAcked = Math.max(this.snapshotAcked, got.base!);
		for (const reply of this.snapshotRx.feed(body)) this.sendPia(reply, SNAPSHOT_PROTOCOL, port);
	}

	private said(protocol: number, port: number, payload: Bytes): boolean {
		return this.joinerSaid.some(
			(m) => m.protocol === protocol && m.port === port && equal(m.payload, payload)
		);
	}

	private async until(check: () => boolean, ms = 120000): Promise<boolean> {
		const deadline = this.options.clock.now() + ms;
		while (this.live && !check()) {
			if (this.options.clock.now() > deadline) return false;
			await this.sleep(20);
		}
		return this.live;
	}

	private async console(): Promise<void> {
		void this.background();
		const ok = await this.handshake();
		if (ok) await this.trade();
	}

	/** Update sessions until acked, RTT, retransmits and the update mesh. */
	private async background(): Promise<void> {
		let sequence = 1;
		let tick = 0;
		while (this.live) {
			if (!this.flags.localAcked || tick % 20 === 0) {
				const update = new Uint8Array(0x30 + 73);
				update.set([1, 0x11, 73, 0], 0);
				update.set(u32le(sequence++), 0x0c);
				update.set(u32le(0x4cd34c2e), 0x14);
				update.set(u64le(ldnConstantId(CONSOLE_MAC)), 0x20);
				if (!this.flags.localAcked) this.sendPia(update, LOCAL_PROTOCOL, 0, 0x11, BROADCAST_IP);
			}
			if (tick % 3 === 0) for (const stream of this.streams.values()) stream.retransmit();
			if (this.flags.joined && tick % 10 === 0) {
				this.sendPia(
					Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0),
					RTT_PROTOCOL,
					0,
					0x01
				);
				const mesh = new Uint8Array(524);
				mesh.set([0x20, 2, 0, 0], 0);
				mesh.set(u32be(tick), 4);
				this.sendPia(mesh, MESH_PROTOCOL);
			}
			tick++;
			await this.sleep(100);
		}
	}

	private async handshake(): Promise<boolean> {
		if (!(await this.until(() => this.flags.localAcked && this.flags.requested))) return false;
		if (this.options.script === 'not-ready') return false;
		const location = stationLocation(
			CONSOLE_IP,
			PIA_PORT,
			ldnConstantId(CONSOLE_MAC),
			0x4cd34c2e,
			0x11223344
		);
		const request = concat(
			Uint8Array.of(CONNECTION_REQUEST, 5, 9, 1),
			u64be(ldnConstantId(this.joinerMac!)),
			u32be(0),
			Uint8Array.of(1),
			location,
			u32be(0x857f363a)
		);
		while (this.live && !this.flags.responded) {
			this.sendPia(request, STATION_PROTOCOL);
			await this.sleep(500);
		}
		const response = concat(
			Uint8Array.of(CONNECTION_RESPONSE, 0, 9),
			new Uint8Array(0x40),
			u32be(0x64ea6e10)
		);
		while (this.live && !this.flags.stationAcked) {
			this.sendPia(response, STATION_PROTOCOL);
			await this.sleep(500);
		}
		return this.until(() => this.flags.joined);
	}

	private async trade(): Promise<void> {
		const a = this.stream(RELIABLE_PROTOCOL, 0);
		const rpc = this.stream(RELIABLE_PROTOCOL, 1);
		const block = this.stream(BROADCAST_RELIABLE_PROTOCOL, 0);
		const station = ldnConstantId(CONSOLE_MAC);
		let clock = 2348n;
		const theirs = fakePk8(2);
		const ourOffer = () => this.observed.offer;

		a.push(sync(97, 1));
		if (!(await this.until(() => this.said(RELIABLE_PROTOCOL, 0, sync(97, 2))))) return;
		a.push(sync(97, 2));
		a.push(sync(97, 3));
		if (!(await this.until(() => this.said(RELIABLE_PROTOCOL, 0, sync(97, 3))))) return;
		a.push(message(60000, Uint8Array.of(0x0a, 0)));
		block.push(imReady());
		if (!(await this.sendSnapshot(theirs))) return;

		for (const which of [1, 2, 3]) {
			a.push(sync(110, which));
			if (!(await this.until(() => this.said(RELIABLE_PROTOCOL, 0, sync(110, which))))) return;
		}
		if (!(await this.pair(rpc, 30, station, (clock += 2n)))) return;

		a.push(pokemonTrade(theirs));
		a.push(boxSyncState(1));
		const offered = await this.until(() =>
			this.joinerSaid.some((m) => {
				if (m.protocol !== RELIABLE_PROTOCOL || m.port !== 0 || readU32le(m.payload, 0) !== 20030)
					return false;
				if (m.payload.length !== pokemonTrade(theirs).length) return false;
				this.observed.offer = m.payload.slice(-0x158);
				return true;
			})
		);
		if (
			!offered ||
			!(await this.until(() => this.said(RELIABLE_PROTOCOL, 0, pokemonOffer(50, ourOffer()!))))
		) {
			return;
		}
		await this.sleep(1000);
		a.push(boxSyncState(4));
		if (this.options.script === 'cancel') {
			await this.sleep(2000);
			a.push(boxSyncState(5));
			await this.sleep(2000);
			return this.leave(a);
		}
		await this.sleep(1000);
		for (const which of [1, 2, 3]) a.push(sync(130, which));
		if (!(await this.pair(rpc, 50, station, (clock += 2n)))) return;
		rpc.push(buildRpc(50, 20000, station, (clock += 2n), fromHex('00000100')));
		if (!(await this.until(() => this.said(RELIABLE_PROTOCOL, 0, pokemonOffer(50, ourOffer()!)))))
			return;

		for (const [i, step] of LADDER.entries()) {
			if (i === 0) {
				if (!(await this.pair(rpc, 40, station, (clock += 2n)))) return;
			} else {
				rpc.push(buildRpc(40, 20000, station, (clock += 2n), fromHex(step)));
			}
			if (!(await this.until(() => this.observed.syncCommands.length > i))) return;
		}
		await this.sleep(500);
		if (this.options.script === 'drop-after-ladder') {
			const onClose = this.onClose;
			this.onData = null;
			this.stop.abort();
			onClose?.(new Error('The device has been lost.'));
			return;
		}
		await this.sleep(2000);
		await this.leave(a);
	}

	/** The RPC pair that opens a phase; -> once the joiner has answered both members. */
	private async pair(
		rpc: Stream,
		offset: number,
		station: bigint,
		clock: bigint
	): Promise<boolean> {
		rpc.push(buildRpc(offset, 10000, station, clock, fromHex('00000000')));
		rpc.push(buildRpc(offset, 20000, station, clock, fromHex('000018fc')));
		return this.until(() => {
			const answers = this.joinerSaid
				.filter((m) => m.protocol === RELIABLE_PROTOCOL && m.port === 1)
				.map((m) => parseRpc(m.payload))
				.filter((r) => r?.envelope === 40000 + offset);
			return new Set(answers.map((r) => r!.base)).size === 2;
		});
	}

	private async sendSnapshot(theirs: Bytes): Promise<boolean> {
		const snapshot = Uint8Array.from({ length: SNAPSHOT_LENGTH }, (_, i) => (i * 7 + 3) & 0xff);
		snapshot.set(theirs, 0);
		const sender = new SnapshotSender();
		const messages = sender.transfer(snapshot);
		const last = messages.length - 1;
		// The console deflates only its last fragment, after the 12-byte prefix.
		messages[last] = concat(
			messages[last].subarray(0, 12),
			await deflate(messages[last].subarray(12))
		);
		while (this.live && this.snapshotAcked < 3) {
			for (const [i, m] of messages.entries()) {
				this.sendPia(m, SNAPSHOT_PROTOCOL, 0, i === last ? 0x09 | MESSAGE_FLAG_ZLIB : 0x09);
			}
			await this.sleep(1000);
		}
		this.sendPia(buildSnapshotDone(sender.sequence), SNAPSHOT_PROTOCOL, 1);
		return this.until(() => this.observed.snapshot !== null);
	}

	private async leave(a: Stream): Promise<void> {
		a.push(boxSyncState(3));
		await this.until(() => a.idle);
		this.stream(MESH_PROTOCOL, MESH_PORT_RELIABLE).push(Uint8Array.of(0x44, 0, 1));
		await this.sleep(500);
		this.sendPia(
			concat(Uint8Array.of(1, 0x13), new Uint8Array(14)),
			LOCAL_PROTOCOL,
			0,
			0x11,
			BROADCAST_IP
		);
		await this.sleep(500);
		this.stop.abort();
	}
}

async function deflate(data: Uint8Array): Promise<Bytes> {
	const stream = new Blob([new Uint8Array(data)])
		.stream()
		.pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}
