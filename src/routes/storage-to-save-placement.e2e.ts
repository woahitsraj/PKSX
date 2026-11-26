import { loadRoute, reloadRoute } from './route-load.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixtures = 'test-fixtures/save-files';
const emerald = path.resolve(fixtures, 'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav');
const heartGold = path.resolve(fixtures, 'raj-pokemon-save-backups/nds/pokemon-heartgold.sav');
const letsGoEevee = path.resolve(
	fixtures,
	'raj-pokemon-save-backups/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin'
);

test.use({ actionTimeout: 15000, viewport: { width: 1800, height: 900 } });

const panes = (page: Page) => [page.locator('.box-pane').nth(0), page.locator('.box-pane').nth(1)];

async function openSaveBesideStorage(page: Page, file: string) {
	await loadRoute(page, '/');
	await page.evaluate(() => localStorage.setItem('pksx-last-storage-location-v1', 'box-0'));
	await importSaveThroughSaves(page, file);
	await loadRoute(page, '/boxes');
	await page.getByRole('button', { name: `Open Box Menu for ${path.basename(file)}` }).click();
	await page
		.getByRole('dialog', { name: 'Box Menu' })
		.getByRole('button', { name: 'Open another collection', exact: true })
		.click();
	await page
		.getByRole('dialog', { name: 'Open another collection' })
		.getByRole('button', { name: /Pokemon Storage/ })
		.click();
	await expect(page.locator('.box-pane')).toHaveCount(2);
}

// Copies the Emerald ARON into Storage, which leaves the Save File clean.
async function storeAron(page: Page) {
	await openSaveBesideStorage(page, emerald);
	const [savePane, storagePane] = panes(page);
	await savePane.locator('[id$="box-0-slot-0"]').click();
	await page.getByLabel('Transfer controls').getByRole('button', { name: 'Copy' }).click();
	await storagePane.locator('[id$="box-0-slot-0"]').click();
	await expect(storagePane.locator('[id$="box-0-slot-0"]')).toContainText('ARON');
	await expect(page.locator('.toast-success')).toContainText('Copied ARON to Pokemon Storage.');
}

async function carryAron(page: Page, mode: 'Move' | 'Duplicate') {
	const source = panes(page)[1].locator('[id$="box-0-slot-0"]');
	await expect(source).toContainText('ARON');
	// A click is a first or second Slot tap depending on focus timing; use the keyboard.
	await source.focus();
	await expect(source).toBeFocused();
	await page.keyboard.press('Enter');
	const actions = page.getByRole('dialog', { name: 'Slot actions' });
	await expect(actions).toBeVisible();
	await actions.getByRole('button', { name: mode, exact: true }).click();
	await expect(actions).toHaveCount(0);
}

async function persisted(page: Page) {
	return page.evaluate(
		() =>
			new Promise<{
				records: Array<{ recordId: string; revision: number; payload: { id: string } }>;
				tombstones: Array<{ recordId: string; reason: string; destinationSaveFileId: string }>;
				workspaces: Array<{ saveFileId: string; dirty: boolean; updatedAt: string }>;
				backups: Array<{ saveFileId: string; reason: string }>;
			}>((resolve, reject) => {
				const open = indexedDB.open('pksx-saves');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const db = open.result;
					const transaction = db.transaction(['manifest', 'workspaces', 'backups']);
					const manifest = transaction.objectStore('manifest').get('current');
					const workspaces = transaction.objectStore('workspaces').getAll();
					const backups = transaction.objectStore('backups').getAll();
					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = () => {
						db.close();
						resolve({
							records: manifest.result.records,
							tombstones: manifest.result.tombstones,
							workspaces: workspaces.result.map(
								(workspace: { saveFileId: string; dirty: boolean; updatedAt: string }) => ({
									saveFileId: workspace.saveFileId,
									dirty: workspace.dirty,
									updatedAt: workspace.updatedAt
								})
							),
							backups: backups.result.map((backup: { saveFileId: string; reason: string }) => ({
								saveFileId: backup.saveFileId,
								reason: backup.reason
							}))
						});
					};
				};
			})
	);
}

