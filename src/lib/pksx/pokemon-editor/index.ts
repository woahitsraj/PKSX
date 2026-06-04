import type { SaveSlotRef } from '$lib/engine';
import type { SlotView } from '$lib/components/pksx/types';

export type PokemonEditorOwner = 'save-file' | 'pokemon-storage';

export type PokemonEditorSourceIdentity = {
	key: string;
};

export type SaveFilePokemonEditorSource = {
	owner: 'save-file';
	saveFileId: string | null;
	slotRef: SaveSlotRef;
	location: string;
	identity: PokemonEditorSourceIdentity;
};

export type PokemonStorageEditorSource = {
	owner: 'pokemon-storage';
	storagePokemonId: string;
	location: string;
	identity: PokemonEditorSourceIdentity;
};

export type PokemonEditorSource = SaveFilePokemonEditorSource | PokemonStorageEditorSource;
export type PokemonEditorSourceInput =
	| (Omit<SaveFilePokemonEditorSource, 'identity'> & {
			identity?: PokemonEditorSourceIdentity;
	  })
	| (Omit<PokemonStorageEditorSource, 'identity'> & {
			identity?: PokemonEditorSourceIdentity;
	  });

export type StagedPokemonEdit = {
	id: string;
	capability: string;
	label: string;
	payload?: unknown;
};

export type PokemonEditorApplyOutcome =
	| {
			status: 'idle';
			message: string | null;
	  }
	| {
			status: 'noop';
			message: string;
	  }
	| {
			status: 'success';
			message: string;
	  }
	| {
			status: 'rejected' | 'unsupported' | 'failed';
			message: string;
			reason?: string;
	  };

export type PokemonEditorState = {
	source: PokemonEditorSource;
	slot: SlotView;
	stagedEdits: StagedPokemonEdit[];
	staged: boolean;
	applyOutcome: PokemonEditorApplyOutcome;
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

export type PokemonEditValidationResult =
	| {
			ok: true;
	  }
	| {
			ok: false;
			status: 'rejected' | 'unsupported' | 'failed';
			message: string;
			reason?: string;
	  };

export type PokemonEditorMutationResult =
	| {
			ok: true;
			slot: SlotView;
			message?: string;
	  }
	| {
			ok: false;
			status: 'rejected' | 'unsupported' | 'failed';
			message: string;
			reason?: string;
	  };

export type PokemonEditorSourceVerification =
	| {
			ok: true;
	  }
	| {
			ok: false;
			message?: string;
	  };

export type PokemonEditorApplyServices = {
	verifySource?: (state: PokemonEditorState) => Promise<PokemonEditorSourceVerification>;
	validate: (state: PokemonEditorState) => Promise<PokemonEditValidationResult>;
	ensureSaveFileBackup?: (state: PokemonEditorState) => Promise<PokemonEditValidationResult>;
	mutateSaveFilePokemon?: (state: PokemonEditorState) => Promise<PokemonEditorMutationResult>;
	mutateStoragePokemon?: (state: PokemonEditorState) => Promise<PokemonEditorMutationResult>;
};

export type PokemonEditorApplyResult = {
	state: PokemonEditorState;
	outcome: PokemonEditorApplyOutcome;
};

export function createPokemonEditorSourceIdentity(slot: SlotView): PokemonEditorSourceIdentity {
	const sprite = slot.spriteIdentity
		? [
				slot.spriteIdentity.speciesId,
				slot.spriteIdentity.form,
				slot.spriteIdentity.isEgg ? 'egg' : 'not-egg',
				slot.spriteIdentity.isShiny ? 'shiny' : 'normal',
				slot.spriteIdentity.displaySex
			].join(':')
		: 'no-sprite';

	return {
		key: [
			slot.kind,
			slot.slot,
			slot.speciesId ?? 'unknown',
			slot.form ?? 'unknown',
			slot.label,
			sprite
		].join('|')
	};
}

export function createPokemonEditorState(
	source: PokemonEditorSourceInput,
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
		state: withStagedEdits({
			source: {
				...source,
				identity: source.identity ?? createPokemonEditorSourceIdentity(slot)
			} as PokemonEditorSource,
			slot,
			stagedEdits: [],
			staged: false,
			applyOutcome: { status: 'idle', message: null },
			unsupportedReason: null
		})
	};
}

export function stagePokemonEditorEdit(
	state: PokemonEditorState,
	edit: StagedPokemonEdit
): PokemonEditorState {
	const stagedEdits = [...state.stagedEdits.filter((existing) => existing.id !== edit.id), edit];
	return withStagedEdits({
		...state,
		stagedEdits,
		applyOutcome: { status: 'idle', message: null },
		unsupportedReason: null
	});
}

