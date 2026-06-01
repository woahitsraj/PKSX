export type SaveFileId = string;
export type BackupId = string;
export type BackupReason =
	| 'manual'
	| 'pokemon-movement'
	| 'pokemon-editing'
	| 'trainer-editing'
	| 'inventory-editing'
	| 'legality-fix'
	| 'evolution';

export type StoredSaveFile = {
	id: SaveFileId;
	originalFileName: string | null;
	byteLength: number;
	importedAt: string;
	updatedAt: string;
};

export type BackupMetadata = {
	id: BackupId;
	saveFileId: SaveFileId;
	reason: BackupReason;
	byteLength: number;
	createdAt: string;
};

export type StoredWorkspace = {
	saveFileId: SaveFileId;
	bytes: Uint8Array;
	dirty: boolean;
	automaticBackupCreated: boolean;
	updatedAt: string;
};

export type ImportSaveInput = {
	bytes: Uint8Array;
	originalFileName?: string | null;
};

export type CreateBackupInput = {
	saveFileId: SaveFileId;
	bytes: Uint8Array;
	reason: BackupReason;
};

export type PutWorkspaceInput = {
	saveFileId: SaveFileId;
	bytes: Uint8Array;
	dirty: boolean;
	automaticBackupCreated: boolean;
};

export type LocalLibraryStorage = {
	importSave(input: ImportSaveInput): Promise<StoredSaveFile>;
	getSave(saveFileId: SaveFileId): Promise<StoredSaveFile | null>;
	listSaves(): Promise<StoredSaveFile[]>;
	getSaveBytes(saveFileId: SaveFileId): Promise<Uint8Array | null>;
	putWorkspace(input: PutWorkspaceInput): Promise<StoredWorkspace>;
	getWorkspace(saveFileId: SaveFileId): Promise<StoredWorkspace | null>;
	clearWorkspace(saveFileId: SaveFileId): Promise<void>;
	createBackup(input: CreateBackupInput): Promise<BackupMetadata>;
	listBackups(saveFileId: SaveFileId): Promise<BackupMetadata[]>;
	getBackupBytes(backupId: BackupId): Promise<Uint8Array | null>;
	exportSave(saveFileId: SaveFileId): Promise<Uint8Array | null>;
};
