import { describe, expect, test } from 'vitest';
import {
	createSpriteCatalogKey,
	getSpriteCatalogEntries,
	resolveSpriteCatalogEntry,
	resolveSpriteCatalogEntryFromEntries,
	type SpriteCatalogEntry
} from './index';

describe('Sprite Catalog', () => {
	test('creates deterministic catalog keys', () => {
		expect(createSpriteCatalogKey({ speciesId: 25, form: 0, isEgg: false })).toBe(
			'species-0025-form-00-normal'
		);
		expect(createSpriteCatalogKey({ speciesId: 201, form: 3, isEgg: true })).toBe(
			'species-0201-form-03-egg'
		);
	});

	test('resolves known base species assets', () => {
		expect.assertions(3);

		const pikachu = resolveSpriteCatalogEntry({ speciesId: 25, form: 0, isEgg: false });

		expect(pikachu?.path).toBe('/sprites/pokemon/species/0025.png');
		expect(pikachu?.sourceUrl).not.toContain('pokemondb.net/sprites/scarlet-violet/normal/1x');
		expect(pikachu?.sourceUrl).toContain('pokemondb.net/sprites/');
	});

	test('falls back from unsupported forms to base species', () => {
		expect(resolveSpriteCatalogEntry({ speciesId: 25, form: 7, isEgg: false })?.path).toBe(
			'/sprites/pokemon/species/0025.png'
		);
	});

	test('does not resolve eggs to species sprites', () => {
		expect(resolveSpriteCatalogEntry({ speciesId: 25, form: 0, isEgg: true })).toBeNull();
	});

	test('resolves exact egg entries before egg fallback', () => {
		const eggEntry = {
			speciesId: 25,
			form: 0,
			isEgg: true,
			name: 'Egg',
			slug: 'egg',
			path: '/sprites/pokemon/egg.png',
			sourceUrl: 'https://img.pokemondb.net/sprites/example/normal/egg.png',
			sourceFamily: 'example',
			retrievedAt: '2026-05-27T00:00:00.000Z',
			width: 32,
			height: 32,
			byteSize: 512
		} satisfies SpriteCatalogEntry;

		expect(
			resolveSpriteCatalogEntryFromEntries(
				{ speciesId: 25, form: 0, isEgg: true },
				{
					[createSpriteCatalogKey({ speciesId: 25, form: 0, isEgg: true })]: eggEntry
				}
			)
		).toBe(eggEntry);
	});

	test('returns null for empty and unknown species', () => {
		expect(resolveSpriteCatalogEntry({ speciesId: null, form: null, isEgg: false })).toBeNull();
		expect(resolveSpriteCatalogEntry({ speciesId: 0, form: 0, isEgg: false })).toBeNull();
		expect(resolveSpriteCatalogEntry({ speciesId: 9999, form: 0, isEgg: false })).toBeNull();
	});

	test('contains all base species assets', () => {
		const entries = getSpriteCatalogEntries();

		expect(entries).toHaveLength(1025);
		expect(entries.every((entry) => entry.form === 0 && !entry.isEgg)).toBe(true);
	});
});
