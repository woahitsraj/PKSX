// SPDX-License-Identifier: AGPL-3.0-only AND GPL-3.0-only
// Ported from pokeldn v0.4.0 `bin/swsh_connect.py` (the `trade` preset, joiner role only) and the
// station path of `pokeldn/ldn/esp32_wlan.py` and LDN's `connect`/`STANetwork`. The trainer rewrite
// of the offered Pokemon and the PID/EC re-roll are not ported. See ./NOTICE.md.

import type { ConsoleAction, SessionEnd, TradeErrorCode, TradeSessionPhase } from '../contract';
import { concat, equal, fromHex, randomBytes, toHex, u64be, type Bytes } from './bytes';
import { deriveDataKey, type LdnProtocol, type SwitchKeys } from './crypto';
import { UserspaceStack, type Datagram } from './ip';
import {
	authenticationRequestPayload,
	CHANNEL_FREQUENCIES,
	decodeAdvertisement,
	decodeAuthenticationFrame,
	decodeDisconnectFrame,
	encodeAuthenticationFrame,
	encodeChallengeRequest,
	ethernetFrame,
	ETHERTYPE_LDN,
	parseActionFrame,
	readEthertype,
	sameNetworkId,
	SECURITY_MODE_PROD,
	type NetworkInfo
} from './ldn';
import {
	ackIds,
	BROADCAST_RELIABLE_PROTOCOL,
	buildAckMessage,
	buildConnectionRequest,
	buildConnectionResponse,
	buildDataMessage,
	buildJoinRequest,
	buildLocalAck,
	buildMessage,
	buildMigrationFinish,
	buildMigrationResponse,
	buildPacket,
	buildSnapshotDone,
	buildStationAck,
	CONNECTION_REQUEST,
	CONNECTION_RESPONSE,
	contiguousThrough,
	FLAG_APPLICATION_DATA,
	inflate,
	JOIN_REQUEST,
	JOIN_RESPONSE,
	KIND_ACK,
	KIND_DATA,
	ldnConstantId,
	ldnServiceVariableId,
	LOCAL_PROTOCOL,
	localMessageType,
	MESH_PORT_RELIABLE,
	MESH_PROTOCOL,
	MESSAGE_FLAGS,
	openPacket,
	packetIv,
	parseIncomingRequest,
	parseJoinResponse,
	parseMigrationStart,
	parsePacket,
	parseReliableMessage,
	parseSnapshotMessage,
	parseUpdateSession,
	PASSPHRASE,
	PIA_PORT,
	RELIABLE_MESSAGE_FLAGS,
	RELIABLE_PROTOCOL,
	rewriteUpdateMesh,
	RTT_PROTOCOL,
	rttResponse,
	sessionKeys,
	type SessionKeys,
	SNAPSHOT_PROTOCOL,
	snapshotFragmentCount,
	SnapshotReceiver,
	SnapshotSender,
	START_HOST_MIGRATION,
	STATION_PROTOCOL,
	stationLocation,
	SWORD_COMM_ID,
	trailingAckId,
	UPDATE_MESH,
	UPDATE_SESSION,
	updateMeshCounter
} from './pia';
import {
	CMD_CHANNEL,
	CMD_ETH_TX,
	CMD_STA_JOIN,
	CMD_STOP,
	MSG_LINK,
	MSG_RESULT,
	MSG_RX_ETH,
	MSG_RX_MGMT,
	parseLink,
	staJoinPayload,
	type Radio
} from './radio';
import type { Clock } from './serial-port';
import {
	answerRpc,
	boxSyncState,
	buildOurSnapshot,
	CONFIRMATION_OFFSET,
	nextAnswer,
	offeredPokemon,
	parseBoxCommand,
	parseRpc,
	parseSyncStep,
	pokemonOffer,
	pokemonTrade,
	RPC_BASES,
	SELECTION_OFFSET,
	SNAPSHOT_FRAGMENTS,
	SNAPSHOT_LENGTH,
	syncCommand,
	type SnapshotIdentity
} from './swsh';

/** pokeldn's `trade` preset timings, in milliseconds. */
export const TIMING = {
	dwell: 2500,
	listenFirst: 6000,
	ackPhase: 12000,
	ackPeriod: 100,
	quietFor: 1500,
	requestGap: 250,
	joinTimeout: 20000,
	authWait: 700,
	networkWait: 1000,
	joinWait: 45000,
	joinGap: 500,
	joinSeconds: 10000,
	sendWait: 60000,
	sendAfter: 4000,
	sendPeriod: 300,
	boxPeriod: 350,
	rpcPeriod: 300,
	migrationPeriod: 300,
	updateMeshPeriod: 1000,
	snapshotPeriod: 50,
	snapshotRepeat: 2000,
	abortOnStall: 15000,
	hold: 240000,
	grace: 300000,
	/** PKSX: a console that has not accepted the session by then is not ready. */
	consoleReady: 60000,
	/** PKSX: after box command 3, how long to wait for the host to close its network. */
	leaveGrace: 10000,
	monitorPeriod: 250
};

const CHANNELS = [1, 6, 11];
const CLOCK_DELTA = 5;
const FINAL_DELTA = 9;
const LADDER_FINAL_PHASE = 4;
const CONFIRM_COMMANDS = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
const OPENING_BODIES = ['00000000', '000018fc'];
const DATA_DESTINATION = 1n;
const LDN_NAME = new TextEncoder().encode('PKSX');
const DEFAULT_IDENTITY: SnapshotIdentity = {
	trainerName: 'PKSX',
	trainerId: 12345,
	secretId: 54321
};

export class SessionError extends Error {
	constructor(
		readonly code: TradeErrorCode,
		message: string
	) {
		super(message);
	}
}

export interface TradeEvidence {
	offered: Bytes | null;
	consoleConfirmed: boolean;
	ladderStarted: boolean;
	ladderPhase: number | null;
	ladderFinished: boolean;
}

