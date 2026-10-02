// SPDX-License-Identifier: AGPL-3.0-only
// Ported from pokeldn v0.4.0 `pokeldn/swsh/trade.py` and `pokeldn/swsh/trade_payload.py`.
// pokeldn's trainer rewrite of the offered Pokemon and its PID/EC re-roll are deliberately not
// ported: the offer goes out exactly as prepared. See ./NOTICE.md.

import { concat, equal, readU16le, readU32le, u16le, u32le, view, type Bytes } from './bytes';

export const PK8_PARTY_SIZE = 0x158;
const PK8_SIZES = [0x148, 0x158];

function varint(value: bigint | number): Bytes {
	let v = BigInt(value);
	const out: number[] = [];
	while (v > 0x7fn) {
		out.push(Number(v & 0x7fn) | 0x80);
		v >>= 7n;
	}
	out.push(Number(v));
	return Uint8Array.from(out);
}

function field(number: number, payload: Uint8Array): Bytes {
	return concat(varint((number << 3) | 2), varint(payload.length), payload);
}

function fieldVarint(number: number, value: bigint | number): Bytes {
	return concat(varint(number << 3), varint(value));
}

type Fields = Map<number, bigint | Bytes>;

/** -> a flat protobuf message's varint and length-delimited fields, or null when malformed. */
function readFields(data: Uint8Array): Fields | null {
	const out: Fields = new Map();
	let i = 0;
	const next = (): bigint | null => {
		let value = 0n;
		let shift = 0n;
		while (i < data.length) {
			const b = data[i++];
			value |= BigInt(b & 0x7f) << shift;
			if (!(b & 0x80)) return value;
			shift += 7n;
		}
		return null;
	};
	while (i < data.length) {
		const tag = next();
		if (tag === null) return null;
		const number = Number(tag >> 3n);
		const wire = Number(tag & 7n);
		if (wire === 0) {
			const value = next();
			if (value === null) return null;
			out.set(number, value);
		} else if (wire === 2) {
			const size = next();
			if (size === null) return null;
			out.set(number, data.slice(i, i + Number(size)));
			i += Number(size);
		} else break;
	}
	return out;
}

const asBytes = (value: bigint | Bytes | undefined) => (value instanceof Uint8Array ? value : null);
const asInt = (value: bigint | Bytes | undefined) => (typeof value === 'bigint' ? value : null);

export function message(id: number, body: Uint8Array = new Uint8Array()): Bytes {
	return concat(u32le(id), body);
}

function split(payload: Uint8Array): { id: number; body: Bytes } | null {
	return payload.length < 4 ? null : { id: readU32le(payload, 0), body: payload.slice(4) };
}

export const POKEMON_TRADE = 20030;
const BLOCK = 60000;
const PING = 1;
const PING_REPLY = 2;
const PING_SYNCED = 3;

export function sync(id: number, which: number): Bytes {
	return message(id, field(which, new Uint8Array()));
}

const result = () => message(BLOCK, field(1, new Uint8Array()));
export const imReady = () => message(BLOCK, field(2, fieldVarint(1, 1)));

function pk8(data: Uint8Array): Uint8Array {
	if (!PK8_SIZES.includes(data.length)) {
		throw new Error(`${data.length} bytes is not a PK8 (0x148 stored or 0x158 party)`);
	}
	return data;
}

/** PokemonTradeDataHolder{pokemon{serializePokemonParam: <the encrypted PK8>}} on 20030. */
export function pokemonTrade(data: Uint8Array): Bytes {
	return message(POKEMON_TRADE, field(1, field(1, pk8(data))));
}

const RPC_ENVELOPE_BASE = 40000;
export const RPC_BASES = [10000, 20000] as const;
export const SELECTION_OFFSET = 50;
export const CONFIRMATION_OFFSET = 40;
const CONTENT_BASE_LOW = 10000;
const RPC_PAIR_BODIES = [Uint8Array.of(0, 0, 0, 0), Uint8Array.of(0, 0, 0x18, 0xfc)];

export function buildRpc(
	offset: number,
	base: number,
	stationId: bigint,
	clock: bigint,
	body: Uint8Array
): Bytes {
	const inner = concat(
		fieldVarint(1, offset),
		fieldVarint(2, base),
		fieldVarint(3, stationId),
		fieldVarint(4, clock),
		field(5, body)
	);
	return message(RPC_ENVELOPE_BASE + offset, field(1, inner));
}

export function buildRpcPair(offset: number, stationId: bigint, clock: bigint): Bytes[] {
	return RPC_BASES.map((base, i) => buildRpc(offset, base, stationId, clock, RPC_PAIR_BODIES[i]));
}

export interface Rpc {
	envelope: number;
	offset: bigint | null;
	base: bigint | null;
	stationId: bigint | null;
	clock: bigint | null;
	body: Bytes;
}

/** -> the five members of a trade RPC in the 40000 band, or null. */
export function parseRpc(payload: Uint8Array): Rpc | null {
	const got = split(payload);
	if (!got || !(got.id > RPC_ENVELOPE_BASE && got.id <= RPC_ENVELOPE_BASE + 1000)) return null;
	const outer = asBytes(readFields(got.body)?.get(1));
	const inner = outer && readFields(outer);
	if (!inner) return null;
	return {
		envelope: got.id,
		offset: asInt(inner.get(1)),
		base: asInt(inner.get(2)),
		stationId: asInt(inner.get(3)),
		clock: asInt(inner.get(4)),
		body: asBytes(inner.get(5)) ?? new Uint8Array()
	};
}

