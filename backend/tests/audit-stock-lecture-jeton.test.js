'use strict';

/**
 * AUDIT — Lecture du stock AVEC JETON, pour TOUS les comptes que l'interface
 * propose à la connexion.
 *
 * Défaut audité : l'interface affiche 7 comptes de démonstration, mais le
 * serveur Strapi n'en créait que 4. Pour les 3 autres (admin, comptable,
 * demandeur de direction), `POST /api/auth/local` échouait — AUCUN jeton n'était
 * délivré, aucune requête n'était authentifiée et l'application lisait le
 * stock (et le reste) en ANONYME. L'écran annonçait alors un stock vide.
 *
 * Test HTTP RÉEL : Strapi démarré pour de vrai sur une base SQLite
 * TEMPORAIRE dans le dossier temporaire du système, jetons obtenus par
 * POST /api/auth/local. Aucun mot de passe ni jeton n'est affiché.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

// ─── Base temporaire : CONFIGURÉE AVANT tout chargement de Strapi ──────────
const RACINE_BACKEND = path.resolve(__dirname, '..');
const FICHIER_BASE = path.join(os.tmpdir(), `compta-stock-jeton-${process.pid}.db`);
for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
  try { fs.rmSync(fichier, { force: true }); } catch (e) { /* base absente */ }
}
process.env.DATABASE_FILENAME = FICHIER_BASE;

const { createStrapi } = require('@strapi/strapi');

// Comptes proposés par l'interface (frontend/src/components/LoginScreen.tsx).
// Les mots de passe ne sont JAMAIS affichés : ils ne servent qu'à se
// connecter. Le tableau est la SPECIFICATION de ce que l'interface attend.
const COMPTES_INTERFACE = [
  { email: 'm.rakoto@ministere.gov.mg', motDePasse: 'admin123', role: 'admin' },
  { email: 'hery.rakoto@mtefop.gov.mg', motDePasse: 'depositaire123', role: 'depositaire' },
  { email: 'fara.andriam@mtefop.gov.mg', motDePasse: 'magasinier123', role: 'magasinier' },
  { email: 'tojo.razaf@mtefop.gov.mg', motDePasse: 'logistique123', role: 'logistique' },
  { email: 'nirina.ravao@mtefop.gov.mg', motDePasse: 'comptable123', role: 'comptable' },
  { email: 'tolotra.randria@mtefop.gov.mg', motDePasse: 'demandeur123', role: 'demandeur' },
  { email: 'jean.rakoto@mtefop.gov.mg', motDePasse: 'direction123', role: 'demandeur' },
];

let strapi = null;
let BASE = '';

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

async function appel(method, url, corps, jeton) {
  const reponse = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(corps ? { 'content-type': 'application/json' } : {}),
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await reponse.text();
  let json = null;
  try { json = JSON.parse(texte); } catch (e) { json = null; }
  return { status: reponse.status, corps: json };
}

async function connexion(email, motDePasse) {
  return appel('POST', '/api/auth/local', { identifier: email, password: motDePasse });
}

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
  strapi.log.level = 'silent';
  if (strapi.startupLogger && typeof strapi.startupLogger.disable === 'function') {
    strapi.startupLogger.disable();
  }
  await strapi.load();
  await strapi.listen();
});

test.after(async () => {
  if (strapi) await strapi.destroy();
  for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
    try { fs.rmSync(fichier, { force: true }); } catch (e) { /* ignoré */ }
  }
});

test('chaque compte proposé par l\'interface obtient un jeton et son rôle réel', async () => {
  for (const compte of COMPTES_INTERFACE) {
    const { status, corps } = await connexion(compte.email, compte.motDePasse);
    assert.strictEqual(status, 200, `connexion refusée pour ${compte.role}`);
    assert.ok(corps && corps.jwt, `aucun jeton délivré pour ${compte.role}`);

    const session = await appel('GET', '/api/session/role', null, corps.jwt);
    assert.strictEqual(session.status, 200, `rôle illisible pour ${compte.role}`);
    assert.strictEqual(
      String(session.corps?.data?.role?.type || '').toLowerCase(),
      compte.role,
      `rôle inattendu pour ${compte.email}`
    );
  }
});

test('le stock se lit AVEC le jeton de chaque compte (quantités présentes)', async () => {
  for (const compte of COMPTES_INTERFACE) {
    const { corps: auth } = await connexion(compte.email, compte.motDePasse);
    const lecture = await appel(
      'GET',
      '/api/materials?pagination[pageSize]=200&sort=designation:asc&populate[0]=categorie',
      null,
      auth.jwt
    );
    assert.strictEqual(lecture.status, 200, `stock illisible pour ${compte.role}`);
    const lignes = lecture.corps?.data ?? [];
    assert.ok(lignes.length > 0, `stock vide pour ${compte.role}`);
    assert.ok(
      lignes.every((ligne) => ligne.quantite_stock !== undefined),
      `quantités absentes pour ${compte.role}`
    );
  }
});

test('le jeton ne donne PAS le droit d\'écrire dans le stock (demandeur)', async () => {
  const { corps: auth } = await connexion(
    'tolotra.randria@mtefop.gov.mg',
    'demandeur123'
  );
  const avant = await appel('GET', '/api/materials?pagination[pageSize]=200', null, auth.jwt);
  const nbAvant = (avant.corps?.data ?? []).length;

  const injection = await appel(
    'POST',
    '/api/materials',
    { data: { designation: 'Matériel injecté', quantite_stock: 1, statut: 'en_stock' } },
    auth.jwt
  );
  assert.ok(injection.status >= 400, 'le demandeur ne doit pas pouvoir écrire');

  const apres = await appel('GET', '/api/materials?pagination[pageSize]=200', null, auth.jwt);
  assert.strictEqual(
    (apres.corps?.data ?? []).length,
    nbAvant,
    'aucun matériel ne doit avoir été créé'
  );
});
