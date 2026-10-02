import { describe, expect, it } from 'vitest';
import type { BoxSlotSummary, PartySlotSummary } from '$lib/engine';
import type { PokemonRecord } from '$lib/pksx/pokemon-storage-catalog';
import {
	createSaveFileQuickSearchResults,
	createVirtualQuickSearchResults,
	filterQuickSearchResults
} from '.';

const slotProjection = {
	form: 0,
	format: 3,
	level: 5,
	experience: 125,
	experienceProjection: null,
	isEgg: false,
	isEmpty: false,
	gender: null,
	nature: null,
	ability: null,
	heldItem: null,
	heldItemSpriteIdentity: null,
	types: [],
	stats: [],
	moves: [],
	natureEditConstraints: {} as BoxSlotSummary['natureEditConstraints'],
	heldItemEditConstraints: {} as BoxSlotSummary['heldItemEditConstraints'],
	abilityEditConstraints: {} as BoxSlotSummary['abilityEditConstraints'],
	metDataEditConstraints: {} as BoxSlotSummary['metDataEditConstraints'],
	originalTrainerEditConstraints: {} as BoxSlotSummary['originalTrainerEditConstraints'],
	statEditConstraints: {} as BoxSlotSummary['statEditConstraints'],
	moveSetEditConstraints: {} as BoxSlotSummary['moveSetEditConstraints'],
	friendshipEditConstraints: {} as BoxSlotSummary['friendshipEditConstraints'],
	battleFields: [],
	spriteIdentity: {
		speciesId: 25,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'default' as const
	}
};

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
	});
	it('matches Save File species, nicknames, and visible Location labels', () => {
		const party = [
			{
				...slotProjection,
				slot: 0,
				speciesId: 25,
				speciesName: 'Pikachu',
				nickname: 'Sparky'
			}
		] satisfies PartySlotSummary[];
		const boxes = [
			{
				...slotProjection,
				box: 1,
				slot: 4,
				speciesId: 133,
				speciesName: 'Eevee',
				nickname: 'Eevee'
			}
		] satisfies BoxSlotSummary[];
		const results = createSaveFileQuickSearchResults({
			saveFileId: 'save-1',
			saveFileName: 'emerald.sav',
			paneId: 'pane-save',
			partySlots: party,
			boxSlots: boxes
		});

		expect(filterQuickSearchResults(results, 'pikachu')).toMatchObject([
			{ saveFileName: 'emerald.sav', locationLabel: 'Party, Slot 1', slot: 0 }
		]);
		expect(filterQuickSearchResults(results, 'sparky')).toHaveLength(1);
		expect(filterQuickSearchResults(results, 'box 02')).toMatchObject([
			{ speciesName: 'Eevee', locationLabel: 'Box 02, Slot 5', box: 1, slot: 4 }
		]);
		expect(filterQuickSearchResults(results, '  ')).toEqual([]);
	});
});
