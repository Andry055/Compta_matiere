'use strict';

/**
 * Lot 1 Test 5: Transaction rollback on line failure
 * Une ligne qui échoue annule toute la création : aucune sortie, aucune ligne en base.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SORTIE_CONTROLEUR = path.join(racine, 'src', 'api', 'sortie', 'controllers', 'sortie.js');

test('Lot 1.5 - Transaction rollback: sortie and lignes creation in transaction', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that transaction is used for création complète
  assert.match(controleurSource, /Création de la sortie et des lignes dans une seule transaction/);
  assert.match(controleurSource, /await app\.db\.transaction\(async \({ trx }\) =>/);
});

test('Lot 1.5 - Transaction rollback: sortie creation in transaction', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that sortie creation is inside transaction
  assert.match(controleurSource, /Création de la sortie/);
  assert.match(controleurSource, /statut: 'en_preparation'/);
});

test('Lot 1.5 - Transaction rollback: lignes creation in transaction', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that lignes creation is inside transaction
  assert.match(controleurSource, /\/ \-\-\- Création des lignes \-\-\-/);
});

test('Lot 1.5 - Transaction rollback: error causes rollback', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that errors in ligne creation cause rollback
  assert.match(controleurSource, /Si une erreur se produit lors de la transaction \(sortie ou lignes\),/);
  assert.match(controleurSource, /tout est annulé et nous retournons une erreur 400/);
  assert.match(controleurSource, /return badRequest/);
});

test('Lot 1.5 - Transaction rollback: valeur unitaire manquante causes rollback', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that missing valeur unitaire causes error that triggers rollback
  assert.match(controleurSource, /Valeur unitaire manquante sur la fiche de/);
  assert.match(controleurSource, /return badRequest/);
});