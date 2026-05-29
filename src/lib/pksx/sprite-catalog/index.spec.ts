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
		expect(
			createSpriteCatalogKey({
				speciesId: 25,
				form: 0,
				isEgg: false,
				isShiny: false,
				displaySex: 'default'
			})
		).toBe('species-0025-form-00-sex-default-normal');
		expect(
			createSpriteCatalogKey({
				speciesId: 201,
				form: 3,
				isEgg: true,
				isShiny: true,
				displaySex: 'female'
			})
		).toBe('species-0201-form-03-sex-female-egg');
		expect(
			createSpriteCatalogKey({
				speciesId: 25,
				form: 0,
				isEgg: false,
				isShiny: true,
				displaySex: 'female'
			})
		).toBe('species-0025-form-00-sex-female-shiny');
	});

	test('resolves known base species assets', () => {
		expect.assertions(3);

		const pikachu = resolveSpriteCatalogEntry({
			speciesId: 25,
			form: 0,
			isEgg: false,
			isShiny: false,
			displaySex: 'default'
		});

		expect(pikachu?.path).toBe('/sprites/pokemon/species/0025-form-00-sex-default-normal.png');
		expect(pikachu?.sourceUrl).not.toContain('pokemondb.net/sprites/scarlet-violet/normal/1x');
		expect(pikachu?.sourceUrl).toContain('pokemondb.net/sprites/home/');
	});

	test('resolves mapped HOME form, shiny, and sex-difference assets', () => {
		expect(
			resolveSpriteCatalogEntry({
				speciesId: 25,
				form: 6,
				isEgg: false,
				isShiny: false,
				displaySex: 'default'
			})?.path
		).toBe('/sprites/pokemon/species/0025-form-06-sex-default-normal.png');
		expect(
			resolveSpriteCatalogEntry({
				speciesId: 26,
				form: 1,
				isEgg: false,
				isShiny: true,
				displaySex: 'default'
			})?.path
		).toBe('/sprites/pokemon/species/0026-form-01-sex-default-shiny.png');
		expect(
			resolveSpriteCatalogEntry({
				speciesId: 25,
				form: 0,
				isEgg: false,
				isShiny: true,
				displaySex: 'female'
			})?.path
		).toBe('/sprites/pokemon/species/0025-form-00-sex-female-shiny.png');
	});

	test('falls back from unsupported forms to base species while preserving shiny first', () => {
		const normalBase = createEntry({ speciesId: 25, form: 0, isShiny: false });
		const shinyBase = createEntry({ speciesId: 25, form: 0, isShiny: true });

		expect(
			resolveSpriteCatalogEntryFromEntries(
				{ speciesId: 25, form: 7, isEgg: false, isShiny: true, displaySex: 'default' },
				toEntries([normalBase, shinyBase])
			)
		).toBe(shinyBase);
	});

	test('preserves form before shiny coloration', () => {
		const normalForm = createEntry({ speciesId: 479, form: 1, isShiny: false });
		const shinyBase = createEntry({ speciesId: 479, form: 0, isShiny: true });

		expect(
			resolveSpriteCatalogEntryFromEntries(
				{ speciesId: 479, form: 1, isEgg: false, isShiny: true, displaySex: 'default' },
				toEntries([normalForm, shinyBase])
			)
		).toBe(normalForm);
	});

	test('preserves display sex before shiny coloration', () => {
		const normalFemale = createEntry({
			speciesId: 25,
			form: 0,
			isShiny: false,
			displaySex: 'female'
		});
		const shinyDefault = createEntry({ speciesId: 25, form: 0, isShiny: true });

		expect(
			resolveSpriteCatalogEntryFromEntries(
				{ speciesId: 25, form: 0, isEgg: false, isShiny: true, displaySex: 'female' },
				toEntries([normalFemale, shinyDefault])
			)
		).toBe(normalFemale);
	});

	test('does not resolve eggs to species sprites', () => {
		expect(
			resolveSpriteCatalogEntry({
				speciesId: 25,
				form: 0,
				isEgg: true,
				isShiny: true,
				displaySex: 'female'
			})
		).toBeNull();
	});

	test('resolves exact egg entries before egg fallback', () => {
		const eggEntry = createEntry({
			speciesId: 25,
			form: 0,
			isEgg: true,
			isShiny: false,
			displaySex: 'default',
			path: '/sprites/pokemon/egg.png'
		});

		expect(
			resolveSpriteCatalogEntryFromEntries(
				{ speciesId: 25, form: 0, isEgg: true, isShiny: true, displaySex: 'female' },
				toEntries([eggEntry])
			)
		).toBe(eggEntry);
	});

	test('returns null for empty and unknown species', () => {
		expect(resolveSpriteCatalogEntry(null)).toBeNull();
		expect(
			resolveSpriteCatalogEntry({
				speciesId: 0,
				form: 0,
				isEgg: false,
				isShiny: false,
				displaySex: 'default'
			})
		).toBeNull();
		expect(
			resolveSpriteCatalogEntry({
				speciesId: 9999,
				form: 0,
				isEgg: false,
				isShiny: false,
				displaySex: 'default'
			})
		).toBeNull();
	});

	test('contains migrated HOME normal, shiny, form, and sex-difference assets', () => {
		const entries = getSpriteCatalogEntries();

		expect(entries).toHaveLength(2811);
		expect(entries.filter((entry) => entry.isShiny)).toHaveLength(1405);
		expect(entries.filter((entry) => !entry.isShiny)).toHaveLength(1406);
		expect(entries.every((entry) => entry.sourceFamily === 'home')).toBe(true);
		expect(entries.some((entry) => entry.form > 0)).toBe(true);
		expect(entries.some((entry) => entry.displaySex === 'female')).toBe(true);
		expect(entries.every((entry) => !entry.isEgg)).toBe(true);
	});
});

function createEntry(
	overrides: Partial<SpriteCatalogEntry> & { speciesId: number; form: number }
): SpriteCatalogEntry {
	return {
		speciesId: overrides.speciesId,
		form: overrides.form,
		isEgg: overrides.isEgg ?? false,
		isShiny: overrides.isShiny ?? false,
		displaySex: overrides.displaySex ?? 'default',
		name: overrides.name ?? `Species ${overrides.speciesId}`,
		slug: overrides.slug ?? `species-${overrides.speciesId}`,
		path:
			overrides.path ??
			`/sprites/pokemon/species/${String(overrides.speciesId).padStart(4, '0')}-form-${String(
				overrides.form
			).padStart(2, '0')}-sex-${overrides.displaySex ?? 'default'}-${
				overrides.isShiny ? 'shiny' : 'normal'
			}.png`,
		sourceUrl:
			overrides.sourceUrl ??
			`https://img.pokemondb.net/sprites/example/${overrides.isShiny ? 'shiny' : 'normal'}/${
				overrides.slug ?? `species-${overrides.speciesId}`
			}.png`,
		sourceFamily: overrides.sourceFamily ?? 'example',
		retrievedAt: overrides.retrievedAt ?? '2026-05-27T00:00:00.000Z',
		width: overrides.width ?? 96,
		height: overrides.height ?? 96,
		byteSize: overrides.byteSize ?? 512
	};
}

function toEntries(entries: SpriteCatalogEntry[]): Record<string, SpriteCatalogEntry> {
	return Object.fromEntries(entries.map((entry) => [createSpriteCatalogKey(entry), entry]));
}
