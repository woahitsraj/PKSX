import type {
	PokemonEditOperation,
	PokemonMoveSlotEdit,
	PokemonStatEditSet,
	SaveSlotRef
} from '$lib/engine';
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

export type LevelExperienceEditPayload =
	| {
			mode: 'level';
			level: number;
	  }
	| {
			mode: 'experience';
			experience: number;
	  };

export type PokemonStatKey = keyof PokemonStatEditSet;

export type PokemonStatEditPayload = PokemonStatEditSet;

export type PokemonMoveSetEditPayload = {
	moves: PokemonMoveSlotEdit[];
};

export type PokemonEditorDraftEdits = {
	nickname?: string;
	levelExperience?: LevelExperienceEditPayload;
	ivs?: PokemonStatEditPayload;
	evs?: PokemonStatEditPayload;
	moveSet?: PokemonMoveSetEditPayload;
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

export type PokemonEditorLevelExperienceValidation =
	| {
			ok: true;
			payload: LevelExperienceEditPayload;
			label: string;
	  }
	| {
			ok: false;
			message: string;
	  };

export type PokemonEditorPayloadValidation<TPayload> =
	| {
			ok: true;
			payload: TPayload;
			label: string;
	  }
	| {
			ok: false;
			message: string;
	  };

const statKeys = ['HP', 'ATK', 'DEF', 'SPA', 'SPD', 'SPE'] as const satisfies PokemonStatKey[];

export type PokemonEditOperationBuildResult =
	| {
			ok: true;
			operation: PokemonEditOperation;
	  }
	| Extract<PokemonEditValidationResult, { ok: false }>;

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

export function stageNicknameEdit(state: PokemonEditorState, nickname: string): PokemonEditorState {
	if (nickname === state.slot.label) {
		return removePokemonEditorEdit(state, 'nickname');
	}

	return stagePokemonEditorEdit(state, {
		id: 'nickname',
		capability: 'nickname-editing',
		label: nickname.length === 0 ? 'Restore default nickname' : 'Set nickname',
		payload: { nickname }
	});
}

function removePokemonEditorEdit(state: PokemonEditorState, editId: string): PokemonEditorState {
	return withStagedEdits({
		...state,
		stagedEdits: state.stagedEdits.filter((existing) => existing.id !== editId)
	});
}

export function validateLevelExperienceEdit(
	slot: SlotView,
	payload: LevelExperienceEditPayload
): PokemonEditorLevelExperienceValidation {
	if (slot.kind !== 'pokemon') {
		return { ok: false, message: 'Level and Experience Editing needs an occupied Slot.' };
	}

	if (!slot.experienceProjection) {
		return {
			ok: false,
			message: 'Level and Experience Editing is not supported for this Pokemon format.'
		};
	}

	const projection = slot.experienceProjection;

	if (payload.mode === 'level') {
		if (!Number.isInteger(payload.level)) {
			return { ok: false, message: 'Level must be a whole number.' };
		}

		if (payload.level < projection.minLevel || payload.level > projection.maxLevel) {
			return {
				ok: false,
				message: `Level must be between ${projection.minLevel} and ${projection.maxLevel}.`
			};
		}

		return {
			ok: true,
			payload,
			label: `Set level to ${payload.level}`
		};
	}

	if (!Number.isInteger(payload.experience)) {
		return { ok: false, message: 'Experience must be a whole number.' };
	}

	if (
		payload.experience < projection.minExperience ||
		payload.experience > projection.maxExperience
	) {
		return {
			ok: false,
			message: `Experience must be between ${projection.minExperience} and ${projection.maxExperience}.`
		};
	}

	return {
		ok: true,
		payload,
		label: `Set experience to ${payload.experience}`
	};
}

export function stageLevelExperienceEdit(
	state: PokemonEditorState,
	payload: LevelExperienceEditPayload
): PokemonEditorState {
	const validation = validateLevelExperienceEdit(state.slot, payload);
	if (!validation.ok) {
		return withApplyOutcome(removePokemonEditorEdit(state, 'level-experience'), {
			status: 'rejected',
			message: validation.message,
			reason: 'invalid-pokemon-edit'
		});
	}

	return stagePokemonEditorEdit(state, {
		id: 'level-experience',
		capability: 'level-experience-editing',
		label: validation.label,
		payload: validation.payload
	});
}

export function stageIvEdit(
	state: PokemonEditorState,
	payload: PokemonStatEditPayload
): PokemonEditorState {
	const validation = validateIvEdit(state.slot, payload);
	if (!validation.ok) {
		return withApplyOutcome(removePokemonEditorEdit(state, 'ivs'), {
			status: 'rejected',
			message: validation.message,
			reason: 'invalid-pokemon-edit'
		});
	}

	return stagePokemonEditorEdit(state, {
		id: 'ivs',
		capability: 'iv-editing',
		label: validation.label,
		payload: validation.payload
	});
}

export function stageEvEdit(
	state: PokemonEditorState,
	payload: PokemonStatEditPayload
): PokemonEditorState {
	const validation = validateEvEdit(state.slot, payload);
	if (!validation.ok) {
		return withApplyOutcome(removePokemonEditorEdit(state, 'evs'), {
			status: 'rejected',
			message: validation.message,
			reason: 'invalid-pokemon-edit'
		});
	}

	return stagePokemonEditorEdit(state, {
		id: 'evs',
		capability: 'ev-editing',
		label: validation.label,
		payload: validation.payload
	});
}

export function stageMoveSetEdit(
	state: PokemonEditorState,
	payload: PokemonMoveSetEditPayload
): PokemonEditorState {
	const validation = validateMoveSetEdit(state.slot, payload);
	if (!validation.ok) {
		return withApplyOutcome(removePokemonEditorEdit(state, 'move-set'), {
			status: 'rejected',
			message: validation.message,
			reason: 'invalid-pokemon-edit'
		});
	}

	return stagePokemonEditorEdit(state, {
		id: 'move-set',
		capability: 'move-set-editing',
		label: validation.label,
		payload: validation.payload
	});
}

export function statEditPayloadFromSlot(
	slot: SlotView,
	value: 'iv' | 'ev'
): PokemonStatEditPayload {
	return Object.fromEntries(
		statKeys.map((key) => [key, slot.stats?.find((stat) => stat.key === key)?.[value] ?? 0])
	) as PokemonStatEditPayload;
}

export function moveSetEditPayloadFromSlot(slot: SlotView): PokemonMoveSetEditPayload {
	return {
		moves: Array.from({ length: slot.moveSetEditConstraints?.maxMoveSlots ?? 4 }, (_, index) => {
			const move = slot.moves?.find((candidate) => candidate.slot === index);
			return {
				slot: index,
				move: move?.id ?? 0,
				pp: move?.pp ?? move?.maxPp ?? 0,
				ppUps: move?.ppUps ?? 0
			};
		})
	};
}

export function createPokemonEditOperation(
	state: PokemonEditorState
): PokemonEditOperationBuildResult {
	if (state.source.owner !== 'save-file') {
		return {
			ok: false,
			status: 'unsupported',
			message: 'Pokemon Storage level and experience editing is not available yet.',
			reason: 'storage-unavailable'
		};
	}

	const nicknameEdit = state.stagedEdits.find((candidate) => candidate.id === 'nickname');
	const levelExperienceEdit = state.stagedEdits.find(
		(candidate) => candidate.id === 'level-experience'
	);
	const ivEdit = state.stagedEdits.find((candidate) => candidate.id === 'ivs');
	const evEdit = state.stagedEdits.find((candidate) => candidate.id === 'evs');
	const moveSetEdit = state.stagedEdits.find((candidate) => candidate.id === 'move-set');
	if (!nicknameEdit && !levelExperienceEdit && !ivEdit && !evEdit && !moveSetEdit) {
		return {
			ok: false,
			status: 'unsupported',
			message: 'No supported Pokemon edits are staged.',
			reason: 'unsupported-pokemon-edit'
		};
	}

	const operation: PokemonEditOperation = { source: state.source.slotRef };

	if (nicknameEdit) {
		const nicknamePayload = nicknameEdit.payload;
		if (!isNicknameEditPayload(nicknamePayload)) {
			return {
				ok: false,
				status: 'rejected',
				message: 'Nickname edit payload is invalid.',
				reason: 'invalid-pokemon-edit'
			};
		}

		operation.nickname = nicknamePayload.nickname;
	}

	if (levelExperienceEdit) {
		const payload = levelExperienceEdit.payload;
		if (!isLevelExperienceEditPayload(payload)) {
			return {
				ok: false,
				status: 'rejected',
				message: 'Level and Experience edit payload is invalid.',
				reason: 'invalid-pokemon-edit'
			};
		}

		const validation = validateLevelExperienceEdit(state.slot, payload);
		if (!validation.ok) {
			return {
				ok: false,
				status: 'rejected',
				message: validation.message,
				reason: 'invalid-pokemon-edit'
			};
		}

		if (payload.mode === 'level') {
			operation.level = payload.level;
		} else {
			operation.experience = payload.experience;
		}
	}

	if (ivEdit) {
		const payload = ivEdit.payload;
		if (!isPokemonStatEditPayload(payload)) {
			return {
				ok: false,
				status: 'rejected',
				message: 'IV edit payload is invalid.',
				reason: 'invalid-pokemon-edit'
			};
		}

		const validation = validateIvEdit(state.slot, payload);
		if (!validation.ok) {
			return {
				ok: false,
				status: 'rejected',
				message: validation.message,
				reason: 'invalid-pokemon-edit'
			};
		}

		operation.ivs = cloneStatEditPayload(validation.payload);
	}

	if (evEdit) {
		const payload = evEdit.payload;
		if (!isPokemonStatEditPayload(payload)) {
			return {
				ok: false,
				status: 'rejected',
				message: 'EV edit payload is invalid.',
				reason: 'invalid-pokemon-edit'
			};
		}

		const validation = validateEvEdit(state.slot, payload);
		if (!validation.ok) {
			return {
				ok: false,
				status: 'rejected',
				message: validation.message,
				reason: 'invalid-pokemon-edit'
			};
		}

		operation.evs = cloneStatEditPayload(validation.payload);
	}

	if (moveSetEdit) {
		const payload = moveSetEdit.payload;
		if (!isPokemonMoveSetEditPayload(payload)) {
			return {
				ok: false,
				status: 'rejected',
				message: 'Move Set edit payload is invalid.',
				reason: 'invalid-pokemon-edit'
			};
		}

		const validation = validateMoveSetEdit(state.slot, payload);
		if (!validation.ok) {
			return {
				ok: false,
				status: 'rejected',
				message: validation.message,
				reason: 'invalid-pokemon-edit'
			};
		}

		operation.moves = validation.payload.moves.map((move) => ({ ...move }));
	}

	return { ok: true, operation };
}

function validateIvEdit(
	slot: SlotView,
	payload: PokemonStatEditPayload
): PokemonEditorPayloadValidation<PokemonStatEditPayload> {
	if (slot.kind !== 'pokemon') {
		return { ok: false, message: 'IV Editing needs an occupied Slot.' };
	}

	const constraints = slot.statEditConstraints;
	if (!constraints?.supported) {
		return {
			ok: false,
			message:
				constraints?.unsupportedReason ?? 'IV Editing is not supported for this Pokemon format.'
		};
	}

	for (const key of statKeys) {
		const value = payload[key];
		if (!Number.isInteger(value)) {
			return { ok: false, message: `${key} IV must be a whole number.` };
		}

		if (value < constraints.minIv || value > constraints.maxIv) {
			return {
				ok: false,
				message: `${key} IV must be between ${constraints.minIv} and ${constraints.maxIv}.`
			};
		}
	}

	return { ok: true, payload, label: 'Set IVs' };
}

function validateEvEdit(
	slot: SlotView,
	payload: PokemonStatEditPayload
): PokemonEditorPayloadValidation<PokemonStatEditPayload> {
	if (slot.kind !== 'pokemon') {
		return { ok: false, message: 'EV Editing needs an occupied Slot.' };
	}

	const constraints = slot.statEditConstraints;
	if (!constraints?.supported) {
		return {
			ok: false,
			message:
				constraints?.unsupportedReason ?? 'EV Editing is not supported for this Pokemon format.'
		};
	}

	let total = 0;
	for (const key of statKeys) {
		const value = payload[key];
		if (!Number.isInteger(value)) {
			return { ok: false, message: `${key} EV must be a whole number.` };
		}

		if (value < constraints.minEv || value > constraints.maxEv) {
			return {
				ok: false,
				message: `${key} EV must be between ${constraints.minEv} and ${constraints.maxEv}.`
			};
		}

		total += value;
	}

	if (total > constraints.maxTotalEv) {
		return {
			ok: false,
			message: `Total EVs must be ${constraints.maxTotalEv} or less.`
		};
	}

	return { ok: true, payload, label: 'Set EVs' };
}

function validateMoveSetEdit(
	slot: SlotView,
	payload: PokemonMoveSetEditPayload
): PokemonEditorPayloadValidation<PokemonMoveSetEditPayload> {
	if (slot.kind !== 'pokemon') {
		return { ok: false, message: 'Move Set Editing needs an occupied Slot.' };
	}

	const constraints = slot.moveSetEditConstraints;
	if (!constraints?.supported) {
		return {
			ok: false,
			message:
				constraints?.unsupportedReason ??
				'Move Set Editing is not supported for this Pokemon format.'
		};
	}

	const options = new Map(constraints.availableMoves.map((option) => [option.id, option]));
	for (const edit of payload.moves) {
		if (!Number.isInteger(edit.slot) || edit.slot < 0 || edit.slot >= constraints.maxMoveSlots) {
			return { ok: false, message: 'Move Set slot must be between 1 and 4.' };
		}

		const option = options.get(edit.move);
		if (!option) {
			return { ok: false, message: `Move ${edit.move} is not available for this Pokemon.` };
		}

		const ppUps = edit.ppUps ?? 0;
		if (!Number.isInteger(ppUps) || ppUps < 0 || ppUps > 3) {
			return { ok: false, message: 'PP Ups must be between 0 and 3.' };
		}

		const maxPp = maxPpForPpUps(option.maxPp, ppUps);
		const pp = edit.pp ?? maxPp;
		if (!Number.isInteger(pp) || pp < 0 || pp > maxPp) {
			return { ok: false, message: `PP for ${option.name} must be between 0 and ${maxPp}.` };
		}
	}

	return { ok: true, payload, label: 'Set Move Set' };
}

export function maxPpForPpUps(basePp: number, ppUps: number): number {
	if (basePp <= 0) return 0;
	return Math.floor((basePp * (5 + ppUps)) / 5);
}

function cloneStatEditPayload(payload: PokemonStatEditPayload): PokemonStatEditPayload {
	return {
		HP: payload.HP,
		ATK: payload.ATK,
		DEF: payload.DEF,
		SPA: payload.SPA,
		SPD: payload.SPD,
		SPE: payload.SPE
	};
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

function isLevelExperienceEditPayload(value: unknown): value is LevelExperienceEditPayload {
	if (typeof value !== 'object' || value === null || !('mode' in value)) {
		return false;
	}

	if (value.mode === 'level') {
		return 'level' in value && typeof value.level === 'number';
	}

	if (value.mode === 'experience') {
		return 'experience' in value && typeof value.experience === 'number';
	}

	return false;
}

function isNicknameEditPayload(value: unknown): value is { nickname: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'nickname' in value &&
		typeof value.nickname === 'string'
	);
}

function isPokemonStatEditPayload(value: unknown): value is PokemonStatEditPayload {
	const candidate = value as Partial<Record<PokemonStatKey, unknown>>;
	return (
		typeof value === 'object' &&
		value !== null &&
		statKeys.every((key) => key in candidate && typeof candidate[key] === 'number')
	);
}

function isPokemonMoveSetEditPayload(value: unknown): value is PokemonMoveSetEditPayload {
	return (
		typeof value === 'object' &&
		value !== null &&
		'moves' in value &&
		Array.isArray(value.moves) &&
		value.moves.every(
			(move) =>
				typeof move === 'object' &&
				move !== null &&
				'slot' in move &&
				typeof move.slot === 'number' &&
				'move' in move &&
				typeof move.move === 'number' &&
				(!('pp' in move) || typeof move.pp === 'number') &&
				(!('ppUps' in move) || typeof move.ppUps === 'number')
		)
	);
}
