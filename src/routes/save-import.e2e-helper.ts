import { expect, type Page } from '@playwright/test';
import path from 'node:path';

type SaveFile = string | { name: string; mimeType: string; buffer: Buffer };

export async function importSaveThroughSaves(page: Page, file: SaveFile, message?: string) {
	if (!['/', '/saves'].includes(new URL(page.url()).pathname)) await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60_000 }
	);
	await page.getByLabel('Import Save File', { exact: true }).setInputFiles(file);
	const name = typeof file === 'string' ? path.basename(file) : file.name;
	await expect(
		page.getByText(message ?? `${name} imported and made active.`, { exact: message === undefined })
	).toBeVisible({ timeout: 60_000 });
}
