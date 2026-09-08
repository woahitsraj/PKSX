// Screenshots for #169: every variant x viewport x stress, with the dev server on :5173.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.env.OUT ?? '/tmp/pksx-save-file-shots';
// [name, width, height, safe-area insets t,r,b,l] so the route receives the spec's Safe Canvas.
const viewports = [
	['landscape-floor-616x336', 640, 360, '0,12,24,12'],
	['landscape-target-640x456', 640, 480, '0,0,24,0'],
	['portrait-floor-360x544', 360, 640, '48,0,48,0'],
	['portrait-target-393x759', 393, 852, '59,0,34,0'],
	['tall-landscape-1280x800', 1280, 800, '0,0,0,0'],
	['large-tall-1920x1080', 1920, 1080, '0,0,0,0']
];
// Same route inside the current shell, including the 980-1024px dead band.
const shellViewports = [
	['shell-landscape-floor', 640, 360],
	['shell-dead-band-1000x700', 1000, 700]
];
const variants = ['A', 'B', 'C'];
const modes = [
	['plain', ''],
	['stress', '&stress=1']
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });

async function shoot(name, variant, mode, query) {
	const views = variant === 'B' ? ['bag', 'trainer'] : [''];
	for (const view of views) {
		const viewQuery = view ? `&view=${view}` : '';
		await page.goto(
			`${base}/save-file/prototype?variant=${variant}&controls=0${query}${viewQuery}`
		);
		await page.waitForSelector('[data-proto-ready]', { timeout: 60000 });
		await page.waitForTimeout(400);
		const file = `${out}/${name}-${variant}${view ? '-' + view : ''}-${mode}.png`;
		await page.screenshot({ path: file });
		console.log(file);
	}
}

for (const [name, width, height, inset] of viewports) {
	await page.setViewportSize({ width, height });
	for (const variant of variants) {
		for (const [mode, query] of modes) {
			await shoot(name, variant, mode, `&inset=${inset}${query}`);
		}
	}
}
for (const [name, width, height] of shellViewports) {
	await page.setViewportSize({ width, height });
	for (const variant of variants) await shoot(name, variant, 'plain', '&chrome=1');
}
await browser.close();
