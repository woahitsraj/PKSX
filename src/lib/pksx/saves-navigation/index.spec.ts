import { describe, expect, it } from 'vitest';
import { deleteSavesTarget, moveSavesTarget, resolveSavesTarget, type SavesTarget } from '.';

const save = (id: string): Extract<SavesTarget, { kind: 'save-file' }> => ({
	kind: 'save-file',
	id
});
const importTarget: SavesTarget = { kind: 'import' };

describe('Saves navigation', () => {
	it('restores an existing target, then falls back to the active Save File, first Save File, or Import', () => {
		const targets = [save('a'), save('b'), importTarget];

		expect(resolveSavesTarget(targets, save('b'), 'a')).toEqual(save('b'));
		expect(resolveSavesTarget(targets, save('missing'), 'b')).toEqual(save('b'));
		expect(resolveSavesTarget(targets, null, 'missing')).toEqual(save('a'));
		expect(resolveSavesTarget([importTarget], null, null)).toEqual(importTarget);
	});

	it('clamps every outer edge without wrapping', () => {
		const targets = [save('a'), save('b'), save('c'), save('d'), importTarget];

		expect(moveSavesTarget(targets, save('a'), 2, 'left')).toEqual(save('a'));
		expect(moveSavesTarget(targets, save('a'), 2, 'up')).toEqual(save('a'));
		expect(moveSavesTarget(targets, save('b'), 2, 'right')).toEqual(save('b'));
		expect(moveSavesTarget(targets, save('d'), 2, 'right')).toEqual(save('d'));
		expect(moveSavesTarget(targets, importTarget, 2, 'down')).toEqual(importTarget);
	});

	it('uses the nearest column when moving down into an incomplete row', () => {
		const targets = [save('a'), save('b'), save('c'), save('d'), importTarget];

		expect(moveSavesTarget(targets, save('c'), 2, 'down')).toEqual(importTarget);
		expect(moveSavesTarget(targets, save('d'), 2, 'down')).toEqual(importTarget);
		expect(moveSavesTarget(targets, importTarget, 2, 'up')).toEqual(save('c'));
	});

	it('preserves target identity when the rendered column count changes', () => {
		const targets = [save('a'), save('b'), save('c'), save('d'), importTarget];
		const current = save('c');

		expect(resolveSavesTarget(targets, current, 'a')).toEqual(current);
		expect(moveSavesTarget(targets, current, 1, 'right')).toEqual(current);
		expect(moveSavesTarget(targets, current, 4, 'right')).toEqual(save('d'));
	});

	it('chooses the next Save File, previous Save File, then Import after deletion', () => {
		expect(deleteSavesTarget([save('a'), save('b'), save('c'), importTarget], save('b'))).toEqual(
			save('c')
		);
		expect(deleteSavesTarget([save('a'), save('b'), save('c'), importTarget], save('c'))).toEqual(
			save('b')
		);
		expect(deleteSavesTarget([save('a'), importTarget], save('a'))).toEqual(importTarget);
	});
});
