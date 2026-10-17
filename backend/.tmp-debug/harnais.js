'use strict';

/**
 * Étape 4 du circuit de sortie — signature du chef logistique, validation
 * et BAISSE ATOMIQUE du stock.
 *
 * Harnais `node --test` SANS démarrer Strapi : l'objet `strapi` simulé
 * reproduit la couche couverte par le contrôleur —
 *   - `db.transaction(cb)` : transaction à annulation (snapshot pris à la
 *     première écriture, restauré au rollback — tout ou rien) ;
 *   - le builder Knex simulé `trx('sorties')` / `trx('materials')` (where /
 *     first / update / decrement, booléens 0/1 comme en SQLite) ;
 *   - `documents()` relié à la même transaction (AsyncLocalStorage, comme
 *     dans @strapi/database : deux transactions parallèllem àles portent
 *     chacune leur snapshot indépendant).
 *
 * Lacomposition RÉELLE (SQLite, concurrence vraie, colonne `document_id`,
 * booléens en base) est vérifiée séparément sur une base temporaire
 * réellement démarrée (tests d'intégration, base supprimée ensuite).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const CONTROLEUR = path.join(RACINE, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const ROUTES = path.join(RACINE, 'src', 'api', 'sortie', 'routes', 'sortie.js');
const INDEX = path.join(RACINE, 'src', 'index.js');

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ════════════════ Base SQL simulée (tables plates) ═══════════════════════ */

const TABLES = {
  sorties: [],
  materials: [],
  sortie_lignes: [],
  mouvements: [],
};

const CHAMPS_BOOL = new Set([
  'stock_impacte',
  'magasinier_signed',
  'depositaire_signed',
  'logistique_signed',
]);

function versSql(v) {
  if (v === true) return 1;
  if (v === false) return 0;
  return v;
}

function depuisSql(row) {
  const copie = { ...row };
  for (const cle of Object.keys(copie)) {
    if (CHAMPS_BOOL.has(cle)) copie[cle] = copie[cle] === 1;
  }
  if (row.document_id !== undefined) copie.documentId = row.document_id;
  return copie;
}

function laLigneCorrespond(row, preds) {
  return preds.every((p) => p(row));
}

/* ═══════════════════ Comptes, journal, transactions ═════════════════════ */

let compteurDocument = 0;
let echecTracageSimule = false;
const journal = { warns: [], decrementRows: [] };

/* ───────────── Moteur de « Knex » simulé (tables plates) ──────────────── */

/** Journal d'annulation : chaque transaction note SEULEMENT SES écritures —
 *  le rollback ne restaure RIEN de plus (contrairement à un snapshot global,
 *  qui écraserait les modifications concurrentes visibles de transactions
 *  non commitées — la simulation ne fait pas d'isolation). */
function noterEcriture(store, type, table, row, champsModifies) {
  if (!store || !store.journalTx) return; // hors transaction : irréversible
  const avant = {};
  for (const cle of champsModifies) avant[cle] = row[cle];
  store.journalTx.push({ type, table, row, avant });
}

/** Restaure une ligne modifiée à son état antérieur (référence conservée). */
function restaurer(stockLine, avant) {
  for (const cle of Object.keys(stockLine)) {
    if (!(cle in avant)) delete stockLine[cle];
  }
  Object.assign(stockLine, avant);
}

