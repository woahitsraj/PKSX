import { describe, expect, it } from 'vitest';
import type { BoxSlotSummary, PartySlotSummary } from '$lib/engine';
import { createEmptyPokemonStorage, type StoredPokemonStoragePokemon } from '$lib/pksx/saves';
import {
	createPokemonStorageQuickSearchResults,
	createSaveFileQuickSearchResults,
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

describe('Quick Search', () => {
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
			collectionKey: 'save-1',
			collectionLabel: 'emerald.sav',
			paneId: 'pane-save',
			partySlots: party,
			boxSlots: boxes
		});

		expect(filterQuickSearchResults(results, 'pikachu')).toMatchObject([
			{ collectionLabel: 'emerald.sav', locationLabel: 'Party, Slot 1', slot: 0 }
		]);
		expect(filterQuickSearchResults(results, 'sparky')).toHaveLength(1);
		expect(filterQuickSearchResults(results, 'box 02')).toMatchObject([
			{ speciesName: 'Eevee', locationLabel: 'Box 02, Slot 5', box: 1, slot: 4 }
		]);
		expect(filterQuickSearchResults(results, '  ')).toEqual([]);
	});

	it('uses Pokemon Storage Box names and keeps exact result identity', () => {
		const storage = createEmptyPokemonStorage();
		storage.boxes[2]!.name = 'Favorites';
		storage.boxes[2]!.slots[7]!.pokemon = {
			label: 'Buddy',
			detail: 'Lv. 12',
			level: 12,
			experience: null,
			speciesId: 1,
			form: 0,
			isEgg: false,
			spriteIdentity: null,
			origin: {
				entryMode: 'imported',
				originSaveFileName: null,
				originGame: null,
				originalTrainer: null,
				trainerId: null,
				enteredAt: '2026-09-14T00:00:00.000Z'
			}
		} satisfies StoredPokemonStoragePokemon;

		const results = createPokemonStorageQuickSearchResults({
			paneId: 'pane-storage',
			storage,
			speciesNames: new Map([[1, 'Bulbasaur']])
		});

		expect(filterQuickSearchResults(results, 'favorites')).toEqual([
			expect.objectContaining({
				id: 'pokemon-storage:box:2:7',
				collectionLabel: 'Pokemon Storage',
				locationLabel: 'Favorites, Slot 8',
				speciesName: 'Bulbasaur',
				nickname: 'Buddy',
				paneId: 'pane-storage',
				zone: 'box',
				box: 2,
				slot: 7
			})
		]);
	});
});
