import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function resetEmptyStorage(page: Page) {
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
	await expect(page).toHaveURL(/\/saves$/);
}

async function openMainMenu(page: Page) {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	return page.getByRole('dialog', { name: 'Main Menu' });
}

async function choose(page: Page, label: string) {
	const menu = await openMainMenu(page);
	await menu.getByRole('button', { name: new RegExp(`^${label}`) }).click();
}

async function controllerButton(page: Page, key: string, pressed: boolean) {
	await page.evaluate(
		({ controllerKey, isPressed }) => {
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: {
						key: controllerKey,
						pressed: isPressed,
						discrete: true,
						id: 'Acceptance controller'
					}
				})
			);
		},
		{ controllerKey: key, isPressed: pressed }
	);
}

async function pressController(page: Page, key: string) {
	await controllerButton(page, key, true);
	await controllerButton(page, key, false);
}

test('empty first run lands on Saves and exposes five selectable destinations', async ({
	page
}) => {
	await resetEmptyStorage(page);

	const importCard = page.getByRole('button', { name: /Import a Save File/ });
	await expect(importCard).toBeFocused();
	const opener = page.getByRole('button', { name: 'Open Main Menu' });
	await expect(opener).toHaveAttribute('tabindex', '-1');

	let menu = await openMainMenu(page);
	await expect(menu.locator('.main-menu-row strong')).toHaveText([
		'Boxes',
		'Save File',
		'Saves',
		'Settings',
		'Backup Browser'
	]);
	await expect(menu.getByRole('button', { name: /^Saves/ })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(menu.getByRole('button', { name: /^Save File/ })).toContainText(
		'No active Save File'
	);
	await expect(menu.getByRole('button', { name: /^Backup Browser/ })).toContainText(
		'No active Save File'
	);

	await menu.getByRole('button', { name: /^Saves/ }).click();
	await expect(menu).toBeHidden();
	await expect(importCard).toBeFocused();
	const storageControl = page.getByRole('button', { name: /Pokemon Storage App-owned/ });
	await storageControl.focus();
	menu = await openMainMenu(page);
	await storageControl.evaluate((control) => control.remove());
	await menu.getByRole('button', { name: /^Saves/ }).click();
	await expect(importCard).toBeFocused();

	await choose(page, 'Boxes');
	await expect(page).toHaveURL(/\/$/);
	await choose(page, 'Save File');
	await expect(page).toHaveURL(/\/save-file$/);
	await expect(page.getByText('No active Save File')).toBeVisible();
	await choose(page, 'Settings');
	await expect(page).toHaveURL(/\/settings$/);
	menu = await openMainMenu(page);
	await menu.getByRole('button', { name: /^Backup Browser/ }).click();
	await expect(page.getByRole('dialog', { name: 'Backup Browser' })).toContainText(
		'No active Save File'
	);
	await pressController(page, 'Escape');
	await expect(page).toHaveURL(/\/settings$/);
	await expect(page.locator('.top-bar, .mobile-tabbar')).toHaveCount(0);
});

test('Main Menu opens before destination controls are ready and restores the ready control', async ({
	page
}) => {
	await resetEmptyStorage(page);
	await page.evaluate(() => {
		const route = document.querySelector<HTMLElement>('[data-destination-root="saves"]')!;
		route.dataset.initialState = 'loading';
		route.replaceChildren(document.createTextNode('Loading Saves…'));
	});

	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	const menu = page.getByRole('dialog', { name: 'Main Menu' });
	await expect(menu).toBeVisible();
	await page.evaluate(() => {
		const route = document.querySelector<HTMLElement>('[data-destination-root="saves"]')!;
		const readyControl = document.createElement('button');
		readyControl.type = 'button';
		readyControl.textContent = 'Ready Save';
		readyControl.dataset.destinationInitial = '';
		readyControl.dataset.destinationFocus = 'ready-save';
		route.append(readyControl);
		route.dataset.initialState = 'ready';
	});
	await menu.getByRole('button', { name: /^Saves/ }).click();
	await expect(page.getByRole('button', { name: 'Ready Save' })).toBeFocused();
});

test('Start is fresh-press only and restores destination focus by identity', async ({ page }) => {
	await resetEmptyStorage(page);
	const importCard = page.getByRole('button', { name: /Import a Save File/ });
	await importCard.focus();

	await controllerButton(page, 'Menu', true);
	await controllerButton(page, 'Menu', true);
	await expect(page.getByRole('dialog', { name: 'Main Menu' })).toBeVisible();
	await controllerButton(page, 'Menu', false);
	await controllerButton(page, 'Menu', true);
	await expect(page.getByRole('dialog', { name: 'Main Menu' })).toBeHidden();
	await expect(importCard).toBeFocused();
	await controllerButton(page, 'Menu', false);
	await controllerButton(page, 'Menu', true);
	await expect(page.getByRole('dialog', { name: 'Main Menu' })).toBeVisible();
	await page.evaluate(() => {
		window.dispatchEvent(
			new CustomEvent('pksxcontrollerconnection', {
				detail: { id: 'Reconnected acceptance controller' }
			})
		);
	});
	await controllerButton(page, 'Menu', true);
	await expect(page.getByRole('dialog', { name: 'Main Menu' })).toBeHidden();
	await controllerButton(page, 'Menu', false);

	await choose(page, 'Settings');
	const darkTheme = page.getByRole('button', { name: 'Use dark theme' });
	await darkTheme.focus();
	await page.keyboard.press('Control+k');
	let menu = page.getByRole('dialog', { name: 'Main Menu' });
	await menu.getByRole('button', { name: /^Settings/ }).click();
	await expect(darkTheme).toBeFocused();

	await page.keyboard.press('Control+k');
	menu = page.getByRole('dialog', { name: 'Main Menu' });
	await menu.getByRole('button', { name: /^Backup Browser/ }).click();
	await page.goBack();
	await expect(page).toHaveURL(/\/settings$/);
	await expect(page.getByRole('dialog', { name: 'Backup Browser' })).toBeHidden();
	await expect(darkTheme).toBeFocused();

	await page.keyboard.press('Control+k');
	menu = page.getByRole('dialog', { name: 'Main Menu' });
	await menu.getByRole('button', { name: /^Backup Browser/ }).click();
	await pressController(page, 'Escape');
	await expect(darkTheme).toBeFocused();

	await choose(page, 'Saves');
	await expect(importCard).toBeFocused();
	await choose(page, 'Settings');
	await expect(page).toHaveURL(/\/settings$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/saves$/);
	await expect(importCard).toBeFocused();

	await choose(page, 'Settings');
	await pressController(page, 'Escape');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('reloading with the Main Menu open does not prompt and resets session focus', async ({
	page
}) => {
	await resetEmptyStorage(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});
	await choose(page, 'Boxes');
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON', { timeout: 15000 });
	await page.locator('#box-0-slot-17').focus();
	await openMainMenu(page);

	let unloadDialogs = 0;
	page.on('dialog', (dialog) => {
		unloadDialogs += 1;
		void dialog.dismiss();
	});
	await page.reload();

	await expect(page.locator('.boxes-route')).toHaveAttribute('data-initial-state', 'ready');
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
	expect(unloadDialogs).toBe(0);
});

test('stored Pokemon in any box makes Boxes the first-run destination', async ({ page }) => {
	await resetEmptyStorage(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const open = indexedDB.open('pksx-saves');
				open.onerror = () => reject(open.error ?? new Error('Could not open Saves.'));
				open.onsuccess = () => {
					const database = open.result;
					const transaction = database.transaction('pokemonStorage', 'readwrite');
					transaction.objectStore('pokemonStorage').put({
						id: 'pokemon-storage',
						schemaVersion: 1,
						boxCount: 2,
						boxSlotCount: 30,
						updatedAt: '2026-09-09T00:00:00.000Z',
						boxes: Array.from({ length: 2 }, (_, box) => ({
							index: box,
							name: `Box ${box + 1}`,
							slots: Array.from({ length: 30 }, (_, slot) => ({
								box,
								slot,
								pokemon:
									box === 1 && slot === 29
										? { label: 'PIKACHU', speciesId: 25, form: 0, isEgg: false }
										: null
							}))
						}))
					});
					transaction.onerror = () =>
						reject(transaction.error ?? new Error('Could not seed Pokemon Storage.'));
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
				};
			})
	);

	await page.goto('/');
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('#box-grid')).toBeVisible();
});

