import { expect, test, type Page } from '@playwright/test';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';

const fixtures = path.resolve('test-fixtures/save-files');

async function makeFolder(root: string) {
	const emerald = path.join(fixtures, 'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav');
	await mkdir(path.join(root, 'gba'), { recursive: true });
	await mkdir(path.join(root, 'nds'), { recursive: true });
	await copyFile(emerald, path.join(root, 'emerald.sav'));
	await copyFile(emerald, path.join(root, 'gba/emerald.sav'));
	await copyFile(
		path.join(fixtures, 'pkhex-avalonia/gen4-diamond.sav'),
		path.join(root, 'nds/gen4-diamond.sav')
	);
	await writeFile(path.join(root, 'nds/notes.txt'), 'not a save');
	await writeFile(path.join(root, 'broken.sav'), Buffer.alloc(4096, 7));
	return root;
}

const scanned = '3 saves found. 1 unsupported. 1 other file skipped.';
const scanCommand = (page: Page) =>
	page.getByRole('dialog', { name: 'Add saves' }).getByRole('button', { name: /^Scan a folder/ });

async function scanFolder(
	page: Page,
	folder: string,
	{ tap = false, status = scanned as string | null } = {}
) {
	await page.getByRole('button', { name: 'Import a Save File', exact: true }).click();
	const chooser = page.waitForEvent('filechooser');
	await (tap ? scanCommand(page).tap() : scanCommand(page).click());
	await (await chooser).setFiles(folder);
	const dialog = page.getByRole('dialog', { name: 'Scan a folder' });
	if (status) await expect(dialog.getByRole('status')).toHaveText(status, { timeout: 60_000 });
	return dialog;
}

const releaseRead = (page: Page) =>
	page.evaluate(() => (window as typeof window & { releaseRead: () => void }).releaseRead());

async function activeCardId(page: Page) {
	return page
		.locator('.save-card.active')
		.evaluate((card) => card.closest('[id^="saves-target-"]')!.id);
}

// Rejects or holds File reads for one path, to model an unreadable, failed, or slow file.
async function gateRead(page: Page, suffix: string, mode: 'fail' | 'hold') {
	await page.evaluate(
		({ suffix, mode }) => {
			const read = File.prototype.arrayBuffer;
			File.prototype.arrayBuffer = function () {
				if (!this.webkitRelativePath.endsWith(suffix)) return read.call(this);
				if (mode === 'fail') return Promise.reject(new Error('The file changed on disk.'));
				return new Promise((resolve) => {
					(window as typeof window & { releaseRead?: () => void }).releaseRead = () =>
						resolve(read.call(this));
				});
			};
		},
		{ suffix, mode }
	);
}

async function pressController(page: Page, key: string) {
	for (const pressed of [true, false])
		await page.evaluate(
			({ key, pressed }) =>
				window.dispatchEvent(
					new CustomEvent('pksxcontroller', {
						detail: { key, pressed, discrete: true, id: 'Acceptance controller' }
					})
				),
			{ key, pressed }
		);
}

test('imports chosen saves from a nested folder and reports a failed candidate', async ({
	page
}, testInfo) => {
	const folder = await makeFolder(testInfo.outputPath('saves'));
	await writeFile(path.join(folder, 'locked.sav'), Buffer.alloc(4096, 1));
	await loadRoute(page, '/');
	await gateRead(page, 'locked.sav', 'fail');
	const dialog = await scanFolder(page, folder, {
		status: '3 saves found. 1 unsupported. 1 unreadable. 1 other file skipped.'
	});

	const rows = dialog.getByRole('button', { pressed: true });
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(0)).toContainText('emerald.sav');
	await expect(rows.nth(0)).toContainText('Pokemon Emerald');
	await expect(rows.nth(1)).toContainText('gba');
	await expect(rows.nth(2)).toContainText('Pokemon Diamond');
	await expect(rows.nth(2)).toContainText('nds');
	await expect(dialog.locator('[data-status="unsupported"]')).toContainText('broken.sav');
	await expect(dialog.locator('[data-status="unreadable"]')).toContainText('locked.sav');

	await gateRead(page, 'gba/emerald.sav', 'fail');
	await dialog.getByRole('button', { name: 'Import 3 saves' }).click();
	await expect(dialog.getByRole('status')).toHaveText('Imported 2 Save Files. 1 failed.');
	await expect(rows.nth(1)).toContainText('Import failed. The file changed on disk.');
	await expect(
		page.getByText('2 Save Files imported. gen4-diamond.sav imported and made active.')
	).toBeVisible();
	await expect(page.locator('.save-card')).toHaveCount(2);
	await expect(page.locator('.save-card.active')).toContainText('gen4-diamond.sav');

	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(dialog).toBeHidden();
	const grid = page.getByRole('grid', { name: 'Saves collections' });
	await expect(grid).toBeFocused();
	await expect(grid).toHaveAttribute('aria-activedescendant', await activeCardId(page));
	await expect(page).toHaveURL(/\/$/);
});

