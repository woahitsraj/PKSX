import { describe, expect, it } from 'vitest';
import type { SaveSummary } from '$lib/engine';
import type { StoredSaveFile } from '$lib/pksx/saves';
import { findSaveImportMatches } from './save-import-match';

const summary = (rawTrainerId: number, rawSecretId = 0) =>
	({ saveType: 'SAV3E', gameVersionId: 3, rawTrainerId, rawSecretId }) as SaveSummary;

function find(
	stored: Record<string, [number[], SaveSummary]>,
	bytes: number[],
	incoming: SaveSummary
) {
	const files = Object.keys(stored).map((id) => ({ id, originalFileName: id }) as StoredSaveFile);
	return findSaveImportMatches({
		storage: {
			listSaves: async () => files,
			getSaveBytes: async (id) => new Uint8Array(stored[id][0])
		},
		engine: {
			summarizeSave: async (bytes) => ({
				ok: true,
				value: Object.values(stored).find(([b]) => b[0] === bytes[0])![1],
				error: null
			})
		},
		bytes: new Uint8Array(bytes),
		summary: incoming
	}).then((matches) => matches.map((match) => [match.saveFile.id, match.exact]));
}

describe('findSaveImportMatches', () => {
	it('separates no match, exact match, revised match, and multiple matches', async () => {
		const library = {
			a: [[1], summary(10, 20)],
			b: [[2], summary(10, 20)],
			c: [[3], summary(10, 21)],
			d: [[4], summary(11, 20)]
		} satisfies Record<string, [number[], SaveSummary]>;
		expect(await find(library, [9], summary(12, 20))).toEqual([]);
		expect(await find(library, [3], summary(10, 21))).toEqual([['c', true]]);
		expect(await find(library, [9], summary(11, 20))).toEqual([['d', false]]);
		expect(await find(library, [1], summary(10, 20))).toEqual([
			['a', true],
			['b', false]
		]);
	});
});