export type Classification =
	| { outcome: 'completed'; endedBy: 'console-left' | 'console-offered-again' }
	| { outcome: 'cancelled' }
	| { outcome: 'failed'; code: TradeErrorCode }
	| { outcome: 'outcome-unknown'; reason: SessionEnd };

/**
 * A Trade Receipt needs the console's confirmation, the ladder through phase 4 and a graceful end.
 * A received offer alone is never one, and a loss near or after phase 4 is an Unknown Trade
 * Outcome (#365).
 */
export function classify(end: SessionEnd, evidence: TradeEvidence): Classification {
	const committed = evidence.consoleConfirmed || evidence.ladderStarted || evidence.ladderFinished;
	if (
		(end === 'console-left' || end === 'console-offered-again') &&
		evidence.consoleConfirmed &&
		evidence.ladderFinished &&
		evidence.offered
	) {
		return { outcome: 'completed', endedBy: end };
	}
	if (committed) return { outcome: 'outcome-unknown', reason: end };
	if (end === 'cancelled' || end === 'console-left') return { outcome: 'cancelled' };
	const codes: Partial<Record<SessionEnd, TradeErrorCode>> = {
		'radio-lost': 'radio-lost',
		'console-not-ready': 'console-not-ready',
		'timed-out': 'timed-out'
	};
	return { outcome: 'failed', code: codes[end] ?? 'connection-lost' };
}

export interface SessionCallbacks {
	phase(phase: TradeSessionPhase): void;
	offer(pokemon: Bytes): void;
	consoleAction(action: ConsoleAction): void;
	ladder(phase: number): void;
	/** Developer diagnostics only; never part of the contract and never carries keys. */
	trace?(line: string): void;
}

export interface SessionResult {
	end: SessionEnd;
	evidence: TradeEvidence;
	error: SessionError | null;
}

const key = (...parts: (number | string)[]) => parts.join(':');

/** One Sword/Shield Link Trade as the joiner, through the Trade Radio. */
export class SwshJoinSession {
	private run = new AbortController();
	private ended: SessionEnd | null = null;
	private endError: SessionError | null = null;
	private evidence: TradeEvidence = {
		offered: null,
		consoleConfirmed: false,
		ladderStarted: false,
		ladderFinished: false,
		ladderPhase: null
	};
	private unsubscribe: (() => void)[] = [];

	constructor(
		private radio: Radio,
		private keys: SwitchKeys,
		private offer: Bytes,
		private clock: Clock,
		private callbacks: SessionCallbacks,
		private identity: SnapshotIdentity = DEFAULT_IDENTITY
	) {}

	/** Stops the session; the trade's meaning is decided by `classify`. */
	cancel(): void {
		this.finish('cancelled');
	}

	radioLost(): void {
		this.finish('radio-lost');
	}

	private finish(end: SessionEnd, error: SessionError | null = null): void {
		if (this.ended) return;
		this.ended = end;
		this.endError = error;
		this.run.abort();
	}

	private get signal(): AbortSignal {
		return this.run.signal;
	}

	private sleep(ms: number): Promise<void> {
		return this.clock.sleep(ms, this.signal);
	}

	async start(): Promise<SessionResult> {
		try {
			const network = await this.scan();
			if (network && !this.ended) await this.connect(network);
		} catch (error) {
			if (error instanceof SessionError) {
				this.finish(
					error.code === 'console-not-ready' ? 'console-not-ready' : 'connection-lost',
					error
				);
			} else if (!this.ended) {
				this.finish('connection-lost', new SessionError('internal-error', String(error)));
			}
		} finally {
			for (const stop of this.unsubscribe) stop();
			await this.radio.request(CMD_STOP, new Uint8Array(), MSG_RESULT, 5000).catch(() => undefined);
		}
		return { end: this.ended ?? 'connection-lost', evidence: this.evidence, error: this.endError };
	}

	// --- Scanning (`ldn.scan` through `EspMonitor`) ---

	private async scan(): Promise<NetworkInfo | null> {
		this.callbacks.phase('scanning');
		const deadline = this.clock.now() + TIMING.consoleReady;
		while (!this.ended) {
			const networks = await this.scanOnce();
			const network = networks.find((n) => n.localCommunicationId === SWORD_COMM_ID);
			if (network) {
				if (network.numParticipants >= network.maxParticipants) {
					throw new SessionError('session-full', 'the console already has a partner');
				}
				return network;
			}
			if (this.clock.now() >= deadline) {
				throw new SessionError(
					'console-not-ready',
					'no Sword or Shield Link Trade was found; open Link Trade on the Switch and press A on both messages'
				);
			}
		}
		return null;
	}

	private async scanOnce(): Promise<NetworkInfo[]> {
		const best = new Map<string, NetworkInfo>();
		const counts = new Map<string, number>();
		const order: string[] = [];
		const pending: Promise<void>[] = [];
		const stop = this.radio.subscribe((type, payload) => {
			if (type !== MSG_RX_MGMT || payload.length < 2) return;
			const channel = payload[0];
			if (!CHANNEL_FREQUENCIES[channel]) return;
			const action = parseActionFrame(payload.subarray(2));
			if (!action) return;
			pending.push(
				this.readAdvertisement(action.action).then((info) => {
					if (!info) return;
					const network: NetworkInfo = { ...info, address: action.source, channel };
					const address = toHex(action.source);
					const at = key(address, channel);
					counts.set(at, (counts.get(at) ?? 0) + 1);
					const current = best.get(address);
					if (!current) {
						order.push(address);
						best.set(address, network);
					} else if (
						(counts.get(at) ?? 0) > (counts.get(key(address, current.channel)) ?? 0) ||
						channel === current.channel
					) {
						best.set(address, network);
					}
				})
			);
		});
		try {
			for (const channel of CHANNELS) {
				if (this.ended) break;
				await this.radio.request(CMD_CHANNEL, Uint8Array.of(channel), MSG_RESULT);
				await this.sleep(TIMING.dwell);
			}
		} finally {
			stop();
		}
		await Promise.all(pending);
		this.callbacks.trace?.(
			`scan: ${[...counts].map(([at, n]) => `${at}=${n}`).join(' ') || 'nothing heard'}`
		);
		return order.map((address) => best.get(address)!);
	}

