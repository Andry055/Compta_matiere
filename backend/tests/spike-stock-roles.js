'use strict';

/**
 * SONDE — Lecture du stock AVEC JETON, pour chaque rôle métier.
 *
 * Fichier NON exécuté par `node --test` (suffixe `.js`) :
 *   node tests/spike-stock-roles.js
 *
 * Objectif : établir factuellement quel rôle lit le stock (GET /api/materials)
 * et ce que la réponse contient réellement (quantite_stock, nombre de fiches).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const RACINE = path.resolve(__dirname, '..');
const BASE_FILE = path.join(os.tmpdir(), `compta-spike-stock-${process.pid}.db`);
for (const f of [BASE_FILE, `${BASE_FILE}-journal`]) {
  try { fs.rmSync(f, { force: true }); } catch (e) { /* absente */ }
}
process.env.DATABASE_FILENAME = BASE_FILE;

const { createStrapi } = require('@strapi/strapi');
const MOT_DE_PASSE = 'Spike-Tmp-2026'; // provisoire, jamais affiché

let strapi = null;
let BASE = '';

function portLibre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

async function appel(method, url, corps, jeton) {
  const r = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(corps ? { 'content-type': 'application/json' } : {}),
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch (e) { j = { brut: t.slice(0, 120) }; }
  return { status: r.status, corps: j };
}

(async () => {
  const port = await portLibre();
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  BASE = `http://127.0.0.1:${port}`;

  strapi = createStrapi({
    appDir: RACINE, distDir: RACINE, autoReload: false, serveAdminPanel: false,
  });
  strapi.log.level = 'silent';
  if (strapi.startupLogger && typeof strapi.startupLogger.disable === 'function') {
    strapi.startupLogger.disable();
  }
  await strapi.load();
  await strapi.listen();

  const roleDe = async (type) =>
    strapi.db.query('plugin::users-permissions.role').findOne({ where: { type } });

  const ROLES = ['demandeur', 'depositaire', 'magasinier', 'logistique', 'comptable'];
  const resultats = {};

  for (const type of ROLES) {
    const role = await roleDe(type);
    if (!role) { resultats[type] = 'ROLE ABSENT'; continue; }
    const identifiant = `spike-${type}`;
    const compte = await strapi.plugin('users-permissions').service('user').add({
      username: identifiant,
      email: `${identifiant}@example.local`,
      password: MOT_DE_PASSE,
      provider: 'local', confirmed: true, blocked: false,
      role: role.id,
      department: 'DRH - Service du Personnel',
      fonction: 'Test',
    });
    const connexion = await appel('POST', '/api/auth/local', {
      identifier: `${identifiant}@example.local`, password: MOT_DE_PASSE,
    });
    const jeton = connexion.corps?.jwt;
    if (!jeton) { resultats[type] = { connexion: connexion.status }; continue; }

    const lecture = await appel(
      'GET',
      '/api/materials?pagination[pageSize]=200&sort=designation:asc&populate[0]=categorie&populate[1]=photos',
      null, jeton
    );
    const rows = lecture.corps?.data ?? [];
    const avecStock = rows.filter((r) => Number(r.quantite_stock) > 0);
    resultats[type] = {
      http: lecture.status,
      nb_fiches: rows.length,
      nb_avec_stock: avecStock.length,
      quantite_stock_present:
        rows.length > 0 ? rows[0].quantite_stock !== undefined : null,
      exemple: rows[0]
        ? { designation: rows[0].designation, quantite_stock: rows[0].quantite_stock, statut: rows[0].statut }
        : null,
      erreur: lecture.corps?.error?.message ?? null,
    };
  }

  // Aucune permission sur le stock pour le rôle du demandeur ?
  const roleDemandeur = await roleDe('demandeur');
  const perms = await strapi.db
    .query('plugin::users-permissions.permission')
    .findMany({ where: { role: roleDemandeur.id } });
  const actions = perms.map((p) => p.action).filter((a) => a.includes('material'));

  console.log(JSON.stringify({ lecture_stock_par_role: resultats, perms_material_demandeur: actions }, null, 2));

  await strapi.destroy();
  for (const f of [BASE_FILE, `${BASE_FILE}-journal`]) {
    try { fs.rmSync(f, { force: true }); } catch (e) { /* ignoré */ }
  }
  process.exit(0);
})().catch(async (e) => {
  console.error('SONDE EN ÉCHEC :', e.message);
  if (strapi) { try { await strapi.destroy(); } catch (x) { /* ignoré */ } }
  process.exit(1);
});
