import type { SlotView } from '$lib/components/pksx/types';

export type PokemonEditorOwner = 'save-file' | 'pokemon-storage';

export type PokemonEditorSource = {
	owner: PokemonEditorOwner;
	location: string;
};

export type PokemonEditorState = {
	source: PokemonEditorSource;
	slot: SlotView;
	staged: boolean;
	unsupportedReason: string | null;
};

export type PokemonEditorEntryResult =
	| {
			ok: true;
			state: PokemonEditorState;
	  }
	| {
			ok: false;
			reason: string;
	  };

export function createPokemonEditorState(
	source: PokemonEditorSource,
	slot: SlotView
): PokemonEditorEntryResult {
	if (slot.kind !== 'pokemon') {
		return {
			ok: false,
			reason: 'Pokemon Editor requires an occupied Slot.'
		};
	}

	return {
		ok: true,
		state: {
			source,
			slot,
			staged: false,
			unsupportedReason: null
		}
	};
}

export function cancelPokemonEditor(state: PokemonEditorState): PokemonEditorState {
	return {
		...state,
		staged: false,
		unsupportedReason: null
	};
}

export function markUnsupportedPokemonEditorApply(
	state: PokemonEditorState,
	reason = 'Engine-backed Pokemon editing is not available yet.'
): PokemonEditorState {
	return {
		...state,
		unsupportedReason: reason
	};
}
