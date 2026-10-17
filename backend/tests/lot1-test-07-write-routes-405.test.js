'use strict';

/**
 * Lot 1 Test 7: Write routes return 405 for sortie-ligne and mouvement
 * POST, PUT et DELETE sur /api/sortie-lignes et /api/mouvements renvoient 405.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SORTIE_LIGNE_ROUTES = path.join(racine, 'src', 'api', 'sortie-ligne', 'routes', 'sortie-ligne.js');
const MOUVEMENT_ROUTES = path.join(racine, 'src', 'api', 'mouvement', 'routes', 'mouvement.js');

test('Lot 1.7 - Sortie-ligne routes: only GET routes defined', async () => {
  const routesSource = fs.readFileSync(SORTIE_LIGNE_ROUTES, 'utf8');

  // Check that only GET routes are defined in the routes array
  assert.match(routesSource, /method: 'GET'/);
  assert.match(routesSource, /path: '\/sortie-lignes'/);
  assert.match(routesSource, /path: '\/sortie-lignes\/:id'/);

  // Check that no POST, PUT, PATCH, DELETE routes are defined
  assert.strictEqual(/method: 'POST'/.test(routesSource), false);
  assert.strictEqual(/method: 'PUT'/.test(routesSource), false);
  assert.strictEqual(/method: 'PATCH'/.test(routesSource), false);
  assert.strictEqual(/method: 'DELETE'/.test(routesSource), false);
});

test('Lot 1.7 - Mouvement routes: only GET routes defined', async () => {
  const routesSource = fs.readFileSync(MOUVEMENT_ROUTES, 'utf8');

  // Check that only GET routes are defined in the routes array
  assert.match(routesSource, /method: 'GET'/);
  assert.match(routesSource, /path: '\/mouvements'/);
  assert.match(routesSource, /path: '\/mouvements\/:id'/);

  // Check that no POST, PUT, PATCH, DELETE routes are defined
  assert.strictEqual(/method: 'POST'/.test(routesSource), false);
  assert.strictEqual(/method: 'PUT'/.test(routesSource), false);
  assert.strictEqual(/method: 'PATCH'/.test(routesSource), false);
  assert.strictEqual(/method: 'DELETE'/.test(routesSource), false);
});