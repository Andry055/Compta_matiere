'use strict';

/**
 * AUDIT — Étape 2 « Décision » : le Dépositaire approuve (quantités
 * ajustables) ou rejette (motif obligatoire) une demande.
 *
 * Défauts audités :
 *  1. AUCUN endpoint de décision n'existe : le schéma porte bien
 *     `approuvee` / `rejetee` / `valide_par` / `date_validation`, mais rien ne
 *     les pose jamais — le circuit de sortie (qui exige une demande
 *     « approuvee ») est donc bloqué à jamais ;
 *  2. aucun motif de rejet n'est enregistrable (le champ n'existe pas) ;
 *  3. les quantités demandées ne sont pas ré-contrôlées au moment de la
 *     décision : le stock a pu bouger entre la demande et la décision ;
 *  4. rien n'empêche une seconde validation (approuver puis rejeter).
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
const FICHIER_BASE = path.join(os.tmpdir(), `compta-etape2-${process.pid}.db`);
for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
  try { fs.rmSync(fichier, { force: true }); } catch (e) { /* base absente */ }
}
process.env.DATABASE_FILENAME = FICHIER_BASE;

const { createStrapi } = require('@strapi/strapi');

// Mot de passe PROVISOIRE des comptes de test (jetable, jamais affiché).
const MOT_DE_PASSE = 'Etp2-Tmp-2026';

let strapi = null;
let BASE = '';
const jetons = {};
const ctx = {
  materielA: null, // stock 5
  materielB: null, // stock 1
  materielC: null, // stock 5, réduit à 2 pendant le test
};

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

async function creerUtilisateur(roleType, identifiant, department) {
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });
  assert.ok(role, `rôle « ${roleType} » attendu`);
  return strapi.plugin('users-permissions').service('user').add({
    username: identifiant,
    email: `${identifiant}.etp2@example.local`,
    password: MOT_DE_PASSE,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: role.id,
    department,
    fonction: 'Chef de service',
  });
}

async function creerMateriel(designation, quantiteStock) {
  return strapi.documents('api::material.material').create({
    data: { designation, quantite_stock: quantiteStock, statut: 'en_stock' },
  });
}

async function jetonDe(identifiant) {
  const reponse = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identifier: `${identifiant}.etp2@example.local`,
      password: MOT_DE_PASSE,
    }),
  });
  assert.strictEqual(reponse.status, 200, `connexion ${identifiant} : HTTP ${reponse.status}`);
  const corps = await reponse.json();
  assert.ok(corps.jwt, 'jeton absent de la réponse de connexion');
  return corps.jwt; // jamais journalisé
}

