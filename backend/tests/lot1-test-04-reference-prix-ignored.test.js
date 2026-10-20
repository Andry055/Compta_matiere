'use strict';

/**
 * Lot 1 Test 4: Reference and prix ignored from client
 * Une référence ou une valeur_unitaire envoyée par le client est ignorée : la
 * référence est générée par le serveur et le montant vient de la fiche.
 *
 * Les contrôles sont EXERCÉS RÉELLEMENT sur `preparerSortie()` puis
 * `creerSortieEtLignes()` (`src/utils/creationSortie.js`) : on vérifie ce que
 * l'ordre enregistré contient réellement, plus la présence d'une chaîne dans
 * une source.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const {
  preparerSortie,
  creerSortieEtLignes,
} = require('../src/utils/creationSortie');
const { creerAppFaux, ficheStock } = require('./aide-creation-sortie');

/** Corps valide, avec une référence et un prix impostés par le client. */
function corpsValide(overrides = {}) {
  return {
    date_sortie: '2026-10-20',
    justificatif: 'DEM-2026-001',
    direction_id: 'dir-1',
    // Le client tente d'imposer SA référence et SON prix : ils doivent être
    // ignorés (la référence est générée, le prix vient de la fiche).
    reference: 'SOR-2026-999',
    valeur_unitaire: 1,
    lignes: [{ materiel_id: 'mat-1', quantite: 2 }],
    ...overrides,
  };
}

test('Lot 1.4 - Reference ignored: body.reference is ignored', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const prepare = await preparerSortie(app, corpsValide());
  const sortie = await creerSortieEtLignes(app, prepare);

  assert.notStrictEqual(
    sortie.reference,
    'SOR-2026-999',
    'la référence du client ne doit jamais être retenue'
  );
  assert.match(
    sortie.reference,
    /^SOR-\d{4}-\d{3}$/,
    'la référence est générée par le serveur au format SOR-AAAA-NNN'
  );
});

test('Lot 1.4 - Reference generated with collision handling', async () => {
  // Un ordre occupe déjà le numéro 001 : le numéro suivant doit être pris.
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100)],
    sorties: [{ documentId: 'sor-1', reference: 'SOR-2026-001', demande: null }],
  });
  const prepare = await preparerSortie(app, corpsValide());
  const sortie = await creerSortieEtLignes(app, prepare);

  assert.strictEqual(sortie.reference, 'SOR-2026-002');
});

test('Lot 1.4 - Prix ignored: client valeur_unitaire is ignored', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 250)] });
  const prepare = await preparerSortie(app, corpsValide({ valeur_unitaire: 1 }));
  await creerSortieEtLignes(app, prepare);

  const ligne = app.etat.lignes[0];
  assert.strictEqual(
    ligne.valeur_unitaire,
    250,
    'le prix vient de la fiche de stock, jamais du client'
  );
});

test('Lot 1.4 - Prix taken from material file', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 250)] });
  const prepare = await preparerSortie(app, corpsValide());
  await creerSortieEtLignes(app, prepare);

  assert.strictEqual(app.etat.lignes[0].valeur_unitaire, 250);
});

test('Lot 1.4 - Montant field added and calculated', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 250)] });
  const prepare = await preparerSortie(app, corpsValide());
  await creerSortieEtLignes(app, prepare);

  // 2 × 250 = 500, calculé par le serveur.
  assert.strictEqual(app.etat.lignes[0].montant, 500);
});

test('Lot 1.4 - Validation: valeur unitaire must be > 0', async () => {
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
});
