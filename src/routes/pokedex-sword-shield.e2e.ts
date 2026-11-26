import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

test.setTimeout(180_000);

const fixture = path.resolve(
	'test-fixtures/save-files/pkhex-generated/shield-without-crown-tundra.sav'
);

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

test('Sword and Shield Pokedex shows regional state and edits species values', async ({ page }) => {
	await page.setViewportSize({ width: 640, height: 360 });
	await loadRoute(page, '/');
	await page.getByLabel('Import Save File').setInputFiles(fixture);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
	await choose(page, 'Pokedex');
	await expect(page.getByRole('list', { name: 'Regional Pokedexes' })).toContainText(
		'Crown Tundra Pokedex: This Save File has no Crown Tundra Pokedex data.'
	);
	await expect(page.locator('.search-row .count')).toHaveText('510 species');
	const search = page.getByRole('searchbox');
	for (const missing of ['Mewtwo', 'Calyrex']) {
		await search.fill(missing);
		await expect(page.getByText('No matching species.')).toBeVisible();
	}
	await search.fill('Galar 001');
	await expect(page.locator('.species-row')).toHaveCount(1);
	await expect(page.locator('.species-row .name')).toHaveText('Grookey');

	await search.fill('Rillaboom');
	const values = page.getByRole('button', { name: 'Rillaboom values', exact: true });
	await values.click();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByLabel('Displayed gender (0 = male, 1 = female)')).toBeFocused();
	const battled = page.getByLabel('Times battled');
	await battled.fill('7');
	await battled.press('Enter');
	await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });
	await expect(battled).toHaveValue('7');
	for (const name of ['Rillaboom Caught Gigantamaxed', 'Rillaboom Seen']) {
		const control = page.getByRole('button', { name, exact: true });
		const previous = await control.getAttribute('aria-pressed');
		await control.click();
		await expect(control).toHaveAttribute('aria-pressed', previous === 'true' ? 'false' : 'true', {
			timeout: 90_000
		});
		await expect(control).toBeFocused();
	}
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
