import { describe, expect, it, vi } from 'vitest';
import type { SaveSummary, SaveWorkspace } from '$lib/engine';
import {
	applySaveFileEditorEdits,
	cancelSaveFileEditor,
	createSaveFileEditOperation,
	createSaveFileEditorState,
	isSameSaveFileEditorSourceIdentity,
	stageSaveFileEditorEdit,
	stageTrainerNameEdit,
	type SaveFileEditorApplyServices
} from '.';

const summary: SaveSummary = {
	fileName: 'emerald.sav',
	saveType: 'SAV3',
	gameVersion: 'E',
	gameVersionId: 3,
	generation: 3,
	trainerName: 'DIXIE',
	trainerId: 12345,
	playTime: '10:22',
	playedHours: 10,
	playedMinutes: 22,
	partyCount: 2,
	boxCount: 14,
	boxSlotCount: 30
};

const updatedSummary: SaveSummary = {
	...summary,
	trainerName: 'RAJ'
};

const workspace: SaveWorkspace = {
	summary,
	partySlots: [],
	boxSlots: []
};

const updatedWorkspace: SaveWorkspace = {
	...workspace,
	summary: updatedSummary
};

const committedWorkspace = {
	dirty: false,
	automaticBackupCreated: false
};

const source = {
	saveFileId: 'save-1',
	fileName: 'emerald.sav'
};

const stagedEdit = {
	id: 'trainer-name',
	field: 'trainer-profile' as const,
	label: 'Set trainer name',
	payload: { trainerName: 'RAJ' }
};

function openEditor() {
	const opened = createSaveFileEditorState(source, summary, committedWorkspace);
	if (!opened.ok) throw new Error('Expected Save File Editor to open.');
	return opened.state;
}

function applyServices(
	overrides: Partial<SaveFileEditorApplyServices> = {}
): SaveFileEditorApplyServices {
	return {
		validate: vi.fn(async () => ({ ok: true as const })),
		ensureBackup: vi.fn(async () => ({
			ok: true as const,
			committedWorkspace: { dirty: false, automaticBackupCreated: true }
		})),
		mutateSaveFile: vi.fn(async () => ({
			ok: true as const,
			bytes: new Uint8Array([1, 2, 3]),
			workspace: updatedWorkspace,
			mutated: true,
			message: 'Save File trainer profile updated.'
		})),
		...overrides
	};
}