function builder(table, store) {
  const stock = TABLES[table];
  if (!stock) throw new Error(`Table simulée inconnue : ${table}`);
  const preds = [];

  const ajouterPred = (fn) => {
    preds.push(fn);
    return api;
  };

  const api = {
    where(...args) {
      if (args.length === 1 && args[0] && typeof args[0] === 'object') {
        for (const [cle, valeur] of Object.entries(args[0])) {
          const attendu = versSql(valeur);
          ajouterPred((row) => row[cle] === attendu);
        }
        return api;
      }
      if (args.length === 2) {
        const [col, valeur] = args;
        const attendu = versSql(valeur);
        ajouterPred((row) => row[col] === attendu);
        return api;
      }
      const [col, op, valeur] = args;
      ajouterPred((row) => {
        const a = Number(row[col]);
        const b = Number(valeur);
        if (op === '>=') return a >= b;
        if (op === '<=') return a <= b;
        if (op === '>') return a > b;
        if (op === '<') return a < b;
        return row[col] === valeur;
      });
      return api;
    },
    // Écritures : sous le journal d'annulation de la transaction courante.
    // Comme en SQL réel, un UPDATE/DÉCRÉMENTATION qui ne modifie aucune ligne
    // n'écrit RIEN : aucune entrée de journal, aucun rollback utile.
    update(champs) {
      const modifiees = [...stock].filter((row) => laLigneCorrespond(row, preds));
      for (const row of modifiees) {
        noterEcriture(store, 'modif', table, row, Object.keys(champs));
      }
      let nb = 0;
      for (const row of modifiees) {
        for (const [cle, valeur] of Object.entries(champs)) row[cle] = versSql(valeur);
        nb += 1;
      }
      return Promise.resolve(nb);
    },
    async decrement(col, pas = 1) {
      const modifiees = [...stock].filter((row) => laLigneCorrespond(row, preds));
      for (const row of modifiees) {
        noterEcriture(store, 'modif', table, row, [col]);
      }
      let nb = 0;
      for (const row of modifiees) {
        row[col] = Number(row[col]) - pas;
        nb += 1;
      }
      journal.decrementRows.push(nb);
      return nb;
    },
    async first(...cols) {
      const ligne = stock.find((row) => laLigneCorrespond(row, preds));
      if (!ligne) return undefined;
      if (cols.length > 0) {
        const extrait = {};
        for (const c of cols) extrait[c] = ligne[c];
        return extrait;
      }
      return { ...ligne };
    },
  };

  return api;
}

/* ─────── Transaction par pile d'appels (AsyncLocalStorage) ───────────── */

const { AsyncLocalStorage } = require('node:async_hooks');
const alsTrx = new AsyncLocalStorage();

const RELATIONS = {
  sortie: 'sortie_id',
  materiel: 'materiel_id',
  entree: 'entree_id',
};

/** FK à convertir PAR table : `mouvements.materiel` est un Champ TEXTE libre
 *  (désignation) — comme dans le schéma réel — il ne doit donc PAS être
 *  converti en colonne FK. */
const TABLES_RELATIONS = {
  sortie_lignes: { sortie: 'sortie_id', materiel: 'materiel_id' },
  mouvements: { sortie: 'sortie_id', entree: 'entree_id' },
  sorties: {},
  materials: {},
};

function platifier(row, table) {
  for (const [champ, colonne] of Object.entries(TABLES_RELATIONS[table] || {})) {
    if (row[champ] !== undefined) {
      row[colonne] = row[champ] && row[champ].documentId ? row[champ].documentId : row[champ];
      delete row[champ];
    }
  }
  for (const cle of Object.keys(row)) {
    if (CHAMPS_BOOL.has(cle)) row[cle] = versSql(row[cle]);
  }
}

function populerRelations(entite) {
  for (const [champ, colonne] of Object.entries(RELATIONS)) {
    if (entite[colonne] !== undefined) {
      entite[champ] = entite[champ].documentId ? entite[champ] : entite[colonne];
      if (!entite[champ].documentId) delete entite[champ];
      else delete entite[colonne];
    } else if (entite[champ] === undefined) {
      delete entite[champ];
    }
  }
  return entite;
}

function correspondRich(entite, filtres) {
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
      if ('$in' in valeur) return valeur.$in.includes(entite[cle]);
      const cible = entite[cle];
      if (cible && typeof cible === 'object') return correspondRich(cible, valeur);
      return false;
    }
    return entite[cle] === valeur;
  });
}

function populer(ouvrier, entite) {
  const copie = { ...entite };
  if (ouvrier === 'sorties') {
    copie.lignes = TABLES.sortie_lignes
      .filter((l) => l.sortie_id === entite.documentId)
      .map((l) => ({
        ...depuisSql(l),
        materiel: (() => {
          const m = TABLES.materials.find((mm) => mm.document_id === l.materiel_id);
          return m ? depuisSql(m) : null;
        })(),
      }));
    copie.mouvements = TABLES.mouvements
      .filter((m) => m.sortie_id === entite.documentId)
      .map((m) => depuisSql(m));
  }
  if (ouvrier === 'sortie_lignes' && entite.materiel_id) {
    const m = TABLES.materials.find((mm) => mm.document_id === entite.materiel_id);
    copie.materiel = m ? depuisSql(m) : null;
  }
  return copie;
}

