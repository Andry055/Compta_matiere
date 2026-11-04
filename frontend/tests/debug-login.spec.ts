import { test, expect } from '@playwright/test';

test('debug login and page', async ({ page }) => {
  // Capture all console output
  const logs: string[] = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => logs.push('ERROR: ' + err.message));

  // Network monitoring
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

  // Get page content
  const content = await page.textContent('body');
  const url = page.url();
  const h1s = await page.locator('h1').allTextContents();

  // Output everything
  console.log('=== URL ===');
  console.log(url);
  console.log('=== H1s ===');
  console.log(JSON.stringify(h1s));
  console.log('=== CONTENT (first 4000) ===');
  console.log(content?.substring(0, 4000));
  console.log('=== API CALLS ===');
  console.log(JSON.stringify(apiCalls));
  console.log('=== BROWSER LOGS ===');
  console.log(logs.join('\n'));

  // Screenshot
  await page.screenshot({ path: 'test-results/debug-full.png', fullPage: true });

  // Always pass
  expect(true).toBe(true);
});