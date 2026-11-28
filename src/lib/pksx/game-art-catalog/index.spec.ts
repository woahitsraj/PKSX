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
		expect(resolveGameArt('GSC')).toEqual({ platform: 'gbc', covers: [] });
	});

	it('knows every game version the engine reports for the committed fixtures', () => {
		const withCover =
			'RB YW GS C RS E FR COLO XD RSBOX DP Pt HG SS BATREV B W B2 W2 X Y OR AS SN MN US UM GP GE SW SH BD SP PLA SL VL ZA';
		for (const version of withCover.split(' ')) {
			expect(resolveGameArt(version).covers.length, version).toBeGreaterThan(0);
		}
		expect(resolveGameArt('Pokémon Unbound')).toEqual({ platform: 'gba', covers: [] });
	});

	it('falls back for an unknown or absent game', () => {
		expect(resolveGameArt('NotAGame')).toEqual({ platform: null, covers: [] });
		expect(resolveGameArt(null)).toEqual({ platform: null, covers: [] });
	});
});
