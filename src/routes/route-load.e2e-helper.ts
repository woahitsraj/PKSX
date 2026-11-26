import { expect, type Page } from '@playwright/test';

export async function loadRoute(page: Page, path: string) {
	await page.goto(path);
	await expectRouteReady(page);
}

export async function reloadRoute(page: Page) {
	await page.reload();
	await expectRouteReady(page);
}

// Until ready, a route shows placeholders and its restore replaces navigation state.
async function expectRouteReady(page: Page) {
	await expect(page.locator('[data-destination-root]')).toHaveAttribute(
		'data-initial-state',
		'ready',
		{ timeout: 60_000 }
	);
	await settleMotion(page);
}

export async function settleMotion(page: Page) {
	await page.evaluate(async () => {
		let animations: Animation[];
		do {
			await new Promise(requestAnimationFrame);
			animations = document
				.getAnimations()
				.filter(
					(animation) =>
						animation.effect?.getTiming().iterations !== Infinity &&
						animation.playState !== 'finished'
				);
			await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
		} while (animations.length);
	});
}
