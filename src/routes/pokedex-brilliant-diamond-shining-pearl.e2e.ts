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
	await expect(page.locator('.search-row .count')).toHaveText('493 species');
	await expect(page.getByLabel('National Pokedex (0 = off, 1 = on)')).toBeVisible();
	const sinnoh = page.getByLabel('Sinnoh Pokedex (0 = off, 1 = on)');
	const next = (await sinnoh.inputValue()) === '1' ? '0' : '1';
	expect((await readSafetyState(page)).dirty).toBe(false);
	await sinnoh.fill(next);
	await sinnoh.press('Enter');
	await expect(page.locator('[data-destination-focus="apply-regional"]')).toHaveAttribute(
		'aria-disabled',
		'false',
		{ timeout: 90_000 }
	);
	await expect(sinnoh).toHaveValue(next);
	await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });

	const search = page.getByRole('searchbox');
	await search.fill('first seen PID');
	await expect(page.locator('.species-row .name')).toHaveText(['Spinda']);
	await search.fill('Pikachu');
	await expect(page.locator('.species-row')).toHaveCount(1);
	const values = page.getByRole('button', { name: 'Pikachu values', exact: true });
	await values.click();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('.species-values .species-flag').first()).toBeFocused();
	for (const absent of ['Caught Gigantamaxed', 'Displayed shiny', 'Heard of'])
		await expect(page.getByRole('button', { name: `Pikachu ${absent}` })).toHaveCount(0);
	await toggle(page, 'Pikachu Language: Chinese (traditional)');
	await toggle(page, 'Pikachu Seen: shiny female');

	// Heard of is the Generation 8b state below Seen, so it appears once Seen is off.
	const seen = page.getByRole('button', { name: 'Pikachu Seen', exact: true });
	await expect(seen).toHaveAttribute('aria-pressed', 'true');
	await toggle(page, 'Pikachu Seen');
	await toggle(page, 'Pikachu Heard of');
	await expect(page.getByRole('button', { name: 'Pikachu Heard of' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(seen).toHaveAttribute('aria-pressed', 'false');
	await expect(values).toHaveAttribute('aria-expanded', 'true');
	expect(await readSafetyState(page)).toEqual({ backups: 1, dirty: true });

	// Unown has the most flags; its editor wraps inside the floor width.
	await page.setViewportSize({ width: 360, height: 640 });
	await search.fill('Unown');
	await page.getByRole('button', { name: 'Unown values', exact: true }).click();
	await expect(page.locator('.species-values .species-flag').nth(60)).toBeVisible();
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
