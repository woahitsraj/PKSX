import type { SaveFileSearchProjection } from '$lib/engine';
import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
import type { VirtualLocation } from '$lib/pksx/pokemon-storage-catalog/virtual-views';
import type { SearchFacts } from './advanced';

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
	facts: SearchFacts;
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
		slot: 0,
		facts: {
			formName: null,
			isShiny: record.projection.spriteIdentity?.isShiny ?? false,
			legal: null,
			nature: record.projection.nature ?? null,
			ability: record.projection.ability ?? null,
			heldItem: record.projection.heldItem ?? null,
			moves: (record.projection.moves ?? []).map((move) => move.name),
			level: record.projection.level ?? null,
			ivs: (record.projection.stats ?? []).map((stat) => stat.iv ?? null),
			evs: (record.projection.stats ?? []).map((stat) => stat.ev ?? null),
			originGame: record.origin?.originGame ?? null
		}
	}));
}

type SaveFileSearchInput = {
	saveFileId: string;
	saveFileName: string;
	paneId: string;
	projection: SaveFileSearchProjection;
};

export function createSaveFileQuickSearchResults(input: SaveFileSearchInput): QuickSearchResult[] {
	return input.projection.entries.map((entry) => ({
		id: `${input.saveFileId}:${entry.zone}:${entry.box ?? 'party'}:${entry.slot}`,
		saveFileId: input.saveFileId,
		saveFileName: input.saveFileName,
		paneId: input.paneId,
		speciesName: entry.speciesName,
		nickname: entry.nickname,
		locationLabel:
			entry.zone === 'party'
				? `Party, Slot ${entry.slot + 1}`
				: `Box ${String((entry.box ?? 0) + 1).padStart(2, '0')}, Slot ${entry.slot + 1}`,
		zone: entry.zone,
		box: entry.box,
		slot: entry.slot,
		facts: {
			formName: entry.formName,
			isShiny: entry.isShiny,
			legal: entry.legal,
			nature: entry.nature,
			ability: entry.ability,
			heldItem: entry.heldItem,
			moves: entry.moves,
			level: entry.level,
			ivs: entry.ivs,
			evs: entry.evs,
			originGame: entry.originGame
		}
	}));
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

export function normalize(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase();
}
