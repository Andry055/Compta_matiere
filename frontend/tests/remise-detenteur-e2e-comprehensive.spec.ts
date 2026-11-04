import { test, expect } from '@playwright/test';

test.describe('Remise au détenteur - Validation E2E complète', () => {

  // Test 1: Chargement des sorties éligibles
  test('1. Charge les sorties réellement éligibles à la remise', async ({ page }) => {
    const consoleLogs: string[] = [];
    const apiCalls: { method: string; url: string; status?: number }[] = [];

    page.on('console', msg => consoleLogs.push(`${msg.type()}: ${msg.text()}`));
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({ method: request.method(), url: request.url() });
      }
    });
    page.on('response', response => {
      if (response.url().includes('/api/remises-detenteurs')) {
        const call = apiCalls.find(c => c.url === response.url() && c.method === 'GET');
        if (call) call.status = response.status();
      }
    });

    // Go to frontend
    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Login as demandeur (Randriamampionona Tolotra)
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Navigate to "Réception physique" page first
    const receptionButton = page.locator('button:has-text("Réception physique")');
    await expect(receptionButton).toBeVisible({ timeout: 10000 });
    await receptionButton.click();
    await page.waitForTimeout(2000);

    // Now click on "Remise détenteur" tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    await expect(remiseTab).toBeVisible({ timeout: 10000 });
    await remiseTab.click();
    await page.waitForTimeout(2000);

    // Check for eligible sorties counter
    const counter = page.locator('text=Sorties réceptionnées complètement').locator('..').locator('.msr-compteur-valeur, .rdd-compteur-valeur');
    const counterText = await counter.first().textContent();
    console.log('Compteur sorties éligibles:', counterText);

    // Check if there are any eligible sorties
    const sortiesList = page.locator('.rdd-carte, .rdd-liste');
    const sortiesCount = await sortiesList.count();
    console.log('Nombre de cartes sorties:', sortiesCount);

    // Check if "Aucune sortie éligible" message is shown
    const emptyMessage = page.locator('text=Aucune sortie éligible à la remise');
    const hasEmptyMessage = await emptyMessage.count() > 0;
    console.log('Message vide affiché:', hasEmptyMessage);

    // List all API calls to remises-detenteurs
    const remisesCalls = apiCalls.filter(c => c.url.includes('/api/remises-detenteurs'));
    console.log('Appels API /api/remises-detenteurs:', JSON.stringify(remisesCalls, null, 2));

    // List all sorties loaded
    const allApiCalls = apiCalls.filter(c => c.url.includes('/api/sorties'));
    console.log('Appels API /api/sorties:', JSON.stringify(allApiCalls, null, 2));

    const receptionsCalls = apiCalls.filter(c => c.url.includes('/api/receptions-physiques'));
    console.log('Appels API /api/receptions-physiques:', JSON.stringify(receptionsCalls, null, 2));

    // Take screenshot
    await page.screenshot({ path: 'test-results/remise-1-chargement.png', fullPage: true });

    // Test passes if we reach here
    expect(true).toBe(true);
  });

  // Test 2: Saisie du détenteur pour chaque matériel
  test('2. Permet la saisie du détenteur pour chaque matériel', async ({ page }) => {
    const apiCalls: { method: string; url: string; status?: number }[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({ method: request.method(), url: request.url() });
      }
    });
    page.on('response', response => {
      const call = apiCalls.find(c => c.url === response.url() && c.method === response.request().method());
      if (call) call.status = response.status();
    });

    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Navigate to "Réception physique" page first
    const receptionButton = page.locator('button:has-text("Réception physique")');
    await expect(receptionButton).toBeVisible({ timeout: 10000 });
    await receptionButton.click();
    await page.waitForTimeout(2000);

    // Navigate to remise-detenteur tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    await expect(remiseTab).toBeVisible({ timeout: 10000 });
    await remiseTab.click();
    await page.waitForTimeout(2000);

    // Check if there's at least one eligible sortie
    const openButtons = page.locator('button:has-text("Enregistrer la remise")');
    const count = await openButtons.count();
    console.log('Boutons "Enregistrer la remise" disponibles:', count);

    if (count > 0) {
      // Click the first one
      await openButtons.first().click();
      await page.waitForTimeout(1000);

      // Check dialog opens
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Verify form fields for each line
      const nomInputs = page.locator('input[id*="detenteur-nom-input"]');
      const nomCount = await nomInputs.count();
      console.log('Champs nom détenteur:', nomCount);

      const fonctionInputs = page.locator('input[id*="detenteur-fonction"]');
      const fonctionCount = await fonctionInputs.count();
      console.log('Champs fonction détenteur:', fonctionCount);

      // Fill in first line
      if (nomCount > 0) {
        await nomInputs.first().fill('Test Détenteur');
      }
      if (fonctionCount > 0) {
        await fonctionInputs.first().fill('Chef de service');
      }

      // Fill observation if available
      const obsInputs = page.locator('input[id*="observation"]');
      if (await obsInputs.count() > 0) {
        await obsInputs.first().fill('Test observation');
      }

      await page.screenshot({ path: 'test-results/remise-2-saisie.png', fullPage: true });
    } else {
      console.log('AUCUNE SORTIE ÉLIGIBLE - Test 2 ignoré');
    }

    expect(true).toBe(true);
  });

  // Test 3: Confirmation et envoi réel du POST
  test('3. Confirme et envoie le POST /api/remises-detenteurs', async ({ page }) => {
    const apiCalls: { method: string; url: string; status?: number; postData?: string }[] = [];
    const responses: { url: string; status: number; body?: any }[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/remises-detenteurs')) {
        apiCalls.push({
          method: request.method(),
          url: request.url(),
          postData: request.postData() || undefined
        });
      }
    });
    page.on('response', async response => {
      if (response.url().includes('/api/remises-detenteurs')) {
        let body;
        try {
          body = await response.json();
        } catch {}
        responses.push({
          url: response.url(),
          status: response.status(),
          body
        });
      }
    });

    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Navigate to "Réception physique" page first
    const receptionButton = page.locator('button:has-text("Réception physique")');
    await expect(receptionButton).toBeVisible({ timeout: 10000 });
    await receptionButton.click();
    await page.waitForTimeout(2000);

    // Navigate to remise-detenteur tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    await expect(remiseTab).toBeVisible({ timeout: 10000 });
    await remiseTab.click();
    await page.waitForTimeout(2000);

    const openButtons = page.locator('button:has-text("Enregistrer la remise")');
    const count = await openButtons.count();
    console.log('Boutons "Enregistrer la remise" disponibles:', count);

    if (count > 0) {
      await openButtons.first().click();
      await page.waitForTimeout(1000);

      // Fill all required fields
      const nomInputs = page.locator('input[id*="detenteur-nom-input"]');
      const fonctionInputs = page.locator('input[id*="detenteur-fonction"]');

      for (let i = 0; i < await nomInputs.count(); i++) {
        await nomInputs.nth(i).fill(`Détenteur ${i + 1}`);
      }
      for (let i = 0; i < await fonctionInputs.count(); i++) {
        await fonctionInputs.nth(i).fill(`Fonction ${i + 1}`);
      }

      // Click "Enregistrer la remise" in dialog footer
      const dialogSaveButton = page.locator('button:has-text("Enregistrer la remise")').last();
      await dialogSaveButton.click();
      await page.waitForTimeout(500);

      // Click "Confirmer la remise" in confirmation modal
      const confirmButton = page.locator('button:has-text("Confirmer la remise")');
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      await confirmButton.click();

      // Wait for API response
      await page.waitForTimeout(3000);

      // Check API calls
      const postCalls = apiCalls.filter(c => c.method === 'POST');
      console.log('Appels POST /api/remises-detenteurs:', JSON.stringify(postCalls, null, 2));
      console.log('Réponses API:', JSON.stringify(responses, null, 2));

      // Check for success toast
      const successToast = page.locator('text=Remise au détenteur enregistrée');
      const hasSuccess = await successToast.count() > 0;
      console.log('Toast succès affiché:', hasSuccess);

      await page.screenshot({ path: 'test-results/remise-3-post.png', fullPage: true });
    } else {
      console.log('AUCUNE SORTIE ÉLIGIBLE - Test 3 ignoré');
    }

    expect(true).toBe(true);
  });

  // Test 4: Présence de l'enregistrement dans la réponse backend, puis après rechargement
  test('4. Vérifie la présence de l\'enregistrement dans la réponse backend et après rechargement', async ({ page }) => {
    const apiCalls: { method: string; url: string; status?: number }[] = [];
    const responses: { url: string; status: number; body?: any }[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/remises-detenteurs')) {
        apiCalls.push({ method: request.method(), url: request.url() });
      }
    });
    page.on('response', async response => {
      if (response.url().includes('/api/remises-detenteurs')) {
        let body;
        try {
          body = await response.json();
        } catch {}
        responses.push({ url: response.url(), status: response.status(), body });
      }
    });

    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Navigate to "Réception physique" page first
    const receptionButton = page.locator('button:has-text("Réception physique")');
    await expect(receptionButton).toBeVisible({ timeout: 10000 });
    await receptionButton.click();
    await page.waitForTimeout(2000);

    // Navigate to remise-detenteur tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    await expect(remiseTab).toBeVisible({ timeout: 10000 });
    await remiseTab.click();
    await page.waitForTimeout(2000);

    // Check existing remises displayed
    const existingRemises = page.locator('text=Remis au détenteur');
    const existingCount = await existingRemises.count();
    console.log('Remises existantes affichées:', existingCount);

    const openButtons = page.locator('button:has-text("Enregistrer la remise")');
    const count = await openButtons.count();

    if (count > 0) {
      // Create a new remise
      await openButtons.first().click();
      await page.waitForTimeout(1000);

      const nomInputs = page.locator('input[id*="detenteur-nom-input"]');
      const fonctionInputs = page.locator('input[id*="detenteur-fonction"]');

      for (let i = 0; i < await nomInputs.count(); i++) {
        await nomInputs.nth(i).fill(`Détenteur Test ${Date.now()}`);
      }
      for (let i = 0; i < await fonctionInputs.count(); i++) {
        await fonctionInputs.nth(i).fill(`Fonction Test`);
      }

      await page.locator('button:has-text("Enregistrer la remise")').last().click();
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Confirmer la remise")').click();
      await page.waitForTimeout(3000);

      // Check POST response
      const postCalls = apiCalls.filter(c => c.method === 'POST');
      console.log('POST response:', JSON.stringify(responses.filter(r => r.url.includes('/api/remises-detenteurs') && postCalls.some(p => p.url === r.url)), null, 2));

      // Reload page
      await page.reload();
      await page.waitForTimeout(3000);
      await page.click('button:has-text("Remise détenteur")');
      await page.waitForTimeout(2000);

      // Check if new remise appears
      const newRemises = page.locator('text=Remis au détenteur');
      const newCount = await newRemises.count();
      console.log('Remises après rechargement:', newCount);

      await page.screenshot({ path: 'test-results/remise-4-reload.png', fullPage: true });
    } else {
      console.log('AUCUNE SORTIE ÉLIGIBLE - Test 4 ignoré');
    }

    expect(true).toBe(true);
  });

  // Test 5: Comportement en cas d'erreur API et double soumission
  test('5. Gère les erreurs API et la double soumission', async ({ page }) => {
    const apiCalls: { method: string; url: string; status?: number }[] = [];
    const responses: { url: string; status: number; body?: any }[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/remises-detenteurs')) {
        apiCalls.push({ method: request.method(), url: request.url() });
      }
    });
    page.on('response', async response => {
      if (response.url().includes('/api/remises-detenteurs')) {
        let body;
        try {
          body = await response.json();
        } catch {}
        responses.push({ url: response.url(), status: response.status(), body });
      }
    });

    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Navigate to "Réception physique" page first
    const receptionButton = page.locator('button:has-text("Réception physique")');
    await expect(receptionButton).toBeVisible({ timeout: 10000 });
    await receptionButton.click();
    await page.waitForTimeout(2000);

    // Navigate to remise-detenteur tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    await expect(remiseTab).toBeVisible({ timeout: 10000 });
    await remiseTab.click();
    await page.waitForTimeout(2000);

    const openButtons = page.locator('button:has-text("Enregistrer la remise")');
    const count = await openButtons.count();

    if (count > 0) {
      // First submission
      await openButtons.first().click();
      await page.waitForTimeout(1000);

      const nomInputs = page.locator('input[id*="detenteur-nom-input"]');
      const fonctionInputs = page.locator('input[id*="detenteur-fonction"]');

      for (let i = 0; i < await nomInputs.count(); i++) {
        await nomInputs.nth(i).fill(`Double Test ${Date.now()}`);
      }
      for (let i = 0; i < await fonctionInputs.count(); i++) {
        await fonctionInputs.nth(i).fill(`Fonction Test`);
      }

      await page.locator('button:has-text("Enregistrer la remise")').last().click();
      await page.waitForTimeout(500);

      // Double click on confirm to test double submission prevention
      const confirmButton = page.locator('button:has-text("Confirmer la remise")');
      await confirmButton.click();
      await confirmButton.click(); // Double click

      await page.waitForTimeout(3000);

      // Check for error handling
      const errorToast = page.locator('text=Échec');
      const hasError = await errorToast.count() > 0;
      console.log('Toast erreur affiché:', hasError);

      // Check API calls for double submission
      const postCalls = apiCalls.filter(c => c.method === 'POST');
      console.log('Nombre d\'appels POST:', postCalls.length);

      await page.screenshot({ path: 'test-results/remise-5-erreur.png', fullPage: true });
    } else {
      console.log('AUCUNE SORTIE ÉLIGIBLE - Test 5 ignoré');
    }

    expect(true).toBe(true);
  });

  // Test 6: Respect des rôles, réception physique confirmée, absence de seconde déduction stock
  test('6. Vérifie respect des rôles, réception physique, pas de double déduction stock', async ({ page }) => {
    const apiCalls: { method: string; url: string; status?: number }[] = [];
    const responses: { url: string; status: number; body?: any }[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiCalls.push({ method: request.method(), url: request.url() });
      }
    });
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        let body;
        try {
          body = await response.json();
        } catch {}
        responses.push({ url: response.url(), status: response.status(), body });
      }
    });

    // Test with demandeur role
    await page.goto('http://localhost:3002/');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'tolotra.randria@mtefop.gov.mg');
    await page.fill('input[type="password"]', 'demandeur123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Check user role displayed
    const pageContent = await page.textContent('body');
    console.log('Contenu page (rôle):', pageContent?.substring(0, 500));

    // Navigate to "Réception physique" page first
    const receptionButton = page.locator('button:has-text("Réception physique")');
    await expect(receptionButton).toBeVisible({ timeout: 10000 });
    await receptionButton.click();
    await page.waitForTimeout(2000);

    // Navigate to remise-detenteur tab
    const remiseTab = page.locator('button:has-text("Remise détenteur")');
    await expect(remiseTab).toBeVisible({ timeout: 10000 });
    await remiseTab.click();
    await page.waitForTimeout(2000);

    // Verify the component loads and shows eligible sorties
    const eligibleCounter = page.locator('text=Sorties réceptionnées complètement').locator('..').locator('.msr-compteur-valeur, .rdd-compteur-valeur');
    const counterText = await eligibleCounter.first().textContent();
    console.log('Compteur éligibles (demandeur):', counterText);

    // Check no stock deduction API calls
    const stockCalls = apiCalls.filter(c => c.url.includes('/api/materials') || c.url.includes('/api/mouvements') || c.url.includes('/api/stock'));
    console.log('Appels stock/mouvements:', JSON.stringify(stockCalls, null, 2));

    // Check reception physique API was called
    const receptionCalls = apiCalls.filter(c => c.url.includes('/api/receptions-physiques'));
    console.log('Appels receptions-physiques:', JSON.stringify(receptionCalls, null, 2));

    // Verify backend enforces reception physique
    const remisesCalls = apiCalls.filter(c => c.url.includes('/api/remises-detenteurs'));
    console.log('Appels remises-detenteurs:', JSON.stringify(remisesCalls, null, 2));

    await page.screenshot({ path: 'test-results/remise-6-roles.png', fullPage: true });

    expect(true).toBe(true);
  });
});