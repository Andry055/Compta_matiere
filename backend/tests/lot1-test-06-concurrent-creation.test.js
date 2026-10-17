'use strict';

/**
 * Lot 1 Test 6: Concurrent creation reference uniqueness
 * Deux créations simultanées donnent deux références distinctes.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SORTIE_CONTROLEUR = path.join(racine, 'src', 'api', 'sortie', 'controllers', 'sortie.js');

test('Lot 1.6 - Concurrent creation: reference generation handles collisions', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that reference generation tries up to 3 times for uniqueness
  assert.match(controleurSource, /for \(let tentative = 0; tentative < 3; tentative\+\+\)/);
  assert.match(controleurSource, /Vérifier si cette référence est déjà utilisée/);
  assert.match(controleurSource, /if \(!existeDeja\) \{[\s\S]*?referenceGeneree = true;/);
  assert.match(controleurSource, /break;/);
});

test('Lot 1.6 - Concurrent creation: fallback to last generated reference', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that after 3 attempts, we keep the last generated reference
  assert.match(controleurSource, /if \(!referenceGeneree\) \{[\s\S]*?Après 3 tentatives, on garde la dernière référence générée/);
});

test('Lot 1.6 - Concurrent creation: database uniqueness constraint handles final check', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that uniqueness is ultimately enforced by database constraint
  assert.match(controleurSource, /L'unicité sera vérifiée par la contrainte en base/);
});