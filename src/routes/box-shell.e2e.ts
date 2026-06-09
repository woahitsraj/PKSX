import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function openEmptyLibrary(page: Page) {
	await page.goto('/');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('pksx-local-library');

				request.onerror = () =>
					reject(request.error ?? new Error('Could not clear local library.'));
				request.onsuccess = () => resolve();
			})
	);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Open Saves to import a Save File.')).toBeVisible({
		timeout: 15000
	});
}

async function importEmeraldThroughSaves(page: Page) {
	await page.goto('/saves');
	await page.getByLabel('Import Save File').setInputFiles(emeraldFixturePath);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});
	await page.goto('/');
	await expect(page.getByText('011020251345.sav restored from Local Library.')).toBeVisible({
		timeout: 15000
	});
}

async function moveFirstEmeraldBoxSlotToThirdSlot(page: Page) {
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.locator('#box-0-slot-0')).toContainText('Empty', { timeout: 15000 });
	await expect(page.locator('#box-0-slot-2')).toContainText('ARON');
}

test('keyboard navigation moves deterministically across the box grid', async ({ page }) => {
	await openEmptyLibrary(page);
	await expect(page.locator('#box-0-slot-0 img.slot-sprite')).toHaveAttribute(
		'src',
		'./sprites/pokemon/species/0025-form-00-sex-default-normal.png'
	);
	await expect(page.locator('#box-0-slot-0')).toHaveCSS('--slot-hue', '94');
	await expect(page.locator('#box-0-slot-0')).toHaveCSS('--slot-chroma', '0.16');
	await expect(page.locator('#box-0-slot-0')).not.toHaveClass(/dual-type/);
	await expect(page.locator('.portrait-card img')).toHaveAttribute(
		'src',
		'./sprites/pokemon/species/0025-form-00-sex-default-normal.png'
	);
	await expect(
		page.locator('img[src^="https://img.pokemondb.net"], img[src^="http://img.pokemondb.net"]')
	).toHaveCount(0);
	await page.locator('#box-grid').focus();

	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-7')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#box-0-slot-6')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#box-0-slot-6')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#party-slot-0')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#party-slot-0')).toBeFocused();
});

test('compact box controls and keyboard shortcuts update the active box label', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();

	await expect(page.getByRole('heading', { name: 'Box 01' })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('button', { name: 'Next box' }).click();
	await expect(page.getByRole('heading', { name: 'Box 02' })).toBeVisible();
	await expect(page.locator('#box-1-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.locator('#box-grid').focus();
	await page.keyboard.press('PageDown');
	await expect(page.getByRole('heading', { name: 'Box 03' })).toBeVisible();
	await expect(page.locator('#box-2-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('PageDown');
	await expect(page.getByRole('heading', { name: 'Box 01' })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('button', { name: 'Previous box' }).click();
	await expect(page.getByRole('heading', { name: 'Box 03' })).toBeVisible();
	await expect(page.locator('#box-2-slot-0')).toHaveAttribute('aria-selected', 'true');
});

test('confirm opens slot actions and back restores the grid focus', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toContainText('Box 1, slot 2');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toContainText('Slot Action');
	await expect(
		page.getByRole('button', {
			name: 'Create Pokemon'
		})
	).toHaveAttribute('aria-disabled', 'true');
	await expect(page.getByRole('button', { name: 'Move' })).toHaveAttribute('aria-disabled', 'true');
	await expect(page.getByRole('alert')).toHaveCount(0);

	await expect(page.locator('#slot-action-0')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#slot-action-1')).toBeFocused();
	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) {
		await page.keyboard.press(key);
	}
	await expect(page.locator('#slot-action-4')).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('dialog', { name: 'Legality Check' })).toBeHidden();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#box-0-slot-1')).toBeFocused();
});

test('occupied slot actions expose View and Close dismisses', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');

	const dialog = page.getByRole('dialog', { name: 'Slot actions' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('View');
	await expect(page.getByRole('button', { name: 'View' })).not.toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Move' })).not.toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Copy' })).not.toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Clear Slot' })).not.toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Legality Check' })).not.toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await expect(
		page.getByRole('button', {
			name: 'Create Pokemon'
		})
	).toHaveAttribute('aria-disabled', 'true');

	await page.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('View opens Pokemon Editor and returns focus to the command stack', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');

	const editor = page.getByRole('dialog', { name: 'Pikachu' });
	await expect(editor).toBeVisible();
	await expect(editor).toContainText('Save File Pokemon');
	await expect(editor).toContainText('Box 01 · Slot 1 · Row A / Col 1');
	await expect(editor).toContainText('Species #0025');
	await expect(editor).toContainText('Move Set');
	await expect(editor).toContainText('Engine projection');
	await expect(editor).toContainText('No Pokemon edits staged.');
	await expect(page.getByRole('button', { name: 'Apply edits' })).toBeDisabled();
	await expect(page.locator('#pokemon-editor-close')).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await expect(editor.getByLabel('Nickname', { exact: true })).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#pokemon-editor-mode')).toBeFocused();

	await page.keyboard.press('ArrowUp');
	await expect(editor.getByLabel('Nickname', { exact: true })).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(editor).toBeHidden();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
	await expect(page.locator('#slot-action-0')).toBeFocused();
});

