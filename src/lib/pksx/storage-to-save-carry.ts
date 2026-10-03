import type { SaveWorkspace } from '$lib/engine';
import type { WorkspaceState } from '$lib/pksx/backup-workflow';
import type { CatalogCarrySource } from '$lib/pksx/pokemon-storage-catalog/service';
import { bytesEqual, WorkspaceRevisionConflictError, type SavesStorage } from '$lib/pksx/saves';

export class StorageCarryPendingError extends Error {
	constructor() {
		super('Save transfer could not be verified. Reload before editing or exporting this Save.');
	}
}

export async function commitStorageToSaveCarry(input: {
	storage: SavesStorage;
	state: WorkspaceState;
	source: CatalogCarrySource;
	bytes: Uint8Array;
	workspace: SaveWorkspace;
}): Promise<WorkspaceState> {
	const { storage, state, source, bytes, workspace } = input;
	if (!storage.commitRiskyWorkspaceMutation)
		throw new Error('Atomic Storage transfer is unavailable on this platform.');
	const owner = await storage.getSave(state.file.id);
	if (!owner || owner.importedAt !== state.file.importedAt)
		throw new Error('The selected Save File is no longer available.');
	const previous = await storage.getWorkspace(owner.id);
	const baseline = previous?.bytes ?? (await storage.getSaveBytes(owner.id));
	if (
		!baseline ||
		!bytesEqual(baseline, state.bytes) ||
		(previous?.dirty ?? false) !== state.dirty ||
		(previous?.automaticBackupCreated ?? false) !== state.automaticBackupCreated
	)
		throw new WorkspaceRevisionConflictError();
	const backupIds = new Set((await storage.listBackups(owner.id)).map((backup) => backup.id));
	try {
		await storage.commitRiskyWorkspaceMutation({
			saveFileId: owner.id,
			importedAt: owner.importedAt,
			expectedUpdatedAt: previous?.updatedAt ?? null,
			bytes,
			dirty: true,
			reason: 'pokemon-movement',
			carrySource: source
		});
	} catch (error) {
		try {
			const [current, backups] = await Promise.all([
				storage.getWorkspace(owner.id),
				storage.listBackups(owner.id)
			]);
			const newBackups = backups.filter((backup) => !backupIds.has(backup.id));
			const committed =
				current?.dirty === true &&
				current.automaticBackupCreated &&
				bytesEqual(current.bytes, bytes) &&
				(previous?.automaticBackupCreated || newBackups.length === 1);
			if (committed) {
				if (newBackups.length === 1) {
					const backupBytes = await storage.getBackupBytes(newBackups[0].id);
					if (!backupBytes || !bytesEqual(backupBytes, baseline))
						throw new StorageCarryPendingError();
				}
			} else if (
				newBackups.length === 0 &&
				(previous
					? current?.updatedAt === previous.updatedAt &&
						bytesEqual(current.bytes, previous.bytes) &&
						current.dirty === previous.dirty &&
						current.automaticBackupCreated === previous.automaticBackupCreated
					: current === null)
			) {
				throw error;
			} else throw new StorageCarryPendingError();
		} catch (reconciliationError) {
			if (reconciliationError === error) throw error;
			throw new StorageCarryPendingError();
		}
	}
	return {
		...state,
		file: owner,
		bytes,
		workspace,
		dirty: true,
		automaticBackupCreated: true,
		restoredFromBackup: null
	};
}
