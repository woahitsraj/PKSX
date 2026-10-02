import { expect, test } from '@playwright/test';

const aron =
	'rVIoJRblSsu7zMnI/xUAAwQAAgK+w9LDv///AH8OAAB+AQAAfwYAAAAoAAAhAGoAvQAdACMeCg8AAAAAAAAAAAAAAAAAN4uhozfCnwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

test('migrates and browses a collection with Unfiled, Carry, and Search', async ({ page }) => {
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
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /All Pokemon: All Pokemon/ }).click();
	await expect(page.getByRole('grid', { name: 'All Pokemon' }).getByRole('gridcell')).toHaveCount(
		1
	);
	await page.getByRole('button', { name: 'Move to Unfiled' }).click();
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /Unfiled: Unfiled/ }).click();
	await expect(
		page.getByRole('grid', { name: 'Unfiled Pokemon' }).getByRole('gridcell')
	).toHaveCount(1);
	await page.locator('.carry-actions').getByRole('button', { name: 'Move' }).click();
	await page.getByRole('button', { name: /Box 01: Box 01/ }).click();
	await page.locator('#box-0-slot-4').click();
	await expect(page.locator('#box-0-slot-4')).toContainText('ARON');
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
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /All Pokemon: All Pokemon/ }).click();
	await page.getByRole('searchbox', { name: 'Filter Pokemon' }).fill('ARON');
	await page.getByRole('combobox', { name: 'Sort Pokemon' }).selectOption('level');
	await page.reload();
	await expect(page.locator('[data-location="all-pokemon"]')).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Filter Pokemon' })).toHaveValue('ARON');
	await expect(page.getByRole('combobox', { name: 'Sort Pokemon' })).toHaveValue('level');
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Search/ })
		.click();
	const search = page.getByRole('dialog', { name: 'Search Pokemon Storage' });
	await search.getByRole('searchbox').fill('ARON');
	await search.getByRole('button', { name: /ARON, Aron/ }).click();
	await expect(page.getByRole('gridcell', { name: 'ARON, level 11' })).toBeFocused();

	await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const opening = indexedDB.open('pksx-pokemon-storage-catalog');
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () => reject(opening.error);
		});
		const manifest = await new Promise<{ records: Array<Record<string, unknown>> }>(
			(resolve, reject) => {
				const request = db.transaction('manifest').objectStore('manifest').get('current');
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			}
		);
		const template = manifest.records[0];
		manifest.records.push(
			...Array.from({ length: 120 }, (_, index) => ({
				...template,
				recordId: `virtual-${String(index).padStart(3, '0')}`,
				placement: null,
				createdAt: '2030-01-01T00:00:00Z'
			}))
		);
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction('manifest', 'readwrite');
			transaction.objectStore('manifest').put(manifest, 'current');
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
		db.close();
	});
	await page.reload();
	await page.getByRole('searchbox', { name: 'Filter Pokemon' }).fill('');
	await page.getByRole('combobox', { name: 'Sort Pokemon' }).selectOption('recent');
	const columnCounts: number[] = [];
	for (const width of [1280, 760]) {
		await page.setViewportSize({ width, height: 800 });
		const grid = page.getByRole('grid', { name: 'All Pokemon' });
		const measuredColumns = await grid.evaluate((node) =>
			Math.max(1, Math.floor((node.clientWidth + 8) / 124))
		);
		await expect(grid).toHaveAttribute('aria-colcount', String(measuredColumns));
		const columns = Number(await grid.getAttribute('aria-colcount'));
		columnCounts.push(columns);
		expect(columns).toBeGreaterThan(0);
		expect(await grid.getByRole('gridcell').count()).toBeLessThan(121);
		await grid.evaluate((node) => (node.scrollTop = 0));
		await page.locator('#virtual-record-virtual-000').click();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
		await expect(
			page.getByRole('dialog', { name: 'Slot actions' }).getByRole('button', { name: 'Move' })
		).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('#virtual-record-virtual-000')).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(
			page.locator(`#virtual-record-virtual-${String(columns).padStart(3, '0')}`)
		).toBeFocused();
		for (let row = 2; row <= 13; row++) {
			await page.keyboard.press('ArrowDown');
			await expect(
				page.locator(`#virtual-record-virtual-${String(row * columns).padStart(3, '0')}`)
			).toBeFocused();
		}
		expect(await grid.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
	}
	expect(columnCounts[0]).not.toBe(columnCounts[1]);
});
