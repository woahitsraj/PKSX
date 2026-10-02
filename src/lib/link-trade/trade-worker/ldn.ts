// SPDX-License-Identifier: GPL-3.0-only
// Ported from LDN (https://github.com/kinnay/LDN at 39d0b2060c7932ff2766726db7af4fb640cfa9ef, as
// vendored in pokeldn v0.4.0 `vendor/LDN/ldn/__init__.py` and `wlan.py`). See ./NOTICE.md.

import {
	concat,
	equal,
	fromHex,
	readU16be,
	readU16le,
	readU64be,
	readU64le,
	u16be,
	u16le,
	u64be,
	u64le,
	type Bytes
} from './bytes';
import {
	aesCtr,
	aesGcmDecrypt,
	aesGcmEncrypt,
	deriveAdvertiseKey,
	deriveAuthenticationKey,
	hmacSha256,
	sha256,
	type LdnProtocol,
	type SwitchKeys
} from './crypto';

export const ADVERTISE_FORMAT_PLAIN = 1;
export const ADVERTISE_FORMAT_AES_CTR = 2;
export const ADVERTISE_FORMAT_AES_GCM = 3;
export const AUTH_FORMAT_PLAIN = 0;
export const AUTH_FORMAT_AES_GCM = 1;
export const SECURITY_MODE_PROD = 1;
export const ETHERTYPE_LDN = 0x88b7;
export const DISCONNECT_CONNECTION_LOST = 6;

/** A public constant of the LDN challenge, not a console key. */
export const CHALLENGE_KEY = fromHex(
	'f84b487fb37251c263bf11609036589266af70ca79b44c93c7370c5769c0f602'
);

export const CHANNEL_FREQUENCIES: Record<number, number> = {
	1: 2412,
	6: 2437,
	11: 2462,
	36: 5180,
	40: 5200,
	44: 5220,
	48: 5240
};

const NINTENDO_OUI = fromHex('0022aa');
const ADVERTISEMENT_HEADER = fromHex('7f0022aa04000101');

export interface NetworkId {
	localCommunicationId: bigint;
	sceneId: number;
	ssid: Bytes;
}

export function encodeNetworkId(id: NetworkId, littleEndian = false): Bytes {
	return concat(
		littleEndian ? u64le(id.localCommunicationId) : u64be(id.localCommunicationId),
		new Uint8Array(2),
		littleEndian ? u16le(id.sceneId) : u16be(id.sceneId),
		new Uint8Array(4),
		id.ssid
	);
}

function decodeNetworkId(data: Uint8Array, littleEndian = false): NetworkId {
	return {
		localCommunicationId: littleEndian ? readU64le(data, 0) : readU64be(data, 0),
		sceneId: littleEndian ? readU16le(data, 10) : readU16be(data, 10),
		ssid: data.slice(16, 32)
	};
}

export interface Participant {
	ipAddress: string;
	macAddress: Bytes;
	connected: boolean;
	name: Bytes;
	appVersion: number;
	platform: number;
}

export interface NetworkInfo extends NetworkId {
	protocol: LdnProtocol;
	address: Bytes;
	channel: number;
	version: number;
	nonce: Bytes;
	serverRandom: Bytes;
	securityMode: number;
	acceptPolicy: number;
	appVersion: number;
	maxParticipants: number;
	numParticipants: number;
	participants: Participant[];
	applicationData: Bytes;
	challenge: bigint;
}

const ip = (data: Uint8Array) => Array.from(data).join('.');
const ipBytes = (address: string) => Uint8Array.from(address.split('.').map(Number));
const emptyParticipant = (): Participant => ({
	ipAddress: '0.0.0.0',
	macAddress: new Uint8Array(6),
	connected: false,
	name: new Uint8Array(),
	appVersion: 0,
	platform: 0
});

function trimNul(data: Uint8Array): Bytes {
	let end = data.length;
	while (end && !data[end - 1]) end--;
	return data.slice(0, end);
}

type AdvertisementPayload = Pick<
	NetworkInfo,
	| 'serverRandom'
	| 'securityMode'
	| 'acceptPolicy'
	| 'appVersion'
	| 'channel'
	| 'maxParticipants'
	| 'numParticipants'
	| 'participants'
	| 'applicationData'
	| 'challenge'
>;

