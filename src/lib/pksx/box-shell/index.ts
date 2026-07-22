import type { BoxSlotSummary, PartySlotSummary, PokemonEditOperation } from '$lib/engine';
import type { SlotView } from '$lib/components/pksx/types';
import { PARTY_SLOT_COUNT, type NavigationAction } from '$lib/pksx/box-navigation';
import {
	cancelPokemonEditor,
	stagePokemonEditorEdit,
	type PokemonEditorDraftEdits,
	type PokemonEditorState
} from '$lib/pksx/pokemon-editor';
import type { BoxSourceType } from '$lib/pksx/storage-workbench';

type GamepadInput = {
	axes: readonly number[];
	buttons: readonly { pressed: boolean }[];
};

const toolbarStatusRules: [string[], string][] = [
	[['failed', 'could not'], 'Needs attention'],
	[['checking'], 'Checking'],
	[['creating backup'], 'Backing up'],
	[['applying'], 'Applying'],
	[['serializing'], 'Exporting'],
	[['export ready'], 'Export ready'],
	[['imported'], 'Imported'],
	[['opened as', 'pane switched'], 'Source updated'],
	[['loaded', 'restored'], 'Ready'],
	[['moved'], 'Moved'],
	[['copied'], 'Copied'],
	[['cancelled', 'canceled'], 'Cancelled'],
	[['not available', 'cannot'], 'Not supported']
];

export function keyboardAction(event: Pick<KeyboardEvent, 'key'>): NavigationAction | null {
	if (event.key === 'y' || event.key === 'Y') return 'sourceAction';

	return (
		(
			{
				ArrowUp: 'up',
				ArrowDown: 'down',
				ArrowLeft: 'left',
				ArrowRight: 'right',
				Enter: 'confirm',
				' ': 'confirm',
				Escape: 'back',
				Backspace: 'back',
				'[': 'previousBox',
				PageUp: 'previousBox',
				']': 'nextBox',
				PageDown: 'nextBox'
			} satisfies Record<string, NavigationAction>
		)[event.key] ?? null
	);
}

export function isNativeEditorActivation(
	event: Pick<KeyboardEvent, 'key' | 'target'>,
	action: NavigationAction
): boolean {
	if (!(event.target instanceof Element)) return false;

	const input = event.target.closest(
		'.pokemon-editor input, .pokemon-editor select, .pokemon-editor textarea'
	);
	if (!input)
		return action === 'confirm' && event.target.closest('.pokemon-editor button') !== null;
	if (input instanceof HTMLInputElement && input.dataset.controllerEditing === 'false')
		return false;
	if (event.key === 'Escape') return false;

	const nativeActions: NavigationAction[] =
		input instanceof HTMLInputElement && input.type === 'number'
			? ['up', 'down', 'back']
			: ['back', 'left', 'right'];
	return nativeActions.includes(action) || (action === 'confirm' && event.key === ' ');
}

export function readGamepadActions(gamepad: GamepadInput): NavigationAction[] {
	const actions: NavigationAction[] = [];
	const axisX = gamepad.axes[0] ?? 0;
	const axisY = gamepad.axes[1] ?? 0;

	if (isPressed(gamepad, 12) || axisY < -0.55) actions.push('up');
	if (isPressed(gamepad, 13) || axisY > 0.55) actions.push('down');
	if (isPressed(gamepad, 14) || axisX < -0.55) actions.push('left');
	if (isPressed(gamepad, 15) || axisX > 0.55) actions.push('right');
	if (isPressed(gamepad, 0)) actions.push('confirm');
	if (isPressed(gamepad, 1)) actions.push('back');
	if (isPressed(gamepad, 3)) actions.push('sourceAction');
	if (isPressed(gamepad, 4)) actions.push('previousBox');
	if (isPressed(gamepad, 5)) actions.push('nextBox');

	return actions;
}

function isPressed(gamepad: GamepadInput, index: number): boolean {
	return gamepad.buttons[index]?.pressed === true;
}

export function isDirectional(action: NavigationAction): boolean {
	return action === 'up' || action === 'down' || action === 'left' || action === 'right';
}

export function createPartySlotViews(slots: PartySlotSummary[]): SlotView[] {
	const slotViews = slots.map(createSlotView);
	while (slotViews.length < PARTY_SLOT_COUNT) slotViews.push(createEmptySlotView(slotViews.length));
	return slotViews;
}

