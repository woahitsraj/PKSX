import { describe, expect, it } from 'vitest';

import { createPhysicalBoxPickerLocations, moveBoxPickerFocus } from './index';

describe('box picker', () => {
	it('creates one numbered physical Location for every reported Box', () => {
		expect(createPhysicalBoxPickerLocations(3)).toEqual([
			{
				id: 'physical-box-0',
				label: 'Box 01',
				detail: '1 of 3',
				location: { kind: 'physical-box', box: 0 }
			},
			{
				id: 'physical-box-1',
				label: 'Box 02',
				detail: '2 of 3',
				location: { kind: 'physical-box', box: 1 }
			},
			{
				id: 'physical-box-2',
				label: 'Box 03',
				detail: '3 of 3',
				location: { kind: 'physical-box', box: 2 }
			}
		]);
	});

	it('keeps virtual Location identity available to future picker consumers', () => {
		const locations = createPhysicalBoxPickerLocations(1);

		expect(locations[0].location).toEqual({ kind: 'physical-box', box: 0 });
	});

	it('follows the rendered grid and wraps incomplete rows', () => {
		expect(moveBoxPickerFocus(0, 'left', 6, 4)).toBe(3);
		expect(moveBoxPickerFocus(3, 'right', 6, 4)).toBe(0);
		expect(moveBoxPickerFocus(1, 'down', 6, 4)).toBe(5);
		expect(moveBoxPickerFocus(3, 'down', 6, 4)).toBe(5);
		expect(moveBoxPickerFocus(5, 'up', 6, 4)).toBe(1);
	});
});
