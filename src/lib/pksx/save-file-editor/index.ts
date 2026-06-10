import type { SaveFileEditOperation, SaveSummary, SaveWorkspace } from '$lib/engine';

export type SaveFileEditorSourceIdentity = {
	key: string;
};

export type SaveFileEditorSource = {
	saveFileId: string | null;
	fileName: string | null;
	identity: SaveFileEditorSourceIdentity;
};

export type SaveFileEditorSourceInput = Omit<SaveFileEditorSource, 'identity'> & {
	identity?: SaveFileEditorSourceIdentity;
};

export type SaveFileEditableProjection = {
	trainerProfile: {
		trainerName: string | null;
		trainerId: number;
		gameVersion: string;
		generation: number;
	};
	money: {
		value: number | null;
		supported: boolean;
		unsupportedReason: string | null;
	};
	inventory: {
		supported: boolean;
		unsupportedReason: string | null;
	};
};

export type SaveFileCommittedWorkspaceState = {
	dirty: boolean;
	automaticBackupCreated: boolean;
};

export type StagedSaveFileEdit = {
	id: string;
	field: 'trainer-profile' | 'money' | 'inventory';
	label: string;
	payload?: unknown;
};

export type SaveFileEditorApplyOutcome =
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

export type SaveFileEditorState = {
	source: SaveFileEditorSource;
	projection: SaveFileEditableProjection;
	stagedEdits: StagedSaveFileEdit[];
	staged: boolean;
	committedWorkspace: SaveFileCommittedWorkspaceState;
	applyOutcome: SaveFileEditorApplyOutcome;
	unsupportedReason: string | null;
};

export type SaveFileEditorEntryResult =
	| {
			ok: true;
			state: SaveFileEditorState;
	  }
	| {
			ok: false;
			reason: string;
	  };

export type SaveFileEditValidationResult =
	| {
			ok: true;
	  }
	| {
			ok: false;
			status: 'rejected' | 'unsupported' | 'failed';
			message: string;
			reason?: string;
	  };

export type SaveFileEditOperationBuildResult =
	| {
			ok: true;
			operation: SaveFileEditOperation;
	  }
	| Extract<SaveFileEditValidationResult, { ok: false }>;

export type SaveFileEditorMutationResult =
	| {
			ok: true;
			bytes: Uint8Array;
			workspace: SaveWorkspace;
			mutated: boolean;
			projection?: SaveFileEditableProjection;
			committedWorkspace?: SaveFileCommittedWorkspaceState;
			message?: string;
	  }
	| {
			ok: false;
			status: 'rejected' | 'unsupported' | 'failed';
			message: string;
			reason?: string;
	  };

export type SaveFileEditorSourceVerification =
	| {
			ok: true;
	  }
	| {
			ok: false;
			message?: string;
	  };

export type SaveFileEditorApplyServices = {
	verifySource?: (state: SaveFileEditorState) => Promise<SaveFileEditorSourceVerification>;
	validate: (state: SaveFileEditorState) => Promise<SaveFileEditValidationResult>;
	ensureBackup: (state: SaveFileEditorState) => Promise<
		SaveFileEditValidationResult & {
			committedWorkspace?: SaveFileCommittedWorkspaceState;
		}
	>;
	mutateSaveFile: (state: SaveFileEditorState) => Promise<SaveFileEditorMutationResult>;
};

export type SaveFileEditorApplyResult = {
	state: SaveFileEditorState;
	outcome: SaveFileEditorApplyOutcome;
};

export function createSaveFileEditorSourceIdentity(
	summary: SaveSummary
): SaveFileEditorSourceIdentity {
	return {
		key: [
			summary.saveType,
			summary.gameVersion,
			summary.gameVersionId,
			summary.generation,
			summary.trainerName ?? '',
			summary.trainerId,
			summary.partyCount,
			summary.boxCount,
			summary.boxSlotCount
		].join('|')
	};
}

