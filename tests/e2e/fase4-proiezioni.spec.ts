import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL;
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD;

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'E2E admin credentials not configured');

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /accedi|login|entra/i }).click();
  await page.waitForURL(/\/(admin|editor|dashboard|$)/);
}

test('admin vede voce di menu Proiezioni', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Proiezioni' })).toBeVisible();
});

test('editor NON vede voce di menu Proiezioni', async ({ page }) => {
  test.skip(!EDITOR_EMAIL || !EDITOR_PASSWORD, 'editor creds missing');
  await login(page, EDITOR_EMAIL!, EDITOR_PASSWORD!);
  await page.goto('/editor');
  await expect(page.locator('text=Proiezioni')).toHaveCount(0);
});

test('admin apre /admin/proiezioni e vede i selettori', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/proiezioni');
  await expect(page.getByLabel(/giornata/i)).toBeVisible();
  await expect(page.getByLabel(/elezione/i)).toBeVisible();
});

test('admin vede header Proiezioni', async ({ page }) => {
  await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  await page.goto('/admin/proiezioni');
  await expect(
    page.getByRole('heading', { name: /proiezioni/i }),
  ).toBeVisible();
});
