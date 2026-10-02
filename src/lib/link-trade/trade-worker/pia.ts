// SPDX-License-Identifier: AGPL-3.0-only
// Ported from pokeldn v0.4.0 `pokeldn/ldn/{sead,pia4,pia5,reliable4,reliable5,broadcast4,
// station4,station_protocol,mesh_protocol,local_protocol,rtt_protocol}.py` and
// `pokeldn/swsh/session.py`. See ./NOTICE.md.

import {
	concat,
	crc32,
	readU16be,
	readU32be,
	readU32le,
	readU64be,
	u16be,
	u32be,
	u32le,
	u64be,
	view,
	type Bytes
} from './bytes';
import { aesEcbEncrypt, aesGcmDecrypt, aesGcmEncrypt } from './crypto';

// Sword/Shield's session constants (`pokeldn/swsh/session.py`).
export const PASSPHRASE = new TextEncoder().encode(
	'W3GoSMEn7RIIUQ89rzqBHGhGferRNb7K18ZBq2aNuj8Us9RO9Q9JYyGOZlLy8MYL'
);
export const GAME_KEY = new TextEncoder().encode('p1frXqxmeCZWFv0X');
export const SWORD_COMM_ID = 0x0100abf008968000n;
export const PIA_PORT = 12345;

const M32 = 0xffffffff;

/** SEAD's xorshift128, seeded as Pia seeds it; -> `size` bytes, each draw little-endian. */
export function seadBytes(seed: number, size: number): Bytes {
	let temp = seed >>> 0;
	const state: number[] = [];
	for (let i = 1; i <= 4; i++) {
		temp = (temp ^ (temp >>> 30)) >>> 0;
		temp = (Math.imul(temp, 0x6c078965) + i) >>> 0;
		state.push(temp);
	}
	const out: Bytes[] = [];
	for (let n = 0; n < size / 4; n++) {
		const [s0, , , s3] = state;
		let t = (s0 ^ (s0 << 11)) >>> 0;
		t = (t ^ (t >>> 8)) >>> 0;
		t = (t ^ s3 ^ (s3 >>> 19)) >>> 0;
		state.splice(0, 4, state[1], state[2], s3, t & M32);
		out.push(u32le(t));
	}
	return concat(...out);
}

export interface SessionKeys {
	sessionKey: Bytes;
	networkIdLe: Bytes;
}

/** -> the Pia session key and network id, from the advertisement's application data. */
export async function sessionKeys(applicationData: Uint8Array): Promise<SessionKeys> {
	if (applicationData.length < 16) {
		throw new Error(`application data is ${applicationData.length} bytes, need at least 16`);
	}
	const seed = readU32le(applicationData, 12);
	return {
		sessionKey: await aesEcbEncrypt(GAME_KEY, seadBytes(seed, 16)),
		networkIdLe: applicationData.slice(0, 4)
	};
}

/** The twelve-byte GCM IV of a version-4 packet. */
export function packetIv(
	keys: SessionKeys,
	sourceMac: Uint8Array,
	nonce8: Uint8Array,
	sourceId: number
) {
	const crc = u32be(crc32(concat(keys.networkIdLe, sourceMac)));
	return concat(crc.subarray(0, 3), Uint8Array.of(sourceId & 0xff), nonce8);
}

/** A station's constant id in LDN mode, from its MAC. */
export function ldnConstantId(mac: Uint8Array): bigint {
	const b = (i: number) => BigInt(mac[i]);
	return (
		(b(2) << 56n) | (b(4) << 48n) | (b(5) << 40n) | (b(3) << 32n) | (b(1) << 24n) | (b(0) << 16n)
	);
}

export function ldnServiceVariableId(mac: Uint8Array): number {
	return crc32(mac);
}

// Pia version 4 packets.
export const PIA_MAGIC = 0x32ab9864;
export const MESSAGE_FLAGS = 0x09;
export const MESSAGE_FLAG_ZLIB = 0x10;

export function isPia4(data: Uint8Array): boolean {
	return data.length >= 0x20 && readU32be(data, 0) === PIA_MAGIC && (data[4] & 0x7f) === 4;
}

export interface PiaMessage {
	flags: number;
	protocol: number;
	port: number;
	destination: bigint;
	source: bigint;
	payload: Bytes;
}

