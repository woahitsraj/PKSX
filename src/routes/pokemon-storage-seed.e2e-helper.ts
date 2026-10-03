import { expect, type Page } from '@playwright/test';

export async function waitForPokemonStorageRoot(page: Page) {
	await expect
		.poll(
			async () =>
				page.evaluate(async () => {
					const db = await new Promise<IDBDatabase>((resolve, reject) => {
						const opening = indexedDB.open('pksx-saves');
						opening.onsuccess = () => resolve(opening.result);
						opening.onerror = () => reject(opening.error);
					});
					try {
						return await new Promise<boolean>((resolve, reject) => {
							const read = db.transaction('manifest').objectStore('manifest').get('current');
							read.onsuccess = () => resolve(Boolean(read.result));
							read.onerror = () => reject(read.error);
						});
					} finally {
						db.close();
					}
				}),
			{ timeout: 15000 }
		)
		.toBe(true);
}
