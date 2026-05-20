import { describe, expect, it } from 'vitest';

import {
	applyNavigationAction,
	createInitialNavigationState,
	focusBoxSlot,
	focusPartySlot,
	getFocusId,
	type BoxNavigationState
} from './index';

describe('box navigation', () => {
	it('starts on the first box slot', () => {
		expect.assertions(1);

		expect(createInitialNavigationState(3)).toEqual({
			focus: { zone: 'box', slot: 0 },
			activeBox: 0,
			boxCount: 3,
			actionSurfaceOpen: false
		});
	});

	it('clamps movement at party and box edges', () => {
		expect.assertions(4);

		expect(move({ focus: focusPartySlot(0) }, 'up').focus).toEqual(focusPartySlot(0));
		expect(move({ focus: focusPartySlot(5) }, 'down').focus).toEqual(focusPartySlot(5));
		expect(move({ focus: focusBoxSlot(0) }, 'up').focus).toEqual(focusBoxSlot(0));
		expect(move({ focus: focusBoxSlot(5) }, 'right').focus).toEqual(focusBoxSlot(5));
	});

	it('transitions explicitly between party and box focus zones', () => {
		expect.assertions(4);

		expect(move({ focus: focusPartySlot(2) }, 'right').focus).toEqual(focusBoxSlot(12));
		expect(move({ focus: focusPartySlot(5) }, 'right').focus).toEqual(focusBoxSlot(24));
		expect(move({ focus: focusBoxSlot(12) }, 'left').focus).toEqual(focusPartySlot(2));
		expect(move({ focus: focusBoxSlot(13) }, 'left').focus).toEqual(focusBoxSlot(12));
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

	it('opens and dismisses the slot action surface without moving focus', () => {
		expect.assertions(3);

		const opened = move({ focus: focusBoxSlot(8) }, 'confirm');
		expect(opened).toMatchObject({ actionSurfaceOpen: true, focus: focusBoxSlot(8) });
		expect(applyNavigationAction(opened, 'right')).toBe(opened);
		expect(applyNavigationAction(opened, 'back')).toMatchObject({
			actionSurfaceOpen: false,
			focus: focusBoxSlot(8)
		});
	});

	it('exposes stable active descendant ids', () => {
		expect.assertions(2);

		expect(getFocusId(focusPartySlot(4), 1)).toBe('party-slot-4');
		expect(getFocusId(focusBoxSlot(4), 1)).toBe('box-1-slot-4');
	});
});

function move(
	overrides: Partial<BoxNavigationState>,
	action: Parameters<typeof applyNavigationAction>[1]
): BoxNavigationState {
	return applyNavigationAction({ ...createInitialNavigationState(3), ...overrides }, action);
}