test('moves a Storage Pokemon into a Save File Slot and retires its Record ID', async ({
	page
}) => {
	await storeAron(page);
	const [savePane, storagePane] = panes(page);
	const before = await persisted(page);
	expect(before).toMatchObject({ records: [{}], tombstones: [], workspaces: [], backups: [] });

	const destination = savePane.locator('.box-slot.empty').first();
	const destinationSlot = await destination.getAttribute('data-box-slot');
	await carryAron(page, 'Move');
	await destination.click();
	await expect(page.locator('.toast-success').last()).toContainText('Moved ARON to ');
	await expect(savePane.locator(`[data-box-slot="${destinationSlot}"]`)).toContainText('ARON');
	await expect(storagePane.locator('[id$="box-0-slot-0"]')).toContainText('Empty');

	const after = await persisted(page);
	expect(after.records).toEqual([]);
	expect(after.tombstones).toMatchObject([
		{
			recordId: before.records[0].recordId,
			reason: 'moved-to-save',
			destinationSaveFileId: after.workspaces[0].saveFileId
		}
	]);
	expect(after.workspaces).toMatchObject([{ dirty: true }]);
	expect(after.backups).toMatchObject([{ reason: 'pokemon-movement' }]);

	await reloadRoute(page);
	await expect(savePane.locator(`[data-box-slot="${destinationSlot}"]`)).toContainText('ARON');
	await expect(savePane.locator('[id$="box-0-slot-0"]')).toContainText('ARON');
	await loadRoute(page, '/?source=pokemon-storage');
	await expect(page.locator('#box-0-slot-0')).toContainText('Empty');
});

test('copies a Storage Pokemon into Save File Slots and leaves its record unchanged', async ({
	page
}) => {
	await storeAron(page);
	const [savePane, storagePane] = panes(page);
	const before = await persisted(page);

	for (const copies of [1, 2]) {
		const destination = savePane.locator('.box-slot.empty').first();
		const destinationSlot = await destination.getAttribute('data-box-slot');
		await carryAron(page, 'Duplicate');
		await destination.click();
		await expect(page.locator('.toast-success').last()).toContainText('Copied ARON to ');
		await expect(savePane.locator(`[data-box-slot="${destinationSlot}"]`)).toContainText('ARON');
		await expect(savePane.locator('.box-slot.pokemon', { hasText: 'ARON' })).toHaveCount(
			copies + 1
		);
		await expect(storagePane.locator('[id$="box-0-slot-0"]')).toContainText('ARON');
		const after = await persisted(page);
		expect(after.records).toEqual(before.records);
		expect(after.tombstones).toEqual([]);
		expect(after.workspaces).toMatchObject([{ dirty: true }]);
		expect(after.backups).toMatchObject([{ reason: 'pokemon-movement' }]);
	}

	await reloadRoute(page);
	await expect(savePane.locator('.box-slot.pokemon', { hasText: 'ARON' })).toHaveCount(3);
	await loadRoute(page, '/?source=pokemon-storage');
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	expect((await persisted(page)).records).toEqual(before.records);
});

test('places a Generation 3 Storage Pokemon into a Generation 4 Save File', async ({ page }) => {
	await storeAron(page);
	await openSaveBesideStorage(page, heartGold);
	const [savePane] = panes(page);
	const before = await persisted(page);
	const destination = savePane.locator('.box-slot.empty').first();
	const destinationSlot = await destination.getAttribute('data-box-slot');
	await carryAron(page, 'Duplicate');
	await destination.click();
	await expect(page.locator('.toast-success').last()).toContainText('Copied ARON to ');
	await expect(savePane.locator(`[data-box-slot="${destinationSlot}"]`)).toContainText('ARON');
	const after = await persisted(page);
	expect(after.records).toEqual(before.records);
	expect(after.workspaces).toMatchObject([{ dirty: true }]);
	expect(after.backups).toMatchObject([{ reason: 'pokemon-movement' }]);

	await reloadRoute(page);
	await expect(savePane.locator(`[data-box-slot="${destinationSlot}"]`)).toContainText('ARON');
});

test('a refused or cancelled placement changes no Storage, Workspace, or Backup state', async ({
	page
}) => {
	await storeAron(page);
	await openSaveBesideStorage(page, letsGoEevee);
	const [savePane, storagePane] = panes(page);
	const before = await persisted(page);
	const destination = savePane.locator('.box-slot.empty').first();

	await carryAron(page, 'Move');
	await destination.click();
	await expect(page.locator('.toast-error').last()).toContainText('PB7');
	await expect(destination).toContainText('Empty');
	await expect(storagePane.locator('[id$="box-0-slot-0"]')).toContainText('ARON');
	expect(await persisted(page)).toEqual(before);

	await page.keyboard.press('Escape');
	await expect(page.locator('.carry-at-focus')).toHaveCount(0);
	await expect(storagePane.locator('[id$="box-0-slot-0"]')).toContainText('ARON');
	expect(await persisted(page)).toEqual(before);
});
