import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadRoute } from './route-load.e2e-helper';

test.setTimeout(180_000);

// A service worker from an older deployment serves its cached Engine at the old fixed path.
test.beforeEach(async ({ context }) => {
	await context.route(/\/pkhex-engine\/_framework\//, (route) =>
		route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("stale Engine");' })
	);
});

const fixture = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);

async function choose(page: Page, label: string) {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: new RegExp(`^${label}`) })
		.click();
	await expect(page.locator(`[data-destination-root="${label.toLowerCase()}"]`)).toHaveAttribute(
		'data-initial-state',
		'ready'
	);
	await expect(page.locator('html')).not.toHaveAttribute('data-pksx-route-direction', /./);
}

async function dpad(page: Page, key: string) {
	await page.evaluate((key) => {
		for (const pressed of [true, false])
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: { key, pressed, discrete: true, id: 'Pokedex acceptance' }
				})
			);
	}, key);
}

async function readSafetyState(page: Page) {
	return page.evaluate(
		() =>
			new Promise<{ backups: number; dirty: boolean }>((resolve, reject) => {
				const request = indexedDB.open('pksx-saves');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const db = request.result;
					const tx = db.transaction(['backups', 'workspaces'], 'readonly');
					const count = tx.objectStore('backups').count();
					const workspaces = tx.objectStore('workspaces').getAll();
					tx.oncomplete = () => {
						resolve({ backups: count.result, dirty: workspaces.result[0]?.dirty ?? false });
						db.close();
					};
				};
			})
	);
}

