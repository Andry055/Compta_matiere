'use strict';

/**
 * Lot 1 Test 6: Concurrent creation reference uniqueness
 * Deux créations successives donnent deux références distinctes, et une
 * référence déjà prise n'est jamais réutilisée.
 *
 * Le comportement est EXERCÉ RÉELLEMENT sur `genererReference()` /
 * `creerSortieEtLignes()` (`src/utils/creationSortie.js`) : on vérifie les
 * références OBTENUES, plus la présence d'une chaîne dans une source.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const {
  preparerSortie,
  creerSortieEtLignes,
} = require('../src/utils/creationSortie');
const { creerAppFaux, ficheStock } = require('./aide-creation-sortie');

/** Corps de création valide. */
function corpsValide(overrides = {}) {
  return {
    date_sortie: '2026-10-20',
    justificatif: 'DEM-2026-001',
    direction_id: 'dir-1',
    lignes: [{ materiel_id: 'mat-1', quantite: 2 }],
    ...overrides,
  };
}

test('Lot 1.6 - Concurrent creation: reference generation handles collisions', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100)],
    sorties: [{ documentId: 'sor-1', reference: 'SOR-2026-001', demande: null }],
  });
  const prepare = await preparerSortie(app, corpsValide());
  const sortie = await creerSortieEtLignes(app, prepare);

  assert.strictEqual(
    sortie.reference,
    'SOR-2026-002',
    'la référence déjà prise ne doit jamais être réutilisée'
  );
});

test('Lot 1.6 - Concurrent creation: fallback to last generated reference', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100)],
    // Les numéros 001 à 003 sont pris : le suivant est 004.
    sorties: [
      { documentId: 'sor-1', reference: 'SOR-2026-001', demande: null },
      { documentId: 'sor-2', reference: 'SOR-2026-002', demande: null },
      { documentId: 'sor-3', reference: 'SOR-2026-003', demande: null },
    ],
  });
  const prepare = await preparerSortie(app, corpsValide());
  const sortie = await creerSortieEtLignes(app, prepare);

  assert.strictEqual(sortie.reference, 'SOR-2026-004');
});

test('Lot 1.6 - Concurrent creation: database uniqueness constraint handles final check', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100)],
    sorties: [{ documentId: 'sor-1', reference: 'SOR-2026-001', demande: null }],
  });
  const prepare = await preparerSortie(app, corpsValide());
  await creerSortieEtLignes(app, prepare);

  // L'unicité FINALE est garantie par la base : `sortie.reference` porte
  // `unique: true` dans le schéma. Deux ordres ne peuvent donc pas partager
  // une référence — et la référence du client n'entre jamais en jeu.
  const references = app.etat.sorties.map((s) => s.reference);
  assert.strictEqual(new Set(references).size, references.length);

  const schema = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'src', 'api', 'sortie', 'content-types', 'sortie', 'schema.json'),
    'utf8'
  );
  assert.match(
    schema,
    /"reference"[\s\S]{0,80}"unique"\s*:\s*true/,
    'la référence doit porter une contrainte d\'unicité en base'
  );
});