/* ───────────────────────── Le strapi simulé ───────────────────────────── */

const appSimule = {
  db: {
    async transaction(cb) {
      const store = { journalTx: [] };
      try {
        return await alsTrx.run(store, () =>
          cb({ trx: (table) => builder(table, store) })
        );
      } catch (e) {
        // Rollback : seule LA transaction courante annule SES écritures.
        for (let i = store.journalTx.length - 1; i >= 0; i -= 1) {
          const ecriture = store.journalTx[i];
          if (ecriture.type === 'create') {
            const idx = TABLES[ecriture.table].indexOf(ecriture.row);
            if (idx !== -1) TABLES[ecriture.table].splice(idx, 1);
          } else {
            restaurer(ecriture.row, ecriture.avant);
          }
        }
        throw e;
      }
    },
    query(uid) {
      if (uid !== 'plugin::users-permissions.user') {
        throw new Error(`db.query non simulé pour : ${uid}`);
      }
      return {
        async findOne({ where } = {}) {
          const user = UTILISATEUR_SUJETS.find((u) => u.id === where.id);
          if (!user) return null;
          return { id: user.id, role: { code: user.roleType, type: user.roleType } };
        },
      };
    },
  },
  documents(uid) {
    const ouvrier = {
      'api::sortie.sortie': 'sorties',
      'api::sortie-ligne.sortie-ligne': 'sortie_lignes',
      'api::material.material': 'materials',
      'api::mouvement.mouvement': 'mouvements',
    }[uid];
    if (!ouvrier) throw new Error(`uid simulé inconnu : ${uid}`);
    const stock = TABLES[ouvrier];

    return {
      async findOne({ documentId, populate } = {}) {
        const row = stock.find((r) => r.document_id === documentId);
        if (!row) return null;
        return populer(ouvrier, depuisSql(row));
      },
      async findMany({ filters, fields, limit } = {}) {
        const rows = TABLES[ouvrier].map((r) => depuisSql(r))
          .filter((r) => correspondRich(r, filters))
          .map((r) => populer(ouvrier, r));
        const coupe = limit === -1 ? rows : rows.slice(0, limit || rows.length);
        if (fields && fields.length) {
          return coupe.map((r) => {
            const e = {};
            for (const f of fields) e[f] = r[f];
            return e;
          });
        }
        return coupe;
      },
      async create({ data } = {}) {
        if (uid === 'api::mouvement.mouvement' && echecTracageSimule) {
          throw new Error('Échec du traçage simulé (mouvements)');
        }
        const trxCourante = alsTrx.getStore();
        compteurDocument += 1;
        const row = { document_id: data.documentId || `doc-sql-${compteurDocument}` };
        Object.assign(row, data);
        if (row.lignes) delete row.lignes;
        platifier(row, ouvrier);
        stock.push(row);
        if (trxCourante) {
          trxCourante.journalTx.push({ type: 'create', table: ouvrier, row });
        }
        return populer(ouvrier, depuisSql(row));
      },
      async update({ documentId, data } = {}) {
        const trxCourante = alsTrx.getStore();
        const row = stock.find((r) => r.document_id === documentId);
        if (!row) throw new Error(`Enregistrement introuvable : ${documentId}`);
        if (trxCourante) {
          // État antérieur complet : restaure exactement la ligne (référence
          // conservée, clés ajoutées ou supprimées par platifier comprises).
          trxCourante.journalTx.push({ type: 'modif', table: ouvrier, row, avant: { ...row } });
        }
        Object.assign(row, data);
        platifier(row, ouvrier);
        return populer(ouvrier, depuisSql(row));
      },
    };
  },
  log: { warn(m) { journal.warns.push(m); } },
};

/* ─── Injection du @strapi/strapi FACTICE avant de charger le contrôleur ── */

function fauxCreateCoreController(uid, setup) {
  const base = {
    find() { return { core: 'find' }; },
    findOne() { return { core: 'findOne' }; },
  };
  const customs = setup({ strapi: appSimule });
  const objet = Object.create(base);
  Object.assign(objet, customs);
  return objet;
}

