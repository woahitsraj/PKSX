import { expect, test } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

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
		await page.locator('#save-file-input').setInputFiles({
			name: 'a-unopened.sav',
			mimeType: 'application/octet-stream',
			buffer: await readFile(
				path.resolve(
					'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
				)
			)
		});
		await expect(
			page.getByRole('button', { name: 'Open a-unopened.sav in Boxes', exact: true })
		).toBeVisible();
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
		const firstSave = page.locator('.save-card .card-main').first();
		await expect(firstSave).toHaveAttribute('aria-label', 'Open a-unopened.sav in Boxes');
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
		await expect(firstSave).toHaveAttribute('aria-label', 'Open emerald-011020251345.sav in Boxes');
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

test.describe('display names across Save File consumers', () => {
	test.use({ hasTouch: true });
	for (const height of [336, 720]) {
		test(`duplicate names keep context and original Export bytes at height ${height}`, async ({
			page
		}) => {
			await page.setViewportSize({ width: 960, height });
			await page.goto('/');
			await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
				'data-initial-state',
				'ready'
			);
			const bytes = await readFile(
				path.resolve(
					'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
				)
			);
			await page
				.locator('#save-file-input')
				.setInputFiles({ name: 'alpha.sav', mimeType: 'application/octet-stream', buffer: bytes });
			await expect(
				page.getByRole('button', { name: 'Open alpha.sav in Boxes', exact: true })
			).toBeVisible();
			await page.getByRole('grid', { name: 'Saves collections' }).focus();
			await page.keyboard.press('x');
			for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowDown');
			await page.keyboard.press('Enter');
			await page.getByLabel('Display name', { exact: true }).fill('  Journey  ');
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('Enter');
			await expect(
				page.getByRole('button', { name: 'Open Journey in Boxes', exact: true })
			).toBeVisible();
			await page
				.locator('#save-file-input')
				.setInputFiles({ name: 'beta.sav', mimeType: 'application/octet-stream', buffer: bytes });
			await page
				.getByRole('button', { name: 'Open Save File Menu for beta.sav', exact: true })
				.tap();
			await page.getByRole('button', { name: 'Rename', exact: true }).tap();
			await page.getByLabel('Display name', { exact: true }).fill('Journey');
			await page.getByRole('button', { name: 'Apply', exact: true }).tap();
			await expect(
				page.getByRole('button', { name: 'Open Journey in Boxes', exact: true })
			).toHaveCount(2);
			await page.reload();
			await expect(
				page.getByRole('button', { name: 'Open Journey in Boxes', exact: true })
			).toHaveCount(2);
			await expect(page.locator('.save-card').filter({ hasText: 'alpha.sav' })).toContainText(
				'DIXIE'
			);
			await expect(page.locator('.save-card').filter({ hasText: 'beta.sav' })).toContainText(
				'Pokemon Emerald'
			);
			for (const destination of ['Trainer', 'Bag']) {
				await page
					.locator('.save-card')
					.filter({ hasText: 'alpha.sav' })
					.getByRole('button', { name: 'Open Save File Menu for Journey', exact: true })
					.tap();
				await page.getByRole('button', { name: 'Open ' + destination, exact: true }).tap();
				const ledger = page.locator('[data-destination-root="' + destination.toLowerCase() + '"]');
				await expect(ledger).toHaveAttribute('data-initial-state', 'ready');
				await expect(ledger.locator('.filename')).toHaveText('Journey');
				await expect(ledger.locator('.filename')).toHaveAttribute('title', 'alpha.sav');
				await page.getByRole('button', { name: 'Open Main Menu' }).tap();
				await page
					.getByRole('dialog', { name: 'Main Menu' })
					.getByRole('button', { name: /^Saves/ })
					.tap();
				await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
					'data-initial-state',
					'ready'
				);
			}
			await page
				.locator('.save-card')
				.filter({ hasText: 'alpha.sav' })
				.getByRole('button', { name: 'Open Save File Menu for Journey', exact: true })
				.tap();
			await page.getByRole('button', { name: 'Delete from Saves', exact: true }).tap();
			await expect(
				page.getByRole('dialog', { name: 'Delete Journey?', exact: true })
			).toBeVisible();
			await page.getByRole('button', { name: 'Keep Save File', exact: true }).tap();
			await page.keyboard.press('Escape');
			await expect(
				page.getByRole('button', { name: 'Open Journey in Boxes', exact: true })
			).toHaveCount(2);
			await page.locator('.save-card').filter({ hasText: 'alpha.sav' }).locator('.card-main').tap();
			await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
				'data-initial-state',
				'ready'
			);
			await page.getByRole('button', { name: 'Open Main Menu' }).tap();
			await page
				.getByRole('dialog', { name: 'Main Menu' })
				.getByRole('button', { name: /^Backup Browser/ })
				.tap();
			await expect(page.locator('#backup-browser-description')).toHaveText('Journey');
			await page.getByRole('button', { name: 'Close Backup Browser' }).tap();
			await page.getByRole('button', { name: 'Open Box Menu for Journey', exact: true }).tap();
			await page.getByRole('button', { name: 'Switch', exact: true }).tap();
			await expect(page.locator('.source-card').filter({ hasText: 'alpha.sav' })).toContainText(
				'Journey'
			);
			await expect(page.locator('.source-card').filter({ hasText: 'beta.sav' })).toContainText(
				'Journey'
			);
			await page.locator('.source-picker-close').tap();
			const download = page.waitForEvent('download');
			await page.getByRole('button', { name: 'Export', exact: true }).tap();
			const exported = await download;
			expect(exported.suggestedFilename()).toBe('alpha.pksx.sav');
			const exportedPath = await exported.path();
			if (!exportedPath) throw new Error('The exported Save File is missing.');
			expect(await readFile(exportedPath)).toEqual(bytes);
		});
	}
});
