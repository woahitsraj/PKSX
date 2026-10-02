// SPDX-License-Identifier: AGPL-3.0-only
// Ported from pokeldn v0.4.0 `pokeldn/ldn/esp32.py` (serial framing). See ./NOTICE.md.

import { concat, crc32, readU32le, u32le, type Bytes } from './bytes';

export function cobsEncode(data: Uint8Array): Bytes {
	const out: number[] = [0];
	let codeAt = 0;
	let code = 1;
	for (const b of data) {
		if (b === 0) {
			out[codeAt] = code;
			codeAt = out.length;
			code = 1;
			out.push(0);
			continue;
		}
		out.push(b);
		code++;
		if (code === 255) {
			out[codeAt] = code;
			codeAt = out.length;
			code = 1;
			out.push(0);
		}
	}
	out[codeAt] = code;
	return Uint8Array.from(out);
}

export function cobsDecode(data: Uint8Array): Bytes {
	const out: number[] = [];
	let i = 0;
	while (i < data.length) {
		const code = data[i];
		const block = data.subarray(i + 1, i + code);
		if (code === 0 || block.length !== code - 1) throw new Error('bad COBS block');
		out.push(...block);
		i += code;
		if (code !== 255 && i < data.length) out.push(0);
	}
	return Uint8Array.from(out);
}

/** COBS(type | payload | crc32-le(type | payload)) then 0x00. */
export function encodeFrame(type: number, payload: Uint8Array = new Uint8Array()): Bytes {
	const body = concat(Uint8Array.of(type), payload);
	return concat(cobsEncode(concat(body, u32le(crc32(body)))), Uint8Array.of(0));
}

/** `encoded` excludes the 0x00 delimiter. */
export function decodeFrame(encoded: Uint8Array): { type: number; payload: Bytes } {
	const body = cobsDecode(encoded);
	if (body.length < 5) throw new Error('frame too short');
	if (readU32le(body, body.length - 4) !== crc32(body.subarray(0, -4))) {
		throw new Error('bad frame checksum');
	}
	return { type: body[0], payload: body.slice(1, -4) };
}

/** Accumulates bytes and yields whole frames; noise and boot text before a 0x00 are dropped. */
export class FrameReader {
	rejected = 0;
	private buffer: number[] = [];

	*feed(data: Uint8Array): Generator<{ type: number; payload: Bytes }> {
		for (const b of data) {
			if (b) {
				this.buffer.push(b);
				continue;
			}
			if (!this.buffer.length) continue;
			try {
				yield decodeFrame(Uint8Array.from(this.buffer));
			} catch {
				this.rejected++;
			}
			this.buffer = [];
		}
	}
}
