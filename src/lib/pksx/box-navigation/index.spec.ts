import { describe, expect, it } from 'vitest';

import {
	applyNavigationAction,
	createInitialNavigationState,
	focusActionCommand,
	focusBoxSlot,
	focusMobileTab,
	focusPaneBoundarySlot,
	focusPaneControl,
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
		expect.assertions(7);

		expect(move({ focus: focusTopControl(1) }, 'down').focus).toEqual(focusPartySlot(1));
		expect(move({ focus: focusPartySlot(2) }, 'down').focus).toEqual(focusBoxSlot(2));
		expect(move({ focus: focusBoxSlot(2) }, 'up').focus).toEqual(focusPartySlot(2));
		expect(move({ focus: focusBoxSlot(28) }, 'down').focus).toEqual(focusMobileTab(1));
		expect(move({ focus: focusPartySlot(5) }, 'down', { paneControlCount: 2 }).focus).toEqual(
			focusPaneControl(1, 2)
		);
		expect(move({ focus: focusPaneControl(1, 2) }, 'down', { paneControlCount: 2 }).focus).toEqual(
			focusBoxSlot(1)
		);
		expect(move({ focus: focusBoxSlot(0) }, 'up', { paneControlCount: 2 }).focus).toEqual(
			focusPaneControl(0, 2)
		);
	});

	it('can reach the sixth top control and pane close control', () => {
		expect.assertions(5);

		const addSource = applyNavigationAction(
			{ ...createInitialNavigationState(3), focus: focusTopControl(4, 6) },
			'right',
			{ topControlCount: 6 }
		);

		expect(addSource.focus).toEqual(focusTopControl(5, 6));
		expect(getFocusId(addSource.focus, 0)).toBe('top-control-5');
		expect(move({ focus: focusTopControl(0, 6) }, 'down', { topControlCount: 6 }).focus).toEqual(
			focusTopControl(5, 6)
		);
		expect(move({ focus: focusTopControl(5, 6) }, 'down', { topControlCount: 6 }).focus).toEqual(
			focusPartySlot(5)
		);
		expect(move({ focus: focusPaneControl(0, 2) }, 'right', { paneControlCount: 2 }).focus).toEqual(
			focusPaneControl(1, 2)
		);
	});

	it('moves up from any party slot to Add source before top controls', () => {
		expect.assertions(6);

		for (let slot = 0; slot < 6; slot += 1) {
			expect(move({ focus: focusPartySlot(slot) }, 'up', { topControlCount: 6 }).focus).toEqual(
				focusTopControl(5, 6)
			);
		}
	});

	it('can reach a single pane source selector from party and box focus', () => {
		expect.assertions(3);

		expect(move({ focus: focusPartySlot(0) }, 'down', { paneControlCount: 1 }).focus).toEqual(
			focusPaneControl(0, 1)
		);
		expect(move({ focus: focusBoxSlot(0) }, 'up', { paneControlCount: 1 }).focus).toEqual(
			focusPaneControl(0, 1)
		);
		expect(move({ focus: focusPaneControl(0, 1) }, 'down', { paneControlCount: 1 }).focus).toEqual(
			focusBoxSlot(0)
		);
	});

	it('skips party focus for box-only sources', () => {
		expect.assertions(4);

		const options = { topControlCount: 6, paneControlCount: 0, partyAvailable: false };

		expect(move({ focus: focusTopControl(5, 6) }, 'down', options).focus).toEqual(focusBoxSlot(5));
		expect(move({ focus: focusBoxSlot(5) }, 'up', options).focus).toEqual(focusTopControl(5, 6));
		expect(
			move({ focus: focusTopControl(5, 6) }, 'down', { ...options, paneControlCount: 1 }).focus
		).toEqual(focusPaneControl(0, 1));
		expect(
			move({ focus: focusPaneControl(0, 1) }, 'up', { ...options, paneControlCount: 1 }).focus
		).toEqual(focusTopControl(5, 6));
	});

	it('projects pane crossing to the opposite pane edge in the same row', () => {
		expect.assertions(4);

		expect(focusPaneBoundarySlot(5, 'right')).toEqual(focusBoxSlot(0));
		expect(focusPaneBoundarySlot(11, 'right')).toEqual(focusBoxSlot(6));
		expect(focusPaneBoundarySlot(0, 'left')).toEqual(focusBoxSlot(5));
		expect(focusPaneBoundarySlot(24, 'left')).toEqual(focusBoxSlot(29));
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

	it('moves focus to the first row when changing boxes and wraps at edges', () => {
		expect.assertions(5);

		let state = move({ focus: focusBoxSlot(17), activeBox: 1 }, 'nextBox');
		expect(state).toMatchObject({ activeBox: 2, focus: focusBoxSlot(5) });

		state = move(state, 'nextBox');
		expect(state).toMatchObject({ activeBox: 0, focus: focusBoxSlot(5) });

		state = move(state, 'previousBox');
		expect(state).toMatchObject({ activeBox: 2, focus: focusBoxSlot(5) });

		state = move(state, 'previousBox');
		expect(state).toMatchObject({ activeBox: 1, focus: focusBoxSlot(5) });

		expect(move({ focus: focusPartySlot(3), activeBox: 1 }, 'nextBox')).toMatchObject({
			activeBox: 2,
			focus: focusBoxSlot(0)
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
		expect.assertions(5);

		expect(getFocusId(focusTopControl(1), 1)).toBe('top-control-1');
		expect(getFocusId(focusPaneControl(1, 2), 1)).toBe('pane-control-1');
		expect(getFocusId(focusPartySlot(4), 1)).toBe('party-slot-4');
		expect(getFocusId(focusBoxSlot(4), 1)).toBe('box-1-slot-4');
		expect(getFocusId(focusMobileTab(2), 1)).toBe('mobile-tab-2');
	});
});

function move(
	overrides: Partial<BoxNavigationState>,
	action: Parameters<typeof applyNavigationAction>[1],
	options: Parameters<typeof applyNavigationAction>[2] = {}
): BoxNavigationState {
	return applyNavigationAction(
		{ ...createInitialNavigationState(3), ...overrides },
		action,
		options
	);
}
