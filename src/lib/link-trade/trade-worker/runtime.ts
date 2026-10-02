// SPDX-License-Identifier: AGPL-3.0-only
// The PKSX trade worker's command handling around the ported pokeldn session. See ./NOTICE.md.

import {
	TRADE_WORKER_CONTRACT_VERSION,
	tradeWorkerCommandSchema,
	type Board,
	type LinkTradeGame,
	type RadioPort,
	type RecoveredSession,
	type TradeError,
	type TradeErrorCode,
	type TradeReceipt,
	type TradeSessionStatus,
	type TradeWorkerCapabilities,
	type TradeWorkerEvent,
	type TradeWorkerMessage,
	type TradeWorkerStatus,
	type UnknownOutcome
} from '../contract';
import { IncompleteKeysError, parseProdKeys, type SwitchKeyStore } from '../switch-keys';
import { toHex, type Bytes } from './bytes';
import { sha256 } from './crypto';
import {
	PINNED_FIRMWARE_VERSION,
	Radio,
	RadioError,
	RADIO_PROTOCOL_VERSION,
	SUPPORTED_TARGETS
} from './radio';
import { PortBusyError, type Clock, type TradeSerialPort } from './serial-port';
import { classify, SwshJoinSession } from './session';
import { PK8_PARTY_SIZE } from './swsh';

export class PortError extends Error {
	constructor(
		readonly code: TradeErrorCode,
		message: string
	) {
		super(message);
	}
}

export interface TradeWorkerRuntimeOptions {
	post(message: TradeWorkerMessage): void;
	keyStore: SwitchKeyStore;
	/** -> the port to open; throws `PortError` when it cannot be used. */
	openPort(port: RadioPort): Promise<TradeSerialPort>;
	webSerial: boolean;
	fakePort: boolean;
	clock: Clock;
	/** Developer diagnostics; not wired in the worker entry. */
	trace?(line: string): void;
}

interface SessionRecord {
	sessionId: string;
	game: LinkTradeGame;
	sequence: number;
	phase: TradeSessionStatus['phase'];
	outcome: TradeSessionStatus['outcome'];
	receipt: TradeReceipt | null;
	unknown: UnknownOutcome | null;
	session: SwshJoinSession | null;
}

const fail = (code: TradeErrorCode, message: string): TradeError => ({ code, message });

function buffer(data: Uint8Array): ArrayBuffer {
	return new Uint8Array(data).buffer;
}

export class TradeWorkerRuntime {
	private radio: Radio | null = null;
	private active: SessionRecord | null = null;
	private sessions = new Map<string, SessionRecord>();

	constructor(private options: TradeWorkerRuntimeOptions) {}

	async handle(message: unknown): Promise<void> {
		const parsed = tradeWorkerCommandSchema.safeParse(message);
		const requestId =
			typeof (message as { requestId?: unknown })?.requestId === 'string'
				? (message as { requestId: string }).requestId
				: 'unknown';
		if (!parsed.success) {
			return this.respond(
				requestId,
				fail('invalid-message', 'the trade worker did not understand the command')
			);
		}
		const command = parsed.data;
		try {
			switch (command.type) {
				case 'get-capabilities':
					return this.respond(requestId, null, await this.capabilities());
				case 'import-keys':
					await this.options.keyStore.save(parseProdKeys(command.prodKeys));
					return this.respond(requestId, null, { keysPresent: true });
				case 'forget-keys':
					await this.options.keyStore.forget();
					return this.respond(requestId, null, { keysPresent: false });
				case 'connect-radio':
					return this.respond(requestId, null, { board: await this.connectRadio(command.port) });
				case 'disconnect-radio':
					if (this.active)
						return this.respond(requestId, fail('session-active', 'cancel the session first'));
					await this.closeRadio(null);
					return this.respond(requestId, null, {});
				case 'start-session':
					return this.respond(
						requestId,
						null,
						await this.start(command.sessionId, command.game, command.offer)
					);
				case 'confirm-offer': {
					const record = this.sessions.get(command.sessionId);
					if (!record) return this.respond(requestId, fail('session-not-found', 'no such session'));
					return this.respond(
						requestId,
						fail('confirmation-not-supported', 'Sword and Shield are confirmed on the Switch')
					);
				}
				case 'cancel-session': {
					const record = this.sessions.get(command.sessionId);
					if (!record) return this.respond(requestId, fail('session-not-found', 'no such session'));
					record.session?.cancel();
					return this.respond(requestId, null, this.statusOf(record));
				}
				case 'get-status':
					return this.respond(requestId, null, await this.status());
				case 'recover-session': {
					const record = this.sessions.get(command.sessionId);
					if (!record) return this.respond(requestId, fail('session-not-found', 'no such session'));
					const recovered: RecoveredSession = {
						status: this.statusOf(record),
						receipt: record.receipt,
						unknown: record.unknown
					};
					return this.respond(requestId, null, recovered);
				}
			}
		} catch (error) {
			return this.respond(requestId, toTradeError(error));
		}
	}

