import { expect, test, type Page } from '@playwright/test';

const aron =
	'rVIoJRblSsu7zMnI/xUAAwQAAgK+w9LDv///AH8OAAB+AQAAfwYAAAAoAAAhAGoAvQAdACMeCg8AAAAAAAAAAAAAAAAAN4uhozfCnwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

async function seedStorage(page: Page, slots = [0]) {
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await page.evaluate(
		async ({ entityBytesBase64, occupied }) => {
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
						boxCount: 1,
						boxSlotCount: 30,
						updatedAt: '2026-10-02T00:00:00Z',
						boxes: [
							{
								index: 0,
								name: 'Favorites',
								slots: Array.from({ length: 30 }, (_, slot) => ({
									box: 0,
									slot,
									pokemon: occupied.includes(slot)
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
													entryMode: 'imported',
													originSaveFileName: null,
													originGame: 'E',
													originalTrainer: null,
													trainerId: null,
													enteredAt: '2026-10-02T00:00:00Z'
												}
											}
										: null
								}))
							}
						]
					});
					transaction.oncomplete = () => {
						db.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			});
		},
		{ entityBytesBase64: aron, occupied: slots }
	);
	await page.reload();
	await page.goto('/?source=pokemon-storage');
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
}

async function clearSlot(page: Page, slot: number) {
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page
		.getByRole('dialog', { name: 'Slot actions' })
		.getByRole('button', { name: 'Clear Slot' })
		.click();
	await page.getByRole('button', { name: 'Confirm Clear' }).click();
	await expect(page.locator(`#box-0-slot-${slot}`)).toContainText('Empty');
}

async function openRecentlyDeleted(page: Page) {
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /Recently Deleted: Recently Deleted/ }).click();
}

test('Clear Slot can be restored or permanently deleted', async ({ page }) => {
	await seedStorage(page);
	await clearSlot(page, 0);
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /All Pokemon: All Pokemon/ }).click();
	await expect(page.getByRole('grid', { name: 'All Pokemon' }).getByRole('gridcell')).toHaveCount(
		0
	);
	await openRecentlyDeleted(page);
	const grid = page.getByRole('grid', { name: 'Recently Deleted Pokemon' });
	await expect(grid.getByRole('gridcell')).toHaveCount(1);
	await page.getByRole('button', { name: 'Restore' }).first().click();
	await expect(grid.getByRole('gridcell')).toHaveCount(0);
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /Box 01: Box 01/ }).click();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await clearSlot(page, 0);
	await openRecentlyDeleted(page);
	await page.getByRole('button', { name: 'Delete Permanently' }).first().click();
	await expect(grid.getByRole('gridcell')).toHaveCount(0);
	await page.reload();
	await expect(page.locator('[data-location="recently-deleted"]')).toBeVisible();
	await expect(
		page.getByRole('grid', { name: 'Recently Deleted Pokemon' }).getByRole('gridcell')
	).toHaveCount(0);
});

test('Empty Recently Deleted needs confirmation', async ({ page }) => {
	await seedStorage(page);
	await clearSlot(page, 0);
	await openRecentlyDeleted(page);
	const grid = page.getByRole('grid', { name: 'Recently Deleted Pokemon' });
	await expect(grid.getByRole('gridcell')).toHaveCount(1);
	await page.getByRole('button', { name: 'Empty Recently Deleted' }).click();
	await page
		.getByRole('group', { name: 'Confirm Empty Recently Deleted' })
		.getByRole('button', { name: 'Cancel' })
		.click();
	await expect(grid.getByRole('gridcell')).toHaveCount(1);
	await page.getByRole('button', { name: 'Empty Recently Deleted' }).click();
	await page.getByRole('button', { name: 'Confirm Empty' }).click();
	await expect(grid.getByRole('gridcell')).toHaveCount(0);
	await page.reload();
	await expect(page.locator('[data-location="recently-deleted"]')).toBeVisible();
	await expect(
		page.getByRole('grid', { name: 'Recently Deleted Pokemon' }).getByRole('gridcell')
	).toHaveCount(0);
});

test('expired recovery leaves a lightweight tombstone and disappears after reload', async ({
	page
}) => {
	await seedStorage(page);
	await clearSlot(page, 0);
	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const opening = indexedDB.open('pksx-pokemon-storage-catalog');
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () => reject(opening.error);
		});
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction('manifest', 'readwrite');
			const store = transaction.objectStore('manifest');
			const request = store.get('current');
			request.onsuccess = () => {
				const manifest = request.result;
				manifest.tombstones[0].deletedAt = '2020-01-01T00:00:00Z';
				store.put(manifest, 'current');
			};
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
		db.close();
	});
	await page.reload();
	await openRecentlyDeleted(page);
	await expect(
		page.getByRole('grid', { name: 'Recently Deleted Pokemon' }).getByRole('gridcell')
	).toHaveCount(0);
	const tombstone = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const opening = indexedDB.open('pksx-pokemon-storage-catalog');
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () => reject(opening.error);
		});
		const result = await new Promise<{ recovery?: unknown }>((resolve, reject) => {
			const request = db.transaction('manifest').objectStore('manifest').get('current');
			request.onsuccess = () => resolve(request.result.tombstones[0]);
			request.onerror = () => reject(request.error);
		});
		db.close();
		return result;
	});
	expect(tombstone).not.toHaveProperty('recovery');
});
