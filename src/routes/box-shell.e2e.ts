import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function openEmptyLibrary(page: Page) {
	await page.goto('/');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('pksx-local-library');

				request.onerror = () =>
					reject(request.error ?? new Error('Could not clear local library.'));
				request.onsuccess = () => resolve();
			})
	);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Import a Save File to begin.')).toBeVisible({ timeout: 15000 });
}

test('keyboard navigation moves deterministically across the box grid', async ({ page }) => {
	await openEmptyLibrary(page);
	await expect(page.locator('#box-0-slot-0 img.slot-sprite')).toHaveAttribute(
		'src',
		'./sprites/pokemon/species/0025.png'
	);
	await expect(page.locator('#box-0-slot-0')).toHaveCSS('--slot-hue', '94');
	await expect(page.locator('#box-0-slot-0')).toHaveCSS('--slot-chroma', '0.16');
	await expect(page.locator('#box-0-slot-0')).not.toHaveClass(/dual-type/);
	await expect(page.locator('.portrait-card img')).toHaveAttribute(
		'src',
		'./sprites/pokemon/species/0025.png'
	);
	await expect(
		page.locator('img[src^="https://img.pokemondb.net"], img[src^="http://img.pokemondb.net"]')
	).toHaveCount(0);
	await page.locator('#box-grid').focus();

	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-7')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#box-0-slot-6')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#box-0-slot-6')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#party-slot-0')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#party-slot-0')).toBeFocused();
});