test('Pokemon Editor applies nickname changes and refreshes Slot labels', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');

	const editor = page.getByRole('dialog', { name: 'ARON' });
	await expect(editor).toBeVisible();

	const nickname = editor.getByLabel('Nickname', { exact: true });
	await nickname.fill('RON');
	await nickname.press('Backspace');
	await expect(page.getByRole('dialog', { name: 'ARON' })).toBeVisible();
	await expect(nickname).toHaveValue('RO');
	await nickname.fill('RON');
	await expect(editor).toContainText('1 Pokemon edit staged.');

	await editor.getByRole('button', { name: 'Apply edits' }).click();
	await expect(page.locator('#box-0-slot-0')).toContainText('RON', { timeout: 15000 });
	const updatedEditor = page.getByRole('dialog', { name: 'RON' });
	await expect(updatedEditor).toBeVisible();
	await expect(updatedEditor).toContainText('Pokemon nickname updated.');
	await expect(updatedEditor.getByRole('button', { name: 'Apply edits' })).toBeDisabled();
});

test('Legality Check opens an engine report from an occupied Slot and dismisses cleanly', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);
	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
		await page.keyboard.press(key);
	}
	await expect(page.locator('#slot-action-5')).toBeFocused();
	await page.keyboard.press('Enter');

	const report = page.getByRole('dialog', { name: 'Legality Check' });
	await expect(report).toBeVisible({ timeout: 15000 });
	await expect(report).toContainText('ARON');
	await expect(report).toContainText(/PKHeX (judged|found)/);
	await expect(report.getByRole('button', { name: 'Close report' })).toBeFocused();
	await expect(page.getByText('Dirty Workspace')).toHaveCount(0);

	await page.keyboard.press('Escape');
	await expect(report).toBeHidden();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
	await expect(page.locator('#slot-action-5')).toBeFocused();
});

test('keyboard navigation reaches top controls and mobile tabs', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#box-grid').focus();

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#party-slot-0')).toBeFocused();

	await page.keyboard.press('ArrowUp');
	await expect(page.locator('#top-control-0')).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-1')).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-2')).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-3')).toBeFocused();

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-4')).toBeFocused();
	await page.keyboard.press(' ');
	await expect(page.getByRole('button', { name: 'Use light mode' })).toBeVisible();

	await page.locator('#box-0-slot-24').focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-24')).toBeFocused();

	await page.setViewportSize({ width: 420, height: 860 });
	await page.locator('#box-0-slot-0').focus();
	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown']) {
		await page.keyboard.press(key);
	}

	await expect(page.locator('#mobile-tab-1')).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#mobile-tab-0')).toBeFocused();
});

