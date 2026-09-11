import { test, expect } from '@playwright/test';

test.describe('URL Shortening UI Flow', () => {
  test('should shorten a target URL with a custom code and display short link and QR code', async ({ page }) => {
    const timestamp = Date.now();
    const customCode = `test-${timestamp}`;
    const targetUrl = 'https://example.com';

    await page.goto('/');
    await page.fill('#target', targetUrl);
    await page.fill('#code', customCode);
    await page.fill('#title', 'Test Shortening Title');
    await page.click('#f button');

    const resultBox = page.locator('#result');
    await expect(resultBox).toBeVisible();

    const shortLink = page.locator('#short');
    await expect(shortLink).toContainText(customCode);
    await expect(shortLink).toHaveAttribute('href', new RegExp(`/${customCode}$`));

    const qrImage = page.locator('#qr');
    await expect(qrImage).toHaveAttribute('src', new RegExp(`/qr/${customCode}\\.png$`));
  });

  test('should handle advanced parameters when shortening a URL', async ({ page }) => {
    const timestamp = Date.now();
    const customCode = `adv-${timestamp}`;
    const targetUrl = 'https://example.org';

    await page.goto('/');
    await page.fill('#target', targetUrl);
    await page.fill('#code', customCode);
    await page.fill('#maxClicks', '50');
    await page.fill('#password', 'SecretPass123');
    await page.fill('#mobileTarget', 'https://m.example.org');

    await page.click('#f button');

    const resultBox = page.locator('#result');
    await expect(resultBox).toBeVisible();

    const shortLink = page.locator('#short');
    await expect(shortLink).toContainText(customCode);
  });
});
