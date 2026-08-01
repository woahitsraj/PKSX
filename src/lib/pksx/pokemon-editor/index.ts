import type {
	PokemonEditOperation,
	PokemonFriendshipFieldEdit,
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

<<<<<<< HEAD
export type NatureEditPayload = {
	natureId: number;
};

=======
>>>>>>> origin/main
export type PokemonFriendshipEditPayload = {
	fields: PokemonFriendshipFieldEdit[];
};

export type PokemonEditorDraftEdits = {
	nickname?: string;
	levelExperience?: LevelExperienceEditPayload;
	natureId?: number;
	ivs?: PokemonStatEditPayload;
	evs?: PokemonStatEditPayload;
	moveSet?: PokemonMoveSetEditPayload;
	friendship?: PokemonFriendshipEditPayload;
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

type PokemonEditPatch = Partial<Omit<PokemonEditOperation, 'source'>>;
type PokemonEditPatchResult =
	| { ok: true; patch: PokemonEditPatch }
	| Extract<PokemonEditValidationResult, { ok: false }>;
type PokemonEditOperationBuilder = (payload: unknown, slot: SlotView) => PokemonEditPatchResult;

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

	const editorSlot = hydrateSaveFileEditorSlot(source, slot);

	return {
		ok: true,
		state: withStagedEdits({
			source: {
				...source,
				identity: source.identity ?? createPokemonEditorSourceIdentity(editorSlot)
			} as PokemonEditorSource,
			slot: editorSlot,
			stagedEdits: [],
			staged: false,
			applyOutcome: { status: 'idle', message: null },
			unsupportedReason: null
		})
	};
}

function hydrateSaveFileEditorSlot(source: PokemonEditorSourceInput, slot: SlotView): SlotView {
	if (source.owner !== 'save-file' || slot.kind !== 'pokemon') {
		return slot;
	}

	const statEditConstraints =
		slot.stats && slot.stats.length > 0 && !slot.statEditConstraints?.supported
			? {
					supported: true,
					minIv: slot.statEditConstraints?.minIv ?? 0,
					maxIv: slot.statEditConstraints?.maxIv ?? 31,
					minEv: slot.statEditConstraints?.minEv ?? 0,
					maxEv: slot.statEditConstraints?.maxEv ?? 255,
					maxTotalEv: slot.statEditConstraints?.maxTotalEv ?? 510
				}
			: slot.statEditConstraints;

	const moveSetEditConstraints =
		slot.moves && slot.moves.length > 0 && !slot.moveSetEditConstraints?.supported
			? {
					supported: true,
					maxMoveSlots: slot.moveSetEditConstraints?.maxMoveSlots ?? 4,
					availableMoves: currentMoveOptions(slot)
				}
			: slot.moveSetEditConstraints;

	if (
		statEditConstraints === slot.statEditConstraints &&
		moveSetEditConstraints === slot.moveSetEditConstraints
	) {
		return slot;
	}

	return {
		...slot,
		statEditConstraints,
		moveSetEditConstraints
	};
}

function currentMoveOptions(slot: SlotView) {
	const options = new Map<
		number,
		NonNullable<SlotView['moveSetEditConstraints']>['availableMoves'][number]
	>();
	options.set(0, { id: 0, name: 'Empty', type: 'None', hue: 48, chroma: 0.04, maxPp: 0 });

	for (const move of slot.moves ?? []) {
		if (move.id === 0 || options.has(move.id)) {
			continue;
		}

		options.set(move.id, {
			id: move.id,
			name: move.name,
			type: move.type,
			hue: move.hue,
			chroma: move.chroma ?? 0.04,
			maxPp: move.maxPp ?? move.pp ?? 0
		});
	}

	return [...options.values()];
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

export function stageNatureEdit(
	state: PokemonEditorState,
	payload: NatureEditPayload
): PokemonEditorState {
	const validation = validateNatureEdit(state.slot, payload);
	if (!validation.ok) {
		return withApplyOutcome(removePokemonEditorEdit(state, 'nature'), {
			status: 'rejected',
			message: validation.message,
			reason: 'invalid-pokemon-edit'
		});
	}

	if (payload.natureId === state.slot.natureEditConstraints?.currentNatureId) {
		return removePokemonEditorEdit(state, 'nature');
	}

	return stagePokemonEditorEdit(state, {
		id: 'nature',
		capability: 'nature-editing',
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

export function stageFriendshipEdit(
	state: PokemonEditorState,
	payload: PokemonFriendshipEditPayload
): PokemonEditorState {
	const currentValues = new Map(
		(state.slot.friendshipEditConstraints?.fields ?? []).map((field) => [field.key, field.value])
	);
	const changedFields = payload.fields.filter(
		(field) => currentValues.get(field.key) !== field.value
	);
	if (changedFields.length === 0) {
		return removePokemonEditorEdit(state, 'friendship');
	}

	const validation = validateFriendshipEdit(state.slot, { fields: changedFields });
	if (!validation.ok) {
		return withApplyOutcome(removePokemonEditorEdit(state, 'friendship'), {
			status: 'rejected',
			message: validation.message,
			reason: 'invalid-pokemon-edit'
		});
	}

	return stagePokemonEditorEdit(state, {
		id: 'friendship',
		capability: 'friendship-editing',
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
			message: 'Pokemon Storage editing is not available yet.',
			reason: 'storage-unavailable'
		};
	}

	const operation: PokemonEditOperation = { source: state.source.slotRef };
	let supportedEditFound = false;

	for (const { id, build } of pokemonEditOperationBuilders) {
		const edit = state.stagedEdits.find((candidate) => candidate.id === id);
		if (!edit) continue;

		supportedEditFound = true;
		const result = build(edit.payload, state.slot);
		if (!result.ok) return result;
		Object.assign(operation, result.patch);
	}

	if (!supportedEditFound) {
		return {
			ok: false,
			status: 'unsupported',
			message: 'No supported Pokemon edits are staged.',
			reason: 'unsupported-pokemon-edit'
		};
	}

	return { ok: true, operation };
}

const pokemonEditOperationBuilders = [
	{ id: 'nickname', build: buildNicknameEdit },
	{ id: 'level-experience', build: buildLevelExperienceEdit },
	{ id: 'nature', build: buildNatureEdit },
	{ id: 'ivs', build: buildIvEdit },
	{ id: 'evs', build: buildEvEdit },
	{ id: 'move-set', build: buildMoveSetEdit },
	{ id: 'friendship', build: buildFriendshipEdit }
] satisfies { id: string; build: PokemonEditOperationBuilder }[];

<<<<<<< HEAD
function buildNatureEdit(payload: unknown, slot: SlotView): PokemonEditPatchResult {
	if (!isNatureEditPayload(payload)) {
		return invalidPokemonEdit('Nature edit payload is invalid.');
	}

	const validation = validateNatureEdit(slot, payload);
	if (!validation.ok) return invalidPokemonEdit(validation.message);

	return { ok: true, patch: { natureId: validation.payload.natureId } };
}

function validateNatureEdit(
	slot: SlotView,
	payload: NatureEditPayload
): PokemonEditorPayloadValidation<NatureEditPayload> {
	if (slot.kind !== 'pokemon') {
		return { ok: false, message: 'Nature Editing needs an occupied Slot.' };
	}

	const constraints = slot.natureEditConstraints;
	if (!constraints?.supported) {
		return {
			ok: false,
			message:
				constraints?.unsupportedReason ?? 'Nature Editing is not supported for this Pokemon format.'
		};
	}

	if (!Number.isInteger(payload.natureId)) {
		return { ok: false, message: 'Nature choice is invalid.' };
	}

	const option = constraints.options.find((candidate) => candidate.id === payload.natureId);
	if (!option) {
		return { ok: false, message: `Nature ${payload.natureId} is not available.` };
	}

	return { ok: true, payload, label: `Set Nature to ${option.name}` };
}

=======
>>>>>>> origin/main
function buildFriendshipEdit(payload: unknown, slot: SlotView): PokemonEditPatchResult {
	if (!isPokemonFriendshipEditPayload(payload)) {
		return invalidPokemonEdit('Friendship edit payload is invalid.');
	}

	const validation = validateFriendshipEdit(slot, payload);
	if (!validation.ok) return invalidPokemonEdit(validation.message);

	return {
		ok: true,
		patch: { friendshipEdits: validation.payload.fields.map((field) => ({ ...field })) }
	};
}

function buildNicknameEdit(payload: unknown): PokemonEditPatchResult {
	return isNicknameEditPayload(payload)
		? { ok: true, patch: { nickname: payload.nickname } }
		: invalidPokemonEdit('Nickname edit payload is invalid.');
}

function buildLevelExperienceEdit(payload: unknown, slot: SlotView): PokemonEditPatchResult {
	if (!isLevelExperienceEditPayload(payload)) {
		return invalidPokemonEdit('Level and Experience edit payload is invalid.');
	}

	const validation = validateLevelExperienceEdit(slot, payload);
	if (!validation.ok) return invalidPokemonEdit(validation.message);

	return {
		ok: true,
		patch: payload.mode === 'level' ? { level: payload.level } : { experience: payload.experience }
	};
}

function buildIvEdit(payload: unknown, slot: SlotView): PokemonEditPatchResult {
	return buildStatEdit(payload, slot, 'ivs');
}

function buildEvEdit(payload: unknown, slot: SlotView): PokemonEditPatchResult {
	return buildStatEdit(payload, slot, 'evs');
}

function buildStatEdit(
	payload: unknown,
	slot: SlotView,
	kind: 'ivs' | 'evs'
): PokemonEditPatchResult {
	if (!isPokemonStatEditPayload(payload)) {
		return invalidPokemonEdit(`${kind === 'ivs' ? 'IV' : 'EV'} edit payload is invalid.`);
	}

	const validation = kind === 'ivs' ? validateIvEdit(slot, payload) : validateEvEdit(slot, payload);
	if (!validation.ok) return invalidPokemonEdit(validation.message);

	const stats = cloneStatEditPayload(validation.payload);
	return { ok: true, patch: kind === 'ivs' ? { ivs: stats } : { evs: stats } };
}

function buildMoveSetEdit(payload: unknown, slot: SlotView): PokemonEditPatchResult {
	if (!isPokemonMoveSetEditPayload(payload)) {
		return invalidPokemonEdit('Move Set edit payload is invalid.');
	}

	const validation = validateMoveSetEdit(slot, payload);
	if (!validation.ok) return invalidPokemonEdit(validation.message);

	return {
		ok: true,
		patch: { moves: validation.payload.moves.map((move) => ({ ...move })) }
	};
}

function invalidPokemonEdit(message: string): Extract<PokemonEditValidationResult, { ok: false }> {
	return { ok: false, status: 'rejected', message, reason: 'invalid-pokemon-edit' };
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
		const message = validateMoveSlotEdit(edit, constraints, options);
		if (message) return { ok: false, message };
	}

	return { ok: true, payload, label: 'Set Move Set' };
}

export function validateFriendshipEdit(
	slot: SlotView,
	payload: PokemonFriendshipEditPayload
): PokemonEditorPayloadValidation<PokemonFriendshipEditPayload> {
	if (slot.kind !== 'pokemon') {
		return { ok: false, message: 'Friendship Editing needs an occupied Slot.' };
	}

	const constraints = slot.friendshipEditConstraints;
	if (!constraints?.supported) {
		return {
			ok: false,
			message:
				constraints?.unsupportedReason ??
				'Friendship Editing is not supported for this Pokemon format.'
		};
	}
	if (payload.fields.length === 0) {
		return { ok: false, message: 'Choose a Friendship edit to apply.' };
	}

	const availableFields = new Map(constraints.fields.map((field) => [field.key, field]));
	const keys = new Set<string>();
	for (const edit of payload.fields) {
		if (keys.has(edit.key)) {
			return { ok: false, message: `${edit.key} is duplicated.` };
		}
		keys.add(edit.key);

		const field = availableFields.get(edit.key);
		if (!field) {
			return { ok: false, message: `Friendship field '${edit.key}' is not supported.` };
		}
		if (!Number.isInteger(edit.value)) {
			return { ok: false, message: `${field.label} must be a whole number.` };
		}
		if (edit.value < field.min || edit.value > field.max) {
			return {
				ok: false,
				message: `${field.label} must be between ${field.min} and ${field.max}.`
			};
		}
	}

	const labels = payload.fields.map((edit) => availableFields.get(edit.key)?.label ?? edit.key);
	return {
		ok: true,
		payload,
		label: `Set ${labels.join(' and ')}`
	};
}

type MoveSetEditConstraints = NonNullable<SlotView['moveSetEditConstraints']>;
type MoveOption = MoveSetEditConstraints['availableMoves'][number];

function validateMoveSlotEdit(
	edit: PokemonMoveSlotEdit,
	constraints: MoveSetEditConstraints,
	options: Map<number, MoveOption>
): string | null {
	if (!Number.isInteger(edit.slot) || edit.slot < 0 || edit.slot >= constraints.maxMoveSlots) {
		return 'Move Set slot must be between 1 and 4.';
	}

	const option = options.get(edit.move);
	if (!option) return `Move ${edit.move} is not available for this Pokemon.`;

	const ppUps = edit.ppUps ?? 0;
	if (!Number.isInteger(ppUps) || ppUps < 0 || ppUps > 3) {
		return 'PP Ups must be between 0 and 3.';
	}

	const maxPp = maxPpForPpUps(option.maxPp, ppUps);
	const pp = edit.pp ?? maxPp;
	return !Number.isInteger(pp) || pp < 0 || pp > maxPp
		? `PP for ${option.name} must be between 0 and ${maxPp}.`
		: null;
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

function isNatureEditPayload(value: unknown): value is NatureEditPayload {
	return (
		typeof value === 'object' &&
		value !== null &&
		'natureId' in value &&
		typeof value.natureId === 'number'
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

function isPokemonFriendshipEditPayload(value: unknown): value is PokemonFriendshipEditPayload {
	return (
		typeof value === 'object' &&
		value !== null &&
		'fields' in value &&
		Array.isArray(value.fields) &&
		value.fields.every(
			(field) =>
				typeof field === 'object' &&
				field !== null &&
				'key' in field &&
				typeof field.key === 'string' &&
				'value' in field &&
				typeof field.value === 'number'
		)
	);
}
