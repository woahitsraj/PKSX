import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function pressController(page: Page, key: string) {
	await page.evaluate(async (key) => {
		const detail = { key, pressed: true, discrete: true, id: 'Test controller' };
		window.dispatchEvent(new CustomEvent('pksxcontroller', { detail }));
		await new Promise(requestAnimationFrame);
		window.dispatchEvent(
			new CustomEvent('pksxcontroller', { detail: { ...detail, pressed: false } })
		);
	}, key);
}

test.use({ hasTouch: true });

for (const viewport of [
	{ width: 360, height: 740 },
	{ width: 640, height: 360 }
]) {
	test.describe(`${viewport.width}x${viewport.height}`, () => {
		test.use({ viewport });

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
			await pressController(page, 'Select');
			const actions = page.getByRole('group', { name: 'Selection actions' });
			await expect(actions).toContainText('0 selected');
			const pokemon = page.locator('.box-pane .slot.pokemon').first();
			await pokemon.focus();
			await page.clock.install();
			await pressController(page, 'ArrowRight');
			await pressController(page, 'y');
			await page.clock.runFor(600);
			await expect(actions.getByRole('button', { name: 'Select box', exact: true })).toBeFocused();
			await pressController(page, 'Enter');
			await expect(page.locator('[data-batch-selected="true"]')).toHaveCount(
				await page.locator('.box-pane .slot.pokemon').count()
			);
			await actions.getByRole('button', { name: 'Clear selection' }).tap();
			await pokemon.tap();
			await expect(actions).toContainText('1 selected');
			await expect(pokemon).toHaveAttribute('data-batch-selected', 'true');
			await expect(pokemon).toHaveAccessibleName(/Included in selection/);
			await page.keyboard.press('ArrowRight');
			await expect(actions).toContainText('1 selected');
			await page.keyboard.press('PageDown');
			await expect(actions).toContainText('1 selected');
			await page.keyboard.press('PageUp');
			await expect(pokemon).toHaveAttribute('data-batch-selected', 'true');
			await actions.getByRole('button', { name: 'Select box', exact: true }).tap();
			const occupied = await page.locator('.box-pane .slot.pokemon').count();
			await expect(page.locator('[data-batch-selected="true"]')).toHaveCount(occupied);
			await pressController(page, 'PageDown');
			await expect(page.locator('.box-pane')).toHaveAttribute('data-location', 'box-1');
			await expect(page.locator('.box-pane .slot').first()).toBeEnabled();
			await expect(actions).toContainText(`${occupied} selected`);
			await pressController(page, 'PageUp');
			await expect(page.locator('.box-pane')).toHaveAttribute('data-location', 'box-0');
			await expect(page.locator('.box-pane .slot').first()).toBeEnabled();
			await pressController(page, 'y');
			await expect(actions.locator('button:focus')).toHaveCount(1);
			await actions.getByRole('button', { name: 'Clear selection' }).focus();
			await pressController(page, 'Enter');
			await expect(actions).toContainText('0 selected');
			await expect(pokemon).not.toHaveAccessibleName(/Included in selection/);
			await pokemon.focus();
			await pressController(page, 'Enter');
			await expect(actions).toContainText('1 selected');
			await page.keyboard.press('Escape');
			await expect(actions).toHaveCount(0);
			await expect(page.getByRole('dialog')).toHaveCount(0);
			await page.getByRole('button', { name: /Open Box Menu/ }).click();
			await page.getByRole('button', { name: 'Select Pokemon', exact: true }).click();
			await expect(actions).toContainText('0 selected');
		});
	});
}

for (const location of ['All Pokemon', 'Unfiled', 'Recently Deleted']) {
	test(`clears physical selection before entering ${location}`, async ({ page }) => {
		await page.goto('/?source=pokemon-storage');
		await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
			'data-initial-state',
			'ready'
		);
		const picker = page.getByRole('button', { name: 'Open Box Picker for Pokemon Storage' });
		await picker.click();
		await page.getByRole('button', { name: /^Box 01:/ }).click();
		await page.keyboard.press('-');
		const actions = page.getByRole('group', { name: 'Selection actions' });
		await expect(actions).toContainText('0 selected');
		await picker.click();
		await page.getByRole('button', { name: new RegExp('^' + location) }).click();
		await expect(actions).toHaveCount(0);
		await expect(
			page.getByRole('region', { name: `Pokemon Storage, ${location}`, exact: true })
		).toBeVisible();
	});
}
