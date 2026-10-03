import {
	assertManifest,
	CatalogConflictError,
	cloneManifest,
	referencedPayloads,
	verifyBlob,
	type BlobReference,
	type CatalogPersistence,
	type PokemonStorageManifest,
	type StagedBlob
} from './types';
import { openSavesDatabase } from '$lib/pksx/saves/indexed-db-storage';

const manifestStore = 'manifest';
const blobStore = 'blobs';
const request = <T>(value: IDBRequest<T>): Promise<T> =>
	new Promise((resolve, reject) => {
		value.onsuccess = () => resolve(value.result);
		value.onerror = () => reject(value.error);
	});
const done = (transaction: IDBTransaction): Promise<void> =>
	new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('Pokemon Storage transaction aborted.'));
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('Pokemon Storage transaction failed.'));
	});

export class BrowserCatalogPersistence implements CatalogPersistence {
	constructor(
		private readonly databaseName = 'pksx-saves',
		private readonly legacyDatabaseName = databaseName === 'pksx-saves'
			? 'pksx-pokemon-storage-catalog'
			: null
	) {}
	async #open(): Promise<IDBDatabase> {
		const db = await openSavesDatabase(this.databaseName);
		try {
			if (this.legacyDatabaseName) await this.#migrateLegacy(db);
			return db;
		} catch (error) {
			db.close();
			throw error;
		}
	}
	async #migrateLegacy(db: IDBDatabase): Promise<void> {
		const existing = db.transaction(manifestStore);
		const existingDone = done(existing);
		const current = await request<PokemonStorageManifest | undefined>(
			existing.objectStore(manifestStore).get('current')
		);
		await existingDone;
		if (current) return;
		const opening = indexedDB.open(this.legacyDatabaseName!);
		const legacy = await new Promise<IDBDatabase | null>((resolve, reject) => {
			opening.onupgradeneeded = () => opening.transaction?.abort();
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () =>
				opening.error?.name === 'AbortError' ? resolve(null) : reject(opening.error);
		});
		if (!legacy) return;
		try {
			const old = legacy.transaction([manifestStore, blobStore]);
			const oldDone = done(old);
			const manifest = await request<PokemonStorageManifest | undefined>(
				old.objectStore(manifestStore).get('current')
			);
			if (!manifest) {
				await oldDone;
				return;
			}
			assertManifest(manifest);
			const blobs = await Promise.all(
				referencedPayloads(manifest).map(async (reference) => {
					const bytes = await request<Uint8Array | undefined>(
						old.objectStore(blobStore).get(reference.id)
					);
					if (!bytes) throw new Error('Legacy Pokemon preservation payload is missing.');
					await verifyBlob(reference, bytes);
					return { reference, bytes };
				})
			);
			await oldDone;
			const next = db.transaction([manifestStore, blobStore], 'readwrite');
			const nextDone = done(next);
			try {
				const store = next.objectStore(manifestStore);
				if (!(await request(store.get('current')))) {
					for (const blob of blobs)
						next.objectStore(blobStore).put(new Uint8Array(blob.bytes), blob.reference.id);
					store.put(cloneManifest(manifest), 'current');
				}
				await nextDone;
			} catch (error) {
				try {
					next.abort();
				} catch {
					/* closed */
				}
				await nextDone.catch(() => undefined);
				throw error;
			}
		} finally {
			legacy.close();
		}
	}
	async read(): Promise<PokemonStorageManifest | null> {
		const db = await this.#open();
		try {
			const transaction = db.transaction(manifestStore);
			const manifest = await request<PokemonStorageManifest | undefined>(
				transaction.objectStore(manifestStore).get('current')
			);
			await done(transaction);
			if (manifest) assertManifest(manifest);
			return manifest ? cloneManifest(manifest) : null;
		} finally {
			db.close();
		}
	}
	async readBlob(reference: BlobReference): Promise<Uint8Array | null> {
		const db = await this.#open();
		try {
			const transaction = db.transaction(blobStore);
			const bytes = await request<Uint8Array | undefined>(
				transaction.objectStore(blobStore).get(reference.id)
			);
			await done(transaction);
			return bytes ? new Uint8Array(bytes) : null;
		} finally {
			db.close();
		}
	}
	async commit(
		expectedRevision: number | null,
		manifest: PokemonStorageManifest,
		blobs: StagedBlob[]
	): Promise<void> {
		assertManifest(manifest);
		const db = await this.#open();
		try {
			for (const blob of blobs) {
				await verifyBlob(blob.reference, blob.bytes);
				const previous = await this.readBlob(blob.reference);
				if (previous) await verifyBlob(blob.reference, previous);
				else {
					const transaction = db.transaction(blobStore, 'readwrite');
					transaction.objectStore(blobStore).add(new Uint8Array(blob.bytes), blob.reference.id);
					await done(transaction);
				}
				const staged = await this.readBlob(blob.reference);
				if (!staged) throw new Error('Staged Pokemon preservation payload is missing.');
				await verifyBlob(blob.reference, staged);
			}
			for (const reference of referencedPayloads(manifest)) {
				const bytes = await this.readBlob(reference);
				if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
				await verifyBlob(reference, bytes);
			}
			const transaction = db.transaction([manifestStore, blobStore], 'readwrite');
			try {
				const current = await request<PokemonStorageManifest | undefined>(
					transaction.objectStore(manifestStore).get('current')
				);
				if (
					(current?.revision ?? null) !== expectedRevision ||
					(current && current.storageId !== manifest.storageId) ||
					manifest.revision !== (expectedRevision ?? -1) + 1
				)
					throw new CatalogConflictError();
				for (const reference of referencedPayloads(manifest)) {
					const bytes = await request<Uint8Array | undefined>(
						transaction.objectStore(blobStore).get(reference.id)
					);
					if (!bytes) throw new Error('Required Pokemon preservation payload is missing.');
				}
				transaction.objectStore(manifestStore).put(cloneManifest(manifest), 'current');
				await done(transaction);
			} catch (error) {
				try {
					transaction.abort();
				} catch {
					/* Transaction already closed. */
				}
				throw error;
			}
		} finally {
			db.close();
		}
	}
	async sweep(): Promise<number> {
		const db = await this.#open();
		try {
			const transaction = db.transaction([manifestStore, blobStore], 'readwrite');
			const manifest = await request<PokemonStorageManifest | undefined>(
				transaction.objectStore(manifestStore).get('current')
			);
			if (manifest) assertManifest(manifest);
			const referenced = new Set(
				manifest ? referencedPayloads(manifest).map((item) => item.id) : []
			);
			const keys = await request<IDBValidKey[]>(transaction.objectStore(blobStore).getAllKeys());
			const orphans = keys.filter((key) => !referenced.has(String(key)));
			for (const key of orphans) transaction.objectStore(blobStore).delete(key);
			await done(transaction);
			return orphans.length;
		} finally {
			db.close();
		}
	}
}
export function deleteBrowserCatalog(databaseName: string): Promise<void> {
	return request(indexedDB.deleteDatabase(databaseName)).then(() => undefined);
}
