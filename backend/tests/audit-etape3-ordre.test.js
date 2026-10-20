'use strict';

/**
 * AUDIT — Étape 3 « Ordre de sortie » : le Dépositaire comptable transforme
 * une demande APPROUVÉE en ordre de sortie, par UN BOUTON.
 *
 * Défauts audités :
 *  1. aucun chemin ne permet de transformer une demande approuvée en ordre :
 *     le formulaire de distribution exige de ressaisir TOUT à la main
 *     (direction, lignes, pièce justificative) ;
 *  2. le préremplissage demandé (direction, lignes, justificatif = référence
 *     de la demande) n'existe pas ;
 *  3. RIEN n'empêche de créer DEUX ordres pour la même demande : la relation
 *     `sortie.demande` n'est pas unique et le contrôleur ne vérifiait rien ;
 *  4. une demande non approuvée peut être transformée en ordre.
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
const FICHIER_BASE = path.join(os.tmpdir(), `compta-etape3-${process.pid}.db`);
for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
  try { fs.rmSync(fichier, { force: true }); } catch (e) { /* base absente */ }
}
process.env.DATABASE_FILENAME = FICHIER_BASE;

const { createStrapi } = require('@strapi/strapi');

// Mot de passe PROVISOIRE des comptes de test (jetable, jamais affiché).
const MOT_DE_PASSE = 'Etp3-Tmp-2026';

let strapi = null;
let BASE = '';
const jetons = {};

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
    email: `${identifiant}.etp3@example.local`,
    password: MOT_DE_PASSE,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: role.id,
    department,
    fonction: 'Chef de service',
  });
}

/** Fiche de stock : le prix est obligatoire (sinon le serveur refuse l'ordre). */
async function creerMateriel(designation, quantiteStock, valeurUnitaire = 10000) {
  return strapi.documents('api::material.material').create({
    data: {
      designation,
      quantite_stock: quantiteStock,
      valeur_unitaire: valeurUnitaire,
      statut: 'en_stock',
    },
  });
}

async function jetonDe(identifiant) {
  const reponse = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      identifier: `${identifiant}.etp3@example.local`,
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
  await creerUtilisateur('demandeur', 'etp3-a', 'DRH - Service Gestion Personnel');
  await creerUtilisateur('depositaire', 'etp3-d', 'DF - Service Comptabilité');
  await creerUtilisateur('magasinier', 'etp3-m', 'DF - Magasin');
  await creerUtilisateur('comptable', 'etp3-c', 'DF - Service Budget');

  // ── Stock réel (chaque fiche porte un prix : sinon l'ordre est refusé) ──
  await creerMateriel('Ecran etape3 A', 5, 10000);
  await creerMateriel('Clavier etape3 A', 5, 20000);
  await creerMateriel('Ecran etape3 B', 5, 15000);
  await creerMateriel('Souris etape3 D', 5, 5000);
  await creerMateriel('Casque etape3 A', 5, 8000);

  jetons.a = await jetonDe('etp3-a');
  jetons.d = await jetonDe('etp3-d');
  jetons.m = await jetonDe('etp3-m');
  jetons.c = await jetonDe('etp3-c');

  // ── Demandes ────────────────────────────────────────────────────────────
  // dA : deux lignes, approuvée avec une quantité AJUSTÉE (3 -> 2).
  etat.dA = await creerDemande([
    { designation: 'Ecran etape3 A', quantite: 3 },
    { designation: 'Clavier etape3 A', quantite: 1 },
  ]);
  // dB : demande d'un seul matériel, approuvée telle quelle.
  etat.dB = await creerDemande([{ designation: 'Ecran etape3 B', quantite: 2 }]);
  // dC : jamais tranchée (reste « en_attente »).
  etat.dC = await creerDemande([{ designation: 'Casque etape3 A', quantite: 1 }]);
  // dD : approuvée, puis le stock baisse (commande déjà préparée ailleurs).
  etat.dD = await creerDemande([{ designation: 'Souris etape3 D', quantite: 3 }]);

  // dA : approbation avec ajustement (quantité demandée 3, approuvée 2).
  const approbationA = await api(
    'POST',
    `/api/demandes/${etat.dA}/approuver`,
    {
      data: {
        lignes: [
          { materiel: await documentIdMateriel('Ecran etape3 A'), quantite: 2 },
        ],
      },
    },
    'd'
  );
  assert.strictEqual(
    approbationA.status,
    200,
    `approbation de dA refusée : HTTP ${approbationA.status} — ${approbationA.corps?.error?.message}`
  );
  // dB et dD : approuvées sans ajustement.
  for (const id of [etat.dB, etat.dD]) {
    const approbation = await api('POST', `/api/demandes/${id}/approuver`, { data: {} }, 'd');
    assert.strictEqual(
      approbation.status,
      200,
      `approbation refusée : HTTP ${approbation.status} — ${approbation.corps?.error?.message}`
    );
  }
  // Le stock de dD baisse APRÈS l'approbation : l'ordre devra le re-vérifier.
  await strapi.documents('api::material.material').update({
    documentId: await documentIdMateriel('Souris etape3 D'),
    data: { quantite_stock: 1 },
  });
});

