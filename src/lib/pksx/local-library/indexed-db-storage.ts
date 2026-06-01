import { copyBytes } from './bytes';
import type {
	BackupId,
	BackupMetadata,
	CreateBackupInput,
	ImportSaveInput,
	LocalLibraryStorage,
	PutWorkspaceInput,
	SaveFileId,
	StoredSaveFile,
	StoredWorkspace
} from './types';

const databaseVersion = 2;
const saveFilesStore = 'saveFiles';
const saveBytesStore = 'saveBytes';
const workspacesStore = 'workspaces';
const backupsStore = 'backups';
const backupBytesStore = 'backupBytes';
const backupsBySaveFileIdIndex = 'bySaveFileId';

type SaveBytesRecord = {
	saveFileId: SaveFileId;
	bytes: Uint8Array;
};

type BackupBytesRecord = {
	backupId: BackupId;
	bytes: Uint8Array;
};

type WorkspaceRecord = StoredWorkspace;

export type IndexedDbLocalLibraryStorageOptions = {
	databaseName?: string;
	idFactory?: () => string;
	now?: () => string;
};

export class IndexedDbLocalLibraryStorage implements LocalLibraryStorage {
	readonly #databaseName: string;
	readonly #idFactory: () => string;
	readonly #now: () => string;

	constructor(options: IndexedDbLocalLibraryStorageOptions = {}) {
		this.#databaseName = options.databaseName ?? 'pksx-local-library';
		this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
		this.#now = options.now ?? (() => new Date().toISOString());
	}

	async importSave(input: ImportSaveInput): Promise<StoredSaveFile> {
		const timestamp = this.#now();
		const saveFile: StoredSaveFile = {
			id: this.#idFactory(),
			originalFileName: input.originalFileName ?? null,
			byteLength: input.bytes.byteLength,
			importedAt: timestamp,
			updatedAt: timestamp
		};

		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction([saveFilesStore, saveBytesStore], 'readwrite');
			transaction.objectStore(saveFilesStore).put(saveFile);
			transaction.objectStore(saveBytesStore).put({
				saveFileId: saveFile.id,
				bytes: copyBytes(input.bytes)
			} satisfies SaveBytesRecord);
			await transactionDone(transaction);
		} finally {
			database.close();
		}

