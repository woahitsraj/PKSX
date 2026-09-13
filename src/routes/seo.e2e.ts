import { expect, test } from '@playwright/test';
import path from 'node:path';

test('homepage explains PKSX in HTML and keeps Saves immediately usable', async ({
	page,
	request
}) => {
	const response = await request.get('/');
	expect(response.status()).toBe(200);
	const html = await response.text();
	expect(html).toContain('Pokémon save management, built for mobile and controllers');
	expect(html).toContain('name="description"');
	expect(html).toContain('rel="canonical" href="https://pksx.app/"');
	expect(html).toContain('property="og:image"');
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Saves', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Import a Save File', exact: true })).toBeVisible();
	await expect(page.locator('#about-pksx details')).toHaveAttribute('open', '');
	await expect(page.locator('#app-downloads')).toContainText('Planned');
	await expect(page).toHaveURL(/\/$/);
});

test('saved collections compact the introduction and open at the dedicated Boxes URL', async ({
	page
}) => {
	await page.goto('/');
	await page
		.getByLabel('Import Save File', { exact: true })
		.setInputFiles(
			path.resolve('test-fixtures/save-files/bl1ndbeholder-pokemon-saves/emerald-011020251345.sav')
		);
	await expect(page.locator('.save-card')).toHaveCount(1, { timeout: 30_000 });
	await expect(page.locator('#about-pksx details')).not.toHaveAttribute('open');
	await page.locator('.save-card .card-main').click();
	await expect(page).toHaveURL(/\/boxes$/);
	await expect(page.locator('#box-grid')).toBeVisible();
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Saves', exact: true })).toBeVisible();
	await expect(page.locator('#about-pksx details')).not.toHaveAttribute('open');
	await page.getByText('About PKSX', { exact: true }).click();
	await expect(page.locator('#about-pksx details')).toHaveAttribute('open', '');
});

test('old Saves links work, Boxes opens directly, and only public content is in the sitemap', async ({
	page,
	request
}) => {
	await page.goto('/saves');
	await expect(page).toHaveURL(/\/$/);
	await page.goto('/boxes');
	await expect(page.locator('#box-grid')).toBeVisible();
	await expect(page).toHaveURL(/\/boxes$/);
	for (const route of ['/boxes', '/prototype/density']) {
		const html = await (await request.get(route)).text();
		expect(html).toContain('name="robots" content="noindex, follow"');
	}
	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.status()).toBe(200);
	expect(await sitemap.text()).toContain('<loc>https://pksx.app/</loc>');
	expect(await sitemap.text()).not.toContain('/boxes');
	expect(await (await request.get('/robots.txt')).text()).toContain(
		'Sitemap: https://pksx.app/sitemap.xml'
	);
});
