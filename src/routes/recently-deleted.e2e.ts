import { expect, test, type Page } from '@playwright/test';
import { waitForPokemonStorageRoot } from './pokemon-storage-seed.e2e-helper';

const aron =
	'rVIoJRblSsu7zMnI/xUAAwQAAgK+w9LDv///AH8OAAB+AQAAfwYAAAAoAAAhAGoAvQAdACMeCg8AAAAAAAAAAAAAAAAAN4uhozfCnwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

async function seedStorage(page: Page, slots = [0]) {
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await waitForPokemonStorageRoot(page);
	await page.evaluate(
		async ({ entityBytesBase64, occupied }) => {
			await new Promise<void>((resolve, reject) => {
				const opening = indexedDB.open('pksx-saves');
				opening.onerror = () => reject(opening.error);
				opening.onsuccess = () => {
					const db = opening.result;
					const transaction = db.transaction('manifest', 'readwrite');
					transaction.objectStore('manifest').delete('current');
					transaction.oncomplete = () => {
						db.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
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
	await expect(page.getByRole('button', { name: 'Open Pokemon Storage in Boxes' })).toContainText(
		`${slots.length} Pokemon`
	);
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
	await grid.getByRole('gridcell').focus();
	await page.keyboard.press('Enter');
	const menu = page.getByRole('dialog', { name: 'Recently Deleted actions' });
	await expect(menu).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu).toBeHidden();
	await expect(grid.getByRole('gridcell')).toBeFocused();
	await grid.getByRole('gridcell').click();
	await menu.getByRole('button', { name: 'Restore' }).click();
	await expect(grid.getByRole('gridcell')).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' })
	).toBeFocused();
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /Box 01: Favorites/ }).click();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await clearSlot(page, 0);
	await openRecentlyDeleted(page);
	await grid.getByRole('gridcell').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(grid.getByRole('gridcell')).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' })
	).toBeFocused();
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
	const confirm = page.getByRole('dialog', { name: 'Empty Recently Deleted?' });
	await expect(confirm).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(confirm).toBeHidden();
	await expect(page.getByRole('button', { name: 'Empty Recently Deleted' })).toBeFocused();
	await expect(grid.getByRole('gridcell')).toHaveCount(1);
	await grid.getByRole('gridcell').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(confirm).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Recently Deleted actions' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Empty Recently Deleted' }).last()).toBeFocused();
	await page.keyboard.press('Enter');
	await confirm.getByRole('button', { name: 'Confirm Empty' }).click();
	await expect(grid.getByRole('gridcell')).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' })
	).toBeFocused();
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
			const opening = indexedDB.open('pksx-saves');
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
			const opening = indexedDB.open('pksx-saves');
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
