import { expect, type Page } from '@playwright/test';

// Until ready, Boxes shows placeholder Slots and the restore replaces navigation state.
export async function expectBoxesReady(page: Page) {
	await expect(page.locator('[data-destination-root="boxes"]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60_000 }
	);
}