test('mobile slot actions stay inside the viewport without adding page overflow', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.setViewportSize({ width: 420, height: 860 });
	await page.locator('#box-grid').focus();

	const beforeOpen = await page.evaluate(() => ({
		bodyScrollHeight: document.body.scrollHeight,
		htmlScrollHeight: document.documentElement.scrollHeight
	}));

	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
		await page.keyboard.press(key);
	}
	await page.keyboard.press('Enter');

	const afterOpen = await page.evaluate(() => {
		const dialog = document.querySelector('[role="dialog"][aria-label="Slot actions"]');
		const selectedSlot = document.querySelector('[aria-selected="true"]');
		const rect = dialog?.getBoundingClientRect();
		const slotRect = selectedSlot?.getBoundingClientRect();

		return {
			bodyScrollHeight: document.body.scrollHeight,
			htmlScrollHeight: document.documentElement.scrollHeight,
			dialogBottom: rect?.bottom ?? 0,
			dialogLeft: rect?.left ?? -1,
			dialogRight: rect?.right ?? Number.POSITIVE_INFINITY,
			dialogTop: rect?.top ?? 0,
			selectedSlotBottom: slotRect?.bottom ?? Number.POSITIVE_INFINITY,
			tabbarTop:
				document.querySelector('.mobile-tabbar')?.getBoundingClientRect().top ?? window.innerHeight,
			viewportHeight: window.innerHeight,
			viewportWidth: window.innerWidth
		};
	});

	expect(afterOpen.bodyScrollHeight).toBeLessThanOrEqual(beforeOpen.bodyScrollHeight);
	expect(afterOpen.htmlScrollHeight).toBeLessThanOrEqual(beforeOpen.htmlScrollHeight);
	expect(afterOpen.dialogTop).toBeGreaterThanOrEqual(afterOpen.selectedSlotBottom);
	expect(afterOpen.dialogBottom).toBeLessThanOrEqual(afterOpen.viewportHeight);
	expect(afterOpen.dialogBottom).toBeLessThanOrEqual(afterOpen.tabbarTop);
	expect(afterOpen.dialogLeft).toBeGreaterThanOrEqual(0);
	expect(afterOpen.dialogRight).toBeLessThanOrEqual(afterOpen.viewportWidth);
});

test('mouse clicks move controller focus, then selected slots open actions', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.locator('#party-slot-4').click();

	await expect(page.locator('#party-slot-4')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();

	await page.locator('#party-slot-4').click();
	const dialog = page.getByRole('dialog', { name: 'Slot actions' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('Party slot 5');

	const menuState = await dialog.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		return {
			top: rect.top,
			left: rect.left,
			bottom: rect.bottom,
			right: rect.right,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			menuOwnsTopPoint: element.contains(document.elementFromPoint(x, y))
		};
	});

	expect(menuState.left).toBeGreaterThanOrEqual(0);
	expect(menuState.top).toBeGreaterThanOrEqual(0);
	expect(menuState.right).toBeLessThanOrEqual(menuState.viewportWidth);
	expect(menuState.bottom).toBeLessThanOrEqual(menuState.viewportHeight);
	expect(menuState.menuOwnsTopPoint).toBe(true);
});

test('active slot detail rail follows controller focus', async ({ page }) => {
	await openEmptyLibrary(page);
	const rail = page.getByTestId('active-slot-detail-rail');

	await page.locator('#box-grid').focus();
	await expect(rail).toContainText('Pikachu');
	await expect(rail).toContainText('Species #0025');
	await expect(rail).toContainText('LEVEL');
	await expect(rail).toContainText('5');
	await expect(rail).toContainText('Box 01 · Slot 1 · Row A / Col 1');
	await expect(rail).toContainText('Modest');
	await expect(rail).toContainText('Static');
	await expect(rail).toContainText('Light Ball');
	await expect(rail).toContainText('Move Set');
	await expect(rail).toContainText('Thunder Shock');
	await expect(rail).toContainText('Stats');

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(rail).toContainText('Empty slot');
	await expect(rail).toContainText('No Pokemon stored here');
	await expect(rail).toContainText('Box 01 · Slot 2 · Row A / Col 2');
	await expect(rail).not.toContainText('Not available');
	await expect(rail).not.toContainText('Move Set');

	await page.locator('#party-slot-0').click();
	await expect(page.locator('#party-slot-0')).toHaveAttribute('aria-selected', 'true');
	await expect(rail).toContainText('Pikachu');
	await expect(rail).toContainText('Party · Slot 1');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
});

test('imports the Emerald Save File, renders engine data, and exports serialized bytes', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await expect(page.getByText('DIXIE', { exact: true })).toBeVisible();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await expect(page.locator('#party-slot-0')).toContainText('1-UP');
	const detailRail = page.getByTestId('active-slot-detail-rail');
	await expect(detailRail).toContainText('Steel');
	await expect(detailRail).toContainText('Rock');
	await expect(detailRail).toContainText('Sassy');
	await expect(detailRail).toContainText('Rock Head');
	await expect(detailRail).toContainText('Stats');
	await expect(detailRail).toContainText('HP');
	await expect(detailRail).toContainText('+0');
	await expect(detailRail).toContainText('Move Set');
	await expect(detailRail).not.toContainText('Not available');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export' }).click();
	const download = await downloadPromise;
	const exported = await readFile(await download.path());
	const fixture = await readFile(emeraldFixturePath);

	expect(download.suggestedFilename()).toBe('emerald-011020251345.pksx.sav');
	expect(exported.byteLength).toBe(fixture.byteLength);
});

