export const PARTY_SLOT_COUNT = 6;
export const BOX_COLUMNS = 6;
export const BOX_ROWS = 5;
export const BOX_SLOT_COUNT = BOX_COLUMNS * BOX_ROWS;

export type FocusZone = 'party' | 'box';

export type ControllerFocus =
	| {
			zone: 'party';
			slot: number;
	  }
	| {
			zone: 'box';
			slot: number;
	  };

export type NavigationAction =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'confirm'
	| 'back'
	| 'previousBox'
	| 'nextBox';

export type BoxNavigationState = {
	focus: ControllerFocus;
	activeBox: number;
	boxCount: number;
	actionSurfaceOpen: boolean;
};

export function createInitialNavigationState(boxCount: number): BoxNavigationState {
	return {
		focus: { zone: 'box', slot: 0 },
		activeBox: 0,
		boxCount: Math.max(1, boxCount),
		actionSurfaceOpen: false
	};
}

export function applyNavigationAction(
	state: BoxNavigationState,
	action: NavigationAction
): BoxNavigationState {
	if (state.actionSurfaceOpen) {
		if (action === 'back') {
			return { ...state, actionSurfaceOpen: false };
		}

		return state;
	}

	switch (action) {
		case 'up':
			return { ...state, focus: moveUp(state.focus) };
		case 'down':
			return { ...state, focus: moveDown(state.focus) };
		case 'left':
			return { ...state, focus: moveLeft(state.focus) };
		case 'right':
			return { ...state, focus: moveRight(state.focus) };
		case 'confirm':
			return { ...state, actionSurfaceOpen: true };
		case 'previousBox':
			return { ...state, activeBox: wrapBoxIndex(state.activeBox - 1, state.boxCount) };
		case 'nextBox':
			return { ...state, activeBox: wrapBoxIndex(state.activeBox + 1, state.boxCount) };
		case 'back':
			return state;
	}
}

export function focusPartySlot(slot: number): ControllerFocus {
	return { zone: 'party', slot: clamp(slot, 0, PARTY_SLOT_COUNT - 1) };
}

export function focusBoxSlot(slot: number): ControllerFocus {
	return { zone: 'box', slot: clamp(slot, 0, BOX_SLOT_COUNT - 1) };
}

export function selectActiveBox(state: BoxNavigationState, index: number): BoxNavigationState {
	return { ...state, activeBox: clamp(index, 0, state.boxCount - 1) };
}

export function getFocusId(focus: ControllerFocus, activeBox: number): string {
	return focus.zone === 'party'
		? `party-slot-${focus.slot}`
		: `box-${activeBox}-slot-${focus.slot}`;
}

export function getBoxSlotPosition(slot: number): { row: number; column: number } {
	const clampedSlot = clamp(slot, 0, BOX_SLOT_COUNT - 1);
	return {
		row: Math.floor(clampedSlot / BOX_COLUMNS),
		column: clampedSlot % BOX_COLUMNS
	};
}

function moveUp(focus: ControllerFocus): ControllerFocus {
	if (focus.zone === 'party') {
		return focusPartySlot(focus.slot - 1);
	}

	return focusBoxSlot(focus.slot - BOX_COLUMNS);
}

function moveDown(focus: ControllerFocus): ControllerFocus {
	if (focus.zone === 'party') {
		return focusPartySlot(focus.slot + 1);
	}

	return focusBoxSlot(focus.slot + BOX_COLUMNS);
}

function moveLeft(focus: ControllerFocus): ControllerFocus {
	if (focus.zone === 'party') {
		return focus;
	}

	const { row, column } = getBoxSlotPosition(focus.slot);

	if (column === 0) {
		return focusPartySlot(row);
	}

	return focusBoxSlot(focus.slot - 1);
}

function moveRight(focus: ControllerFocus): ControllerFocus {
	if (focus.zone === 'party') {
		const row = Math.min(focus.slot, BOX_ROWS - 1);
		return focusBoxSlot(row * BOX_COLUMNS);
	}

	const { column } = getBoxSlotPosition(focus.slot);

	if (column === BOX_COLUMNS - 1) {
		return focus;
	}

	return focusBoxSlot(focus.slot + 1);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function wrapBoxIndex(value: number, boxCount: number): number {
	const count = Math.max(1, boxCount);
	return ((value % count) + count) % count;
}
