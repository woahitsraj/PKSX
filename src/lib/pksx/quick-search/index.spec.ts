import { describe, expect, it } from 'vitest';
import type { SaveFileSearchProjection } from '$lib/engine';
import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
import {
	createSaveFileQuickSearchResults,
	createVirtualQuickSearchResults,
	filterQuickSearchResults
} from '.';
import { emptyAdvancedFilters, filterAdvancedSearchResults } from './advanced';

type Entry = SaveFileSearchProjection['entries'][number];
const entry = (changes: Partial<Entry>): Entry => ({
	zone: 'box',
	box: 0,
	slot: 0,
	speciesName: 'Pikachu',
	nickname: 'Pikachu',
	form: 0,
	formName: 'Default',
	isShiny: false,
	legal: null,
	nature: 'Timid',
	ability: 'Static',
	heldItem: null,
	moves: ['Thunderbolt'],
	level: 5,
	ivs: [31, 31, 31, 31, 31, 31],
	evs: [0, 0, 0, 0, 0, 0],
	originGame: 'Emerald',
	...changes
});

function saveFileResults(entries: Entry[]) {
	return createSaveFileQuickSearchResults({
		saveFileId: 'save-1',
		saveFileName: 'emerald.sav',
		paneId: 'pane-save',
		projection: { entries, unavailable: [] }
	});
}

describe('Search', () => {
	it('keys virtual results by Record ID across placement changes', () => {
		const record = {
			recordId: 'stable-id',
			projection: { speciesName: 'Eevee', nickname: 'Eevee' },
			placement: { storageBoxId: 'box', slot: 1 }
		} as PokemonRecord;
		const before = createVirtualQuickSearchResults([record], 'storage-pane', 'all-pokemon');
		const after = createVirtualQuickSearchResults(
			[{ ...record, placement: null }],
			'storage-pane',
			'unfiled'
		);
		expect(before[0].id).toBe('stable-id');
		expect(after[0].id).toBe(before[0].id);
		expect(after[0].locationLabel).toBe('Unfiled');
		expect(after[0].facts).toMatchObject({ formName: null, legal: null, nature: null });
	});

	it('matches Save File species, nicknames, and visible Location labels', () => {
		const results = saveFileResults([
			entry({ zone: 'party', box: null, slot: 0, nickname: 'Sparky' }),
			entry({ box: 1, slot: 4, speciesName: 'Eevee', nickname: 'Eevee' })
		]);

		expect(filterQuickSearchResults(results, 'pikachu')).toMatchObject([
			{ saveFileName: 'emerald.sav', locationLabel: 'Party, Slot 1', slot: 0 }
		]);
		expect(filterQuickSearchResults(results, 'sparky')).toHaveLength(1);
		expect(filterQuickSearchResults(results, 'box 02')).toMatchObject([
			{ speciesName: 'Eevee', locationLabel: 'Box 02, Slot 5', box: 1, slot: 4 }
		]);
		expect(filterQuickSearchResults(results, '  ')).toEqual([]);
	});

	it('combines the Quick Search query with Advanced criteria', () => {
		const results = saveFileResults([
			entry({ slot: 0, nickname: 'Sparky', isShiny: true }),
			entry({ slot: 1, nickname: 'Volt', isShiny: true }),
			entry({ slot: 2, nickname: 'Plain' })
		]);
		const shiny = { ...emptyAdvancedFilters, shiny: 'shiny' as const };

		expect(filterAdvancedSearchResults(results, 'volt', shiny).map((r) => r.nickname)).toEqual([
			'Volt'
		]);
	});
});
