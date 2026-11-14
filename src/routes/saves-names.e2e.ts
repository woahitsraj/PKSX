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
	await expect(page.getByRole('heading', { name: 'Box 02', exact: true })).toBeVisible();
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
	await expect(page.getByRole('heading', { name: 'Box 01', exact: true })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-label', firstSlot!);
});
