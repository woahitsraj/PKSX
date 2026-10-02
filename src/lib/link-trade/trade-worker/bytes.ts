// SPDX-License-Identifier: AGPL-3.0-only
// Part of the PKSX trade worker, ported from pokeldn v0.4.0. See ./NOTICE.md.

export type Bytes = Uint8Array<ArrayBuffer>;

export function bytes(...values: number[]): Bytes {
	return Uint8Array.from(values);
}

export function concat(...parts: Uint8Array[]): Bytes {
	const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

export function fromHex(hex: string): Bytes {
	const clean = hex.replace(/[\s:]/g, '');
	if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error('not hex');
	const out = new Uint8Array(clean.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	return out;
}

export function toHex(data: Uint8Array): string {
	return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function equal(a: Uint8Array, b: Uint8Array): boolean {
	return a.length === b.length && a.every((value, i) => value === b[i]);
}

export function view(data: Uint8Array): DataView {
	return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

export function u16be(value: number): Bytes {
	return bytes((value >> 8) & 0xff, value & 0xff);
}

export function u16le(value: number): Bytes {
	return bytes(value & 0xff, (value >> 8) & 0xff);
}

export function u32be(value: number): Bytes {
	const out = new Uint8Array(4);
	view(out).setUint32(0, value >>> 0);
	return out;
}

export function u32le(value: number): Bytes {
	const out = new Uint8Array(4);
	view(out).setUint32(0, value >>> 0, true);
	return out;
}

export function u64be(value: bigint): Bytes {
	const out = new Uint8Array(8);
	view(out).setBigUint64(0, BigInt.asUintN(64, value));
	return out;
}

export function u64le(value: bigint): Bytes {
	const out = new Uint8Array(8);
	view(out).setBigUint64(0, BigInt.asUintN(64, value), true);
	return out;
}

export function readU16be(data: Uint8Array, offset: number): number {
	return view(data).getUint16(offset);
}

export function readU16le(data: Uint8Array, offset: number): number {
	return view(data).getUint16(offset, true);
}

export function readU32be(data: Uint8Array, offset: number): number {
	return view(data).getUint32(offset);
}

export function readU32le(data: Uint8Array, offset: number): number {
	return view(data).getUint32(offset, true);
}

export function readU64be(data: Uint8Array, offset: number): bigint {
	return view(data).getBigUint64(offset);
}

export function readU64le(data: Uint8Array, offset: number): bigint {
	return view(data).getBigUint64(offset, true);
}

/** Bytes are copied so a later write to the source cannot change them. */
export function copy(data: Uint8Array): Bytes {
	return new Uint8Array(data);
}

export function ascii(text: string): Bytes {
	return Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c >>> 0;
	}
	return table;
})();

/** zlib.crc32 */
export function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (const b of data) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
	return (crc ^ 0xffffffff) >>> 0;
}

export function randomBytes(size: number): Bytes {
	const out = new Uint8Array(size);
	crypto.getRandomValues(out);
	return out;
}
