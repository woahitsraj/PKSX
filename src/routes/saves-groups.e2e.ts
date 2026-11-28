import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadRoute, reloadRoute, settleMotion } from './route-load.e2e-helper';

const fixtures = path.resolve('test-fixtures/save-files');
const emerald = path.join(fixtures, 'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav');
const platinum = path.join(fixtures, 'raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav');

async function pressController(page: Page, key: string) {
	await page.evaluate(async (controllerKey) => {
		const dispatch = (pressed: boolean) =>
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: { key: controllerKey, pressed, discrete: true, id: 'Test controller' }
				})
			);
		const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		dispatch(true);
		await nextFrame();
		await nextFrame();
		dispatch(false);
		await nextFrame();
	}, key);
}

async function chooseView(page: Page, label: 'Flat' | 'By game') {
	await loadRoute(page, '/settings');
	const button = page
		.getByRole('group', { name: 'Saves view' })
		.getByRole('button', { name: label, exact: true });
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
}

for (const height of [336, 720]) {
	test(`groups playthroughs by game and keeps each Save File separate at height ${height}`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 960, height });
		await chooseView(page, 'By game');
		await loadRoute(page, '/saves');
		const input = page.locator('#save-file-input');
		await input.setInputFiles(emerald);
		await expect(
			page.getByRole('button', { name: /^Open emerald-011020251345\.sav/ })
		).toBeVisible();
		await input.setInputFiles({
			name: 'emerald-two.sav',
			mimeType: 'application/octet-stream',
			buffer: await readFile(emerald)
		});
		await expect(page.getByRole('button', { name: /^Choose a Pokemon Emerald/ })).toBeVisible();
		await input.setInputFiles(platinum);
		const group = page.getByRole('button', {
			name: 'Choose a Pokemon Emerald Save File, 2 Save Files'
		});
		const platinumCard = page.getByRole('button', {
			name: 'Open pokemon-platinum-eu.sav in Boxes',
			exact: true
		});
		await expect(group).toBeVisible();
		await expect(platinumCard).toBeVisible();
		await expect(page.locator('.save-card')).toHaveCount(2);

		const grid = page.getByRole('grid', { name: 'Saves collections' });
		const chooser = page.getByRole('dialog', { name: 'Choose Pokemon Emerald Save File' });
		await expect(grid).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(grid).toHaveAttribute('aria-activedescendant', 'saves-target-game-E');
		await page.keyboard.press('x');
		await expect(page.getByRole('dialog', { name: 'Save File Menu' })).toHaveCount(0);

		await pressController(page, 'Enter');
		await expect(chooser).toBeVisible();
		await expect(chooser).toContainText(/dixie/i);
		const first = chooser.getByRole('button', {
			name: 'Open emerald-011020251345.sav in Boxes',
			exact: true
		});
		const second = chooser.getByRole('button', { name: 'Open emerald-two.sav in Boxes' });
		await expect(first).toBeFocused();
		await pressController(page, 'ArrowDown');
		await expect(second).toBeFocused();
		await pressController(page, 'Escape');
		await expect(chooser).toHaveCount(0);
		await expect(grid).toHaveAttribute('aria-activedescendant', 'saves-target-game-E');

		await page.keyboard.press('Enter');
		await expect(first).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('[data-destination-root="boxes"]')).toBeVisible();
		await loadRoute(page, '/saves');
		await expect(group).toBeVisible();
		await expect(grid).toHaveAttribute('aria-activedescendant', 'saves-target-game-E');
		await expect(page.locator('#saves-target-game-E')).toHaveAttribute('aria-current', 'true');

		await reloadRoute(page);
		await group.click();
		await expect(chooser).toBeVisible();
		await chooser.getByRole('button', { name: 'Open Save File Menu for emerald-two.sav' }).click();
		const menu = page.getByRole('dialog', { name: 'Save File Menu' });
		await expect(menu).toContainText('emerald-two.sav');
		await menu.getByRole('button', { name: 'Delete from Saves' }).click();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();
		await settleMotion(page);
		const survivor = page.getByRole('button', {
			name: 'Open emerald-011020251345.sav in Boxes',
			exact: true
		});
		await expect(survivor).toBeVisible();
		await expect(group).toHaveCount(0);
		await expect(platinumCard).toBeVisible();
		await expect(grid).toHaveAttribute(
			'aria-activedescendant',
			(await page.locator('.save-card', { has: survivor }).getAttribute('id'))!
		);
		await survivor.click();
		await expect(page.locator('[data-destination-root="boxes"]')).toBeVisible();

		await chooseView(page, 'Flat');
		await loadRoute(page, '/saves');
		await expect(page.locator('.save-card')).toHaveCount(2);
		await expect(page.locator('.game-card')).toHaveCount(0);
	});
}
