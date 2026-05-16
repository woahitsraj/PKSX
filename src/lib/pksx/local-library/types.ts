export type SaveFileId = string;
export type BackupId = string;

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
	reason: string;
	byteLength: number;
	createdAt: string;
};

export type ImportSaveInput = {
	bytes: Uint8Array;
	originalFileName?: string | null;
};

export type CreateBackupInput = {
	saveFileId: SaveFileId;
	bytes: Uint8Array;
	reason: string;
};

export type LocalLibraryStorage = {
	importSave(input: ImportSaveInput): Promise<StoredSaveFile>;
	getSave(saveFileId: SaveFileId): Promise<StoredSaveFile | null>;
	getSaveBytes(saveFileId: SaveFileId): Promise<Uint8Array | null>;
	createBackup(input: CreateBackupInput): Promise<BackupMetadata>;
	listBackups(saveFileId: SaveFileId): Promise<BackupMetadata[]>;
	getBackupBytes(backupId: BackupId): Promise<Uint8Array | null>;
	exportSave(saveFileId: SaveFileId): Promise<Uint8Array | null>;
};
