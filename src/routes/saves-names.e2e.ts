import { expect, test } from '@playwright/test';
import path from 'node:path';

for (const height of [336, 720]) {
	test(`rename preserves filenames, cancellation and reset at height ${height}`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 960, height });
		await page.goto('/');
		await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		await page
			.locator('#save-file-input')
			.setInputFiles(
				path.resolve(
					'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
				)
			);
		const menu = page.getByRole('button', {
			name: 'Open Save File Menu for emerald-011020251345.sav'
		});
		await menu.click();
		await page.getByRole('button', { name: 'Rename', exact: true }).click();
		await page.getByLabel('Display name', { exact: true }).fill('   ');
		await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled();
		await page.getByLabel('Display name', { exact: true }).fill('Discarded');
		await page.getByRole('button', { name: 'Cancel', exact: true }).click();
		await page.getByRole('button', { name: 'Rename', exact: true }).click();
		await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
			'emerald-011020251345.sav'
		);
		await page.getByLabel('Display name', { exact: true }).fill('  Adventure  ');
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(
			page.getByRole('button', { name: 'Open Adventure in Boxes', exact: true })
		).toBeVisible();
		await expect(page.getByRole('grid', { name: 'Saves collections' })).toBeFocused();
		await page.reload();
		await page
			.getByRole('button', { name: 'Open Save File Menu for Adventure', exact: true })
			.click();
		await page.getByRole('button', { name: 'Rename', exact: true }).click();
		await page.getByRole('button', { name: 'Reset to original filename' }).click();
		await page.getByRole('button', { name: 'Apply', exact: true }).click();
		await expect(menu).toBeVisible();
	});
}

for (const height of [336, 720]) {
	test(`search, sort and successful-open history survive reload at height ${height}`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 960, height });
		await page.goto('/');
		await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		await page
			.locator('#save-file-input')
			.setInputFiles(
				path.resolve(
					'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
				)
			);
		const open = page.getByRole('button', {
			name: 'Open emerald-011020251345.sav in Boxes',
			exact: true
		});
		await expect(open).toBeVisible();
		const search = page.getByRole('searchbox', { name: 'Search Saves' });
		for (const query of ['EMERALD', 'dIxIe', '011020251345']) {
			await search.fill(query);
			await expect(open).toBeVisible();
		}
		const grid = page.getByRole('grid', { name: 'Saves collections' });
		const before = await grid.getAttribute('aria-activedescendant');
		await page.getByRole('button', { name: 'Sort: Alphabetical', exact: true }).click();
		await expect(grid).toHaveAttribute('aria-activedescendant', before!);
		await search.fill('nothing-matches');
		await expect(
			page.getByText('No Save Files match your search.', { exact: false })
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Import a Save File', exact: true })
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Open Pokemon Storage in Boxes' })).toBeVisible();
		await page.getByRole('button', { name: 'Clear search', exact: true }).click();
		await expect(open).toBeVisible();
		await open.click();
		await expect(page.locator('[data-destination-root="boxes"]')).toBeVisible();
		await page.goto('/saves');
		await expect(
			page.getByRole('button', { name: 'Sort: Recently opened', exact: true })
		).toBeVisible();
		await page.reload();
		await expect(
			page.getByRole('button', { name: 'Sort: Recently opened', exact: true })
		).toBeVisible();
		const history = await page.evaluate(async () => {
			const database = await new Promise<IDBDatabase>((resolve) => {
				const request = indexedDB.open('pksx-saves');
				request.onsuccess = () => resolve(request.result);
			});
			const records = await new Promise<Array<{ lastOpenedAt?: string }>>((resolve) => {
				const request = database.transaction('saveFiles').objectStore('saveFiles').getAll();
				request.onsuccess = () => resolve(request.result);
			});
			database.close();
			return records[0]?.lastOpenedAt;
		});
		expect(history).toBeTruthy();
	});
}

test('renaming an active save preserves the cached box projection identity', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await page
		.locator('#save-file-input')
		.setInputFiles(
			path.resolve('test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav')
		);
	await page
		.getByRole('button', { name: 'Open emerald-011020251345.sav in Boxes', exact: true })
		.click();
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	const firstSlot = await page.locator('#box-0-slot-0').getAttribute('aria-label');
	await page.getByRole('button', { name: 'Next Location', exact: true }).click();
	await expect(page.locator('.box-pane.active-pane')).toHaveAttribute('data-location', 'box-1');
	await expect(page.locator('#box-1-slot-0')).toBeVisible();
	await expect(page.locator('.box-pane[aria-busy="true"]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Saves/ })
		.click();
	await page
		.getByRole('button', { name: 'Open Save File Menu for emerald-011020251345.sav', exact: true })
		.click();
	await page.getByRole('button', { name: 'Rename', exact: true }).click();
	await page.getByLabel('Display name', { exact: true }).fill('Renamed box owner');
	await page.getByRole('button', { name: 'Apply', exact: true }).click();
	await page.getByRole('button', { name: 'Open Renamed box owner in Boxes', exact: true }).click();
	await expect(page.locator('.box-pane.active-pane')).toHaveAttribute('data-location', 'box-0');
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-label', firstSlot!);
});
