'use strict';

/**
 * Réception physique — schémas, routes et contrôleurs.
 *
 * Harnais `node --test`, SANS démarrer Strapi ni toucher la vraie base :
 * vérifie l'existence des fichiers de contrôleur et de route, et que chaque
 * contrôleur exporte les handlers attendus.
 *
 * Engagements verrouillés ici :
 *   1. reception contrôleur exporte find, findOne, create, createLigne ;
 *   2. réception routeur déclare GET /receptions, GET /receptions/:documentId,
 *      POST /receptions, POST /receptions/:documentId/lignes ;
 *   3. anomalie contrôleur exporte find, findOne, create, resolve ;
 *   4. anomalie routeur déclare GET /anomalies, GET /anomalies/:documentId,
 *      POST /anomalies, PATCH /anomalies/:documentId/resolve ;
 *   5. journal-action contrôleur exporte find (lecture seule, immuable) ;
 *   6. journal-action routeur déclare GET /journal-actions uniquement ;
 *   7. aucun champ requis retiré des schémas existants (Task 1).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(f, 'utf8');

/* ────────────────────────── Chemins des fichiers ────────────────────────── */

const SCHEMA_RECEPTION = path.join(
  RACINE, 'src', 'api', 'reception', 'content-types', 'reception', 'schema.json'
);
const SCHEMA_LIGNE = path.join(
  RACINE, 'src', 'api', 'reception-ligne', 'content-types', 'reception-ligne', 'schema.json'
);
const SCHEMA_ANOMALIE = path.join(
  RACINE, 'src', 'api', 'anomalie', 'content-types', 'anomalie', 'schema.json'
);
const SCHEMA_JOURNAL = path.join(
  RACINE, 'src', 'api', 'journal-action', 'content-types', 'journal-action', 'schema.json'
);

const CONTROLEUR_RECEPTION = path.join(
  RACINE, 'src', 'api', 'reception', 'controllers', 'reception.js'
);
const ROUTES_RECEPTION = path.join(
  RACINE, 'src', 'api', 'reception', 'routes', 'reception.js'
);
const CONTROLEUR_ANOMALIE = path.join(
  RACINE, 'src', 'api', 'anomalie', 'controllers', 'anomalie.js'
);
const ROUTES_ANOMALIE = path.join(
  RACINE, 'src', 'api', 'anomalie', 'routes', 'anomalie.js'
);
const CONTROLEUR_JOURNAL = path.join(
  RACINE, 'src', 'api', 'journal-action', 'controllers', 'journal-action.js'
);
const ROUTES_JOURNAL = path.join(
  RACINE, 'src', 'api', 'journal-action', 'routes', 'journal-action.js'
);

/* ────────────────────────── 1. Schémas (Task 1, régression) ────────────────────────── */

test('schéma reception : champs attendus de l\'en-tête', () => {
  const schema = JSON.parse(lire(SCHEMA_RECEPTION));
  const a = schema.attributes;

  assert.strictEqual(a.sortie.type, 'relation');
  assert.strictEqual(a.sortie.relation, 'manyToOne');
  assert.strictEqual(a.sortie.target, 'api::sortie.sortie');
  assert.strictEqual(a.numero.type, 'integer');
  assert.strictEqual(a.numero.required, true);
  assert.strictEqual(a.date_reception.type, 'date');
  assert.strictEqual(a.date_reception.required, true);
  assert.deepStrictEqual(a.statut.enum, ['en_cours', 'partielle', 'complete', 'annulee']);
  assert.strictEqual(a.version.type, 'integer');
  assert.strictEqual(a.depositaire_nom.type, 'text');
  assert.strictEqual(a.depositaire_nom.required, true);
  assert.strictEqual(a.depositaire_fonction.type, 'text');
  assert.strictEqual(a.depositaire_fonction.required, true);
  assert.strictEqual(a.direction.type, 'relation');
  assert.strictEqual(a.direction.target, 'api::direction.direction');
  assert.strictEqual(a.observations.type, 'text');
});

