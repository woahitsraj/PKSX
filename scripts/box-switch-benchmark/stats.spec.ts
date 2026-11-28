import { expect, test } from 'vitest';
import { compare, summarize } from './stats.ts';

test('a gap inside the run-to-run variation is not measurable', () => {
	const base = summarize([17, 20, 18, 25, 19]);
	expect(base).toEqual({ median: 19, min: 17, max: 25 });
	expect(compare(base, summarize([22, 21, 24, 23, 20]))).toEqual({
		gap: 3,
		variation: 8,
		measurable: false
	});
	expect(compare(base, summarize([236, 240, 230, 250, 228])).measurable).toBe(true);
	// Same code on both sides, Scarlet settle times from a control run.
	const control = [summarize([4, 5, 5, 6, 7]), summarize([1, 1, 1, 2, 4])] as const;
	expect(compare(...control).measurable).toBe(true);
	expect(compare(...control, 17).measurable).toBe(false);
});
