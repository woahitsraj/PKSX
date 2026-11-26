import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { loadRoute, reloadRoute } from './route-load.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';

const emerald = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function openEmeraldBoxes(page: Page) {
	await loadRoute(page, '/');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('pksx-saves');
				request.onerror = () => reject(request.error ?? new Error('Could not clear Saves.'));
				request.onsuccess = () => resolve();
			})
	);
	await reloadRoute(page);
	await importSaveThroughSaves(page, emerald);
	await loadRoute(page, '/boxes');
	await expect(page.locator('#box-0-slot-0')).toBeVisible({ timeout: 15_000 });
}

async function setConnected(page: Page, connected: boolean) {
	await page.evaluate((value) => {
		window.dispatchEvent(
			new CustomEvent('pksxcontrollerconnection', { detail: { connected: value, id: 'Test' } })
		);
	}, connected);
}

async function pressController(page: Page, key: string) {
	await page.evaluate(async (controllerKey) => {
		const dispatch = (pressed: boolean) =>
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: { key: controllerKey, pressed, discrete: !controllerKey.startsWith('Arrow') }
				})
			);
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		dispatch(true);
		await frame();
		await frame();
		dispatch(false);
		await frame();
	}, key);
}

function guide(page: Page) {
	return page.getByRole('complementary', { name: 'Controller guide' });
}

async function expectAboveGuide(page: Page, selector: string) {
	const guideTop = (await guide(page).boundingBox())!.y;
	const box = (await page.locator(selector).first().boundingBox())!;
	expect(box.y + box.height).toBeLessThanOrEqual(guideTop + 0.5);
}

test('shows the guide only while a controller is connected and reserves its space', async ({
	page
}) => {
	await page.setViewportSize({ width: 640, height: 480 });
	await openEmeraldBoxes(page);
	await expect(guide(page)).toHaveCount(0);
	const restingInset = await page.evaluate(() =>
		getComputedStyle(document.documentElement).getPropertyValue('--pksx-safe-area-bottom')
	);

	await setConnected(page, true);
	await expect(guide(page)).toContainText('Slot Menu');
	await expect(guide(page)).toContainText('Box Menu');
	await expectAboveGuide(page, '#box-0-slot-29');

	await page.locator('#box-0-slot-3').dispatchEvent('pointerdown', { pointerType: 'touch' });
	await page.locator('#box-0-slot-3').click();
	await expect(guide(page)).toBeVisible();

	await pressController(page, 'Select');
	await expect(guide(page)).toContainText('Exit Select');
	await pressController(page, 'Escape');
	await expect(guide(page)).toContainText('Slot Menu');

	await setConnected(page, false);
	await expect(guide(page)).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(() =>
				getComputedStyle(document.documentElement).getPropertyValue('--pksx-safe-area-bottom')
			)
		)
		.toBe(restingInset);
});

test('follows Menus and compact legality review without losing focus or a draft', async ({
	page
}) => {
	await page.setViewportSize({ width: 640, height: 480 });
	await openEmeraldBoxes(page);
	await setConnected(page, true);

	await page.locator('#box-0-slot-0').focus();
	await pressController(page, 'Enter');
	await expect(page.getByRole('dialog').first()).toBeVisible();
	await expect(guide(page)).toContainText('Close');
	await pressController(page, 'Escape');
	await expect(page.locator('#box-0-slot-0')).toBeFocused();

	await page.locator('#box-grid').focus();
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Edit' }).click();
	const editor = page.getByRole('dialog', { name: 'ARON' });
	await expect(editor).toBeVisible({ timeout: 15_000 });
	await expect(guide(page)).toContainText('Section');
	await expect(guide(page)).toContainText('Back');

	const section = page.locator('#pokemon-editor-section-nickname');
	await section.click();
	await expect(section).toHaveAttribute('aria-current', 'page');
	const nickname = editor.locator('#pokemon-editor-nickname');
	await nickname.click();
	await nickname.fill('GUIDE');
	await setConnected(page, false);
	await expect(guide(page)).toHaveCount(0);
	await setConnected(page, true);
	await expect(guide(page)).toBeVisible();
	await expect(nickname).toBeFocused();
	await expect(nickname).toHaveValue('GUIDE');

	await editor.getByRole('button', { name: 'Legality' }).click();
	const report = page.getByRole('dialog', { name: 'Legality Check' });
	await expect(report).toHaveAttribute('aria-busy', 'false', { timeout: 15_000 });
	await expect(guide(page)).toContainText('Back');
	await expectAboveGuide(page, '.takeover-frame');
	await report.getByRole('button', { name: 'Close report' }).click();
	await expect(editor).toBeVisible();
	await expect(editor.locator('#pokemon-editor-staged-count')).toHaveText('1 staged');
});