	private respond(requestId: string, error: TradeError | null, result?: unknown): void {
		this.options.post(
			error
				? {
						type: 'response',
						contractVersion: TRADE_WORKER_CONTRACT_VERSION,
						requestId,
						ok: false,
						error
					}
				: {
						type: 'response',
						contractVersion: TRADE_WORKER_CONTRACT_VERSION,
						requestId,
						ok: true,
						result
					}
		);
	}

	private emit(event: TradeWorkerEvent): void {
		this.options.post({ type: 'event', contractVersion: TRADE_WORKER_CONTRACT_VERSION, event });
	}

	private async capabilities(): Promise<TradeWorkerCapabilities> {
		return {
			contractVersion: TRADE_WORKER_CONTRACT_VERSION,
			webSerial: this.options.webSerial,
			fakePort: this.options.fakePort,
			keysPresent: (await this.options.keyStore.load()) !== null,
			firmware: {
				protocolVersion: RADIO_PROTOCOL_VERSION,
				version: PINNED_FIRMWARE_VERSION,
				targets: SUPPORTED_TARGETS
			},
			games: [
				{
					game: 'sword-shield',
					role: 'joiner',
					hostConfirmation: false,
					offerByteLength: PK8_PARTY_SIZE
				}
			]
		};
	}

	private async status(): Promise<TradeWorkerStatus> {
		return {
			contractVersion: TRADE_WORKER_CONTRACT_VERSION,
			keysPresent: (await this.options.keyStore.load()) !== null,
			board: this.radio?.board ?? null,
			session: this.active ? this.statusOf(this.active) : null
		};
	}

	private statusOf(record: SessionRecord): TradeSessionStatus {
		return {
			sessionId: record.sessionId,
			game: record.game,
			phase: record.phase,
			outcome: record.outcome,
			lastSequence: record.sequence - 1
		};
	}

	private async connectRadio(port: RadioPort): Promise<Board> {
		if (this.active) throw new PortError('session-active', 'a Link Trade is in progress');
		await this.closeRadio(null);
		const radio = new Radio(await this.options.openPort(port), this.options.clock);
		try {
			const board = await radio.open();
			radio.onLost(() => {
				if (this.radio !== radio) return;
				this.active?.session?.radioLost();
				void this.closeRadio(fail('radio-lost', 'the Trade Radio was disconnected'));
			});
			this.radio = radio;
			this.emit({ type: 'radio-connected', board });
			return board;
		} catch (error) {
			await radio.close();
			throw error;
		}
	}

	private async closeRadio(error: TradeError | null): Promise<void> {
		const radio = this.radio;
		if (!radio) return;
		this.radio = null;
		await radio.close();
		this.emit({ type: 'radio-disconnected', error });
	}

