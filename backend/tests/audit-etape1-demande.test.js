'use strict';

/**
 * AUDIT — Étape 1 « Demande » : stock réel, direction du compte, lignes multiples.
 *
 * Défauts audités :
 *  1. `POST /api/demandes` répond 400 « Invalid key demandeur » pour TOUS les
 *     rôles (le contrôleur force `demandeur` dans le corps, or Strapi refuse
 *     une relation vers `plugin::users-permissions.user` quand le rôle n'a pas
 *     la permission `user.find`) → aucune demande n'est jamais enregistrée ;
 *  2. la direction vient de l'ÉCRAN (relation libre, jamais dérivée du compte) ;
 *  3. le matériel est du texte libre : aucun lien avec le stock, aucun contrôle
 *     de quantité ;
 *  4. le schéma n'a pas de lignes : une demande = une ligne.
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
const FICHIER_BASE = path.join(os.tmpdir(), `compta-etape1-${process.pid}.db`);
for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
  try { fs.rmSync(fichier, { force: true }); } catch (e) { /* base absente */ }
}
process.env.DATABASE_FILENAME = FICHIER_BASE;

const { createStrapi } = require('@strapi/strapi');

// Mot de passe PROVISOIRE des comptes de test (jetable, jamais affiché).
const MOT_DE_PASSE = 'Etp1-Tmp-2026';

let strapi = null;
let BASE = '';
const jetons = {};
const ctx = {
  demandeur: null,
  autre: null,
  depositaire: null,
  dirDRH: null,
  dirDF: null,
  serviceBudget: null,
  materielA: null, // stock 5
  materielB: null, // stock 1
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
    email: `${identifiant}.etp1@example.local`,
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
      identifier: `${identifiant}.etp1@example.local`,
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

  // ── Comptes (la DIRECTION est portée par le compte) ────────────────────
  // Le libellé de département doit désigner un service RÉEL de l'organigramme
  // (c'est lui qui détermine la direction ET le service de la demande) : le
  // compte du demandeur porte ici le même libellé que le compte de
  // démonstration seedé côté serveur.
  ctx.demandeur = await creerUtilisateur('demandeur', 'etp1-a', 'DRH - Service Gestion Personnel');
  ctx.autre = await creerUtilisateur('demandeur', 'etp1-b', 'DF - Service Budget');
  ctx.depositaire = await creerUtilisateur('depositaire', 'etp1-d', 'DF - Service Comptabilité');

  // ── Organigramme ────────────────────────────────────────────────────────
  ctx.dirDRH = await strapi.documents('api::direction.direction').create({
    data: { nom_direction: 'Direction des Ressources Humaines', abreviation: 'DRH' },
    status: 'published',
  });
  ctx.dirDF = await strapi.documents('api::direction.direction').create({
    data: { nom_direction: 'Direction Financière', abreviation: 'DF' },
    status: 'published',
  });
  ctx.serviceBudget = await strapi.documents('api::service.service').create({
    data: { nom_service: 'Service Budget', direction: ctx.dirDF.documentId },
    status: 'published',
  });
  ctx.serviceRH = await strapi.documents('api::service.service').create({
    data: { nom_service: 'Service Gestion Personnel', direction: ctx.dirDRH.documentId },
    status: 'published',
  });

  // ── Stock réel ─────────────────────────────────────────────────────────
  ctx.materielA = await creerMateriel('Clavier disponible', 5);
  ctx.materielB = await creerMateriel('Ecran disponible', 1);

  jetons.a = await jetonDe('etp1-a');
  jetons.b = await jetonDe('etp1-b');
  jetons.d = await jetonDe('etp1-d');
});

/* ═════════════════════════════ Tests HTTP ═══════════════════════════════ */

const etat = { documentIdA: null, documentIdB: null, documentIdDeuxLignes: null };

/**
 * Corps « écran » : le client propose un matériel du stock, une quantité et
 * un motif — et TENTE d'imposer une direction (ce qu'il ne doit jamais faire).
 */
function corpsDemande(lignes, directionImposee) {
  return {
    data: {
      type: 'sortie',
      priorite: 'normal',
      statut: 'en_attente',
      date_demande: aujourdhui,
      motif: 'Remplacement de poste de travail',
      direction: directionImposee,
      lignes,
    },
  };
}

/** Demande relue en base (document service : pas de sanitizer). */
function demandeEnBase(documentId) {
  return strapi.documents('api::demande.demande').findOne({
    documentId,
    populate: {
      demandeur: true,
      direction: true,
      service: true,
      lignes: { populate: ['materiel'] },
    },
  });
}

