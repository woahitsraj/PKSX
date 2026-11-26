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
const details = {
	b: {
		status: 'ready',
		details: {
			summary: {
				gameVersion: 'E',
				saveType: 'SAV3E',
				gameVersionId: 3,
				generation: 3,
				trainerId: 1,
				rawTrainerId: 0,
				rawSecretId: 0,
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
} satisfies Record<string, SaveCardDetailsState>;
const ids = (query: string) =>
	filterSortSaves({ files, details, query, sort: 'alphabetical' }).map((file) => file.id);

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
	it.each([
		{ gameVersion: 'RB', queries: ['Red', 'Blue'] },
		{ gameVersion: 'GS', queries: ['Gold', 'Silver'] },
		{ gameVersion: 'RS', queries: ['Ruby', 'Sapphire'] },
		{ gameVersion: 'FR', queries: ['FireRed', 'LeafGreen'] },
		{ gameVersion: 'DP', queries: ['Diamond', 'Pearl'] },
		{ gameVersion: 'RSBOX', queries: ['Box', 'Ruby', 'Sapphire'] },
		{ gameVersion: 'BATREV', queries: ['Battle Revolution'] },
		{ gameVersion: 'ZA', queries: ['Legends Z-A'] }
	])(
		'finds engine version $gameVersion by game name with a generic filename',
		({ gameVersion, queries }) => {
			for (const query of queries) {
				expect(
					filterSortSaves({
						files: [{ ...files[0], originalFileName: 'main.sav', displayName: null }],
						details: {
							b: {
								status: 'ready',
								details: {
									...details.b.details,
									summary: { ...details.b.details.summary, gameVersion }
								}
							}
						},
						query: query.toUpperCase(),
						sort: 'alphabetical'
					}).map((file) => file.id)
				).toEqual(['b']);
			}
		}
	);
	it('orders successful opens before unopened saves with stable identity ties', () => {
		const opened = files.map((file) => ({
			...file,
			...(file.id === 'c' ? { lastOpenedAt: '2026-11-14T12:00:00Z' } : {})
		}));
		expect(
			filterSortSaves({ files: opened, details, query: '', sort: 'recently-opened' }).map(
				(file) => file.id
			)
		).toEqual(['c', 'a', 'b']);
		expect(
			filterSortSaves({
				files: [...opened].reverse(),
				details,
				query: '',
				sort: 'recently-opened'
			}).map((file) => file.id)
		).toEqual(['c', 'a', 'b']);
		expect(
			filterSortSaves({
				files: files.map((file) => ({ ...file, lastOpenedAt: '2026-11-14T12:00:00Z' })),
				details,
				query: '',
				sort: 'recently-opened'
			}).map((file) => file.id)
		).toEqual(['a', 'b', 'c']);
		expect(files.every((file) => !file.lastOpenedAt)).toBe(true);
	});
});
