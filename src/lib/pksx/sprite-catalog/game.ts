import gameCatalog from './game-catalog.generated.json';
import type { SpriteIdentity } from './index';

export type SpriteGameContext = { game: string | null; format: number | null };

type GameFamily = { generation: number; keys: Set<string> };

type GameCatalogFamily = { generation: number; variants: Record<string, string>; eggs: string[] };

const families = new Map<string, GameFamily>(
	Object.entries(gameCatalog as Record<string, GameCatalogFamily>).map(([id, family]) => [
		id,
		{ generation: family.generation, keys: new Set(familyKeys(family)) }
	])
);

function familyKeys({ variants, eggs }: GameCatalogFamily) {
	return Object.entries(variants)
		.flatMap(([variant, tokens]) =>
			tokens.split(' ').map((token) => {
				const [species, form = '0'] = token.split('-');
				return `${species.padStart(4, '0')}-${form.padStart(2, '0')}-${variant}`;
			})
		)
		.concat(eggs);
}

export function gameSpriteAssetPaths(): string[] {
	return [...families].flatMap(([id, family]) =>
		[...family.keys].map((key) => gameSpritePath(id, key))
	);
}

function gameSpritePath(familyId: string, key: string) {
	return `/sprites/pokemon/game/${familyId}/${key}.png`;
}

/** PKHeX GameVersion names. `null` means the game has no packaged artwork and uses HOME. */
export const gameSpriteFamilies: Record<string, string | null> = {
	RB: 'red-blue',
	RD: 'red-blue',
	BU: 'red-blue',
	GN: 'red-blue',
	YW: 'yellow',
	GS: 'gold',
	GD: 'gold',
	SI: 'silver',
	C: 'crystal',
	RS: 'ruby-sapphire',
	R: 'ruby-sapphire',
	S: 'ruby-sapphire',
	E: 'emerald',
	FR: 'firered-leafgreen',
	LG: 'firered-leafgreen',
	FRLG: 'firered-leafgreen',
	DP: 'diamond-pearl',
	D: 'diamond-pearl',
	P: 'diamond-pearl',
	Pt: 'platinum',
	HG: 'heartgold-soulsilver',
	SS: 'heartgold-soulsilver',
	HGSS: 'heartgold-soulsilver',
	B: 'black-white',
	W: 'black-white',
	BW: 'black-white',
	B2: 'black-white',
	W2: 'black-white',
	B2W2: 'black-white',
	'Pokémon Unbound': null,
	RSBOX: null,
	COLO: null,
	XD: null,
	BATREV: null,
	X: null,
	Y: null,
	OR: null,
	AS: null,
	SN: null,
	MN: null,
	US: null,
	UM: null,
	GP: null,
	GE: null,
	SW: null,
	SH: null,
	BD: null,
	SP: null,
	PLA: null,
	ZA: null,
	SL: null,
	VL: null,
	SV: null
};

const formatDefaults: Record<number, string> = {
	1: 'red-blue',
	2: 'crystal',
	3: 'emerald',
	4: 'platinum',
	5: 'black-white'
};

/**
 * A known game whose family matches the entity format wins. A known game without packaged
 * artwork uses HOME. Otherwise the default family for the entity format is used, if any.
 */
export function resolveGameSpriteFamily({ game, format }: SpriteGameContext): string | null {
	if (game !== null && game in gameSpriteFamilies) {
		const family = gameSpriteFamilies[game];
		if (family === null) return null;
		if (families.get(family)?.generation === format) return family;
	}
	return format === null ? null : (formatDefaults[format] ?? null);
}

export function createGameSpriteKey(identity: SpriteIdentity) {
	const species = String(identity.speciesId).padStart(4, '0');
	const form = String(identity.form).padStart(2, '0');
	return `${species}-${form}-${identity.displaySex}-${identity.isShiny ? 'shiny' : 'normal'}`;
}

export function resolveGameSpritePath(
	identity: SpriteIdentity | null,
	familyId: string | null
): string | null {
	const family = familyId ? families.get(familyId) : undefined;
	if (!identity || !family || identity.speciesId <= 0) return null;

	const candidates = identity.isEgg
		? [`${String(identity.speciesId).padStart(4, '0')}-egg`, 'egg']
		: [...new Set([identity.displaySex, 'default' as const])].flatMap((displaySex) =>
				[...new Set([identity.isShiny, false])].map((isShiny) =>
					createGameSpriteKey({ ...identity, displaySex, isShiny })
				)
			);
	const key = candidates.find((candidate) => family.keys.has(candidate));
	return key ? gameSpritePath(familyId!, key) : null;
}
