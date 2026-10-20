'use strict';

/**
 * SONDE DE VÉRIFICATION — Étape 1 « Demande » (lecture seule, ne modifie rien).
 *
 * Vérifie numériquement, par de vrais appels HTTP, si la création d'une
 * demande respecte la règle :
 *   « Il choisit du matériel du STOCK RÉEL, des quantités, un motif.
 *     Sa DIRECTION vient de son COMPTE, jamais de l'écran.
 *     Une demande peut avoir plusieurs lignes. »
 *
 * Fichier NON exécuté par `node --test` (suffixe `.js`) :
 * `node tests/spike-etape1-demande.js`
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

const RACINE = path.resolve(__dirname, '..');
const BASE_FILE = path.join(os.tmpdir(), `compta-spike-etape1-${process.pid}.db`);
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
  const compte = async (type, identifiant, department) => {
    const role = await roleDe(type);
    return strapi.plugin('users-permissions').service('user').add({
      username: identifiant,
      email: `${identifiant}@example.local`,
      password: MOT_DE_PASSE,
      provider: 'local', confirmed: true, blocked: false,
      role: role.id, department, fonction: 'Chef de service',
    });
  };

  const demandeur = await compte('demandeur', 'spike-demandeur', 'DRH - Service du Personnel');
  const depositaire = await compte('depositaire', 'spike-depositaire', 'DAF - Magasin & Entrepôt');

  const dirCompte = await strapi.documents('api::direction.direction').create({
    data: { nom_direction: 'Direction des Ressources Humaines', abreviation: 'DRH' },
    status: 'published',
  });
  const dirEcran = await strapi.documents('api::direction.direction').create({
    data: { nom_direction: 'Direction Financière', abreviation: 'DAF' },
    status: 'published',
  });
  const svcEcran = await strapi.documents('api::service.service').create({
    data: { nom_service: 'Service Comptabilité Matière', direction: dirEcran.documentId },
    status: 'published',
  });
  const stock = await strapi.documents('api::material.material').create({
    data: { designation: 'Clavier du stock', quantite_stock: 2, statut: 'en_stock' },
  });

  const jeton = async (identifiant) => {
    const a = await appel('POST', '/api/auth/local', {
      identifier: `${identifiant}@example.local`, password: MOT_DE_PASSE,
    });
    return a.corps.jwt;
  };
  const jetonDemandeur = await jeton('spike-demandeur');
  const jetonDepositaire = await jeton('spike-depositaire');

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const corpsDemande = {
    type: 'sortie',
    designation_materiel: 'Matériel qui n existe pas au stock',
    quantite: 999999,
    motif: 'Test',
    statut: 'en_attente',
    date_demande: aujourdhui,
    direction: dirEcran.documentId,
    service: svcEcran.documentId,
  };

  // ── 1. Création par l'API, pour chaque rôle ────────────────────────────
  const parDemandeur = await appel('POST', '/api/demandes', { data: corpsDemande }, jetonDemandeur);
  const parDepositaire = await appel('POST', '/api/demandes', { data: corpsDemande }, jetonDepositaire);

  // ── 2. Écriture par le service document (seule voie qui fonctionne) ───
  const ecrite = await strapi.documents('api::demande.demande').create({
    data: {
      type: 'sortie',
      designation_materiel: 'Clavier du stock',
      quantite: 999999,          // stock réel = 2
      motif: 'Test',
      statut: 'en_attente',
      date_demande: aujourdhui,
      demandeur: demandeur.documentId,
      direction: dirEcran.documentId,   // direction IMPOSÉE par l'écran
      service: svcEcran.documentId,
    },
  });
  const lue = await appel(
    'GET',
    `/api/demandes/${ecrite.documentId}?populate[0]=direction&populate[1]=service`,
    null, jetonDemandeur
  );

  // ── 3. Deux lignes d'une même demande (groupe commun) ───────────────────
  const l1 = await strapi.documents('api::demande.demande').create({
    data: { reference: 'DEM-SPIKE-001', groupe: 'DEM-SPIKE-001', type: 'sortie',
      designation_materiel: 'Ligne 1', quantite: 1, motif: 'm1', statut: 'en_attente',
      date_demande: aujourdhui, demandeur: demandeur.documentId },
  });
  const l2 = await strapi.documents('api::demande.demande').create({
    data: { reference: 'DEM-SPIKE-001-2', groupe: 'DEM-SPIKE-001', type: 'sortie',
      designation_materiel: 'Ligne 2', quantite: 2, motif: 'm2', statut: 'en_attente',
      date_demande: aujourdhui, demandeur: demandeur.documentId },
  });
  const toutes = await strapi.documents('api::demande.demande').findMany({ limit: -1 });
  const duGroupe = toutes.filter((d) => d.groupe === 'DEM-SPIKE-001');
  const listeDemandeur = await appel('GET', '/api/demandes', null, jetonDemandeur);
  const listeDepositaire = await appel('GET', '/api/demandes', null, jetonDepositaire);
  const lueDepositaire = await appel(
    'GET',
    `/api/demandes/${ecrite.documentId}?populate[0]=direction&populate[1]=service`,
    null, jetonDepositaire
  );
  const schema = strapi.contentTypes['api::demande.demande'].attributes;

  console.log(JSON.stringify({
    '1. POST /api/demandes (demandeur)': {
      http: parDemandeur.status,
      erreur: parDemandeur.corps?.error?.message,
      cle_refusee: parDemandeur.corps?.error?.details?.key,
    },
    '2. POST /api/demandes (depositaire)': {
      http: parDepositaire.status,
      erreur: parDepositaire.corps?.error?.message,
      cle_refusee: parDepositaire.corps?.error?.details?.key,
    },
    '3. Direction enregistrée (écrite par le service document)': {
      direction_du_compte: demandeur.department,
      direction_enregistree: lueDepositaire.corps?.data?.direction?.nom_direction ?? null,
      service_enregistre: lueDepositaire.corps?.data?.service?.nom_service ?? null,
      quantite_enregistree: lueDepositaire.corps?.data?.quantite ?? null,
      relation_demandeur_exposee: 'demandeur' in (lueDepositaire.corps?.data ?? {}),
    },
    '3b. Lecture par le demandeur de SA demande': {
      http: lue.status,
      corps: lue.corps,
    },
    '4. Quantité demandée vs stock réel': {
      quantite_enregistree: lue.corps?.data?.quantite ?? null,
      quantite_en_stock: stock.quantite_stock,
      controle_de_stock: 'aucun (aucune relation vers `material` dans le schéma)',
    },
    '5. Plusieurs lignes': {
      relation_lignes_dans_le_schema: 'lignes' in schema ? 'oui' : 'NON',
      lignes_du_meme_groupe: duGroupe.length,
      statut_par_ligne: duGroupe.map((d) => d.statut),
    },
    '6. Contenu de la base /api/demandes': {
      total_en_base: toutes.length,
      visible_par_le_demandeur: listeDemandeur.corps?.data?.length ?? null,
      visible_par_le_depositaire: listeDepositaire.corps?.data?.length ?? null,
      cles_exposees_au_demandeur:
        Object.keys(listeDemandeur.corps?.data?.[0] ?? {}),
    },
  }, null, 2));

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