export function createSaveFileProjection(summary: SaveSummary): SaveFileEditableProjection {
	return {
		trainerProfile: {
			trainerName: summary.trainerName ?? null,
			trainerId: summary.trainerId,
			gameVersion: summary.gameVersion,
			generation: summary.generation
		},
		money: {
			value: null,
			supported: false,
			unsupportedReason: 'Money projection is not available from the PKHeX Engine yet.'
		},
		inventory: {
			supported: false,
			unsupportedReason: 'Inventory projection is not available from the PKHeX Engine yet.'
		}
	};
}

export function createSaveFileEditorState(
	source: SaveFileEditorSourceInput,
	summary: SaveSummary,
	committedWorkspace: SaveFileCommittedWorkspaceState
): SaveFileEditorEntryResult {
	return {
		ok: true,
		state: withStagedEdits({
			source: {
				...source,
				identity: source.identity ?? createSaveFileEditorSourceIdentity(summary)
			},
			projection: createSaveFileProjection(summary),
			stagedEdits: [],
			staged: false,
			committedWorkspace,
			applyOutcome: { status: 'idle', message: null },
			unsupportedReason: null
		})
	};
}

export function stageSaveFileEditorEdit(
	state: SaveFileEditorState,
	edit: StagedSaveFileEdit
): SaveFileEditorState {
	const stagedEdits = [...state.stagedEdits.filter((existing) => existing.id !== edit.id), edit];
	return withStagedEdits({
		...state,
		stagedEdits,
		applyOutcome: { status: 'idle', message: null },
		unsupportedReason: null
	});
}

export function stageTrainerNameEdit(
	state: SaveFileEditorState,
	trainerName: string
): SaveFileEditorState {
	const normalized = trainerName.trim();
	if (normalized === (state.projection.trainerProfile.trainerName ?? '')) {
		return removeSaveFileEditorEdit(state, 'trainer-name');
	}

	if (normalized.length === 0) {
		return withApplyOutcome(removeSaveFileEditorEdit(state, 'trainer-name'), {
			status: 'rejected',
			message: 'Trainer name cannot be empty.',
			reason: 'invalid-save-file-edit'
		});
	}

	return stageSaveFileEditorEdit(state, {
		id: 'trainer-name',
		field: 'trainer-profile',
		label: 'Set trainer name',
		payload: { trainerName: normalized }
	});
}

export function cancelSaveFileEditor(state: SaveFileEditorState): SaveFileEditorState {
	return withStagedEdits({
		...state,
		stagedEdits: [],
		applyOutcome: { status: 'idle', message: null },
		unsupportedReason: null
	});
}

export function createSaveFileEditOperation(
	state: SaveFileEditorState
): SaveFileEditOperationBuildResult {
	if (state.stagedEdits.length === 0) {
		return {
			ok: false,
			status: 'unsupported',
			message: 'No supported Save File edits are staged.',
			reason: 'unsupported-save-file-edit'
		};
	}

	const operation: SaveFileEditOperation = {};

	for (const edit of state.stagedEdits) {
		if (edit.id === 'trainer-name') {
			if (!isTrainerNamePayload(edit.payload)) {
				return {
					ok: false,
					status: 'rejected',
					message: 'Trainer name edit payload is invalid.',
					reason: 'invalid-save-file-edit'
				};
			}

			operation.trainerProfile = {
				...operation.trainerProfile,
				trainerName: edit.payload.trainerName
			};
			continue;
		}

		if (edit.id === 'money') {
			if (!isMoneyPayload(edit.payload)) {
				return {
					ok: false,
					status: 'rejected',
					message: 'Money edit payload is invalid.',
					reason: 'invalid-save-file-edit'
				};
			}

			operation.money = edit.payload.money;
			continue;
		}

		return {
			ok: false,
			status: 'unsupported',
			message: `${edit.label} is not supported by the Save File edit contract yet.`,
			reason: 'unsupported-save-file-edit'
		};
	}

	return {
		ok: true,
		operation
	};
}

export function isSameSaveFileEditorSourceIdentity(
	state: SaveFileEditorState,
	summary: SaveSummary | null
): boolean {
	return (
		summary !== null &&
		state.source.identity.key === createSaveFileEditorSourceIdentity(summary).key
	);
}

