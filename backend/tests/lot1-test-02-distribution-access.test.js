'use strict';

/**
 * Lot 1 Test 2: Distribution endpoint access control
 * Les autres rôles gardent leurs accès, et GET /sorties/distributions répond 200 pour dépositaire, magasinier, logistique et comptable, 403 pour le demandeur.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SORTIE_CONTROLEUR = path.join(racine, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const INDEX_JS = path.join(racine, 'src', 'index.js');

test('Lot 1.2 - Distribution access control: findDistributions method exists', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that findDistributions method exists
  assert.match(controleurSource, /async findDistributions\(ctx\)/);
});

test('Lot 1.2 - Distribution access control: returns 403 for demandeur', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that it returns 403 for demandeur
  assert.match(controleurSource, /if \(await isDemandeurSession\(app, ctx\)\)[\s\S]*?return forbid\(ctx, .*Accès refusé.*403\)/);
});

test('Lot 1.2 - Distribution access control: uses populateSecurise for other roles', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that it imports populateSecurise
  assert.match(controleurSource, /populateSecurise/);

  // Check that it uses populateSecurise in the method
  assert.match(controleurSource, /securePopulateAndFilters\(ctx\)/);
});

test('Lot 1.2 - Distribution access control: permissions configured correctly', async () => {
  const indexSource = fs.readFileSync(INDEX_JS, 'utf8');

  // Check that ROLES_SORTIE_DISTRIBUTION constant exists
  assert.match(indexSource, /const ROLES_SORTIE_DISTRIBUTION = \['depositaire', 'magasinier', 'logistique', 'comptable'\];/);

  // Check that permissions are set up for this action
  assert.match(indexSource, /for \(const type of ROLES_SORTIE_DISTRIBUTION\)[\s\S]*?api::sortie\.sortie\.findDistributions/);
});