test('compact box controls and keyboard shortcuts update the active box label', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();

	await expect(page.getByRole('heading', { name: 'Box 01' })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('button', { name: 'Next box' }).click();
	await expect(page.getByRole('heading', { name: 'Box 02' })).toBeVisible();
	await expect(page.locator('#box-1-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.locator('#box-grid').focus();
	await page.keyboard.press('PageDown');
	await expect(page.getByRole('heading', { name: 'Box 03' })).toBeVisible();
	await expect(page.locator('#box-2-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('PageDown');
	await expect(page.getByRole('heading', { name: 'Box 01' })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('button', { name: 'Previous box' }).click();
	await expect(page.getByRole('heading', { name: 'Box 03' })).toBeVisible();
	await expect(page.locator('#box-2-slot-0')).toHaveAttribute('aria-selected', 'true');
});

test('confirm opens slot actions and back restores the grid focus', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toContainText('Box 1, slot 2');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toContainText('Slot Action');
	await expect(
		page.getByRole('button', {
			name: 'Create Pokemon unavailable: creation is not implemented yet.'
		})
	).toHaveAttribute('aria-disabled', 'true');
	await expect(
		page.getByRole('button', { name: 'Move unavailable: Slot is empty.' })
	).toHaveAttribute('aria-disabled', 'true');

	await expect(page.locator('#slot-action-0')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#slot-action-1')).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#box-0-slot-1')).toBeFocused();
});

test('occupied slot actions expose disabled Pokemon commands and Close dismisses', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog', { name: 'Slot actions' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Pokemon Action');
	await expect(
		page.getByRole('button', {
			name: 'Pokemon Action unavailable: summary view is not implemented yet.'
		})
	).toHaveAttribute('aria-disabled', 'true');
	await expect(
		page.getByRole('button', {
			name: 'Create Pokemon unavailable: Slot already contains a Pokemon.'
		})
	).toHaveAttribute('aria-disabled', 'true');

	await page.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('keyboard navigation reaches top controls and mobile tabs', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#party-slot-0')).toBeFocused();

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#top-control-0')).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-1')).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-2')).toBeFocused();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible();

	await page.locator('#box-0-slot-24').focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-24')).toBeFocused();

	await page.setViewportSize({ width: 420, height: 860 });
	await page.locator('#box-0-slot-0').focus();
	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
		await page.keyboard.press(key);
	}

	await expect(page.locator('#mobile-tab-1')).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#mobile-tab-0')).toBeFocused();
});

test('mobile slot actions stay inside the viewport without adding page overflow', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.setViewportSize({ width: 420, height: 860 });
	await page.locator('#box-grid').focus();

	const beforeOpen = await page.evaluate(() => ({
		bodyScrollHeight: document.body.scrollHeight,
		htmlScrollHeight: document.documentElement.scrollHeight
	}));

	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
		await page.keyboard.press(key);
	}
	await page.keyboard.press('Enter');

	const afterOpen = await page.evaluate(() => {
		const dialog = document.querySelector('[role="dialog"][aria-label="Slot actions"]');
		const selectedSlot = document.querySelector('[aria-selected="true"]');
		const rect = dialog?.getBoundingClientRect();
		const slotRect = selectedSlot?.getBoundingClientRect();

		return {
			bodyScrollHeight: document.body.scrollHeight,
			htmlScrollHeight: document.documentElement.scrollHeight,
			dialogBottom: rect?.bottom ?? 0,
			dialogLeft: rect?.left ?? -1,
			dialogRight: rect?.right ?? Number.POSITIVE_INFINITY,
			dialogTop: rect?.top ?? 0,
			selectedSlotBottom: slotRect?.bottom ?? Number.POSITIVE_INFINITY,
			tabbarTop:
				document.querySelector('.mobile-tabbar')?.getBoundingClientRect().top ?? window.innerHeight,
			viewportHeight: window.innerHeight,
			viewportWidth: window.innerWidth
		};
	});

	expect(afterOpen.bodyScrollHeight).toBeLessThanOrEqual(beforeOpen.bodyScrollHeight);
	expect(afterOpen.htmlScrollHeight).toBeLessThanOrEqual(beforeOpen.htmlScrollHeight);
	expect(afterOpen.dialogTop).toBeGreaterThanOrEqual(afterOpen.selectedSlotBottom);
	expect(afterOpen.dialogBottom).toBeLessThanOrEqual(afterOpen.viewportHeight);
	expect(afterOpen.dialogBottom).toBeLessThanOrEqual(afterOpen.tabbarTop);
	expect(afterOpen.dialogLeft).toBeGreaterThanOrEqual(0);
	expect(afterOpen.dialogRight).toBeLessThanOrEqual(afterOpen.viewportWidth);
});

test('mouse clicks move controller focus without opening slot actions', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#party-slot-4').click();

	await expect(page.locator('#party-slot-4')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
});

test('active slot detail rail follows controller focus', async ({ page }) => {
	await openEmptyLibrary(page);
	const rail = page.getByTestId('active-slot-detail-rail');

	await page.locator('#box-grid').focus();
	await expect(rail).toContainText('Pikachu');
	await expect(rail).toContainText('Species #0025');
	await expect(rail).toContainText('LEVEL');
	await expect(rail).toContainText('5');
	await expect(rail).toContainText('Box 01 · Slot 1 · Row A / Col 1');
	await expect(rail).toContainText('Modest');
	await expect(rail).toContainText('Static');
	await expect(rail).toContainText('Light Ball');
	await expect(rail).toContainText('Move Set');
	await expect(rail).toContainText('Thunder Shock');
	await expect(rail).toContainText('Stats');

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(rail).toContainText('Empty slot');
	await expect(rail).toContainText('No Pokemon stored here');
	await expect(rail).toContainText('Box 01 · Slot 2 · Row A / Col 2');
	await expect(rail).not.toContainText('Not available');
	await expect(rail).not.toContainText('Move Set');

	await page.locator('#party-slot-0').click();
	await expect(page.locator('#party-slot-0')).toHaveAttribute('aria-selected', 'true');
	await expect(rail).toContainText('Pikachu');
	await expect(rail).toContainText('Party · Slot 1');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
});

test('imports the Emerald Save File, renders engine data, and exports serialized bytes', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);

	await expect(page.getByText('011020251345.sav loaded.')).toBeVisible({ timeout: 15000 });
	await expect(page.getByText('DIXIE', { exact: true })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await expect(page.locator('#party-slot-0')).toContainText('1-UP');
	const detailRail = page.getByTestId('active-slot-detail-rail');
	await expect(detailRail).toContainText('Steel');
	await expect(detailRail).toContainText('Rock');
	await expect(detailRail).toContainText('Sassy');
	await expect(detailRail).toContainText('Rock Head');
	await expect(detailRail).toContainText('Stats');
	await expect(detailRail).toContainText('HP');
	await expect(detailRail).toContainText('+0');
	await expect(detailRail).toContainText('Move Set');
	await expect(detailRail).not.toContainText('Not available');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export' }).click();
	const download = await downloadPromise;
	const exported = await readFile(await download.path());
	const fixture = await readFile(emeraldFixturePath);

	expect(download.suggestedFilename()).toBe('emerald-011020251345.pksx.sav');
	expect(exported.byteLength).toBe(fixture.byteLength);
});

test('reloads the most recent imported Save File while offline', async ({ page, context }) => {
	await openEmptyLibrary(page);
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
