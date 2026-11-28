import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

test.setTimeout(180_000);

const fixture = path.resolve(
	'test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-legends-arceus-2025-03-24-main.sav'
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
	await expect(page.locator('html')).not.toHaveAttribute('data-pksx-route-direction', /./);
}

async function dpad(page: Page, key: string) {
	await page.evaluate((key) => {
		for (const pressed of [true, false])
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: { key, pressed, discrete: true, id: 'Research acceptance' }
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

for (const viewport of [
	{ width: 360, height: 640 },
	{ width: 640, height: 360 }
]) {
	test(`Legends: Arceus research tasks edit, report and export at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await loadRoute(page, '/');
		await page.getByLabel('Import Save File').setInputFiles(fixture);
		await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
		await choose(page, 'Pokedex');
		// Only the Hisui Pokedex is listed.
		await expect(page.locator('.total.seen .num')).toHaveText('242');
		const search = page.getByRole('searchbox');
		await search.fill('Shinx');
		await expect(page.locator('.species-row')).toHaveCount(1);
		const values = page.getByRole('button', { name: 'Shinx values', exact: true });
		await values.focus();
		await dpad(page, 'Enter');
		await expect(values).toHaveAttribute('aria-expanded', 'true');
		await dpad(page, 'ArrowDown');
		await expect(page.getByLabel(/^Number caught \(goals/)).toBeFocused();
		await expect(page.getByText('Research points 0, complete at 100')).toBeVisible();
		await expect(page.getByText('40 after report')).toBeVisible();
		await expect(
			page.getByText(/^Number of different forms you’ve obtained .*set by the game$/)
		).toBeVisible();

		const defeated = page.getByLabel('Number defeated (goals 1, 2, 4, 10, 15; 0 reported)');
		await expect(defeated).toHaveValue('0');
		const before = await readSafetyState(page);
		await defeated.fill('4');
		await defeated.press('Enter');
		await expect(page.getByText('70 after report')).toBeVisible({ timeout: 90_000 });
		await expect(defeated).toBeFocused();
		await expect
			.poll(() => readSafetyState(page))
			.toEqual({ backups: before.backups + 1, dirty: true });
		// Shinx was already Seen and Caught; the task edit keeps both.
		for (const name of ['Shinx Seen', 'Shinx Caught'])
			await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);

		const report = page.getByRole('button', { name: 'Report research', exact: true });
		await report.click();
		await expect(page.locator('.research-level strong')).toHaveText('70', { timeout: 90_000 });
		await expect(report).toBeFocused();
		await expect(page.getByText('70 after report')).toHaveCount(0);
		await expect(report).toHaveAttribute('aria-disabled', 'true');
		await dpad(page, 'ArrowDown');
		await expect(report).not.toBeFocused();
		await expect(page.locator(':focus')).toHaveCount(1);
		await expect(
			page.getByLabel('Number defeated (goals 1, 2, 4, 10, 15; 3 reported)')
		).toHaveValue('4');
		expect(await readSafetyState(page)).toEqual({ backups: before.backups + 1, dirty: true });
		const caught = page.getByLabel(/^Number caught \(goals/);
		await caught.fill('25');
		await caught.press('Enter');
		await expect(page.getByText('150 after report')).toBeVisible({ timeout: 90_000 });
		await report.click();
		await expect(page.locator('.research-level')).toContainText('Complete', { timeout: 90_000 });

		// Legends: Arceus keeps Seen once research starts, so clearing it fails with a message.
		await page.getByRole('button', { name: 'Shinx Seen', exact: true }).click();
		await expect(page.getByText(/keeps Seen once a species has research/)).toBeVisible({
			timeout: 90_000
		});

		const inputs = page.locator('.species-values input');
		expect(await inputs.count()).toBeGreaterThan(3);
		const sizes = await inputs.evaluateAll((elements) =>
			elements.map((element) => parseFloat(getComputedStyle(element).fontSize))
		);
		expect(sizes.filter((size) => size < 16)).toEqual([]);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await inputs.last().scrollIntoViewIfNeeded();
		await expect(inputs.last()).toBeInViewport();

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
}
