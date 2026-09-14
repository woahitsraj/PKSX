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

async function seedPokemonStorage(page: Page) {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('pksx-saves', 4);
				request.onerror = () => reject(request.error ?? new Error('Could not open Saves.'));
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('pokemonStorage', 'readwrite');
					transaction.objectStore('pokemonStorage').put({
						id: 'pokemon-storage',
						schemaVersion: 1,
						boxCount: 3,
						boxSlotCount: 30,
						boxes: Array.from({ length: 3 }, (_, box) => ({
							index: box,
							name: box === 2 ? 'Favorites' : `Box ${String(box + 1).padStart(2, '0')}`,
							slots: Array.from({ length: 30 }, (_, slot) => ({
								box,
								slot,
								pokemon:
									box === 2 && slot === 7
										? {
												label: 'Buddy',
												detail: 'Lv. 12',
												level: 12,
												experience: null,
												speciesId: 1,
												form: 0,
												isEgg: false,
												spriteIdentity: null,
												origin: {
													entryMode: 'imported',
													originSaveFileName: null,
													originGame: null,
													originalTrainer: null,
													trainerId: null,
													enteredAt: '2026-09-14T00:00:00.000Z'
												}
											}
										: null
							}))
						})),
						updatedAt: '2026-09-14T00:00:00.000Z'
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			})
	);
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
	return page.getByRole('dialog', { name: 'Quick Search' });
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

async function expectQuickSearchViewport(page: Page, width: number, height: number) {
	await page.setViewportSize({ width, height });
	const search = page.getByRole('dialog', { name: 'Quick Search' });
	const input = search.getByRole('searchbox');
	await expect(input).toBeFocused();
	await expect(input).toHaveCSS('font-size', '16px');

	const errors = await page.evaluate(() => {
		const shell = document.querySelector<HTMLElement>('.app-shell');
		const dialog = document.querySelector<HTMLElement>(
			'[role="dialog"][aria-labelledby="quick-search-title"]'
		);
		const searchInput = dialog?.querySelector<HTMLInputElement>('input[type="search"]');
		if (!shell || !dialog || !searchInput) return ['Quick Search geometry is unavailable.'];
		const rect = (element: Element) => element.getBoundingClientRect();
		const dialogRect = rect(dialog);
		const inputRect = rect(searchInput);
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
		if (!within(dialogRect, safe)) failures.push('Quick Search escapes the Safe Canvas.');
		if (!within(inputRect, dialogRect)) failures.push('Search input escapes the Takeover.');
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

test('searches Pokemon Storage and preserves the workflow through viewport changes', async ({
	page
}) => {
	await resetStorage(page);
	await seedPokemonStorage(page);
	await page.setViewportSize({ width: 640, height: 360 });
	await page.goto('/boxes?source=pokemon-storage');
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await page.locator('#box-0-slot-3').focus();

	const search = await openSearchFromMainMenu(page);
	const input = search.getByRole('searchbox', { name: 'Search Pokemon Storage' });
	await expect(input).toBeFocused();
	await expect(input).toHaveCSS('font-size', '16px');
	await expect(search).toContainText('Type a species, nickname, or Location.');
	await input.fill('bulbasaur');
	const result = search.getByRole('button', {
		name: /Buddy.*Bulbasaur.*Pokemon Storage.*Favorites, Slot 8/
	});
	await expect(result).toBeVisible();

	for (const viewport of [
		{ width: 640, height: 360 },
		{ width: 640, height: 480 },
		{ width: 360, height: 640 },
		{ width: 393, height: 852 }
	]) {
		await expectQuickSearchViewport(page, viewport.width, viewport.height);
		await expect(input).toHaveValue('bulbasaur');
		await expect(result).toBeVisible();
	}
	await page.setViewportSize({ width: 640, height: 559 });
	await expect(input).toBeFocused();
	await page.setViewportSize({ width: 640, height: 560 });
	await expect(input).toBeFocused();

	await result.click();
	await expect(search).toBeHidden();
	await expect(page).toHaveURL(/\/boxes/);
	await expect(page.locator('[data-pane-id="pane-pokemon-storage"]')).toHaveAttribute(
		'data-location',
		'box-2'
	);
	await expect(page.locator('#box-2-slot-7')).toBeFocused();
});

test('controller Search opens Quick Search without consuming typed input', async ({ page }) => {
	await resetStorage(page);
	await seedPokemonStorage(page);
	await page.goto('/boxes?source=pokemon-storage');
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);

	await page.locator('#box-0-slot-4').focus();
	await pressController(page, 'y');
	const search = page.getByRole('dialog', { name: 'Quick Search' });
	const input = search.getByRole('searchbox', { name: 'Search Pokemon Storage' });
	await expect(input).toBeFocused();
	await page.keyboard.type('missing');
	await expect(search).toContainText('No Pokemon match "missing".');
	await input.fill('');
	await page.keyboard.type('buddy');
	await expect(input).toHaveValue('buddy');
	await expect(search.getByRole('button', { name: /Buddy.*Favorites, Slot 8/ })).toBeVisible();
	await pressController(page, 'ArrowDown');
	await expect(search.getByRole('button', { name: /Buddy.*Favorites, Slot 8/ })).toBeFocused();
	await pressController(page, 'Enter');
	await expect(page.locator('#box-2-slot-7')).toBeFocused();

	await pressController(page, 'y');
	await expect(page.getByRole('dialog', { name: 'Quick Search' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('#box-2-slot-7')).toBeFocused();
});

test('Main Menu Search opens the focused collection from another destination', async ({ page }) => {
	await resetStorage(page);
	await seedPokemonStorage(page);
	await page.goto('/settings');
	const search = await openSearchFromMainMenu(page);
	await expect(page).toHaveURL(/\/boxes/);
	await expect(search.getByRole('searchbox', { name: 'Search Pokemon Storage' })).toBeFocused();
});

test('shows safe empty and disappeared collection states', async ({ page }) => {
	await resetStorage(page);
	await page.goto('/boxes?source=pokemon-storage');
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);

	const search = await openSearchFromMainMenu(page);
	await expect(search).toContainText('Pokemon Storage has no Pokemon to search.');
	await search.getByRole('button', { name: 'Close Quick Search' }).click();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();

	await seedPokemonStorage(page);
	await page.reload();
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	const reopened = await openSearchFromMainMenu(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('pksx-saves', 4);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('pokemonStorage', 'readwrite');
					transaction.objectStore('pokemonStorage').delete('pokemon-storage');
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
				};
			})
	);
	await reopened.getByRole('searchbox').fill('buddy');
	await expect(reopened).toContainText('Pokemon Storage is no longer available.');
	await page.keyboard.press('Escape');
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('searches a Save File projection and opens the exact result Slot', async ({ page }) => {
	await resetStorage(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 15_000 });
	await page.goto('/boxes');
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON', { timeout: 15_000 });

	const search = await openSearchFromMainMenu(page);
	const input = search.getByRole('searchbox', { name: /Search emerald-011020251345\.sav/ });
	await input.fill('Aron');
	const result = search.getByRole('button', { name: /ARON.*Aron.*Box 01, Slot 1/ });
	await expect(result).toBeVisible({ timeout: 15_000 });
	await result.click();
	await expect(search).toBeHidden();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});
