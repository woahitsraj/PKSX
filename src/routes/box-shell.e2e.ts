import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

test('keyboard navigation moves deterministically across the box grid', async ({ page }) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();

	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-7')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#box-0-slot-6')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#party-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#party-grid')).toBeFocused();
});

test('confirm opens slot actions and back restores the grid focus', async ({ page }) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toContainText('Box 1, slot 2');

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#box-grid')).toBeFocused();
});

test('shoulder-tab behavior preserves the slot coordinate while changing boxes', async ({
	page
}) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press(']');

	await expect(page.getByRole('heading', { name: 'Box 2' })).toBeVisible();
	await expect(page.locator('#box-1-slot-7')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('[');
	await expect(page.getByRole('heading', { name: 'Box 1' })).toBeVisible();
	await expect(page.locator('#box-0-slot-7')).toHaveAttribute('aria-selected', 'true');
});

test('shoulder-tab behavior wraps between the last and first boxes', async ({ page }) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();

	await page.keyboard.press('[');
	await expect(page.getByRole('heading', { name: 'Box 3' })).toBeVisible();
	await expect(page.locator('#box-2-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press(']');
	await expect(page.getByRole('heading', { name: 'Box 1' })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');
});

test('mouse clicks move controller focus without opening slot actions', async ({ page }) => {
	await page.goto('/');
	await page.locator('#party-slot-4').click();

	await expect(page.locator('#party-slot-4')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
});

test('imports the Emerald Save File, renders engine data, and exports serialized bytes', async ({
	page
}) => {
	await page.goto('/');
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);

	await expect(page.getByText('011020251345.sav loaded.')).toBeVisible({ timeout: 15000 });
	await expect(page.getByText('DIXIE', { exact: true })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await expect(page.locator('#party-slot-0')).toContainText('1-UP');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export' }).click();
	const download = await downloadPromise;
	const exported = await readFile(await download.path());
	const fixture = await readFile(emeraldFixturePath);

	expect(download.suggestedFilename()).toBe('emerald-011020251345.pksx.sav');
	expect(exported.byteLength).toBe(fixture.byteLength);
});

test('reloads the most recent imported Save File while offline', async ({ page, context }) => {
	await page.goto('/');
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);

	await expect(page.getByText('011020251345.sav loaded.')).toBeVisible({ timeout: 15000 });
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');

	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON', { timeout: 15000 });

	await context.setOffline(true);
	await page.reload();

	await expect(page.getByText('011020251345.sav restored from Local Library.')).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');

	await context.setOffline(false);
});