test.after(async () => {
  if (strapi) await strapi.destroy();
  for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
    try { fs.rmSync(fichier, { force: true }); } catch (e) { /* déjà absent */ }
  }
});

/* ═════════════════════════════ Utilitaires ════════════════════════════════ */

const etat = { dA: null, dB: null, dC: null, dD: null };

/** documentId de la fiche de stock portant cette désignation. */
async function documentIdMateriel(designation) {
  const rows = await strapi.documents('api::material.material').findMany({
    filters: { designation: { $eqi: designation } },
    fields: ['documentId'],
    limit: 1,
  });
  assert.ok(rows && rows.length === 1, `fiche « ${designation} » introuvable`);
  return rows[0].documentId;
}

/** Demande créée par le Demandeur (chemin nominal de l'étape 1). */
async function creerDemande(specs) {
  const lignes = [];
  for (const spec of specs) {
    lignes.push({
      materiel: await documentIdMateriel(spec.designation),
      quantite: spec.quantite,
      motif: 'Poste de travail',
    });
  }
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
        lignes,
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
    populate: {
      lignes: { populate: ['materiel'] },
      direction: true,
      service: true,
      sorties: true,
    },
  });
}

/** Ordres de sortie rattachés à une demande. */
function ordresDeLaDemande(documentId) {
  return strapi.documents('api::sortie.sortie').findMany({
    filters: { demande: { documentId } },
    populate: { lignes: { populate: ['materiel'] } },
    limit: -1,
  });
}

/* ═════════════════════════════ Tests HTTP ════════════════════════════════ */

test('ÉTAPE 3 — le Demandeur ne peut PAS créer un ordre de sortie', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.dB}/creer-ordre`,
    {},
    'a'
  );
  // 403 EXACTE : un 404 signifierait que la route n'existe pas (défaut
  // audité), pas que le rôle est refusé.
  assert.strictEqual(
    reponse.status,
    403,
    `le Demandeur ne doit jamais créer d'ordre : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const ordres = await ordresDeLaDemande(etat.dB);
  assert.strictEqual(
    ordres.length,
    0,
    'aucun ordre ne doit avoir été créé par le Demandeur'
  );
});

