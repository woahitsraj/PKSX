import { expect, test } from '@playwright/test';

test('keyboard navigation moves deterministically across the box grid', async ({ page }) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();

	await expect(page.locator('#box-0-slot-0')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowDown');
	await expect(page.locator('#box-0-slot-7')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#box-0-slot-6')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ArrowLeft');
	await expect(page.locator('#party-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#party-grid')).toBeFocused();
});

test('confirm opens slot actions and back restores the grid focus', async ({ page }) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');

	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toContainText('Box 1, slot 2');

	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
	await expect(page.locator('#box-0-slot-1')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#box-grid')).toBeFocused();
});

test('shoulder-tab behavior preserves the slot coordinate while changing boxes', async ({
	page
}) => {
	await page.goto('/');
	await page.locator('#box-grid').focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('PageDown');

	await expect(page.getByRole('heading', { name: 'Box 2' })).toBeVisible();
	await expect(page.locator('#box-1-slot-7')).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('PageUp');
	await expect(page.getByRole('heading', { name: 'Box 1' })).toBeVisible();
	await expect(page.locator('#box-0-slot-7')).toHaveAttribute('aria-selected', 'true');
});

test('mouse clicks move controller focus without opening slot actions', async ({ page }) => {
	await page.goto('/');
	await page.locator('#party-slot-4').click();

	await expect(page.locator('#party-slot-4')).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('dialog', { name: 'Slot actions' })).toBeHidden();
});