test('Pokemon Editor changes level through Apply and keeps editor focus', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'View' }).click();

	const editor = page.getByRole('dialog', { name: 'ARON' });
	await expect(editor).toBeVisible();
	await expect(editor).toContainText('Level / Experience');
	await expect(editor).toContainText('Level 11');
	await expect(page.locator('#pokemon-editor-close')).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await expect(editor.getByLabel('Nickname', { exact: true })).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#pokemon-editor-mode')).toBeFocused();
	await expect(page.locator('#pokemon-editor-mode')).toHaveAttribute('aria-label', 'Editing Level');
	await page.keyboard.press('Enter');
	await expect(page.locator('#pokemon-editor-mode')).toHaveAttribute(
		'aria-label',
		'Editing Experience'
	);
	await page.keyboard.press('Enter');
	await expect(page.locator('#pokemon-editor-mode')).toHaveAttribute('aria-label', 'Editing Level');
	await page.keyboard.press('ArrowDown');
	const levelInput = editor.locator('input[type="number"]');
	await expect(levelInput).toBeFocused();
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowUp');
	await expect(levelInput).toHaveValue('13');
	await expect(editor).toContainText('1 Pokemon edit staged.');
	await expect(editor.getByRole('button', { name: 'Apply edits' })).toBeEnabled();

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#pokemon-editor-mode')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(levelInput).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#pokemon-editor-apply')).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(editor).toContainText('Pokemon edits applied.', { timeout: 15000 });
	await expect(editor).toContainText('Level 13');
	await expect(page.locator('#box-0-slot-0')).toContainText('Lv 13');
	await expect(page.locator('#pokemon-editor-close')).toBeFocused();
});

test('creates and restores a manual backup for the loaded Save File', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.getByRole('button', { name: 'Saves' }).click();
	await expect(page).toHaveURL(/\/saves$/);
	const backups = page.getByLabel('Save File Backups');
	await expect(backups).toContainText('No Backups yet.');

	await backups.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByText('Backup created.')).toBeVisible();
	await expect(backups).toContainText('Manual');

	await backups.getByRole('button', { name: 'Open' }).click();
	await expect(page.getByText('Backup opened as a separate active Save File.')).toBeVisible();
	await page.goto('/');
	await expect(
		page.getByText('011020251345.restored.sav restored from Local Library.')
	).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
});

test('deletes backups and save files after confirmation', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);
	await page.goto('/saves');

	const backups = page.getByLabel('Save File Backups');
	await backups.getByRole('button', { name: 'Create' }).click();
	await expect(page.getByText('Backup created.')).toBeVisible();
	await expect(backups).toContainText('Manual');

	await backups.getByRole('button', { name: 'Delete' }).click();
	const backupDialog = page.getByRole('alertdialog', { name: 'Delete Manual Backup?' });
	await expect(backupDialog).toBeVisible();
	await expect(backupDialog).toContainText('This cannot be undone.');
	await backupDialog.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByText('Backup deleted.')).toBeVisible();
	await expect(backups).toContainText('No Backups yet.');

	await page.locator('.save-card.active').getByRole('button', { name: 'Delete' }).click();
	const saveDialog = page.getByRole('alertdialog', {
		name: 'Delete emerald-011020251345.sav?'
	});
	await expect(saveDialog).toBeVisible();
	await expect(saveDialog).toContainText('all of its Backups');
	await saveDialog.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByText('emerald-011020251345.sav deleted.')).toBeVisible();
	await expect(page.locator('.save-card')).toHaveCount(0);
	await expect(page.getByText('No active Save File')).toBeVisible();
});

test('moves an occupied box slot into an empty destination slot', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await moveFirstEmeraldBoxSlotToThirdSlot(page);
	await expect(page.locator('#box-0-slot-2')).toBeFocused();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('reload preserves unexported slot changes from the active workspace', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await moveFirstEmeraldBoxSlotToThirdSlot(page);
	await expect(page.getByText('Workspace has unexported changes.')).toBeVisible();

	await page.reload();
	await expect(
		page.getByText('011020251345.sav restored from Local Library with unexported changes.')
	).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('#box-0-slot-0')).toContainText('Empty');
	await expect(page.locator('#box-0-slot-2')).toContainText('ARON');
	await expect(page.getByText('Workspace has unexported changes.')).toBeVisible();
});

