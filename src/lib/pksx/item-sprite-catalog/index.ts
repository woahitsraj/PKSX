import catalogManifest from './catalog.generated.json';
import type { ItemSpriteIdentity } from '$lib/engine';

export type ItemSpriteCatalogEntry = {
	pokeApiItemId: number;
	name: string;
	slug: string;
	path: string;
	sourceUrl: string;
	sourceFamily: 'root' | 'gen8' | 'gen9';
	sourceVariant: 'default' | 'bag' | 'held';
	width: number;
	height: number;
	byteSize: number;
	gzipByteSize: number;
};

export type AmbiguousItemSpriteIdentity = {
	key: string;
	pokeApiItemIds: number[];
	slugs: string[];
};

export type ItemSpriteIdentityOverride = {
	key: string;
	pokeApiItemId: number;
	evidencePaths: string[];
	reason: string;
	evidenceUrls: string[];
};

export type ItemSpriteCatalogManifest = {
	source: {
		name: string;
		repository: string;
		revision: string;
		license: string;
		licenseUrl: string;
		imageCopyright: string;
	};
	mappingSource: { name: string; repository: string; revision: string };
	identityOverrideSource: {
		name: string;
		repository: string;
		revision: string;
		packageVersion: string;
	};
	identityOverrides: ItemSpriteIdentityOverride[];
	summary: {
		identityCount: number;
		canonicalIdentityCount: number;
		assetCount: number;
		byteSize: number;
		gzipByteSize: number;
		ambiguousIdentityCount: number;
		ambiguousCanonicalIdentityCount: number;
		generations: Record<
			string,
			{
				sourceIdentityCount: number;
				mappedIdentityCount: number;
				missingIdentityCount: number;
				ambiguousIdentityCount: number;
			}
		>;
	};
	assets: Record<string, ItemSpriteCatalogEntry>;
	identities: Record<string, number>;
	canonicalIdentities: Record<string, number>;
	ambiguousIdentities: AmbiguousItemSpriteIdentity[];
	ambiguousCanonicalIdentities: AmbiguousItemSpriteIdentity[];
};

const manifest = catalogManifest as ItemSpriteCatalogManifest;

export function createItemSpriteCatalogKey(identity: {
	generation: number;
	nativeId: number;
}): string {
	return `generation-${identity.generation}-item-${identity.nativeId}`;
}

export function resolveItemSpriteCatalogEntry(
	identity: ItemSpriteIdentity | null | undefined
): ItemSpriteCatalogEntry | null {
	return resolveItemSpriteCatalogEntryFromManifest(identity, manifest);
}

export function resolveItemSpriteCatalogEntryFromManifest(
	identity: ItemSpriteIdentity | null | undefined,
	catalog: ItemSpriteCatalogManifest
): ItemSpriteCatalogEntry | null {
	if (!identity || identity.nativeId <= 0) return null;

	const exactKey = createItemSpriteCatalogKey(identity);
	if (catalog.ambiguousIdentities.some((entry) => entry.key === exactKey)) return null;

	const exactItemId = catalog.identities[exactKey];
	if (exactItemId !== undefined) return catalog.assets[String(exactItemId)] ?? null;
	if (identity.canonicalId <= 0) return null;

	const canonicalKey = `canonical-item-${identity.canonicalId}`;
	if (catalog.ambiguousCanonicalIdentities.some((entry) => entry.key === canonicalKey)) {
		return null;
	}
	const canonicalItemId = catalog.canonicalIdentities[canonicalKey];
	return canonicalItemId === undefined ? null : (catalog.assets[String(canonicalItemId)] ?? null);
}
