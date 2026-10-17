'use strict';

/**
 * Lot 1 Test 1: Demandeur isolation
 * Vérifie que le contrôleur de sortie utilise correctement populateSecurise pour les demandeurs
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SORTIE_CONTROLEUR = path.join(racine, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const POPULATE_SECURISE = path.join(racine, 'src', 'utils', 'populateSecurise.js');

test('Lot 1.1 - Demandeur isolation: populateSecurise is used in sortie controller', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');
  const populateSecuriseSource = fs.readFileSync(POPULATE_SECURISE, 'utf8');

  // Check that the controller imports and uses populateSecurise
  assert.match(controleurSource, /populateSecurise/);
  assert.match(populateSecuriseSource, /securePopulateAndFilters/);

  // Check that it's used in find method for demandeur
  assert.match(controleurSource, /if \(await isDemandeurSession\(app, ctx\)\)[\s\S]*?securePopulateAndFilters\(ctx\)/);

  // Check that it's used in findOne method for demandeur
  assert.match(controleurSource, /if \(await isDemandeurSession\(app, ctx\)\)[\s\S]*?securePopulateAndFilters\(ctx\)/);
});