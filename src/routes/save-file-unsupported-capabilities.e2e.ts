import { loadRoute } from './route-load.e2e-helper';
import { importSaveThroughSaves } from './save-import.e2e-helper';
import { expect, test } from '@playwright/test';
import path from 'node:path';

// Battle Revolution exposes Money only: no Trainer name, Trainer gender, or Bag.
const battleRevolutionFixturePath = path.resolve(
	'test-fixtures/save-files/pkmds-blazor/pokemon-battle-revolution.sav'
);

test('Save File routes omit the capabilities a public fixture does not support', async ({
	page
}) => {
	await loadRoute(page, '/');
	await importSaveThroughSaves(page, battleRevolutionFixturePath);

	await loadRoute(page, '/trainer');
	const trainer = page.locator('[data-destination-root="trainer"]');
	await expect(trainer.getByRole('spinbutton', { name: 'Money' })).toBeVisible({
		timeout: 30_000
	});
	await expect(trainer.locator('[data-ledger-row="trainer-name"]')).toHaveCount(0);
	await expect(trainer.locator('[data-ledger-row="trainer-gender"]')).toHaveCount(0);
	await expect(trainer.getByText('No editable Trainer details are available')).toHaveCount(0);

	await loadRoute(page, '/bag');
	const bag = page.locator('[data-destination-root="bag"]');
	await expect(bag.getByText('No editable Bag details are available')).toBeVisible({
		timeout: 30_000
	});
	await expect(bag.getByText('This game does not expose Bag editing here.')).toBeVisible();
	await expect(bag.locator('.bag-block')).toHaveCount(0);
	await expect(bag.locator('[data-ledger-draft="item-quantity"]')).toHaveCount(0);
	await expect(bag.getByRole('button', { name: 'Back to Boxes' })).toBeVisible();
});
