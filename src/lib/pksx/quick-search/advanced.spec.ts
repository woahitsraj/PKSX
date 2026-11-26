import { describe, expect, it } from 'vitest';
import type { QuickSearchResult } from '.';
import {
	advancedSearchOptions,
	emptyAdvancedFilters,
	filterAdvancedSearchResults,
	hasAdvancedCriteria,
	sanitizeAdvancedFilters,
	type AdvancedFilters,
	type SearchFacts
} from './advanced';

const facts: SearchFacts = {
	formName: 'Default',
	isShiny: false,
	legal: true,
	nature: 'Adamant',
	ability: 'Guts',
	heldItem: null,
	moves: ['Tackle'],
	level: 10,
	ivs: [10, 10, 10, 10, 10, 10],
	evs: [0, 0, 0, 0, 0, 0],
	originGame: 'Emerald'
};

function result(id: string, speciesName: string, changes: Partial<SearchFacts>): QuickSearchResult {
	return {
		id,
		saveFileId: 'save',
		saveFileName: 'save.sav',
		paneId: 'pane',
		speciesName,
		nickname: speciesName,
		locationLabel: `Box 01, Slot ${id}`,
		zone: 'box',
		box: 0,
		slot: Number(id) - 1,
		facts: { ...facts, ...changes }
	};
}

const results = [
	result('1', 'Aron', { isShiny: true, moves: ['Tackle', 'Headbutt'], level: 20 }),
	result('2', 'Aron', { legal: false, heldItem: 'Oran Berry', ivs: [31, 0, 0, 0, 0, 0] }),
	result('3', 'Zigzagoon', { nature: 'Jolly', moves: ['Headbutt'], level: 40 }),
	result('4', 'Wurmple', { legal: null, nature: null, ivs: [], evs: [] })
];
const ids = (filters: Partial<AdvancedFilters>, query = '') =>
	filterAdvancedSearchResults(results, query, { ...emptyAdvancedFilters, ...filters }).map(
		({ id }) => id
	);

describe('Advanced Search', () => {
	it('shows nothing until a criterion or query is set', () => {
		expect(hasAdvancedCriteria(emptyAdvancedFilters)).toBe(false);
		expect(ids({})).toEqual([]);
		expect(ids({}, 'aron')).toEqual(['1', '2']);
	});

	it('combines criteria with explicit all and any semantics', () => {
		expect(ids({ species: 'Aron', shiny: 'shiny' })).toEqual(['1']);
		expect(ids({ match: 'any', species: 'Zigzagoon', shiny: 'shiny' })).toEqual(['1', '3']);
		expect(ids({ moves: ['Tackle', 'Headbutt'], moveMatch: 'all' })).toEqual(['1']);
		expect(ids({ moves: ['Tackle', 'Headbutt'], moveMatch: 'any' })).toEqual(['1', '2', '3', '4']);
		expect(ids({ minLevel: 15, maxLevel: 30 })).toEqual(['1']);
		expect(ids({ ivFloor: 31, ivMatch: 'any' })).toEqual(['2']);
		expect(ids({ ivFloor: 10, ivMatch: 'all' })).toEqual(['1', '3']);
		expect(ids({ heldItem: 'Oran Berry', legality: 'illegal' })).toEqual(['2']);
	});

	it('never treats missing facts as a match', () => {
		expect(ids({ legality: 'legal' })).toEqual(['1', '3']);
		expect(ids({ nature: 'Adamant' })).toEqual(['1', '2']);
		expect(ids({ ivFloor: 0 })).toEqual(['1', '2', '3']);
		expect(ids({ evFloor: 0, evMatch: 'any' })).toEqual(['1', '2', '3']);
	});

	it('returns no results when nothing matches', () => {
		expect(ids({ species: 'Aron', nature: 'Jolly' })).toEqual([]);
	});

	it('clears unavailable criteria and keeps valid values', () => {
		const filters = { ...emptyAdvancedFilters, form: 'Default', legality: 'legal' as const };
		expect(
			sanitizeAdvancedFilters(
				{ ...filters, species: 'Aron', moves: ['Tackle'] },
				{ form: 'No form names.', legality: 'No legality.' }
			)
		).toEqual({ ...emptyAdvancedFilters, species: 'Aron', moves: ['Tackle'] });
	});

	it('offers only values the loaded collection supplies', () => {
		expect(advancedSearchOptions(results)).toMatchObject({
			species: ['Aron', 'Wurmple', 'Zigzagoon'],
			nature: ['Adamant', 'Jolly'],
			heldItem: ['Oran Berry'],
			moves: ['Headbutt', 'Tackle']
		});
	});
});