	private advertKeyCache = new Map<
		string,
		Promise<Omit<NetworkInfo, 'address' | 'channel'> | null>
	>();

	private readAdvertisement(action: Uint8Array) {
		if (action.length < 52 || action[0] !== 0x7f) return Promise.resolve(null);
		const cacheKey = toHex(action);
		let hit = this.advertKeyCache.get(cacheKey);
		if (!hit) {
			hit = (async () => {
				for (const protocol of [1, 3] as LdnProtocol[]) {
					const info = await decodeAdvertisement(action, this.keys, protocol);
					if (info) return info;
				}
				return null;
			})();
			if (this.advertKeyCache.size > 64) this.advertKeyCache.clear();
			this.advertKeyCache.set(cacheKey, hit);
		}
		return hit;
	}

	// --- Joining (`ldn.connect`, `EspStation`, `STANetwork`) ---

	private async connect(network: NetworkInfo): Promise<void> {
		this.callbacks.phase('joining');
		const keys = await sessionKeys(network.applicationData);
		if (network.securityMode !== SECURITY_MODE_PROD) {
			throw new SessionError('join-failed', 'the console network is not a production network');
		}
		const dataKey = await deriveDataKey(
			this.keys,
			network.protocol,
			network.serverRandom,
			PASSPHRASE
		);
		const ourMac = randomBytes(6);
		ourMac[0] = (ourMac[0] & 0xfc) | 0x02;

		const control: Bytes[] = [];
		const adverts: NetworkInfo[] = [];
		const waiters = new Set<() => void>();
		const notify = () => {
			for (const wake of waiters) wake();
			waiters.clear();
		};
		const radioLink: { down: number | null } = { down: null };
		const datagrams: Datagram[] = [];
		const stack = new UserspaceStack(
			ourMac,
			(frame) => this.radio.send(CMD_ETH_TX, frame),
			(port, datagram) => {
				if (port !== PIA_PORT) return;
				datagrams.push(datagram);
				notify();
			},
			() => this.clock.now()
		);
		this.unsubscribe.push(
			this.radio.subscribe((type, payload) => {
				if (type === MSG_RX_ETH) {
					if (readEthertype(payload) === ETHERTYPE_LDN) {
						control.push(payload.slice(14));
						notify();
					} else stack.deliver(payload);
				} else if (type === MSG_LINK) {
					const link = parseLink(payload);
					if (!link.up) {
						radioLink.down = link.reason;
						notify();
					}
				} else if (type === MSG_RX_MGMT && payload.length > 2) {
					const action = parseActionFrame(payload.subarray(2));
					if (!action || !equal(action.source, network.address)) return;
					void this.readAdvertisement(action.action).then((info) => {
						if (!info || !sameNetworkId(info, network)) return;
						adverts.push({ ...info, address: action.source, channel: network.channel });
						notify();
					});
				}
			})
		);
		const waitFor = async <T>(check: () => T | null, ms: number): Promise<T | null> => {
			const deadline = this.clock.now() + ms;
			for (;;) {
				const got = check();
				if (got !== null || this.ended) return got;
				const left = deadline - this.clock.now();
				if (left <= 0) return null;
				let wake = () => {};
				const woken = new Promise<void>((resolve) => (wake = resolve));
				waiters.add(wake);
				await Promise.race([woken, this.sleep(Math.min(left, 250))]);
				waiters.delete(wake);
			}
		};

		const ssidHex = toHex(network.ssid);
		this.callbacks.trace?.(
			`join: channel ${network.channel} protocol ${network.protocol} version ${network.version} ` +
				`seats ${network.numParticipants}/${network.maxParticipants} security ${network.securityMode}`
		);
		let joined = false;
		const unlinked = this.radio.subscribe((type, payload) => {
			if (type === MSG_LINK && parseLink(payload).up) joined = true;
		});
		try {
			await this.radio.request(
				CMD_STA_JOIN,
				staJoinPayload(network.channel, network.address, ssidHex, dataKey, ourMac),
				MSG_RESULT
			);
			const up = await waitFor(
				() => (joined ? true : radioLink.down !== null ? false : null),
				TIMING.joinTimeout
			);
			if (!up) {
				throw new SessionError(
					'join-failed',
					radioLink.down !== null
						? `the Trade Radio could not join the console (reason 0x${radioLink.down.toString(16)})`
						: 'the Trade Radio did not join the console in time'
				);
			}
		} finally {
			unlinked();
		}

		await this.authenticate(network, control, waitFor, () => radioLink.down !== null, ourMac);
		const seat = await waitFor(() => {
			const advert = adverts.shift();
			if (!advert) return null;
			const index = advert.participants.findIndex((p) => equal(p.macAddress, ourMac));
			return index >= 0 ? { advert, index } : null;
		}, TIMING.networkWait);
		if (!seat)
			throw new SessionError('join-failed', 'the console did not give the Trade Radio an address');
		const { advert, index } = seat;
		const networkByte = advert.participants[0].ipAddress.split('.')[2];
		stack.ip = advert.participants[index].ipAddress;
		stack.broadcast = `169.254.${networkByte}.255`;
		for (const p of advert.participants)
			if (p.connected) stack.neighbors.set(p.ipAddress, p.macAddress);

		const host = advert.participants[0];
		await new PiaJoiner(
			this,
			keys,
			stack,
			ourMac,
			host.macAddress,
			host.ipAddress,
			stack.ip,
			datagrams,
			waitFor,
			() => {
				if (radioLink.down !== null) return true;
				const frame = control.shift();
				return frame !== undefined && decodeDisconnectFrame(frame) !== null;
			}
		).run();
	}

