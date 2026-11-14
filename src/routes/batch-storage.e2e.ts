import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });
for (const mode of ['Copy', 'Move']) {
	test(`${mode} selected Pokemon to Storage after reviewing destinations`, async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		await page.getByLabel('Import Save File').setInputFiles(fixture);
		await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
			timeout: 60_000
		});
		await page.getByRole('button', { name: /Open .*011020251345.sav in Boxes/ }).click();
		await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
			'data-initial-state',
			'ready',
			{ timeout: 60_000 }
		);
		const occupiedBefore = await page.locator('.box-pane .slot.pokemon').count();
		await page.keyboard.press('-');
		await page.locator('.box-pane .slot.pokemon').nth(0).tap();
		await page.locator('.box-pane .slot.pokemon').nth(1).tap();
		const actions = page.getByRole('group', { name: 'Selection actions' });
		await expect(actions).toContainText('2 selected');
		await actions.getByRole('button', { name: `${mode} to Storage` }).tap();
		let dialog = page.getByRole('dialog', { name: `${mode} to Storage` });
		await dialog.getByRole('button', { name: /Storage Box 1/ }).tap();
		await expect(dialog.locator('li')).toHaveCount(2);
		await expect(dialog.locator('li').nth(0)).toContainText('Storage Box 1, Slot 1');
		await expect(dialog.locator('li').nth(1)).toContainText('Storage Box 1, Slot 2');
		await page.keyboard.press('Escape');
		await expect(actions).toContainText('2 selected');
		await expect(page.locator('.box-pane .slot.pokemon')).toHaveCount(occupiedBefore);
		await actions.getByRole('button', { name: `${mode} to Storage` }).tap();
		dialog = page.getByRole('dialog', { name: `${mode} to Storage` });
		await dialog.getByRole('button', { name: /Storage Box 1/ }).tap();
		await expect(dialog.locator('li')).toHaveCount(2);
		await dialog.getByRole('button', { name: 'Apply', exact: true }).focus();
		await page.keyboard.press('Enter');
		await expect(dialog).toHaveCount(0, { timeout: 60_000 });
		await expect(actions).toHaveCount(0);
		await expect(page.locator('.box-pane .slot.pokemon')).toHaveCount(
			occupiedBefore - (mode === 'Move' ? 2 : 0)
		);
		await page.reload();
		await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
			'data-initial-state',
			'ready',
			{ timeout: 60_000 }
		);
		await expect(page.locator('.box-pane .slot.pokemon')).toHaveCount(
			occupiedBefore - (mode === 'Move' ? 2 : 0)
		);
	});
}
