import catalogManifest from './catalog.generated.json';

export type DisplaySex = 'default' | 'male' | 'female';

export type SpriteIdentity = {
	speciesId: number;
	form: number;
	isEgg: boolean;
	isShiny: boolean;
	displaySex: DisplaySex;
};

export type SpriteCatalogEntry = {
	speciesId: number;
	form: number;
	isEgg: boolean;
	isShiny: boolean;
	displaySex: DisplaySex;
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
	isShiny: boolean;
	displaySex: DisplaySex;
}): string {
	const species = String(identity.speciesId).padStart(4, '0');
	const form = String(identity.form).padStart(2, '0');
	const variant = identity.isShiny ? 'shiny' : 'normal';

	return `species-${species}-form-${form}-sex-${identity.displaySex}-${identity.isEgg ? 'egg' : variant}`;
}

export function resolveSpriteCatalogEntry(
	identity: SpriteIdentity | null
): SpriteCatalogEntry | null {
	return resolveSpriteCatalogEntryFromEntries(identity, manifest.entries);
}

export function resolveSpriteCatalogEntryFromEntries(
	identity: SpriteIdentity | null,
	entries: Record<string, SpriteCatalogEntry>
): SpriteCatalogEntry | null {
	if (identity === null || identity.speciesId <= 0) {
		return null;
	}

	if (identity.isEgg) {
		return (
			entries[
				createSpriteCatalogKey({
					...identity,
					form: identity.form,
					isShiny: false,
					displaySex: 'default'
				})
			] ?? null
		);
	}

	for (const candidate of createFallbackIdentities(identity)) {
		const entry = entries[createSpriteCatalogKey(candidate)];
		if (entry) {
			return entry;
		}
	}

	return null;
}

function createFallbackIdentities(identity: SpriteIdentity): SpriteIdentity[] {
	const forms = identity.form === 0 ? [0] : [identity.form, 0];
	const displaySexes: DisplaySex[] =
		identity.displaySex === 'default' ? ['default'] : [identity.displaySex, 'default'];
	const shinyStates = identity.isShiny ? [true, false] : [false];
	const candidates: SpriteIdentity[] = [];

	for (const form of forms) {
		for (const displaySex of displaySexes) {
			for (const isShiny of shinyStates) {
				candidates.push({
					...identity,
					form,
					displaySex,
					isShiny,
					isEgg: false
				});
			}
		}
	}

	return candidates;
}

export function getSpriteCatalogEntries(): SpriteCatalogEntry[] {
	return Object.values(manifest.entries);
}
