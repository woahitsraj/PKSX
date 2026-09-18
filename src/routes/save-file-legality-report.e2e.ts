import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';

const emeraldFixturePath = path.resolve(
	'test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav'
);
const platinumFixturePath = path.resolve(
	'test-fixtures/save-files/raj-pokemon-save-backups/nds/pokemon-platinum-eu.sav'
);

async function pressController(page: Page, key: string) {
	await page.evaluate(async (controllerKey) => {
		const dispatch = (pressed: boolean) =>
			window.dispatchEvent(
				new CustomEvent('pksxcontroller', {
					detail: {
						key: controllerKey,
						pressed,
						discrete: !controllerKey.startsWith('Arrow'),
						id: 'Test controller'
					}
				})
			);
		const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		dispatch(true);
		await nextFrame();
		await nextFrame();
		dispatch(false);
		await nextFrame();
	}, key);
}

async function importSaveFile(page: Page, fixturePath = emeraldFixturePath) {
	await page.goto('/');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.deleteDatabase('pksx-saves');
				request.onerror = () => reject(request.error ?? new Error('Could not clear Saves.'));
				request.onsuccess = () => resolve();
			})
	);
	await page.reload();
	await page.getByLabel('Import Save File').setInputFiles(fixturePath);
	await expect(
		page.getByRole('button', { name: `Open ${path.basename(fixturePath)} in Boxes` })
	).toBeVisible({ timeout: 15_000 });
}

async function importActiveSaveFile(page: Page, fixturePath = emeraldFixturePath) {
	await importSaveFile(page, fixturePath);
	await page.goto('/boxes');
	await expect(
		page.getByRole('button', { name: `Open Box Menu for ${path.basename(fixturePath)}` })
	).toBeVisible({
		timeout: 15_000
	});
}

async function installWorkspaceResponseHold(page: Page) {
	await page.addInitScript(() => {
		type TestWindow = typeof window & {
			__pksxWorkspaceRequestsToHold?: number;
			__pksxWorkspaceRequestsToSkip?: number;
			__pksxHeldWorkspaceResponses?: number;
			__pksxResponseMethodToHold?: string;
			__pksxReleaseWorkspaceResponses?: () => void;
		};
		const testWindow = window as TestWindow;
		const NativeWorker = window.Worker;
		const heldRequestIds = new Set<string>();
		const releases: Array<() => void> = [];
		testWindow.__pksxWorkspaceRequestsToHold = 0;
		testWindow.__pksxWorkspaceRequestsToSkip = 0;
		testWindow.__pksxHeldWorkspaceResponses = 0;
		testWindow.__pksxResponseMethodToHold = 'loadSaveWorkspace';
		testWindow.__pksxReleaseWorkspaceResponses = () => {
			heldRequestIds.clear();
			for (const release of releases.splice(0)) release();
		};

		window.Worker = new Proxy(NativeWorker, {
			construct(Target, args: ConstructorParameters<typeof Worker>) {
				const worker = new Target(...args);
				const postMessage = worker.postMessage.bind(worker);
				worker.postMessage = new Proxy(postMessage, {
					apply(target, thisArg, args) {
						const request = args[0] as { id?: string; method?: string } | null;
						const method = testWindow.__pksxResponseMethodToHold ?? 'loadSaveWorkspace';
						if (request?.id && request.method === method) {
							const skipped = testWindow.__pksxWorkspaceRequestsToSkip ?? 0;
							const remaining = testWindow.__pksxWorkspaceRequestsToHold ?? 0;
							if (skipped > 0) testWindow.__pksxWorkspaceRequestsToSkip = skipped - 1;
							else if (remaining !== 0) {
								if (remaining > 0) testWindow.__pksxWorkspaceRequestsToHold = remaining - 1;
								heldRequestIds.add(request.id);
							}
						}
						return Reflect.apply(target, thisArg, args);
					}
				}) as typeof worker.postMessage;
				const addEventListener = worker.addEventListener.bind(worker);
				worker.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
					if (type !== 'message') {
						addEventListener(type, listener);
						return;
					}
					addEventListener(type, (event: Event) => {
						const message = (event as MessageEvent).data as { id?: string } | null;
						const invoke = () => {
							if (typeof listener === 'function') listener.call(worker, event);
							else listener.handleEvent(event);
						};
						if (!message?.id || !heldRequestIds.delete(message.id)) {
							invoke();
							return;
						}
						testWindow.__pksxHeldWorkspaceResponses =
							(testWindow.__pksxHeldWorkspaceResponses ?? 0) + 1;
						releases.push(invoke);
					});
				}) as typeof worker.addEventListener;
				return worker;
			}
		}) as typeof Worker;
	});
}

async function holdWorkspaceResponses(page: Page, method: string, skip = 0) {
	await page.evaluate(
		({ responseMethod, responsesToSkip }) => {
			const testWindow = window as typeof window & {
				__pksxWorkspaceRequestsToHold?: number;
				__pksxWorkspaceRequestsToSkip?: number;
				__pksxResponseMethodToHold?: string;
			};
			testWindow.__pksxWorkspaceRequestsToHold = 1;
			testWindow.__pksxWorkspaceRequestsToSkip = responsesToSkip;
			testWindow.__pksxResponseMethodToHold = responseMethod;
		},
		{ responseMethod: method, responsesToSkip: skip }
	);
}