function nombreDemandesEnBase() {
  return strapi.documents('api::demande.demande')
    .findMany({ fields: ['documentId'], limit: -1 })
    .then((rows) => (rows || []).length);
}

test('ÉTAPE 1 — POST /api/demandes est enregistré (aujourd\'hui : 400 « Invalid key demandeur »)', async () => {
  const reponse = await api(
    'POST',
    '/api/demandes',
    corpsDemande(
      [{ materiel: ctx.materielA.documentId, quantite: 1, motif: 'Clavier' }],
      ctx.dirDF.documentId // tentative d'imposer une direction
    ),
    'a'
  );
  assert.strictEqual(
    reponse.status,
    201,
    `création refusée : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const documentId = reponse.corps?.data?.documentId;
  assert.ok(documentId, 'la réponse ne contient pas de documentId');
  etat.documentIdA = documentId;

  const enBase = await demandeEnBase(documentId);
  assert.ok(enBase, 'la demande n\'est pas enregistrée en base');
  assert.strictEqual(
    enBase.demandeur && enBase.demandeur.username,
    'etp1-a',
    'la demande n\'appartient pas à l\'utilisateur connecté'
  );
  // Le matériel est RELIÉ au stock réel (pas une désignation libre).
  assert.strictEqual(enBase.lignes.length, 1, 'la demande doit porter une ligne');
  assert.strictEqual(
    enBase.lignes[0].materiel && enBase.lignes[0].materiel.documentId,
    ctx.materielA.documentId,
    'la ligne ne pointe pas vers la fiche matériel du stock'
  );
  assert.strictEqual(enBase.lignes[0].quantite, 1, 'quantité de ligne incorrecte');
});

test('ÉTAPE 1 — la direction vient du COMPTE, jamais de l\'écran', async () => {
  const enBase = await demandeEnBase(etat.documentIdA);
  assert.strictEqual(
    enBase.direction && enBase.direction.nom_direction,
    'Direction des Ressources Humaines',
    'la direction enregistrée n\'est pas celle du compte'
  );
  assert.notStrictEqual(
    enBase.direction && enBase.direction.documentId,
    ctx.dirDF.documentId,
    'la direction imposée par l\'écran a été enregistrée'
  );
});

test('ÉTAPE 1 — la direction ET le service sont déduits du compte', async () => {
  // Compte « DF - Service Budget » : le service désigne sa direction.
  const reponse = await api(
    'POST',
    '/api/demandes',
    corpsDemande(
      [{ materiel: ctx.materielA.documentId, quantite: 1, motif: 'Ecran' }],
      ctx.dirDRH.documentId
    ),
    'b'
  );
  assert.strictEqual(
    reponse.status,
    201,
    `création refusée : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  etat.documentIdB = reponse.corps?.data?.documentId;
  const enBase = await demandeEnBase(etat.documentIdB);
  assert.strictEqual(
    enBase.direction && enBase.direction.abreviation,
    'DF',
    'la direction déduite du compte est incorrecte'
  );
  assert.strictEqual(
    enBase.service && enBase.service.nom_service,
    'Service Budget',
    'le service déduit du compte est incorrect'
  );
});

test('ÉTAPE 1 — un matériel absent du stock est refusé (400)', async () => {
  const reponse = await api(
    'POST',
    '/api/demandes',
    corpsDemande([{ materiel: 'documentId-inexistant', quantite: 1, motif: 'X' }], null),
    'a'
  );
  assert.strictEqual(reponse.status, 400, `HTTP ${reponse.status} au lieu de 400`);
  assert.match(
    String(reponse.corps?.error?.message),
    /n'existe pas/i,
    `message inattendu : ${reponse.corps?.error?.message}`
  );
});

test('ÉTAPE 1 — une quantité supérieure au stock est refusée (400)', async () => {
  const reponse = await api(
    'POST',
    '/api/demandes',
    corpsDemande(
      [{ materiel: ctx.materielB.documentId, quantite: 5, motif: 'X' }], // stock = 1
      null
    ),
    'a'
  );
  assert.strictEqual(reponse.status, 400, `HTTP ${reponse.status} au lieu de 400`);
  assert.match(
    String(reponse.corps?.error?.message),
    /stock insuffisant/i,
    `message inattendu : ${reponse.corps?.error?.message}`
  );
});

test('ÉTAPE 1 — deux lignes forment UNE seule demande', async () => {
  const avant = await nombreDemandesEnBase();
  const reponse = await api(
    'POST',
    '/api/demandes',
    corpsDemande(
      [
        { materiel: ctx.materielA.documentId, quantite: 1, motif: 'Ligne 1' },
        { materiel: ctx.materielB.documentId, quantite: 1, motif: 'Ligne 2' },
      ],
      null
    ),
    'a'
  );
  assert.strictEqual(
    reponse.status,
    201,
    `création refusée : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const apres = await nombreDemandesEnBase();
  assert.strictEqual(apres - avant, 1, 'deux lignes doivent produire UNE seule demande');
  etat.documentIdDeuxLignes = reponse.corps.data.documentId;
  const enBase = await demandeEnBase(reponse.corps.data.documentId);
  assert.strictEqual(enBase.lignes.length, 2, 'la demande doit contenir deux lignes');
});

test('ÉTAPE 1 — le demandeur LIT le stock réel (GET /api/materials)', async () => {
  // Sans cette lecture, l'écran « Demande » ne peut pas proposer le stock.
  const reponse = await api(
    'GET',
    '/api/materials?pagination[pageSize]=200&sort=designation:asc',
    null,
    'a'
  );
  assert.strictEqual(
    reponse.status,
    200,
    `le demandeur ne peut pas lire le stock : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const rows = reponse.corps?.data || [];
  assert.ok(rows.length > 0, 'le demandeur ne voit aucun matériel');
  const enStock = rows.filter((r) => Number(r.quantite_stock) > 0);
  assert.ok(
    enStock.length > 0,
    'aucun matériel ne renvoie de quantité de stock (quantite_stock absent ?)'
  );
  const stockVisible = enStock.find((r) => r.designation === 'Clavier disponible');
  assert.ok(stockVisible, 'la fiche de stock attendue est absente de la liste');
  assert.strictEqual(
    Number(stockVisible.quantite_stock),
    5,
    'la quantité de stock renvoyée est incorrecte'
  );
});

test('ÉTAPE 1 — le stock reste lisible SANS jeton (mode démo hors ligne)', async () => {
  // Un profil connecté via les comptes de DÉMONSTRATION n'a pas de jeton
  // Strapi : l'écran « Demande » doit tout de même pouvoir proposer le stock.
  const reponse = await api(
    'GET',
    '/api/materials?pagination[pageSize]=200&sort=designation:asc',
    null,
    null
  );
  assert.strictEqual(
    reponse.status,
    200,
    `lecture du stock sans jeton : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const rows = reponse.corps?.data || [];
  assert.ok(rows.length > 0, 'le stock est vide pour un lecteur anonyme');
  const premiere = rows[0];
  assert.ok(
    premiere.quantite_stock !== undefined,
    `quantite_stock absent de la réponse : ${Object.keys(premiere).join(", ")}`
  );
  assert.ok(
    rows.some((r) => Number(r.quantite_stock) > 0),
    'aucun matériel ne renvoie de quantité de stock'
  );
});

test('ÉTAPE 1 — le stock reste en ÉCRITURE INTERDITE au public', async () => {
  // La lecture du stock est publique : l'écriture ne doit surtout pas l'être.
  const reponse = await api('POST', '/api/materials', {
    data: { designation: 'Matériel injecté', quantite_stock: 999 },
  }, null);
  assert.strictEqual(
    reponse.status,
    403,
    `écriture anonyme du stock : HTTP ${reponse.status} au lieu de 403`
  );
  const apres = await strapi.documents('api::material.material').count();
  assert.ok(!/inject/i.test(apres.toString()), 'le stock a été modifié');
  const nomExiste = await strapi.documents('api::material.material').findMany({
    filters: { designation: { $eqi: 'Matériel injecté' } },
    limit: 1,
  });
  assert.strictEqual(
    nomExiste.length,
    0,
    'une fiche « Matériel injecté » a été créée par un visiteur anonyme'
  );
});

test('ÉTAPE 1 — la LECTURE renvoie les lignes (populate employé par le frontend)', async () => {
  // Mêmes paramètres que le frontend (`populate[lignes][populate][materiel]`).
  const lecture = await api(
    'GET',
    '/api/demandes?pagination[pageSize]=100&populate[lignes][populate][materiel]=true',
    null,
    'a'
  );
  assert.strictEqual(lecture.status, 200, `HTTP ${lecture.status}`);

  const lignesDe = (documentId) => {
    const row = (lecture.corps?.data || []).find((r) => r.documentId === documentId);
    return row ? row.lignes : undefined;
  };

  const lignesA = lignesDe(etat.documentIdA);
  assert.ok(
    Array.isArray(lignesA),
    'la réponse ne contient pas le tableau `lignes` attendu par le frontend'
  );
  assert.strictEqual(lignesA.length, 1, 'la demande doit exposer une ligne');
  assert.strictEqual(
    lignesA[0].designation,
    'Clavier disponible',
    'la ligne n\\expose pas la désignation du stock réel'
  );
  assert.strictEqual(lignesA[0].quantite, 1, 'la quantité de ligne est incorrecte');

  const lignesDeux = lignesDe(etat.documentIdDeuxLignes);
  assert.ok(Array.isArray(lignesDeux), 'les lignes de la demande à 2 lignes manquent');
  assert.strictEqual(lignesDeux.length, 2, 'les DEUX lignes doivent être renvoyées');
  assert.deepStrictEqual(
    lignesDeux.map((l) => l.designation).sort(),
    ['Clavier disponible', 'Ecran disponible'],
    'les désignations des lignes sont incorrectes'
  );
});

test('ÉTAPE 1 — le demandeur voit SES demandes (aujourd\'hui : aucune)', async () => {
  const liste = await api('GET', '/api/demandes?pagination[pageSize]=100', null, 'a');
  assert.strictEqual(liste.status, 200, `HTTP ${liste.status}`);
  const ids = (liste.corps?.data || []).map((row) => row.documentId);
  assert.ok(
    ids.includes(etat.documentIdA),
    `le demandeur ne voit pas sa propre demande (${ids.length} visible(s))`
  );
  const listeAutre = await api('GET', '/api/demandes?pagination[pageSize]=100', null, 'b');
  const idsAutre = (listeAutre.corps?.data || []).map((row) => row.documentId);
  assert.ok(
    !idsAutre.includes(etat.documentIdA),
    'un demandeur voit la demande d\'un autre'
  );
});

test('ÉTAPE 1 — la liste renvoie EXACTEMENT les libellés affichés par l\'écran', async () => {
  // REQUÊTE IDENTIQUE à celle du frontend (src/lib/demandes.ts →
  // fetchDemandesDetail) : c'est elle qui alimente « Liste de mes demandes ».
  const url =
    '/api/demandes?sort=date_demande:desc&pagination[pageSize]=100' +
    '&populate[direction]=true&populate[service]=true&populate[demandeur]=true' +
    '&populate[lignes][populate][materiel]=true';
  const lecture = await api('GET', url, null, 'a');
  assert.strictEqual(lecture.status, 200, `HTTP ${lecture.status}`);

  const row = (lecture.corps?.data || []).find((r) => r.documentId === etat.documentIdA);
  assert.ok(row, 'la demande du demandeur est absente de la liste');

  // L'écran affiche `direction.nom_direction` et `service.nom_service` :
  // sans peuplement, la liste afficherait « — » à la place.
  assert.strictEqual(
    row.direction?.nom_direction,
    'Direction des Ressources Humaines',
    'la direction n\'est pas peuplée comme l\'écran l\'attend'
  );
  assert.strictEqual(
    row.service?.nom_service,
    'Service Gestion Personnel',
    'le service n\'est pas peuplé comme l\'écran l\'attend'
  );
  // Les LIGNES de la demande (matériel, quantité, motif) sont là aussi.
  assert.ok(Array.isArray(row.lignes), 'les lignes de la demande sont absentes');
  assert.strictEqual(row.lignes.length, 1);
  assert.strictEqual(row.lignes[0].designation, 'Clavier disponible');
  assert.strictEqual(row.lignes[0].quantite, 1);
  // La relation `demandeur` est RETIRÉE par le sanitizer (aucun rôle ne peut
  // lire `plugin::users-permissions.user`) : l'écran ne doit pas en dépendre.
  assert.strictEqual(row.demandeur, undefined, 'la relation demandeur ne doit pas fuiter');
});

test('ÉTAPE 1 — la demande d\'un autre demandeur renvoie 404', async () => {
  const lecture = await api('GET', `/api/demandes/${etat.documentIdA}`, null, 'a');
  assert.strictEqual(
    lecture.status,
    200,
    `le propriétaire doit lire sa demande : HTTP ${lecture.status}`
  );
  const intrusion = await api('GET', `/api/demandes/${etat.documentIdA}`, null, 'b');
  assert.strictEqual(
    intrusion.status,
    404,
    `un autre demandeur ne doit rien voir : HTTP ${intrusion.status}`
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
