import { describe, expect, it } from 'vitest';
import { filterSortSaves } from './saves-library';
import type { StoredSaveFile } from './saves';
import type { SaveCardDetailsState } from './saves-cache';

const files: StoredSaveFile[] = [
	{
		id: 'b',
		originalFileName: 'original.sav',
		displayName: 'Adventure',
		byteLength: 1,
		importedAt: '',
		updatedAt: ''
	},
	{
		id: 'a',
		originalFileName: 'fallback.sav',
		displayName: 'adventure',
		byteLength: 1,
		importedAt: '',
		updatedAt: ''
	},
	{ id: 'c', originalFileName: null, byteLength: 1, importedAt: '', updatedAt: '' }
];
const details: Record<string, SaveCardDetailsState> = {
	b: {
		status: 'ready',
		details: {
			summary: {
				gameVersion: 'E',
				saveType: 'SAV3E',
				gameVersionId: 3,
				generation: 3,
				trainerId: 1,
				playTime: '0:00',
				playedHours: 0,
				playedMinutes: 0,
				boxSlotCount: 30,
				trainerName: 'DIXIE',
				partyCount: 0,
				boxCount: 1
			},
			pokemonCount: 0
		}
	}
};
const ids = (query: string) =>
	filterSortSaves(files, details, query, 'alphabetical').map((file) => file.id);

describe('Saves library', () => {
	it('matches every identifying field without requiring parsed metadata', () => {
		expect(ids('EMERALD')).toEqual(['b']);
		expect(ids('dIxIe')).toEqual(['b']);
		expect(ids('ORIGINAL')).toEqual(['b']);
		expect(ids('adventure')).toEqual(['a', 'b']);
		expect(ids('fallback')).toEqual(['a']);
		expect(ids('missing')).toEqual([]);
		expect(ids('  ')).toEqual(['a', 'b', 'c']);
	});
	it('orders successful opens before unopened saves with stable identity ties', () => {
		const opened = files.map((file) => ({
			...file,
			...(file.id === 'c' ? { lastOpenedAt: '2026-11-14T12:00:00Z' } : {})
		}));
		expect(filterSortSaves(opened, details, '', 'recently-opened').map((file) => file.id)).toEqual([
			'c',
			'a',
			'b'
		]);
		expect(
			filterSortSaves([...opened].reverse(), details, '', 'recently-opened').map((file) => file.id)
		).toEqual(['c', 'a', 'b']);
		expect(files.every((file) => !file.lastOpenedAt)).toBe(true);
	});
});
