export const PARTY_SLOT_COUNT = 6;
export const BOX_COLUMNS = 6;
export const BOX_ROWS = 5;
export const BOX_SLOT_COUNT = BOX_COLUMNS * BOX_ROWS;
export const TOP_CONTROL_COUNT = 5;
export const MOBILE_TAB_COUNT = 3;

export type FocusZone = 'topbar' | 'party' | 'paneControls' | 'box' | 'actions' | 'mobileTabs';

export type SlotFocus =
	| {
			zone: 'party';
			slot: number;
	  }
	| {
			zone: 'box';
			slot: number;
	  };

export type ControllerFocus =
	| {
			zone: 'topbar';
			index: number;
	  }
	| {
			zone: 'paneControls';
			index: number;
	  }
	| SlotFocus
	| {
			zone: 'actions';
			index: number;
	  }
	| {
			zone: 'mobileTabs';
			index: number;
	  };

export type NavigationAction =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'confirm'
	| 'back'
	| 'previousBox'
	| 'nextBox'
	| 'sourceAction';

export type BoxNavigationState = {
	focus: ControllerFocus;
	actionOrigin: SlotFocus | null;
	activeBox: number;
	boxCount: number;
	actionSurfaceOpen: boolean;
};

export type NavigationOptions = {
	actionCount?: number;
	topControlCount?: number;
	paneControlCount?: number;
	mobileTabCount?: number;
	mobileTabsAvailable?: boolean;
	partyAvailable?: boolean;
};

export function createInitialNavigationState(boxCount: number): BoxNavigationState {
	return {
		focus: { zone: 'box', slot: 0 },
		actionOrigin: null,
		activeBox: 0,
		boxCount: Math.max(1, boxCount),
		actionSurfaceOpen: false
	};
}

export function applyNavigationAction(
	state: BoxNavigationState,
	action: NavigationAction,
	options: NavigationOptions = {}
): BoxNavigationState {
	const actionCount = Math.max(1, options.actionCount ?? 1);
	const topControlCount = Math.max(1, options.topControlCount ?? TOP_CONTROL_COUNT);
	const paneControlCount = Math.max(0, options.paneControlCount ?? 0);
	const mobileTabsAvailable = options.mobileTabsAvailable ?? true;
	const partyAvailable = options.partyAvailable ?? true;

	if (state.actionSurfaceOpen || state.focus.zone === 'actions') {
		if (state.focus.zone === 'actions') {
			switch (action) {
				case 'up':
				case 'left':
					return { ...state, focus: focusActionCommand(state.focus.index - 1, actionCount) };
				case 'down':
				case 'right':
					return { ...state, focus: focusActionCommand(state.focus.index + 1, actionCount) };
				case 'confirm':
					if (state.focus.index === actionCount - 1) {
						return closeActionSurface(state);
					}
					return state;
				case 'back':
					return closeActionSurface(state);
				case 'previousBox':
				case 'nextBox':
				case 'sourceAction':
					return state;
			}
		}

		if (action === 'back') {
			return closeActionSurface(state);
		}

		return state;
	}

	switch (action) {
		case 'up':
			return {
				...state,
				focus: moveUp(
					state.focus,
					topControlCount,
					paneControlCount,
					partyAvailable,
					mobileTabsAvailable
				)
			};
		case 'down':
			return {
				...state,
				focus: moveDown(
					state.focus,
					topControlCount,
					paneControlCount,
					mobileTabsAvailable,
					partyAvailable
				)
			};
		case 'left':
			return {
				...state,
				focus: moveLeft(state.focus, topControlCount, paneControlCount, mobileTabsAvailable)
			};
		case 'right':
			return {
				...state,
				focus: moveRight(state.focus, topControlCount, paneControlCount, mobileTabsAvailable)
			};
		case 'confirm':
			if (isSlotFocus(state.focus)) {
				return {
					...state,
					actionOrigin: state.focus,
					actionSurfaceOpen: true,
					focus: focusActionCommand(0, actionCount)
				};
			}
			return state;
		case 'previousBox':
			return {
				...state,
				activeBox: wrapBoxIndex(state.activeBox - 1, state.boxCount),
				focus: focusFirstRowForBoxChange(state.focus)
			};
		case 'nextBox':
			return {
				...state,
				activeBox: wrapBoxIndex(state.activeBox + 1, state.boxCount),
				focus: focusFirstRowForBoxChange(state.focus)
			};
		case 'back':
		case 'sourceAction':
			return state;
	}
}

