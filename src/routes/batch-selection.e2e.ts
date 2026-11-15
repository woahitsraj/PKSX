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
		await page.getByRole('button', { name: /Open Box Menu/ }).click();
		const select = page.getByRole('button', { name: 'Select Pokemon', exact: true });
		await expect(select).toHaveAttribute('aria-disabled', 'true');
		await expect(page.getByText('Choose a physical Storage Box to select Pokemon.')).toBeVisible();
		await select.focus();
		await page.keyboard.press('Enter');
		await expect(select).toBeVisible();
		await expect(actions).toHaveCount(0);
	});
}

test.describe('desktop selection', () => {
	test.use({ viewport: { width: 1280, height: 800 } });
	test('extends with Shift+Arrow and selects with a mouse rectangle', async ({ page }) => {
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
		const cells = page.locator('.box-pane .location-grid .slot');
		await cells.nth(1).click();
		await cells.nth(0).click();
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await page.keyboard.down('Shift');
		await page.keyboard.press('ArrowUp');
		const actions = page.getByRole('group', { name: 'Selection actions' });
		await expect(actions).toContainText('1 selected');
		await expect(page.locator('.location-grid:focus-within')).toHaveCount(1);
		await page.keyboard.press('ArrowRight');
		await expect(actions).toContainText('2 selected');
		await page.keyboard.press('ArrowUp');
		await expect(page.locator('.location-grid:focus-within')).toHaveCount(1);
		await expect(actions).toContainText('2 selected');
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press('ArrowLeft');
		await expect(actions).toContainText('1 selected');
		await page.keyboard.press('ArrowRight');
		await expect(actions).toContainText('2 selected');
		await page.keyboard.up('Shift');
		await page.keyboard.press('ArrowRight');
		await expect(actions).toContainText('2 selected');
		await page.keyboard.press('Escape');
		await expect(actions).toHaveCount(0);
		const first = await cells.nth(0).boundingBox(),
			second = await cells.nth(1).boundingBox();
		if (!first || !second) throw Error('Visible Box Slots required');
		await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
		await page.mouse.down();
		await page.mouse.move(second.x + second.width - 2, second.y + second.height - 2, { steps: 8 });
		await expect(page.locator('.selection-drag-box')).toBeVisible();
		await page.mouse.up();
		await expect(actions).toContainText('2 selected');
		await expect(page.locator('[data-batch-selected="true"]')).toHaveCount(2);
		await expect(page.getByRole('dialog')).toHaveCount(0);
		await expect(page.locator('.selection-drag-box')).toHaveCount(0);
	});
});

test('Shift range remains in its originating pane at a shared edge', async ({ page }) => {
	await page.setViewportSize({ width: 1800, height: 900 });
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
	await page.getByRole('button', { name: /Open Box Menu/ }).click();
	await page.getByRole('button', { name: 'Open another collection', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Open another collection' })
		.getByRole('button', { name: /011020251345.sav/ })
		.click();
	await expect(page.getByRole('dialog', { name: 'Open another collection' })).toHaveCount(0);
	await expect(page.locator('.box-pane')).toHaveCount(2);
	const first = page.locator('.box-pane').first();
	const id = await first.getAttribute('data-pane-id');
	await expect(first.locator('[data-box-slot="5"]')).toBeEnabled();
	await first.locator('[data-box-slot="5"]').focus();
	await expect(first.locator('[data-box-slot="5"]')).toBeFocused();
	await page.keyboard.press('Shift+ArrowRight');
	const actions = page.getByRole('group', { name: 'Selection actions' });
	await expect(actions).toContainText('0 selected');
	await expect(page.locator('.box-pane')).toHaveCount(1);
	await expect(page.locator('.box-pane')).toHaveAttribute('data-pane-id', id ?? '');
	await page.keyboard.press('Escape');
	await expect(page.locator('.box-pane')).toHaveCount(2);
});

test('a rectangle keeps pane geometry until release, including an existing selection', async ({
	page
}) => {
	await page.setViewportSize({ width: 1800, height: 900 });
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
	await page.getByRole('button', { name: /Open Box Menu/ }).click();
	await page.getByRole('button', { name: 'Open another collection', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Open another collection' })
		.getByRole('button', { name: /011020251345.sav/ })
		.click();
	await expect(page.getByRole('dialog', { name: 'Open another collection' })).toHaveCount(0);
	await expect(page.locator('.box-pane')).toHaveCount(2);
	const right = page.locator('.box-pane').nth(1);
	const id = await right.getAttribute('data-pane-id');
	await expect(right.locator('[data-box-slot="0"]')).toContainText('ARON');
	await expect(right.locator('[data-box-slot="0"]')).toBeEnabled();
	const grid = right.locator('.location-grid');
	const before = await grid.boundingBox();
	const first = await right.locator('[data-box-slot="0"]').boundingBox(),
		second = await right.locator('[data-box-slot="1"]').boundingBox();
	if (!first || !second) throw new Error('Visible Box Slots required');
	await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
	await page.mouse.down();
	await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 8 });
	await expect(page.getByRole('group', { name: 'Selection actions' })).toContainText('2 selected');
	await expect(page.locator('.box-pane')).toHaveCount(2);
	expect(await grid.boundingBox()).toEqual(before);
	await page.screenshot({ path: '/tmp/pksx-desktop-review/desktop-two-pane-drag.png' });
	await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
	await expect(page.getByRole('group', { name: 'Selection actions' })).toContainText('1 selected');
	await page.mouse.up();
	await expect(page.locator('.box-pane')).toHaveCount(1);
	const remaining = page.locator('.box-pane');
	await expect(remaining).toHaveAttribute('data-pane-id', id ?? '');
	const rect = await remaining.locator('.location-grid').boundingBox();
	const cell = await remaining.locator('[data-box-slot="1"]').boundingBox();
	if (!cell) throw new Error('Visible single-pane Slot required');
	await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2);
	await page.mouse.down();
	await expect(page.locator('.box-pane')).toHaveCount(1);
	expect(await remaining.locator('.location-grid').boundingBox()).toEqual(rect);
	await page.mouse.move(cell.x + cell.width - 1, cell.y + cell.height - 1, { steps: 4 });
	await page.mouse.up();
	await expect(page.getByRole('group', { name: 'Selection actions' })).toContainText('2 selected');
});
