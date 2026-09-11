export type Item = { id: number; slug: string; name: string };
export type GameIndex = { itemId: number; generation: number; nativeId: number };
export type AmbiguousIdentity = { key: string; pokeApiItemIds: number[]; slugs: string[] };
export type ItemSpriteIdentityOverride = {
	key: string;
	pokeApiItemId: number;
	evidencePaths: string[];
	reason: string;
};

export function buildIdentityMap(
	gameIndices: GameIndex[],
	spriteItems: Set<number>,
	items: Map<number, Item>,
	canonical: boolean,
	overrides: ItemSpriteIdentityOverride[]
) {
	const candidates = new Map<string, Set<number>>();
	for (const entry of gameIndices) {
		if (canonical && entry.generation < 4) continue;
		const key = canonical
			? `canonical-item-${entry.nativeId}`
			: `generation-${entry.generation}-item-${entry.nativeId}`;
		const matches = candidates.get(key) ?? new Set<number>();
		matches.add(entry.itemId);
		candidates.set(key, matches);
	}

	const identities: Record<string, number> = {};
	const ambiguous: AmbiguousIdentity[] = [];
	const overridesByKey = new Map(overrides.map((override) => [override.key, override]));
	for (const [key, itemIds] of [...candidates].sort(([left], [right]) =>
		left.localeCompare(right, undefined, { numeric: true })
	)) {
		const sortedIds = [...itemIds].sort((left, right) => left - right);
		const override = overridesByKey.get(key);
		if (override) {
			if (!itemIds.has(override.pokeApiItemId)) {
				throw new Error(`${key} override is not one of its PokéAPI candidates.`);
			}
			if (spriteItems.has(override.pokeApiItemId)) identities[key] = override.pokeApiItemId;
		} else if (sortedIds.length === 1) {
			if (spriteItems.has(sortedIds[0])) identities[key] = sortedIds[0];
		} else {
			ambiguous.push({
				key,
				pokeApiItemIds: sortedIds,
				slugs: sortedIds.map((itemId) => items.get(itemId)?.slug ?? `item-${itemId}`)
			});
		}
	}
	for (const override of overrides) {
		if (!candidates.has(override.key))
			throw new Error(`Unused identity override: ${override.key}.`);
	}
	return { identities, ambiguous };
}
