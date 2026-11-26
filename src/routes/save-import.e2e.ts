import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { importSaveThroughSaves } from './save-import.e2e-helper';
import { loadRoute } from './route-load.e2e-helper';

for (const fixture of [
	'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav',
	'raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav',
	'raj-pokemon-save-backups/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin',
	'raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav'
]) {
	test(`imports ${path.basename(fixture)} immediately after a cold navigation`, async ({
		page
	}) => {
		await loadRoute(page, '/');
		await importSaveThroughSaves(page, path.resolve('test-fixtures/save-files', fixture));
		await expect(page.locator('.save-card.active')).toContainText(path.basename(fixture));
	});
}

test('offers replace or import as new when a Save File is already in Saves', async ({ page }) => {
	const emerald = path.resolve(
		'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
	);
	const buffer = readFileSync(emerald);
	buffer[buffer.length - 1] ^= 0xff;
	const revised = { name: 'emerald-revised.sav', mimeType: 'application/octet-stream', buffer };
	const cards = page.locator('.save-card');
	const dialog = page.getByRole('heading', { name: 'Already in Saves' });
	const choose = async (file: typeof emerald | typeof revised) => {
		await page.getByLabel('Import Save File', { exact: true }).setInputFiles(file);
		await expect(dialog).toBeVisible({ timeout: 60_000 });
	};

	await loadRoute(page, '/');
	await importSaveThroughSaves(page, emerald);

	await choose(emerald);
	await expect(page.getByText('emerald-011020251345.sav is an exact copy')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(dialog).toBeHidden();
	await expect(cards).toHaveCount(1);

	await choose(revised);
	await expect(page.getByText('looks like another revision')).toBeVisible();
	await expect(
		page.getByRole('button', { name: /Replace Existing.*Different revision.*Emerald/ })
	).toBeVisible();
	await page.getByRole('button', { name: /Import as New/ }).click();
	await expect(page.getByText('emerald-revised.sav imported and made active.')).toBeVisible();
	await expect(cards).toHaveCount(2);

	await choose(emerald);
	await expect(
		page.getByRole('button', { name: /Replace emerald-011020251345.*Exact copy/ })
	).toBeVisible();
	await page
		.getByRole('button', { name: /Replace emerald-revised\.sav.*Different revision/ })
		.click();
	await expect(
		page.getByText('emerald-revised.sav replaced with emerald-011020251345.sav.')
	).toBeVisible();
	await expect(cards).toHaveCount(2);
	await expect(page.locator('.save-card.active')).toContainText('emerald-011020251345.sav');
});
