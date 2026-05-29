import { describe, expect, it } from 'vitest';
import type { SaveWorkspace } from '$lib/engine';
import type { StoredSaveFile } from '$lib/pksx/local-library';
import {
	createCleanWorkspaceState,
	createRestoredWorkspaceState,
	preserveRestoredWorkspaceAsSave,
	shouldCreateAutomaticBackup,
	markAutomaticBackupCreated
} from './index';

const workspace: SaveWorkspace = {
	summary: {
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
	},
	partySlots: [],
	boxSlots: []
};

const saveFile: StoredSaveFile = {
	id: 'save-1',
	originalFileName: 'emerald.sav',
	byteLength: 4,
	importedAt: '2026-05-28T10:00:00.000Z',
	updatedAt: '2026-05-28T10:00:00.000Z'
};

describe('backup workflow', () => {
	it('creates clean workspace state for a loaded save file', () => {
		const bytes = new Uint8Array([1, 2, 3, 4]);
		const state = createCleanWorkspaceState({ file: saveFile, bytes, workspace });
		bytes[0] = 99;

		expect(state.dirty).toBe(false);
		expect(state.restoredFromBackup).toBeNull();
		expect(state.automaticBackupCreated).toBe(false);
		expect(state.bytes).toStrictEqual(new Uint8Array([1, 2, 3, 4]));
	});

	it('marks restored backup state dirty when it differs from the save artifact', () => {
		const state = createRestoredWorkspaceState({
			file: saveFile,
			bytes: new Uint8Array([9, 9, 9, 9]),
			currentSaveBytes: new Uint8Array([1, 2, 3, 4]),
			workspace,
			source: {
				id: 'backup-1',
				createdAt: '2026-05-28T11:00:00.000Z',
				reason: 'manual'
			}
		});

		expect(state.dirty).toBe(true);
		expect(state.restoredFromBackup?.id).toBe('backup-1');
	});

	it('keeps restored state clean when backup bytes match the save artifact', () => {
		const state = createRestoredWorkspaceState({
			file: saveFile,
			bytes: new Uint8Array([1, 2, 3, 4]),
			currentSaveBytes: new Uint8Array([1, 2, 3, 4]),
			workspace,
			source: {
				id: 'backup-1',
				createdAt: '2026-05-28T11:00:00.000Z',
				reason: 'manual'
			}
		});

		expect(state.dirty).toBe(false);
	});

	it('clears restored dirty state after preserving as a separate save file', () => {
		const restored = createRestoredWorkspaceState({
			file: saveFile,
			bytes: new Uint8Array([9, 9, 9, 9]),
			currentSaveBytes: new Uint8Array([1, 2, 3, 4]),
			workspace,
			source: {
				id: 'backup-1',
				createdAt: '2026-05-28T11:00:00.000Z',
				reason: 'manual'
			}
		});
		const separateSave = { ...saveFile, id: 'save-2' };

		const preserved = preserveRestoredWorkspaceAsSave(restored, separateSave);

		expect(preserved.file.id).toBe('save-2');
		expect(preserved.dirty).toBe(false);
		expect(preserved.restoredFromBackup).toBeNull();
	});

	it('creates at most one automatic backup per workspace state', () => {
		const state = createCleanWorkspaceState({
			file: saveFile,
			bytes: new Uint8Array([1, 2, 3, 4]),
			workspace
		});

		expect(shouldCreateAutomaticBackup(state)).toBe(true);
		expect(shouldCreateAutomaticBackup(markAutomaticBackupCreated(state))).toBe(false);
	});
});