for (const viewport of [
	{ width: 360, height: 640 },
	{ width: 640, height: 360 }
]) {
	test(`Pokedex search, edit, safety and focus at ${viewport.width}x${viewport.height}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await loadRoute(page, '/');
		await page.getByLabel('Import Save File').setInputFiles(fixture);
		await expect(page.getByText('011020251345.sav imported and made active.')).toBeVisible({
			timeout: 90_000
		});
		await choose(page, 'Pokedex');
		const search = page.getByRole('searchbox');
		await expect(search).toBeFocused();
		const wide = viewport.width === 640;
		await dpad(page, wide ? 'ArrowLeft' : 'ArrowUp');
		if (wide) {
			await expect(page.locator(':focus')).toHaveAttribute(
				'data-destination-focus',
				/^(field|apply|mark-all)-/
			);
		} else {
			await expect(page.getByRole('button', { name: /Game-specific values/ })).toBeFocused();
		}

		await search.fill('bulba');
		await expect(page.locator('.species-row')).toHaveCount(1);
		const seen = page.getByRole('button', { name: 'Bulbasaur Seen', exact: true });
		await seen.focus();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('button', { name: 'Bulbasaur Caught', exact: true })).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(seen).toBeFocused();
		await search.fill('saur');
		await seen.focus();
		await page.keyboard.press('ArrowDown');
		await expect(page.getByRole('button', { name: 'Ivysaur Seen', exact: true })).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(seen).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(search).toBeFocused();
		await search.fill('bulba');
		const previous = await seen.getAttribute('aria-pressed');
		const before = await readSafetyState(page);
		expect(before.dirty).toBe(false);
		await seen.click();
		await expect(seen).toHaveAttribute('aria-pressed', previous === 'true' ? 'false' : 'true', {
			timeout: 90_000
		});
		await expect(seen).toBeFocused();
		await expect
			.poll(() => readSafetyState(page))
			.toEqual({ backups: before.backups + 1, dirty: true });
		await expect(page.getByText(/^(Dirty|Clean) Workspace$/)).toHaveCount(0);
		await page.getByRole('button', { name: 'Bulbasaur Caught', exact: true }).click();
		await expect(seen).toHaveAttribute('aria-disabled', 'false');
		expect(await readSafetyState(page)).toEqual({ backups: before.backups + 1, dirty: true });
		// Unown and Spinda own their display PIDs; the field label finds them too.
		await search.fill('display pid');
		await expect(page.locator('.species-row')).toHaveCount(2);
		for (const [name, key] of [
			['Unown', 'unown-pid'],
			['Spinda', 'spinda-pid']
		]) {
			await search.fill(name);
			const toggle = page.getByRole('button', { name: `${name} values`, exact: true });
			await page.getByRole('button', { name: `${name} Caught`, exact: true }).focus();
			await dpad(page, 'ArrowLeft');
			await dpad(page, 'ArrowLeft');
			await expect(toggle).toBeFocused();
			await dpad(page, 'Enter');
			await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			await dpad(page, 'ArrowDown');
			const pid = page.getByLabel(`${name} display PID`, { exact: true });
			await expect(pid).toBeFocused();
			await pid.fill('12345');
			await pid.press('Enter');
			const applied = page.locator(`[data-destination-focus="apply-${key}"]`);
			await expect(applied).toHaveAttribute('aria-disabled', 'false', { timeout: 90_000 });
			await expect(pid).toBeFocused();
			await pid.press('ArrowUp');
			await expect(pid).toHaveValue('12346');
			await dpad(page, 'ArrowRight');
			await expect(applied).toBeFocused();
			await dpad(page, 'ArrowUp');
			await expect(
				page
					.locator('.species-row')
					.filter({ has: toggle })
					.locator('.flag:focus, .values-toggle:focus')
			).toHaveCount(1);
			await toggle.click();
			await toggle.click();
			await expect(pid).toHaveValue('12345');
		}
		await expect(page.locator('.fields-body [data-destination-focus$="-pid"]')).toHaveCount(0);
		// The Values control and an open editor do not shift the Seen and Caught columns.
		await search.fill('20');
		await page.getByRole('button', { name: 'Unown Caught', exact: true }).focus();
		for (const [key, control] of [
			['ArrowUp', 'Misdreavus Caught'],
			['ArrowDown', 'Unown Caught'],
			['ArrowDown', 'Wobbuffet Caught']
		]) {
			await dpad(page, key);
			await expect(page.getByRole('button', { name: control, exact: true })).toBeFocused();
		}
		await search.fill('Spinda');
		// Mark all covers every species, whatever the search shows.
		for (const label of ['Seen', 'Caught']) {
			const markAll = page.getByRole('button', { name: `Mark all ${label}`, exact: true });
			await markAll.click();
			await expect(page.locator(`.total.${label.toLowerCase()} strong`)).toHaveText('386', {
				timeout: 90_000
			});
			await expect(markAll).toBeFocused();
			await expect(markAll).toHaveAttribute('aria-disabled', 'false');
			// A finished Mark all keeps Controller Focus moving by direction.
			const toCaught = label === 'Seen';
			await dpad(
				page,
				wide ? (toCaught ? 'ArrowDown' : 'ArrowUp') : toCaught ? 'ArrowRight' : 'ArrowLeft'
			);
			await expect(
				page.getByRole('button', { name: `Mark all ${toCaught ? 'Caught' : 'Seen'}`, exact: true })
			).toBeFocused();
		}
		await expect(page.locator('.species-row')).toHaveCount(1);
		await expect(page.getByRole('button', { name: 'Spinda Caught', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		expect(await readSafetyState(page)).toEqual({ backups: before.backups + 1, dirty: true });
		await search.fill('saur');
		await seen.focus();
		for (const [key, control] of [
			['ArrowRight', 'Bulbasaur Caught'],
			['ArrowRight', 'Bulbasaur Caught'],
			['ArrowLeft', 'Bulbasaur Seen'],
			['ArrowDown', 'Ivysaur Seen'],
			['ArrowUp', 'Bulbasaur Seen'],
			['ArrowUp', null]
		]) {
			await dpad(page, key as string);
			await expect(
				control ? page.getByRole('button', { name: control, exact: true }) : search
			).toBeFocused();
		}
		// From a scrolled row, Left reaches the rail when it sits beside the list.
		await search.fill('');
		for (let row = 0; row < 43; row++) await dpad(page, 'ArrowDown');
		const oddish = page.getByRole('button', { name: 'Oddish Seen', exact: true });
		await expect(oddish).toBeFocused();
		expect(await page.locator('.species-list').evaluate((list) => list.scrollTop)).toBeGreaterThan(
			0
		);
		await dpad(page, 'ArrowLeft');
		if (wide) {
			const rail = page.locator('.screen :focus');
			await expect(rail).toHaveAttribute('data-destination-focus', /^(field|apply|mark-all)-/);
			await expect(rail).toBeInViewport({ ratio: 1 });
			await expect(page.locator('html')).toHaveAttribute('data-input-modality', 'controller');
			await page.keyboard.press('ArrowRight');
			await expect(oddish).toBeFocused();
			await page.keyboard.press('ArrowLeft');
			await expect(rail).toBeFocused();
			await dpad(page, 'ArrowRight');
			await expect(oddish).toBeFocused();
			await dpad(page, 'ArrowLeft');
			const input = page.locator('[data-destination-focus="field-national"]');
			await input.focus();
			await page.keyboard.press('ArrowRight');
			await expect(input).toBeFocused();
			await dpad(page, 'ArrowRight');
			await expect(page.locator('[data-destination-focus="apply-national"]')).toBeFocused();
		} else {
			await expect(oddish).toBeFocused();
		}
		await search.fill('bulba');
		await seen.focus();
		await choose(page, 'Trainer');
		await choose(page, 'Pokedex');
		await expect(search).toHaveValue('bulba');
		await expect(seen).toBeFocused();
		for (const size of [
			{ width: 640, height: 360 },
			{ width: 360, height: 640 },
			{ width: 800, height: 559 },
			{ width: 800, height: 560 }
		]) {
			await page.setViewportSize(size);
			await expect(seen).toBeFocused();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true
			);
		}
		const field = page.locator('[data-destination-focus="field-national"]');
		await page.setViewportSize({ width: 640, height: 360 });
		await field.focus();
		await page.setViewportSize({ width: 360, height: 640 });
		await expect(field).toBeFocused();
		await choose(page, 'Trainer');
		await choose(page, 'Pokedex');
		await expect(field).toBeFocused();
		await search.fill('no such species');
		await expect(page.getByText('No matching species.')).toBeVisible();
		await expect(search).toBeFocused();
		await page.getByRole('button', { name: 'Clear search' }).click();
		await expect(search).toHaveValue('');
		await expect(search).toBeFocused();
		await page.keyboard.press('ArrowDown');
		await expect(seen).toBeFocused();
		await choose(page, 'Boxes');
		await page
			.getByRole('button', { name: /Open Box Menu for/ })
			.first()
			.click();
		const downloadPromise = page.waitForEvent('download');
		await page
			.getByRole('dialog', { name: 'Box Menu' })
			.getByRole('button', { name: 'Export', exact: true })
			.click();
		const download = await downloadPromise;
		const exported = await download.path();
		if (!exported) throw new Error('Missing export');
		expect(await readFile(exported)).not.toEqual(await readFile(fixture));
	});
}

test('Pokedex explicitly reports a Save File without a Pokedex', async ({ page }) => {
	await loadRoute(page, '/');
	await page
		.getByLabel('Import Save File')
		.setInputFiles(
			path.resolve('test-fixtures/save-files/pkmds-blazor/pokemon-box-ruby-sapphire.gci')
		);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
	await choose(page, 'Pokedex');
	await expect(page.getByText('This Save File format has no Pokedex.')).toBeVisible({
		timeout: 90_000
	});
	await expect(page.getByRole('searchbox')).toHaveCount(0);
});

test('Generation 2 Unown values stay on its row and bulk Seen is backed up', async ({ page }) => {
	await loadRoute(page, '/');
	await page
		.getByLabel('Import Save File')
		.setInputFiles(path.resolve('test-fixtures/save-files/pkmds-blazor/pokemon-silver.sav'));
	await expect(page.getByText('pokemon-silver.sav imported and made active.')).toBeVisible({
		timeout: 90_000
	});
	await choose(page, 'Pokedex');
	await page.getByRole('searchbox').fill('Unown');
	await page.getByRole('button', { name: 'Unown values', exact: true }).click();
	await expect(page.locator('.species-values input')).toHaveCount(2);
	await expect(page.locator('.fields-body')).toHaveCount(0);
	// Silver starts complete; clear one flag so the bulk edit changes state.
	await page.getByRole('button', { name: 'Unown Seen', exact: true }).click();
	await expect(page.locator('.total.seen strong')).toHaveText('250', { timeout: 90_000 });
	const markAll = page.getByRole('button', { name: 'Mark all Seen', exact: true });
	await markAll.click();
	await expect(page.locator('.total.seen strong')).toHaveText('251', { timeout: 90_000 });
	await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });
	await markAll.click();
	await expect(markAll).toHaveAttribute('aria-disabled', 'false');
	expect(await readSafetyState(page)).toEqual({ backups: 1, dirty: true });
});

for (const [generation, file, flag, absent] of [
	[4, 'minna-pokemon-saves/pokemon-soulsilver.sav', 'Language: French', 'Seen: shiny female'],
	[5, 'pkmds-blazor/pokemon-black.sav', 'Seen: shiny female', 'Second seen gender is female']
] as const) {
	test(`Generation ${generation} species flags and Seen share one Backup`, async ({ page }) => {
		await page.setViewportSize(
			generation === 4 ? { width: 640, height: 360 } : { width: 360, height: 640 }
		);
		await loadRoute(page, '/');
		await page
			.getByLabel('Import Save File')
			.setInputFiles(path.resolve('test-fixtures/save-files', file));
		await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
		await choose(page, 'Pokedex');
		const search = page.getByRole('searchbox');
		await search.fill('Pikachu');
		await expect(page.locator('.species-row')).toHaveCount(1);
		const values = page.getByRole('button', { name: 'Pikachu values', exact: true });
		await values.click();
		await dpad(page, 'ArrowDown');
		await expect(page.locator('.species-values .species-flag').first()).toBeFocused();
		await expect(page.getByRole('button', { name: `Pikachu ${absent}`, exact: true })).toHaveCount(
			0
		);
		for (const name of [`Pikachu ${flag}`, 'Pikachu Seen']) {
			const control = page.getByRole('button', { name, exact: true });
			const previous = await control.getAttribute('aria-pressed');
			await control.click();
			await expect(control).toHaveAttribute(
				'aria-pressed',
				previous === 'true' ? 'false' : 'true',
				{
					timeout: 90_000
				}
			);
			await expect(control).toBeFocused();
			await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });
		}
		// The editor stays open across edits and keeps the other species out of the filtered list.
		await expect(values).toHaveAttribute('aria-expanded', 'true');
		// Unown has the most flags; its editor wraps inside the floor width.
		await search.fill('Unown');
		await page.getByRole('button', { name: 'Unown values', exact: true }).click();
		await expect(page.locator('.species-values .species-flag').nth(27)).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await search.fill('no such species');
		await expect(page.getByText('No matching species.')).toBeVisible();
	});
}

test("Let's Go Pokedex edits flags and size records, then exports", async ({ page }) => {
	const file = path.resolve(
		'test-fixtures/save-files/raj-pokemon-save-backups/switch/pokemon-lets-go-eevee-2025-03-24-savedata.bin'
	);
	await page.setViewportSize({ width: 360, height: 640 });
	await loadRoute(page, '/');
	await page.getByLabel('Import Save File').setInputFiles(file);
	await expect(page.getByText(/imported and made active/)).toBeVisible({ timeout: 90_000 });
	await choose(page, 'Pokedex');
	await expect(page.locator('.count')).toHaveText(/153 species/);
	// Kanto plus Meltan and Melmetal only, and no main-series National Pokedex or Spinda values.
	await expect(page.locator('.fields')).toHaveCount(0);
	const search = page.getByRole('searchbox');
	await search.fill('Chikorita');
	await expect(page.getByText('No matching species.')).toBeVisible();
	await search.fill('Melmetal');
	await expect(page.locator('.species-row')).toHaveCount(1);
	await search.fill('Pikachu');
	await expect(page.locator('.species-row')).toHaveCount(1);
	const values = page.getByRole('button', { name: 'Pikachu values', exact: true });
	await values.click();
	await dpad(page, 'ArrowDown');
	await expect(page.locator('.species-values input').first()).toBeFocused();
	const flag = page.getByRole('button', { name: 'Pikachu Seen: shiny female', exact: true });
	const next = (await flag.getAttribute('aria-pressed')) === 'true' ? 'false' : 'true';
	await flag.click();
	await expect(flag).toHaveAttribute('aria-pressed', next, { timeout: 90_000 });
	await expect(flag).toBeFocused();
	await expect.poll(() => readSafetyState(page)).toEqual({ backups: 1, dirty: true });
	// Size records exist only in the Let's Go Pokedex.
	const height = page.getByLabel('Tallest record height (no record: height 254, weight 127)', {
		exact: true
	});
	await height.fill('300');
	await height.press('Enter');
	await expect(height).toHaveJSProperty('validity.valid', false);
	const value = (await height.inputValue()) === '200' ? '100' : '200';
	await height.fill(value);
	await height.press('Enter');
	await expect(page.locator('[data-destination-focus="apply-tallest-height-24"]')).toHaveAttribute(
		'aria-disabled',
		'false',
		{ timeout: 90_000 }
	);
	await expect(height).toBeFocused();
	expect(await readSafetyState(page)).toEqual({ backups: 1, dirty: true });
	await values.click();
	await values.click();
	await expect(height).toHaveValue(value);
	await choose(page, 'Boxes');
	await page
		.getByRole('button', { name: /Open Box Menu for/ })
		.first()
		.click();
	const downloadPromise = page.waitForEvent('download');
	await page
		.getByRole('dialog', { name: 'Box Menu' })
		.getByRole('button', { name: 'Export', exact: true })
		.click();
	const exported = await (await downloadPromise).path();
	if (!exported) throw new Error('Missing export');
	expect(await readFile(exported)).not.toEqual(await readFile(file));
});
