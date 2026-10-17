'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const CONTROLEUR = path.join(RACINE, 'src', 'api', 'sortie', 'controllers', 'sortie.js');

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ────────────────────────── Objet `strapi` simulé ────────────────────────── */

const CONTENEURS = {
  'api::sortie.sortie': [],
  'api::demande.demande': [],
  'api::mouvement.mouvement': [],
};

let compteur = 0;

function documents(uid) {
  const stock = CONTENEURS[uid];
  if (!stock) throw new Error(`uid inconnu dans la simulation : ${uid}`);
  return {
    async findOne({ documentId } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      return entite ? { ...entite } : null;
    },
    async create({ data } = {}) {
      compteur += 1;
      const entite = {
        documentId: data.documentId || `document-${compteur}`,
        ...data,
      };
      stock.push(entite);
      return { ...entite };
    },
    async update({ documentId, data } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      if (!entite) throw new Error(`Enregistrement introuvable : ${documentId}`);
      Object.assign(entite, data);
      return { ...entite };
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
          return { id: 1, role: { code: 'magasinier', type: 'magasinier' } };
        },
      };
    },
    // Mock transaction for remise method
    transaction: async (callback) => {
      // Pass a mock transaction object (remise doesn't use it, but we need to provide one)
      const mockTrx = {};
      return await callback(mockTrx);
    }
  },
  log: {
    warn(message) {
      console.log('[WARN]', message);
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

const controleur = require(CONTROLEUR);

/* ─────────────────────── Données de test réutilisables ──────────────────── */

function utilisateurParRole(type) {
  const roles = {
    magasinier: { id: 21, username: 'Test Magasinier', email: 'test@maga.mg', documentId: 'u-maga' },
    depositaire: { id: 22, username: 'Test Depositaire', email: 'test@depo.mg', documentId: 'u-depo' },
  };
  return roles[type];
}

function reinitialiser() {
  compteur = 0;
  for (const stock of Object.values(CONTENEURS)) stock.length = 0;

  // Create a demande linked to the sortie
  CONTENEURS['api::demande.demande'].push({
    documentId: 'd1',
    reference: 'DEM-2026-001',
    statut: 'approuvee', // This will allow the demande update to happen
  });

  CONTENEURS['api::sortie.sortie'].push({
    documentId: 's1',
    reference: 'SOR-2026-001',
    date_sortie: '2026-10-10',
    statut: 'validee',
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

  assert.strictEqual(ctx.status, 200);
});