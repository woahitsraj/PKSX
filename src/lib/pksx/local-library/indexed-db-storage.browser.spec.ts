import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bytesEqual } from './bytes';
import { deleteIndexedDbLocalLibrary, IndexedDbLocalLibraryStorage } from './indexed-db-storage';

describe('IndexedDbLocalLibraryStorage', () => {
	let databaseName: string;
	let ids: string[];
	let storage: IndexedDbLocalLibraryStorage;

	beforeEach(() => {
		databaseName = `pksx-local-library-test-${crypto.randomUUID()}`;
		ids = ['save-1', 'backup-1'];
		storage = new IndexedDbLocalLibraryStorage({
			databaseName,
			idFactory: () => {
				const id = ids.shift();
				if (!id) {
					throw new Error('Test id sequence exhausted');
				}
				return id;
			},
			now: () => '2026-05-16T12:00:00.000Z'
		});
	});

	afterEach(async () => {
		await deleteIndexedDbLocalLibrary(databaseName);
	});

	it('imports save bytes and retrieves them unchanged', async () => {
		const importedBytes = new Uint8Array([0, 1, 2, 253, 254, 255]);

		const saveFile = await storage.importSave({
			bytes: importedBytes,
			originalFileName: 'pokemon.sav'
		});
		importedBytes[0] = 99;

		const retrievedSave = await storage.getSave(saveFile.id);
		const retrievedBytes = await storage.getSaveBytes(saveFile.id);

		expect(saveFile).toStrictEqual({
			id: 'save-1',
			originalFileName: 'pokemon.sav',
			byteLength: 6,
			importedAt: '2026-05-16T12:00:00.000Z',
			updatedAt: '2026-05-16T12:00:00.000Z'
		});
		expect(retrievedSave).toStrictEqual(saveFile);
		expect(retrievedBytes).not.toBeNull();
		expect(
			bytesEqual(retrievedBytes ?? new Uint8Array(), new Uint8Array([0, 1, 2, 253, 254, 255]))
		).toBe(true);
	});

	it('exports the original bytes for an unchanged save', async () => {
		const originalBytes = new Uint8Array([10, 20, 30, 40]);
		const saveFile = await storage.importSave({
			bytes: originalBytes,
			originalFileName: 'clean.sav'
		});

		const exportedBytes = await storage.exportSave(saveFile.id);
		exportedBytes?.set([99], 0);
		const exportedAgain = await storage.exportSave(saveFile.id);

		expect(exportedBytes).not.toBeNull();
		expect(bytesEqual(exportedBytes ?? new Uint8Array(), originalBytes)).toBe(false);
		expect(bytesEqual(exportedAgain ?? new Uint8Array(), originalBytes)).toBe(true);
	});

	it('lists the most recently imported save first', async () => {
		ids = ['older-save', 'newer-save'];
		storage = new IndexedDbLocalLibraryStorage({
			databaseName,
			idFactory: () => {
				const id = ids.shift();
				if (!id) {
					throw new Error('Test id sequence exhausted');
				}
				return id;
			},
			now: (() => {
				const timestamps = ['2026-05-16T12:00:00.000Z', '2026-05-16T13:00:00.000Z'];
				return () => timestamps.shift() ?? '2026-05-16T14:00:00.000Z';
			})()
		});

		const older = await storage.importSave({
			bytes: new Uint8Array([1]),
			originalFileName: 'older.sav'
		});
		const newer = await storage.importSave({
			bytes: new Uint8Array([2]),
			originalFileName: 'newer.sav'
		});

		await expect(storage.listSaves()).resolves.toStrictEqual([newer, older]);
	});

	it('creates and lists backup metadata for a save file', async () => {
		const saveFile = await storage.importSave({
			bytes: new Uint8Array([1, 3, 3, 7]),
			originalFileName: 'backup-source.sav'
		});

		const backup = await storage.createBackup({
			saveFileId: saveFile.id,
			bytes: new Uint8Array([8, 6, 7, 5, 3, 0, 9]),
			reason: 'manual'
		});
		const backups = await storage.listBackups(saveFile.id);
		const backupBytes = await storage.getBackupBytes(backup.id);

		expect(backup).toStrictEqual({
			id: 'backup-1',
			saveFileId: 'save-1',
			reason: 'manual',
			byteLength: 7,
			createdAt: '2026-05-16T12:00:00.000Z'
		});
		expect(backups).toStrictEqual([backup]);
		expect(bytesEqual(backupBytes ?? new Uint8Array(), new Uint8Array([8, 6, 7, 5, 3, 0, 9]))).toBe(
			true
		);
	});

	it('rejects backup creation for an unknown save file', async () => {
		await expect(
			storage.createBackup({
				saveFileId: 'missing-save',
				bytes: new Uint8Array([1]),
				reason: 'manual'
			})
		).rejects.toThrow('Cannot create backup for unknown save file: missing-save');
	});

	it('lists newest backups first', async () => {
		ids = ['save-1', 'older-backup', 'newer-backup'];
		storage = new IndexedDbLocalLibraryStorage({
			databaseName,
			idFactory: () => {
				const id = ids.shift();
				if (!id) {
					throw new Error('Test id sequence exhausted');
				}
				return id;
			},
			now: (() => {
				const timestamps = [
					'2026-05-16T12:00:00.000Z',
					'2026-05-16T12:30:00.000Z',
					'2026-05-16T13:00:00.000Z'
				];
				return () => timestamps.shift() ?? '2026-05-16T14:00:00.000Z';
			})()
		});

		const saveFile = await storage.importSave({
			bytes: new Uint8Array([1]),
			originalFileName: 'backup-source.sav'
		});
		const older = await storage.createBackup({
			saveFileId: saveFile.id,
			bytes: new Uint8Array([2]),
			reason: 'manual'
		});
		const newer = await storage.createBackup({
			saveFileId: saveFile.id,
			bytes: new Uint8Array([3]),
			reason: 'pokemon-editing'
		});

		await expect(storage.listBackups(saveFile.id)).resolves.toStrictEqual([newer, older]);
	});
});
