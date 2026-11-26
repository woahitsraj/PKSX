import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { expectBoxesReady } from './boxes-ready.e2e-helper';
import { waitForPokemonStorageRoot } from './pokemon-storage-seed.e2e-helper';
import { loadRoute, reloadRoute } from './route-load.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);
const aron =
	'rVIoJRblSsu7zMnI/xUAAwQAAgK+w9LDv///AH8OAAB+AQAAfwYAAAAoAAAhAGoAvQAdACMeCg8AAAAAAAAAAAAAAAAAN4uhozfCnwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

async function chooseSpriteStyleFromMenu(page: Page, label: 'HOME' | 'Game') {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Settings/ })
		.click();
	const button = page.getByRole('button', { name: `Use ${label} sprites` });
	await button.click();
	await expect(button).toHaveAttribute('aria-pressed', 'true');
	await page.goBack();
	await expectBoxesReady(page);
}

async function expectLoaded(image: Locator, source: RegExp) {
	await expect(image).toHaveAttribute('src', source);
	await expect
		.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth > 0))
		.toBe(true);
}

async function boxSize(locator: Locator) {
	const box = await locator.boundingBox();
	return box && { width: box.width, height: box.height };
}

test('Settings chooses the Sprite style with Controller Focus and keeps it after reload', async ({
	page
}) => {
	await loadRoute(page, '/settings');
	const home = page.getByRole('button', { name: 'Use HOME sprites' });
	const game = page.getByRole('button', { name: 'Use game sprites' });
	await expect(home).toHaveAttribute('aria-pressed', 'true');

	await expect(page.getByRole('button', { name: 'Use light theme' })).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(home).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(game).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(game).toHaveAttribute('aria-pressed', 'true');

	await reloadRoute(page);
	await expect(game).toHaveAttribute('aria-pressed', 'true');
	await expect(home).toHaveAttribute('aria-pressed', 'false');
});

test('Save File Slots switch between HOME and game sprites without reopening, and work offline', async ({
	page,
	context
}) => {
	await loadRoute(page, '/');
	await importSaveThroughSaves(page, emeraldFixturePath);
	await loadRoute(page, '/boxes');
	const slot = page.locator('#box-0-slot-0');
	await expect(slot).toContainText('ARON', { timeout: 15_000 });
	const sprite = slot.locator('img');
	await expectLoaded(sprite, /^\/sprites\/pokemon\/species\/0304-/);
	const homeSize = await boxSize(slot);
	const saveFileId = await page.locator('.boxes-route').getAttribute('data-active-save-file-id');

	await chooseSpriteStyleFromMenu(page, 'Game');
	await expect(page.locator('.boxes-route')).toHaveAttribute(
		'data-active-save-file-id',
		saveFileId!
	);
	await expectLoaded(sprite, /^\/sprites\/pokemon\/game\/emerald\/0304-00-/);
	expect(await boxSize(slot)).toEqual(homeSize);
	await slot.focus();
	await expect(page.locator('.detail-rail img').first()).toHaveAttribute(
		'src',
		/\/game\/emerald\/0304-/
	);
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Edit' }).click();
	const editor = page.getByRole('dialog', { name: 'ARON' });
	await expectLoaded(editor.locator('img').first(), /\/game\/emerald\/0304-/);
	await page.keyboard.press('Escape');
	await expect(editor).toBeHidden();

	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await reloadRoute(page);
	await expectLoaded(sprite, /\/game\/emerald\/0304-/);
	await context.setOffline(true);
	await reloadRoute(page);
	await expect(slot).toContainText('ARON', { timeout: 15_000 });
	await expectLoaded(sprite, /\/game\/emerald\/0304-/);
	await context.setOffline(false);

	await chooseSpriteStyleFromMenu(page, 'HOME');
	await expectLoaded(sprite, /^\/sprites\/pokemon\/species\/0304-/);
});

test('Pokemon Storage selects game sprites from the Pokemon Origin game', async ({ page }) => {
	await loadRoute(page, '/');
	await waitForPokemonStorageRoot(page);
	await page.evaluate(async (entityBytesBase64) => {
		localStorage.setItem('pksx-sprite-style', 'game');
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const opening = indexedDB.open('pksx-saves');
			opening.onsuccess = () => resolve(opening.result);
			opening.onerror = () => reject(opening.error);
		});
		const write = (store: string, change: (objectStore: IDBObjectStore) => void) =>
			new Promise<void>((resolve, reject) => {
				const transaction = db.transaction(store, 'readwrite');
				change(transaction.objectStore(store));
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => reject(transaction.error);
			});
		await write('manifest', (store) => store.delete('current'));
		await write('pokemonStorage', (store) =>
			store.put({
				id: 'pokemon-storage',
				schemaVersion: 1,
				boxCount: 1,
				boxSlotCount: 30,
				updatedAt: '2026-10-02T00:00:00Z',
				boxes: [
					{
						index: 0,
						name: 'Favorites',
						slots: Array.from({ length: 30 }, (_, slot) => ({
							box: 0,
							slot,
							pokemon:
								slot === 0
									? {
											label: 'ARON',
											detail: 'Legacy',
											level: null,
											experience: null,
											speciesId: null,
											form: null,
											isEgg: false,
											spriteIdentity: null,
											entityBytesBase64,
											origin: {
												entryMode: 'imported',
												originSaveFileName: null,
												originGame: 'FR',
												originalTrainer: null,
												trainerId: null,
												enteredAt: '2026-10-02T00:00:00Z'
											}
										}
									: null
						}))
					}
				]
			})
		);
		db.close();
	}, aron);
	await reloadRoute(page);
	await expect(page.getByRole('button', { name: 'Open Pokemon Storage in Boxes' })).toContainText(
		'1 Pokemon',
		{ timeout: 60_000 }
	);
	await loadRoute(page, '/?source=pokemon-storage');
	await expectBoxesReady(page);
	await page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' }).click();
	await page.getByRole('button', { name: /^Box 01: Favorites, 1 of 1$/ }).click();
	const slot = page.locator('#box-0-slot-0');
	await expect(slot).toContainText('ARON');
	const gameSprite = /^\/sprites\/pokemon\/game\/firered-leafgreen\/0304-/;
	await expectLoaded(slot.locator('img'), gameSprite);
	await slot.focus();
	await expect(page.locator('.detail-rail img').first()).toHaveAttribute('src', gameSprite);
});
