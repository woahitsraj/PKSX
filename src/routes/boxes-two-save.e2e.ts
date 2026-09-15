import { expect, test } from '@playwright/test';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);
const xFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/x/011020252224.sav'
);

test('keeps the original save visible after opening a second save on Android landscape', async ({
	page
}) => {
	await page.setViewportSize({ width: 640, height: 360 });
	await page.goto('/');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready'
	);

	const importInput = page.getByLabel('Import Save File');
	await importInput.setInputFiles(emeraldFixturePath);
	await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
		timeout: 30_000
	});
	await importInput.setInputFiles(xFixturePath);
	await expect(page.getByText('011020252224.sav imported and made active.')).toBeVisible({
		timeout: 30_000
	});

	await page.getByRole('button', { name: 'Open emerald-011020251345.sav in Boxes' }).click();
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 30_000 }
	);
	// Simulate an Android WebView that ignores subgrid declarations.
	const removedSubgridRules = await page.evaluate(() => {
		let removed = 0;
		for (const sheet of document.styleSheets) {
			for (const rule of sheet.cssRules) {
				if (
					rule instanceof CSSStyleRule &&
					rule.selectorText.includes('.box-pane-strip') &&
					rule.style.gridTemplateColumns === 'subgrid'
				) {
					rule.style.removeProperty('grid-template-columns');
					rule.style.removeProperty('grid-template-rows');
					removed += 1;
				}
			}
		}
		return removed;
	});
	await page.getByRole('button', { name: 'Open Box Menu for emerald-011020251345.sav' }).click();
	await page
		.getByRole('dialog', { name: 'Box Menu' })
		.getByRole('button', { name: 'Open another' })
		.click();
	await page
		.getByRole('dialog', { name: 'Open another collection' })
		.getByRole('button', { name: /011020252224\.sav/ })
		.click();

	const panes = page.locator('.box-pane');
	await expect(panes).toHaveCount(2);
	await expect(panes.nth(1)).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
	await expect(panes.nth(0).locator('.slot.pokemon').first()).toBeVisible();
	await expect(panes.nth(1).getByRole('grid')).toBeVisible();
	const paneBounds = await panes.evaluateAll((elements) =>
		elements.map((element) => element.getBoundingClientRect().toJSON())
	);
	expect(paneBounds[0]?.width).toBeGreaterThan(250);
	expect(paneBounds[1]?.width).toBeGreaterThan(250);
	expect(paneBounds[0]?.height).toBeGreaterThan(250);
	expect(paneBounds[1]?.height).toBeGreaterThan(250);
	expect(paneBounds[0]?.right).toBeLessThanOrEqual(paneBounds[1]?.left ?? 0);
	expect(removedSubgridRules).toBe(0);
});
