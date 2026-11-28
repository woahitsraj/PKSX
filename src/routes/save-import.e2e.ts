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

const emeraldPath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

function emeraldCopy(name: string, change: (buffer: Buffer) => void) {
	const buffer = readFileSync(emeraldPath);
	change(buffer);
	return { name, mimeType: 'application/octet-stream', buffer };
}

test('imports the same game from another trainer without asking', async ({ page }) => {
	const otherTrainer = emeraldCopy('other-trainer.sav', (buffer) => {
		for (let sector = 0; sector + 0x1000 <= buffer.length; sector += 0x1000)
			if (buffer.readUInt16LE(sector + 0xff4) === 0) buffer[sector + 0x0a] ^= 0xff;
	});
	await loadRoute(page, '/');
	await importSaveThroughSaves(page, emeraldPath);
	await importSaveThroughSaves(page, otherTrainer);
	await expect(page.locator('.save-card')).toHaveCount(2);
});

test('Replace Existing confirms and backs up unsaved changes first', async ({ page }) => {
	await loadRoute(page, '/');
	await importSaveThroughSaves(page, emeraldPath);
	await loadRoute(page, '/trainer');
	const money = page.getByRole('spinbutton', { name: 'Money' });
	const original = await money.inputValue();
	await money.fill('12345');
	await money.press('Enter');
	await expect(money).toHaveValue('12345');
	await expect(money).not.toHaveAttribute('readonly', '');

	await loadRoute(page, '/');
	await page
		.getByLabel('Import Save File', { exact: true })
		.setInputFiles(
			emeraldCopy('emerald-revised.sav', (buffer) => (buffer[buffer.length - 1] ^= 0xff))
		);
	const replace = page.getByRole('button', {
		name: /Replace Existing.*Unsaved changes go to a Backup/
	});
	await replace.click({ timeout: 60_000 });
	const confirm = page.getByRole('button', { name: /Replace your unsaved changes\?/ });
	await confirm.click();
	await expect(
		page.getByText('emerald-011020251345.sav replaced with emerald-revised.sav.')
	).toBeVisible();
	await expect(page.locator('.save-card')).toHaveCount(1);

	await page.getByRole('button', { name: 'Open Save File Menu for emerald-revised.sav' }).click();
	await page.getByRole('button', { name: 'Backups', exact: true }).click();
	const backups = page.getByLabel('Backups', { exact: true });
	await expect(backups).toContainText('PKSX Workspace before Replace Existing');
	await expect(backups).toContainText('Imported baseline before Replace Existing');

	await loadRoute(page, '/trainer');
	await expect(money).toHaveValue(original);
	await money.fill('54321');
	await money.press('Enter');
	await expect(money).toHaveValue('54321');
	await expect(money).not.toHaveAttribute('readonly', '');
});

test('Boxes quick import offers the same choices and keeps focus on Cancel', async ({ page }) => {
	await loadRoute(page, '/');
	await importSaveThroughSaves(page, emeraldPath);
	await loadRoute(page, '/boxes');
	const quickImport = page.locator('#quick-save-import');
	const dialog = page.getByRole('heading', { name: 'Already in Saves' });
	await quickImport.setInputFiles(emeraldPath);
	await expect(dialog).toBeVisible({ timeout: 60_000 });
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page.locator('body')).not.toBeFocused();

	await quickImport.setInputFiles(
		emeraldCopy('emerald-revised.sav', (buffer) => (buffer[buffer.length - 1] ^= 0xff))
	);
	await page.getByRole('button', { name: /Replace Existing/ }).click({ timeout: 60_000 });
	await expect(page.locator('.status-announcer')).toHaveText(
		'emerald-011020251345.sav replaced with emerald-revised.sav.'
	);
	await loadRoute(page, '/');
	await expect(page.locator('.save-card')).toHaveCount(1);
	await expect(page.locator('.save-card.active')).toContainText('emerald-revised.sav');
});
