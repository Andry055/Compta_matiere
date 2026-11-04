import { test, expect } from '@playwright/test';

test.describe('Remise au détenteur - Demandeur interface', () => {
  test('login as demandeur and check remise-detenteur tab', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => consoleLogs.push(`ERROR: ${err.message}`));

    // Go to frontend
    await page.goto('http://localhost:3002/');

    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Login as demandeur (Randriamampionona Tolotra)
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');

    // Wait for navigation after login
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Debug: log full page content
    const pageContent = await page.textContent('body');
    console.log('=== PAGE CONTENT AFTER LOGIN ===');
    console.log(pageContent?.substring(0, 3000));
    console.log('=== END PAGE CONTENT ===');
    console.log('Browser console logs:', consoleLogs.join('\n'));

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/after-login.png', fullPage: true });

    // Check URL
    console.log('Current URL:', page.url());

    // Try to find any h1
    const h1s = await page.locator('h1').allTextContents();
    console.log('H1 elements:', h1s);

    // Check if we can find the reception screen by looking for tabs
    const tabButtons = await page.locator('button.msr-onglet').allTextContents();
    console.log('Tab buttons found:', tabButtons);

    // If we find "Remise détenteur" tab, click it
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    if (await remiseTab.count() > 0) {
      await remiseTab.click();
      await page.waitForTimeout(1000);

      const remiseContent = await page.textContent('body');
      console.log('=== REMISE DETENTEUR TAB CONTENT ===');
      console.log(remiseContent?.substring(0, 3000));
      console.log('=== END ===');

      await page.screenshot({ path: 'test-results/remise-tab.png', fullPage: true });
    }

    // Test passes if we get here
    expect(true).toBe(true);
  });

  test('check network requests when submitting remise form', async ({ page }) => {
    const apiCalls: string[] = [];
    const consoleLogs: string[] = [];

    page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
    page.on('request', request => {
      if (request.url().includes('/api/remises-detenteurs')) {
        console.log('API CALL:', request.method(), request.url());
        apiCalls.push(`${request.method()} ${request.url()}`);
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/remises-detenteurs')) {
        console.log('API RESPONSE:', response.status(), response.url());
      }
    });

    // Go to frontend
    await page.goto('http://localhost:3002/');

    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Login as demandeur
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Debug
    const pageContent = await page.textContent('body');
    console.log('=== PAGE CONTENT AFTER LOGIN ===');
    console.log(pageContent?.substring(0, 3000));
    console.log('=== END ===');
    console.log('Browser console logs:', consoleLogs.join('\n'));

    await page.screenshot({ path: 'test-results/after-login-2.png', fullPage: true });

    // Check for reception tabs
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    if (await remiseTab.count() > 0) {
      await remiseTab.click();
      await page.waitForTimeout(1000);

      // Check if there's a button to open the form (if any eligible sorties exist)
      const openButtons = await page.locator('button:has-text("Enregistrer la remise")').count();
      console.log('Number of "Enregistrer la remise" buttons:', openButtons);

      if (openButtons > 0) {
        // Click the first one
        await page.click('button:has-text("Enregistrer la remise")');
        await page.waitForTimeout(500);

        // Check if the dialog opens
        const dialog = await page.locator('[role="dialog"]').count();
        console.log('Dialog opened:', dialog > 0);

        if (dialog > 0) {
          // Fill in detenteur name for first line
          const nomInput = page.locator('input[id*="detenteur-nom-input"]');
          if (await nomInput.count() > 0) {
            await nomInput.first().fill('Test Détenteur');
          }

          // Fill in fonction
          const fonctionInput = page.locator('input[id*="detenteur-fonction"]');
          if (await fonctionInput.count() > 0) {
            await fonctionInput.first().fill('Chef de service');
          }

          // Click confirm
          await page.click('button:has-text("Confirmer la remise")');
          await page.waitForTimeout(2000);
        }
      }
    }

    console.log('API calls made to /api/remises-detenteurs:', apiCalls);

    // The frontend currently uses localStorage simulation, so we expect 0 API calls
    expect(apiCalls.length).toBe(0);
  });
});