function decodePayloadV1(p: Uint8Array): AdvertisementPayload {
	const participants: Participant[] = [];
	for (let i = 0; i < 8; i++) {
		const at = 24 + i * 56;
		participants.push({
			ipAddress: ip(p.subarray(at, at + 4)),
			macAddress: p.slice(at + 4, at + 10),
			connected: p[at + 10] !== 0,
			platform: p[at + 11],
			name: trimNul(p.subarray(at + 12, at + 44)),
			appVersion: readU16be(p, at + 44)
		});
	}
	const size = readU16be(p, 474);
	return {
		serverRandom: p.slice(0, 16),
		securityMode: readU16be(p, 16),
		acceptPolicy: p[18],
		channel: readU16be(p, 20) & 0x3ff,
		maxParticipants: p[22],
		numParticipants: p[23],
		participants,
		appVersion: participants[0].appVersion,
		applicationData: p.slice(476, 476 + size),
		challenge: readU64be(p, 476 + 384 + 412)
	};
}

function decodePayloadV2(p: Uint8Array): AdvertisementPayload {
	const appVersion = readU16be(p, 26);
	const numParticipants = p[39];
	const participants = Array.from({ length: 8 }, emptyParticipant);
	let at = 40;
	for (let i = 0; i < numParticipants; i++, at += 48) {
		const index = p[at + 10];
		if (index >= 8) continue;
		participants[index] = {
			ipAddress: ip(p.subarray(at, at + 4)),
			macAddress: p.slice(at + 4, at + 10),
			connected: true,
			platform: p[at + 11],
			name: trimNul(p.subarray(at + 12, at + 44)),
			appVersion
		};
	}
	const size = readU16be(p, at);
	return {
		serverRandom: p.slice(0, 16),
		challenge: readU64be(p, 16),
		securityMode: p[24],
		acceptPolicy: p[25],
		appVersion,
		channel: readU16be(p, 36) & 0x3ff,
		maxParticipants: p[38],
		numParticipants,
		participants,
		applicationData: p.slice(at + 2, at + 2 + size)
	};
}

/** -> the network an LDN advertisement action body describes, or null if it is not one. */
export async function decodeAdvertisement(
	action: Uint8Array,
	keys: SwitchKeys,
	protocol: LdnProtocol
): Promise<Omit<NetworkInfo, 'address' | 'channel'> | null> {
	if (action.length < 52 || !equal(action.subarray(0, 8), ADVERTISEMENT_HEADER)) return null;
	const header = action.subarray(12, 52);
	const id = decodeNetworkId(header);
	const version = header[32];
	const format = header[33];
	const size = readU16be(header, 34);
	const nonce = header.slice(36, 40);
	if (![2, 3, 4].includes(version)) return null;
	const expected = protocol === 1 ? ADVERTISE_FORMAT_AES_CTR : ADVERTISE_FORMAT_AES_GCM;
	if (format !== ADVERTISE_FORMAT_PLAIN && format !== expected) return null;
	const body = action.subarray(52);
	const key = () => deriveAdvertiseKey(keys, protocol, encodeNetworkId(id));
	let plain: Bytes | null;
	if (format === ADVERTISE_FORMAT_AES_GCM) {
		if (body.length < 16 + size) return null;
		plain = await aesGcmDecrypt(
			await key(),
			concat(nonce, new Uint8Array(8)),
			body.subarray(16, 16 + size),
			body.subarray(0, 16),
			header
		);
	} else {
		if (size !== 0x500 || body.length < 32 + size) return null;
		const data = body.slice(0, 32 + size);
		const opened =
			format === ADVERTISE_FORMAT_AES_CTR ? await aesCtr(await key(), nonce, data) : data;
		plain = opened.slice(32);
		if (!equal(opened.subarray(0, 32), await sha256(concat(header, new Uint8Array(32), plain)))) {
			return null;
		}
	}
	if (!plain) return null;
	try {
		const payload =
			format === ADVERTISE_FORMAT_AES_GCM ? decodePayloadV2(plain) : decodePayloadV1(plain);
		return { ...id, ...payload, protocol, version, nonce };
	} catch {
		return null;
	}
}

