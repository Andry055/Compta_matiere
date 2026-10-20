'use strict';

/**
 * Lot 1 Test 5: Transaction rollback on line failure
 * Une ligne qui échoue annule toute la création : aucune sortie, aucune ligne
 * en base.
 *
 * Le rollback est EXERCÉ RÉELLEMENT sur `creerSortieEtLignes()`
 * (`src/utils/creationSortie.js`) : on vérifie l'état de la base APRÈS
 * l'échec (sortie absente, lignes absentes), plus la présence d'une chaîne
 * dans une source.
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

test('Lot 1.5 - Transaction rollback: sortie and lignes creation in transaction', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const prepare = await preparerSortie(app, corpsValide());
  const sortie = await creerSortieEtLignes(app, prepare);

  assert.ok(sortie, 'la création doit aboutir');
  assert.strictEqual(app.etat.sorties.length, 1);
  assert.strictEqual(app.etat.lignes.length, 1);
});

test('Lot 1.5 - Transaction rollback: sortie creation in transaction', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const prepare = await preparerSortie(app, corpsValide());
  const sortie = await creerSortieEtLignes(app, prepare);

  // L'ordre démarre « en_preparation » : impossible de fabriquer un ordre
  // déjà signé ou déjà validé.
  assert.strictEqual(sortie.statut, 'en_preparation');
  assert.strictEqual(sortie.magasinier_signed, undefined);
});

test('Lot 1.5 - Transaction rollback: lignes creation in transaction', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100), ficheStock('mat-2', 'Clavier', 10, 50)],
  });
  const prepare = await preparerSortie(
    app,
    corpsValide({
      lignes: [
        { materiel_id: 'mat-1', quantite: 1 },
        { materiel_id: 'mat-2', quantite: 3 },
      ],
    })
  );
  await creerSortieEtLignes(app, prepare);

  assert.strictEqual(app.etat.lignes.length, 2, 'les deux lignes doivent être créées');
  assert.strictEqual(app.etat.lignes[1].quantite, 3);
});

test('Lot 1.5 - Transaction rollback: error causes rollback', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100)],
    transactionCasse: true,
  });
  const prepare = await preparerSortie(app, corpsValide());

  let erreur = null;
  try {
    await creerSortieEtLignes(app, prepare);
  } catch (e) {
    erreur = e;
  }

  assert.ok(erreur, 'l’échec de la transaction doit être remonté');
  assert.strictEqual(erreur.status, 400);
  // ROLLBACK : rien ne doit subsister.
  assert.strictEqual(app.etat.sorties.length, 0, 'aucune sortie ne doit subsister');
  assert.strictEqual(app.etat.lignes.length, 0, 'aucune ligne ne doit subsister');
});

test('Lot 1.5 - Transaction rollback: valeur unitaire manquante causes rollback', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 0)] });

  let erreur = null;
  try {
    await preparerSortie(app, corpsValide());
  } catch (e) {
    erreur = e;
  }

  assert.ok(erreur, 'une fiche sans valeur unitaire doit être refusée');
  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Valeur unitaire manquante sur la fiche de/);
  // Le refus intervient AVANT toute écriture.
  assert.strictEqual(app.etat.sorties.length, 0);
  assert.strictEqual(app.etat.lignes.length, 0);
});
