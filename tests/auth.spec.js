import { test, expect } from '@playwright/test';

test.describe('Authentication UI Flow', () => {
  const timestamp = Date.now();
  const testEmail = `testuser_${timestamp}@example.com`;
  const testPassword = 'Password123!';

  test('should register a new user successfully', async ({ page }) => {
    // Handle alert dialog on successful registration
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });

    await page.goto('/register.html');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#f button');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login\.html$/);
  });

  test('should show error on login with invalid credentials', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', testEmail);
    await page.fill('#password', 'WrongPassword!');
    await page.click('#f button');

    const errorMsg = page.locator('#error-msg');
    await expect(errorMsg).toHaveText('Invalid credentials');
  });

  test('should login successfully with valid credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('#f button');

    await expect(page).toHaveURL(/\/dashboard\.html$/);
  });

  test('should handle forgot password flow', async ({ page }) => {
    await page.goto('/forgot-password.html');
    await page.fill('#email', testEmail);
    await page.click('#f button');

    const successBox = page.locator('#success-box');
    await expect(successBox).toBeVisible();
  });
});
