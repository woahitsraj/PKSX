import { expect, test } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });

test('selects occupied Slots by touch and controller, retains boxes, and exits safely', async ({
	page
}) => {
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
	await page.keyboard.press('-');
	const actions = page.getByRole('group', { name: 'Selection actions' });
	await expect(actions).toContainText('0 selected');
	const pokemon = page.locator('.box-pane .slot.pokemon').first();
	await pokemon.tap();
	await expect(actions).toContainText('1 selected');
	await expect(pokemon).toHaveAttribute('data-batch-selected', 'true');
	await page.keyboard.press('ArrowRight');
	await expect(actions).toContainText('1 selected');
	await page.keyboard.press('PageDown');
	await expect(actions).toContainText('1 selected');
	await page.keyboard.press('PageUp');
	await expect(pokemon).toHaveAttribute('data-batch-selected', 'true');
	await actions.getByRole('button', { name: 'Select box', exact: true }).tap();
	const occupied = await page.locator('.box-pane .slot.pokemon').count();
	await expect(page.locator('[data-batch-selected="true"]')).toHaveCount(occupied);
	await actions.getByRole('button', { name: 'Clear selection' }).tap();
	await expect(actions).toContainText('0 selected');
	await pokemon.focus();
	await page.evaluate(() =>
		window.dispatchEvent(
			new CustomEvent('pksxcontroller', {
				detail: { key: 'Enter', pressed: true, discrete: true, id: 'Test controller' }
			})
		)
	);
	await expect(actions).toContainText('1 selected');
	await page.keyboard.press('Escape');
	await expect(actions).toHaveCount(0);
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await page.getByRole('button', { name: /Open Box Menu/ }).click();
	await page.getByRole('button', { name: 'Select Pokemon', exact: true }).click();
	await expect(actions).toContainText('0 selected');
});