/** The host's advertisement action body; only the scripted fake console sends one. */
export async function encodeAdvertisement(
	network: Omit<NetworkInfo, 'address' | 'channel'> & { channel: number },
	keys: SwitchKeys
): Promise<Bytes> {
	const gcm = network.protocol !== 1;
	const p = network;
	let plain: Bytes;
	if (gcm) {
		const seats = p.participants.flatMap((part, index) =>
			part.connected
				? [
						concat(
							ipBytes(part.ipAddress),
							part.macAddress,
							Uint8Array.of(index, part.platform),
							padTo(part.name, 32),
							new Uint8Array(4)
						)
					]
				: []
		);
		plain = concat(
			p.serverRandom,
			u64be(p.challenge),
			Uint8Array.of(p.securityMode, p.acceptPolicy),
			u16be(p.appVersion),
			new Uint8Array(8),
			u16be((2 << 10) | p.channel),
			Uint8Array.of(p.maxParticipants, p.numParticipants),
			...seats,
			u16be(p.applicationData.length),
			p.applicationData
		);
	} else {
		const seats = p.participants.map((part) =>
			concat(
				ipBytes(part.ipAddress),
				part.macAddress,
				Uint8Array.of(part.connected ? 1 : 0, part.platform),
				padTo(part.name, 32),
				u16be(part.appVersion),
				new Uint8Array(10)
			)
		);
		plain = concat(
			p.serverRandom,
			u16be(p.securityMode),
			Uint8Array.of(p.acceptPolicy, 0),
			u16be((2 << 10) | p.channel),
			Uint8Array.of(p.maxParticipants, p.numParticipants),
			...seats,
			new Uint8Array(2),
			u16be(p.applicationData.length),
			padTo(p.applicationData, 384),
			new Uint8Array(412),
			u64be(p.challenge)
		);
	}
	const header = concat(
		encodeNetworkId(p),
		Uint8Array.of(p.version, gcm ? ADVERTISE_FORMAT_AES_GCM : ADVERTISE_FORMAT_AES_CTR),
		u16be(plain.length),
		p.nonce
	);
	const key = await deriveAdvertiseKey(keys, p.protocol, encodeNetworkId(p));
	let body: Bytes;
	if (gcm) {
		const sealed = await aesGcmEncrypt(key, concat(p.nonce, new Uint8Array(8)), plain, header);
		body = concat(sealed.tag, sealed.ciphertext);
	} else {
		const hash = await sha256(concat(header, new Uint8Array(32), plain));
		body = await aesCtr(key, p.nonce, concat(hash, plain));
	}
	return concat(ADVERTISEMENT_HEADER, new Uint8Array(4), header, body);
}

function padTo(data: Uint8Array, size: number): Bytes {
	const out = new Uint8Array(size);
	out.set(data.subarray(0, size));
	return out;
}

export interface Challenge {
	token: bigint;
	nonce: bigint;
	deviceId: bigint;
}

/** The 0x300-byte challenge a joiner puts in its authentication request. */
export async function encodeChallengeRequest(challenge: Challenge): Promise<Bytes> {
	const body = concat(
		Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0),
		u64le(challenge.token),
		u64le(challenge.nonce),
		u64le(challenge.deviceId),
		new Uint8Array(16 + 0x60 + 64 + 512)
	);
	return concat(new Uint8Array(4), await hmacSha256(CHALLENGE_KEY, body), new Uint8Array(12), body);
}

export async function decodeChallengeRequest(data: Uint8Array): Promise<Challenge | null> {
	if (data.length !== 0x300) return null;
	const body = data.subarray(48);
	if (!equal(data.subarray(4, 36), await hmacSha256(CHALLENGE_KEY, body))) return null;
	return { token: readU64le(body, 8), nonce: readU64le(body, 16), deviceId: readU64le(body, 24) };
}

/** The host's 0x100-byte answer; only the scripted fake console sends one. */
export async function encodeChallengeResponse(challenge: Challenge, hostDeviceId: bigint) {
	const body = concat(
		new Uint8Array(4),
		Uint8Array.of(2, 0, 0, 0),
		u64le(challenge.nonce),
		u64le(challenge.deviceId),
		u64le(hostDeviceId),
		new Uint8Array(32 + 0x90)
	);
	return concat(new Uint8Array(4), await hmacSha256(CHALLENGE_KEY, body), new Uint8Array(12), body);
}

export interface AuthenticationFrame {
	version: number;
	statusCode: number;
	isResponse: boolean;
	networkId: NetworkId;
	serverRandom: Bytes;
	clientRandom: Bytes;
	/** Request: the user name, app version, platform and challenge. Response: platform, challenge. */
	payload: Bytes;
}

