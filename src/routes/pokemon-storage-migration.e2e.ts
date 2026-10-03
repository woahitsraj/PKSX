import { expect, test } from '@playwright/test';

const aron =
	'rVIoJRblSsu7zMnI/xUAAwQAAgK+w9LDv///AH8OAAB+AQAAfwYAAAAoAAAhAGoAvQAdACMeCg8AAAAAAAAAAAAAAAAAN4uhozfCnwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

test('migrates a legacy collection and retains its boxes and Pokemon after reload', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await page.evaluate(async (entityBytesBase64) => {
		await new Promise<void>((resolve, reject) => {
			const deletion = indexedDB.deleteDatabase('pksx-pokemon-storage-catalog');
			deletion.onsuccess = () => resolve();
			deletion.onerror = () => reject(deletion.error);
		});
		await new Promise<void>((resolve, reject) => {
			const opening = indexedDB.open('pksx-saves');
			opening.onerror = () => reject(opening.error);
			opening.onsuccess = () => {
				const db = opening.result;
				const transaction = db.transaction('pokemonStorage', 'readwrite');
				transaction.objectStore('pokemonStorage').put({
					id: 'pokemon-storage',
					schemaVersion: 1,
					boxCount: 3,
					boxSlotCount: 30,
					updatedAt: '2026-10-02T00:00:00Z',
					boxes: Array.from({ length: 3 }, (_, box) => ({
						index: box,
						name: ['Favorites', 'Empty collection', 'Trade'][box],
						slots: Array.from({ length: 30 }, (_, slot) => ({
							box,
							slot,
							pokemon:
								box === 0 && slot === 4
									? {
											label: 'ARON',
											detail: 'Legacy',
											level: null,
											experience: null,
											speciesId: null,
											form: null,
											isEgg: false,
											spriteIdentity: null,
											entityBytesBase64,
											origin: {
												entryMode: 'moved-in',
												originSaveFileName: 'source.sav',
												originGame: 'E',
												originalTrainer: 'Trainer',
												trainerId: '123',
												enteredAt: '2026-10-02T00:00:00Z'
											}
										}
									: null
						}))
					}))
				});
				transaction.oncomplete = () => {
					db.close();
					resolve();
				};
				transaction.onerror = () => reject(transaction.error);
			};
		});
	}, aron);

	await page.reload();
	const storage = page.getByRole('button', { name: 'Open Pokemon Storage in Boxes' });
	await expect(storage).toContainText('1 Pokemon');
	await expect(storage).toContainText('3 Storage');
	await storage.click();
	await expect(page.locator('#box-0-slot-4')).toContainText('ARON');
	await expect(page.getByRole('heading', { name: 'Favorites, Box 01 of 3' })).toBeVisible();
	await page.reload();
	await expect(page.locator('#box-0-slot-4')).toContainText('ARON');
	const state = await page.evaluate(async () => {
		const read = async (name: string, store: string, key: string): Promise<unknown> => {
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				const opening = indexedDB.open(name);
				opening.onsuccess = () => resolve(opening.result);
				opening.onerror = () => reject(opening.error);
			});
			try {
				return await new Promise((resolve, reject) => {
					const request = db.transaction(store).objectStore(store).get(key);
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				});
			} finally {
				db.close();
			}
		};
		return {
			legacy: await read('pksx-saves', 'pokemonStorage', 'pokemon-storage'),
			catalog: await read('pksx-pokemon-storage-catalog', 'manifest', 'current')
		};
	});
	expect(state.legacy).toMatchObject({ boxCount: 3 });
	expect(state.legacy).toHaveProperty('boxes.0.name', 'Favorites');
	expect(state.catalog).toMatchObject({
		boxes: [{ name: 'Favorites' }, { name: 'Empty collection' }, { name: 'Trade' }],
		records: [{ origin: { originSaveFileName: 'source.sav' }, projection: { speciesId: 304 } }]
	});
});
