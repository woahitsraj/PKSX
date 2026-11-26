import { expect, type Page } from '@playwright/test';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

type SaveFile = string | { name: string; mimeType: string; buffer: Buffer };

/** Imports bytes already in Saves and keeps both copies. */
export async function importSaveAsNewThroughSaves(page: Page, file: SaveFile) {
	await importSaveThroughSaves(page, file, undefined, true);
}

export async function importSaveThroughSaves(
	page: Page,
	file: SaveFile,
	message?: string,
	asNew = false
) {
	if (!['/', '/saves'].includes(new URL(page.url()).pathname)) await loadRoute(page, '/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60_000 }
	);
	await page.getByLabel('Import Save File', { exact: true }).setInputFiles(file);
	if (asNew) await chooseImportAsNew(page);
	const name = typeof file === 'string' ? path.basename(file) : file.name;
	await expect(
		page.getByText(message ?? `${name} imported and made active.`, { exact: message === undefined })
	).toBeVisible({ timeout: 60_000 });
}

export async function chooseImportAsNew(page: Page) {
	await page.getByRole('button', { name: /^Import as New/ }).click({ timeout: 60_000 });
}
