'use strict';

/**
 * Test de la remise au détenteur (étape 5).
 *
 * Harnais `node --test`, SANS démarrer Strapi ni toucher la vraie base :
 * l'objet `strapi` simulé est injecté dans le contrôleur en remplaçant
 * `@strapi/strapi` dans le cache de `require` (rien n'atteint node_modules,
 * tout tourne en mémoire ici). Les données vivent dans des tableaux
 * réinitialisés entre les tests.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const CONTROLEUR = path.join(RACINE, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const ROUTES = path.join(RACINE, 'src', 'api', 'sortie', 'routes', 'sortie.js');
const SCHEMA = path.join(RACINE, 'src', 'api', 'sortie', 'content-types', 'sortie', 'schema.json');
const INDEX = path.join(RACINE, 'src', 'index.js');

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ────────────────────────── Objet `strapi` simulé ────────────────────────── */

const CONTENEURS = {
  'api::sortie.sortie': [],
  'api::sortie-ligne.sortie-ligne': [],
  'api::material.material': [],
  'api::mouvement.mouvement': [],
  'api::demande.demande': [],
};

let compteur = 0;
let journalAvertissements = [];

/** Utilisateurs de simulation : id → rôle (codé `type`, lu par getRoleCode). */
const UTILISATEURS = [
  { id: 21, roleType: 'magasinier', username: 'Andriamampianina Fara', email: 'fara.andriam@mtefop.gov.mg', documentId: 'u-maga' },
  { id: 22, roleType: 'depositaire', username: 'Rakotomalala Hery', email: 'hery.rakoto@mtefop.gov.mg', documentId: 'u-depo' },
  { id: 23, roleType: 'logistique', username: 'Razafindrakoto Tojo', email: 'tojo.razaf@mtefop.gov.mg', documentId: 'u-log' },
  { id: 24, roleType: 'demandeur', username: 'Randriamampionona Tolotra', email: 'tolotra.randria@mtefop.gov.mg', documentId: 'u-dem' },
  { id: 25, roleType: 'comptable', username: 'Rasoa Naina', email: 'naina.rasoa@mtefop.gov.mg', documentId: 'u-comp' },
];

/** Matcher filtres simplifié : court-circuit $startsWith / $eqi / $in,
 *  descente dans les relations (Demandeur → ses sorties) et égalité stricte. */
function correspond(entite, filtres) {
  if (!filtres) return true;
  return Object.entries(filtres).every(([cle, valeur]) => {
    if (valeur === null || valeur === undefined) return entite[cle] === valeur;
    if (typeof valeur === 'object' && !Array.isArray(valeur)) {
      if ('$startsWith' in valeur) {
        return String(entite[cle] == null ? '' : entite[cle]).startsWith(valeur.$startsWith);
      }
      if ('$eqi' in valeur) {
        return String(entite[cle] == null ? '' : entite[cle]).toLowerCase() ===
          String(valeur.$eqi).toLowerCase();
      }
      if ($in in valeur) {
        return valeur.$in.includes(entite[cle]);
      }
      const cible = entite[cle];
      if (cible && typeof cible === 'object') return correspond(cible, valeur);
      return false;
    }
    return entite[cle] === valeur;
  });
}

function materielDe(documentId) {
  const m = CONTENEURS['api::material.material'].find((e) => e.documentId === documentId);
  return m ? { ...m } : null;
}

/** Lecture « peuplée » : une sortie renvoie ses lignes (chacune avec son
 *  matériel), une ligne renvoie son matériel. Copie à chaque fois pour que
 *  la MUTATION d'une réponse de test ne pollue jamais le stock simulé. */
function peuple(uid, entite) {
  const copie = { ...entite };
  if (uid === 'api::sortie.sortie') {
    copie.lignes = CONTENEURS['api::sortie-ligne.sortie-ligne']
      .filter((l) => l.sortie === entite.documentId)
      .map((l) => ({
        ...l,
        materiel: l.materiel ? materielDe(l.materiel) : null,
      }));
    copie.mouvements = CONTENEURS['api::mouvement.mouvement'].filter(
      (m) => m.sortie === entite.documentId
    ).map((m) => ({ ...m }));
  }
  if (uid === 'api::demande.demande') {
    copie.sorties = CONTENEURS['api::sortie.sortie']
      .filter((s) => s.demande && s.demande.documentId === entite.documentId)
      .map((s) => ({ ...s }));
  }
  return copie;
}

function documents(uid) {
  const stock = CONTENEURS[uid];
  if (!stock) throw new Error(`uid inconnu dans la simulation : ${uid}`);
  return {
    async findOne({ documentId } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      return entite ? peuple(uid, entite) : null;
    },
    async findMany({ filters, limit } = {}) {
      const rows = stock.filter((e) => correspond(e, filters));
      const fin = limit === undefined ? rows.length : limit;
      return rows.slice(0, fin).map((e) => peuple(uid, e));
    },
    async create({ data } = {}) {
      compteur += 1;
      const entite = {
        documentId: data.documentId || `document-${compteur}`,
        ...data,
      };
      stock.push(entite);
      console.log('[TEST] Documents create called for uid:', uid);
      return peuple(uid, entite);
    },
    async update({ documentId, data } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      if (!entite) throw new Error(`Enregistrement introuvable : ${documentId}`);
      Object.assign(entite, data);
      console.log('[TEST] Documents update called for uid:', uid, 'documentId:', documentId);
      return peuple(uid, entite);
    },
  };
}