	private async authenticate(
		network: NetworkInfo,
		control: Bytes[],
		waitFor: <T>(check: () => T | null, ms: number) => Promise<T | null>,
		lost: () => boolean,
		ourMac: Bytes
	): Promise<void> {
		const clientRandom = randomBytes(16);
		const challenge = await encodeChallengeRequest({
			token: network.challenge,
			nonce: BigInt('0x' + toHex(randomBytes(8))),
			deviceId: BigInt('0x' + toHex(randomBytes(8)))
		});
		const frame = await encodeAuthenticationFrame(
			{
				version: network.version,
				statusCode: 0,
				isResponse: false,
				networkId: network,
				serverRandom: network.serverRandom,
				clientRandom,
				payload: authenticationRequestPayload(
					LDN_NAME,
					network.appVersion,
					challenge,
					network.version
				)
			},
			this.keys,
			network.protocol
		);
		for (let attempt = 0; attempt < 3; attempt++) {
			this.radio.send(CMD_ETH_TX, ethernetFrame(network.address, ourMac, ETHERTYPE_LDN, frame));
			const deadline = this.clock.now() + TIMING.authWait;
			while (this.clock.now() < deadline && !this.ended) {
				if (lost()) throw new SessionError('join-failed', 'the console dropped the Trade Radio');
				const data = await waitFor(() => control.shift() ?? null, deadline - this.clock.now());
				if (!data) break;
				const response = await decodeAuthenticationFrame(data, this.keys, network.protocol);
				if (
					!response?.isResponse ||
					!sameNetworkId(response.networkId, network) ||
					!equal(response.serverRandom, network.serverRandom) ||
					!equal(response.clientRandom, clientRandom)
				) {
					continue;
				}
				if (response.statusCode !== 0) {
					throw new SessionError(
						'join-failed',
						`the console refused the Trade Radio (${response.statusCode})`
					);
				}
				return;
			}
		}
		throw new SessionError('join-failed', 'the console did not answer the Trade Radio');
	}

	// --- Hooks the Pia joiner reports through ---

	/** @internal */ isEnded(): boolean {
		return this.ended !== null;
	}
	/** @internal */ end(end: SessionEnd, error: SessionError | null = null): void {
		this.finish(end, error);
	}
	/** @internal */ get abortSignal(): AbortSignal {
		return this.signal;
	}
	/** @internal */ get evidenceRef(): TradeEvidence {
		return this.evidence;
	}
	/** @internal */ get events(): SessionCallbacks {
		return this.callbacks;
	}
	/** @internal */ get offerBytes(): Bytes {
		return this.offer;
	}
	/** @internal */ get snapshotIdentity(): SnapshotIdentity {
		return this.identity;
	}
	/** @internal */ get time(): Clock {
		return this.clock;
	}
}

interface Window {
	seqs: Set<number>;
	through: number | null;
}

/** The Pia half of `swsh_connect.main_async` under the `trade` preset. */
class PiaJoiner {
	private ourConstant: bigint;
	private hostConstant: bigint;
	private broadcastIp: string;
	private nonce: bigint;
	private t0: number;
	private accepted = false;
	private st = {
		seq: null as number | null,
		hostVar: null as number | null,
		hostConstantSeen: null as bigint | null,
		lastUpdate: null as number | null,
		updates: 0,
		station: null as number | null,
		stationReplies: 0,
		theirRequest: null as { constantId: bigint; variableId: number } | null,
		acksOut: 0,
		joinResponse: null as number | null,
		windows: new Map<string, Window>(),
		ackByProto: new Map<number, number>(),
		ackByPort: new Map<string, number>(),
		saidByProto: new Map<number, Bytes>(),
		saidByPort: new Map<string, Bytes>(),
		answerQueue: [] as Bytes[],
		snapshotIn: 0,
		snapshotBodies: new Map<number, Bytes>(),
		theirSequence: null as number | null,
		snapshotRx: new SnapshotReceiver(),
		snapshotFragments: 0,
		snapshotDoneSent: false,
		snapshotSeq: 0,
		offeredPk8: null as Bytes | null,
		ourPk8: null as Bytes | null,
		offerPending: null as Bytes | null,
		offerSeq: null as number | null,
		tradeReadySent: false,
		pk8OfferSent: false,
		ourIndex: null as number | null,
		lastUpdateMesh: null as Bytes | null,
		rpcQueue: [] as Bytes[],
		boxQueue: [] as Bytes[],
		boxNext: 0,
		weAreHost: false,
		migrationPending: null as Bytes | null,
		hostLeaving: null as number | null,
		leftAt: null as number | null,
		rpcSeen: new Map<string, Bytes>(),
		rpcPairSent: new Set<number>(),
		offerStatusAnswered: false,
		rpcBodiesAnswered: new Set<string>(),
		rpcPairDelta: new Map<number, number>(),
		confirmStatusAnswered: new Set<string>(),
		confirmQueue: [...CONFIRM_COMMANDS],
		confirmStepsSeen: new Set<string>(),
		confirmLastStep: null as number | null,
		offeredAgain: false
	};
	private rx: Promise<void> = Promise.resolve();

	constructor(
		private session: SwshJoinSession,
		private keys: SessionKeys,
		private stack: UserspaceStack,
		private ourMac: Bytes,
		private hostMac: Bytes,
		private hostIp: string,
		private ourIp: string,
		private datagrams: Datagram[],
		private waitFor: <T>(check: () => T | null, ms: number) => Promise<T | null>,
		private disconnected: () => boolean
	) {
		this.ourConstant = ldnConstantId(ourMac);
		this.hostConstant = ldnConstantId(hostMac);
		this.broadcastIp = ourIp.split('.').slice(0, 3).join('.') + '.255';
		this.nonce = BigInt('0x' + toHex(randomBytes(8)));
		this.t0 = this.now();
	}

	private now(): number {
		return this.session.time.now();
	}

	private sleep(ms: number): Promise<void> {
		return this.session.time.sleep(ms, this.session.abortSignal);
	}