test('schéma reception-ligne : champs et relations attendus', () => {
  const schema = JSON.parse(lire(SCHEMA_LIGNE));
  const a = schema.attributes;

  assert.strictEqual(a.reception.type, 'relation');
  assert.strictEqual(a.reception.target, 'api::reception.reception');
  assert.strictEqual(a.sortie_ligne.type, 'relation');
  assert.strictEqual(a.sortie_ligne.target, 'api::sortie-ligne.sortie-ligne');
  assert.strictEqual(a.materiel.type, 'relation');
  assert.strictEqual(a.materiel.target, 'api::material.material');
  assert.strictEqual(a.quantite_commandee.type, 'integer');
  assert.strictEqual(a.quantite_commandee.required, true);
  assert.strictEqual(a.quantite_recue.type, 'integer');
  assert.strictEqual(a.quantite_recue.required, true);
  assert.deepStrictEqual(a.etat.enum, ['neuf', 'bon', 'moyen', 'defaillant']);
  assert.strictEqual(a.observations.type, 'text');
});

test('schéma anomalie : statut, type, version et relations', () => {
  const schema = JSON.parse(lire(SCHEMA_ANOMALIE));
  const a = schema.attributes;

  assert.strictEqual(a.reception.type, 'relation');
  assert.strictEqual(a.reception.target, 'api::reception.reception');
  assert.strictEqual(a.reception_ligne.type, 'relation');
  assert.strictEqual(a.reception_ligne.target, 'api::reception-ligne.reception-ligne');
  assert.deepStrictEqual(a.type_anomalie.enum, ['manquant', 'endommage', 'non_conforme', 'autre']);
  assert.strictEqual(a.description.type, 'text');
  assert.strictEqual(a.description.required, true);
  assert.deepStrictEqual(a.statut.enum, ['ouverte', 'en_cours', 'resolue', 'rejetee']);
  assert.strictEqual(a.version.type, 'integer');
  assert.strictEqual(a.date_ouverture.type, 'date');
  assert.strictEqual(a.date_ouverture.required, true);
  assert.strictEqual(a.responsable.type, 'relation');
  assert.strictEqual(a.responsable.target, 'plugin::users-permissions.user');
});

test('schéma journal-action : action immuable avec ancien/nouveau statut', () => {
  const schema = JSON.parse(lire(SCHEMA_JOURNAL));
  const a = schema.attributes;

  assert.strictEqual(a.anomalie.type, 'relation');
  assert.strictEqual(a.anomalie.target, 'api::anomalie.anomalie');
  assert.deepStrictEqual(a.action.enum, ['ouverte', 'prise_en_charge', 'resolue', 'rejetee']);
  assert.strictEqual(a.auteur.type, 'relation');
  assert.strictEqual(a.auteur.target, 'plugin::users-permissions.user');
  assert.strictEqual(a.date.type, 'date');
  assert.strictEqual(a.date.required, true);
  assert.deepStrictEqual(a.ancien_statut.enum, ['ouverte', 'en_cours', 'resolue', 'rejetee']);
  assert.deepStrictEqual(a.nouveau_statut.enum, ['ouverte', 'en_cours', 'resolue', 'rejetee']);
  assert.strictEqual(a.nouveau_statut.required, true);
  assert.strictEqual(a.commentaire.type, 'text');
});

/* ────────────────────────── 2. Contrôleurs : exports attendus ────────────────────────── */

test('contrôleur reception exporte find, findOne, create, createLigne', () => {
  assert.ok(fs.existsSync(CONTROLEUR_RECEPTION), 'fichier reception.js manquant');
  const source = lire(CONTROLEUR_RECEPTION);
  assert.match(source, /async find\b/, 'handler find présent');
  assert.match(source, /async findOne\b/, 'handler findOne présent');
  assert.match(source, /async create\b/, 'handler create présent');
  assert.match(source, /async createLigne\b/, 'handler createLigne présent');
});

test('contrôleur anomalie exporte find, findOne, create, resolve', () => {
  assert.ok(fs.existsSync(CONTROLEUR_ANOMALIE), 'fichier anomalie.js manquant');
  const source = lire(CONTROLEUR_ANOMALIE);
  assert.match(source, /async find\b/, 'handler find présent');
  assert.match(source, /async findOne\b/, 'handler findOne présent');
  assert.match(source, /async create\b/, 'handler create présent');
  assert.match(source, /async resolve\b/, 'handler resolve présent');
});