export function cancelPokemonEditor(state: PokemonEditorState): PokemonEditorState {
	return withStagedEdits({
		...state,
		stagedEdits: [],
		applyOutcome: { status: 'idle', message: null },
		unsupportedReason: null
	});
}

export function markUnsupportedPokemonEditorApply(
	state: PokemonEditorState,
	reason = 'Engine-backed Pokemon editing is not available yet.'
): PokemonEditorState {
	return withApplyOutcome(state, {
		status: 'unsupported',
		message: reason,
		reason: 'engine-unavailable'
	});
}

export function isSamePokemonEditorSourceIdentity(
	state: PokemonEditorState,
	slot: SlotView | null
): boolean {
	if (!slot || slot.kind !== 'pokemon') {
		return false;
	}

	return state.source.identity.key === createPokemonEditorSourceIdentity(slot).key;
}

export async function applyPokemonEditorEdits(
	state: PokemonEditorState,
	services: PokemonEditorApplyServices
): Promise<PokemonEditorApplyResult> {
	if (state.stagedEdits.length === 0) {
		return completeApply(state, {
			status: 'noop',
			message: 'No Pokemon edits are staged.'
		});
	}

	const sourceVerification = await services.verifySource?.(state);
	if (sourceVerification && !sourceVerification.ok) {
		return completeApply(state, {
			status: 'failed',
			message: sourceVerification.message ?? 'Pokemon Editor source changed before Apply.',
			reason: 'stale-source'
		});
	}

	const validation = await services.validate(state);
	if (!validation.ok) {
		return completeApply(state, outcomeFromValidation(validation));
	}

	if (state.source.owner === 'save-file') {
		const backup = await services.ensureSaveFileBackup?.(state);
		if (backup && !backup.ok) {
			return completeApply(state, outcomeFromValidation(backup));
		}

		const mutation = services.mutateSaveFilePokemon
			? await services.mutateSaveFilePokemon(state)
			: {
					ok: false as const,
					status: 'unsupported' as const,
					message: 'Save File Pokemon editing is not available yet.',
					reason: 'engine-unavailable'
				};

		return completeMutation(state, mutation);
	}

	const mutation = services.mutateStoragePokemon
		? await services.mutateStoragePokemon(state)
		: {
				ok: false as const,
				status: 'unsupported' as const,
				message: 'Pokemon Storage editing is not available yet.',
				reason: 'storage-unavailable'
			};

	return completeMutation(state, mutation);
}

function completeMutation(
	state: PokemonEditorState,
	mutation: PokemonEditorMutationResult
): PokemonEditorApplyResult {
	if (!mutation.ok) {
		return completeApply(state, outcomeFromMutation(mutation));
	}

	return completeApply(
		withStagedEdits({
			...state,
			slot: mutation.slot,
			source: {
				...state.source,
				identity: createPokemonEditorSourceIdentity(mutation.slot)
			},
			stagedEdits: []
		}),
		{
			status: 'success',
			message: mutation.message ?? 'Pokemon edits applied.'
		}
	);
}

function outcomeFromValidation(
	validation: Extract<PokemonEditValidationResult, { ok: false }>
): Exclude<PokemonEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> {
	const outcome: Exclude<PokemonEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> = {
		status: validation.status,
		message: validation.message
	};
	if (validation.reason) outcome.reason = validation.reason;
	return outcome;
}

function outcomeFromMutation(
	mutation: Extract<PokemonEditorMutationResult, { ok: false }>
): Exclude<PokemonEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> {
	const outcome: Exclude<PokemonEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> = {
		status: mutation.status,
		message: mutation.message
	};
	if (mutation.reason) outcome.reason = mutation.reason;
	return outcome;
}

function completeApply(
	state: PokemonEditorState,
	outcome: Exclude<PokemonEditorApplyOutcome, { status: 'idle' }>
): PokemonEditorApplyResult {
	const nextState = withApplyOutcome(state, outcome);
	return {
		state: nextState,
		outcome: nextState.applyOutcome
	};
}

function withApplyOutcome(
	state: PokemonEditorState,
	outcome: PokemonEditorApplyOutcome
): PokemonEditorState {
	return {
		...withStagedEdits(state),
		applyOutcome: outcome,
		unsupportedReason: outcome.status === 'unsupported' ? outcome.message : null
	};
}

function withStagedEdits(state: PokemonEditorState): PokemonEditorState {
	return {
		...state,
		staged: state.stagedEdits.length > 0
	};
}
