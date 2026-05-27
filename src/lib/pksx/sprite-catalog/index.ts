import catalogManifest from './catalog.generated.json';

export type SpriteIdentity = {
	speciesId: number | null;
	form: number | null;
	isEgg: boolean;
};

export type SpriteCatalogEntry = {
	speciesId: number;
	form: number;
	isEgg: boolean;
	name: string;
	slug: string;
	path: string;
	sourceUrl: string;
	sourceFamily: string;
	retrievedAt: string;
	width: number;
	height: number;
	byteSize: number;
};

type SpriteCatalogManifest = {
	entries: Record<string, SpriteCatalogEntry>;
};

const manifest = catalogManifest as SpriteCatalogManifest;

export function createSpriteCatalogKey(identity: {
	speciesId: number;
	form: number;
	isEgg: boolean;
}): string {
	const species = String(identity.speciesId).padStart(4, '0');
	const form = String(identity.form).padStart(2, '0');
	const egg = identity.isEgg ? 'egg' : 'normal';

	return `species-${species}-form-${form}-${egg}`;
}

export function resolveSpriteCatalogEntry(identity: SpriteIdentity): SpriteCatalogEntry | null {
	return resolveSpriteCatalogEntryFromEntries(identity, manifest.entries);
}

export function resolveSpriteCatalogEntryFromEntries(
	identity: SpriteIdentity,
	entries: Record<string, SpriteCatalogEntry>
): SpriteCatalogEntry | null {
	if (identity.speciesId === null || identity.speciesId <= 0) {
		return null;
	}

	const form = identity.form ?? 0;
	const exact =
		entries[createSpriteCatalogKey({ ...identity, speciesId: identity.speciesId, form })];
	if (exact) {
		return exact;
	}

	if (identity.isEgg) {
		return null;
	}

	if (form !== 0) {
		return (
			entries[createSpriteCatalogKey({ speciesId: identity.speciesId, form: 0, isEgg: false })] ??
			null
		);
	}

	return null;
}

export function getSpriteCatalogEntries(): SpriteCatalogEntry[] {
	return Object.values(manifest.entries);
}
