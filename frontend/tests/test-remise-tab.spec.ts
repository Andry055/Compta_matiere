import { test, expect } from '@playwright/test';

test('test remise detenteur tab as demandeur', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => logs.push('ERROR: ' + err.message));

  const apiCalls: string[] = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      apiCalls.push(`${req.method()} ${req.url()}`);
    }
  });

  await page.goto('http://localhost:3002/');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  // Login
  await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
  await page.fill('input[type="password"]', 'demandeur123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Navigate to "Réception physique" page
  // Look for the navigation link/button
  console.log('=== Navigating to Réception physique ===');

  // Try to find and click "Réception physique" in the sidebar/navigation
  const receptionLink = page.locator('a:has-text("Réception physique"), button:has-text("Réception physique"), [role="menuitem"]:has-text("Réception physique")').first();
  if (await receptionLink.count() > 0) {
    await receptionLink.click();
    await page.waitForTimeout(2000);
  } else {
    // Try direct URL
    await page.goto('http://localhost:3002/reception');
    await page.waitForTimeout(2000);
  }

  // Check if we're on the reception page
  const content = await page.textContent('body');
  const url = page.url();

  console.log('=== URL after navigation ===');
  console.log(url);
  console.log('=== PAGE CONTENT (first 3000) ===');
  console.log(content?.substring(0, 3000));

  // Look for the tabs
  const tabs = await page.locator('button.msr-onglet, button:has-text("À réceptionner"), button:has-text("Historique"), button:has-text("Anomalies"), button:has-text("Remise détenteur")').allTextContents();
  console.log('=== TABS FOUND ===');
  console.log(JSON.stringify(tabs));

  // Click on "Remise détenteur" tab
  const remiseTab = page.locator('button:has-text("Remise détenteur")');
  if (await remiseTab.count() > 0) {
    console.log('=== Clicking Remise détenteur tab ===');
    await remiseTab.click();
    await page.waitForTimeout(1000);

    const remiseContent = await page.textContent('body');
    console.log('=== REMISE DETENTEUR CONTENT (first 3000) ===');
    console.log(remiseContent?.substring(0, 3000));

    await page.screenshot({ path: 'test-results/remise-tab.png', fullPage: true });
  }

  // Check API calls to remises-detenteurs
  const remiseApiCalls = apiCalls.filter(c => c.includes('remises-detenteurs'));
  console.log('=== API CALLS TO REMISES-DETENTEURS ===');
  console.log(JSON.stringify(remiseApiCalls));

  expect(true).toBe(true);
});