test('contrôleur journal-action exporte find uniquement (lecture seule)', () => {
  assert.ok(fs.existsSync(CONTROLEUR_JOURNAL), 'fichier journal-action.js manquant');
  const source = lire(CONTROLEUR_JOURNAL);
  assert.match(source, /async find\b/, 'handler find présent');
  // Pas de create/update/delete : lecture seule, immuable.
  assert.doesNotMatch(source, /\bcreate\b/, 'pas de handler create');
  assert.doesNotMatch(source, /\bupdate\b/, 'pas de handler update');
  assert.doesNotMatch(source, /\bdelete\b/, 'pas de handler delete');
});

/* ────────────────────────── 3. Routes : déclarations attendues ────────────────────────── */

test('routeur reception déclare les 4 routes attendues', () => {
  assert.ok(fs.existsSync(ROUTES_RECEPTION), 'fichier reception.js (routes) manquant');
  const mod = require(ROUTES_RECEPTION);
  const routes = mod.routes;

  assert.ok(Array.isArray(routes), 'module.exports.routes attendu');
  assert.strictEqual(routes.length, 4, '4 routes réception attendues');

  const signatures = routes.map((r) => `${r.method} ${r.path}`).sort();
  assert.deepStrictEqual(signatures, [
    'GET /receptions',
    'GET /receptions/:documentId',
    'POST /receptions',
    'POST /receptions/:documentId/lignes',
  ]);

  assert.strictEqual(routes.find((r) => r.path === '/receptions' && r.method === 'GET').handler, 'reception.find');
  assert.strictEqual(routes.find((r) => r.path === '/receptions/:documentId' && r.method === 'GET').handler, 'reception.findOne');
  assert.strictEqual(routes.find((r) => r.path === '/receptions' && r.method === 'POST').handler, 'reception.create');
  assert.strictEqual(routes.find((r) => r.path === '/receptions/:documentId/lignes' && r.method === 'POST').handler, 'reception.createLigne');

  // Pas d'override d'authentification, pas de écriture cachée (PUT/PATCH/DELETE)
  for (const route of routes) {
    assert.ok(!route.auth, `pas de override d'authentification sur ${route.path}`);
    assert.ok(['GET', 'POST'].includes(route.method), `méthode attendue sur ${route.path}`);
  }
});

test('routeur anomalie déclare les 4 routes attendues', () => {
  assert.ok(fs.existsSync(ROUTES_ANOMALIE), 'fichier anomalie.js (routes) manquant');
  const mod = require(ROUTES_ANOMALIE);
  const routes = mod.routes;

  assert.ok(Array.isArray(routes), 'module.exports.routes attendu');
  assert.strictEqual(routes.length, 4, '4 routes anomalie attendues');

  const signatures = routes.map((r) => `${r.method} ${r.path}`).sort();
  assert.deepStrictEqual(signatures, [
    'GET /anomalies',
    'GET /anomalies/:documentId',
    'PATCH /anomalies/:documentId/resolve',
    'POST /anomalies',
  ]);

  assert.strictEqual(routes.find((r) => r.path === '/anomalies' && r.method === 'GET').handler, 'anomalie.find');
  assert.strictEqual(routes.find((r) => r.path === '/anomalies/:documentId' && r.method === 'GET').handler, 'anomalie.findOne');
  assert.strictEqual(routes.find((r) => r.path === '/anomalies' && r.method === 'POST').handler, 'anomalie.create');
  assert.strictEqual(routes.find((r) => r.path === '/anomalies/:documentId/resolve' && r.method === 'PATCH').handler, 'anomalie.resolve');

  for (const route of routes) {
    assert.ok(!route.auth, `pas de override d'authentification sur ${route.path}`);
    assert.ok(['GET', 'POST', 'PATCH'].includes(route.method), `méthode attendue sur ${route.path}`);
  }
});

test('routeur journal-action déclare GET /journal-actions uniquement', () => {
  assert.ok(fs.existsSync(ROUTES_JOURNAL), 'fichier journal-action.js (routes) manquant');
  const mod = require(ROUTES_JOURNAL);
  const routes = mod.routes;

  assert.ok(Array.isArray(routes), 'module.exports.routes attendu');
  assert.strictEqual(routes.length, 1, '1 route journal-action attendue');

  const r = routes[0];
  assert.strictEqual(r.method, 'GET');
  assert.strictEqual(r.path, '/journal-actions');
  assert.strictEqual(r.handler, 'journal-action.find');
  assert.ok(!r.auth, 'pas de override d\'authentification');
});
