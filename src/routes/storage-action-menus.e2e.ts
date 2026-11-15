import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);
test.use({ viewport: { width: 1280, height: 800 } });

async function openSave(page: Page) {
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await page.getByLabel('Import Save File').setInputFiles(fixture);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 60000
	});
	await page.getByRole('button', { name: /Open .*011020251345.sav in Boxes/ }).click();
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60000 }
	);
}

for (const zone of ['Box', 'Party'])
	for (const mode of ['Copy', 'Move']) {
		test(`${mode} one ${zone} Pokemon from its Slot Menu`, async ({ page }) => {
			await openSave(page);
			if (zone === 'Party')
				await page.getByRole('button', { name: 'Previous Location', exact: true }).click();
			const occupied = page.locator('.box-pane .slot.pokemon');
			await expect(occupied.first()).toBeVisible();
			const count = await occupied.count();
			await occupied.first().focus();
			await page.keyboard.press('Enter');
			const menu = page.getByRole('dialog', { name: 'Slot actions', exact: true });
			await expect(
				menu.getByRole('button', { name: 'Copy to Storage', exact: true })
			).toBeVisible();
			await expect(
				menu.getByRole('button', { name: 'Move to Storage', exact: true })
			).toBeVisible();
			await menu.getByRole('button', { name: `${mode} to Storage`, exact: true }).click();
			const preview = page.getByRole('dialog', { name: `${mode} to Storage`, exact: true });
			await preview.getByRole('button', { name: /Storage Box 1/ }).click();
			await expect(preview.locator('li')).toHaveCount(1);
			await expect(preview.locator('li')).toContainText(
				zone === 'Party' ? 'Party Slot 1' : 'Box 1, Slot 1'
			);
			await page.keyboard.press('Escape');
			await expect(menu).toBeVisible();
			await expect(
				menu.getByRole('button', { name: `${mode} to Storage`, exact: true })
			).toBeFocused();
			await expect(page.getByRole('dialog')).toHaveCount(1);
			await expect(occupied).toHaveCount(count);
			await page.keyboard.press('Enter');
			await preview.getByRole('button', { name: /Storage Box 1/ }).click();
			await expect(preview.getByRole('button', { name: 'Apply', exact: true })).toBeFocused();
			await page.screenshot({
				path: `/tmp/pksx-desktop-review/single-${zone}-${mode}-preview.png`
			});
			await page.keyboard.press('Enter');
			await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });
			await expect(occupied).toHaveCount(count - (mode === 'Move' ? 1 : 0));
			await page.reload();
			await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
				'data-initial-state',
				'ready',
				{ timeout: 60000 }
			);
			await expect(occupied).toHaveCount(count - (mode === 'Move' ? 1 : 0));
			await page.goto('/?source=pokemon-storage');
			await expect(page.locator('.virtual-browser [data-record-id]')).toHaveCount(1, {
				timeout: 60000
			});
		});
	}

for (const entry of ['mouse', 'keyboard', 'controller']) {
	test(`opens selected Pokemon Storage actions with ${entry} and returns safely`, async ({
		page
	}) => {
		await openSave(page);
		const cells = page.locator('.box-pane .slot');
		await cells.nth(1).click();
		await cells.nth(0).click();
		await page.keyboard.press('Shift+ArrowRight');
		const controls = page.getByRole('group', { name: 'Selection actions', exact: true });
		await expect(controls).toContainText('2 selected');
		if (entry === 'mouse') await cells.nth(0).click({ button: 'right' });
		else if (entry === 'keyboard') await page.keyboard.press('y');
		else
			await page.evaluate(() => {
				for (const pressed of [true, false])
					window.dispatchEvent(
						new CustomEvent('pksxcontroller', {
							detail: { key: 'y', pressed, discrete: true, id: 'Test controller' }
						})
					);
			});
		const menu = page.getByRole('dialog', { name: 'Selection actions', exact: true });
		await expect(menu.getByRole('button', { name: 'Copy to Storage', exact: true })).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(menu.getByRole('button', { name: 'Move to Storage', exact: true })).toBeFocused();
		await page.screenshot({ path: `/tmp/pksx-desktop-review/selection-menu-${entry}.png` });
		await page.keyboard.press('Enter');
		const preview = page.getByRole('dialog', { name: 'Move to Storage', exact: true });
		await preview.getByRole('button', { name: /Storage Box 1/ }).click();
		await expect(preview.locator('li')).toHaveCount(2);
		await page.keyboard.press('Escape');
		await expect(menu).toBeVisible();
		await expect(menu.getByRole('button', { name: 'Move to Storage', exact: true })).toBeFocused();
		await expect(page.getByRole('dialog')).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(controls).toContainText('2 selected');
		await expect(controls.getByRole('button', { name: 'Actions', exact: true })).toBeFocused();
		await page.keyboard.press('y');
		await expect(menu).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(menu).toHaveCount(0);
	});
}