	private get live(): boolean {
		return !this.session.isEnded();
	}

	private get ev(): TradeEvidence {
		return this.session.evidenceRef;
	}

	async run(): Promise<void> {
		this.session.events.phase('waiting-for-console');
		const guarded = (task: () => Promise<void>) => task().catch(() => undefined);
		const tasks = [
			this.receiver(),
			guarded(() => this.joiner()),
			guarded(() => this.dataSender()),
			guarded(() => this.blockSender()),
			guarded(() => this.snapshotSender()),
			guarded(() => this.rpcSender()),
			guarded(() => this.migrationSender()),
			guarded(() => this.updateMeshSender())
		];
		await this.sender();
		await this.monitor();
		await Promise.all(tasks);
	}

	private async send(
		payload: Uint8Array,
		protocol: number,
		{ port = 0, flags = MESSAGE_FLAGS, destination = 0n, to = this.hostIp } = {}
	): Promise<void> {
		this.nonce = BigInt.asUintN(64, this.nonce + 1n);
		const nonce8 = u64be(this.nonce);
		const station = 0;
		const message = buildMessage(payload, protocol, this.ourConstant, port, flags, destination);
		const packet = await buildPacket(
			this.keys.sessionKey,
			packetIv(this.keys, this.ourMac, nonce8, station),
			message,
			station,
			nonce8
		);
		if (this.live) this.stack.sendUdp(packet, to, PIA_PORT, PIA_PORT);
	}

	// --- The receiver ---

	private async receiver(): Promise<void> {
		while (this.live) {
			const datagram = await this.waitFor(() => this.datagrams.shift() ?? null, 1000);
			if (this.disconnected()) {
				this.session.end('connection-lost');
				return;
			}
			if (!datagram || datagram.sourceIp === this.ourIp) continue;
			try {
				await this.receive(datagram);
			} catch {
				// A malformed message must not stop the session mid-trade.
			}
		}
	}

	private async receive(datagram: Datagram): Promise<void> {
		const opened = await openPacket(this.keys, this.hostMac, datagram.payload);
		if (!opened) return;
		const st = this.st;
		const now = this.now() - this.t0;
		for (const f of await parsePacket(opened.plain)) {
			const body = f.payload;
			const from = datagram.sourceIp;
			if (f.protocol === LOCAL_PROTOCOL) {
				const type = localMessageType(body);
				if (type === START_HOST_MIGRATION && st.hostLeaving === null) st.hostLeaving = now;
				if (type === UPDATE_SESSION) {
					const us = parseUpdateSession(body);
					if (us.hostMigrationState) {
						void this.send(buildLocalAck(us.sequenceId), LOCAL_PROTOCOL, { to: this.broadcastIp });
					}
					st.lastUpdate = now;
					st.updates++;
					st.hostVar = us.hostVariableId;
					st.hostConstantSeen = us.hostConstantId;
					st.seq = us.sequenceId;
				}
			} else if (f.protocol === STATION_PROTOCOL) {
				const kind = body[0];
				st.stationReplies++;
				if (kind === CONNECTION_REQUEST) {
					const them = parseIncomingRequest(body);
					st.theirRequest = them;
					const reply = buildConnectionResponse(0, them.constantId, them.variableId);
					void this.send(reply, STATION_PROTOCOL, { to: from });
				} else if (kind === CONNECTION_RESPONSE) {
					if (body[1] === 0 && !this.accepted) {
						this.accepted = true;
						this.session.events.phase('in-trade-room');
					}
					const ackId =
						st.acksOut % 2 === 0 ? trailingAckId(body) : (st.theirRequest?.variableId ?? 0);
					void this.send(buildStationAck(ackId), STATION_PROTOCOL, { to: from });
					st.acksOut++;
				}
			} else if (f.protocol === MESH_PROTOCOL && f.port === MESH_PORT_RELIABLE) {
				this.reliableWindow(MESH_PROTOCOL, f.port, body, now);
			} else if (f.protocol === MESH_PROTOCOL) {
				const kind = body[0];
				if (kind === JOIN_RESPONSE) {
					const got = parseJoinResponse(body);
					if (got) st.ourIndex = got.ourIndex;
					st.joinResponse ??= now;
				} else if (kind === UPDATE_MESH) {
					st.lastUpdateMesh = body;
				}
				if ((kind === JOIN_REQUEST || kind === JOIN_RESPONSE) && body.length >= 4) {
					void this.send(buildStationAck(trailingAckId(body)), STATION_PROTOCOL, { to: from });
				}
			} else if (f.protocol === RTT_PROTOCOL) {
				const reply = rttResponse(body);
				if (reply) {
					void this.send(reply, RTT_PROTOCOL, {
						flags: RELIABLE_MESSAGE_FLAGS,
						destination: DATA_DESTINATION,
						to: from
					});
				}
			} else if (f.protocol === RELIABLE_PROTOCOL) {
				this.reliableWindow(RELIABLE_PROTOCOL, f.port, body, now);
			} else if (f.protocol === BROADCAST_RELIABLE_PROTOCOL) {
				const got = parseReliableMessage(body);
				if (got.flags & FLAG_APPLICATION_DATA)
					this.reliableWindow(BROADCAST_RELIABLE_PROTOCOL, f.port, body, now);
			} else if (f.protocol === SNAPSHOT_PROTOCOL) {
				await this.snapshotMessage(body, f.port);
			}
		}
	}

