'use strict';

/**
 * Réception physique — permissions dans index.js.
 *
 * Harnais `node --test`, SANS démarrer Strapi : lit le fichier
 * `src/index.js` et vérifie la présence des listes d'actions et de rôles,
 * ainsi que leur accordement dans le bootstrap `ensureAuthSetup`.
 *
 * Engagements verrouillés :
 *   1. `RECEPTION_ACTIONS` déclarée avec les 4 actions attendues ;
 *   2. `ROLES_RECEPTION = ['depositaire']` déclarée ;
 *   3. `ANOMALIE_ACTIONS` déclarée avec les 4 actions attendues ;
 *   4. `ROLES_ANOMALIE = ['depositaire']` déclarée ;
 *   5. `JOURNAL_ACTION_ACTIONS` déclarée avec l'action find uniquement ;
 *   6. `ROLES_JOURNAL_ACTION = ['depositaire']` déclarée ;
 *   7. Dans `ensureAuthSetup`, ces actions sont accordées au rôle 'depositaire'
 *      (et à l'admin applicatif) sur le modèle du bloc remise des sorties.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const INDEX = path.join(RACINE, 'src', 'index.js');
const lire = (f) => fs.readFileSync(f, 'utf8');

/** Extrait les littéraux 'api::...' déclarés dans une const [ ... ]. */
function extraireActions(source, nomConst) {
  const debut = source.indexOf(`const ${nomConst} = [`);
  assert.notStrictEqual(debut, -1, `constante ${nomConst} introuvable`);
  const fin = source.indexOf('];', debut);
  assert.notStrictEqual(fin, -1, `fin de ${nomConst} introuvable`);
  const bloc = source.slice(debut, fin);
  return { bloc, actions: bloc.match(/'(api::[^']+)'/g).map((s) => s.slice(1, -1)) };
}

/* ────────────────────────── Listes d'actions ────────────────────────── */

test('RECEPTION_ACTIONS déclare les 4 actions attendues', () => {
  const source = lire(INDEX);
  const { actions } = extraireActions(source, 'RECEPTION_ACTIONS');
  assert.deepStrictEqual(actions, [
    'api::reception.reception.create',
    'api::reception.reception.find',
    'api::reception.reception.findOne',
    'api::reception-ligne.reception-ligne.create',
  ]);
});

test('ROLES_RECEPTION vaut exactement [\'depositaire\']', () => {
  const source = lire(INDEX);
  const debut = source.indexOf('const ROLES_RECEPTION = [');
  assert.notStrictEqual(debut, -1, 'ROLES_RECEPTION introuvable');
  const fin = source.indexOf('];', debut) + 2;
  const bloc = source.slice(debut, fin);
  assert.match(
    bloc,
    /const ROLES_RECEPTION\s*=\s*\[\s*'depositaire'\s*\]/,
    'ROLES_RECEPTION = [\'depositaire\']'
  );
});

test('ANOMALIE_ACTIONS déclare les 4 actions attendues', () => {
  const source = lire(INDEX);
  const { actions } = extraireActions(source, 'ANOMALIE_ACTIONS');
  assert.deepStrictEqual(actions, [
    'api::anomalie.anomalie.create',
    'api::anomalie.anomalie.find',
    'api::anomalie.anomalie.findOne',
    'api::anomalie.anomalie.resolve',
  ]);
});

test('ROLES_ANOMALIE vaut exactement [\'depositaire\']', () => {
  const source = lire(INDEX);
  const debut = source.indexOf('const ROLES_ANOMALIE = [');
  assert.notStrictEqual(debut, -1, 'ROLES_ANOMALIE introuvable');
  const fin = source.indexOf('];', debut) + 2;
  const bloc = source.slice(debut, fin);
  assert.match(
    bloc,
    /const ROLES_ANOMALIE\s*=\s*\[\s*'depositaire'\s*\]/,
    'ROLES_ANOMALIE = [\'depositaire\']'
  );
});

test('JOURNAL_ACTION_ACTIONS déclare l\'action find uniquement', () => {
  const source = lire(INDEX);
  const { actions } = extraireActions(source, 'JOURNAL_ACTION_ACTIONS');
  assert.deepStrictEqual(actions, ['api::journal-action.journal-action.find']);
});

test('ROLES_JOURNAL_ACTION vaut exactement [\'depositaire\']', () => {
  const source = lire(INDEX);
  const debut = source.indexOf('const ROLES_JOURNAL_ACTION = [');
  assert.notStrictEqual(debut, -1, 'ROLES_JOURNAL_ACTION introuvable');
  const fin = source.indexOf('];', debut) + 2;
  const bloc = source.slice(debut, fin);
  assert.match(
    bloc,
    /const ROLES_JOURNAL_ACTION\s*=\s*\[\s*'depositaire'\s*\]/,
    'ROLES_JOURNAL_ACTION = [\'depositaire\']'
  );
});

/* ────────────────────────── Accordement dans le bootstrap ────────────────────────── */

test('bootstrap : RECEPTION_ACTIONS accordees au role depositaire', () => {
  const source = lire(INDEX);
  // Boucle sur ROLES_RECEPTION accordant RECEPTION_ACTIONS.
  assert.match(
    source,
    /for \(const type of ROLES_RECEPTION\)[\s\S]{0,400}for \(const action of RECEPTION_ACTIONS\)/,
    'boucle ROLES_RECEPTION -> RECEPTION_ACTIONS dans ensureAuthSetup'
  );
});

test('bootstrap : ANOMALIE_ACTIONS accordees au role depositaire', () => {
  const source = lire(INDEX);
  assert.match(
    source,
    /for \(const type of ROLES_ANOMALIE\)[\s\S]{0,400}for \(const action of ANOMALIE_ACTIONS\)/,
    'boucle ROLES_ANOMALIE -> ANOMALIE_ACTIONS dans ensureAuthSetup'
  );
});

test('bootstrap : JOURNAL_ACTION_ACTIONS accordees au role depositaire', () => {
  const source = lire(INDEX);
  assert.match(
    source,
    /for \(const type of ROLES_JOURNAL_ACTION\)[\s\S]{0,400}for \(const action of JOURNAL_ACTION_ACTIONS\)/,
    'boucle ROLES_JOURNAL_ACTION -> JOURNAL_ACTION_ACTIONS dans ensureAuthSetup'
  );
});