async function waitForHeldWorkspaceResponse(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as typeof window & { __pksxHeldWorkspaceResponses?: number })
						.__pksxHeldWorkspaceResponses ?? 0
			)
		)
		.toBeGreaterThanOrEqual(1);
}

async function releaseWorkspaceResponses(page: Page) {
	await page.evaluate(() => {
		const testWindow = window as typeof window & {
			__pksxWorkspaceRequestsToHold?: number;
			__pksxWorkspaceRequestsToSkip?: number;
			__pksxHeldWorkspaceResponses?: number;
			__pksxResponseMethodToHold?: string;
			__pksxReleaseWorkspaceResponses?: () => void;
		};
		testWindow.__pksxWorkspaceRequestsToHold = 0;
		testWindow.__pksxWorkspaceRequestsToSkip = 0;
		testWindow.__pksxResponseMethodToHold = 'loadSaveWorkspace';
		testWindow.__pksxReleaseWorkspaceResponses?.();
		testWindow.__pksxHeldWorkspaceResponses = 0;
	});
}

async function openFromMainMenu(page: Page) {
	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Legality Report/ })
		.click();
	return page.getByRole('dialog', { name: 'Save File Legality Report' });
}

function slotIdForLocation(location: string) {
	const party = location.match(/^Party, Slot (\d+)$/);
	if (party) return `party-slot-${Number(party[1]) - 1}`;
	const box = location.match(/^Box (\d+), Slot (\d+)$/);
	if (box) return `box-${Number(box[1]) - 1}-slot-${Number(box[2]) - 1}`;
	throw new Error(`Unexpected Location: ${location}`);
}

test('runs, cancels, refreshes, filters, and navigates a Save File-wide Legality Report', async ({
	page
}) => {
	await installWorkspaceResponseHold(page);
	await importActiveSaveFile(page);
	await holdWorkspaceResponses(page, 'checkSlotLegality', 1);
	const report = await openFromMainMenu(page);
	await waitForHeldWorkspaceResponse(page);
	const progress = report.getByRole('progressbar');
	await expect(progress).toHaveAttribute('value', '1');
	await expect(progress).toHaveAttribute('max', /[2-9]\d*/);
	await expect(report).toContainText(/1 \/ \d+/);

	await pressController(page, 'Escape');
	await expect(report.getByRole('heading', { name: 'Report cancelled' })).toBeVisible();
	await expect(report).toContainText('No Workspace changes were made.');
	await expect(report.getByRole('button', { name: 'Run again' })).toBeEnabled();
	await releaseWorkspaceResponses(page);
	await report.getByRole('button', { name: 'Run again' }).click();
	await expect(report.getByRole('list', { name: /Legality Report results/ })).toBeVisible({
		timeout: 120_000
	});
	const closeReport = report.getByRole('button', { name: 'Close report' });
	const allResults = report.getByRole('button', { name: /All$/ });
	await closeReport.focus();
	await page.keyboard.press('ArrowUp');
	await expect(closeReport).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(allResults).toBeFocused();
	await pressController(page, 'ArrowUp');
	await expect(closeReport).toBeFocused();

	const firstResult = report.getByRole('listitem').first();
	const location = await firstResult.locator('.location').innerText();
	const slotId = slotIdForLocation(location);
	await firstResult.getByRole('button', { name: 'Go to Slot' }).click();
	await expect(report).toBeHidden();
	await expect(page.locator(`#${slotId}`)).toBeFocused();

	await page.getByRole('button', { name: 'Open Main Menu' }).click();
	await page
		.getByRole('dialog', { name: 'Main Menu' })
		.getByRole('button', { name: /^Trainer/ })
		.click();
	const money = page.getByRole('spinbutton', { name: 'Money' });
	await expect(money).toBeVisible({ timeout: 15_000 });
	const currentMoney = Number(await money.inputValue());
	await holdWorkspaceResponses(page, 'applySaveFileEditOperation');
	await money.fill(String(currentMoney === 999_999 ? currentMoney - 1 : currentMoney + 1));
	await money.press('Enter');
	await waitForHeldWorkspaceResponse(page);
	await pressController(page, 'Escape');
	await expect(page).toHaveURL(/\/boxes$/);

	await page.getByRole('button', { name: /Open Box Menu for/ }).click();
	const boxMenu = page.getByRole('dialog', { name: 'Box Menu' });
	await boxMenu.getByRole('button', { name: 'Legality Report' }).click();
	const collectionReport = page.getByRole('dialog', { name: 'Save File Legality Report' });
	await expect(collectionReport.getByRole('list', { name: /Legality Report results/ })).toBeVisible(
		{
			timeout: 120_000
		}
	);
	await releaseWorkspaceResponses(page);
	await expect(
		collectionReport.getByText('The Workspace changed. Run the report again.')
	).toBeVisible({ timeout: 15_000 });
	await expect(collectionReport.getByRole('button', { name: 'Go to Slot' }).first()).toBeDisabled();
	await collectionReport.getByRole('button', { name: 'Rerun' }).click();
	await expect(
		collectionReport.getByText('The Workspace changed. Run the report again.')
	).toBeHidden();
	await expect(collectionReport.getByRole('list', { name: /Legality Report results/ })).toBeVisible(
		{
			timeout: 120_000
		}
	);

	for (const [name, resultClass] of [
		['Legal', 'legal'],
		['Warnings', 'warning'],
		['Illegal', 'illegal']
	] as const) {
		const filter = collectionReport.getByRole('button', { name: new RegExp(`${name}$`) });
		const count = Number((await filter.innerText()).match(/\d+/)?.[0] ?? 0);
		await filter.click();
		await expect(filter).toHaveAttribute('aria-pressed', 'true');
		await expect(collectionReport.getByRole('listitem')).toHaveCount(count);
		await expect(collectionReport.locator(`article:not(.${resultClass})`)).toHaveCount(0);
	}
	const allFilter = collectionReport.getByRole('button', { name: /All$/ });
	await allFilter.click();
	await expect(allFilter).toHaveAttribute('aria-pressed', 'true');

	await collectionReport.getByRole('button', { name: 'Close report' }).click();
	await expect(boxMenu).toBeVisible();
	await boxMenu.getByRole('button', { name: 'Switch', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'Switch collection' })
		.getByRole('button', { name: /Pokemon Storage/ })
		.click();
	await expect(
		page.getByRole('button', { name: 'Open Box Menu for Pokemon Storage' })
	).toBeVisible();

	const activeSaveReport = await openFromMainMenu(page);
	await expect(activeSaveReport.getByRole('list', { name: /Legality Report results/ })).toBeVisible(
		{
			timeout: 120_000
		}
	);
	const openPokemonReport = activeSaveReport
		.getByRole('listitem')
		.first()
		.getByRole('button', { name: 'Open report' });
	await openPokemonReport.click();
	await expect(page.getByRole('dialog', { name: 'Legality Check' })).toBeVisible({
		timeout: 30_000
	});
	await pressController(page, 'Escape');
	await expect(activeSaveReport).toBeVisible();
	await expect(
		activeSaveReport.getByRole('list', { name: /Legality Report results/ })
	).toBeVisible();
	await expect(openPokemonReport).toBeFocused();
});