/** One version-4 message, padded to four bytes; `source` is the sender's constant id. */
export function buildMessage(
	payload: Uint8Array,
	protocol: number,
	source: bigint,
	port = 0,
	messageFlags = MESSAGE_FLAGS,
	destination = 0n
): Bytes {
	const out = concat(
		Uint8Array.of(0x7f, messageFlags & 0xff),
		u16be(payload.length),
		Uint8Array.of(protocol & 0xff, (port >> 16) & 0xff, (port >> 8) & 0xff, port & 0xff),
		u64be(destination),
		u64be(source),
		payload
	);
	return concat(out, new Uint8Array(-out.length & 3));
}

const FIELDS = [
	[0x01, 1, 'flags'],
	[0x02, 2, 'size'],
	[0x04, 4, 'protoPort'],
	[0x08, 8, 'destination'],
	[0x10, 8, 'source']
] as const;

/** Splits a decrypted payload into messages, inheriting omitted header fields; zlib is inflated. */
export async function parsePacket(plain: Uint8Array): Promise<PiaMessage[]> {
	const out: PiaMessage[] = [];
	let off = 0;
	let prev: Record<string, bigint> | null = null;
	while (off < plain.length) {
		const present = plain[off];
		if (present === 0xff || (present === 0 && !prev)) break;
		const size = 1 + FIELDS.reduce((n, [bit, width]) => n + (present & bit ? width : 0), 0);
		if (off + size > plain.length) break;
		const fields: Record<string, bigint> = {};
		let p = off + 1;
		for (const [bit, width, name] of FIELDS) {
			if (present & bit) {
				let value = 0n;
				for (let i = 0; i < width; i++) value = (value << 8n) | BigInt(plain[p + i]);
				fields[name] = value;
				p += width;
			} else {
				fields[name] = prev?.[name] ?? 0n;
			}
		}
		const end = p + Number(fields.size);
		if (end > plain.length) break;
		const flags = Number(fields.flags);
		let payload: Bytes = plain.slice(p, end);
		if (flags & MESSAGE_FLAG_ZLIB) payload = (await inflate(payload)) ?? payload;
		out.push({
			flags,
			protocol: Number(fields.protoPort >> 24n),
			port: Number(fields.protoPort & 0xffffffn),
			destination: fields.destination,
			source: fields.source,
			payload
		});
		prev = fields;
		off = end + (-end & 3);
	}
	return out;
}

/** A whole version-4 packet: header, 16-byte tag, and the 0xFF-padded body under AES-GCM. */
export async function buildPacket(
	sessionKey: Uint8Array,
	iv: Uint8Array,
	plain: Uint8Array,
	station: number,
	nonce8: Uint8Array
): Promise<Bytes> {
	const padded = concat(plain, new Uint8Array(-plain.length & 15).fill(0xff));
	const { ciphertext, tag } = await aesGcmEncrypt(sessionKey, iv, padded);
	return concat(
		u32be(PIA_MAGIC),
		Uint8Array.of(0x84, station & 0xff),
		u16be(0),
		nonce8,
		tag,
		ciphertext
	);
}

/** -> the station byte, nonce and plaintext, or null when it is not ours to read. */
export async function openPacket(
	keys: SessionKeys,
	sourceMac: Uint8Array,
	data: Uint8Array
): Promise<{ station: number; plain: Bytes } | null> {
	if (!isPia4(data)) return null;
	const station = data[5];
	const iv = packetIv(keys, sourceMac, data.subarray(8, 16), station);
	const plain = await aesGcmDecrypt(
		keys.sessionKey,
		iv,
		data.subarray(0x20),
		data.subarray(16, 32)
	);
	return plain ? { station, plain } : null;
}

