import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test.setTimeout(180_000);

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function choose(page: Page, label: string) {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: new RegExp(`^${label}`) })
		.click();
}

async function backupCount(page: Page) {
	return page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const request = indexedDB.open('pksx-saves');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction('backups', 'readonly');
					const count = tx.objectStore('backups').count();
					count.onsuccess = () => resolve(count.result);
					tx.oncomplete = () => db.close();
				};
			})
	);
}

for (const viewport of [
	{ width: 360, height: 640 },
	{ width: 640, height: 360 }
]) {
	test(`Pokedex search, edit, safety and focus at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto('/');
		await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
			'data-initial-state',
			'ready',
			{ timeout: 60_000 }
		);
		await page.getByLabel('Import Save File').setInputFiles(fixture);
		await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
			timeout: 90_000
		});
		await choose(page, 'Pokedex');
		const search = page.getByRole('searchbox');
		await search.fill('bulba');
		await expect(page.locator('.species-row')).toHaveCount(1);
		const seen = page.getByRole('button', { name: 'Bulbasaur Seen', exact: true });
		const previous = await seen.getAttribute('aria-pressed');
		const backups = await backupCount(page);
		await seen.click();
		await expect(seen).toHaveAttribute('aria-pressed', previous === 'true' ? 'false' : 'true', {
			timeout: 90_000
		});
		await expect(seen).toBeFocused();
		await expect(page.getByText('Dirty Workspace')).toBeVisible();
		await expect.poll(() => backupCount(page)).toBe(backups + 1);
		await page.getByRole('button', { name: 'Bulbasaur Caught', exact: true }).click();
		await expect(seen).toHaveAttribute('aria-disabled', 'false');
		expect(await backupCount(page)).toBe(backups + 1);
		await seen.focus();
		for (const key of ['ArrowRight', 'ArrowLeft']) {
			await page.evaluate((key) => {
				for (const pressed of [true, false])
					window.dispatchEvent(
						new CustomEvent('pksxcontroller', {
							detail: { key, pressed, discrete: true, id: 'Pokedex acceptance' }
						})
					);
			}, key);
		}
		await expect(seen).toBeFocused();
		await choose(page, 'Trainer');
		await choose(page, 'Pokedex');
		await expect(search).toHaveValue('bulba');
		await expect(seen).toBeFocused();
		for (const size of [
			{ width: 640, height: 360 },
			{ width: 360, height: 640 },
			{ width: 800, height: 559 },
			{ width: 800, height: 560 }
		]) {
			await page.setViewportSize(size);
			await expect(seen).toBeFocused();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		}
		await search.fill('no such species');
		await expect(page.getByText('No matching species.')).toBeVisible();
		await expect(search).toBeFocused();
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
		const download = await downloadPromise;
		const exported = await download.path();
		if (!exported) throw new Error('Missing export');
		expect(await readFile(exported)).not.toEqual(await readFile(fixture));
	});
}

test('Pokedex explicitly reports a Save File without a Pokedex', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60_000 }
	);
	await page
		.getByLabel('Import Save File')
		.setInputFiles(
			path.resolve('test-fixtures/save-files/pkmds-blazor/pokemon-box-ruby-sapphire.gci')
		);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
	await choose(page, 'Pokedex');
	await expect(page.getByText('This Save File format has no Pokedex.')).toBeVisible({
		timeout: 90_000
	});
	await expect(page.getByRole('searchbox')).toHaveCount(0);
});
