import { test, expect } from '@playwright/test';

test.describe('Redirection UI Flow', () => {
  test('should display 5-second redirection warning and allow skip link', async ({ page }) => {
    const timestamp = Date.now();
    const customCode = `redir-${timestamp}`;
    const targetUrl = 'https://example.com';

    // First create a short URL
    await page.goto('/');
    await page.fill('#target', targetUrl);
    await page.fill('#code', customCode);
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    // Navigate to shortened link
    await page.goto(`/${customCode}`);

    // Verify warning page content
    await expect(page.locator('h1')).toContainText(/Avertissement|Redirection/i);
    await expect(page.locator('.url-box')).toContainText(targetUrl);

    const continueBtn = page.locator('#continue-btn');
    await expect(continueBtn).toBeDisabled();

    // Click skip link to bypass countdown
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeVisible();
    await skipLink.click();

    // Should redirect to target URL
    await page.waitForURL('https://example.com/**');
    expect(page.url()).toContain('example.com');
  });

  test('should present password form for protected link and unlock correctly', async ({ page }) => {
    const timestamp = Date.now();
    const customCode = `prot-${timestamp}`;
    const password = 'MySecretPassword123';
    const targetUrl = 'https://example.org';

    // Create a password protected link
    await page.goto('/');
    await page.fill('#target', targetUrl);
    await page.fill('#code', customCode);
    await page.fill('#password', password);
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    // Navigate to protected link
    await page.goto(`/${customCode}`);

    // Verify password prompt is shown
    await expect(page.locator('h1')).toContainText(/Lien protégé|Protected link/i);
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();

    // Try wrong password
    await passwordInput.fill('WrongPass');
    await page.click('#unlock-form button[type="submit"]');
    const errorMsg = page.locator('#error');
    await expect(errorMsg).toBeVisible();

    // Fill correct password
    await passwordInput.fill(password);
    await page.click('#unlock-form button[type="submit"]');

    // Should now show warning / redirection page or redirect
    await expect(page.locator('.url-box')).toContainText(targetUrl);
  });

  test('should display 410 Gone page for expired link', async ({ page }) => {
    const timestamp = Date.now();
    const customCode = `exp-${timestamp}`;

    // Create a link with max_clicks = 1
    await page.goto('/');
    await page.fill('#target', 'https://example.net');
    await page.fill('#code', customCode);
    await page.fill('#maxClicks', '1');
    await page.click('#f button');
    await expect(page.locator('#result')).toBeVisible();

    // First visit: skip warning to record 1 click
    await page.goto(`/${customCode}?preview=skip`);

    // Second visit: link should now be expired
    const response = await page.goto(`/${customCode}`);
    expect(response.status()).toBe(410);
    await expect(page.locator('h1')).toContainText(/Lien expiré|link has expired/i);
  });
});