test('keeps a secondary Save File report current across Box projection loads', async ({ page }) => {
	await importSaveFile(page);
	await page.getByLabel('Import Save File').setInputFiles(platinumFixturePath);
	await expect(
		page.getByRole('button', { name: `Open ${path.basename(platinumFixturePath)} in Boxes` })
	).toBeVisible({ timeout: 15_000 });
	await page
		.getByRole('button', { name: `Open ${path.basename(emeraldFixturePath)} in Boxes` })
		.click();

	const primaryMenuButton = page.getByRole('button', {
		name: `Open Box Menu for ${path.basename(emeraldFixturePath)}`
	});
	await expect(primaryMenuButton).toBeVisible({ timeout: 15_000 });
	await primaryMenuButton.click();
	await page
		.getByRole('dialog', { name: 'Box Menu' })
		.getByRole('button', { name: 'Open another collection' })
		.click();
	await page
		.getByRole('dialog', { name: 'Open another collection' })
		.getByRole('button', { name: new RegExp(path.basename(platinumFixturePath)) })
		.click();

	const secondaryPane = page.locator('.box-pane').filter({
		has: page.getByRole('button', {
			name: `Open Box Menu for ${path.basename(platinumFixturePath)}`
		})
	});
	await expect(secondaryPane).toBeVisible({ timeout: 15_000 });
	await secondaryPane
		.getByRole('button', { name: `Open Box Menu for ${path.basename(platinumFixturePath)}` })
		.click();
	const boxMenu = page.getByRole('dialog', { name: 'Box Menu' });
	const reportCommand = boxMenu.getByRole('button', { name: 'Legality Report' });
	await reportCommand.click();

	const report = page.getByRole('dialog', { name: 'Save File Legality Report' });
	await expect(report.getByRole('list', { name: /Legality Report results/ })).toBeVisible({
		timeout: 120_000
	});
	const projectedBoxResult = report.getByRole('listitem').filter({ hasText: 'Box 03' }).first();
	await expect(projectedBoxResult).toBeVisible();
	const openPokemonReport = projectedBoxResult.getByRole('button', { name: 'Open report' });
	await openPokemonReport.click();
	await expect(page.getByRole('dialog', { name: 'Legality Check' })).toBeVisible({
		timeout: 30_000
	});
	await pressController(page, 'Escape');

	await expect(report).toBeVisible();
	await expect(report.getByText('The Workspace changed. Run the report again.')).toHaveCount(0);
	await expect(openPokemonReport).toBeFocused();
	await report.getByRole('button', { name: 'Close report' }).click();
	await expect(boxMenu).toBeVisible();
	await expect(reportCommand).toBeFocused();
});
