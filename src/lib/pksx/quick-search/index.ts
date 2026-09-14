import type { BoxSlotSummary, PartySlotSummary } from '$lib/engine';
import type { StoredPokemonStorage } from '$lib/pksx/saves';

export type QuickSearchResult = {
	id: string;
	collectionKey: string;
	collectionLabel: string;
	paneId: string;
	speciesName: string;
	nickname: string;
	locationLabel: string;
	zone: 'party' | 'box';
	box: number | null;
	slot: number;
};

type SaveFileSearchInput = {
	collectionKey: string;
	collectionLabel: string;
	paneId: string;
	partySlots: PartySlotSummary[];
	boxSlots: BoxSlotSummary[];
};

export function createSaveFileQuickSearchResults(input: SaveFileSearchInput): QuickSearchResult[] {
	return [
		...input.partySlots
			.filter((slot) => !slot.isEmpty)
			.map((slot) => createResult(input, slot, 'party', null, `Party, Slot ${slot.slot + 1}`)),
		...input.boxSlots
			.filter((slot) => !slot.isEmpty)
			.map((slot) =>
				createResult(
					input,
					slot,
					'box',
					slot.box,
					`Box ${String(slot.box + 1).padStart(2, '0')}, Slot ${slot.slot + 1}`
				)
			)
	];
}

export function createPokemonStorageQuickSearchResults(input: {
	paneId: string;
	storage: StoredPokemonStorage;
	speciesNames?: ReadonlyMap<number, string>;
}): QuickSearchResult[] {
	return input.storage.boxes.flatMap((box) =>
		box.slots.flatMap((storageSlot) => {
			const pokemon = storageSlot.pokemon;
			if (!pokemon) return [];
			return [
				{
					id: `pokemon-storage:box:${box.index}:${storageSlot.slot}`,
					collectionKey: 'pokemon-storage',
					collectionLabel: 'Pokemon Storage',
					paneId: input.paneId,
					speciesName:
						pokemon.speciesName ??
						(pokemon.speciesId === null ? undefined : input.speciesNames?.get(pokemon.speciesId)) ??
						pokemon.label,
					nickname: pokemon.label,
					locationLabel: `${box.name}, Slot ${storageSlot.slot + 1}`,
					zone: 'box' as const,
					box: box.index,
					slot: storageSlot.slot
				}
			];
		})
	);
}

export function filterQuickSearchResults(
	results: QuickSearchResult[],
	query: string
): QuickSearchResult[] {
	const normalizedQuery = normalize(query.trim());
	if (!normalizedQuery) return [];

	return results.filter((result) =>
		[result.speciesName, result.nickname, result.locationLabel].some((value) =>
			normalize(value).includes(normalizedQuery)
		)
	);
}

function createResult(
	input: Pick<SaveFileSearchInput, 'collectionKey' | 'collectionLabel' | 'paneId'>,
	slot: PartySlotSummary | BoxSlotSummary,
	zone: QuickSearchResult['zone'],
	box: number | null,
	locationLabel: string
): QuickSearchResult {
	return {
		id: `${input.collectionKey}:${zone}:${box ?? 'party'}:${slot.slot}`,
		collectionKey: input.collectionKey,
		collectionLabel: input.collectionLabel,
		paneId: input.paneId,
		speciesName: slot.speciesName ?? slot.nickname,
		nickname: slot.nickname,
		locationLabel,
		zone,
		box,
		slot: slot.slot
	};
}

function normalize(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase();
}
