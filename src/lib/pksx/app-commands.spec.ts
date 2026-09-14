import { describe, expect, test } from 'vitest';
import { appCommandForEvent } from './app-commands';

const keyboardEvent = (shiftKey: boolean) => ({
	key: 'k',
	metaKey: false,
	ctrlKey: true,
	altKey: false,
	shiftKey
});

describe('app commands', () => {
	test('matches keyboard and controller shortcuts from the shared registry', () => {
		expect(appCommandForEvent(keyboardEvent(false), false)).toBe('search');
		expect(
			appCommandForEvent({ ...keyboardEvent(false), metaKey: true, ctrlKey: false }, false)
		).toBe('search');
		expect(appCommandForEvent(keyboardEvent(true), false)).toBe('main-menu');
		expect(appCommandForEvent({ ...keyboardEvent(false), key: 'Y' }, true)).toBe('search');
		expect(appCommandForEvent({ ...keyboardEvent(false), key: 'Menu' }, true)).toBe('main-menu');
	});

	test('ignores unrelated keyboard input', () => {
		expect(appCommandForEvent({ ...keyboardEvent(false), ctrlKey: false }, false)).toBeNull();
		expect(appCommandForEvent({ ...keyboardEvent(false), altKey: true }, false)).toBeNull();
	});
});