describe('Save File editor state', () => {
	it('opens with source, editable projections, staged edits, and committed workspace state', () => {
		const result = createSaveFileEditorState(source, summary, committedWorkspace);

		expect(result).toMatchObject({
			ok: true,
			state: {
				source: {
					saveFileId: 'save-1',
					fileName: 'emerald.sav'
				},
				projection: {
					trainerProfile: {
						trainerName: 'DIXIE',
						trainerId: 12345,
						gameVersion: 'E',
						generation: 3
					},
					money: {
						value: null,
						supported: false
					},
					inventory: {
						supported: false
					}
				},
				stagedEdits: [],
				staged: false,
				committedWorkspace,
				applyOutcome: { status: 'idle', message: null },
				unsupportedReason: null
			}
		});
	});

	it('stages field edits without mutating projections or dirty workspace state', () => {
		const opened = openEditor();
		const staged = stageTrainerNameEdit(opened, 'RAJ');

		expect(staged.staged).toBe(true);
		expect(staged.stagedEdits).toEqual([stagedEdit]);
		expect(staged.projection).toBe(opened.projection);
		expect(staged.committedWorkspace.dirty).toBe(false);
		expect(createSaveFileEditOperation(staged)).toEqual({
			ok: true,
			operation: {
				trainerProfile: {
					trainerName: 'RAJ'
				}
			}
		});
	});

	it('rejects invalid staged input without marking the workspace dirty', () => {
		const invalid = stageTrainerNameEdit(openEditor(), '  ');

		expect(invalid).toMatchObject({
			stagedEdits: [],
			staged: false,
			committedWorkspace: { dirty: false },
			applyOutcome: {
				status: 'rejected',
				message: 'Trainer name cannot be empty.',
				reason: 'invalid-save-file-edit'
			}
		});
	});

	it('cancels staged edits without changing projections or dirty workspace state', () => {
		const staged = stageSaveFileEditorEdit(openEditor(), stagedEdit);
		const cancelled = cancelSaveFileEditor(staged);

		expect(cancelled).toMatchObject({
			projection: staged.projection,
			stagedEdits: [],
			staged: false,
			committedWorkspace: { dirty: false, automaticBackupCreated: false },
			applyOutcome: { status: 'idle', message: null },
			unsupportedReason: null
		});
	});

	it('treats no staged edits as a no-op without backup or mutation', async () => {
		const services = applyServices();

		const result = await applySaveFileEditorEdits(openEditor(), services);

		expect(result.outcome).toEqual({
			status: 'noop',
			message: 'No Save File edits are staged.'
		});
		expect(services.validate).not.toHaveBeenCalled();
		expect(services.ensureBackup).not.toHaveBeenCalled();
		expect(services.mutateSaveFile).not.toHaveBeenCalled();
	});

	it('applies staged edits after validation and backup, then marks committed workspace dirty', async () => {
		const calls: string[] = [];
		const state = stageTrainerNameEdit(openEditor(), 'RAJ');
		const services = applyServices({
			validate: vi.fn(async () => {
				calls.push('validate');
				return { ok: true as const };
			}),
			ensureBackup: vi.fn(async () => {
				calls.push('backup');
				return {
					ok: true as const,
					committedWorkspace: { dirty: false, automaticBackupCreated: true }
				};
			}),
			mutateSaveFile: vi.fn(async () => {
				calls.push('mutate');
				return {
					ok: true as const,
					bytes: new Uint8Array([4, 5, 6]),
					workspace: updatedWorkspace,
					mutated: true,
					message: 'Saved.'
				};
			})
		});

		const result = await applySaveFileEditorEdits(state, services);

		expect(calls).toEqual(['validate', 'backup', 'mutate']);
		expect(result.outcome).toEqual({ status: 'success', message: 'Saved.' });
		expect(result.state.projection.trainerProfile.trainerName).toBe('RAJ');
		expect(result.state.stagedEdits).toEqual([]);
		expect(result.state.committedWorkspace).toEqual({
			dirty: true,
			automaticBackupCreated: true
		});
	});

	it('does not create a backup when validation rejects staged edits', async () => {
		const state = stageTrainerNameEdit(openEditor(), 'RAJ');
		const services = applyServices({
			validate: vi.fn(async () => ({
				ok: false as const,
				status: 'rejected' as const,
				message: 'Trainer name is not valid for this format.',
				reason: 'invalid-save-file-edit'
			}))
		});

		const result = await applySaveFileEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'rejected',
			message: 'Trainer name is not valid for this format.',
			reason: 'invalid-save-file-edit'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
		expect(services.ensureBackup).not.toHaveBeenCalled();
		expect(services.mutateSaveFile).not.toHaveBeenCalled();
	});

	it('keeps staged edits when backup creation fails before mutation', async () => {
		const state = stageTrainerNameEdit(openEditor(), 'RAJ');
		const services = applyServices({
			ensureBackup: vi.fn(async () => ({
				ok: false as const,
				status: 'failed' as const,
				message: 'Backup could not be created.',
				reason: 'backup-write-failed'
			}))
		});

		const result = await applySaveFileEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'failed',
			message: 'Backup could not be created.',
			reason: 'backup-write-failed'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
		expect(services.mutateSaveFile).not.toHaveBeenCalled();
	});

	it('surfaces unsupported engine behavior explicitly and keeps staged edits', async () => {
		const state = stageTrainerNameEdit(openEditor(), 'RAJ');
		const services = applyServices({
			mutateSaveFile: vi.fn(async () => ({
				ok: false as const,
				status: 'unsupported' as const,
				message: 'Save File field editing is not available in this PKHeX Engine build.',
				reason: 'unsupported-save-file-edit'
			}))
		});

		const result = await applySaveFileEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'unsupported',
			message: 'Save File field editing is not available in this PKHeX Engine build.',
			reason: 'unsupported-save-file-edit'
		});
		expect(result.state.unsupportedReason).toBe(
			'Save File field editing is not available in this PKHeX Engine build.'
		);
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
	});

	it('keeps staged edits when mutation fails', async () => {
		const state = stageTrainerNameEdit(openEditor(), 'RAJ');
		const services = applyServices({
			mutateSaveFile: vi.fn(async () => ({
				ok: false as const,
				status: 'failed' as const,
				message: 'Engine mutation failed.',
				reason: 'engine-unavailable'
			}))
		});

		const result = await applySaveFileEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'failed',
			message: 'Engine mutation failed.',
			reason: 'engine-unavailable'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
	});

	it('refuses apply when the source no longer identifies the same Save File', async () => {
		const state = stageTrainerNameEdit(openEditor(), 'RAJ');
		const services = applyServices({
			verifySource: vi.fn(async () => ({
				ok: false,
				message: 'Save File Editor source changed before Apply.'
			}))
		});

		const result = await applySaveFileEditorEdits(state, services);

		expect(result.outcome).toEqual({
			status: 'failed',
			message: 'Save File Editor source changed before Apply.',
			reason: 'stale-source'
		});
		expect(result.state.stagedEdits).toEqual([stagedEdit]);
		expect(services.validate).not.toHaveBeenCalled();
		expect(services.mutateSaveFile).not.toHaveBeenCalled();
	});

	it('compares editor source identity against the current Save File summary', () => {
		const state = openEditor();

		expect(isSameSaveFileEditorSourceIdentity(state, summary)).toBe(true);
		expect(isSameSaveFileEditorSourceIdentity(state, updatedSummary)).toBe(false);
		expect(isSameSaveFileEditorSourceIdentity(state, null)).toBe(false);
	});
});
