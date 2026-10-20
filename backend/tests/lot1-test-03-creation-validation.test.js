'use strict';

/**
 * Lot 1 Test 3: Creation validation refusals
 * Création refusée (400) : sans justificatif, sans destination, quantité > stock,
 * deux lignes du même matériel, demande non approuvée, fiche sans valeur unitaire.
 *
 * Ces contrôles sont EXERCÉS RÉELLEMENT sur `preparerSortie()`
 * (`src/utils/creationSortie.js`) : la logique de création est aujourd'hui
 * partagée par les deux portes (formulaire classique et création depuis une
 * demande approuvée), et elle est testée par son EFFET (le refus), plus par
 * la présence d'une chaîne dans une source.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { preparerSortie } = require('../src/utils/creationSortie');
const { creerAppFaux, ficheStock } = require('./aide-creation-sortie');

/** Corps de creation valide, à modifier par chaque test. */
function corpsValide(overrides = {}) {
  return {
    date_sortie: '2026-10-20',
    justificatif: 'DEM-2026-001',
    direction_id: 'dir-1',
    lignes: [{ materiel_id: 'mat-1', quantite: 2 }],
    ...overrides,
  };
}

/** Appelle `preparerSortie` et renvoie l'erreur métier levée. */
async function refusAttendu(app, body) {
  try {
    await preparerSortie(app, body);
  } catch (e) {
    return e;
  }
  throw new Error('preparerSortie aurait dû refuser cette création');
}

test('Lot 1.3 - Creation validation: justificatif obligatoire', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const erreur = await refusAttendu(app, corpsValide({ justificatif: '   ' }));

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Justificatif obligatoire/);
});

test('Lot 1.3 - Creation validation: destination obligatoire', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const erreur = await refusAttendu(
    app,
    corpsValide({ direction_id: null, service_id: null })
  );

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Une destination est obligatoire/);
});

test('Lot 1.3 - Creation validation: quantité <= stock', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 1, 100)] });
  const erreur = await refusAttendu(
    app,
    corpsValide({ lignes: [{ materiel_id: 'mat-1', quantite: 5 }] })
  );

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Stock insuffisant pour/);
  assert.match(erreur.message, /quantité demandée 5/);
});

test('Lot 1.3 - Creation validation: pas de doublon de matériel', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const erreur = await refusAttendu(
    app,
    corpsValide({
      lignes: [
        { materiel_id: 'mat-1', quantite: 1 },
        { materiel_id: 'mat-1', quantite: 2 },
      ],
    })
  );

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Doublon de matériel/);
});

test('Lot 1.3 - Creation validation: demande approuvee ou préparation', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 100)],
    demandes: [{ documentId: 'dem-1', reference: 'DEM-2026-001', statut: 'en_attente' }],
  });
  const erreur = await refusAttendu(
    app,
    corpsValide({ demande_id: 'dem-1' })
  );

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /La demande doit avoir un statut/);
});

test('Lot 1.3 - Creation validation: fiche sans valeur unitaire', async () => {
  const app = creerAppFaux({
    materiaux: [ficheStock('mat-1', 'Écran', 10, 0)],
  });
  const erreur = await refusAttendu(app, corpsValide());

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Valeur unitaire manquante sur la fiche de/);
});

test('Lot 1.3 - Creation validation: quantité invalide refusée', async () => {
  const app = creerAppFaux({ materiaux: [ficheStock('mat-1', 'Écran', 10, 100)] });
  const erreur = await refusAttendu(
    app,
    corpsValide({ lignes: [{ materiel_id: 'mat-1', quantite: 0 }] })
  );

  assert.strictEqual(erreur.status, 400);
  assert.match(erreur.message, /Quantité invalide/);
});