export function authenticationRequestPayload(
	name: Uint8Array,
	appVersion: number,
	challenge: Uint8Array,
	version: number
): Bytes {
	const head = concat(padTo(name, 32), u16be(appVersion), Uint8Array.of(0), new Uint8Array(29));
	return version >= 3 ? concat(head, new Uint8Array(0x24), challenge) : head;
}

export async function encodeAuthenticationFrame(
	frame: AuthenticationFrame,
	keys: SwitchKeys,
	protocol: LdnProtocol
): Promise<Bytes> {
	const size = frame.payload.length;
	const header = concat(
		Uint8Array.of(
			frame.version,
			size & 0xff,
			frame.statusCode,
			frame.isResponse ? 1 : 0,
			size >> 8,
			protocol === 1 ? AUTH_FORMAT_PLAIN : AUTH_FORMAT_AES_GCM,
			0,
			0
		),
		encodeNetworkId(frame.networkId, true),
		frame.serverRandom,
		frame.clientRandom
	);
	const prefix = concat(NINTENDO_OUI, u16be(0x102), Uint8Array.of(0), header);
	if (protocol !== 3) return concat(prefix, frame.payload);
	const key = await deriveAuthenticationKey(keys, protocol, frame.clientRandom);
	const sealed = await aesGcmEncrypt(key, header.subarray(0, 12), frame.payload, header);
	return concat(prefix, sealed.tag, sealed.ciphertext);
}

export async function decodeAuthenticationFrame(
	data: Uint8Array,
	keys: SwitchKeys,
	protocol: LdnProtocol
): Promise<AuthenticationFrame | null> {
	if (data.length < 78 || !equal(data.subarray(0, 3), NINTENDO_OUI)) return null;
	if (readU16be(data, 3) !== 0x102) return null;
	const header = data.subarray(6, 78);
	const format = header[5];
	if (format !== (protocol === 1 ? AUTH_FORMAT_PLAIN : AUTH_FORMAT_AES_GCM)) return null;
	const size = (header[4] << 8) | header[1];
	const clientRandom = header.slice(56, 72);
	let payload: Bytes | null;
	if (format === AUTH_FORMAT_AES_GCM) {
		if (data.length - 94 !== size) return null;
		const key = await deriveAuthenticationKey(keys, protocol, clientRandom);
		payload = await aesGcmDecrypt(
			key,
			header.subarray(0, 12),
			data.subarray(94),
			data.subarray(78, 94),
			header
		);
	} else {
		if (data.length - 78 !== size) return null;
		payload = data.slice(78);
	}
	if (!payload) return null;
	return {
		version: header[0],
		statusCode: header[2],
		isResponse: header[3] !== 0,
		networkId: decodeNetworkId(header.subarray(8, 40), true),
		serverRandom: header.slice(40, 56),
		clientRandom,
		payload
	};
}

/** -> the reason in an LDN disconnect frame, or null. */
export function decodeDisconnectFrame(data: Uint8Array): number | null {
	if (data.length < 7 || !equal(data.subarray(0, 3), NINTENDO_OUI)) return null;
	return readU16be(data, 3) === 0x103 ? data[6] : null;
}

export function sameNetworkId(a: NetworkId, b: NetworkId): boolean {
	return (
		a.localCommunicationId === b.localCommunicationId &&
		a.sceneId === b.sceneId &&
		equal(a.ssid, b.ssid)
	);
}

export interface ActionFrame {
	source: Bytes;
	action: Bytes;
}

/** -> the source and body of an 802.11 action frame (no FCS), or null. */
export function parseActionFrame(frame: Uint8Array): ActionFrame | null {
	if (frame.length < 24) return null;
	const control = readU16le(frame, 0);
	if (control & 3 || ((control >> 2) & 3) !== 0 || ((control >> 4) & 0xf) !== 13) return null;
	return { source: frame.slice(10, 16), action: frame.slice(24) };
}

export function buildActionFrame(source: Uint8Array, action: Uint8Array): Bytes {
	const broadcast = new Uint8Array(6).fill(0xff);
	return concat(u16le(13 << 4), u16le(0), broadcast, source, broadcast, u16le(0), action);
}

export function ethernetFrame(
	target: Uint8Array,
	source: Uint8Array,
	type: number,
	payload: Uint8Array
): Bytes {
	return concat(target, source, u16be(type), payload);
}

export function readEthertype(frame: Uint8Array): number {
	return frame.length >= 14 ? readU16be(frame, 12) : -1;
}
