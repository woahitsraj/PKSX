import { base64ToBytes, type EngineApi, type SaveSlotRef } from '$lib/engine';
import type { PokemonStorageService } from '$lib/pksx/pokemon-storage-catalog';
import { bytesEqual, type SavesStorage } from '$lib/pksx/saves';
import { WorkspaceRevisionConflictError } from '$lib/pksx/saves';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';

export class SaveDeletionPendingError extends Error {
	constructor() {
		super(
			'Save Slot deletion could not be verified. Reload before editing or exporting this Save.'
		);
	}
}

export async function preserveAndClearSaveSlot(input: {
	state: WorkspaceState;
	source: SaveSlotRef;
	activeBox: number;
	engine: EngineApi;
	storage: SavesStorage;
	catalog: PokemonStorageService;
}): Promise<WorkspaceState> {
	const { state, source, activeBox, engine, storage, catalog } = input;
	if (!storage.commitPreservedSaveDeletion)
		throw new Error('Atomic Save File deletion is unavailable on this platform.');
	const slot =
		source.zone === 'party'
			? state.workspace.partySlots.find((item) => item.slot === source.slot)
			: state.workspace.boxSlots.find(
					(item) => item.box === source.box && item.slot === source.slot
				);
	if (!slot || slot.isEmpty || !slot.entityBytesBase64)
		throw new Error('The Save File Slot is empty or its Pokemon bytes are unavailable.');
	const owner = await storage.getSave(state.file.id);
	if (!owner || owner.importedAt !== state.file.importedAt)
		throw new Error('The selected Save File is no longer available.');
	const persisted = await storage.getWorkspace(owner.id);
	const expectedBytes = persisted?.bytes ?? (await storage.getSaveBytes(owner.id));
	if (
		!expectedBytes ||
		!bytesEqual(expectedBytes, state.bytes) ||
		(persisted?.dirty ?? false) !== state.dirty ||
		(persisted?.automaticBackupCreated ?? false) !== state.automaticBackupCreated
	)
		throw new WorkspaceRevisionConflictError();
	const backupIdsBefore = new Set((await storage.listBackups(owner.id)).map((backup) => backup.id));
	const prepared = await catalog.prepareSaveDeletion(base64ToBytes(slot.entityBytesBase64), {
		entryMode: 'deleted-from-save',
		originSaveFileId: owner.id,
		originSaveSlot: source,
		originSaveFileName: owner.originalFileName,
		originGame: state.workspace.summary.gameVersion,
		originalTrainer: slot.originalTrainer ?? state.workspace.summary.trainerName ?? null,
		trainerId: String(state.workspace.summary.trainerId),
		enteredAt: new Date().toISOString()
	});
	const result = await engine.applySlotOperation(
		state.bytes,
		owner.originalFileName ?? undefined,
		{ kind: 'clear', source },
		activeBox
	);
	if (!result.ok) throw result.error;
	if (!result.value.mutated) throw new Error('The PKHeX Engine did not clear the Save File Slot.');
	if (source.zone === 'party') {
		if (result.value.workspace.summary.partyCount !== state.workspace.summary.partyCount - 1)
			throw new Error('The PKHeX Engine did not clear the Party Slot.');
	} else {
		const cleared = result.value.workspace.boxSlots.find(
			(item) => item.box === source.box && item.slot === source.slot
		);
		if (!cleared?.isEmpty) throw new Error('The PKHeX Engine did not clear the Box Slot.');
	}
	let committedManifest = prepared.manifest;
	try {
		await storage.commitPreservedSaveDeletion({
			saveFileId: owner.id,
			importedAt: owner.importedAt,
			expectedUpdatedAt: persisted?.updatedAt ?? null,
			expectedBytes,
			expectedDirty: state.dirty,
			bytes: result.value.bytes,
			dirty: true,
			reason: 'pokemon-movement',
			expectedCatalogRevision: prepared.expectedRevision,
			manifest: prepared.manifest,
			payload: prepared.payload
		});
	} catch (error) {
		try {
			const [workspace, manifest, backups] = await Promise.all([
				storage.getWorkspace(owner.id),
				catalog.readPersistedSaveDeletion(prepared.recordId),
				storage.listBackups(owner.id)
			]);
			const newBackups = backups.filter((backup) => !backupIdsBefore.has(backup.id));
			const committed =
				workspace?.dirty === true &&
				workspace.automaticBackupCreated &&
				bytesEqual(workspace.bytes, result.value.bytes) &&
				manifest?.tombstones.some(
					(item) =>
						item.recordId === prepared.recordId &&
						item.recovery?.payload.id === prepared.payload.reference.id &&
						item.recovery.origin.originSaveFileId === owner.id
				) &&
				(persisted?.automaticBackupCreated || newBackups.length === 1);
			if (committed && manifest) {
				if (newBackups.length === 1) {
					const backupBytes = await storage.getBackupBytes(newBackups[0].id);
					if (!backupBytes || !bytesEqual(backupBytes, expectedBytes))
						throw new SaveDeletionPendingError();
				}
				committedManifest = manifest;
			} else if (
				!manifest &&
				newBackups.length === 0 &&
				(persisted
					? workspace?.updatedAt === persisted.updatedAt &&
						bytesEqual(workspace.bytes, persisted.bytes) &&
						workspace.dirty === persisted.dirty &&
						workspace.automaticBackupCreated === persisted.automaticBackupCreated
					: workspace === null)
			) {
				throw error;
			} else throw new SaveDeletionPendingError();
		} catch (reconciliationError) {
			if (reconciliationError === error) throw error;
			throw new SaveDeletionPendingError();
		}
	}
	catalog.publishCommittedDeletion(committedManifest);
	return {
		...state,
		file: owner,
		bytes: result.value.bytes,
		workspace: result.value.workspace,
		dirty: true,
		automaticBackupCreated: true,
		restoredFromBackup: null
	};
}
