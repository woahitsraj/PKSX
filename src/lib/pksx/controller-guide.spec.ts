import { describe, expect, it } from 'vitest';
import { controllerGuideHints, type ControllerGuideContext } from './controller-guide';

const base: ControllerGuideContext = {
	destination: 'boxes',
	workflow: null,
	carry: false,
	selection: false
};
const actions = (context: Partial<ControllerGuideContext>) =>
	controllerGuideHints({ ...base, ...context }).map((hint) => `${hint.button} ${hint.action}`);

describe('controllerGuideHints', () => {
	it('names Select on Boxes and Back on other destinations', () => {
		expect(actions({})).toContain('Select Select');
		expect(actions({ destination: 'settings' })).toContain('B Boxes');
	});

	it('follows Select mode, Carry, Menus, confirmations and Takeovers', () => {
		expect(actions({ selection: true })).toContain('B Exit Select');
		expect(actions({ carry: true })).toContain('B Cancel');
		expect(actions({ workflow: 'box-menu' })).toContain('B Close');
		expect(actions({ workflow: 'clear-slot-confirmation' })).toContain('A Confirm');
		expect(actions({ workflow: 'save-file-legality-report' })).toContain('B Back');
	});
});
