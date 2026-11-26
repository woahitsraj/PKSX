import type { SearchCriterion } from '$lib/engine';
import { filterQuickSearchResults, type QuickSearchResult } from '.';

/** Engine-supplied facts; null means the collection did not supply the value. */
export type SearchFacts = {
	formName: string | null;
	isShiny: boolean;
	legal: boolean | null;
	nature: string | null;
	ability: string | null;
	heldItem: string | null;
	moves: string[];
	level: number | null;
	ivs: (number | null)[];
	evs: (number | null)[];
	originGame: string | null;
};

export type SearchMode = 'quick' | 'advanced';
export type MatchMode = 'all' | 'any';
export type UnavailableCriteria = Partial<Record<SearchCriterion, string>>;

export type AdvancedFilters = {
	match: MatchMode;
	species: string;
	form: string;
	shiny: '' | 'shiny' | 'not-shiny';
	legality: '' | 'legal' | 'illegal';
	nature: string;
	ability: string;
	heldItem: string;
	moves: string[];
	moveMatch: MatchMode;
	minLevel: number | null;
	maxLevel: number | null;
	ivFloor: number | null;
	ivMatch: MatchMode;
	evFloor: number | null;
	evMatch: MatchMode;
	originGame: string;
};

export const emptyAdvancedFilters: AdvancedFilters = {
	match: 'all',
	species: '',
	form: '',
	shiny: '',
	legality: '',
	nature: '',
	ability: '',
	heldItem: '',
	moves: [],
	moveMatch: 'all',
	minLevel: null,
	maxLevel: null,
	ivFloor: null,
	ivMatch: 'all',
	evFloor: null,
	evMatch: 'all',
	originGame: ''
};

type Predicate = (facts: SearchFacts, result: QuickSearchResult) => boolean;

const valueCriteria = ['form', 'nature', 'ability', 'heldItem', 'originGame'] as const;
const factKey = {
	form: 'formName',
	nature: 'nature',
	ability: 'ability',
	heldItem: 'heldItem',
	originGame: 'originGame'
} as const;

/** Clears values that the loaded collection cannot supply. */
export function sanitizeAdvancedFilters(
	filters: AdvancedFilters,
	unavailable: UnavailableCriteria
): AdvancedFilters {
	const next = { ...filters };
	for (const criterion of valueCriteria) if (unavailable[criterion]) next[criterion] = '';
	if (unavailable.legality) next.legality = '';
	return next;
}

function predicates(filters: AdvancedFilters): Predicate[] {
	const list: Predicate[] = [];
	if (filters.species) list.push((_, result) => result.speciesName === filters.species);
	for (const criterion of valueCriteria) {
		const value = filters[criterion];
		if (value) list.push((facts) => facts[factKey[criterion]] === value);
	}
	if (filters.shiny) list.push((facts) => facts.isShiny === (filters.shiny === 'shiny'));
	if (filters.legality)
		list.push((facts) => facts.legal !== null && facts.legal === (filters.legality === 'legal'));
	if (filters.moves.length > 0) {
		const has = (move: string, facts: SearchFacts) => facts.moves.includes(move);
		list.push((facts) =>
			filters.moveMatch === 'all'
				? filters.moves.every((move) => has(move, facts))
				: filters.moves.some((move) => has(move, facts))
		);
	}
	if (filters.minLevel !== null || filters.maxLevel !== null) {
		list.push(
			({ level }) =>
				level !== null &&
				(filters.minLevel === null || level >= filters.minLevel) &&
				(filters.maxLevel === null || level <= filters.maxLevel)
		);
	}
	const floor = (values: (number | null)[], min: number, match: MatchMode) => {
		const meets = (value: number | null) => value !== null && value >= min;
		return values.length > 0 && (match === 'all' ? values.every(meets) : values.some(meets));
	};
	if (filters.ivFloor !== null) {
		const min = filters.ivFloor;
		list.push((facts) => floor(facts.ivs, min, filters.ivMatch));
	}
	if (filters.evFloor !== null) {
		const min = filters.evFloor;
		list.push((facts) => floor(facts.evs, min, filters.evMatch));
	}
	return list;
}

export function hasAdvancedCriteria(filters: AdvancedFilters) {
	return predicates(filters).length > 0;
}

export function filterAdvancedSearchResults(
	results: QuickSearchResult[],
	query: string,
	filters: AdvancedFilters
): QuickSearchResult[] {
	const active = predicates(filters);
	const queried = query.trim() ? filterQuickSearchResults(results, query) : results;
	if (active.length === 0) return query.trim() ? queried : [];
	return queried.filter((result) =>
		filters.match === 'all'
			? active.every((test) => test(result.facts, result))
			: active.some((test) => test(result.facts, result))
	);
}

export type AdvancedSearchOptions = Record<
	'species' | 'form' | 'nature' | 'ability' | 'heldItem' | 'moves' | 'originGame',
	string[]
>;

/** Lists the values present in the loaded collection. */
export function advancedSearchOptions(results: QuickSearchResult[]): AdvancedSearchOptions {
	const collect = (values: (string | null)[]) =>
		[...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
			a.localeCompare(b)
		);
	return {
		species: collect(results.map((result) => result.speciesName)),
		form: collect(results.map(({ facts }) => facts.formName)),
		nature: collect(results.map(({ facts }) => facts.nature)),
		ability: collect(results.map(({ facts }) => facts.ability)),
		heldItem: collect(results.map(({ facts }) => facts.heldItem)),
		moves: collect(results.flatMap(({ facts }) => facts.moves)),
		originGame: collect(results.map(({ facts }) => facts.originGame))
	};
}