async function api(method, url, corps, identifiant) {
  const reponse = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(corps ? { 'content-type': 'application/json' } : {}),
      ...(identifiant ? { authorization: `Bearer ${jetons[identifiant]}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await reponse.text();
  let resultat;
  try { resultat = JSON.parse(texte); } catch (e) { resultat = { brut: texte.slice(0, 200) }; }
  return { status: reponse.status, corps: resultat };
}

const aujourdhui = new Date().toISOString().slice(0, 10);

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
  strapi.log.level = 'silent';
  if (strapi.startupLogger && typeof strapi.startupLogger.disable === 'function') {
    strapi.startupLogger.disable();
  }
  await strapi.load();
  await strapi.listen();

  // ── Comptes ─────────────────────────────────────────────────────────────
  ctx.demandeur = await creerUtilisateur('demandeur', 'etp2-a', 'DRH - Service Gestion Personnel');
  ctx.depositaire = await creerUtilisateur('depositaire', 'etp2-d', 'DF - Service Comptabilité');
  ctx.magasinier = await creerUtilisateur('magasinier', 'etp2-m', 'DF - Magasin');
  ctx.comptable = await creerUtilisateur('comptable', 'etp2-c', 'DF - Service Budget');

  // ── Stock réel ─────────────────────────────────────────────────────────
  ctx.materielA = await creerMateriel('Clavier disponible', 5);
  ctx.materielB = await creerMateriel('Ecran disponible', 1);
  ctx.materielC = await creerMateriel('Souris disponible', 5);

  jetons.a = await jetonDe('etp2-a');
  jetons.d = await jetonDe('etp2-d');
  jetons.m = await jetonDe('etp2-m');
  jetons.c = await jetonDe('etp2-c');

  // ── Demandes de départ (créées par le Demandeur) ───────────────────────
  etat.d1 = await creerDemande(ctx.materielA, 3);
  etat.d2 = await creerDemande(ctx.materielB, 1);
  etat.d3 = await creerDemande(ctx.materielC, 5);
});

/* ═════════════════════════════ Tests HTTP ═══════════════════════════════ */

const etat = { d1: null, d2: null, d3: null };

/** Demande créée par le Demandeur (chemin nominal de l'étape 1). */
async function creerDemande(materiel, quantite) {
  const reponse = await api(
    'POST',
    '/api/demandes',
    {
      data: {
        type: 'sortie',
        priorite: 'normal',
        statut: 'en_attente',
        date_demande: aujourdhui,
        motif: 'Remplacement de poste de travail',
        lignes: [{ materiel: materiel.documentId, quantite, motif: 'Poste de travail' }],
      },
    },
    'a'
  );
  assert.strictEqual(
    reponse.status,
    201,
    `création de la demande refusée : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  return reponse.corps?.data?.documentId;
}

/** Demande relue en base (document service : pas de sanitizer). */
function demandeEnBase(documentId) {
  return strapi.documents('api::demande.demande').findOne({
    documentId,
    populate: { lignes: { populate: ['materiel'] } },
  });
}

test('ÉTAPE 2 — le Demandeur ne peut PAS décider (ni approuver ni rejeter)', async () => {
  const approbation = await api(
    'POST',
    `/api/demandes/${etat.d1}/approuver`,
    { data: { lignes: [{ materiel: ctx.materielA.documentId, quantite: 1 }] } },
    'a'
  );
  assert.ok(
    approbation.status >= 400,
    `le Demandeur ne doit jamais approuver : HTTP ${approbation.status}`
  );
  const rejet = await api(
    'POST',
    `/api/demandes/${etat.d1}/rejeter`,
    { data: { motif: 'Non disponible' } },
    'a'
  );
  assert.ok(
    rejet.status >= 400,
    `le Demandeur ne doit jamais rejeter : HTTP ${rejet.status}`
  );
  const enBase = await demandeEnBase(etat.d1);
  assert.strictEqual(
    enBase.statut,
    'en_attente',
    'la demande ne doit pas avoir changé de statut'
  );
});

test('ÉTAPE 2 — seul le Dépositaire décide (magasinier et comptable refusés)', async () => {
  for (const role of ['m', 'c']) {
    const reponse = await api(
      'POST',
      `/api/demandes/${etat.d1}/approuver`,
      { data: { lignes: [{ materiel: ctx.materielA.documentId, quantite: 1 }] } },
      role
    );
    assert.ok(
      reponse.status >= 400,
      `le rôle « ${role} » ne doit pas pouvoir décider : HTTP ${reponse.status}`
    );
  }
  const enBase = await demandeEnBase(etat.d1);
  assert.strictEqual(enBase.statut, 'en_attente', 'la demande ne doit pas avoir changé');
});

test('ÉTAPE 2 — le stock est re-vérifié AU MOMENT de la décision', async () => {
  // Le stock baisse après le dépôt de la demande (sortie déjà préparée).
  await strapi
    .documents('api::material.material')
    .update({ documentId: ctx.materielC.documentId, data: { quantite_stock: 2 } });

  const reponse = await api(
    'POST',
    `/api/demandes/${etat.d3}/approuver`,
    { data: { lignes: [{ materiel: ctx.materielC.documentId, quantite: 5 }] } },
    'd'
  );
  assert.ok(
    reponse.status >= 400,
    `une quantité non couverte par le stock doit être refusée : HTTP ${reponse.status}`
  );
  const enBase = await demandeEnBase(etat.d3);
  assert.strictEqual(
    enBase.statut,
    'en_attente',
    'la demande ne doit pas être approuvée si le stock ne couvre pas'
  );
});

test('ÉTAPE 2 — le Dépositaire APPROUVE en ajustant les quantités', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.d1}/approuver`,
    {
      data: {
        lignes: [{ materiel: ctx.materielA.documentId, quantite: 2 }],
        observation: 'Quantité limitée par le stock disponible',
      },
    },
    'd'
  );
  assert.strictEqual(
    reponse.status,
    200,
    `approbation refusée : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const enBase = await demandeEnBase(etat.d1);
  assert.strictEqual(enBase.statut, 'approuvee', 'le statut doit passer à « approuvee »');
  assert.strictEqual(
    enBase.lignes[0].quantite,
    2,
    'la quantité approuvée (ajustée) doit être enregistrée'
  );
  assert.strictEqual(
    enBase.lignes[0].quantite_demandee,
    3,
    'la quantité demandée doit être conservée pour la traçabilité'
  );
  assert.ok(enBase.valide_par, 'le validateur doit être enregistré');
  assert.ok(enBase.date_validation, 'la date de validation doit être enregistrée');
  assert.strictEqual(
    enBase.quantite,
    2,
    'le total de la demande doit refléter les quantités approuvées'
  );
});

