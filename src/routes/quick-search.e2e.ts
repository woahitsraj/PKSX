import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function resetStorage(page: Page) {
	await page.goto('/');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('pksx-saves');
				request.onerror = () => reject(request.error ?? new Error('Could not clear Saves.'));
				request.onsuccess = () => resolve();
			})
	);
	await page.reload();
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
}

async function importActiveSaveFile(page: Page) {
	await resetStorage(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 15_000 });
	await page.goto('/boxes');
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON', { timeout: 15_000 });
}

async function openSearchFromMainMenu(page: Page) {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	const menu = page.getByRole('dialog', { name: 'Main Menu' });
	await expect(menu.locator('.main-menu-row strong')).toHaveText([
		'Boxes',
		'Search',
		'Trainer',
		'Bag',
		'Saves',
		'Settings',
		'Backup Browser'
	]);
	await menu.getByRole('button', { name: /^Search/ }).click();
	return page.getByRole('dialog', { name: 'Search Active Save File' });
}

async function pressController(page: Page, key: string) {
	for (const pressed of [true, false]) {
		await page.evaluate(
			({ controllerKey, isPressed }) =>
				window.dispatchEvent(
					new CustomEvent('pksxcontroller', {
						detail: {
							key: controllerKey,
							pressed: isPressed,
							discrete: true,
							id: 'Acceptance controller'
						}
					})
				),
			{ controllerKey: key, isPressed: pressed }
		);
	}
}

async function expectSearchViewport(page: Page, width: number, height: number) {
	await page.setViewportSize({ width, height });
	const search = page.getByRole('dialog', { name: 'Search Active Save File' });
	const input = search.getByRole('searchbox');
	await expect(input).toBeFocused();
	await expect(input).toHaveCSS('font-size', '16px');

	const errors = await page.evaluate(() => {
		const shell = document.querySelector<HTMLElement>('.app-shell');
		const dialog = document.querySelector<HTMLElement>(
			'[role="dialog"][aria-labelledby="quick-search-title"]'
		);
		const searchInput = dialog?.querySelector<HTMLInputElement>('input[type="search"]');
		if (!shell || !dialog || !searchInput) return ['Search geometry is unavailable.'];
		const dialogRect = dialog.getBoundingClientRect();
		const inputRect = searchInput.getBoundingClientRect();
		const style = getComputedStyle(shell);
		const safe = {
			left: parseFloat(style.getPropertyValue('--pksx-safe-area-left')),
			top: parseFloat(style.getPropertyValue('--pksx-safe-area-top')),
			right: innerWidth - parseFloat(style.getPropertyValue('--pksx-safe-area-right')),
			bottom: innerHeight - parseFloat(style.getPropertyValue('--pksx-safe-area-bottom'))
		};
		const within = (target: DOMRect, boundary: typeof safe) =>
			target.left >= boundary.left - 1 &&
			target.top >= boundary.top - 1 &&
			target.right <= boundary.right + 1 &&
			target.bottom <= boundary.bottom + 1;
		const failures: string[] = [];
		if (!within(dialogRect, safe)) failures.push('Search escapes the Safe Canvas.');
		if (!within(inputRect, dialogRect)) failures.push('Search input escapes its dialog.');
		if (document.documentElement.scrollWidth > innerWidth + 1)
			failures.push('Document width exceeds the viewport.');
		if (document.documentElement.scrollHeight > innerHeight + 1)
			failures.push('Document height exceeds the viewport.');
		if (document.body.scrollWidth > innerWidth + 1 || document.body.scrollHeight > innerHeight + 1)
			failures.push('Body extent exceeds the viewport.');
		if (shell.scrollWidth > shell.clientWidth + 1 || shell.scrollHeight > shell.clientHeight + 1)
			failures.push('Shell extent exceeds its bounds.');
		return failures;
	});

	expect(errors).toEqual([]);
}

test('searches the Active Save File and opens the exact result', async ({ page }) => {
	await importActiveSaveFile(page);
	const search = await openSearchFromMainMenu(page);
	const input = search.getByRole('searchbox', { name: 'Search Active Save File' });
	await input.fill('Aron');
	const result = search.getByRole('button', { name: /ARON, Aron, Box 01, Slot 1/ });
	await expect(result).toBeVisible({ timeout: 15_000 });

	for (const viewport of [
		{ width: 640, height: 360 },
		{ width: 640, height: 480 },
		{ width: 360, height: 640 },
		{ width: 393, height: 852 }
	]) {
		await expectSearchViewport(page, viewport.width, viewport.height);
		await expect(input).toHaveValue('Aron');
		await expect(result).toBeVisible();
	}

	await result.click();
	await expect(search).toBeHidden();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('search returns to the captured Save File pane and exact Slot', async ({ page }) => {
	await importActiveSaveFile(page);
	await page.getByRole('button', { name: 'Open Box Menu for emerald-011020251345.sav' }).click();
	await page.getByRole('button', { name: 'Open another collection' }).click();
	await page
		.getByRole('dialog', { name: 'Open another collection' })
		.getByRole('button', { name: /emerald-011020251345\.sav/ })
		.click();
	await expect(page.locator('.box-pane').nth(1)).toHaveClass(/active-pane/);

	const search = await openSearchFromMainMenu(page);
	await search.getByRole('searchbox').fill('Aron');
	await search.getByRole('button', { name: /ARON, Aron, Box 01, Slot 1/ }).click();

	await expect(search).toBeHidden();
	await expect(page.locator('.box-pane').nth(1)).toHaveClass(/active-pane/);
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('keyboard and controller shortcuts open and navigate Search', async ({ page }) => {
	await importActiveSaveFile(page);
	await page.locator('#box-0-slot-0').focus();

	await page.keyboard.press('Control+k');
	let search = page.getByRole('dialog', { name: 'Search Active Save File' });
	await expect(search.getByRole('searchbox')).toBeFocused();
	await page.keyboard.type('aron');
	await expect(search.getByRole('button', { name: /ARON, Aron, Box 01, Slot 1/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#box-0-slot-0')).toBeFocused();

	await pressController(page, 'y');
	search = page.getByRole('dialog', { name: 'Search Active Save File' });
	await search.getByRole('searchbox').fill('aron');
	await expect(search.getByRole('button', { name: /ARON, Aron, Box 01, Slot 1/ })).toBeVisible();
	await pressController(page, 'ArrowDown');
	await expect(search.getByRole('button', { name: /ARON, Aron, Box 01, Slot 1/ })).toBeFocused();
	await pressController(page, 'Enter');
	await expect(search).toBeHidden();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('Cmd/Ctrl+K opens Search from another destination', async ({ page }) => {
	await importActiveSaveFile(page);
	await page.goto('/settings');
	await expect(page.locator('[data-destination-root="settings"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await page.keyboard.press('Control+k');
	await expect(page).toHaveURL(/\/boxes/);
	await expect(
		page.getByRole('dialog', { name: 'Search Active Save File' }).getByRole('searchbox')
	).toBeFocused();
});

test('reports when the Active Save File disappears', async ({ page }) => {
	await importActiveSaveFile(page);
	const search = await openSearchFromMainMenu(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('pksx-saves', 4);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(['appState', 'saveFiles'], 'readwrite');
					const activeRequest = transaction.objectStore('appState').get('activeSaveFileId');
					activeRequest.onsuccess = () => {
						transaction.objectStore('saveFiles').delete(activeRequest.result?.value);
					};
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			})
	);
	await search.getByRole('searchbox').fill('aron');
	await expect(search).toContainText('The Active Save File is no longer available.');
	await search.getByRole('button', { name: 'Close Search' }).click();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});
