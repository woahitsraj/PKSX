// Interaction states for #169: draft wash, Saving..., invalid, Remove confirmation, failure Toast. Dev server on :5173.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL ?? 'http://localhost:5173';
const out = process.env.OUT ?? '/tmp/pksx-save-file-shots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const shot = (name) =>
	page.screenshot({ path: `${out}/state-${name}.png` }).then(() => console.log(name));

await page.goto(
	`${base}/save-file/prototype?variant=B&controls=0&inset=0,12,24,12&stress=1&view=trainer`
);
await page.waitForSelector('[data-proto-ready]');
await page.fill('#sf-trainer-name', 'MAY');
await shot('name-draft');
await page.keyboard.press('Enter');
await page.waitForTimeout(120);
await shot('name-saving');
await page.waitForTimeout(700);
await page.fill('#sf-trainer-name', '');
await page.keyboard.press('Enter');
await shot('name-invalid');
await page.keyboard.press('Escape');

await page.goto(`${base}/save-file/prototype?variant=A&controls=0&inset=0,12,24,12&stress=1`);
await page.waitForSelector('[data-proto-ready]');
await page.fill('#sf-money', '1000000');
await page.keyboard.press('Enter');
await shot('money-invalid');
await page.keyboard.press('Escape');
await page.locator('.item button:has-text("Remove")').first().click();
await shot('remove-confirm');
await page.locator('.item button:has-text("Confirm Remove")').first().click();
await page.waitForTimeout(120);
await shot('remove-saving');
await page.waitForTimeout(700);

await page.goto(`${base}/save-file/prototype?variant=A&inset=0,12,24,12`);
await page.waitForSelector('[data-proto-ready]');
await page.click('button:has-text("Fail next")');
await page.click('[aria-label="Increase money"]');
await page.waitForTimeout(800);
await shot('failure-toast');
await browser.close();