export function createBoxSlotViews(slots: BoxSlotSummary[]): SlotView[] {
	return slots.map(createSlotView);
}

export function createSlotView(slot: PartySlotSummary | BoxSlotSummary): SlotView {
	const details = {
		gender: slot.gender ?? undefined,
		nature: slot.nature ?? undefined,
		ability: slot.ability ?? undefined,
		heldItem: slot.heldItem ?? undefined,
		types: slot.types,
		stats: slot.stats,
		moves: slot.moves,
		statEditConstraints: slot.statEditConstraints,
		moveSetEditConstraints: slot.moveSetEditConstraints,
		originalTrainer: slot.originalTrainer ?? undefined,
		metLabel: slot.metLabel ?? undefined,
		entityBytesBase64: slot.entityBytesBase64 ?? null
	};

	if (slot.isEmpty) return { ...createEmptySlotView(slot.slot), ...details };

	return {
		slot: slot.slot,
		label: slot.nickname || `Species ${slot.speciesId}`,
		detail: `Lv. ${slot.level}`,
		level: slot.level,
		experience: slot.experience,
		experienceProjection: slot.experienceProjection,
		speciesId: slot.speciesId,
		form: slot.form,
		isEgg: slot.isEgg,
		spriteIdentity: slot.spriteIdentity,
		kind: 'pokemon',
		...details
	};
}

function createEmptySlotView(slot: number): SlotView {
	return {
		slot,
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
}

export function stagePokemonEditorDraftEdits(
	state: PokemonEditorState,
	draft: PokemonEditorDraftEdits
): PokemonEditorState {
	let nextState = cancelPokemonEditor(state);
	const edits = [
		draft.nickname === undefined
			? null
			: {
					id: 'nickname',
					capability: 'nickname-editing',
					label: draft.nickname.length === 0 ? 'Restore default nickname' : 'Set nickname',
					payload: { nickname: draft.nickname }
				},
		draft.levelExperience
			? {
					id: 'level-experience',
					capability: 'level-experience-editing',
					label:
						draft.levelExperience.mode === 'level'
							? `Set level to ${draft.levelExperience.level}`
							: `Set experience to ${draft.levelExperience.experience}`,
					payload: draft.levelExperience
				}
			: null,
		draft.ivs
			? { id: 'ivs', capability: 'iv-editing', label: 'Set IVs', payload: draft.ivs }
			: null,
		draft.evs
			? { id: 'evs', capability: 'ev-editing', label: 'Set EVs', payload: draft.evs }
			: null,
		draft.moveSet
			? {
					id: 'move-set',
					capability: 'move-set-editing',
					label: 'Set Move Set',
					payload: draft.moveSet
				}
			: null
	].filter((edit) => edit !== null);

	for (const edit of edits) nextState = stagePokemonEditorEdit(nextState, edit);
	return nextState;
}

export function pokemonEditorDraftResetKey(state: PokemonEditorState): string {
	return JSON.stringify({
		source: state.source.identity.key,
		label: state.slot.label,
		level: state.slot.level,
		experience: state.slot.experience,
		ivs: state.slot.stats?.map((stat) => stat.iv ?? 0),
		evs: state.slot.stats?.map((stat) => stat.ev ?? 0),
		moves: state.slot.moves?.map((move) => ({
			slot: move.slot,
			id: move.id,
			pp: move.pp ?? 0,
			ppUps: move.ppUps ?? 0
		}))
	});
}

export function pokemonEditSuccessMessage(
	operation: PokemonEditOperation,
	mutated: boolean
): string {
	if (!mutated) return 'No Pokemon change made.';

	const editedFields = ['nickname', 'level', 'experience', 'ivs', 'evs', 'moves'].filter(
		(field) => operation[field as keyof PokemonEditOperation] !== undefined
	);
	return editedFields.length === 1 && editedFields[0] === 'nickname'
		? 'Pokemon nickname updated.'
		: 'Pokemon edits applied.';
}

export function briefToolbarStatus(message: string, sourceType: BoxSourceType): string {
	const normalized = message.toLowerCase();
	const match = toolbarStatusRules.find(([terms]) =>
		terms.some((term) => normalized.includes(term))
	);
	return match?.[1] ?? (sourceType === 'pokemon-storage' ? 'Storage ready' : 'Ready');
}