test('ÉTAPE 3 — seul le Dépositaire crée un ordre (magasinier et comptable refusés)', async () => {
  for (const role of ['m', 'c']) {
    const reponse = await api(
      'POST',
      `/api/demandes/${etat.dB}/creer-ordre`,
      {},
      role
    );
    assert.strictEqual(
      reponse.status,
      403,
      `le rôle « ${role} » ne doit pas pouvoir créer d'ordre : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
    );
  }
  const ordres = await ordresDeLaDemande(etat.dB);
  assert.strictEqual(
    ordres.length,
    0,
    'aucun ordre ne doit avoir été créé par les rôles non habilités'
  );
});

test('ÉTAPE 3 — une demande NON approuvée ne donne pas d’ordre', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.dC}/creer-ordre`,
    {},
    'd'
  );
  assert.strictEqual(
    reponse.status,
    400,
    `une demande « en_attente » ne doit pas produire d'ordre : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const ordres = await ordresDeLaDemande(etat.dC);
  assert.strictEqual(ordres.length, 0, 'aucun ordre ne doit avoir été créé');
});

test('ÉTAPE 3 — le Dépositaire crée l\'ordre PRÉREMPLI depuis la base', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.dA}/creer-ordre`,
    {},
    'd'
  );
  assert.strictEqual(
    reponse.status,
    201,
    `création de l'ordre refusée : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );

  const demande = await demandeEnBase(etat.dA);
  const ordre = reponse.corps?.data;
  assert.ok(ordre, 'la réponse doit porter l\'ordre créé');

  // 1. La demande d'origine est bien rattachée.
  assert.strictEqual(
    ordre.demande?.documentId,
    etat.dA,
    'l\'ordre doit être rattaché à la demande'
  );

  // 2. PIÈCE JUSTIFICATIVE = référence de la demande.
  assert.strictEqual(
    ordre.justificatif,
    demande.reference,
    'la pièce justificative doit être la référence de la demande'
  );
  assert.ok(
    /^DEM-\d{4}-\d{3}$/.test(demande.reference || ''),
    `la demande doit porter une référence DEM-AAAA-NNN (trouvé : ${demande.reference})`
  );

  // 3. DIRECTION et SERVICE : ceux de la demande (jamais ceux de l'écran).
  assert.strictEqual(
    ordre.direction?.documentId,
    demande.direction?.documentId,
    'la direction doit être celle de la demande'
  );
  assert.strictEqual(
    ordre.service?.documentId,
    demande.service?.documentId,
    'le service doit être celui de la demande'
  );

  // 4. LIGNES : mêmes matériels, quantités APPROUVÉES (2, pas 3).
  assert.strictEqual(ordre.lignes.length, 2, 'les deux lignes de la demande doivent suivre');
  const parMateriel = new Map();
  for (const ligne of ordre.lignes) {
    parMateriel.set(ligne.materiel?.documentId, ligne);
  }
  const ecran = await documentIdMateriel('Ecran etape3 A');
  const clavier = await documentIdMateriel('Clavier etape3 A');
  assert.strictEqual(
    parMateriel.get(ecran)?.quantite,
    2,
    'la quantité APPROUVÉE (2) doit être celle de l\'ordre, pas la demandée (3)'
  );
  assert.strictEqual(
    parMateriel.get(clavier)?.quantite,
    1,
    'la quantité de la seconde ligne doit être reprise telle quelle'
  );

  // 5. L'ordre entre dans le circuit de distribution : « en_preparation »,
  //    signature SOR-AAAA-NNN, stock NON débité à la création.
  assert.strictEqual(
    ordre.statut,
    'en_preparation',
    'l\'ordre doit démarrer « en_preparation » (circuit de distribution)'
  );
  assert.ok(
    /^SOR-\d{4}-\d{3}$/.test(ordre.reference || ''),
    `la référence de l'ordre doit être SOR-AAAA-NNN (trouvé : ${ordre.reference})`
  );
  assert.strictEqual(ordre.magasinier_signed, false, 'aucune signature ne doit être posée');
  assert.strictEqual(ordre.depositaire_signed, false, 'aucune signature ne doit être posée');
  assert.strictEqual(ordre.logistique_signed, false, 'aucune signature ne doit être posée');
  assert.strictEqual(ordre.stock_impacte, false, 'le stock ne doit pas être débité à la création');

  etat.ordreA = ordre.documentId;
  etat.referenceA = ordre.reference;
});

test('ÉTAPE 3 — UNE DEMANDE, UN ORDRE : le second ordre est refusé', async () => {
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.dA}/creer-ordre`,
    {},
    'd'
  );
  assert.strictEqual(
    reponse.status,
    409,
    `un second ordre pour la même demande doit être refusé en 409 : HTTP ${reponse.status}`
  );
  const ordres = await ordresDeLaDemande(etat.dA);
  assert.strictEqual(
    ordres.length,
    1,
    'la demande ne doit porter qu\'UN seul ordre'
  );
});

test('ÉTAPE 3 — le stock est re-vérifié AU MOMENT de la création de l\'ordre', async () => {
  // dD : approuvée pour 3 unités, mais le stock est retombé à 1 depuis.
  const reponse = await api(
    'POST',
    `/api/demandes/${etat.dD}/creer-ordre`,
    {},
    'd'
  );
  assert.strictEqual(
    reponse.status,
    400,
    `un stock insuffisant doit être refusé : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const ordres = await ordresDeLaDemande(etat.dD);
  assert.strictEqual(
    ordres.length,
    0,
    'aucun ordre ne doit avoir été créé (rien ne doit être écrit à moitié)'
  );
});

test('ÉTAPE 3 — l\'ordre créé par le bouton est VISIBLE dans le circuit de distribution', async () => {
  const reponse = await api('GET', '/api/sorties', null, 'm');
  assert.strictEqual(
    reponse.status,
    200,
    `lecture des sorties refusée : HTTP ${reponse.status}`
  );
  const trouve = (reponse.corps?.data || []).find(
    (sortie) => sortie.documentId === etat.ordreA
  );
  assert.ok(trouve, 'l\'ordre créé doit apparaître dans GET /api/sorties');
  assert.strictEqual(trouve.reference, etat.referenceA, 'la référence doit être celle de l\'ordre');
});

test('ÉTAPE 3 — la règle « une demande, un ordre » tient aussi sur le formulaire classique', async () => {
  // Le formulaire de distribution (POST /api/sorties/create-complete) reste
  // accessible au Dépositaire : il ne doit pas permettre de contourner la
  // règle en recréant un ordre pour une demande déjà sortie.
  const reponse = await api(
    'POST',
    '/api/sorties/create-complete',
    {
      data: {
        date_sortie: aujourdhui,
        justificatif: 'Contournement par le formulaire',
        direction_id: (await demandeEnBase(etat.dA)).direction?.documentId,
        lignes: [
          { materiel_id: await documentIdMateriel('Ecran etape3 A'), quantite: 1 },
        ],
        demande_id: etat.dA,
      },
    },
    'd'
  );
  assert.strictEqual(
    reponse.status,
    409,
    `le formulaire classique ne doit pas créer un second ordre : HTTP ${reponse.status} — ${reponse.corps?.error?.message}`
  );
  const ordres = await ordresDeLaDemande(etat.dA);
  assert.strictEqual(ordres.length, 1, 'la demande ne doit porter qu\'UN seul ordre');
});


