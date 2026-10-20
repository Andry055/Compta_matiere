'use strict';

/**
 * AUDIT — Point 1 : isolation des sorties du demandeur.
 *
 * Défaut audité : `src/utils/populateSecurise.js` (filterFilters) transforme
 * les tableaux en objets indexés. Le filtre d'isolation posé par le serveur
 * (`{ documentId: { $in: [...] } }`) devient `{ documentId: { $in: {0:..} } }`
 * et devient INOPÉRANT : le demandeur lit les sorties des autres.
 *
 * Ce test est un test HTTP RÉEL : Strapi est démarré pour de vrai sur une
 * base SQLite TEMPORAIRE placée dans le dossier temporaire du système, et
 * les appels passent par de vrais appels HTTP (POST /api/auth/local puis
 * GET /api/... avec jeton Bearer). Aucun mot de passe ni jeton n'est
 * affiché.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

// ─── Base temporaire : CONFIGURÉE AVANT tout chargement de Strapi ──────────
const RACINE_BACKEND = path.resolve(__dirname, '..');
const FICHIER_BASE = path.join(os.tmpdir(), `compta-audit-01-${process.pid}.db`);
for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
  try { fs.rmSync(fichier, { force: true }); } catch (e) { /* base absente */ }
}
process.env.DATABASE_FILENAME = FICHIER_BASE;

const { createStrapi } = require('@strapi/strapi');

// Mot de passe PROVISOIRE des comptes de test (jetable, jamais affiché).
const MOT_DE_PASSE = 'Audit-Tmp-2026';

let strapi = null;
let BASE = '';
const jetons = {};
const sorties = { A: [], B: [] };   // A = demandeur (2 sorties), B = autres (3 sorties)
const demandes = { A: [], B: [] };
/** documentId de TOUTES les sorties de la base (démo amorcée + jeu de test). */
const IDS_CONNUS = new Set();

/** Port libre, pour ne pas entrer en collision avec un autre test. */
function portLibre() {
  return new Promise((resolve, reject) => {
    const serveur = net.createServer();
    serveur.once('error', reject);
    serveur.listen(0, '127.0.0.1', () => {
      const port = serveur.address().port;
      serveur.close(() => resolve(port));
    });
  });
}

async function creerUtilisateur(roleType, identifiant) {
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });
  assert.ok(role, `rôle « ${roleType} » attendu dans la base temporaire`);
  return strapi.plugin('users-permissions').service('user').add({
    username: identifiant,
    email: `${identifiant}.audit01@example.local`,
    password: MOT_DE_PASSE,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: role.id,
  });
}

/** Une demande + une sortie + sa ligne + son mouvement. */
async function creerSortie(demandeur, reference) {
  const materiel = await strapi.documents('api::material.material').create({
    data: { designation: `Matériel ${reference}`, quantite_stock: 10, statut: 'en_stock' },
  });
  const demande = await strapi.documents('api::demande.demande').create({
    data: {
      reference: `DEM-${reference}`,
      type: 'sortie',
      designation_materiel: 'Matériel de test',
      quantite: 1,
      statut: 'approuvee',
      date_demande: '2026-01-01',
      demandeur: demandeur.documentId,
    },
  });
  const sortie = await strapi.documents('api::sortie.sortie').create({
    data: {
      reference: `SOR-${reference}`,
      date_sortie: '2026-01-02',
      statut: 'en_preparation',
      demande: demande.documentId,
    },
  });
  await strapi.documents('api::sortie-ligne.sortie-ligne').create({
    data: { sortie: sortie.documentId, materiel: materiel.documentId, quantite: 1 },
  });
  await strapi.documents('api::mouvement.mouvement').create({
    data: {
      reference: `SOR-${reference}`,
      type: 'sortie',
      date_mouvement: '2026-01-03',
      action: 'Sortie validée, stock débité',
      quantite: 1,
      sortie: sortie.documentId,
      demande: demande.documentId,
    },
  });
  return { demande, sortie };
}

async function jetonDe(identifiant) {
  const reponse = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: `${identifiant}.audit01@example.local`, password: MOT_DE_PASSE }),
  });
  assert.strictEqual(reponse.status, 200, `connexion ${identifiant} : HTTP ${reponse.status}`);
  const corps = await reponse.json();
  assert.ok(corps.jwt, 'jeton absent de la réponse de connexion');
  return corps.jwt; // jamais journalisé
}

async function get(url, identifiant) {
  const reponse = await fetch(`${BASE}${url}`, {
    headers: { authorization: `Bearer ${jetons[identifiant]}` },
  });
  const texte = await reponse.text();
  let corps;
  try { corps = JSON.parse(texte); } catch (e) { corps = { brut: texte.slice(0, 200) }; }
  return { status: reponse.status, corps };
}

/** Tous les documentId de sortie (étrangers ou non) présents dans un corps JSON. */
function sortiesVisibles(corps) {
  const vues = new Set();
  const parcourir = (valeur) => {
    if (typeof valeur === 'string') {
      if (IDS_CONNUS.has(valeur)) vues.add(valeur);
      return;
    }
    if (Array.isArray(valeur)) { valeur.forEach(parcourir); return; }
    if (valeur && typeof valeur === 'object') { Object.values(valeur).forEach(parcourir); }
  };
  parcourir(corps);
  return vues;
}

/* ═══════════════════════ Démarrage / arrêt de Strapi ═════════════════════ */