export async function inflate(data: Uint8Array): Promise<Bytes | null> {
	try {
		const stream = new Blob([new Uint8Array(data)])
			.stream()
			.pipeThrough(new DecompressionStream('deflate'));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch {
		return null;
	}
}

// The reliable window, protocols 0x7C and 0x80 (`reliable4.py`).
export const RELIABLE_PROTOCOL = 0x7c;
export const BROADCAST_RELIABLE_PROTOCOL = 0x80;
export const RELIABLE_MESSAGE_FLAGS = 0x01;
export const FLAG_APPLICATION_DATA = 0x01;
export const FIRST_SEQUENCE = 1;
const ACK_SEQUENCE = 0xffff;
const ACK_ENTRIES = 32;
const ACK_ENTRY_SIZE = 19;
const ACK_PAYLOAD_SIZE = ACK_ENTRIES * ACK_ENTRY_SIZE;

function reliableHeader(
	flags: number,
	sequence: number,
	size: number,
	lowestPending: number,
	streamId: number,
	destinations: bigint[]
): Bytes {
	return concat(
		Uint8Array.of(flags, streamId),
		u16be(size),
		u16be(sequence & 0xffff),
		u16be(lowestPending & 0xffff),
		Uint8Array.of(destinations.length),
		...destinations.map((d) => u64be(d))
	);
}

/** Application data; the first message on a stream carries FLAG_IS_INITIALIZED (0x0F). */
export function buildDataMessage(
	payload: Uint8Array,
	sequence = FIRST_SEQUENCE,
	destinations: bigint[] = [],
	streamId = 0
): Bytes {
	const flags = sequence === FIRST_SEQUENCE ? 0x0f : 0x07;
	return concat(
		reliableHeader(flags, sequence, payload.length, sequence, streamId, destinations),
		payload
	);
}

/** An ack filling all 32 slots; `ackId` is one past the highest contiguous sequence received. */
export function buildAckMessage(ackId: number, streamId = 0, lowestPending = 1): Bytes {
	const entry = concat(Uint8Array.of(streamId), u16be(ackId), new Uint8Array(16));
	const body = concat(...Array.from({ length: ACK_ENTRIES }, () => entry));
	return concat(reliableHeader(0, ACK_SEQUENCE, body.length, lowestPending, streamId, []), body);
}

export interface ReliableMessage {
	flags: number;
	streamId: number;
	sequence: number;
	isAck: boolean;
	destinations: bigint[];
	payload: Bytes;
}

export function parseReliableMessage(data: Uint8Array): ReliableMessage {
	if (data.length < 9) throw new Error('a reliable message is at least 9 bytes');
	const count = data[8];
	const head = 9 + count * 8;
	if (data.length < head) throw new Error(`${count} destination ids need ${head} bytes`);
	const size = readU16be(data, 2);
	return {
		flags: data[0],
		streamId: data[1],
		sequence: readU16be(data, 4),
		isAck: !(data[0] & FLAG_APPLICATION_DATA),
		destinations: Array.from({ length: count }, (_, i) => readU64be(data, 9 + i * 8)),
		payload: data.slice(head, head + size)
	};
}

/** -> the nonzero ack ids in slots 0..7, the mesh's stations. */
export function ackIds(payload: Uint8Array): number[] {
	if (payload.length !== ACK_PAYLOAD_SIZE) throw new Error('not the version-4 ack shape');
	const ids: number[] = [];
	for (let slot = 0; slot < 8; slot++) {
		const id = readU16be(payload, slot * ACK_ENTRY_SIZE + 1);
		if (id) ids.push(id);
	}
	return ids;
}

export function contiguousThrough(sequences: Set<number>, start: number): number {
	let through = start;
	while (sequences.has(through + 1)) through++;
	return through;
}

// Protocol 0x84, the bulk snapshot channel (`broadcast4.py`).
export const SNAPSHOT_PROTOCOL = 0x84;
export const KIND_CONTROL = 0x11;
export const KIND_DATA = 0x12;
export const KIND_ACK = 0x21;
export const KIND_DONE = 0x19;
export const KIND_DONE_ACK = 0x28;
const NO_PEER_SEQUENCE = 0xffff;
export const CHUNK_SIZE = 1404;

function snapshotHeader(kind: number, sequence: number, peer: number): Bytes {
	return concat(Uint8Array.of(kind, 0, 0, 0), u16be(sequence & 0xffff), u16be(peer & 0xffff));
}

export function buildSnapshotControl(sequence: number, total: number, peer = NO_PEER_SEQUENCE) {
	return concat(
		snapshotHeader(KIND_CONTROL, sequence, peer),
		u32be(total),
		u16be(CHUNK_SIZE),
		u16be(5),
		new Uint8Array(4)
	);
}

export function buildSnapshotFragment(
	sequence: number,
	index: number,
	body: Uint8Array,
	peer = NO_PEER_SEQUENCE
) {
	return concat(snapshotHeader(KIND_DATA, sequence, peer), u32be(index), body);
}

export function buildSnapshotAck(
	sequence: number,
	base: number,
	mask: bigint,
	peer = NO_PEER_SEQUENCE
) {
	return concat(snapshotHeader(KIND_ACK, sequence, peer), u32be(base), u64be(mask));
}

export function buildSnapshotDone(sequence: number, peer = NO_PEER_SEQUENCE) {
	return snapshotHeader(KIND_DONE, sequence, peer);
}

export function buildSnapshotDoneAck(sequence: number, peer = NO_PEER_SEQUENCE) {
	return snapshotHeader(KIND_DONE_ACK, sequence, peer);
}

export interface SnapshotMessage {
	kind: number;
	sequence: number;
	total?: number;
	index?: number;
	body?: Bytes;
	base?: number;
	mask?: bigint;
}

export function parseSnapshotMessage(message: Uint8Array): SnapshotMessage {
	if (message.length < 8) throw new Error('a 0x84 message is at least 8 bytes');
	const kind = message[0];
	const sequence = readU16be(message, 4);
	if (kind === KIND_CONTROL) {
		if (message.length < 20) throw new Error('short control message');
		return { kind, sequence, total: readU32be(message, 8) };
	}
	if (kind === KIND_DATA) {
		if (message.length < 12) throw new Error('short data message');
		return { kind, sequence, index: readU32be(message, 8), body: message.slice(12) };
	}
	if (kind === KIND_ACK) {
		if (message.length < 20) throw new Error('short ack');
		return { kind, sequence, base: readU32be(message, 8), mask: readU64be(message, 12) };
	}
	if (kind === KIND_DONE || kind === KIND_DONE_ACK) return { kind, sequence };
	throw new Error(`unknown 0x84 kind ${kind}`);
}

export function ackFields(indexes: Set<number>): { base: number; mask: bigint } {
	let base = 0;
	while (indexes.has(base)) base++;
	let mask = 0n;
	for (const index of indexes) if (index > base) mask |= 1n << BigInt(index - base - 1);
	return { base, mask };
}

/** One port's incoming 0x84 side: acks each fragment and answers DONE. */
export class SnapshotReceiver {
	private indexes = new Set<number>();
	private sequence = 0;
	private peer = NO_PEER_SEQUENCE;

	feed(message: Uint8Array): Bytes[] {
		const got = parseSnapshotMessage(message);
		this.peer = got.sequence;
		if (got.kind === KIND_DATA) {
			this.indexes.add(got.index!);
			const { base, mask } = ackFields(this.indexes);
			return [buildSnapshotAck(this.next(), base, mask, this.peer)];
		}
		if (got.kind === KIND_DONE) return [buildSnapshotDoneAck(this.next(), this.peer)];
		return [];
	}

	private next(): number {
		const sequence = this.sequence;
		this.sequence = (this.sequence + 1) & 0xffff;
		return sequence;
	}
}

/** One port's outgoing 0x84 side; every fragment is sent plain. */
export class SnapshotSender {
	sequence = 0;
	peer = NO_PEER_SEQUENCE;

	transfer(payload: Uint8Array): Bytes[] {
		const out = [buildSnapshotControl(this.next(), payload.length, this.peer)];
		for (let i = 0, index = 0; i < payload.length; i += CHUNK_SIZE, index++) {
			out.push(
				buildSnapshotFragment(this.next(), index, payload.subarray(i, i + CHUNK_SIZE), this.peer)
			);
		}
		return out;
	}

	private next(): number {
		const sequence = this.sequence;
		this.sequence = (this.sequence + 1) & 0xffff;
		return sequence;
	}
}

export function snapshotFragmentCount(length: number): number {
	return Math.ceil(length / CHUNK_SIZE);
}

// The station protocol 0x14 (`station4.py`, `station_protocol.py`).
export const STATION_PROTOCOL = 0x14;
export const CONNECTION_REQUEST = 1;
export const CONNECTION_RESPONSE = 2;

function inetAddress(address: string, port: number): Bytes {
	return concat(Uint8Array.from(address.split('.').map(Number)), u16be(port));
}

export function stationLocation(
	address: string,
	port: number,
	constantId: bigint,
	variableId: number,
	serviceVariableId: number
): Bytes {
	const inet = inetAddress(address, port);
	return concat(
		Uint8Array.of(inet.length, inet.length),
		inet,
		inet,
		inetAddress('0.0.0.0', 0),
		u64be(constantId),
		u32be(variableId),
		u32be(serviceVariableId),
		Uint8Array.of(0x05, 1, 0, 1)
	);
}

/** The joiner's request, nat flags and location 0, platform 9, without the variable-id check. */
export function buildConnectionRequest(
	targetConstant: bigint,
	targetVariable: number,
	location: Uint8Array
) {
	return concat(
		Uint8Array.of(CONNECTION_REQUEST, 0, 9, 0),
		u64be(targetConstant),
		u32be(targetVariable),
		Uint8Array.of(0),
		location
	);
}

export function buildConnectionResponse(
	result: number,
	constantId: bigint,
	variableId: number
): Bytes {
	return concat(
		Uint8Array.of(CONNECTION_RESPONSE, result, 9, 0, 0),
		u64be(constantId),
		u32be(variableId)
	);
}

export function buildStationAck(ackId: number): Bytes {
	return concat(Uint8Array.of(5, 0, 0, 0), u32be(ackId));
}

export function trailingAckId(data: Uint8Array): number {
	return data.length >= 4 ? readU32be(data, data.length - 4) : 0;
}

/** -> the constant and variable id in the location of a request the console sent. */
export function parseIncomingRequest(data: Uint8Array): { constantId: bigint; variableId: number } {
	const location = data.subarray(0x11);
	if (location.length < 4) throw new Error('short connection request');
	const t = 2 + location[0] + location[1];
	if (location.length < t + 18) throw new Error('short station location');
	return { constantId: readU64be(location, t + 6), variableId: readU32be(location, t + 14) };
}

// The mesh protocol 0x18 (`mesh_protocol.py`).
export const MESH_PROTOCOL = 0x18;
export const MESH_PORT_RELIABLE = 1;
export const JOIN_REQUEST = 0x01;
export const JOIN_RESPONSE = 0x02;
export const UPDATE_MESH = 0x20;
const MIGRATION_START = 0x44;
const MIGRATION_RESPONSE = 0x48;
const MIGRATION_FINISH = 0x41;

export function buildJoinRequest(ackId: number): Bytes {
	return concat(Uint8Array.of(JOIN_REQUEST, 253), u32be(ackId));
}

/** -> our and the host's station index from a join response, or null for a refusal. */
export function parseJoinResponse(
	data: Uint8Array
): { ourIndex: number; hostIndex: number } | null {
	if (data.length < 16 || data[0] !== JOIN_RESPONSE) return null;
	if (data[1] === 0 && data[2] === 0xff && data[3] === 0xff) return null;
	return { hostIndex: data[2], ourIndex: data[3] };
}

export function updateMeshCounter(data: Uint8Array): number {
	if (data.length < 12 || data[0] !== UPDATE_MESH) throw new Error('not a mesh update');
	return readU32be(data, 4);
}

export function rewriteUpdateMesh(data: Uint8Array, hostIndex: number, counter: number): Bytes {
	const out = new Uint8Array(data);
	out[2] = hostIndex;
	view(out).setUint32(4, counter >>> 0);
	return out;
}

export function parseMigrationStart(data: Uint8Array): { newHostIndex: number } | null {
	return data.length === 3 && data[0] === MIGRATION_START ? { newHostIndex: data[2] } : null;
}

export function buildMigrationResponse(index: number): Bytes {
	return Uint8Array.of(MIGRATION_RESPONSE, index);
}

export function buildMigrationFinish(index: number): Bytes {
	return Uint8Array.of(MIGRATION_FINISH, index, 1);
}

// The local protocol 36 (`local_protocol.py`).
export const LOCAL_PROTOCOL = 36;
export const UPDATE_SESSION = 0x11;
export const START_HOST_MIGRATION = 0x13;

export interface UpdateSession {
	sequenceId: number;
	hostVariableId: number;
	hostConstantId: bigint;
	hostMigrationState: number;
}

export function localMessageType(data: Uint8Array): number | null {
	return data.length >= 12 && data[0] === 1 ? data[1] : null;
}

export function parseUpdateSession(data: Uint8Array): UpdateSession {
	if (localMessageType(data) !== UPDATE_SESSION) throw new Error('not an update session');
	const size = view(data).getUint16(2, true);
	if (data.length < 0x30 + size) throw new Error('truncated update session');
	const tail = 0x30 + 8 * 9;
	return {
		sequenceId: readU32le(data, 0x0c),
		hostVariableId: readU32le(data, 0x14),
		hostConstantId: view(data).getBigUint64(0x20, true),
		hostMigrationState: tail < data.length ? data[tail] : 0
	};
}

export function buildLocalAck(sequenceId: number): Bytes {
	return concat(
		Uint8Array.of(1, 0x21, 0, 0),
		new Uint8Array(8),
		u32le(sequenceId),
		new Uint8Array(4)
	);
}

// The RTT protocol 0x58 at version 4 (`rtt_protocol.py`).
export const RTT_PROTOCOL = 0x58;

/** -> the answer to a sixteen-byte RTT request, or null. */
export function rttResponse(data: Uint8Array): Bytes | null {
	if (data.length !== 16 || data[0] !== 0) return null;
	return concat(Uint8Array.of(1), data.subarray(1));
}
