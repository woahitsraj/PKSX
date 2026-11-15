import { describe, expect, it } from 'vitest';
import type { SlotView } from '$lib/components/pksx/types';
import { createSlotMenuCommands } from '.';

const empty: SlotView = {
	slot: 0,
	label: 'Empty',
	detail: '',
	level: null,
	experience: null,
	experienceProjection: null,
	speciesId: null,
	form: null,
	isEgg: false,
	spriteIdentity: null,
	kind: 'empty'
};

const occupied = { ...empty, label: 'Pikachu', speciesId: 25, kind: 'pokemon' } satisfies SlotView;
const noDynamicActions = { edit: true, legality: true, evolve: false, trade: false };

describe('Slot Menu commands', () => {
	it('shows only Create Pokemon for a supported empty Slot', () => {
		expect(createSlotMenuCommands(empty, null, noDynamicActions).map(({ label }) => label)).toEqual(
			['Create Pokemon']
		);
	});

	it('hides every unavailable command', () => {
		expect(
			createSlotMenuCommands(empty, 'Pokemon Storage is unsupported.', noDynamicActions)
		).toEqual([]);
		expect(
			createSlotMenuCommands(occupied, null, {
				edit: false,
				legality: false,
				evolve: false,
				trade: false
			}).map(({ label }) => label)
		).toEqual(['Move', 'Copy', 'Clear Slot']);
	});

	it('adds Trade with Switch only when the caller allows it', () => {
		expect(
			createSlotMenuCommands(occupied, null, { ...noDynamicActions, trade: true }).at(-1)?.label
		).toBe('Trade with Switch');
	});

	it('adds Evolve only after the engine reports a direct evolution', () => {
		expect(
			createSlotMenuCommands(occupied, null, { ...noDynamicActions, evolve: true }).map(
				({ label }) => label
			)
		).toContain('Evolve');
	});
});

it('offers explicit Storage transfers only for an occupied Save File Slot', () => {
	const saveStorage = { ...noDynamicActions, saveStorage: true };
	const labels = createSlotMenuCommands(occupied, null, saveStorage).map(
		(command) => command.label
	);
	expect(labels).toEqual(expect.arrayContaining(['Copy to Storage', 'Move to Storage']));
	expect(createSlotMenuCommands(empty, null, saveStorage).map((command) => command.label)).toEqual([
		'Create Pokemon'
	]);
	expect(
		createSlotMenuCommands(occupied, null, { ...noDynamicActions, storage: true }).map(
			(command) => command.label
		)
	).not.toContain('Copy to Storage');
});