	private async start(
		sessionId: string,
		game: LinkTradeGame,
		offer: ArrayBuffer
	): Promise<TradeSessionStatus> {
		const existing = this.sessions.get(sessionId);
		// A repeated start never trades again: it reports the session as it stands.
		if (existing) return this.statusOf(existing);
		if (this.active) throw new PortError('session-active', 'another Link Trade is in progress');
		const bytes = new Uint8Array(offer.slice(0));
		if (bytes.length !== PK8_PARTY_SIZE) {
			throw new PortError('invalid-offer', `a Sword/Shield offer is ${PK8_PARTY_SIZE} bytes`);
		}
		const keys = await this.options.keyStore.load();
		if (!keys) throw new PortError('keys-missing', 'import Switch keys before a Link Trade');
		const radio = this.radio;
		if (!radio) throw new PortError('radio-not-connected', 'connect the Trade Radio first');

		const record: SessionRecord = {
			sessionId,
			game,
			sequence: 0,
			phase: null,
			outcome: null,
			receipt: null,
			unknown: null,
			session: null
		};
		const base = () => ({ sessionId, sequence: record.sequence++ });
		record.session = new SwshJoinSession(radio, keys, bytes, this.options.clock, {
			phase: (phase) => {
				if (record.phase === phase) return;
				record.phase = phase;
				this.emit({ type: 'session-phase', ...base(), phase });
			},
			offer: (pokemon) => this.emit({ type: 'trade-offer', ...base(), pokemon: buffer(pokemon) }),
			consoleAction: (action) => this.emit({ type: 'console-action', ...base(), action }),
			ladder: (phase) => this.emit({ type: 'confirmation-progress', ...base(), phase }),
			trace: this.options.trace
		});
		this.sessions.set(sessionId, record);
		this.active = record;
		void this.run(record, bytes, base);
		return this.statusOf(record);
	}

	private async run(
		record: SessionRecord,
		offer: Bytes,
		base: () => { sessionId: string; sequence: number }
	) {
		const result = await record.session!.start();
		const verdict = classify(result.end, result.evidence);
		const sentDigest = toHex(await sha256(offer));
		let error: TradeError | null = null;
		if (verdict.outcome === 'completed') {
			const received = result.evidence.offered!;
			record.receipt = {
				sessionId: record.sessionId,
				game: record.game,
				receivedPokemon: buffer(received),
				sentDigest,
				receivedDigest: toHex(await sha256(received)),
				completion: { consoleConfirmed: true, ladderPhase: 4, endedBy: verdict.endedBy }
			};
		} else if (verdict.outcome === 'outcome-unknown') {
			record.unknown = {
				sessionId: record.sessionId,
				game: record.game,
				sentDigest,
				offeredPokemon: result.evidence.offered ? buffer(result.evidence.offered) : null,
				consoleConfirmed: result.evidence.consoleConfirmed,
				ladderPhase: result.evidence.ladderPhase,
				reason: verdict.reason
			};
		} else if (verdict.outcome === 'failed') {
			error = result.error
				? fail(result.error.code, result.error.message)
				: fail(verdict.code, verdict.code);
		}
		record.outcome = verdict.outcome;
		record.session = null;
		if (this.active === record) this.active = null;
		this.emit({
			type: 'session-ended',
			...base(),
			outcome: verdict.outcome,
			receipt: record.receipt,
			unknown: record.unknown,
			error
		});
	}
}

function toTradeError(error: unknown): TradeError {
	if (error instanceof IncompleteKeysError) return fail('keys-incomplete', error.message);
	if (error instanceof PortBusyError) return fail('port-busy', error.message);
	if (error instanceof PortError) return fail(error.code, error.message);
	if (error instanceof RadioError) {
		return fail(error.code === 'command-failed' ? 'unsupported-board' : error.code, error.message);
	}
	return fail('internal-error', error instanceof Error ? error.message : String(error));
}
