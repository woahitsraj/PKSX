import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { expectBoxesReady } from './boxes-ready.e2e-helper';

const fixtures = 'test-fixtures/save-files';
const moonSaves = ['011020252257.sav', '021020252230'];
const unbound = 'pokemon-unbound-2.1.1.1.sav';

async function importSaves(page: Page) {
	await page.goto('/saves');
	await expect(page.locator('[data-destination-root="saves"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60_000 }
	);
	const files = [
		...moonSaves.map((name) => `bl1ndbeholder-pokemon-saves/moon/${name}`),
		`raj-pokemon-save-backups/gba/${unbound}`
	];
	for (const [index, file] of files.entries()) {
		await page.locator('#save-file-input').setInputFiles(path.resolve(fixtures, file));
		await expect(page.locator('.save-card')).toHaveCount(index + 1, { timeout: 60_000 });
	}
	await expect(page.locator('.save-card[aria-busy="true"]')).toHaveCount(0, { timeout: 60_000 });
}

async function expectCoverLoaded(card: Locator) {
	const cover = card.locator('[data-game-art="cover"] img');
	await expect(cover).toHaveAttribute('src', '/game-art/moon.webp');
	await expect
		.poll(() => cover.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth))
		.toBeGreaterThan(0);
}

for (const viewport of [
	{ width: 640, height: 360, columns: 4 },
	{ width: 360, height: 640, columns: 2 }
]) {
	test(`cards show cover art and stay distinct at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await importSaves(page);

		// [SAVES-1] Tile columns, and one full row above the fold.
		const grid = await page.locator('.saves-grid').evaluate((element) => ({
			columns: getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
			firstRowBottom: element.querySelector('.save-card')!.getBoundingClientRect().bottom
		}));
		expect(grid.columns).toBe(viewport.columns);
		expect(grid.firstRowBottom).toBeLessThanOrEqual(viewport.height);

		const moonCards = page.locator('.save-card').filter({ hasText: 'Pokemon Moon' });
		await expect(moonCards).toHaveCount(2);
		for (const name of moonSaves) {
			const card = page.locator('.save-card').filter({ hasText: name });
			await expect(card).toHaveCount(1);
			await expectCoverLoaded(card);
			await expect(card.locator('.trainer')).not.toBeEmpty();
			await expect(
				card.getByRole('button', { name: `Open ${name} in Boxes`, exact: true })
			).toBeVisible();
			await expect(
				card.getByRole('button', { name: `Open Save File Menu for ${name}`, exact: true })
			).toBeVisible();
		}

		const unknown = page.locator('.save-card').filter({ hasText: unbound });
		await expect(unknown.locator('[data-game-art="fallback"]')).toBeVisible();
		await expect(unknown.locator('img')).toHaveCount(0);

		// Art keeps one size in every card and stays inside its card.
		const boxes = await page.locator('.save-card').evaluateAll((cards) =>
			cards.map((card) => {
				const art = card.querySelector('.game-art')!.getBoundingClientRect();
				const bounds = card.getBoundingClientRect();
				return {
					size: [art.width, art.height],
					inside:
						art.left >= bounds.left &&
						art.right <= bounds.right &&
						art.top >= bounds.top &&
						art.bottom <= bounds.bottom,
					fits: card.scrollWidth <= card.clientWidth
				};
			})
		);
		expect(new Set(boxes.map((box) => box.size.join('x'))).size).toBe(1);
		expect(boxes.every((box) => box.inside && box.fits)).toBe(true);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	});
}

test('controller navigation moves between art cards and opens one', async ({ page }) => {
	await page.setViewportSize({ width: 640, height: 360 });
	await importSaves(page);
	const grid = page.getByRole('grid', { name: 'Saves collections' });
	await grid.focus();
	const seen = new Set<string>();
	for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowDown']) {
		await page.keyboard.press(key);
		seen.add((await grid.getAttribute('aria-activedescendant')) ?? '');
		await expect(page.locator('.controller-focused')).toHaveCount(1);
	}
	expect(seen.size).toBeGreaterThan(1);

	const focusedSave = page.locator('.save-card.controller-focused');
	for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
		if (await focusedSave.count()) break;
		await page.keyboard.press(key);
	}
	await expect(focusedSave).toHaveCount(1);
	await page.keyboard.press('Enter');
	await expectBoxesReady(page);
});

test('cover art loads on an offline start', async ({ page, context }) => {
	await page.setViewportSize({ width: 640, height: 360 });
	await importSaves(page);
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect(page.locator('.save-card')).toHaveCount(3, { timeout: 60_000 });

	await context.setOffline(true);
	await page.reload();
	await expect(page.locator('.save-card')).toHaveCount(3, { timeout: 60_000 });
	await expectCoverLoaded(page.locator('.save-card').filter({ hasText: moonSaves[0] }));
	// No card showed this cover, so only the service worker precache can serve it.
	expect(await page.evaluate(async () => (await fetch('/game-art/emerald.webp')).ok)).toBe(true);
	await context.setOffline(false);
});
