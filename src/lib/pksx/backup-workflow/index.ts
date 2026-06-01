import {
	bytesEqual,
	copyBytes,
	type BackupId,
	type BackupReason,
	type StoredSaveFile
} from '$lib/pksx/local-library';
import type { SaveWorkspace } from '$lib/engine';

export type RestoredBackupSource = {
	id: BackupId;
	createdAt: string;
	reason: BackupReason;
};

export type WorkspaceState = {
	file: StoredSaveFile;
	bytes: Uint8Array;
	workspace: SaveWorkspace;
	dirty: boolean;
	restoredFromBackup: RestoredBackupSource | null;
	automaticBackupCreated: boolean;
};

export type CreateWorkspaceStateInput = {
	file: StoredSaveFile;
	bytes: Uint8Array;
	workspace: SaveWorkspace;
};

export function createCleanWorkspaceState(input: CreateWorkspaceStateInput): WorkspaceState {
	return {
		file: input.file,
		bytes: copyBytes(input.bytes),
		workspace: input.workspace,
		dirty: false,
		restoredFromBackup: null,
		automaticBackupCreated: false
	};
}

export type PersistedWorkspaceStateInput = CreateWorkspaceStateInput & {
	dirty: boolean;
	automaticBackupCreated: boolean;
};

export function createPersistedWorkspaceState(input: PersistedWorkspaceStateInput): WorkspaceState {
	return {
		file: input.file,
		bytes: copyBytes(input.bytes),
		workspace: input.workspace,
		dirty: input.dirty,
		restoredFromBackup: null,
		automaticBackupCreated: input.automaticBackupCreated
	};
}

export type RestoreBackupInput = CreateWorkspaceStateInput & {
	source: RestoredBackupSource;
	currentSaveBytes: Uint8Array;
};

export function createRestoredWorkspaceState(input: RestoreBackupInput): WorkspaceState {
	return {
		file: input.file,
		bytes: copyBytes(input.bytes),
		workspace: input.workspace,
		dirty: !bytesEqual(input.bytes, input.currentSaveBytes),
		restoredFromBackup: input.source,
		automaticBackupCreated: false
	};
}

export function preserveRestoredWorkspaceAsSave(
	state: WorkspaceState,
	file: StoredSaveFile
): WorkspaceState {
	return {
		...state,
		file,
		dirty: false,
		restoredFromBackup: null,
		automaticBackupCreated: false
	};
}

export function markAutomaticBackupCreated(state: WorkspaceState): WorkspaceState {
	return {
		...state,
		automaticBackupCreated: true
	};
}

export function shouldCreateAutomaticBackup(state: WorkspaceState): boolean {
	return !state.automaticBackupCreated;
}