/** -> the same RPC with our station id and the clock advanced, or null if it is not whole. */
export function answerRpc(
	payload: Uint8Array,
	stationId: bigint,
	clockDelta: number
): Bytes | null {
	const got = parseRpc(payload);
	if (!got || got.offset === null || got.base === null || got.clock === null) return null;
	return buildRpc(
		Number(got.offset),
		Number(got.base),
		stationId,
		got.clock + BigInt(clockDelta),
		got.body
	);
}

/** -> `(phase, announced)` from a four-byte step body, or null. */
export function parseSyncStep(body: Uint8Array): [number, number] | null {
	return body.length === 4 ? [readU16le(body, 0), readU16le(body, 2)] : null;
}

/** `ping` on a content's 10000-base holder carrying our PK8 (the open-content offer). */
export function pokemonOffer(offset: number, data: Uint8Array): Bytes {
	return message(CONTENT_BASE_LOW + offset, field(1, field(1, pk8(data))));
}

/** SyncSaveDataHolder{syncCommand{data}} on a content's 10000-base holder. */
export function syncCommand(offset: number, data: number): Bytes {
	return message(CONTENT_BASE_LOW + offset, field(1, fieldVarint(1, data)));
}

/** BoxSyncStateDataHolder{boxSyncStateCommand{data: command}} on 20030. */
export function boxSyncState(command: number): Bytes {
	return message(POKEMON_TRADE, field(2, fieldVarint(1, command)));
}

export function parseBoxCommand(payload: Uint8Array): number | null {
	const got = split(payload);
	if (!got || got.id !== POKEMON_TRADE) return null;
	const inner = asBytes(readFields(got.body)?.get(2));
	const value = inner && asInt(readFields(inner)?.get(1));
	return value === null || value === undefined ? null : Number(value);
}

/** -> the PK8 inside the console's offer on 20030, or null. */
export function offeredPokemon(payload: Uint8Array): Bytes | null {
	const got = split(payload);
	if (!got || got.id !== POKEMON_TRADE) return null;
	const outer = asBytes(readFields(got.body)?.get(1));
	const value = outer && asBytes(readFields(outer)?.get(1));
	return value && PK8_SIZES.includes(value.length) ? value : null;
}

const SYNC_ANSWERS: [Bytes, Bytes[]][] = [
	[sync(97, PING), [sync(97, PING_REPLY), sync(97, PING)]],
	[sync(97, PING_SYNCED), [sync(97, PING_SYNCED), result()]],
	[sync(110, PING), [sync(110, PING)]],
	[sync(110, PING_REPLY), [sync(110, PING_REPLY), sync(110, PING_SYNCED)]],
	[sync(120, PING), [sync(120, PING)]],
	[sync(120, PING_REPLY), [sync(120, PING_REPLY), sync(120, PING_SYNCED)]],
	[sync(130, PING), [sync(130, PING), sync(130, PING_REPLY)]],
	[sync(130, PING_SYNCED), [sync(130, PING_SYNCED)]]
];

function answersFor(payload: Uint8Array): Bytes[] {
	return SYNC_ANSWERS.find(([said]) => equal(said, payload))?.[1] ?? [];
}

/**
 * -> what to send now and the queue after it: the table's rule, else our offer for the console's,
 * else an RPC answered with our station id, else the console's own payload echoed back.
 */
export function nextAnswer(
	said: Bytes,
	queue: Bytes[],
	stationId: bigint,
	clockDelta: number,
	offer: Bytes | null
): [Bytes, Bytes[]] {
	let next = [...queue];
	if (!next.length) next = answersFor(said);
	if (!next.length && offer && offeredPokemon(said)) next = [pokemonTrade(offer)];
	if (!next.length) {
		const answer = answerRpc(said, stationId, clockDelta);
		if (answer) next = [answer];
	}
	return next.length ? [next[0], next.slice(1)] : [said, []];
}

// The 3456-byte trade snapshot on 0x84 (`trade_payload.py`).
export const SNAPSHOT_LENGTH = 3456;
export const SNAPSHOT_FRAGMENTS = 3;
const PARTY_BLOCK = 6 * PK8_PARTY_SIZE;
const MY_STATUS = PARTY_BLOCK + 4;
const TRAINER_CARD = MY_STATUS + 272;
const TAIL = TRAINER_CARD + 456;
const NAME_LENGTH = 0x1a;

export interface SnapshotIdentity {
	trainerName: string;
	trainerId: number;
	secretId: number;
}

/**
 * -> the console's own snapshot with a new trainer identity in MyStatus, the trainer card and the
 * profile, and party slot 1 replaced by our offer. The other party records stay the console's.
 */
export function buildOurSnapshot(
	theirs: Uint8Array,
	offer: Uint8Array,
	identity: SnapshotIdentity
): Bytes {
	if (theirs.length !== SNAPSHOT_LENGTH) throw new Error(`a snapshot is ${SNAPSHOT_LENGTH} bytes`);
	if (offer.length !== PK8_PARTY_SIZE) throw new Error('the offer must be a 0x158-byte party PK8');
	const out = new Uint8Array(theirs);
	const name = new Uint8Array(NAME_LENGTH);
	const units = Array.from(identity.trainerName, (c) => c.charCodeAt(0));
	if (units.length * 2 + 2 > NAME_LENGTH) throw new Error('trainer name is too long');
	units.forEach((unit, i) => name.set(u16le(unit), i * 2));
	out.set(name, MY_STATUS + 0xb0);
	out.set(name, TRAINER_CARD);
	out.set(name.subarray(0, 24), TAIL + 0x28);
	const v = view(out);
	v.setUint16(MY_STATUS + 0xa0, identity.trainerId, true);
	v.setUint16(MY_STATUS + 0xa2, identity.secretId, true);
	const cardId = ((identity.secretId << 16) | identity.trainerId) >>> 0;
	v.setUint32(TRAINER_CARD + 0x1c, cardId % 1_000_000, true);
	out.set(offer, 0);
	return out;
}
