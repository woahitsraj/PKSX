// SPDX-License-Identifier: GPL-3.0-only AND AGPL-3.0-only
// Ported from LDN (kinnay/LDN, vendored in pokeldn v0.4.0) `KeyDerivation`, and pokeldn's
// `pokeldn/ldn/pia5.py` and `pokeldn/ldn/pia4.py` crypto. See ./NOTICE.md.

import { concat, fromHex, type Bytes } from './bytes';

const subtle = () => globalThis.crypto.subtle;
const ZERO_IV = new Uint8Array(16);
const PAD_BLOCK = new Uint8Array(16).fill(16);

function aesKey(key: Uint8Array, algorithm: 'AES-CBC' | 'AES-CTR' | 'AES-GCM') {
	return subtle().importKey('raw', new Uint8Array(key), algorithm, false, ['encrypt', 'decrypt']);
}

function block(data: Uint8Array): void {
	if (data.length !== 16) throw new Error(`AES-ECB here takes one block, not ${data.length} bytes`);
}

/** One-block AES-ECB encryption, the first block of CBC with a zero IV. */
export async function aesEcbEncrypt(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
	block(data);
	const k = await aesKey(key, 'AES-CBC');
	const out = await subtle().encrypt({ name: 'AES-CBC', iv: ZERO_IV }, k, new Uint8Array(data));
	return new Uint8Array(out.slice(0, 16));
}

/** One-block AES-ECB decryption: CBC with a zero IV and a forged final padding block. */
export async function aesEcbDecrypt(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
	block(data);
	const masked = data.map((b, i) => b ^ PAD_BLOCK[i]);
	const padding = await aesEcbEncrypt(key, masked);
	const k = await aesKey(key, 'AES-CBC');
	const out = await subtle().decrypt({ name: 'AES-CBC', iv: ZERO_IV }, k, concat(data, padding));
	return new Uint8Array(out);
}

/** PyCryptodome's CTR with a four-byte nonce: the counter is the low 96 bits, from zero. */
export async function aesCtr(
	key: Uint8Array,
	nonce4: Uint8Array,
	data: Uint8Array
): Promise<Bytes> {
	const counter = concat(nonce4, new Uint8Array(12));
	const k = await aesKey(key, 'AES-CTR');
	return new Uint8Array(
		await subtle().encrypt({ name: 'AES-CTR', counter, length: 96 }, k, new Uint8Array(data))
	);
}

/** -> ciphertext and the 16-byte tag. */
export async function aesGcmEncrypt(
	key: Uint8Array,
	iv: Uint8Array,
	data: Uint8Array,
	aad: Uint8Array = new Uint8Array()
): Promise<{ ciphertext: Bytes; tag: Bytes }> {
	const k = await aesKey(key, 'AES-GCM');
	const out = new Uint8Array(
		await subtle().encrypt(
			{ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: new Uint8Array(aad) },
			k,
			new Uint8Array(data)
		)
	);
	return { ciphertext: out.slice(0, -16), tag: out.slice(-16) };
}

/** -> the plaintext, or null when the tag does not verify. */
export async function aesGcmDecrypt(
	key: Uint8Array,
	iv: Uint8Array,
	ciphertext: Uint8Array,
	tag: Uint8Array,
	aad: Uint8Array = new Uint8Array()
): Promise<Bytes | null> {
	const k = await aesKey(key, 'AES-GCM');
	try {
		return new Uint8Array(
			await subtle().decrypt(
				{ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData: new Uint8Array(aad) },
				k,
				concat(ciphertext, tag)
			)
		);
	} catch {
		return null;
	}
}

export async function sha256(data: Uint8Array): Promise<Bytes> {
	return new Uint8Array(await subtle().digest('SHA-256', new Uint8Array(data)));
}

export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Bytes> {
	const k = await subtle().importKey(
		'raw',
		new Uint8Array(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return new Uint8Array(await subtle().sign('HMAC', k, new Uint8Array(data)));
}

/** The four `prod.keys` values LDN needs; nothing else is read or kept. */
export interface SwitchKeys {
	aes_kek_generation_source: Bytes;
	aes_key_generation_source: Bytes;
	master_key_00: Bytes;
	master_key_12: Bytes;
}

export const SWITCH_KEY_NAMES = [
	'aes_kek_generation_source',
	'aes_key_generation_source',
	'master_key_00',
	'master_key_12'
] as const satisfies readonly (keyof SwitchKeys)[];

/** LDN protocol 1 uses master key 0, protocol 3 master key 0x12. */
export type LdnProtocol = 1 | 3;

const AUTH_SOURCE = fromHex('f1e7018419a84f711da714c2cf919c9c');
const ADVERTISE_SOURCE = fromHex('191884743e24c77d87c69e4207d0c438');

async function deriveKey(
	keys: SwitchKeys,
	protocol: LdnProtocol,
	data: Uint8Array,
	source: Uint8Array
): Promise<Bytes> {
	let key: Bytes = protocol === 1 ? keys.master_key_00 : keys.master_key_12;
	key = await aesEcbDecrypt(key, keys.aes_kek_generation_source);
	key = await aesEcbDecrypt(key, source);
	key = await aesEcbDecrypt(key, keys.aes_key_generation_source);
	return aesEcbDecrypt(key, (await sha256(data)).slice(0, 16));
}

export function deriveAuthenticationKey(
	keys: SwitchKeys,
	protocol: LdnProtocol,
	clientRandom: Uint8Array
): Promise<Bytes> {
	return deriveKey(keys, protocol, clientRandom, AUTH_SOURCE);
}

/** The WPA2 key the Trade Radio joins with: the only key the board ever receives. */
export function deriveDataKey(
	keys: SwitchKeys,
	protocol: LdnProtocol,
	serverRandom: Uint8Array,
	password: Uint8Array
): Promise<Bytes> {
	return deriveKey(keys, protocol, concat(serverRandom, password), AUTH_SOURCE);
}

export function deriveAdvertiseKey(
	keys: SwitchKeys,
	protocol: LdnProtocol,
	networkId: Uint8Array
): Promise<Bytes> {
	return deriveKey(keys, protocol, networkId, ADVERTISE_SOURCE);
}