	private async snapshotMessage(body: Bytes, port: number): Promise<void> {
		const st = this.st;
		st.snapshotIn++;
		const got = parseSnapshotMessage(body);
		st.theirSequence = got.sequence;
		if (got.kind === KIND_DATA && !st.snapshotBodies.has(got.index!)) {
			// A compressed final fragment arrives with only the bytes after its prefix deflated.
			st.snapshotBodies.set(got.index!, (await inflate(got.body!)) ?? got.body!);
		}
		if (
			got.kind === KIND_ACK &&
			st.snapshotFragments &&
			got.base! >= st.snapshotFragments &&
			!st.snapshotDoneSent
		) {
			st.snapshotDoneSent = true;
			void this.send(buildSnapshotDone(st.snapshotSeq, got.sequence), SNAPSHOT_PROTOCOL, {
				port,
				destination: DATA_DESTINATION
			});
		}
		for (const reply of st.snapshotRx.feed(body)) {
			void this.send(reply, SNAPSHOT_PROTOCOL, { port, destination: DATA_DESTINATION });
		}
	}

	private reliableWindow(protocol: number, port: number, body: Bytes, now: number): void {
		const st = this.st;
		const windowKey = key(protocol, port);
		let w = st.windows.get(windowKey);
		if (!w) st.windows.set(windowKey, (w = { seqs: new Set(), through: null }));
		const got = parseReliableMessage(body);
		if (got.isAck) {
			let ids: number[];
			try {
				ids = ackIds(got.payload);
			} catch {
				return;
			}
			for (const id of ids) {
				st.ackByProto.set(protocol, Math.max(st.ackByProto.get(protocol) ?? 0, id));
				st.ackByPort.set(windowKey, Math.max(st.ackByPort.get(windowKey) ?? 0, id));
			}
			return;
		}
		const payload = got.payload;
		const fresh = !(w.seqs.size && got.sequence <= Math.max(...w.seqs));
		if (fresh) {
			st.saidByProto.set(protocol, payload);
			st.saidByPort.set(windowKey, payload);
		}
		if (protocol === RELIABLE_PROTOCOL) this.tradeRpc(payload, now);
		if (protocol === MESH_PROTOCOL) this.migration(payload);
		const command = parseBoxCommand(payload);
		if (command !== null && fresh) this.boxCommand(command, now);
		const offered = offeredPokemon(payload);
		if (offered && fresh && this.ev.ladderFinished) {
			st.offeredAgain = true;
			this.session.end('console-offered-again');
		}
		if (offered && st.offeredPk8 === null) {
			st.offeredPk8 = offered;
			this.ev.offered = offered;
			this.session.events.offer(offered);
			this.session.events.phase('offer-received');
			if (st.ourPk8) {
				st.offerPending = pokemonTrade(st.ourPk8);
				st.pk8OfferSent = true;
			}
		}
		if (w.through === null) w.through = got.sequence - 1;
		w.seqs.add(got.sequence);
		const through = contiguousThrough(w.seqs, w.through);
		if (through === w.through) return;
		w.through = through;
		const ack = buildAckMessage(through + 1, got.streamId);
		void this.send(ack, protocol, {
			port,
			flags: RELIABLE_MESSAGE_FLAGS,
			destination: DATA_DESTINATION
		});
	}

	private boxCommand(command: number, now: number): void {
		const action = ({ 1: 'offer-shown', 3: 'left', 4: 'confirmed', 5: 'withdrew' } as const)[
			command as 1 | 3 | 4 | 5
		];
		if (!action) return;
		this.session.events.consoleAction(action);
		if (command === 4) {
			this.ev.consoleConfirmed = true;
			this.session.events.phase('confirming');
		} else if (command === 5) {
			this.ev.consoleConfirmed = false;
			if (!this.ev.ladderStarted) this.session.events.phase('offer-received');
		} else if (command === 3) {
			this.st.leftAt ??= now;
		}
	}

	private tradeRpc(payload: Bytes, now: number): void {
		const st = this.st;
		const member = parseRpc(payload);
		if (
			!member ||
			member.base === null ||
			!RPC_BASES.includes(Number(member.base) as 10000 | 20000)
		)
			return;
		const base = Number(member.base);
		const offset = Number(member.offset ?? 0);
		const bodyHex = toHex(member.body);
		const confirmationEnvelope = 40000 + CONFIRMATION_OFFSET;
		st.rpcSeen.set(key(member.envelope, base), payload);
		if (
			member.envelope === confirmationEnvelope &&
			base === RPC_BASES[1] &&
			member.body.length === 4
		) {
			if (!st.confirmStepsSeen.has(bodyHex)) {
				st.confirmStepsSeen.add(bodyHex);
				st.confirmLastStep = now;
				const step = parseSyncStep(member.body);
				this.ev.ladderStarted = true;
				if (step && step[0] <= LADDER_FINAL_PHASE && step[0] > (this.ev.ladderPhase ?? -1)) {
					this.ev.ladderPhase = step[0];
					this.session.events.ladder(step[0]);
				}
				if (step && step[0] >= LADDER_FINAL_PHASE && !this.ev.ladderFinished) {
					this.ev.ladderFinished = true;
					this.session.events.phase('finishing');
				}
			}
		}
		let answeredConfirmation = false;
		const seenBody = key(member.envelope, base, bodyHex);
		if (
			st.confirmQueue.length &&
			member.envelope === confirmationEnvelope &&
			base === RPC_BASES[1] &&
			member.body.length === 4 &&
			!st.confirmStatusAnswered.has(seenBody)
		) {
			st.confirmStatusAnswered.add(seenBody);
			const command = st.confirmQueue.shift()!;
			answeredConfirmation = true;
			st.boxQueue.push(syncCommand(offset, command));
			st.boxNext = 0;
			const status = answerRpc(payload, this.ourConstant, CLOCK_DELTA);
			if (status) st.rpcQueue.unshift(status);
			st.rpcBodiesAnswered.add(seenBody);
		}
		const endsReady = bodyHex.endsWith('0100');
		if (
			!answeredConfirmation &&
			base === RPC_BASES[1] &&
			endsReady &&
			member.body.length === 4 &&
			!st.offerStatusAnswered &&
			st.ourPk8
		) {
			st.offerStatusAnswered = true;
			st.boxQueue.push(pokemonOffer(offset, st.ourPk8));
			st.boxNext = 0;
			const status = answerRpc(payload, this.ourConstant, CLOCK_DELTA);
			if (status) st.rpcQueue.unshift(status);
			st.rpcBodiesAnswered.add(seenBody);
		} else if (member.clock !== null && member.body.length === 4) {
			if (!st.rpcBodiesAnswered.has(seenBody) && !OPENING_BODIES.includes(bodyHex)) {
				if (
					member.envelope === confirmationEnvelope ||
					member.envelope === 40000 + SELECTION_OFFSET
				) {
					st.rpcPairSent.delete(member.envelope);
					st.rpcPairDelta.set(member.envelope, FINAL_DELTA);
				}
				const reply = answerRpc(payload, this.ourConstant, CLOCK_DELTA);
				if (reply) {
					st.rpcBodiesAnswered.add(seenBody);
					st.rpcQueue.push(reply);
				}
			}
		}
	}

