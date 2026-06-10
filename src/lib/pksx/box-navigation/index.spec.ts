import { describe, expect, it } from 'vitest';

import {
	applyNavigationAction,
	createInitialNavigationState,
	focusActionCommand,
	focusBoxSlot,
	focusMobileTab,
	focusPartySlot,
	focusTopControl,
	getFocusId,
	selectActiveBox,
	type BoxNavigationState
} from './index';

describe('box navigation', () => {
	it('starts on the first box slot', () => {
		expect.assertions(1);

		expect(createInitialNavigationState(3)).toEqual({
			focus: { zone: 'box', slot: 0 },
			actionOrigin: null,
			activeBox: 0,
			boxCount: 3,
			actionSurfaceOpen: false
		});
	});

	it('clamps horizontal movement at party and box edges', () => {
		expect.assertions(4);

		expect(move({ focus: focusPartySlot(0) }, 'left').focus).toEqual(focusPartySlot(0));
		expect(move({ focus: focusPartySlot(5) }, 'right').focus).toEqual(focusPartySlot(5));
		expect(move({ focus: focusBoxSlot(0) }, 'left').focus).toEqual(focusBoxSlot(0));
		expect(move({ focus: focusBoxSlot(5) }, 'right').focus).toEqual(focusBoxSlot(5));
	});

	it('transitions vertically between top controls, party, box, and mobile tabs', () => {
		expect.assertions(4);

		expect(move({ focus: focusTopControl(1) }, 'down').focus).toEqual(focusPartySlot(1));
		expect(move({ focus: focusPartySlot(2) }, 'down').focus).toEqual(focusBoxSlot(2));
		expect(move({ focus: focusBoxSlot(2) }, 'up').focus).toEqual(focusPartySlot(2));
		expect(move({ focus: focusBoxSlot(28) }, 'down').focus).toEqual(focusMobileTab(1));
	});

	it('reaches all rendered top controls and mobile tabs', () => {
		expect.assertions(4);

		expect(move({ focus: focusTopControl(4) }, 'right').focus).toEqual(focusTopControl(5));
		expect(move({ focus: focusTopControl(7) }, 'right').focus).toEqual(focusTopControl(7));
		expect(move({ focus: focusMobileTab(1) }, 'right').focus).toEqual(focusMobileTab(2));
		expect(move({ focus: focusMobileTab(2) }, 'right').focus).toEqual(focusMobileTab(2));
	});

	it('keeps desktop focus on the last box row when mobile tabs are unavailable', () => {
		expect.assertions(1);

		const state = applyNavigationAction(
			{ ...createInitialNavigationState(3), focus: focusBoxSlot(28) },
			'down',
			{ mobileTabsAvailable: false }
		);

		expect(state.focus).toEqual(focusBoxSlot(28));
	});

	it('preserves the focused slot coordinate when changing boxes and wraps at edges', () => {
		expect.assertions(5);

		let state = move({ focus: focusBoxSlot(17), activeBox: 1 }, 'nextBox');
		expect(state).toMatchObject({ activeBox: 2, focus: focusBoxSlot(17) });

		state = move(state, 'nextBox');
		expect(state).toMatchObject({ activeBox: 0, focus: focusBoxSlot(17) });

		state = move(state, 'previousBox');
		expect(state).toMatchObject({ activeBox: 2, focus: focusBoxSlot(17) });

		state = move(state, 'previousBox');
		expect(state).toMatchObject({ activeBox: 1, focus: focusBoxSlot(17) });

		expect(move({ focus: focusPartySlot(3), activeBox: 1 }, 'nextBox')).toMatchObject({
			activeBox: 2,
			focus: focusPartySlot(3)
		});
	});

	it('selects a specific box in one state transition', () => {
		expect.assertions(3);

		const state = selectActiveBox(
			{ ...createInitialNavigationState(30), activeBox: 0, focus: focusBoxSlot(17) },
			29
		);

		expect(state).toMatchObject({ activeBox: 29, focus: focusBoxSlot(17) });
		expect(selectActiveBox(state, -1)).toMatchObject({ activeBox: 0 });
		expect(selectActiveBox(state, 40)).toMatchObject({ activeBox: 29 });
	});

	it('opens the slot action surface, moves through commands, and dismisses to the source slot', () => {
		expect.assertions(4);

		const opened = move({ focus: focusBoxSlot(8) }, 'confirm');
		expect(opened).toMatchObject({
			actionSurfaceOpen: true,
			actionOrigin: focusBoxSlot(8),
			focus: focusActionCommand(0)
		});
		expect(applyNavigationAction(opened, 'down', { actionCount: 3 })).toMatchObject({
			focus: focusActionCommand(1, 3)
		});
		expect(applyNavigationAction(opened, 'right', { actionCount: 3 })).toMatchObject({
			focus: focusActionCommand(1, 3)
		});
		expect(applyNavigationAction(opened, 'back')).toMatchObject({
			actionSurfaceOpen: false,
			actionOrigin: null,
			focus: focusBoxSlot(8)
		});
	});

	it('exposes stable active descendant ids', () => {
		expect.assertions(4);

		expect(getFocusId(focusTopControl(1), 1)).toBe('top-control-1');
		expect(getFocusId(focusPartySlot(4), 1)).toBe('party-slot-4');
		expect(getFocusId(focusBoxSlot(4), 1)).toBe('box-1-slot-4');
		expect(getFocusId(focusMobileTab(2), 1)).toBe('mobile-tab-2');
	});
});

function move(
	overrides: Partial<BoxNavigationState>,
	action: Parameters<typeof applyNavigationAction>[1]
): BoxNavigationState {
	return applyNavigationAction({ ...createInitialNavigationState(3), ...overrides }, action);
}