test('Saves restores an asynchronously loaded control by stable identity', async ({ page }) => {
	await resetEmptyStorage(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});
	await page.reload();
	await expect(page.locator('.saves-page')).toHaveAttribute('data-initial-state', 'ready', {
		timeout: 15000
	});
	await expect(page.locator('.save-card.active .save-card-main')).toBeFocused();
	const deleteSave = page.locator('.save-card.active .danger-action');
	await deleteSave.focus();
	const rememberedId = await deleteSave.getAttribute('id');

	await choose(page, 'Settings');
	await choose(page, 'Saves');
	await expect(page.locator(`#${rememberedId}`)).toBeFocused();
});

test('Save File restores dynamic controls by semantic identity', async ({ page }) => {
	await resetEmptyStorage(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});
	await choose(page, 'Save File');

	const trainerName = page.locator('#save-file-trainer-name');
	await expect(trainerName).toHaveValue('DIXIE', { timeout: 15000 });
	await expect(
		page.getByLabel('Save File fields').getByRole('button', { name: /Trainer profile/ })
	).toBeFocused();
	await page.setViewportSize({ width: 390, height: 700 });
	await page.reload();
	const mobileSections = page.getByLabel('Save File sections');
	await expect(mobileSections.getByRole('button', { name: 'Trainer' })).toBeFocused();
	await mobileSections.getByRole('button', { name: 'Money' }).focus();
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.keyboard.press('Control+k');
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Save File/ })
		.click();
	await expect(
		page.getByLabel('Save File fields').getByRole('button', { name: /Money/ })
	).toBeFocused();
	await trainerName.fill('RAJ');
	const cancelAll = page.getByRole('button', { name: 'Cancel all' });
	await cancelAll.focus();
	await expect(cancelAll).toHaveAttribute('id', 'pksx-save-file-cancel-all');
	await page.keyboard.press('Control+k');
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Save File/ })
		.click();
	await expect(cancelAll).toBeFocused();

	await page.getByLabel('Save File fields').getByRole('button', { name: /Bag/ }).click();
	const pockets = page.getByLabel('Bag pockets').getByRole('button');
	const addItem = page.getByRole('button', { name: '+ Add', exact: true });
	await page.getByRole('combobox', { name: /Add an item to/ }).click();
	await page.getByRole('option').first().click();
	await addItem.focus();
	const firstPocketAddId = await addItem.getAttribute('id');
	await pockets.nth(1).click();
	await page.getByRole('combobox', { name: /Add an item to/ }).click();
	await page.getByRole('option').first().click();
	await addItem.focus();
	const secondPocketAddId = await addItem.getAttribute('id');
	expect(firstPocketAddId).toMatch(/^pksx-save-file-inventory-/);
	expect(secondPocketAddId).toMatch(/^pksx-save-file-inventory-/);
	expect(secondPocketAddId).not.toBe(firstPocketAddId);

	const quantity = page.locator('.item-list article:not(.new-item) input[type="number"]').first();
	await quantity.focus();
	const quantityId = await quantity.getAttribute('id');
	expect(quantityId).toMatch(/^pksx-save-file-item-/);
	await page.keyboard.press('Control+k');
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Save File/ })
		.click();
	await expect(page.locator(`#${quantityId}`)).toBeFocused();
	await expect(page.locator('[id^="pksx-save-file-focus-"]')).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(() => {
				const ids = [...document.querySelectorAll<HTMLElement>('[id]')].map(({ id }) => id);
				return ids.length - new Set(ids).size;
			})
		)
		.toBe(0);
});