	private migration(payload: Bytes): void {
		const st = this.st;
		const start = parseMigrationStart(payload);
		if (!start) return;
		st.boxQueue = [boxSyncState(4)];
		st.boxNext = 0;
		st.offerPending = null;
		if (st.migrationPending === null) {
			const index = st.ourIndex ?? start.newHostIndex;
			if (start.newHostIndex !== index) {
				st.migrationPending = buildMigrationResponse(index);
			} else {
				st.migrationPending = buildMigrationFinish(index);
				st.weAreHost = true;
			}
		}
	}

	// --- The senders ---

	/** The update-session acks, then one connection request. */
	private async sender(): Promise<void> {
		const st = this.st;
		await this.sleep(TIMING.listenFirst);
		if (st.seq === null) {
			if (this.live) {
				this.session.end(
					'console-not-ready',
					new SessionError('console-not-ready', 'the console is not hosting a Link Trade session')
				);
			}
			return;
		}
		st.station = 0;
		const deadline = this.now() + TIMING.ackPhase;
		while (this.live && this.now() < deadline) {
			void this.send(buildLocalAck(st.seq), LOCAL_PROTOCOL, { to: this.broadcastIp });
			await this.sleep(TIMING.ackPeriod);
			const quiet = this.now() - this.t0 - (st.lastUpdate ?? 0);
			if (st.updates > 3 && quiet > TIMING.quietFor) break;
		}
		if (!this.live) return;
		const variableId = Number.parseInt(toHex(randomBytes(4)), 16);
		const location = stationLocation(
			this.ourIp,
			PIA_PORT,
			this.ourConstant,
			variableId,
			ldnServiceVariableId(this.ourMac)
		);
		const target = st.hostConstantSeen ?? this.hostConstant;
		void this.send(buildConnectionRequest(target, st.hostVar ?? 0, location), STATION_PROTOCOL);
		await this.sleep(TIMING.requestGap);
	}

	private async waitAccepted(ms: number): Promise<boolean> {
		return (await this.waitFor(() => (this.accepted ? true : null), ms)) === true;
	}

	private async joiner(): Promise<void> {
		if (!(await this.waitAccepted(TIMING.joinWait))) return;
		const payload = buildJoinRequest(Number.parseInt(toHex(randomBytes(4)), 16));
		const deadline = this.now() + TIMING.joinSeconds;
		while (this.live && this.now() < deadline && this.st.joinResponse === null) {
			void this.send(payload, MESH_PROTOCOL);
			await this.sleep(TIMING.joinGap);
		}
	}

	private async dataSender(): Promise<void> {
		const st = this.st;
		if (!(await this.waitAccepted(TIMING.sendWait))) return;
		await this.sleep(TIMING.sendAfter);
		let payload: Bytes = fromHex('610000000a00');
		let seq = 1;
		while (this.live) {
			const said = st.saidByProto.get(RELIABLE_PROTOCOL);
			if (st.offerPending === null && st.boxQueue.length && this.now() >= st.boxNext) {
				st.offerPending = st.boxQueue.shift()!;
				st.boxNext = this.now() + TIMING.boxPeriod;
			}
			if (st.offerPending !== null) {
				payload = st.offerPending;
				st.offerSeq = seq;
			} else if (said) {
				[payload, st.answerQueue] = nextAnswer(
					said,
					st.answerQueue,
					this.ourConstant,
					CLOCK_DELTA,
					st.ourPk8
				);
			}
			void this.send(buildDataMessage(payload, seq), RELIABLE_PROTOCOL, {
				destination: DATA_DESTINATION
			});
			await this.sleep(TIMING.sendPeriod);
			if ((st.ackByProto.get(RELIABLE_PROTOCOL) ?? 0) > seq) {
				if (st.offerSeq === seq) {
					st.offerPending = null;
					st.offerSeq = null;
					if (!st.boxQueue.length && st.pk8OfferSent && !st.tradeReadySent && st.ourPk8) {
						st.tradeReadySent = true;
						st.boxQueue = [
							boxSyncState(1),
							pokemonOffer(30, st.ourPk8),
							pokemonOffer(50, st.ourPk8)
						];
						st.boxNext = 0;
					}
				}
				seq++;
			}
		}
	}

	private async blockSender(): Promise<void> {
		const st = this.st;
		const trigger = fromHex('60ea000012020801');
		while (this.live) {
			const said = st.saidByProto.get(BROADCAST_RELIABLE_PROTOCOL);
			if (said && equal(said, trigger)) break;
			await this.sleep(200);
		}
		let seq = 1;
		while (this.live && seq - 1 < 200) {
			const body = buildDataMessage(trigger, seq, [this.hostConstant]);
			void this.send(body, BROADCAST_RELIABLE_PROTOCOL, { destination: DATA_DESTINATION });
			await this.sleep(TIMING.sendPeriod);
			if ((st.ackByProto.get(BROADCAST_RELIABLE_PROTOCOL) ?? 0) > seq) seq++;
		}
	}

