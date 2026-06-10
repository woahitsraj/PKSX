import { afterEach, describe, expect, it } from 'vitest';
import type { BoxSlotSummary, PartySlotSummary, SaveWorkspace } from '$lib/engine';
import type { StoredSaveFile } from '$lib/pksx/local-library';
import { createCleanWorkspaceState } from '$lib/pksx/backup-workflow';
import {
	getCachedSaveLibrarySnapshot,
	invalidateActiveWorkspaceCache,
	invalidateSaveLibraryCache,
	isCachedSaveLibrarySnapshotSeeded,
	seedSaveLibrarySnapshotFromActiveWorkspace,
	setCachedActiveWorkspace
} from './save-library-cache';

const saveFile: StoredSaveFile = {
	id: 'save-1',
	originalFileName: 'emerald.sav',
	byteLength: 4,
	importedAt: '2026-06-01T10:00:00.000Z',
	updatedAt: '2026-06-02T10:00:00.000Z'
};

const summary: SaveWorkspace['summary'] = {
	fileName: 'emerald.sav',
	saveType: 'SAV3',
	gameVersion: 'E',
	gameVersionId: 3,
	generation: 3,
	trainerName: 'CASS',
	trainerId: 41203,
	playTime: '47:12',
	playedHours: 47,
	playedMinutes: 12,
	partyCount: 1,
	boxCount: 14,
	boxSlotCount: 30
};

const partySlot: PartySlotSummary = {
	slot: 0,
	speciesId: 304,
	form: 0,
	format: 3,
	level: 12,
	experience: 100,
	experienceProjection: null,
	nickname: 'ARON',
	isEgg: false,
	isEmpty: false,
	types: [],
	stats: [],
	moves: [],
	statEditConstraints: {
		supported: false,
		minIv: 0,
		maxIv: 31,
		minEv: 0,
		maxEv: 255,
		maxTotalEv: 510,
		unsupportedReason: 'Fixture'
	},
	moveSetEditConstraints: {
		supported: false,
		maxMoveSlots: 4,
		availableMoves: [],
		unsupportedReason: 'Fixture'
	},
	spriteIdentity: {
		speciesId: 304,
		form: 0,
		isEgg: false,
		isShiny: false,
		displaySex: 'default'
	}
};

const boxSlot: BoxSlotSummary = {
	...partySlot,
	box: 0,
	slot: 0
};

const workspace: SaveWorkspace = {
	summary,
	partySlots: [partySlot],
	boxSlots: [boxSlot, { ...boxSlot, slot: 1, isEmpty: true, nickname: '' }]
};

describe('save library cache', () => {
	afterEach(() => {
		invalidateSaveLibraryCache();
		invalidateActiveWorkspaceCache();
	});

	it('seeds a save library snapshot from the already-loaded active workspace', () => {
		expect.assertions(8);

		const activeWorkspace = createCleanWorkspaceState({
			file: saveFile,
			bytes: new Uint8Array([1, 2, 3, 4]),
			workspace
		});

		setCachedActiveWorkspace(activeWorkspace, 0);
		const seeded = seedSaveLibrarySnapshotFromActiveWorkspace([saveFile]);

		expect(seeded).not.toBeNull();
		expect(isCachedSaveLibrarySnapshotSeeded()).toBe(true);
		expect(getCachedSaveLibrarySnapshot()).toBe(seeded);
		expect(seeded?.activeSaveFileId).toBe(saveFile.id);
		expect(seeded?.saveFiles).toEqual([saveFile]);
		expect(seeded?.detailsBySaveFileId[saveFile.id]?.summary).toBe(summary);
		expect(seeded?.detailsBySaveFileId[saveFile.id]?.partySlots).toEqual([partySlot]);
		expect(seeded?.detailsBySaveFileId[saveFile.id]?.creatureCount).toBe(1);
	});

	it('does not seed when no active workspace is cached', () => {
		expect.assertions(2);

		expect(seedSaveLibrarySnapshotFromActiveWorkspace([saveFile])).toBeNull();
		expect(getCachedSaveLibrarySnapshot()).toBeNull();
	});
});
