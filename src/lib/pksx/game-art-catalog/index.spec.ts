import { describe, expect, it } from 'vitest';
import { resolveGameArt } from './index';

describe('resolveGameArt', () => {
	it('resolves one local cover for a single game', () => {
		const art = resolveGameArt('E');
		expect(art.platform).toBe('gba');
		expect(art.covers.map((cover) => cover.path)).toEqual(['/game-art/emerald.webp']);
	});

	it('resolves both covers for a paired version', () => {
		expect(resolveGameArt('RB').covers.map((cover) => cover.title)).toEqual([
			'Pokemon Red',
			'Pokemon Blue'
		]);
	});

	it('keeps the platform of a known game that has no cover', () => {
		expect(resolveGameArt('SV')).toEqual({ platform: 'switch', covers: [] });
	});

	it('falls back for an unknown or absent game', () => {
		expect(resolveGameArt('NotAGame')).toEqual({ platform: null, covers: [] });
		expect(resolveGameArt(null)).toEqual({ platform: null, covers: [] });
	});
});
