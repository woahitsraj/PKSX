// Throwaway: one screenshot per variant and screen row. Run with the dev server up.
import { chromium } from 'playwright';
const base = process.env.PROTOTYPE_URL ?? 'http://localhost:5174/prototype/density';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1900 } });
for (const v of ['A', 'B', 'C'])
	for (const s of ['box', 'editor', 'saves']) {
		await page.goto(`${base}?variant=${v}&screen=${s}&controls=0`);
		await page.waitForSelector(`.variant-${v}`);
		await page.waitForTimeout(400);
		await page.locator('.row').screenshot({ path: `/tmp/density-${v}-${s}.png` });
	}
await browser.close();