		return { ...saveFile };
	}

	async getSave(saveFileId: SaveFileId): Promise<StoredSaveFile | null> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(saveFilesStore, 'readonly');
			const saveFile = await requestToPromise<StoredSaveFile | undefined>(
				transaction.objectStore(saveFilesStore).get(saveFileId)
			);
			await transactionDone(transaction);
			return saveFile ? { ...saveFile } : null;
		} finally {
			database.close();
		}
	}

	async listSaves(): Promise<StoredSaveFile[]> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(saveFilesStore, 'readonly');
			const saveFiles = await requestToPromise<StoredSaveFile[]>(
				transaction.objectStore(saveFilesStore).getAll()
			);
			await transactionDone(transaction);

			return saveFiles
				.map((saveFile) => ({ ...saveFile }))
				.sort((left, right) => right.importedAt.localeCompare(left.importedAt));
		} finally {
			database.close();
		}
	}

	async getSaveBytes(saveFileId: SaveFileId): Promise<Uint8Array | null> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(saveBytesStore, 'readonly');
			const record = await requestToPromise<SaveBytesRecord | undefined>(
				transaction.objectStore(saveBytesStore).get(saveFileId)
			);
			await transactionDone(transaction);
			return record ? copyBytes(record.bytes) : null;
		} finally {
			database.close();
		}
	}

	async putWorkspace(input: PutWorkspaceInput): Promise<StoredWorkspace> {
		const saveFile = await this.getSave(input.saveFileId);
		if (!saveFile) {
			throw new Error(`Cannot persist workspace for unknown save file: ${input.saveFileId}`);
		}

		const workspace: StoredWorkspace = {
			saveFileId: input.saveFileId,
			bytes: copyBytes(input.bytes),
			dirty: input.dirty,
			automaticBackupCreated: input.automaticBackupCreated,
			updatedAt: this.#now()
		};

		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(workspacesStore, 'readwrite');
			transaction.objectStore(workspacesStore).put({
				...workspace,
				bytes: copyBytes(workspace.bytes)
			} satisfies WorkspaceRecord);
			await transactionDone(transaction);
		} finally {
			database.close();
		}

		return { ...workspace, bytes: copyBytes(workspace.bytes) };
	}

	async getWorkspace(saveFileId: SaveFileId): Promise<StoredWorkspace | null> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(workspacesStore, 'readonly');
			const record = await requestToPromise<WorkspaceRecord | undefined>(
				transaction.objectStore(workspacesStore).get(saveFileId)
			);
			await transactionDone(transaction);
			return record ? { ...record, bytes: copyBytes(record.bytes) } : null;
		} finally {
			database.close();
		}
	}

	async clearWorkspace(saveFileId: SaveFileId): Promise<void> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(workspacesStore, 'readwrite');
			transaction.objectStore(workspacesStore).delete(saveFileId);
			await transactionDone(transaction);
		} finally {
			database.close();
		}
	}

	async createBackup(input: CreateBackupInput): Promise<BackupMetadata> {
		const saveFile = await this.getSave(input.saveFileId);
		if (!saveFile) {
			throw new Error(`Cannot create backup for unknown save file: ${input.saveFileId}`);
		}

		const backup: BackupMetadata = {
			id: this.#idFactory(),
			saveFileId: input.saveFileId,
			reason: input.reason,
			byteLength: input.bytes.byteLength,
			createdAt: this.#now()
		};

		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction([backupsStore, backupBytesStore], 'readwrite');
			transaction.objectStore(backupsStore).put(backup);
			transaction.objectStore(backupBytesStore).put({
				backupId: backup.id,
				bytes: copyBytes(input.bytes)
			} satisfies BackupBytesRecord);
			await transactionDone(transaction);
		} finally {
			database.close();
		}

		return { ...backup };
	}

	async listBackups(saveFileId: SaveFileId): Promise<BackupMetadata[]> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(backupsStore, 'readonly');
			const backups = await requestToPromise<BackupMetadata[]>(
				transaction.objectStore(backupsStore).index(backupsBySaveFileIdIndex).getAll(saveFileId)
			);
			await transactionDone(transaction);
			return backups
				.map((backup) => ({ ...backup }))
				.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
		} finally {
			database.close();
		}
	}

	async getBackupBytes(backupId: BackupId): Promise<Uint8Array | null> {
		const database = await openLocalLibraryDatabase(this.#databaseName);
		try {
			const transaction = database.transaction(backupBytesStore, 'readonly');
			const record = await requestToPromise<BackupBytesRecord | undefined>(
				transaction.objectStore(backupBytesStore).get(backupId)
			);
			await transactionDone(transaction);
			return record ? copyBytes(record.bytes) : null;
		} finally {
			database.close();
		}
	}

	async exportSave(saveFileId: SaveFileId): Promise<Uint8Array | null> {
		return this.getSaveBytes(saveFileId);
	}
}

export function deleteIndexedDbLocalLibrary(databaseName: string): Promise<void> {
	const request = indexedDB.deleteDatabase(databaseName);

	return new Promise((resolve, reject) => {
		request.onerror = () =>
			reject(request.error ?? new Error('Failed to delete IndexedDB database'));
		request.onblocked = () => reject(new Error('IndexedDB database deletion was blocked'));
		request.onsuccess = () => resolve();
	});
}

function openLocalLibraryDatabase(databaseName: string): Promise<IDBDatabase> {
	const request = indexedDB.open(databaseName, databaseVersion);

	return new Promise((resolve, reject) => {
		request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB database'));
		request.onupgradeneeded = () => migrateDatabase(request.result);
		request.onsuccess = () => resolve(request.result);
	});
}

function migrateDatabase(database: IDBDatabase): void {
	if (!database.objectStoreNames.contains(saveFilesStore)) {
		database.createObjectStore(saveFilesStore, { keyPath: 'id' });
	}

	if (!database.objectStoreNames.contains(saveBytesStore)) {
		database.createObjectStore(saveBytesStore, { keyPath: 'saveFileId' });
	}

	if (!database.objectStoreNames.contains(workspacesStore)) {
		database.createObjectStore(workspacesStore, { keyPath: 'saveFileId' });
	}

	if (!database.objectStoreNames.contains(backupsStore)) {
		const store = database.createObjectStore(backupsStore, { keyPath: 'id' });
		store.createIndex(backupsBySaveFileIdIndex, 'saveFileId', { unique: false });
	}

	if (!database.objectStoreNames.contains(backupBytesStore)) {
		database.createObjectStore(backupBytesStore, { keyPath: 'backupId' });
	}
}

function requestToPromise<T>(request: IDBRequest): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
		request.onsuccess = () => resolve(request.result as T);
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'));
		transaction.oncomplete = () => resolve();
	});
}
