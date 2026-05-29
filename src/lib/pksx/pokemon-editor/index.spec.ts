import { describe, expect, it } from 'vitest';
import type { SlotView } from '$lib/components/pksx/types';
import {
	cancelPokemonEditor,
	createPokemonEditorState,
	markUnsupportedPokemonEditorApply,
	type PokemonEditorSource
} from '.';

const source: PokemonEditorSource = {
	owner: 'save-file',
	location: 'Box 1, slot 1'
};

const pokemonSlot: SlotView = {
	slot: 0,
	label: 'ARON',
	detail: 'Lv. 12',
	level: 12,
	speciesId: 304,
	form: 0,
	spriteIdentity: {
		speciesId: 304,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'default'
	},
	isEgg: false,
	kind: 'pokemon'
};

const emptySlot: SlotView = {
	slot: 1,
	label: 'Empty',
	detail: '',
	level: null,
	speciesId: null,
	form: null,
	spriteIdentity: null,
	isEgg: false,
	kind: 'empty'
};

describe('Pokemon editor state', () => {
	it('opens for an occupied Slot with source ownership context', () => {
		const result = createPokemonEditorState(source, pokemonSlot);

		expect(result).toEqual({
			ok: true,
			state: {
				source,
				slot: pokemonSlot,
				staged: false,
				unsupportedReason: null
			}
		});
	});

	it('rejects empty Slots', () => {
		expect(createPokemonEditorState(source, emptySlot)).toEqual({
			ok: false,
			reason: 'Pokemon Editor requires an occupied Slot.'
		});
	});

	it('keeps cancel non-mutating', () => {
		const opened = createPokemonEditorState(source, pokemonSlot);
		if (!opened.ok) throw new Error('Expected Pokemon Editor to open.');

		const marked = markUnsupportedPokemonEditorApply(opened.state);

		expect(cancelPokemonEditor(marked)).toEqual({
			...opened.state,
			staged: false,
			unsupportedReason: null
		});
	});

	it('records unsupported apply feedback without staging a mutation', () => {
		const opened = createPokemonEditorState(
			{ owner: 'pokemon-storage', location: 'Storage Box 1, slot 1' },
			pokemonSlot
		);
		if (!opened.ok) throw new Error('Expected Pokemon Editor to open.');

		expect(markUnsupportedPokemonEditorApply(opened.state)).toMatchObject({
			source: { owner: 'pokemon-storage' },
			staged: false,
			unsupportedReason: 'Engine-backed Pokemon editing is not available yet.'
		});
	});
});
