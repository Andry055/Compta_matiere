import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => logs.push('ERROR: ' + err.message));

  const apiCalls = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      apiCalls.push(`${req.method()} ${req.url()}`);
    }
  });

  try {
    console.log('=== NAVIGATING TO FRONTEND ===');
    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    console.log('=== LOGGING IN ===');
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    console.log('=== AFTER LOGIN ===');
    console.log('URL:', page.url());

    // Navigate to reception by clicking the sidebar BUTTON
    console.log('=== CLICKING RECEPTION PHYSIQUE BUTTON ===');
    await page.click('button:has-text("Réception physique")');
    await page.waitForTimeout(2000);

    const url = page.url();
    const content = await page.textContent('body');

    console.log('=== URL AFTER NAVIGATION ===');
    console.log(url);
    console.log('=== CONTENT (first 3000) ===');
    console.log(content?.substring(0, 3000));

    // Find tabs
    const tabs = await page.locator('button:has-text("À réceptionner"), button:has-text("Historique"), button:has-text("Anomalies"), button:has-text("Remise détenteur")').allTextContents();
    console.log('=== TABS ===');
    console.log(JSON.stringify(tabs));

    // Click remise detenteur tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    if (await remiseTab.count() > 0) {
      console.log('=== CLICKING REMISE DETENTEUR TAB ===');
      await remiseTab.click();
      await page.waitForTimeout(1000);

      const remiseContent = await page.textContent('body');
      console.log('=== REMISE TAB CONTENT (first 3000) ===');
      console.log(remiseContent?.substring(0, 3000));

      await page.screenshot({ path: 'test-results/standalone-remise.png', fullPage: true });
    }

    // Check API calls
    const remiseApiCalls = apiCalls.filter(c => c.includes('remises-detenteurs'));
    console.log('=== REMISES-DETENTEURS API CALLS ===');
    console.log(JSON.stringify(remiseApiCalls, null, 2));

    console.log('=== ALL API CALLS ===');
    console.log(JSON.stringify(apiCalls, null, 2));

  } catch (err) {
    console.error('TEST ERROR:', err);
  } finally {
    await browser.close();
  }
}

runTest().catch(console.error);