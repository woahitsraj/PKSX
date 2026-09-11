import { describe, expect, test } from 'vitest';
import {
	createItemSpriteCatalogKey,
	resolveItemSpriteCatalogEntry,
	resolveItemSpriteCatalogEntryFromManifest,
	type ItemSpriteCatalogManifest
} from './index';

const masterBall = {
	pokeApiItemId: 1,
	name: 'Master Ball',
	slug: 'master-ball',
	path: '/sprites/items/0001-master-ball.png',
	sourceUrl:
		'https://raw.githubusercontent.com/PokeAPI/sprites/example/sprites/items/master-ball.png',
	width: 24,
	height: 24,
	byteSize: 281,
	gzipByteSize: 304,
	sourceFamily: 'root' as const,
	sourceVariant: 'default' as const
};

const manifest: ItemSpriteCatalogManifest = {
	source: {
		name: 'PokéAPI sprites',
		repository: 'https://github.com/PokeAPI/sprites',
		revision: 'example',
		license: 'CC0-1.0',
		licenseUrl: 'https://github.com/PokeAPI/sprites/blob/example/LICENCE.txt',
		imageCopyright: 'The Pokémon Company'
	},
	mappingSource: {
		name: 'PokéAPI data',
		repository: 'https://github.com/PokeAPI/pokeapi',
		revision: 'example'
	},
	identityOverrideSource: {
		name: 'PKHeX item storage tables',
		repository: 'https://github.com/kwsch/PKHeX',
		revision: 'example',
		packageVersion: '26.5.5'
	},
	identityOverrides: [],
	summary: {
		identityCount: 2,
		canonicalIdentityCount: 1,
		assetCount: 1,
		byteSize: 281,
		gzipByteSize: 304,
		ambiguousIdentityCount: 0,
		ambiguousCanonicalIdentityCount: 0,
		generations: {}
	},
	assets: { '1': masterBall },
	identities: { 'generation-3-item-1': 1, 'generation-9-item-1': 1 },
	canonicalIdentities: { 'canonical-item-1': 1 },
	ambiguousIdentities: [
		{
			key: 'generation-9-item-2',
			pokeApiItemIds: [2, 3],
			slugs: ['ultra-ball', 'great-ball']
		}
	],
	ambiguousCanonicalIdentities: []
};

describe('Item Sprite Catalog', () => {
	test('creates deterministic generation and canonical keys', () => {
		expect(createItemSpriteCatalogKey({ generation: 3, nativeId: 13 })).toBe(
			'generation-3-item-13'
		);
	});

	test('resolves an unambiguous generation-native identity', () => {
		expect(
			resolveItemSpriteCatalogEntryFromManifest(
				{ nativeId: 1, canonicalId: 1, generation: 3, context: 'Gen3', gameVersionId: 3 },
				manifest
			)
		).toBe(masterBall);
	});

	test('does not use a canonical fallback for an ambiguous generation-native identity', () => {
		expect(
			resolveItemSpriteCatalogEntryFromManifest(
				{ nativeId: 2, canonicalId: 1, generation: 9, context: 'Gen9', gameVersionId: 77 },
				manifest
			)
		).toBeNull();
	});

	test('falls back through the Engine canonical identity', () => {
		expect(
			resolveItemSpriteCatalogEntryFromManifest(
				{ nativeId: 99, canonicalId: 1, generation: 3, context: 'Gen3', gameVersionId: 3 },
				manifest
			)
		).toBe(masterBall);
	});

	test('returns null for empty, unsupported, and unmapped identities', () => {
		expect(resolveItemSpriteCatalogEntryFromManifest(null, manifest)).toBeNull();
		expect(
			resolveItemSpriteCatalogEntryFromManifest(
				{ nativeId: 0, canonicalId: 0, generation: 3, context: 'Gen3', gameVersionId: 3 },
				manifest
			)
		).toBeNull();
		expect(
			resolveItemSpriteCatalogEntryFromManifest(
				{ nativeId: 9999, canonicalId: 9999, generation: 3, context: 'Gen3', gameVersionId: 3 },
				manifest
			)
		).toBeNull();
	});

	test.each([
		{ generation: 1, nativeId: 20, canonicalId: 17, slug: 'potion' },
		{ generation: 2, nativeId: 18, canonicalId: 17, slug: 'potion' },
		{ generation: 3, nativeId: 13, canonicalId: 17, slug: 'potion' },
		{ generation: 9, nativeId: 1880, canonicalId: 1880, slug: 'booster-energy' }
	])(
		'resolves Generation $generation native item $nativeId to $slug',
		({ generation, nativeId, canonicalId, slug }) => {
			expect(
				resolveItemSpriteCatalogEntry({
					nativeId,
					canonicalId,
					generation,
					context: `Gen${generation}`,
					gameVersionId: generation
				})?.slug
			).toBe(slug);
		}
	);

	test('uses an exact old-generation mapping when no canonical item exists', () => {
		expect(
			resolveItemSpriteCatalogEntry({
				nativeId: 259,
				canonicalId: 0,
				generation: 3,
				context: 'Gen3',
				gameVersionId: 3
			})?.slug
		).toBe('mach-bike');
	});

	test('uses the reviewed PKHeX override for Generation 9 Ultra Ball', () => {
		expect(
			resolveItemSpriteCatalogEntry({
				nativeId: 2,
				canonicalId: 2,
				generation: 9,
				context: 'Gen9',
				gameVersionId: 9
			})?.slug
		).toBe('ultra-ball');
	});

	test.each([
		{ generation: 2, nativeId: 116, slug: 'blue-card' },
		{ generation: 5, nativeId: 227, slug: 'deep-sea-scale' }
	])(
		'uses a reviewed PKHeX override for Generation $generation item $nativeId',
		({ generation, nativeId, slug }) => {
			expect(
				resolveItemSpriteCatalogEntry({
					nativeId,
					canonicalId: nativeId,
					generation,
					context: `Gen${generation}`,
					gameVersionId: generation
				})?.slug
			).toBe(slug);
		}
	);

	test.each([
		{ generation: 2, nativeId: 221 },
		{ generation: 5, nativeId: 356 },
		{ generation: 8, nativeId: 1785 }
	])(
		'does not resolve Generation $generation item $nativeId when an artless candidate exposes a collision',
		({ generation, nativeId }) => {
			expect(
				resolveItemSpriteCatalogEntry({
					nativeId,
					canonicalId: nativeId,
					generation,
					context: `Gen${generation}`,
					gameVersionId: generation
				})
			).toBeNull();
		}
	);

	test('keeps PokeAPI bag and held variants mapped to their distinct native items', () => {
		const identity = (nativeId: number) => ({
			nativeId,
			canonicalId: nativeId,
			generation: 7,
			context: 'Gen7',
			gameVersionId: 30
		});

		expect(resolveItemSpriteCatalogEntry(identity(803))).toMatchObject({
			slug: 'aloraichium-z--held',
			sourceVariant: 'held'
		});
		expect(resolveItemSpriteCatalogEntry(identity(831))).toMatchObject({
			slug: 'aloraichium-z--bag',
			sourceVariant: 'bag'
		});
	});
});