test('can perform another slot mutation after the first move changes workspace bytes', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await moveFirstEmeraldBoxSlotToThirdSlot(page);
	await page.locator('#box-0-slot-1').click();
	await page.locator('#box-0-slot-1').click();
	await page.getByRole('button', { name: 'Copy' }).click();
	await page.locator('#box-0-slot-3').click();

	await expect(page.locator('#box-0-slot-3')).toContainText('ILLUMISE');
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('copies an occupied box slot into an empty destination slot', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await expect(page.locator('#box-0-slot-3')).toContainText('ARON');
	await expect(page.locator('#box-0-slot-3')).toBeFocused();
});

test('moving onto an occupied box slot performs a Slot Swap through keyboard picking', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.locator('#box-0-slot-0')).toContainText('ILLUMISE', { timeout: 15000 });
	await expect(page.locator('#box-0-slot-1')).toContainText('ARON');
	await expect(page.locator('#box-0-slot-1')).toBeFocused();
	await expect(page.getByText(/Swapped with .* Slot 2\./)).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('moves a party slot into an empty box slot across Focus Zones', async ({ page }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.locator('#party-slot-0').click();
	await expect(page.locator('#party-slot-0')).toBeFocused();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.locator('#box-0-slot-2')).toContainText('1-UP', { timeout: 15000 });
	await expect(page.locator('#box-0-slot-2')).toBeFocused();
	await expect(page.locator('#party-slot-0')).not.toContainText('1-UP');
	await expect(page.getByRole('alert')).toHaveCount(0);
});

test('copy keeps destination selection active and shows an error toast for occupied destinations', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.locator('#box-0-slot-1')).toBeFocused();
	await expect(page.getByRole('alert')).toContainText('Copy needs an empty destination Slot.');
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');
	await expect(page.locator('#box-0-slot-1')).toContainText('ILLUMISE');
});

test('clear slot cancellation and confirmation use the in-app confirmation surface', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');

	const confirmDialog = page.getByRole('dialog', { name: 'ARON' });
	await expect(confirmDialog).toBeVisible();
	await expect(confirmDialog).toContainText('Clear Slot');
	await expect(confirmDialog).toContainText('Box 01 Slot 1');
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(confirmDialog).toBeHidden();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');

	await page.locator('#box-0-slot-0').click();
	await page.locator('#box-0-slot-0').click();
	await page.getByRole('button', { name: 'Clear Slot' }).click();
	await page.getByRole('button', { name: 'Confirm Clear' }).click();

	await expect(page.locator('#box-0-slot-0')).toContainText('Empty');
	await expect(page.locator('#box-0-slot-0')).toBeFocused();
});

test('keyboard navigation covers the Saves route controls and desktop overflow scrolls', async ({
	page
}) => {
	await openEmptyLibrary(page);
	await page.setViewportSize({ width: 960, height: 520 });
	await page.goto('/saves');

	await page.locator('#top-control-0').focus();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-1')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#top-control-2')).toBeFocused();

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#top-control-4')).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('button', { name: /Import a Save File/ })).toBeFocused();

	const fixture = await readFile(emeraldFixturePath);
	await page.getByLabel('Import Save File').setInputFiles({
		name: 'alpha.sav',
		mimeType: 'application/octet-stream',
		buffer: fixture
	});
	await page.getByLabel('Import Save File').setInputFiles({
		name: 'beta.sav',
		mimeType: 'application/octet-stream',
		buffer: fixture
	});
	await expect(page.locator('.save-card')).toHaveCount(2);

	await page.locator('.save-card').first().getByRole('button').first().focus();
	await page.keyboard.press('ArrowDown');
	await expect(
		page.locator('.save-card').first().getByRole('button', { name: 'Delete' })
	).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(
		page
			.locator('.save-card')
			.first()
			.getByRole('button', { name: /^(Open|Switch) →$/ })
	).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.locator('.save-card').nth(1).getByRole('button').first()).toBeFocused();
	for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown']) {
		await page.keyboard.press(key);
	}
	await expect(page.getByRole('button', { name: /Import a Save File/ })).toBeFocused();

	const scrollState = await page.locator('.save-picker-panel').evaluate((panel) => ({
		clientHeight: panel.clientHeight,
		scrollHeight: panel.scrollHeight
	}));
	expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight);

	await page.locator('.save-picker-panel').evaluate((panel) => {
		panel.scrollTop = 120;
	});
	await expect
		.poll(() => page.locator('.save-picker-panel').evaluate((panel) => panel.scrollTop))
		.toBeGreaterThan(0);
});