test('ÉTAPE 2 — UNE SEULE validation : une demande déjà tranchée ne se re-tranche pas', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.d1}/rejeter`,
    { data: { motif: 'Non disponible' } },
    'd'
  );
  assert.ok(
    reponse.status >= 400,
    `une seconde validation doit être refusée : HTTP ${reponse.status}`
  );
  const enBase = await demandeEnBase(etat.d1);
  assert.strictEqual(
    enBase.statut,
    'approuvee',
    'le statut de la demande approuvée ne doit pas changer'
  );
  assert.strictEqual(
    enBase.motif_rejet,
    null,
    'aucun motif de rejet ne doit être enregistré sur une demande approuvée'
  );
});

test('ÉTAPE 2 — le rejet EXIGE un motif', async () => {
  const reponse = await api('POST', `/api/demandes/${etat.d2}/rejeter`, { data: {} }, 'd');
  assert.strictEqual(
    reponse.status,
    400,
    `un rejet sans motif doit être refusé en 400 : HTTP ${reponse.status}`
  );
  const enBase = await demandeEnBase(etat.d2);
  assert.strictEqual(
    enBase.statut,
    'en_attente',
    'la demande ne doit pas être rejetée sans motif'
  );
});

test('ÉTAPE 2 — le Dépositaire REJETTE avec un motif', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.d2}/rejeter`,
    { data: { motif: 'Non disponible en stock' } },
    'd'
  );
  assert.strictEqual(
    reponse.status,
    200,
    `rejet refusé : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const enBase = await demandeEnBase(etat.d2);
  assert.strictEqual(enBase.statut, 'rejetee', 'le statut doit passer à « rejetee »');
  assert.strictEqual(
    enBase.motif_rejet,
    'Non disponible en stock',
    'le motif de rejet doit être enregistré'
  );
  assert.ok(enBase.valide_par, 'le validateur doit être enregistré');
});

test('ÉTAPE 2 — une demande rejetée ne peut plus être approuvée', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.d2}/approuver`,
    { data: { lignes: [{ materiel: ctx.materielB.documentId, quantite: 1 }] } },
    'd'
  );
  assert.ok(
    reponse.status >= 400,
    `une demande rejetée ne doit plus être approuvable : HTTP ${reponse.status}`
  );
  const enBase = await demandeEnBase(etat.d2);
  assert.strictEqual(enBase.statut, 'rejetee', 'le statut ne doit pas changer');
});

test('ÉTAPE 2 — la décision ne se contourne PAS par une mise à jour classique', async () => {
  // Le Dépositaire a la permission `api::demande.demande.update` : un PUT
  // classique pourrait poser « approuvee » sans contrôle de stock, sans
  // quantités ajustables et sans trace de validation.
  const reponse = await api(
    'PUT',
    `/api/demandes/${etat.d3}`,
    { data: { statut: 'approuvee' } },
    'd'
  );
  assert.ok(
    reponse.status >= 400,
    `la décision ne doit pas passer par un PUT : HTTP ${reponse.status}`
  );
  const enBase = await demandeEnBase(etat.d3);
  assert.strictEqual(
    enBase.statut,
    'en_attente',
    'la demande ne doit pas avoir été approuvée par un PUT'
  );
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