test.before(async () => {
  const port = await portLibre();
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  BASE = `http://127.0.0.1:${port}`;

  strapi = createStrapi({
    appDir: RACINE_BACKEND,
    distDir: RACINE_BACKEND,
    autoReload: false,
    serveAdminPanel: false,
  });
  // Silence ABSOLU : le bootstrap journalise les mots de passe de démonstration.
  strapi.log.level = 'silent';
  if (strapi.startupLogger && typeof strapi.startupLogger.disable === 'function') {
    strapi.startupLogger.disable();
  }
  await strapi.load();
  await strapi.listen();

  // ── Jeu de données ──────────────────────────────────────────────────────
  const A = await creerUtilisateur('demandeur', 'audit01-a');
  const B = await creerUtilisateur('demandeur', 'audit01-b');
  const C = await creerUtilisateur('demandeur', 'audit01-c'); // aucune demande
  const D = await creerUtilisateur('depositaire', 'audit01-d');

  for (const reference of ['A1', 'A2']) {
    const { sortie } = await creerSortie(A, reference);
    sorties.A.push(sortie.documentId);
  }
  for (const reference of ['B1', 'B2', 'B3']) {
    const { sortie } = await creerSortie(B, reference);
    sorties.B.push(sortie.documentId);
  }

  jetons.A = await jetonDe('audit01-a');
  jetons.B = await jetonDe('audit01-b');
  jetons.C = await jetonDe('audit01-c');
  jetons.D = await jetonDe('audit01-d');

  // Toutes les sorties présentes en base (démonstration amorcée + jeu de test).
  const toutes = await strapi.documents('api::sortie.sortie').findMany({
    fields: ['documentId'],
    limit: -1,
  });
  for (const sortie of toutes) IDS_CONNUS.add(sortie.documentId);
});

test.after(async () => {
  if (strapi) {
    try { await strapi.destroy(); } catch (e) { /* la base sera libérée */ }
  }
  for (let tentative = 0; tentative < 10; tentative += 1) {
    try {
      fs.rmSync(FICHIER_BASE, { force: true });
      fs.rmSync(`${FICHIER_BASE}-journal`, { force: true });
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
});

/* ═══════════════════════════ Les scénarios ═══════════════════════════════ */

test('audit01 : GET /api/sorties — le demandeur ne reçoit que SES sorties (nombre exact)', async () => {
  const r = await get('/api/sorties', 'A');
  assert.strictEqual(r.status, 200, `HTTP ${r.status}`);
  assert.ok(Array.isArray(r.corps.data), 'réponse sans tableau de données');
  assert.strictEqual(r.corps.data.length, 2, `attendu 2 sorties, reçu ${r.corps.data.length}`);
  const vues = sortiesVisibles(r.corps);
  const attendu = new Set(sorties.A);
  for (const id of vues) {
    assert.ok(attendu.has(id), 'sortie d’un autre demandeur exposée');
  }
  assert.strictEqual(vues.size, 2, 'les 2 sorties attendues ne sont pas toutes présentes');
});

test('audit01 : GET /api/sorties — un filtre client ne peut pas élargir le périmètre', async () => {
  const r = await get('/api/sorties?filters[statut][$ne]=inconnu', 'A');
  assert.strictEqual(r.status, 200, `HTTP ${r.status}`);
  assert.strictEqual(r.corps.data.length, 2, `attendu 2 sorties, reçu ${r.corps.data.length}`);
  for (const id of sortiesVisibles(r.corps)) {
    assert.ok(sorties.A.includes(id), 'sortie d’un autre demandeur exposée');
  }
});

test('audit01 : GET /api/sorties — un demandeur SANS sortie n’en reçoit AUCUNE', async () => {
  const r = await get('/api/sorties', 'C');
  assert.strictEqual(r.status, 200, `HTTP ${r.status}`);
  assert.ok(Array.isArray(r.corps.data), 'réponse sans tableau de données');
  assert.strictEqual(
    r.corps.data.length,
    0,
    `filtre d’inisolation inopérant : ${r.corps.data.length} sortie(s) reçue(s) au lieu de 0`
  );
  assert.strictEqual(sortiesVisibles(r.corps).size, 0, 'sortie d’un autre demandeur exposée');
});

test('audit01 : GET /api/sorties?populate=* — l’isolation tient avec le peek complet', async () => {
  const r = await get('/api/sorties?populate=*', 'A');
  assert.strictEqual(r.status, 200, `HTTP ${r.status}`);
  assert.strictEqual(r.corps.data.length, 2, `attendu 2 sorties, reçu ${r.corps.data.length}`);
  for (const id of sortiesVisibles(r.corps)) {
    assert.ok(sorties.A.includes(id), 'sortie d’un autre demandeur exposée');
  }
});

test('audit01 : GET /api/mouvements?populate=sortie — aucune sortie étrangère atteignable', async () => {
  const r = await get('/api/mouvements?populate=sortie', 'A');
  assert.strictEqual(r.status, 200, `HTTP ${r.status} (populate interdit mal traité)`);
  for (const id of sortiesVisibles(r.corps)) {
    assert.ok(sorties.A.includes(id), 'sortie d’un autre demandeur exposée via /mouvements');
  }
});

test('audit01 : GET /api/materials?populate[lignes_sortie][populate]=sortie — aucune sortie étrangère atteignable', async () => {
  const r = await get('/api/materials?populate[lignes_sortie][populate]=sortie', 'A');
  assert.strictEqual(r.status, 200, `HTTP ${r.status}`);
  for (const id of sortiesVisibles(r.corps)) {
    assert.ok(sorties.A.includes(id), 'sortie d’un autre demandeur exposée via /materials');
  }
});

test('audit01 : les autres rôles conservent leur accès complet (dépositaire)', async () => {
  const r = await get('/api/sorties', 'D');
  assert.strictEqual(r.status, 200, `HTTP ${r.status}`);
  assert.strictEqual(
    r.corps.data.length,
    IDS_CONNUS.size,
    `attendu ${IDS_CONNUS.size} sorties pour le dépositaire, reçu ${r.corps.data.length}`
  );
});