export async function applySaveFileEditorEdits(
	state: SaveFileEditorState,
	services: SaveFileEditorApplyServices
): Promise<SaveFileEditorApplyResult> {
	if (state.stagedEdits.length === 0) {
		return completeApply(state, {
			status: 'noop',
			message: 'No Save File edits are staged.'
		});
	}

	const sourceVerification = await services.verifySource?.(state);
	if (sourceVerification && !sourceVerification.ok) {
		return completeApply(state, {
			status: 'failed',
			message: sourceVerification.message ?? 'Save File Editor source changed before Apply.',
			reason: 'stale-source'
		});
	}

	const validation = await services.validate(state);
	if (!validation.ok) {
		return completeApply(state, outcomeFromValidation(validation));
	}

	const backup = await services.ensureBackup(state);
	if (!backup.ok) {
		return completeApply(state, outcomeFromValidation(backup));
	}

	const backedUpState = backup.committedWorkspace
		? { ...state, committedWorkspace: backup.committedWorkspace }
		: state;
	const mutation = await services.mutateSaveFile(backedUpState);
	return completeMutation(backedUpState, mutation);
}

function removeSaveFileEditorEdit(state: SaveFileEditorState, editId: string): SaveFileEditorState {
	return withStagedEdits({
		...state,
		stagedEdits: state.stagedEdits.filter((existing) => existing.id !== editId)
	});
}

function completeMutation(
	state: SaveFileEditorState,
	mutation: SaveFileEditorMutationResult
): SaveFileEditorApplyResult {
	if (!mutation.ok) {
		return completeApply(state, outcomeFromMutation(mutation));
	}

	return completeApply(
		withStagedEdits({
			...state,
			projection: mutation.projection ?? createSaveFileProjection(mutation.workspace.summary),
			source: {
				...state.source,
				identity: createSaveFileEditorSourceIdentity(mutation.workspace.summary)
			},
			stagedEdits: [],
			committedWorkspace: mutation.committedWorkspace ?? {
				...state.committedWorkspace,
				dirty: state.committedWorkspace.dirty || mutation.mutated
			}
		}),
		{
			status: 'success',
			message: mutation.message ?? 'Save File edits applied.'
		}
	);
}

function outcomeFromValidation(
	validation: Extract<SaveFileEditValidationResult, { ok: false }>
): Exclude<SaveFileEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> {
	const outcome: Exclude<SaveFileEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> = {
		status: validation.status,
		message: validation.message
	};
	if (validation.reason) outcome.reason = validation.reason;
	return outcome;
}

function outcomeFromMutation(
	mutation: Extract<SaveFileEditorMutationResult, { ok: false }>
): Exclude<SaveFileEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> {
	const outcome: Exclude<SaveFileEditorApplyOutcome, { status: 'idle' | 'noop' | 'success' }> = {
		status: mutation.status,
		message: mutation.message
	};
	if (mutation.reason) outcome.reason = mutation.reason;
	return outcome;
}

function completeApply(
	state: SaveFileEditorState,
	outcome: Exclude<SaveFileEditorApplyOutcome, { status: 'idle' }>
): SaveFileEditorApplyResult {
	const nextState = withApplyOutcome(state, outcome);
	return {
		state: nextState,
		outcome: nextState.applyOutcome
	};
}

function withApplyOutcome(
	state: SaveFileEditorState,
	outcome: SaveFileEditorApplyOutcome
): SaveFileEditorState {
	return {
		...withStagedEdits(state),
		applyOutcome: outcome,
		unsupportedReason: outcome.status === 'unsupported' ? outcome.message : null
	};
}

function withStagedEdits(state: SaveFileEditorState): SaveFileEditorState {
	return {
		...state,
		staged: state.stagedEdits.length > 0
	};
}

function isTrainerNamePayload(value: unknown): value is { trainerName: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'trainerName' in value &&
		typeof value.trainerName === 'string'
	);
}

function isMoneyPayload(value: unknown): value is { money: number } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'money' in value &&
		typeof value.money === 'number' &&
		Number.isFinite(value.money)
	);
}
