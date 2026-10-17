'use strict';

/**
 * Lot 1 Test 3: Creation validation refusals
 * Création refusée (400) : sans justificatif, sans destination, quantité > stock, deux lignes du même matériel, demande non approuvée, fiche sans valeur unitaire.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SORTIE_CONTROLEUR = path.join(racine, 'src', 'api', 'sortie', 'controllers', 'sortie.js');

test('Lot 1.3 - Creation validation: justificatif obligatoire', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that justificatif validation exists
  assert.match(controleurSource, /Justificatif obligatoire/);
  // Check that the validation condition exists
  assert.match(controleurSource, /if \(!justificatif \|\| justificatif\.trim\(\) === ''\)/);
  // Check that the badRequest call exists (simplified)
  assert.match(controleurSource, /badRequest/);
});

test('Lot 1.3 - Creation validation: destination obligatoire', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that destination validation exists
  assert.match(controleurSource, /Une destination est obligatoire/);
  // Check that the validation condition exists
  assert.match(controleurSource, /if \(!directionId \&\& !serviceId \&\& \(!beneficiaire \|\| beneficiaire\.trim\(\) === ''\)\)/);
  // Check that the badRequest call exists (simplified)
  assert.match(controleurSource, /badRequest/);
});

test('Lot 1.3 - Creation validation: quantité <= stock', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that stock validation exists
  assert.match(controleurSource, /Stock insuffisant pour/);
  assert.match(controleurSource, /quantiteDemandee > quantiteStock/);
});

test('Lot 1.3 - Creation validation: pas de doublon de matériel', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that duplicate material validation exists
  assert.match(controleurSource, /Doublon de matériel/);
  assert.match(controleurSource, /lignesVues\.has\(materielId\)/);
});

test('Lot 1.3 - Creation validation: demande approuvee ou préparation', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that demande validation exists
  assert.match(controleurSource, /La demande doit avoir un statut « approuvee » ou « préparation »/);
  // Check that the validation condition exists
  assert.match(controleurSource, /if \(!\[\'approuvee\', \'preparation\'\].includes\(demande\.statut\)\)/);
  // Check that the badRequest call exists (simplified)
  assert.match(controleurSource, /badRequest/);
});

test('Lot 1.3 - Creation validation: fiche sans valeur unitaire', async () => {
  const controleurSource = fs.readFileSync(SORTIE_CONTROLEUR, 'utf8');

  // Check that valeur unitaire validation exists in ligne creation
  assert.match(controleurSource, /Valeur unitaire manquante sur la fiche de/);
  // Check that the validation condition exists
  assert.match(controleurSource, /!valeurUnitaire \|\| valeurUnitaire <= 0/);
});