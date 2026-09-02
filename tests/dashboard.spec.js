import { test, expect } from '@playwright/test';

test.describe('Dashboard and Link Management UI Flow', () => {
  let page;
  let context;
  const timestamp = Date.now();
  const testEmail = `dashuser_${timestamp}@example.com`;
  const testPassword = 'Password123!';

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Handle alert on registration page
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'alert') {
        try {
          await dialog.accept();
        } catch (e) {}
      }
    });

    await page.goto('/register.html');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#f button');

    await page.goto('/login.html');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#f button');
    await page.waitForURL(/\/dashboard\.html$/);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should list created link in user dashboard', async () => {
    const code = `list-${timestamp}`;
    await page.goto('/');
    await page.fill('#target', 'https://example.com/dashboard-test');
    await page.fill('#code', code);
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    await page.goto('/dashboard.html');
    const row = page.locator(`tr[data-code="${code}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText('https://example.com/dashboard-test');
  });

  test('should allow editing link code', async () => {
    const originalCode = `orig-${timestamp}`;
    const newCode = `new-${timestamp}`;

    await page.goto('/');
    await page.fill('#target', 'https://example.com/edit-test');
    await page.fill('#code', originalCode);
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    await page.goto('/dashboard.html');
    const row = page.locator(`tr[data-code="${originalCode}"]`);
    await expect(row).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept(newCode);
    });

    await row.locator('.edit-btn').click();

    const updatedRow = page.locator(`tr[data-code="${newCode}"]`);
    await expect(updatedRow).toBeVisible();
  });

  test('should allow deleting a link', async () => {
    const delCode = `del-${timestamp}`;

    await page.goto('/');
    await page.fill('#target', 'https://example.com/del-test');
    await page.fill('#code', delCode);
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    await page.goto('/dashboard.html');
    const row = page.locator(`tr[data-code="${delCode}"]`);
    await expect(row).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    await row.locator('.delete-btn').click();
    await expect(row).not.toBeVisible();
  });

  test('should navigate to and display private stats page', async () => {
    const statsCode = `stats-${timestamp}`;

    await page.goto('/');
    await page.fill('#target', 'https://example.com/stats-test');
    await page.fill('#code', statsCode);
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    await page.goto(`/private-stats.html#${statsCode}`);
    await expect(page.locator('#content')).toBeVisible();
    await expect(page.locator('#h-code')).toContainText(statsCode);
    await expect(page.locator('#t-all')).toBeVisible();
  });
});
