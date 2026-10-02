import { describe, expect, it } from 'vitest';
import { emptyManifest, type PokemonRecord } from './types';
import {
	defaultVirtualViewPreferences,
	moveVirtualFocus,
	readVirtualViewPreferences,
	virtualRecords
} from './virtual-views';

const manifest = emptyManifest('storage', '2026-10-01', 'box');
const record = (id: string, createdAt: string, placement: PokemonRecord['placement']) =>
	({
		recordId: id,
		createdAt,
		placement,
		projection: { speciesName: id, nickname: id, level: 10, spriteIdentity: { isShiny: false } },
		origin: { originGame: 'Scarlet', entryMode: 'imported', originalTrainer: 'Rajan' }
	}) as PokemonRecord;
manifest.records = [
	record('old', '2026-10-01', { storageBoxId: 'box', slot: 0 }),
	record('new', '2026-10-03', null),
	record('overflow', '2026-10-02', { storageBoxId: 'missing', slot: 1 })
];

describe('virtual Pokemon views', () => {
	it('lists active records by entry time and treats unresolved placements as Unfiled', () => {
		expect(
			virtualRecords(manifest, defaultVirtualViewPreferences).map(({ recordId }) => recordId)
		).toEqual(['new', 'overflow', 'old']);
		expect(
			virtualRecords(manifest, { ...defaultVirtualViewPreferences, location: 'unfiled' }).map(
				({ recordId }) => recordId
			)
		).toEqual(['new']);
		const full = structuredClone(manifest);
		full.records.push(
			...Array.from({ length: 29 }, (_, index) =>
				record(`filled-${index}`, '2026-09-01', { storageBoxId: 'box', slot: index + 1 })
			)
		);
		expect(
			virtualRecords(full, { ...defaultVirtualViewPreferences, location: 'unfiled' }).map(
				({ recordId }) => recordId
			)
		).toEqual(['new', 'overflow']);
	});

	it('filters and restores preferences defensively', () => {
		const preferences = readVirtualViewPreferences(
			JSON.stringify({
				location: 'unfiled',
				sort: 'species',
				filters: { query: 'new', originGame: 'Scarlet' }
			})
		);
		expect(virtualRecords(manifest, preferences).map(({ recordId }) => recordId)).toEqual(['new']);
		expect(readVirtualViewPreferences('{broken')).toEqual(defaultVirtualViewPreferences);
	});

	it('moves focus with measured columns and clamps at the end', () => {
		expect(moveVirtualFocus(1, 8, 3, 'down')).toBe(4);
		expect(moveVirtualFocus(7, 8, 2, 'down')).toBe(7);
		expect(moveVirtualFocus(0, 8, 4, 'up')).toBe(0);
	});
});