test('Saves confirmation owns shortcuts, controller Back, and browser history', async ({
	page
}) => {
	await resetEmptyStorage(page);
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});

	const deleteSave = page.locator('.save-card.active .danger-action');
	await deleteSave.click();
	let confirmation = page.getByRole('alertdialog', {
		name: /Delete .*011020251345\.sav\?/
	});
	await expect(confirmation).toBeVisible();
	await expect(page.getByRole('button', { name: 'Open Main Menu' })).toBeHidden();
	await page.keyboard.press('Control+k');
	await pressController(page, 'Menu');
	await page
		.locator('.main-menu-opener')
		.evaluate((opener) => (opener as HTMLButtonElement).click());
	await expect(page.getByRole('dialog', { name: 'Main Menu' })).toBeHidden();
	await expect(confirmation).toBeVisible();

	await pressController(page, 'Escape');
	await expect(confirmation).toBeHidden();
	await expect(page).toHaveURL(/\/saves$/);

	await choose(page, 'Settings');
	await choose(page, 'Saves');
	await deleteSave.click();
	confirmation = page.getByRole('alertdialog', { name: /Delete .*011020251345\.sav\?/ });
	await expect(confirmation).toBeVisible();
	await page.evaluate(() => history.back());
	await expect(confirmation).toBeHidden();
	await expect(page).toHaveURL(/\/saves$/);
});
