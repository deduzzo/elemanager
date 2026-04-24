import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const EDITOR_EMAIL = process.env.E2E_EDITOR_EMAIL;
const EDITOR_PASSWORD = process.env.E2E_EDITOR_PASSWORD;

test.describe('Fase 3 — Presunti + Confronto (admin-only)', () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    'E2E admin credentials not set (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).',
  );

  async function login(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /entra/i }).click();
    // Aspetta di uscire da /login (redirect verso /admin, /editor, /dashboard o /)
    await page.waitForURL(/\/(?!login).*/, { timeout: 10_000 });
  }

  test('admin vede voci di menu Presunti e Confronto', async ({ page }) => {
    await login(page, ADMIN_EMAIL as string, ADMIN_PASSWORD as string);
    await page.goto('/admin');
    await expect(
      page.getByRole('link', { name: /^presunti$/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole('link', { name: /^confronto$/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('editor NON vede voci di menu Presunti e Confronto', async ({ page }) => {
    test.skip(!EDITOR_EMAIL || !EDITOR_PASSWORD, 'editor creds missing');
    await login(page, EDITOR_EMAIL as string, EDITOR_PASSWORD as string);
    await page.goto('/editor');
    await expect(page.getByRole('link', { name: /^presunti$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /^confronto$/i })).toHaveCount(0);
  });

  test('admin apre /admin/presunti e vede i tab', async ({ page }) => {
    await login(page, ADMIN_EMAIL as string, ADMIN_PASSWORD as string);
    await page.goto('/admin/presunti');
    await expect(
      page.getByRole('button', { name: /per candidato/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole('button', { name: /per sezione/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('admin apre /admin/confronto e vede i tab', async ({ page }) => {
    await login(page, ADMIN_EMAIL as string, ADMIN_PASSWORD as string);
    await page.goto('/admin/confronto');
    await expect(
      page.getByRole('button', { name: /per candidato/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole('button', { name: /per sezione/i }),
    ).toBeVisible({ timeout: 5000 });
  });
});
