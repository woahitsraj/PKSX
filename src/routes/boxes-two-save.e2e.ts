import { expectBoxesReady } from './boxes-ready.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

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
	await loadRoute(page, '/');

	await importSaveThroughSaves(page, emeraldFixturePath);

	await importSaveThroughSaves(page, xFixturePath);

	await page.getByRole('button', { name: 'Open emerald-011020251345.sav in Boxes' }).click();
	await expectBoxesReady(page);
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

	await panes.nth(1).evaluate((element) => {
		const pane = element as HTMLElement & {
			busyStates?: string[];
			busyObserver?: MutationObserver;
		};
		pane.busyStates = [];
		pane.busyObserver = new MutationObserver(() => {
			pane.busyStates?.push(pane.getAttribute('aria-busy') ?? 'false');
		});
		pane.busyObserver.observe(pane, { attributes: true, attributeFilter: ['aria-busy'] });
	});

	await page.keyboard.press('ArrowRight');
	await expect(panes.nth(1)).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });
	expect(
		await panes.nth(1).evaluate((element) => {
			const pane = element as HTMLElement & { busyStates?: string[] };
			return pane.busyStates ?? [];
		})
	).not.toContain('true');
});
