import { describe, expect, it } from 'vitest';
import { concat, fromHex, toHex } from './bytes';
import { decodeFrame, encodeFrame, FrameReader } from './framing';
import vectors from './test-vectors.json';

describe('serial framing', () => {
	it('encodes every frame byte for byte as pokeldn does', () => {
		for (const v of vectors.frames) {
			expect(toHex(encodeFrame(v.type, fromHex(v.payload)))).toBe(v.frame);
		}
	});

	it('reads frames split across chunks and drops boot noise and corrupt frames', () => {
		const reader = new FrameReader();
		const [first, second] = vectors.frames.map((v) => fromHex(v.frame));
		const corrupt = fromHex(vectors.frames[2].frame);
		corrupt[3] ^= 0xff;
		const stream = concat(new TextEncoder().encode('ets Jun  8 2016 boot\n'), Uint8Array.of(0));
		const wire = concat(stream, first, corrupt, second);
		const got = [...reader.feed(wire.subarray(0, 30)), ...reader.feed(wire.subarray(30))];
		expect(got.map((f) => [f.type, toHex(f.payload)])).toEqual(
			vectors.frames.slice(0, 2).map((v) => [v.type, v.payload])
		);
		expect(reader.rejected).toBe(2);
	});

	it('rejects a frame whose checksum does not match', () => {
		const frame = fromHex(vectors.frames[1].frame).slice(0, -1);
		frame[frame.length - 1] ^= 1;
		expect(() => decodeFrame(frame)).toThrow();
	});
});
