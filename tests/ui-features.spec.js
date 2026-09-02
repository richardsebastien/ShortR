import { test, expect } from '@playwright/test';

test.describe('UI Features (Theme, Language, Cookie Banner)', () => {
  test('should toggle dark and light themes', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const themeSwitch = page.locator('label.theme-switch');
    await expect(themeSwitch).toBeVisible();

    // Default theme should not have light-theme class
    await expect(html).not.toHaveClass(/light-theme/);

    // Toggle theme to light by clicking the theme switch label/slider
    await themeSwitch.click();
    await expect(html).toHaveClass(/light-theme/);

    // Toggle theme back to dark
    await themeSwitch.click();
    await expect(html).not.toHaveClass(/light-theme/);
  });

  test('should switch languages between French and English', async ({ page }) => {
    await page.goto('/');

    const langSelect = page.locator('#lang-select');
    await expect(langSelect).toBeVisible();

    const shortenButton = page.locator('button[data-translate="index.button.shorten"]');

    // Ensure language is set to 'fr' initially
    await langSelect.selectOption('fr');
    await expect(shortenButton).toHaveText('Raccourcir');

    // Switch to English
    await langSelect.selectOption('en');
    await expect(shortenButton).toHaveText('Shorten');

    // Switch back to French
    await langSelect.selectOption('fr');
    await expect(shortenButton).toHaveText('Raccourcir');
  });

  test('should display cookie banner and handle Accept and Refuse clicks', async ({ page }) => {
    await page.goto('/');

    const cookieBanner = page.locator('#cookie-consent-banner');
    await expect(cookieBanner).toBeVisible();

    const acceptBtn = page.locator('#cookie-accept-btn');
    await acceptBtn.click();

    await expect(cookieBanner).not.toBeVisible();

    // Verify localStorage setting
    const cookieConsent = await page.evaluate(() => localStorage.getItem('cookieConsent'));
    expect(cookieConsent).toBe('accepted');
  });

  test('should handle Refuse cookie click', async ({ page }) => {
    await page.goto('/');

    const cookieBanner = page.locator('#cookie-consent-banner');
    await expect(cookieBanner).toBeVisible();

    const refuseBtn = page.locator('#cookie-refuse-btn');
    await refuseBtn.click();

    await expect(cookieBanner).not.toBeVisible();

    // Verify localStorage setting
    const cookieConsent = await page.evaluate(() => localStorage.getItem('cookieConsent'));
    expect(cookieConsent).toBe('refused');
  });
});