test('mobile Saves route scrolls with the document', async ({ page }) => {
	await openEmptyLibrary(page);
	await page.setViewportSize({ width: 390, height: 640 });
	await page.goto('/saves');

	const fixture = await readFile(emeraldFixturePath);
	for (const name of ['alpha.sav', 'beta.sav', 'gamma.sav']) {
		await page.getByLabel('Import Save File').setInputFiles({
			name,
			mimeType: 'application/octet-stream',
			buffer: fixture
		});
	}

	await expect(page.locator('.save-card')).toHaveCount(3);
	const mobileGutters = await page.evaluate(() => {
		const shell = document.querySelector('.app-shell')?.getBoundingClientRect();
		const panel = document.querySelector('.save-picker-panel')?.getBoundingClientRect();

		if (!shell || !panel) {
			throw new Error('Could not measure Saves route gutters.');
		}

		return {
			left: panel.left - shell.left,
			right: shell.right - panel.right
		};
	});
	expect(Math.abs(mobileGutters.left - mobileGutters.right)).toBeLessThanOrEqual(1);
	expect(mobileGutters.left).toBeGreaterThanOrEqual(9);

	await expect
		.poll(() =>
			page.evaluate(() => ({
				innerHeight,
				panelOverflowY: getComputedStyle(document.querySelector('.save-picker-panel')!).overflowY,
				scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
				scrollTop: document.scrollingElement?.scrollTop ?? 0
			}))
		)
		.toMatchObject({
			panelOverflowY: 'visible',
			scrollTop: 0
		});

	const scrollState = await page.evaluate(() => ({
		innerHeight,
		scrollHeight: document.scrollingElement?.scrollHeight ?? 0
	}));
	expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.innerHeight);

	await page.evaluate(() => window.scrollTo(0, 480));
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await expect(page.getByText('Offline - all local')).toBeVisible();
});

test('browses the Local Library route, imports, and switches the active Save File', async ({
	page
}) => {
	await openEmptyLibrary(page);

	await page.getByRole('button', { name: 'Saves' }).click();
	await expect(page).toHaveURL(/\/saves$/);
	await expect(page.getByRole('heading', { name: 'Save Files' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Import a Save File' })).toBeVisible();

	const fixture = await readFile(emeraldFixturePath);
	await page.getByLabel('Import Save File').setInputFiles({
		name: 'alpha.sav',
		mimeType: 'application/octet-stream',
		buffer: fixture
	});

	await expect(page.getByText('alpha.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('.save-card.active')).toContainText('alpha.sav');
	await expect(page.locator('.save-card.active').getByText('Active')).toBeVisible();

	await page.getByLabel('Import Save File').setInputFiles({
		name: 'beta.sav',
		mimeType: 'application/octet-stream',
		buffer: fixture
	});

	await expect(page.getByText('beta.sav imported and made active.')).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('.save-card')).toHaveCount(2);
	await expect(page.locator('.save-card.active')).toContainText('beta.sav');

	await page
		.locator('.save-card')
		.filter({ hasText: 'alpha.sav' })
		.getByRole('button', { name: /Switch/ })
		.click();

	await expect(page.getByText('alpha.sav is active.')).toBeVisible({ timeout: 15000 });
	await expect(page.locator('.save-card.active')).toContainText('alpha.sav');
	await page.goto('/');
	await expect(page.locator('.save-chip')).toContainText('alpha.sav');

	await page.goto('/saves');
	await page.getByLabel('Import Save File').setInputFiles({
		name: 'broken.sav',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from([1, 2, 3, 4])
	});

	await expect(
		page.getByText('Import failed. Current active Save File was not changed.')
	).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('.save-card.active')).toContainText('alpha.sav');
});

test('reloads the most recent imported Save File while offline', async ({ page, context }) => {
	await openEmptyLibrary(page);
	await importEmeraldThroughSaves(page);

	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');

	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON', { timeout: 15000 });

	await context.setOffline(true);
	await page.reload();

	await expect(page.getByText('011020251345.sav restored from Local Library.')).toBeVisible({
		timeout: 15000
	});
	await expect(page.locator('#box-0-slot-0')).toContainText('ARON');

	await context.setOffline(false);
});
