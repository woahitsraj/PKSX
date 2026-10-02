import { afterEach } from 'vitest';
import { BrowserCatalogPersistence, deleteBrowserCatalog } from './browser';
import { catalogContract } from './contract-tests';
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