export function focusPartySlot(slot: number): ControllerFocus {
	return { zone: 'party', slot: clamp(slot, 0, PARTY_SLOT_COUNT - 1) };
}

export function focusBoxSlot(slot: number): ControllerFocus {
	return { zone: 'box', slot: clamp(slot, 0, BOX_SLOT_COUNT - 1) };
}

export function focusPaneBoundarySlot(slot: number, direction: 'left' | 'right'): ControllerFocus {
	const { row } = getBoxSlotPosition(slot);
	const column = direction === 'right' ? 0 : BOX_COLUMNS - 1;
	return focusBoxSlot(row * BOX_COLUMNS + column);
}

export function focusTopControl(
	index: number,
	topControlCount = TOP_CONTROL_COUNT
): ControllerFocus {
	return { zone: 'topbar', index: clamp(index, 0, Math.max(1, topControlCount) - 1) };
}

export function focusPaneControl(index: number, paneControlCount = 1): ControllerFocus {
	return { zone: 'paneControls', index: clamp(index, 0, Math.max(1, paneControlCount) - 1) };
}

export function focusActionCommand(index: number, actionCount = 1): ControllerFocus {
	return { zone: 'actions', index: clamp(index, 0, Math.max(1, actionCount) - 1) };
}

export function focusMobileTab(index: number): ControllerFocus {
	return { zone: 'mobileTabs', index: clamp(index, 0, MOBILE_TAB_COUNT - 1) };
}

export function selectActiveBox(state: BoxNavigationState, index: number): BoxNavigationState {
	return { ...state, activeBox: clamp(index, 0, state.boxCount - 1) };
}

export function getFocusId(focus: ControllerFocus, activeBox: number): string {
	switch (focus.zone) {
		case 'topbar':
			return `top-control-${focus.index}`;
		case 'paneControls':
			return `pane-control-${focus.index}`;
		case 'party':
			return `party-slot-${focus.slot}`;
		case 'box':
			return `box-${activeBox}-slot-${focus.slot}`;
		case 'actions':
			return `slot-action-${focus.index}`;
		case 'mobileTabs':
			return `mobile-tab-${focus.index}`;
	}
}

export function getBoxSlotPosition(slot: number): { row: number; column: number } {
	const clampedSlot = clamp(slot, 0, BOX_SLOT_COUNT - 1);
	return {
		row: Math.floor(clampedSlot / BOX_COLUMNS),
		column: clampedSlot % BOX_COLUMNS
	};
}

function closeActionSurface(state: BoxNavigationState): BoxNavigationState {
	return {
		...state,
		focus: state.actionOrigin ?? state.focus,
		actionOrigin: null,
		actionSurfaceOpen: false
	};
}

function isSlotFocus(focus: ControllerFocus): focus is SlotFocus {
	return focus.zone === 'party' || focus.zone === 'box';
}

function focusFirstRowForBoxChange(focus: ControllerFocus): ControllerFocus {
	if (focus.zone !== 'box') {
		return focusBoxSlot(0);
	}

	return focusBoxSlot(getBoxSlotPosition(focus.slot).column);
}

function moveUp(
	focus: ControllerFocus,
	topControlCount: number,
	paneControlCount: number,
	partyAvailable: boolean,
	mobileTabsAvailable: boolean
): ControllerFocus {
	const sourceControlIndex = getSourceControlIndex(topControlCount);
	const firstTopControlIndex = getFirstTopControlIndex(mobileTabsAvailable);

	switch (focus.zone) {
		case 'topbar':
			if (sourceControlIndex !== null && focus.index === sourceControlIndex) {
				return focusTopControl(
					Math.max(firstTopControlIndex, sourceControlIndex - 1),
					topControlCount
				);
			}
			if (sourceControlIndex !== null && focus.index > sourceControlIndex) {
				return focusTopControl(sourceControlIndex, topControlCount);
			}
			return focus;
		case 'paneControls':
			if (partyAvailable) {
				return focusPartySlot(Math.min(focus.index, PARTY_SLOT_COUNT - 1));
			}
			return sourceControlIndex !== null
				? focusTopControl(sourceControlIndex, topControlCount)
				: focusTopControl(Math.min(focus.index, topControlCount - 1), topControlCount);
		case 'party':
			return sourceControlIndex !== null
				? focusTopControl(sourceControlIndex, topControlCount)
				: focusTopControl(Math.min(focus.slot, topControlCount - 1), topControlCount);
		case 'box': {
			const { row, column } = getBoxSlotPosition(focus.slot);
			if (row === 0) {
				if (paneControlCount > 0) {
					return focusPaneControl(Math.min(column, paneControlCount - 1), paneControlCount);
				}
				if (!partyAvailable) {
					return sourceControlIndex !== null
						? focusTopControl(sourceControlIndex, topControlCount)
						: focusTopControl(Math.min(column, topControlCount - 1), topControlCount);
				}
				return focusPartySlot(column);
			}
			return focusBoxSlot(focus.slot - BOX_COLUMNS);
		}
		case 'mobileTabs':
			return focusBoxSlot(BOX_SLOT_COUNT - BOX_COLUMNS + Math.min(focus.index, BOX_COLUMNS - 1));
		case 'actions':
			return focus;
	}
}

