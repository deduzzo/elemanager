import { test, expect } from '@playwright/test';

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test.describe('Admin happy path', () => {
  test.skip(
    !email || !password,
    'E2E admin credentials not set (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).',
  );

  test('login, naviga admin, crea ed elimina giornata', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email as string);
    await page.getByLabel(/password/i).fill(password as string);
    await page.getByRole('button', { name: /entra/i }).click();

    // 2. Wait for navigation away from /login
    await page.waitForURL(/\/(?!login).*/, { timeout: 10_000 });

    // 3. Expect BottomNav to show "Admin" link (admin-only)
    const adminNav = page.getByRole('link', { name: /^admin$/i });
    await expect(adminNav).toBeVisible({ timeout: 5000 });

    // 4. Click "Admin" -> /admin
    await adminNav.click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 5000 });

    // 5. Expect 4 cards on admin index
    await expect(page.getByRole('link', { name: /utenti/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole('link', { name: /giornate elettorali/i }),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /^sezioni$/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole('link', { name: /audit log/i })).toBeVisible({
      timeout: 5000,
    });

    // 6. Click "Giornate elettorali" -> /admin/giornate
    await page.getByRole('link', { name: /giornate elettorali/i }).click();
    await expect(page).toHaveURL(/\/admin\/giornate$/, { timeout: 5000 });

    // 7. Expect header + action button
    await expect(
      page.getByRole('heading', { name: /giornate elettorali/i }),
    ).toBeVisible({ timeout: 5000 });
    const newButton = page.getByRole('button', { name: /nuova giornata/i });
    await expect(newButton).toBeVisible({ timeout: 5000 });

    // 8. Click "+ Nuova giornata" -> modal appears
    await newButton.click();
    await expect(
      page.getByRole('heading', { name: /nuova giornata/i }),
    ).toBeVisible({ timeout: 5000 });

    // 9. Fill form
    const uniqueName = `E2E Test ${Date.now()}`;
    await page.getByLabel(/nome/i).fill(uniqueName);
    await page.getByLabel(/data/i).fill('2099-12-31');
    await page.getByLabel(/comune/i).fill('Test City');
    await page.getByRole('button', { name: /^crea$/i }).click();

    // 10. Toast success "Giornata creata"
    await expect(page.getByText(/giornata creata/i)).toBeVisible({
      timeout: 5000,
    });

    // 11. New giornata card visible
    const createdCard = page.getByRole('heading', { name: uniqueName });
    await expect(createdCard).toBeVisible({ timeout: 5000 });

    // 12. Navigate to detail via "Apri" link next to our card
    await page
      .locator('div', { has: page.getByRole('heading', { name: uniqueName }) })
      .getByRole('link', { name: /apri/i })
      .first()
      .click();

    // 13. URL should match /admin/giornate/<uuid>
    await expect(page).toHaveURL(
      /\/admin\/giornate\/[0-9a-f-]{36}/i,
      { timeout: 5000 },
    );

    // 14. Header with the nome
    await expect(
      page.getByRole('heading', { name: uniqueName }),
    ).toBeVisible({ timeout: 5000 });

    // 15. Cleanup: go back and delete
    await page.goto('/admin/giornate');
    await expect(createdCard).toBeVisible({ timeout: 5000 });

    // Click the "Elimina" button of the matching card
    await page
      .locator('div', { has: page.getByRole('heading', { name: uniqueName }) })
      .getByRole('button', { name: /elimina/i })
      .first()
      .click();

    // Confirm dialog
    await expect(
      page.getByRole('heading', { name: /elimina giornata/i }),
    ).toBeVisible({ timeout: 5000 });
    await page
      .getByRole('button', { name: /^elimina$/i })
      .last()
      .click();

    // Card disappears
    await expect(createdCard).toBeHidden({ timeout: 5000 });
  });
});
