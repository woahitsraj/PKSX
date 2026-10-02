import type { BoxSlotSummary, PartySlotSummary } from '$lib/engine';
import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
import type { VirtualLocation } from '$lib/pksx/pokemon-storage-catalog/virtual-views';

export type QuickSearchResult = {
	id: string;
	saveFileId: string;
	saveFileName: string;
	paneId: string;
	speciesName: string;
	nickname: string;
	locationLabel: string;
	zone: 'party' | 'box';
	box: number | null;
	slot: number;
	recordId?: string;
	virtualLocation?: VirtualLocation;
};

export function createVirtualQuickSearchResults(
	records: PokemonRecord[],
	paneId: string,
	location: VirtualLocation
): QuickSearchResult[] {
	return records.map((record) => ({
		id: record.recordId,
		recordId: record.recordId,
		virtualLocation: location,
		saveFileId: 'pokemon-storage',
		saveFileName: 'Pokemon Storage',
		paneId,
		speciesName: record.projection.speciesName ?? '',
		nickname: record.projection.nickname ?? '',
		locationLabel: location === 'unfiled' ? 'Unfiled' : 'All Pokemon',
		zone: 'box',
		box: null,
		slot: 0
	}));
}

type SaveFileSearchInput = {
	saveFileId: string;
	saveFileName: string;
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
	input: Pick<SaveFileSearchInput, 'saveFileId' | 'saveFileName' | 'paneId'>,
	slot: PartySlotSummary | BoxSlotSummary,
	zone: QuickSearchResult['zone'],
	box: number | null,
	locationLabel: string
): QuickSearchResult {
	return {
		id: `${input.saveFileId}:${zone}:${box ?? 'party'}:${slot.slot}`,
		saveFileId: input.saveFileId,
		saveFileName: input.saveFileName,
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
