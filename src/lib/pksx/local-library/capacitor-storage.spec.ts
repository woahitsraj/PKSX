import { beforeEach, describe, expect, it } from 'vitest';
import { bytesEqual } from './bytes';
import { CapacitorLocalLibraryStorage, type NativeFileStore } from './capacitor-storage';

describe('CapacitorLocalLibraryStorage', () => {
	let files: Map<string, string | Uint8Array>;
	let storage: CapacitorLocalLibraryStorage;

	beforeEach(() => {
		files = new Map();
		const ids = ['save-1', 'backup-1'];
		const fileStore: NativeFileStore = {
			async readText(path) {
				const value = files.get(path);
				return typeof value === 'string' ? value : null;
			},
			async writeText(path, value) {
				files.set(path, value);
			},
			async readBytes(path) {
				const value = files.get(path);
				return value instanceof Uint8Array ? new Uint8Array(value) : null;
			},
			async writeBytes(path, value) {
				files.set(path, new Uint8Array(value));
			},
			async delete(path) {
				files.delete(path);
			}
		};
		storage = new CapacitorLocalLibraryStorage({
			fileStore,
			idFactory: () => {
				const id = ids.shift();
				if (!id) throw new Error('Test id sequence exhausted');
				return id;
			},
			now: () => '2026-05-16T12:00:00.000Z'
		});
	});

	it('preserves imported, exported, and backup bytes with their metadata', async () => {
		const importedBytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
		const saveFile = await storage.importSave({
			bytes: importedBytes,
			originalFileName: 'pokemon.sav'
		});
		importedBytes[0] = 99;

		const backup = await storage.createBackup({
			saveFileId: saveFile.id,
			bytes: new Uint8Array([8, 6, 7, 5, 3, 0, 9]),
			reason: 'manual'
		});
		const retrievedBytes = await storage.getSaveBytes(saveFile.id);
		const exportedBytes = await storage.exportSave(saveFile.id);
		const backupBytes = await storage.getBackupBytes(backup.id);

		expect(saveFile).toStrictEqual({
			id: 'save-1',
			originalFileName: 'pokemon.sav',
			byteLength: 6,
			importedAt: '2026-05-16T12:00:00.000Z',
			updatedAt: '2026-05-16T12:00:00.000Z'
		});
		expect(await storage.listBackups(saveFile.id)).toStrictEqual([backup]);
		expect(
			bytesEqual(retrievedBytes ?? new Uint8Array(), new Uint8Array([0, 1, 2, 253, 254, 255]))
		).toBe(true);
		expect(bytesEqual(exportedBytes ?? new Uint8Array(), retrievedBytes ?? new Uint8Array())).toBe(
			true
		);
		expect(bytesEqual(backupBytes ?? new Uint8Array(), new Uint8Array([8, 6, 7, 5, 3, 0, 9]))).toBe(
			true
		);
	});
});
