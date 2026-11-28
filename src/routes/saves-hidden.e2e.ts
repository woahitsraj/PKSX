import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadRoute, reloadRoute } from './route-load.e2e-helper';

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function pressController(page: Page, key: string) {
	await page.evaluate(async (controllerKey) => {
		const dispatch = (pressed: boolean) =>
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: {
						key: controllerKey,
						pressed,
						discrete: !controllerKey.startsWith('Arrow'),
						id: 'Test controller'
					}
				})
			);
		const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		dispatch(true);
		await nextFrame();
		await nextFrame();
		dispatch(false);
		await nextFrame();
	}, key);
}

function readArtifacts(page: Page) {
	return page.evaluate(
		() =>
			new Promise<{ bytes: number[]; dirty: boolean; backups: number; files: number }>(
				(resolve, reject) => {
					const request = indexedDB.open('pksx-saves');
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						const db = request.result;
						const tx = db.transaction(
							['saveFiles', 'saveBytes', 'workspaces', 'backups'],
							'readonly'
						);
						const bytes = tx.objectStore('saveBytes').getAll();
						const workspaces = tx.objectStore('workspaces').getAll();
						const backups = tx.objectStore('backups').count();
						const files = tx.objectStore('saveFiles').count();
						tx.oncomplete = () => {
							const stored = bytes.result[0];
							resolve({
								bytes: Array.from(new Uint8Array(stored.bytes)),
								dirty: workspaces.result[0]?.dirty ?? false,
								backups: backups.result,
								files: files.result
							});
							db.close();
						};
					};
				}
			)
	);
}

test.describe('hidden Save Files', () => {
	test.use({ hasTouch: true });

	test('hide, show hidden, unhide, restart and Back keep the Save File intact', async ({
		page
	}) => {
		await page.setViewportSize({ width: 960, height: 336 });
		await loadRoute(page, '/');
		await page.locator('#save-file-input').setInputFiles(fixture);
		const card = page.locator('.save-card [aria-label="Open emerald-011020251345.sav in Boxes"]');
		const menu = page.getByRole('button', {
			name: 'Open Save File Menu for emerald-011020251345.sav',
			exact: true
		});
		await menu.tap();
		await page.getByRole('button', { name: 'Open Trainer', exact: true }).tap();
		const money = page.getByRole('spinbutton', { name: 'Money' });
		await expect(money).toBeVisible({ timeout: 15_000 });
		await money.fill(String(Number(await money.inputValue()) + 1));
		await money.press('Enter');
		await expect.poll(async () => (await readArtifacts(page)).dirty).toBe(true);
		await page.getByRole('button', { name: 'Open Main Menu' }).tap();
		await page
			.getByRole('dialog', { name: 'Main Menu' })
			.getByRole('button', { name: /^Saves/ })
			.tap();
		await expect(card).toBeVisible();
		const before = await readArtifacts(page);

		await menu.tap();
		await page.getByRole('button', { name: 'Hide', exact: true }).tap();
		await expect(card).toHaveCount(0);
		await expect(page.getByText('Every Save File is hidden')).toBeVisible();
		const grid = page.getByRole('grid', { name: 'Saves collections' });
		await expect(grid).toBeFocused();
		await expect(grid).toHaveAttribute('aria-activedescendant', 'saves-target-pokemon-storage');
		await page.getByRole('searchbox', { name: 'Search Saves' }).fill('emerald');
		await expect(card).toHaveCount(0);
		await page.getByRole('button', { name: 'Clear search', exact: true }).tap();
		expect(await readArtifacts(page)).toEqual(before);
		await page.getByRole('button', { name: 'Open Main Menu' }).tap();
		await page
			.getByRole('dialog', { name: 'Main Menu' })
			.getByRole('button', { name: /^Boxes/ })
			.tap();
		await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		await expect(page.getByRole('button', { name: /Open Box Menu for emerald/ })).toBeVisible();

		await loadRoute(page, '/');
		await expect(card).toHaveCount(0);
		const show = page.getByRole('button', { name: 'Show hidden saves, 1 hidden' });
		await expect(grid).toBeFocused();
		await pressController(page, 'ArrowUp');
		await expect(page.getByRole('searchbox', { name: 'Search Saves' })).toBeFocused();
		await pressController(page, 'ArrowRight');
		await expect(show).toBeFocused();
		await pressController(page, 'Enter');
		const hidden = page.getByRole('dialog', { name: 'Hidden saves' });
		await expect(
			hidden.getByRole('button', { name: 'Unhide emerald-011020251345.sav' })
		).toBeFocused();
		await pressController(page, 'Escape');
		await expect(hidden).toHaveCount(0);
		await expect(show).toBeFocused();
		await show.tap();
		await page.locator('.edge-menu-backdrop:not([inert])').tap({ position: { x: 8, y: 8 } });
		await expect(hidden).toHaveCount(0);
		await expect(show).toBeFocused();

		await show.tap();
		await hidden.getByRole('button', { name: 'Open emerald-011020251345.sav in Boxes' }).tap();
		await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		expect(await readArtifacts(page)).toEqual(before);
		await page.getByRole('button', { name: 'Open Main Menu' }).tap();
		await page
			.getByRole('dialog', { name: 'Main Menu' })
			.getByRole('button', { name: /^Saves/ })
			.tap();
		await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		await expect(card).toHaveCount(0);

		await show.tap();
		await pressController(page, 'Enter');
		await expect(card).toBeVisible();
		await expect(page).toHaveURL(/\/(saves)?$/);
		await expect(grid).toBeFocused();
		await expect(grid).toHaveAttribute(
			'aria-activedescendant',
			await card.evaluate((node) => node.closest('.save-card')!.id)
		);
		await reloadRoute(page);
		await expect(card).toBeVisible();
		await page.getByRole('button', { name: 'Show hidden saves', exact: true }).tap();
		await expect(hidden.getByText('No Save Files are hidden.')).toBeVisible();
		await expect(hidden.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
		await pressController(page, 'Enter');
		await expect(hidden).toHaveCount(0);
		const after = await readArtifacts(page);
		expect(after).toEqual(before);
		expect(after.bytes).toEqual(Array.from(await readFile(fixture)));
	});
});