	/** Our 0x84 snapshot: the console's own, with our identity and our offer in slot 1. */
	private async snapshotSender(): Promise<void> {
		const st = this.st;
		while (this.live) {
			if ([...Array(SNAPSHOT_FRAGMENTS).keys()].every((i) => st.snapshotBodies.has(i))) break;
			await this.sleep(50);
		}
		if (!this.live) return;
		const theirs = concat(
			...[...Array(SNAPSHOT_FRAGMENTS).keys()].map((i) => st.snapshotBodies.get(i)!)
		);
		if (theirs.length !== SNAPSHOT_LENGTH) return;
		const ours = buildOurSnapshot(theirs, this.session.offerBytes, this.session.snapshotIdentity);
		st.ourPk8 = this.session.offerBytes;
		const sender = new SnapshotSender();
		st.snapshotFragments = snapshotFragmentCount(ours.length);
		while (this.live && !st.snapshotDoneSent) {
			if (st.theirSequence !== null) sender.peer = st.theirSequence;
			st.snapshotSeq = sender.sequence;
			for (const message of sender.transfer(ours)) {
				void this.send(message, SNAPSHOT_PROTOCOL, { port: 1, destination: DATA_DESTINATION });
				await this.sleep(TIMING.snapshotPeriod);
			}
			await this.sleep(TIMING.snapshotRepeat);
		}
	}

	/** Answers the trade RPC pairs on 0x7C port 1, a window of its own. */
	private async rpcSender(): Promise<void> {
		const st = this.st;
		const port = 1;
		const windowKey = key(RELIABLE_PROTOCOL, port);
		let seq = 1;
		while (this.live) {
			const said = st.saidByPort.get(windowKey);
			const envelopes = [
				...new Set([...st.rpcSeen.keys()].map((k) => Number(k.split(':')[0])))
			].sort((a, b) => a - b);
			for (const envelope of envelopes) {
				if (st.rpcPairSent.has(envelope)) continue;
				const members = RPC_BASES.map((base) => st.rpcSeen.get(key(envelope, base)));
				if (members.some((m) => !m)) continue;
				const delta = st.rpcPairDelta.get(envelope) ?? CLOCK_DELTA;
				const both = members.map((m) => answerRpc(m!, this.ourConstant, delta));
				if (both.every((b) => b)) {
					st.rpcPairSent.add(envelope);
					st.rpcQueue = [...(both as Bytes[]), ...st.rpcQueue];
				}
			}
			const pending = st.rpcQueue[0] ?? null;
			const answer = pending ?? (said ? answerRpc(said, this.ourConstant, CLOCK_DELTA) : null);
			if (!answer) {
				await this.sleep(100);
				continue;
			}
			if (pending === null && st.rpcPairSent.size) {
				await this.sleep(TIMING.rpcPeriod);
				continue;
			}
			const body = buildDataMessage(answer, seq, [this.hostConstant]);
			void this.send(body, RELIABLE_PROTOCOL, { port, destination: DATA_DESTINATION });
			await this.sleep(TIMING.rpcPeriod);
			if ((st.ackByPort.get(windowKey) ?? 0) > seq) {
				if (pending !== null && st.rpcQueue[0] === pending) st.rpcQueue.shift();
				seq++;
			}
		}
	}

	private async migrationSender(): Promise<void> {
		const st = this.st;
		const windowKey = key(MESH_PROTOCOL, MESH_PORT_RELIABLE);
		const seq = 1;
		while (this.live) {
			const payload = st.migrationPending;
			if (!payload) {
				await this.sleep(100);
				continue;
			}
			const body = buildDataMessage(payload, seq, [this.hostConstant]);
			void this.send(body, MESH_PROTOCOL, {
				port: MESH_PORT_RELIABLE,
				destination: DATA_DESTINATION
			});
			await this.sleep(TIMING.migrationPeriod);
			if ((st.ackByPort.get(windowKey) ?? 0) > seq) {
				st.migrationPending = null;
				return;
			}
		}
	}

	private async updateMeshSender(): Promise<void> {
		const st = this.st;
		let counter: number | null = null;
		while (this.live) {
			if (!(st.weAreHost && st.lastUpdateMesh && st.ourIndex !== null)) {
				await this.sleep(100);
				continue;
			}
			counter = (counter ?? updateMeshCounter(st.lastUpdateMesh)) + 1;
			const body = rewriteUpdateMesh(st.lastUpdateMesh, st.ourIndex, counter);
			void this.send(body, MESH_PROTOCOL, { destination: DATA_DESTINATION });
			await this.sleep(TIMING.updateMeshPeriod);
		}
	}

	/** pokeldn's hold loop, plus PKSX's end conditions. */
	private async monitor(): Promise<void> {
		const st = this.st;
		const holdUntil = this.now() + TIMING.hold;
		while (this.live) {
			await this.sleep(TIMING.monitorPeriod);
			if (!this.live) return;
			const now = this.now();
			const elapsed = now - this.t0;
			if (this.disconnected()) return this.session.end('connection-lost');
			if (st.hostLeaving !== null) {
				// Only box command 3 says the player left; a closed network alone may be a lost link.
				return this.session.end(st.leftAt !== null ? 'console-left' : 'connection-lost');
			}
			if (st.leftAt !== null && elapsed - st.leftAt > TIMING.leaveGrace) {
				return this.session.end('console-left');
			}
			if (!this.accepted && elapsed > TIMING.consoleReady) {
				return this.session.end(
					'console-not-ready',
					new SessionError(
						'console-not-ready',
						'the Switch did not accept the session; press A on both Link Trade messages and try again'
					)
				);
			}
			if (
				st.confirmLastStep !== null &&
				!this.ev.ladderFinished &&
				elapsed - st.confirmLastStep >= TIMING.abortOnStall
			) {
				return this.session.end('ladder-stalled');
			}
			const midTrade = this.ev.offered !== null || this.ev.ladderFinished;
			if (now >= holdUntil && !(midTrade && now < holdUntil + TIMING.grace)) {
				return this.session.end('timed-out');
			}
		}
	}
}
