import { test, expect } from '@playwright/test';

test('redirect a /login quando non autenticati', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: /accedi a elemanager/i }),
  ).toBeVisible();
});

test('form login presente con email, password e bottone Entra', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /entra/i })).toBeVisible();
});

test('form login mostra errore su credenziali sbagliate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('nonexistent@example.it');
  await page.getByLabel(/password/i).fill('wrong-pass-123');
  await page.getByRole('button', { name: /entra/i }).click();
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
});
