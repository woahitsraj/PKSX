import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { gameNames } from '$lib/pksx/saves-library';
import report from '../../../../scripts/data/game-sprite-catalog.json';
import { gameSpriteAssetPaths, gameSpriteFamilies, resolveGameSpriteFamily } from './game';
import { resolvePokemonSpritePath, resolveSpriteCatalogEntry, type SpriteIdentity } from './index';

const pokemon = (overrides: Partial<SpriteIdentity> = {}): SpriteIdentity => ({
	speciesId: 25,
	form: 0,
	isEgg: false,
	isShiny: false,
	displaySex: 'default',
	...overrides
});
const emerald = { game: 'E', format: 3 };
const staticFile = (assetPath: string) => path.resolve('static', assetPath.slice(1));

describe('Game sprites', () => {
	test('names a family or HOME for every known save game', () => {
		expect(Object.keys(gameNames).filter((name) => !(name in gameSpriteFamilies))).toEqual([]);
	});

	test('selects the family from the game first, then the entity format', () => {
		expect(resolveGameSpriteFamily(emerald)).toBe('emerald');
		expect(resolveGameSpriteFamily({ game: 'FR', format: 3 })).toBe('firered-leafgreen');
		expect(resolveGameSpriteFamily({ game: 'E', format: 4 })).toBe('platinum');
		expect(resolveGameSpriteFamily({ game: null, format: 2 })).toBe('crystal');
		expect(resolveGameSpriteFamily({ game: 'sword', format: 3 })).toBe('emerald');
		expect(resolveGameSpriteFamily({ game: 'Pokémon Unbound', format: 3 })).toBeNull();
		expect(resolveGameSpriteFamily({ game: 'SV', format: 9 })).toBeNull();
		expect(resolveGameSpriteFamily({ game: null, format: null })).toBeNull();
	});

	test('keeps HOME unless the Game style is chosen', () => {
		const home = resolveSpriteCatalogEntry(pokemon())?.path;
		expect(resolvePokemonSpritePath(pokemon(), emerald, 'home')).toBe(home);
		expect(resolvePokemonSpritePath(pokemon(), emerald, 'game')).toBe(
			'/sprites/pokemon/game/emerald/0025-00-default-normal.png'
		);
		expect(resolvePokemonSpritePath(pokemon(), null, 'game')).toBe(home);
	});

	test('shows a game-specific visual difference between families', () => {
		const bulbasaur = pokemon({ speciesId: 1 });
		const emeraldPath = resolvePokemonSpritePath(bulbasaur, emerald, 'game')!;
		const fireRedPath = resolvePokemonSpritePath(bulbasaur, { game: 'FR', format: 3 }, 'game')!;
		expect(emeraldPath).toContain('/game/emerald/');
		expect(fireRedPath).toContain('/game/firered-leafgreen/');
		expect(readFileSync(staticFile(emeraldPath))).not.toEqual(
			readFileSync(staticFile(fireRedPath))
		);
	});

	test('falls back for sex and shiny inside the family, and to HOME for missing art', () => {
		const resolve = (identity: SpriteIdentity, game = emerald) =>
			resolvePokemonSpritePath(identity, game, 'game');
		expect(resolve(pokemon({ isShiny: true, displaySex: 'female' }))).toBe(
			'/sprites/pokemon/game/emerald/0025-00-default-shiny.png'
		);
		expect(resolve(pokemon({ displaySex: 'female' }), { game: 'Pt', format: 4 })).toBe(
			'/sprites/pokemon/game/platinum/0025-00-female-normal.png'
		);
		expect(resolve(pokemon({ speciesId: 201, form: 5 }))).toBe(
			'/sprites/pokemon/game/emerald/0201-05-default-normal.png'
		);
		const arceus = pokemon({ speciesId: 493, form: 1 });
		expect(resolve(arceus, { game: 'Pt', format: 4 })).toBe(
			resolveSpriteCatalogEntry(arceus)?.path
		);
		const noGameArt = pokemon({ speciesId: 252 });
		expect(resolve(noGameArt, { game: 'RD', format: 1 })).toBe(
			resolveSpriteCatalogEntry(noGameArt)?.path
		);
	});

	test('uses game egg art when the family has it, otherwise the HOME egg rule', () => {
		const egg = pokemon({ isEgg: true });
		expect(resolvePokemonSpritePath(egg, { game: 'HG', format: 4 }, 'game')).toBe(
			'/sprites/pokemon/game/heartgold-soulsilver/egg.png'
		);
		expect(
			resolvePokemonSpritePath(
				pokemon({ speciesId: 490, isEgg: true }),
				{ game: 'B', format: 5 },
				'game'
			)
		).toBe('/sprites/pokemon/game/black-white/0490-egg.png');
		expect(resolvePokemonSpritePath(egg, emerald, 'game')).toBe(
			resolveSpriteCatalogEntry(egg)?.path ?? null
		);
	});

	test('packages a local file for every runtime key', () => {
		const paths = gameSpriteAssetPaths();
		expect(paths).toHaveLength(report.totals.assetCount);
		expect(paths.filter((assetPath) => !existsSync(staticFile(assetPath)))).toEqual([]);
	});
});
