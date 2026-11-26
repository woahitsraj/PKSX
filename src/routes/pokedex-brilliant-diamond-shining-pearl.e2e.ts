import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

test.setTimeout(180_000);

const fixture = path.resolve('test-fixtures/save-files/pkmds-blazor/pokemon-brilliant-diamond.bin');

async function choose(page: Page, label: string) {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: new RegExp(`^${label}`) })
		.click();
	await expect(page.locator(`[data-destination-root="${label.toLowerCase()}"]`)).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
}

async function readSafetyState(page: Page) {
	return page.evaluate(
		() =>
			new Promise<{ backups: number; dirty: boolean }>((resolve, reject) => {
				const request = indexedDB.open('pksx-saves');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction(['backups', 'workspaces'], 'readonly');
					const count = tx.objectStore('backups').count();
					const workspaces = tx.objectStore('workspaces').getAll();
					tx.oncomplete = () => {
						resolve({ backups: count.result, dirty: workspaces.result[0]?.dirty ?? false });
						db.close();
					};
				};
			})
	);
}

async function toggle(page: Page, name: string) {
	const control = page.getByRole('button', { name, exact: true });
	const previous = await control.getAttribute('aria-pressed');
	await control.click();
	await expect(control).toHaveAttribute('aria-pressed', previous === 'true' ? 'false' : 'true', {
		timeout: 90_000
	});
	await expect(control).toBeFocused();
}

test('Brilliant Diamond Pokedex edits Sinnoh, Heard of and species flags', async ({ page }) => {
	await page.setViewportSize({ width: 640, height: 360 });
	await loadRoute(page, '/');
	await page.getByLabel('Import Save File').setInputFiles(fixture);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
	await choose(page, 'Pokedex');
	await expect(page.getByLabel('Sinnoh Pokedex (0 = off, 1 = on)')).toBeVisible();
	await expect(page.getByLabel('National Pokedex (0 = off, 1 = on)')).toBeVisible();
	const search = page.getByRole('searchbox');
	await search.fill('Pikachu');
	await expect(page.locator('.species-row')).toHaveCount(1);
	const values = page.getByRole('button', { name: 'Pikachu values', exact: true });
	await values.click();
	await page.keyboard.press('ArrowDown');
	await expect(
		page.getByLabel('Pokedex state (0 = none, 1 = heard of, 2 = seen, 3 = caught)')
	).toBeFocused();
	for (const absent of ['Caught Gigantamaxed', 'Displayed shiny'])
		await expect(page.getByRole('button', { name: `Pikachu ${absent}` })).toHaveCount(0);
	expect((await readSafetyState(page)).dirty).toBe(false);
	await toggle(page, 'Pikachu Language: Chinese (traditional)');
	await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });
	await toggle(page, 'Pikachu Seen: shiny female');

	// Heard of is the Generation 8b state below Seen.
	const state = page.getByLabel('Pokedex state (0 = none, 1 = heard of, 2 = seen, 3 = caught)');
	await state.fill('1');
	await state.press('Enter');
	await expect(page.locator('[data-destination-focus="apply-state-25"]')).toHaveAttribute(
		'aria-disabled',
		'false',
		{ timeout: 90_000 }
	);
	await expect(page.getByRole('button', { name: 'Pikachu Seen', exact: true })).toHaveAttribute(
		'aria-pressed',
		'false',
		{ timeout: 90_000 }
	);
	await expect(state).toHaveValue('1');
	await expect(values).toHaveAttribute('aria-expanded', 'true');
	expect(await readSafetyState(page)).toEqual({ backups: 1, dirty: true });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

	await choose(page, 'Boxes');
	await page
		.getByRole('button', { name: /Open Box Menu for/ })
		.first()
		.click();
	const downloadPromise = page.waitForEvent('download');
	await page
		.getByRole('dialog', { name: 'Box Menu' })
		.getByRole('button', { name: 'Export', exact: true })
		.click();
	const exported = await (await downloadPromise).path();
	if (!exported) throw new Error('Missing export');
	expect(await readFile(exported)).not.toEqual(await readFile(fixture));
});
