import { describe, expect, it } from 'vitest';
import {
	clampBoxToSource,
	createInitialStorageBoxes,
	sortStorageBoxes,
	STORAGE_BOX_CAPACITY,
	storageBoxLabel
} from './index';

describe('storageBoxLabel', () => {
	it('numbers unnamed Storage Boxes by position', () => {
		expect(storageBoxLabel({ position: 0, name: null })).toBe('Storage 01');
		expect(storageBoxLabel({ position: 11, name: null })).toBe('Storage 12');
	});

	it('prefers a custom name when present', () => {
		expect(storageBoxLabel({ position: 0, name: 'Trade Pile' })).toBe('Trade Pile');
	});
});

describe('createInitialStorageBoxes', () => {
	it('starts Pokemon Storage with one unnamed box', () => {
		const boxes = createInitialStorageBoxes(() => 'box-1');
		expect(boxes).toEqual([{ id: 'box-1', position: 0, name: null }]);
	});
});

describe('clampBoxToSource', () => {
	it('preserves the active box number when the new source has it', () => {
		expect(clampBoxToSource(2, 32)).toBe(2);
	});

	it('clamps to the nearest available box otherwise', () => {
		expect(clampBoxToSource(7, 1)).toBe(0);
		expect(clampBoxToSource(7, 3)).toBe(2);
	});

	it('never goes below the first box', () => {
		expect(clampBoxToSource(-1, 3)).toBe(0);
	});
});

describe('sortStorageBoxes', () => {
	it('orders boxes by position without mutating the input', () => {
		const boxes = [{ position: 2 }, { position: 0 }, { position: 1 }];
		expect(sortStorageBoxes(boxes).map((box) => box.position)).toEqual([0, 1, 2]);
		expect(boxes.map((box) => box.position)).toEqual([2, 0, 1]);
	});
});

describe('STORAGE_BOX_CAPACITY', () => {
	it('matches the save box grid shape', () => {
		expect(STORAGE_BOX_CAPACITY).toBe(30);
	});
});
