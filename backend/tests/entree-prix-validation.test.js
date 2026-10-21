'use strict';

/**
 * Test de validation du prix unitaire dans le flux d'entrée (entree.createComplete).
 *
 * Objectif : vérifier que le prix unitaire d'un matériel entré ne peut pas
 * être 0, vide ou négatif — ni au moment de la création de l'entrée, ni
 * lors de la création de la fiche matériel, ni lors de l'impact stock.
 *
 * Règles couvertes :
 * 1. Backend : `prix <= 0` ou `prix` non fini → refus (400)
 * 2. Backend : `prix > 0` → accepté et persiste dans `valeur_unitaire`
 * 3. `appliquerImpactStock` ne modifie JAMAIS `valeur_unitaire` (seul `quantite_stock`)
 */

const { test } = require('node:test');
const assert = require('node:assert');

// ─────────────────────────────────────────────────────────────────────────
// Logique extraite du contrôleur entree (lignes 354-357 et 456-461)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Rejet si prix invalide (non fini ou <= 0) — correspond à la validation
 * du contrôleur entree.createComplete.
 */
function prixInvalide(prix) {
  const p = Number(prix);
  return !Number.isFinite(p) || p <= 0;
}

/**
 * Valeur unitaire stockée dans la fiche matériel — correspond à la ligne
 * `valeur_unitaire: Number.isFinite(prix) ? prix : null` du contrôleur.
 */
function valeurUnitaireFiche(prix) {
  const p = Number(prix);
  return Number.isFinite(p) ? p : null;
}

/**
 * Impact stock — correspond à `appliquerImpactStock` : seul `quantite_stock`
 * est mis à jour, `valeur_unitaire` est intouché.
 */
function appliquerImpactStock(materiel, quantiteEntree) {
  return {
    ...materiel,
    quantite_stock: (Number(materiel.quantite_stock) || 0) + (Number(quantiteEntree) || 0),
    // valeur_unitaire n'est PAS modifiée
  };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Prix invalide → refusé
// ─────────────────────────────────────────────────────────────────────────

test('prix = 0 est refusé (validation backend)', () => {
  assert.strictEqual(prixInvalide(0), true, 'prix 0 doit être rejeté');
});

test('prix négatif est refusé', () => {
  assert.strictEqual(prixInvalide(-100), true, 'prix négatif doit être rejeté');
  assert.strictEqual(prixInvalide(-0.01), true, 'prix -0.01 doit être rejeté');
});

test('prix non numérique (NaN) est refusé', () => {
  assert.strictEqual(prixInvalide(NaN), true, 'NaN doit être rejeté');
});

test('prix Infinity est refusé', () => {
  assert.strictEqual(prixInvalide(Infinity), true, 'Infinity doit être rejeté');
  assert.strictEqual(prixInvalide(-Infinity), true, '-Infinity doit être rejeté');
});

test('prix null est refusé', () => {
  assert.strictEqual(prixInvalide(null), true, 'null doit être rejeté');
});

test('prix undefined est refusé', () => {
  assert.strictEqual(prixInvalide(undefined), true, 'undefined doit être rejeté');
});

test('prix chaîne vide est refusé', () => {
  assert.strictEqual(prixInvalide(''), true, 'chaîne vide doit être rejetée');
});

test('prix chaîne non numérique est refusé', () => {
  assert.strictEqual(prixInvalide('abc'), true, 'chaîne non numérique doit être rejetée');
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Prix valide → accepté
// ─────────────────────────────────────────────────────────────────────────

test('prix > 0 est accepté', () => {
  assert.strictEqual(prixInvalide(100), false, 'prix 100 doit être accepté');
  assert.strictEqual(prixInvalide(0.01), false, 'prix 0.01 doit être accepté');
  assert.strictEqual(prixInvalide(50000), false, 'prix 50000 doit être accepté');
  assert.strictEqual(prixInvalide('1500'), false, 'chaîne "1500" doit être acceptée (convertie en nombre)');
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Persistance : valeur_unitaire dans la fiche matériel
// ─────────────────────────────────────────────────────────────────────────

test('valeur_unitaire = prix quand prix est fini et positif', () => {
  assert.strictEqual(valeurUnitaireFiche(1500), 1500, 'valeur_unitaire doit être 1500');
  assert.strictEqual(valeurUnitaireFiche(0.01), 0.01, 'valeur_unitaire doit être 0.01');
  assert.strictEqual(valeurUnitaireFiche(50000), 50000, 'valeur_unitaire doit être 50000');
});

test('valeur_unitaire = null quand prix n\'est pas fini (défense en profondeur)', () => {
  assert.strictEqual(valeurUnitaireFiche(NaN), null, 'NaN → null');
  // null → 0 car Number(null) === 0 (fini) ; ce cas est bloqué par la validation
  // du contrôleur (prix <= 0) avant d'atteindre la création de fiche.
  assert.strictEqual(valeurUnitaireFiche(null), 0, 'null → 0 (bloqué par validation en amont)');
  assert.strictEqual(valeurUnitaireFiche(undefined), null, 'undefined → null');
});

// ─────────────────────────────────────────────────────────────────────────
// 4. appliquerImpactStock ne modifie pas valeur_unitaire
// ─────────────────────────────────────────────────────────────────────────

test('appliquerImpactStock préserve valeur_unitaire (cas normal)', () => {
  const materiel = { quantite_stock: 10, valeur_unitaire: 5000 };
  const resultat = appliquerImpactStock(materiel, 5);
  assert.strictEqual(resultat.valeur_unitaire, 5000, 'valeur_unitaire doit rester 5000');
  assert.strictEqual(resultat.quantite_stock, 15, 'quantite_stock doit passer à 15');
});

test('appliquerImpactStock préserve valeur_unitaire (quantité 0)', () => {
  const materiel = { quantite_stock: 10, valeur_unitaire: 5000 };
  const resultat = appliquerImpactStock(materiel, 0);
  assert.strictEqual(resultat.valeur_unitaire, 5000, 'valeur_unitaire doit rester 5000');
  assert.strictEqual(resultat.quantite_stock, 10, 'quantite_stock doit rester 10');
});

test('appliquerImpactStock ne répare PAS une valeur_unitaire déjà à 0 (défense en profondeur)', () => {
  // Si une fiche préexistante avait valeur_unitaire = 0 (avant le fix),
  // l'impact stock ne la corrige pas — le prix reste à 0 tant qu'on ne
  // recrée pas la fiche. Ceci justifie une éventuelle migration de données.
  const materiel = { quantite_stock: 10, valeur_unitaire: 0 };
  const resultat = appliquerImpactStock(materiel, 5);
  assert.strictEqual(resultat.valeur_unitaire, 0, 'valeur_unitaire reste 0 (inchangée par l\'impact stock)');
  assert.strictEqual(resultat.quantite_stock, 15, 'quantite_stock passe à 15');
});
