import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

test.setTimeout(180_000);

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

async function dpad(page: Page, key: string) {
	await page.evaluate((key) => {
		for (const pressed of [true, false])
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: { key, pressed, discrete: true, id: 'Pokedex acceptance' }
				})
			);
	}, key);
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

for (const [game, file, flag, absent, viewport] of [
	[
		'Scarlet and Violet',
		'pkmds-blazor/pokemon-violet.sav',
		'Paldea Pokedex: displayed shiny',
		'Seen: Alpha',
		{ width: 640, height: 360 }
	],
	[
		'Legends: Z-A',
		'pkmds-blazor/pokemon-legends-za.sav',
		'Seen: Alpha',
		'Paldea Pokedex: displayed shiny',
		{ width: 360, height: 640 }
	]
] as const) {
	test(`${game} Pokedex edits a game-specific flag and exports it`, async ({ page }) => {
		const fixture = path.resolve('test-fixtures/save-files', file);
		await page.setViewportSize(viewport);
		await loadRoute(page, '/');
		await page.getByLabel('Import Save File').setInputFiles(fixture);
		await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
		await choose(page, 'Pokedex');
		const search = page.getByRole('searchbox');
		await search.fill('Pikachu');
		await expect(page.locator('.species-row')).toHaveCount(1);
		const values = page.getByRole('button', { name: 'Pikachu values', exact: true });
		await values.click();
		await dpad(page, 'ArrowDown');
		await expect(page.locator('.species-values input').first()).toBeFocused();
		await expect(page.getByRole('button', { name: `Pikachu ${absent}`, exact: true })).toHaveCount(
			0
		);
		const pressed: string[] = [];
		for (const name of ['Pikachu Seen', `Pikachu ${flag}`]) {
			const control = page.getByRole('button', { name, exact: true });
			pressed.push((await control.getAttribute('aria-pressed')) === 'true' ? 'false' : 'true');
			await control.click();
			await expect(control).toHaveAttribute('aria-pressed', pressed.at(-1)!, {
				timeout: 90_000
			});
			await expect(control).toBeFocused();
			await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });
		}
		await expect(values).toHaveAttribute('aria-expanded', 'true');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await search.fill('Caterpie');
		await expect(page.getByText('No matching species.')).toBeVisible();

		await choose(page, 'Boxes');
		await page
			.getByRole('button', { name: /Open Box Menu for/ })
			.first()
			.click();
		const download = page.waitForEvent('download');
		await page
			.getByRole('dialog', { name: 'Box Menu' })
			.getByRole('button', { name: 'Export', exact: true })
			.click();
		const exported = await (await download).path();
		if (!exported) throw new Error('Missing export');
		expect(await readFile(exported)).not.toEqual(await readFile(fixture));

		// The exported Save File carries the game-specific flag into a fresh import.
		await choose(page, 'Saves');
		await page.getByLabel('Import Save File').setInputFiles({
			name: path.basename(file),
			mimeType: 'application/octet-stream',
			buffer: await readFile(exported)
		});
		await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
		await choose(page, 'Pokedex');
		await page.getByRole('searchbox').fill('Pikachu');
		// The open values editor is remembered across destinations.
		const reopened = page.getByRole('button', { name: 'Pikachu values', exact: true });
		if ((await reopened.getAttribute('aria-expanded')) !== 'true') await reopened.click();
		for (const [index, name] of ['Pikachu Seen', `Pikachu ${flag}`].entries())
			await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
				'aria-pressed',
				pressed[index]
			);
	});
}