const appSimule = {
  documents,
  db: {
    query(uid) {
      if (uid !== 'plugin::users-permissions.user') {
        throw new Error(`db.query non simulé pour : ${uid}`);
      }
      return {
        async findOne({ where } = {}) {
          const user = UTILISATEURS.find((u) => u.id === where.id);
          if (!user) return null;
          // getRoleCode lit `role.code || role.type`.
          return { id: user.id, role: { code: user.roleType, type: user.roleType } };
        },
      };
    },
    // Mock transaction for remise method
    transaction: async (callback) => {
      // Pass a mock transaction object
      const mockTrx = {};
      console.log('[TEST] Transaction mock called');
      return await callback(mockTrx);
    }
  },
  log: {
    warn(message) {
      journalAvertissements.push(message);
    },
  },
};

/* ─── Injection du @strapi/strapi FACTICE avant de charger le contrôleur ─── */

function fauxCreateCoreController(uid, setup) {
  const base = {
    find(ctx) {
      return { core: 'find' };
    },
    findOne(ctx) {
      return { core: 'findOne' };
    },
  };
  const customs = setup({ strapi: appSimule });
  const objet = Object.create(base);
  Object.assign(objet, customs);
  // Reproduire l'accès global à strapi comme en production
  global.strapi = appSimule;
  return objet;
}

const cheminStrapi = require.resolve('@strapi/strapi');
require.cache[cheminStrapi] = {
  id: cheminStrapi,
  filename: cheminStrapi,
  loaded: true,
  exports: { factories: { createCoreController: fauxCreateCoreController } },
};

// Le contrôleur accède à `strapi` comme identifiant GLOB (global.strapi) :
// c'est ce que fait Strapi en production, on reproduit ici.
const controleur = require(CONTROLEUR);

/* ─────────────────────── Données de test réutilisables ──────────────────── */

function utilisateurParRole(type) {
  const { roleType, ...reste } = UTILISATEURS.find((u) => u.roleType === type);
  return reste;
}

function reinitialiser() {
  compteur = 0;
  journalAvertissements = [];
  for (const stock of Object.values(CONTENEURS)) stock.length = 0;

  // Matériel de base
  CONTENEURS['api::material.material'].push(
    { documentId: 'm1', designation: 'Tapis de souris', quantite_stock: 10 },
    { documentId: 'm2', designation: 'Clavier compact', quantite_stock: 5 }
  );

  // Lignes de sortie
  CONTENEURS['api::sortie-ligne.sortie-ligne'].push(
    { documentId: 'l1', sortie: 's1', materiel: 'm1', designation: 'Tapis de souris', quantite: 2 },
    { documentId: 'l2', sortie: 's1', materiel: 'm2', designation: 'Clavier compact', quantite: 3 },
  );

  // Demande liée à la sortie
  CONTENEURS['api::demande.demande'].push({
    documentId: 'd1',
    reference: 'DEM-2026-001',
    statut: 'approuvee', // This will allow the demande update to happen
  });

  // Sortie de base (étape 4 déjà effectuée : statut validee)
  CONTENEURS['api::sortie.sortie'].push({
    documentId: 's1',
    reference: 'SOR-2026-001',
    date_sortie: '2026-10-10',
    statut: 'validee', // Étape 4 terminée
    magasinier_signed: true,
    depositaire_signed: true,
    logistique_signed: true,
    date_signature_magasinier: '2026-10-10T08:00:00.000Z',
    date_signature_depositaire: '2026-10-10T09:00:00.000Z',
    date_signature_logistique: '2026-10-10T10:00:00.000Z',
    stock_impacte: true,
    demande: { documentId: 'd1' }, // Link to the demande we just created
  });
}

function sortieEnBase(documentId) {
  return CONTENEURS['api::sortie.sortie'].find((s) => s.documentId === documentId);
}

function ligneEnBase(documentId) {
  return CONTENEURS['api::sortie-ligne.sortie-ligne'].find((l) => l.documentId === documentId);
}

function materielEnBase(documentId) {
  return CONTENEURS['api::material.material'].find((m) => m.documentId === documentId);
}

function demandeEnBase(documentId) {
  return CONTENEURS['api::demande.demande'].find((d) => d.documentId === documentId);
}

function mouvementEnBase(documentId) {
  return CONTENEURS['api::mouvement.mouvement'].find((m) => m.documentId === documentId);
}

function contexteAppel(documentId, corps, role) {
  return {
    params: { documentId },
    request: { body: corps === undefined ? undefined : { data: corps } },
    state: { user: utilisateurParRole(role) },
    status: 200,
    body: null,
    query: {},
  };
}

/* ────────────────────────────── Étape 5 : remise au détenteur ────────────────────────────── */

test('remise simple : test basique', async () => {
  reinitialiser();
  const ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'magasinier');

  const reponse = await controleur.remise(ctx);

  // Print any warnings that were logged
  if (journalAvertissements.length > 0) {
    console.log('[TEST] Warnings logged during test:');
    journalAvertissements.forEach((msg, index) => {
      console.log(`  ${index + 1}: ${msg}`);
    });
  }

  assert.strictEqual(ctx.status, 200);
});