import { describe, expect, it } from 'vitest';

import type { BoxSlotSummary } from '$lib/engine';
import {
	briefToolbarStatus,
	createPartySlotViews,
	createSlotView,
	keyboardAction,
	pokemonEditSuccessMessage
} from './index';

const occupiedSlot: BoxSlotSummary = {
	box: 0,
	slot: 2,
	speciesId: 304,
	form: 0,
	format: 3,
	level: 11,
	experience: 1331,
	experienceProjection: null,
	nickname: 'ARON',
	isEgg: false,
	isEmpty: false,
	types: [],
	stats: [],
	moves: [],
	statEditConstraints: {
		supported: false,
		minIv: 0,
		maxIv: 31,
		minEv: 0,
		maxEv: 255,
		maxTotalEv: 510
	},
	moveSetEditConstraints: { supported: false, maxMoveSlots: 4, availableMoves: [] },
	spriteIdentity: {
		speciesId: 304,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'default'
	}
};

describe('box shell helpers', () => {
	it('normalizes keyboard input into Navigation Actions', () => {
		expect.assertions(2);

		expect(keyboardAction({ key: 'PageDown' })).toBe('nextBox');
		expect(keyboardAction({ key: 'Y' })).toBe('sourceAction');
	});

	it('creates occupied, empty, and padded party Slot views', () => {
		expect.assertions(5);

		expect(createSlotView(occupiedSlot)).toMatchObject({
			slot: 2,
			label: 'ARON',
			detail: 'Lv. 11',
			kind: 'pokemon'
		});
		expect(createSlotView({ ...occupiedSlot, isEmpty: true })).toMatchObject({
			label: 'Empty',
			level: null,
			kind: 'empty'
		});
		const party = createPartySlotViews([occupiedSlot]);
		expect(party).toHaveLength(6);
		expect(party[0]?.label).toBe('ARON');
		expect(party[5]?.kind).toBe('empty');
	});

	it('summarizes editor and toolbar outcomes', () => {
		expect.assertions(4);

		expect(pokemonEditSuccessMessage({ source: { zone: 'party', slot: 0 } }, false)).toBe(
			'No Pokemon change made.'
		);
		expect(
			pokemonEditSuccessMessage({ source: { zone: 'party', slot: 0 }, nickname: 'RON' }, true)
		).toBe('Pokemon nickname updated.');
		expect(briefToolbarStatus('Creating Backup...', 'save-file')).toBe('Backing up');
		expect(briefToolbarStatus('Idle', 'pokemon-storage')).toBe('Storage ready');
	});
});
