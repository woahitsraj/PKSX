import { afterEach, expect, test } from 'vitest';
import { BrowserCatalogPersistence, deleteBrowserCatalog } from './browser';
import { catalogContract } from './contract-tests';
import { emptyManifest, referenceFor } from './types';
const names: string[] = [];
function create() {
	const name = `pokemon-storage-contract-${crypto.randomUUID()}`;
	names.push(name);
	return new BrowserCatalogPersistence(name);
}
afterEach(async () => {
	for (const name of names.splice(0)) await deleteBrowserCatalog(name);
});
catalogContract('browser', create, async (persistence, id) => {
	const name = names.at(-1)!;
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const opening = indexedDB.open(name);
		opening.onsuccess = () => resolve(opening.result);
		opening.onerror = () => reject(opening.error);
	});
	await new Promise<void>((resolve, reject) => {
		const transaction = db.transaction('blobs', 'readwrite');
		transaction.objectStore('blobs').put(new Uint8Array([0]), id);
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
	db.close();
	void persistence;
});

test('browser replacement aborts without publishing a recovery snapshot', async () => {
	const persistence = create();
	const first = emptyManifest('storage-id', '2026-10-03T00:00:00Z', 'box-id');
	await persistence.commit(null, first, []);
	const originalPut = IDBObjectStore.prototype.put;
	IDBObjectStore.prototype.put = function (...args) {
		if (this.name === 'manifest' && args[1] === 'current') throw new Error('quota');
		return originalPut.apply(this, args);
	};
	try {
		await expect(
			persistence.replace(0, { ...first, revision: 1 }, [], {
				createdAt: '2026-10-03T01:00:00Z',
				manifest: first
			})
		).rejects.toThrow('quota');
	} finally {
		IDBObjectStore.prototype.put = originalPut;
	}
	expect(await persistence.read()).toEqual(first);
	expect(await persistence.readRecovery()).toBeNull();
});

test('migrates a legacy catalog with recovery bytes into the Saves database', async () => {
	const legacyName = `legacy-catalog-${crypto.randomUUID()}`;
	const jointName = `joint-saves-${crypto.randomUUID()}`;
	names.push(legacyName, jointName);
	const payload = new Uint8Array([1, 2, 3]);
	const reference = await referenceFor(payload, 1);
	const manifest = emptyManifest('storage-id', '2026-10-03T00:00:00Z', 'box-id');
	manifest.tombstones.push({
		recordId: 'record-id',
		reason: 'cleared',
		destinationSaveFileId: null,
		deletedAt: '2026-10-03T00:00:00Z',
		revision: 1,
		recovery: {
			recordId: 'record-id',
			payload: reference,
			identityFingerprint: 'fingerprint',
			projection: {} as never,
			origin: {
				entryMode: 'deleted-from-save',
				originSaveFileId: 'save-id',
				originSaveSlot: { zone: 'box', box: 2, slot: 4 },
				originSaveFileName: 'save.sav',
				originGame: 'Emerald',
				originalTrainer: 'Trainer',
				trainerId: '42',
				enteredAt: '2026-10-03T00:00:00Z'
			},
			placement: null,
			revision: 0,
			createdAt: '2026-10-03T00:00:00Z',
			updatedAt: '2026-10-03T00:00:00Z'
		}
	});
	const opening = indexedDB.open(legacyName, 1);
	opening.onupgradeneeded = () => {
		opening.result.createObjectStore('manifest');
		opening.result.createObjectStore('blobs');
	};
	const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
		opening.onsuccess = () => resolve(opening.result);
		opening.onerror = () => reject(opening.error);
	});
	const transaction = legacy.transaction(['manifest', 'blobs'], 'readwrite');
	transaction.objectStore('manifest').put(manifest, 'current');
	transaction.objectStore('blobs').put(payload, reference.id);
	await new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
	});
	legacy.close();
	const migrated = new BrowserCatalogPersistence(jointName, legacyName);
	const originalPut = IDBObjectStore.prototype.put;
	IDBObjectStore.prototype.put = function (...args) {
		if (this.name === 'blobs') throw new Error('migration quota failure');
		return originalPut.apply(this, args);
	};
	try {
		await expect(migrated.read()).rejects.toThrow('migration quota failure');
	} finally {
		IDBObjectStore.prototype.put = originalPut;
	}
	expect(await migrated.read()).toEqual(manifest);
	expect(await migrated.readBlob(reference)).toEqual(payload);
	const reopened = new BrowserCatalogPersistence(jointName);
	expect(await reopened.read()).toEqual(manifest);
});
