'use strict';

/**
 * PREUVE CHIFFRÉE de la pagination des ordres de sortie (phase 2).
 *
 * Réponse à « Strapi plafonne-t-il ? » : OUI — backend/config/api.js impose
 *   rest.defaultLimit = 25, rest.maxLimit = 100, rest.withCount = true.
 * Une requête REST qui demande `pagination[pageSize]=1000` ne rapporte donc
 * JAMAIS plus de 100 lignes : le client doit paginer par boucle sur
 * meta.pagination.pageCount (aucune config serveur modifiée).
 *
 * Méthode : base SQLITE JETABLE du dossier temporaire du système (jamais la
 * base de travail, jamais backend/.env, copie supprimée à la fin), VRAI
 * serveur HTTP Strapi, VRAIE route /api/sorties, VRAI en-tête d'authentification.
 *
 *   B1  pageSize=1000 → 100 lignes renvoyées (plafond), pageCount=2 ;
 *   B2  boucle meta.pagination.pageCount → 120/120 reçus par le client ;
 *   B3  compteur du badge : filtre serveur + pageSize=1 + withCount → 120 ;
 *   B4  le libellé affiché « En préparation » ne matche rien (enum serveur).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ─── Base JETABLE dans le dossier temporaire du SYSTÈME ───────────────────
const RACINE_BACKEND = path.resolve(__dirname, '..');
const RACINE_CONFIG = path.join(RACINE_BACKEND, 'config');
const DOSSIER_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pagination-sorties-'));

// database.js fait path.join(__dirname, '..', DATABASE_FILENAME) avec
// __dirname = <backend>/config : on remonte à la racine du disque (où tous
// les chemins absolus convergent) puis on redescend vers le dossier jetable.
const CIBLE = path.join(DOSSIER_TEMP, 'sorties-120.db');
const nbSegments = RACINE_CONFIG.split(/[\\/]/).filter(Boolean).length;
const remontes = Array(nbSegments).fill('..').join('/');
const descente = path.relative(path.parse(CIBLE).root, CIBLE).split(path.sep).join('/');
process.env.DATABASE_CLIENT = 'sqlite';
process.env.DATABASE_FILENAME = `${remontes}/${descente}`;
process.env.HOST = '127.0.0.1';
process.env.PORT = '1347';

const { createStrapi } = require('@strapi/strapi');

const UID_SORTIE = 'api::sortie.sortie';
const URL = 'http://127.0.0.1:1347';
const IDENTIFIANT = 'pagination.temporaire';
const MOT_DE_PASSE = 'pagination-jetable-uniquement';

let strapi = null;
let jeton = null;

/** Requête REST authentifiée — exactement le transport du store frontend. */
async function get(chemin) {
  const reponse = await fetch(`${URL}/api${chemin}`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });
  assert.strictEqual(reponse.status, 200, `GET ${chemin} → ${reponse.status}`);
  return reponse.json();
}

test.before(async () => {
  strapi = createStrapi({
    appDir: RACINE_BACKEND,
    distDir: RACINE_BACKEND,
    autoReload: false,
    serveAdminPanel: false,
  });
  await strapi.load();

  // Base jetable : on repart d'un compteur ZÉRO (le seed en met 3).
  const existantes = await strapi.db.query(UID_SORTIE).findMany({ fields: ['id'] });
  for (const s of existantes) {
    await strapi.db.query(UID_SORTIE).delete({ where: { id: s.id } });
  }

  // 120 ordres en préparation, signature 1 absente : le cas exact du magasinier.
  for (let i = 1; i <= 120; i += 1) {
    await strapi.documents(UID_SORTIE).create({
      data: {
        reference: `SOR-PAG-${String(i).padStart(3, '0')}`,
        date_sortie: '2030-02-02',
        statut: 'en_preparation',
        magasinier_signed: false,
      },
    });
  }

  // Utilisateur JETABLE (copie jetable seulement) pour franchir la route
  // authentifiée /api/sorties. Aucun identifiant réel lu ni affiché.
  // Même service que le bootstrap : il hache le mot de passe.
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'magasinier' } });
  await strapi.plugin('users-permissions').service('user').add({
    username: IDENTIFIANT,
    email: `${IDENTIFIANT}@example.test`,
    password: MOT_DE_PASSE,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: role.id,
  });

  await strapi.listen();
  const connexion = await fetch(`${URL}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: IDENTIFIANT, password: MOT_DE_PASSE }),
  });
  assert.strictEqual(connexion.status, 200, 'authentification jetable');
  jeton = (await connexion.json()).jwt;
  assert.ok(jeton, 'jeton reçu');
});

test.after(async () => {
  if (strapi) {
    try { await strapi.destroy(); } catch (e) { /* fichier jetable */ }
  }
  for (let tentative = 0; tentative < 10; tentative += 1) {
    try { fs.rmSync(DOSSIER_TEMP, { recursive: true, force: true }); break; }
    catch (e) { await new Promise((r) => setTimeout(r, 250)); }
  }
});

test('B1 : Strapi plafonne une page à 100 lignes (maxLimit=100)', async () => {
  const config = require(path.join(RACINE_BACKEND, 'config', 'api.js'));
  assert.strictEqual(config.rest.defaultLimit, 25);
  assert.strictEqual(config.rest.maxLimit, 100);

  const corps = await get('/sorties?pagination[page]=1&pagination[pageSize]=1000');
  assert.strictEqual(
    corps.data.length,
    100,
    `pageSize=1000 demandée → 100 lignes : Strapi plafonne OUI (reçu ${corps.data.length})`
  );
  assert.strictEqual(corps.meta.pagination.pageSize, 100);
  assert.strictEqual(corps.meta.pagination.total, 120);
  assert.strictEqual(corps.meta.pagination.pageCount, 2);
});

test('B2 : la boucle sur meta.pagination.pageCount reçoit 120/120', async () => {
  let page = 1;
  let pageCount = 1;
  let recues = 0;
  const references = new Set();

  do {
    const corps = await get(
      `/sorties?sort=date_sortie:desc&pagination[page]=${page}&pagination[pageSize]=100`
    );
    corps.data.forEach((ent) => references.add(ent.id));
    recues += corps.data.length;
    pageCount = corps.meta.pagination.pageCount;
    page += 1;
  } while (page <= pageCount);

  assert.strictEqual(recues, 120, 'le store reçoit bien les 120 ordres');
  assert.strictEqual(references.size, 120, 'aucun doublon entre les pages');
});

test('B3 : compteur badge = 120 avec pageSize=1 + withCount (aucun détail)', async () => {
  const corps = await get(
    '/sorties?filters[statut][$eq]=en_preparation&filters[magasinier_signed][$eq]=false' +
      '&pagination[pageSize]=1&pagination[withCount]=true'
  );
  assert.strictEqual(corps.meta.pagination.total, 120, 'total serveur = 120');
  assert.strictEqual(corps.data.length, 1, 'une seule ligne transportée');
  assert.strictEqual(
    corps.meta.pagination.pageCount,
    120,
    'avec pageSize=1 le serveur annonce 120 pages — le total ne dépend PAS de la taille de page'
  );
});

test('B4 : le libellé « En préparation » ne matche rien (bug du badge à 0)', async () => {
  const corps = await get(
    '/sorties?filters[statut][$eq]=En%20préparation&pagination[pageSize]=1&pagination[withCount]=true'
  );
  assert.strictEqual(corps.meta.pagination.total, 0, 'le libellé affiché est absent de l\'enum');
});
