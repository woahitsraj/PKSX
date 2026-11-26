import { expectBoxesReady } from './boxes-ready.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

/** Workspace bytes, Backup count, and Pokemon Storage record count as stored on the device. */
async function storedState(page: Page) {
	return page.evaluate(
		() =>
			new Promise<string>((resolve, reject) => {
				const open = indexedDB.open('pksx-saves');
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const database = open.result;
					const transaction = database.transaction(
						['workspaces', 'saveBytes', 'backups', 'manifest'],
						'readonly'
					);
					const workspaces = transaction.objectStore('workspaces').getAll();
					const saves = transaction.objectStore('saveBytes').getAll();
					const backups = transaction.objectStore('backups').count();
					const manifest = transaction.objectStore('manifest').get('current');
					transaction.onerror = () => reject(transaction.error);
					transaction.oncomplete = async () => {
						database.close();
						const bytes: Uint8Array = (workspaces.result[0] ?? saves.result[0]).bytes;
						const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
						resolve(
							JSON.stringify({
								bytes: Array.from(new Uint8Array(digest)).join(','),
								dirty: workspaces.result[0]?.dirty ?? false,
								backups: backups.result,
								storageRecords: manifest.result?.records.length ?? 0
							})
						);
					};
				};
			})
	);
}

async function setManagementOnly(page: Page, enabled: boolean) {
	await page.goto('/settings');
	const toggle = page.getByRole('switch', { name: 'Management only' });
	if ((await toggle.getAttribute('aria-checked')) !== String(enabled)) await toggle.click();
	await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
}

async function openBoxes(page: Page) {
	await page.goto('/boxes');
	await expectBoxesReady(page);
	await expect(page.locator('#box-0-slot-1')).toContainText(/\S/, { timeout: 15_000 });
}

async function expectBlocked(page: Page, action: string) {
	await expect(
		page
			.locator('.toast-error')
			.filter({ hasText: `Management only blocks ${action}` })
			.first()
	).toBeVisible();
}

test('Management only allows moves and blocks edits, creation, and copies at commit', async ({
	page
}) => {
	test.setTimeout(240_000);
	await page.goto('/');
	await importSaveThroughSaves(page, fixture);

	await setManagementOnly(page, true);
	await expect(page.locator('[data-settings-row="management-only"]')).toContainText(
		'does not certify'
	);
	await page.reload();
	await expect(page.getByRole('switch', { name: 'Management only' })).toHaveAttribute(
		'aria-checked',
		'true'
	);

	// Allowed: move one Pokemon from the Save File to Pokemon Storage.
	await openBoxes(page);
	const occupied = page.locator('.box-pane .slot.pokemon');
	const menu = page.getByRole('dialog', { name: 'Slot actions', exact: true });
	const occupiedBefore = await occupied.count();
	await occupied.first().focus();
	await page.keyboard.press('Enter');
	await menu.getByRole('button', { name: 'Move to Storage', exact: true }).click();
	const preview = page.getByRole('dialog', { name: 'Move to Storage', exact: true });
	await preview.getByRole('button', { name: /Storage Box 1/ }).click();
	await preview.getByRole('button', { name: 'Apply', exact: true }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60_000 });
	await expect(occupied).toHaveCount(occupiedBefore - 1);
	const afterMove = await storedState(page);
	expect(JSON.parse(afterMove)).toMatchObject({ dirty: true, storageRecords: 1 });

	// Blocked: copy, by Slot Menu and by the Carry mode shortcut.
	await occupied.first().focus();
	await page.keyboard.press('Enter');
	await menu.getByRole('button', { name: 'Copy to Storage', exact: true }).click();
	await expectBlocked(page, 'Copy and Duplicate');
	await expect(page.getByRole('dialog', { name: 'Copy to Storage', exact: true })).toHaveCount(0);
	await menu.getByRole('button', { name: 'Move', exact: true }).click();
	await page.keyboard.press('y');
	await expect(page.getByText('Carry mode changed to Copy.')).toHaveCount(0);
	await page.keyboard.press('Escape');

	// Blocked: edit and creation.
	await occupied.first().focus();
	await page.keyboard.press('Enter');
	await menu.getByRole('button', { name: 'Edit', exact: true }).click();
	await expectBlocked(page, 'Pokemon edits');
	await page.keyboard.press('Escape');
	await page.locator('.box-pane .slot.empty').first().focus();
	await page.keyboard.press('Enter');
	await menu.getByRole('button', { name: 'Create Pokemon', exact: true }).click();
	await expectBlocked(page, 'Pokemon creation');
	await page.keyboard.press('Escape');

	// Blocked: trainer data.
	await page.goto('/trainer');
	const money = page.getByRole('spinbutton', { name: 'Money' });
	await expect(money).toBeVisible({ timeout: 15_000 });
	const moneyBefore = await money.inputValue();
	await money.fill('12345');
	await money.press('Enter');
	await expectBlocked(page, 'trainer, bag, and Pokedex edits');
	await expect(money).toHaveValue(moneyBefore);
	expect(await storedState(page)).toBe(afterMove);

	// An edit staged while the Preference is off must not commit after it is turned on.
	await setManagementOnly(page, false);
	await openBoxes(page);
	await expect(occupied).toHaveCount(occupiedBefore - 1);
	await occupied.first().focus();
	await page.keyboard.press('Enter');
	await menu.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.locator('#pokemon-editor-section-nickname').click();
	const nickname = page.locator('#pokemon-editor-nickname');
	await nickname.click();
	await nickname.fill('STAGED');
	const apply = page.getByRole('button', { name: 'Apply edits' });
	await expect(apply).toBeEnabled();
	await page.evaluate(() => localStorage.setItem('pksx-management-only', 'on'));
	await apply.click();
	await expectBlocked(page, 'Pokemon edits');
	expect(await storedState(page)).toBe(afterMove);

	// Disabling restores the edit.
	await page.evaluate(() => localStorage.removeItem('pksx-management-only'));
	await apply.click();
	await expect.poll(() => storedState(page), { timeout: 60_000 }).not.toBe(afterMove);

	// Backup, Backup Restore, and Export stay available.
	await setManagementOnly(page, true);
	await openBoxes(page);
	const backupsBefore = JSON.parse(await storedState(page)).backups;
	await page.keyboard.press('x');
	const boxMenu = page.getByRole('dialog', { name: 'Box Menu' });
	const download = page.waitForEvent('download');
	await boxMenu.getByRole('button', { name: 'Export' }).click();
	await download;
	await page.keyboard.press('x');
	await boxMenu.getByRole('button', { name: 'Save a backup' }).click();
	await expect(page.locator('.toast-success').filter({ hasText: 'Backup saved' })).toBeVisible();
	expect(JSON.parse(await storedState(page)).backups).toBe(backupsBefore + 1);

	await page.keyboard.press('Control+Shift+k');
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Backup Browser/ })
		.click();
	const browser = page.getByRole('dialog', { name: 'Backup Browser' });
	await browser.getByRole('button', { name: 'Restore', exact: true }).first().click();
	await expect(browser.locator('.confirmation')).toContainText('can bring back earlier Pokemon');
	await browser.locator('#backup-browser-confirm-restore').click();
	await expect(browser.locator('.confirmation')).toHaveCount(0, { timeout: 60_000 });
});