test('cancel before confirmation creates nothing, and stopping keeps finished imports', async ({
	page
}, testInfo) => {
	const folder = await makeFolder(testInfo.outputPath('saves'));
	await loadRoute(page, '/');
	let dialog = await scanFolder(page, folder);
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(page.locator('.save-card')).toHaveCount(0);

	dialog = await scanFolder(page, folder);
	await gateRead(page, 'gba/emerald.sav', 'hold');
	await dialog.getByRole('button', { name: 'Import 3 saves' }).click();
	await expect(dialog.getByRole('status')).toHaveText('Importing 2 of 3…');
	await dialog.getByRole('button', { name: 'Stop importing' }).click();
	await releaseRead(page);
	await expect(dialog.getByRole('status')).toHaveText(
		'Imported 2 Save Files. Import stopped before the rest.'
	);
	await expect(page.locator('.save-card')).toHaveCount(2);
	await expect(page.locator('.save-card.active')).toContainText('emerald.sav');
	await expect(dialog.getByRole('button', { name: /gen4-diamond\.sav/ })).not.toContainText(
		'Imported'
	);
});

test('a run with no successful imports keeps the previous active Save File', async ({
	page
}, testInfo) => {
	const folder = await makeFolder(testInfo.outputPath('saves'));
	await loadRoute(page, '/');
	await importSaveThroughSaves(page, {
		name: 'previous.sav',
		mimeType: 'application/octet-stream',
		buffer: await readFile(path.join(folder, 'emerald.sav'))
	});
	const dialog = await scanFolder(page, folder);
	await gateRead(page, '.sav', 'fail');
	await dialog.getByRole('button', { name: 'Import 3 saves' }).click();
	await expect(dialog.getByRole('status')).toHaveText('Imported 0 Save Files. 3 failed.');
	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(page.locator('.save-card')).toHaveCount(1);
	await expect(page.locator('.save-card.active')).toContainText('previous.sav');
});

test('browsers without folder selection keep single-file import and explain why', async ({
	page
}) => {
	await page.addInitScript(() => {
		delete (HTMLInputElement.prototype as { webkitdirectory?: boolean }).webkitdirectory;
	});
	await loadRoute(page, '/');
	const cell = page.locator('#saves-target-import');
	await expect(cell).toContainText('This browser imports one file at a time.');
	const chooser = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Import a Save File', exact: true }).click();
	await (
		await chooser
	).setFiles(path.join(fixtures, 'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'));
	await expect(page.getByText('emerald-011020251345.sav imported and made active.')).toBeVisible({
		timeout: 60_000
	});
	await expect(page.getByRole('dialog', { name: 'Add saves' })).toHaveCount(0);
});

test.describe('compact layout', () => {
	test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });

	test('selects candidates with a controller and touch', async ({ page }, testInfo) => {
		const folder = await makeFolder(testInfo.outputPath('saves'));
		await loadRoute(page, '/');
		await gateRead(page, 'nds/gen4-diamond.sav', 'hold');
		const dialog = await scanFolder(page, folder, { tap: true, status: null });
		const rows = dialog.locator('ul button');
		await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
		await expect(dialog.getByRole('status')).toHaveText(
			'Checking files… 2 saves found. 1 unsupported.'
		);
		await rows.nth(0).tap();
		await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'false');
		await releaseRead(page);
		await expect(dialog.getByRole('status')).toHaveText(scanned, { timeout: 60_000 });

		await pressController(page, 'ArrowDown');
		await pressController(page, 'ArrowDown');
		await expect(rows.nth(2)).toBeFocused();
		await pressController(page, 'Enter');
		await expect(rows.nth(2)).toHaveAttribute('aria-pressed', 'false');
		await pressController(page, 'ArrowDown');
		await expect(dialog.getByRole('button', { name: 'Import 1 save' })).toBeFocused();
		await pressController(page, 'Enter');
		await expect(dialog).toBeHidden();
		await expect(page.locator('.save-card')).toHaveCount(1);
		await expect(page.getByText('emerald.sav imported and made active.')).toBeVisible();
		const grid = page.getByRole('grid', { name: 'Saves collections' });
		await expect(grid).toBeFocused();
		await expect(grid).toHaveAttribute('aria-activedescendant', await activeCardId(page));
	});

	for (const viewport of [
		{ width: 390, height: 700 },
		{ width: 640, height: 360 }
	])
		test(`keeps the commands visible with many saves at ${viewport.width}x${viewport.height}`, async ({
			page
		}, testInfo) => {
			await page.setViewportSize(viewport);
			const folder = testInfo.outputPath('many');
			const emerald = path.join(fixtures, 'bl1ndbeholder-pokemon-saves/emerald-011020251345.sav');
			for (let index = 0; index < 20; index++) {
				await mkdir(path.join(folder, `slot-${index}`), { recursive: true });
				await copyFile(emerald, path.join(folder, `slot-${index}`, 'emerald.sav'));
			}
			await loadRoute(page, '/');
			const dialog = await scanFolder(page, folder, { status: '20 saves found.' });
			await expect(dialog.getByRole('button', { name: 'Import 20 saves' })).toBeInViewport();
			await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport();
			await pressController(page, 'ArrowUp');
			await pressController(page, 'ArrowUp');
			await expect(dialog.locator('ul button').last()).toBeFocused();
			await expect(dialog.locator('ul button').last()).toBeInViewport();
			await expect(dialog.locator('ul button').first()).not.toBeInViewport();
		});
});
