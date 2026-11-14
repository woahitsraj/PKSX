import { expect, test } from '@playwright/test';
import path from 'node:path';
import { importSaveThroughSaves } from './save-import.e2e-helper';

for (const fixture of [
	'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav',
	'raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav',
	'raj-pokemon-save-backups/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin',
	'raj-pokemon-save-backups/switch/pokemon-scarlet-2025-03-24-main.sav'
]) {
	test(`imports ${path.basename(fixture)} immediately after a cold navigation`, async ({
		page
	}) => {
		await page.goto('/');
		await importSaveThroughSaves(page, path.resolve('test-fixtures/save-files', fixture));
		await expect(page.locator('.save-card.active')).toContainText(path.basename(fixture));
	});
}
