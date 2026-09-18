import { describe, expect, it } from 'vitest';

import {
	boxNameFor,
	createPhysicalBoxPickerLocations,
	moveBoxPickerControllerFocus,
	moveBoxPickerFocus
} from './index';

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

	it('uses engine-reported Box Names while preserving numeric position details', () => {
		expect(
			createPhysicalBoxPickerLocations(2, {
				supported: true,
				names: ['Friends', 'Training'],
				unsupportedReason: null
			})
		).toEqual([
			{
				id: 'physical-box-0',
				label: 'Friends',
				detail: '1 of 2',
				location: { kind: 'physical-box', box: 0 }
			},
			{
				id: 'physical-box-1',
				label: 'Training',
				detail: '2 of 2',
				location: { kind: 'physical-box', box: 1 }
			}
		]);
	});

	it('falls back to numbered labels when the engine reports Box Names unavailable or blank', () => {
		expect(
			boxNameFor(0, {
				supported: false,
				names: [],
				unsupportedReason: 'Box Names are not available for this Save File format.'
			})
		).toBe('Box 01');
		expect(
			boxNameFor(1, { supported: true, names: ['Friends', ''], unsupportedReason: null })
		).toBe('Box 02');
	});

	it('follows the rendered grid and wraps incomplete rows', () => {
		expect(moveBoxPickerFocus(0, 'left', 6, 4)).toBe(3);
		expect(moveBoxPickerFocus(3, 'right', 6, 4)).toBe(0);
		expect(moveBoxPickerFocus(1, 'down', 6, 4)).toBe(5);
		expect(moveBoxPickerFocus(3, 'down', 6, 4)).toBe(5);
		expect(moveBoxPickerFocus(5, 'up', 6, 4)).toBe(1);
	});

	it('moves Controller Focus through rename without losing the selected Box', () => {
		const grid = { zone: 'locations', locationIndex: 1, formIndex: 0 } as const;
		const command = moveBoxPickerControllerFocus(grid, 'up', 6, 4, true);
		expect(command).toEqual({ ...grid, zone: 'rename-command' });
		expect(moveBoxPickerControllerFocus(command, 'down', 6, 4, true)).toEqual(grid);

		const form = { ...grid, zone: 'rename-form' } as const;
		expect(moveBoxPickerControllerFocus(form, 'down', 6, 4, true)).toEqual({
			...form,
			formIndex: 1
		});
		expect(moveBoxPickerControllerFocus(form, 'up', 6, 4, true)).toEqual({
			...form,
			formIndex: 2
		});
	});
});