function moveDown(
	focus: ControllerFocus,
	topControlCount: number,
	paneControlCount: number,
	mobileTabsAvailable: boolean,
	partyAvailable: boolean
): ControllerFocus {
	switch (focus.zone) {
		case 'topbar':
			if (!partyAvailable) {
				if (paneControlCount > 0) {
					return focusPaneControl(0, paneControlCount);
				}
				return focusBoxSlot(Math.min(focus.index, BOX_COLUMNS - 1));
			}
			return focusPartySlot(Math.min(focus.index, PARTY_SLOT_COUNT - 1));
		case 'party':
			if (paneControlCount > 0) {
				return focusPaneControl(Math.min(focus.slot, paneControlCount - 1), paneControlCount);
			}
			return focusBoxSlot(Math.min(focus.slot, BOX_COLUMNS - 1));
		case 'paneControls':
			return focusBoxSlot(Math.min(focus.index, BOX_COLUMNS - 1));
		case 'box': {
			const { row } = getBoxSlotPosition(focus.slot);
			if (row === BOX_ROWS - 1) {
				return mobileTabsAvailable ? focusMobileTab(1) : focus;
			}
			return focusBoxSlot(focus.slot + BOX_COLUMNS);
		}
		case 'mobileTabs':
		case 'actions':
			return focus;
	}
}

function moveLeft(
	focus: ControllerFocus,
	topControlCount: number,
	paneControlCount: number,
	mobileTabsAvailable: boolean
): ControllerFocus {
	const firstTopControlIndex = getFirstTopControlIndex(mobileTabsAvailable);

	switch (focus.zone) {
		case 'topbar':
			return focusTopControl(
				clamp(focus.index - 1, firstTopControlIndex, topControlCount - 1),
				topControlCount
			);
		case 'paneControls':
			return focusPaneControl(focus.index - 1, paneControlCount);
		case 'party':
			return focusPartySlot(focus.slot - 1);
		case 'box': {
			const { column } = getBoxSlotPosition(focus.slot);
			return column === 0 ? focus : focusBoxSlot(focus.slot - 1);
		}
		case 'mobileTabs':
			return focus;
		case 'actions':
			return focus;
	}
}

function moveRight(
	focus: ControllerFocus,
	topControlCount: number,
	paneControlCount: number,
	mobileTabsAvailable: boolean
): ControllerFocus {
	const firstTopControlIndex = getFirstTopControlIndex(mobileTabsAvailable);

	switch (focus.zone) {
		case 'topbar':
			return focusTopControl(
				clamp(focus.index + 1, firstTopControlIndex, topControlCount - 1),
				topControlCount
			);
		case 'paneControls':
			return focusPaneControl(focus.index + 1, paneControlCount);
		case 'party':
			return focusPartySlot(focus.slot + 1);
		case 'box': {
			const { column } = getBoxSlotPosition(focus.slot);
			return column === BOX_COLUMNS - 1 ? focus : focusBoxSlot(focus.slot + 1);
		}
		case 'mobileTabs':
			return focus;
		case 'actions':
			return focus;
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function wrapBoxIndex(value: number, boxCount: number): number {
	const count = Math.max(1, boxCount);
	return ((value % count) + count) % count;
}

function getSourceControlIndex(topControlCount: number): number | null {
	return topControlCount > TOP_CONTROL_COUNT ? TOP_CONTROL_COUNT : null;
}

function getFirstTopControlIndex(mobileTabsAvailable: boolean): number {
	return mobileTabsAvailable ? 3 : 0;
}