const cheminStrapi = require.resolve('@strapi/strapi');
require.cache[cheminStrapi] = {
  id: cheminStrapi,
  filename: cheminStrapi,
  loaded: true,
  exports: { factories: { createCoreController: fauxCreateCoreController } },
};

// `const app = strapi;` résout l'identifiant GLOBAL (comme en Strapi réel).
global.strapi = appSimule;
const controleur = require(CONTROLEUR);

/* ═══════════════════ Données et helpers de test ═══════════════════════════ */

const UTILISATEUR_SUJETS = [
  { id: 31, roleType: 'logistique', username: 'Razafindrakoto Tojo', email: 'tojo.razaf@mtefop.gov.mg', documentId: 'u-log' },
  { id: 32, roleType: 'depositaire', username: 'Rakotomalala Hery', email: 'hery.rakoto@mtefop.gov.mg', documentId: 'u-depo' },
  { id: 33, roleType: 'magasinier', username: 'Andriamampianina Fara', email: 'fara.andriam@mtefop.gov.mg', documentId: 'u-maga' },
  { id: 34, roleType: 'demandeur', username: 'Randriamampionona Tolotra', email: 'tolotra.randria@mtefop.gov.mg', documentId: 'u-dem' },
  { id: 35, roleType: 'comptable', username: 'Rasoa Naina', email: 'naina.rasoa@mtefop.gov.mg', documentId: 'u-comp' },
];

/** Sortie de test « toute fraîche » : AUCUNE signature posée. */
function creerSortie(documentId, lignes, extra = {}) {
  TABLES.sorties.push({
    document_id: documentId,
    reference: extra.reference || `SOR-2034-${String(TABLES.sorties.length + 1).padStart(3, '0')}`,
    date_sortie: '2034-03-03',
    statut: 'en_preparation',
    magasinier_signed: 0,
    depositaire_signed: 0,
    logistique_signed: 0,
    stock_impacte: 0,
    ...extra,
  });
  for (const l of lignes) {
    TABLES.sortie_lignes.push({
      document_id: l.document_id,
      sortie_id: documentId,
      materiel_id: l.materiel_id,
      designation: l.designation,
      quantite: l.quantite,
      numero_logistique: null,
    });
  }
}

function reinitialiser() {
  for (const t of Object.values(TABLES)) t.length = 0;
  compteurDocument = 0;
  echecTracageSimule = false;
  journal.warns.length = 0;
  journal.decrementRows.length = 0;

  TABLES.materials.push(
    { document_id: 'm1', designation: 'Tapis de souris', quantite_stock: 10 },
    { document_id: 'm2', designation: 'Clavier compact', quantite_stock: 5 }
  );
  creerSortie('s1', [
    { document_id: 'l1', materiel_id: 'm1', designation: 'Tapis de souris', quantite: 2 },
    { document_id: 'l2', materiel_id: 'm2', designation: 'Clavier compact', quantite: 3 },
  ], { reference: 'SOR-2034-001' });
}

function sortiePlate(documentId) {
  return TABLES.sorties.find((s) => s.document_id === documentId);
}

function materielPlate(documentId) {
  return TABLES.materials.find((m) => m.document_id === documentId);
}

function contexteAppel(documentId, corps, role) {
  return {
    params: { documentId },
    request: { body: corps === undefined ? undefined : { data: corps } },
    state: { user: UTILISATEUR_SUJETS.find((u) => u.roleType === role) },
    status: 200,
    body: null,
    query: {},
  };
}

/** Pose les signatures 1 (magasinier, avec controles) puis 2 (dépositaire). */
async function poserSignatures1et2(documentId, lignesIds) {
  const controles = lignesIds.map((id, i) => ({
    ligne: id,
    etat: i % 2 === 0 ? 'neuf' : 'bon',
  }));
  const r1 = await controleur.sign(
    contexteAppel(documentId, { role: 'magasinier', controles }, 'magasinier')
  );
  assert.strictEqual(r1.meta.statut, 'en_preparation', 'signature 1 posée');
  const r2 = await controleur.sign(
    contexteAppel(documentId, { role: 'depositaire' }, 'depositaire')
  );
  assert.strictEqual(r2.meta.statut, 'en_preparation', 'signature 2 posée');
}


module.exports = { TABLES, UTILISATEUR_SUJETS, controleur };
