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
 *     dans @strapi/database : deux transactions parallèles portent
 *     chacune leur snapshot indépendant).
 *
 * La composition RÉELLE (SQLite, concurrence vraie, colonne `document_id`,
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

/** Restaure une ligne modifiée : SEULEMENT les champs notés au journal
 *  (la ligne reste intacte pour tout le reste — référence conservée). */
function restaurer(stockLine, avant) {
  for (const [cle, valeur] of Object.entries(avant)) stockLine[cle] = valeur;
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

/* ══════════════════════════ Scénarios de tests ═══════════════════════════ */

test('cycle complet : les 3 signatures valident, le stock baisse EXACTEMENT, mouvements tracés', async () => {
  reinitialiser();
  await poserSignatures1et2('s1', ['l1', 'l2']);

  const reponse = await controleur.sign(
    contexteAppel('s1', { role: 'logistique' }, 'logistique')
  );

  assert.strictEqual(reponse.meta.statut, 'validee');
  assert.strictEqual(reponse.meta.signatures, 3);

  // Stock débité EXACTEMENT : 10-2 = 8, 5-3 = 2.
  assert.strictEqual(materielPlate('m1').quantite_stock, 8, 'm1 : 10 - 2');
  assert.strictEqual(materielPlate('m2').quantite_stock, 2, 'm2 : 5 - 3');
  for (const nb of journal.decrementRows) {
    assert.strictEqual(nb, 1, 'une ligne modifiée par matériel');
  }

  const sortie = sortiePlate('s1');
  assert.strictEqual(sortie.statut, 'validee');
  assert.strictEqual(sortie.stock_impacte, 1);
  assert.strictEqual(sortie.logistique_signed, 1);
  assert.strictEqual(sortie.signataire_logistique, 'Razafindrakoto Tojo');
  assert.ok(!Number.isNaN(Date.parse(sortie.date_signature_logistique)), 'date de validation ISO');

  // Mouvements : 2 de l'étape 3 (Signature magasinier, Signature dépositaire)
  // + 3 de la validation (un par ligne + « Signature logistique »).
  const mouvements = TABLES.mouvements.filter((m) => m.sortie_id === 's1');
  assert.strictEqual(mouvements.length, 5);
  const parMateriel = mouvements.filter((m) => m.action === 'Sortie validée, stock débité');
  assert.deepStrictEqual(
    parMateriel.map((m) => `${m.materiel}:${m.quantite}`).sort(),
    ['Clavier compact:3', 'Tapis de souris:2']
  );
  const jourValidation = sortie.date_signature_logistique.slice(0, 10);
  for (const m of parMateriel) {
    assert.strictEqual(m.date_mouvement, jourValidation, 'mouvements au jour de la validation');
  }
  const signature = mouvements.find((m) => m.action === 'Signature logistique');
  assert.ok(signature, 'mouvement signature');
  assert.strictEqual(signature.quantite, 5, 'quantité totale sur le mouvement signature');
});

test('contrôles d entree : mauvais rôle 403, signatures manquantes 400 (nommées), double 409', async () => {
  reinitialiser();

  // a) Un dépositaire ne peut pas signer logistique.
  let ctx = contexteAppel('s1', { role: 'logistique' }, 'depositaire');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 403);

  // b) Une sortie dont AUCUNE signature n'est posée : premier manquant = magasinier.
  const s = sortiePlate('s1');
  s.magasinier_signed = 0;
  s.depositaire_signed = 0;
  ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /magasinier/);

  // c) Magasinier seul : premier manquant = dépositaire.
  s.magasinier_signed = 1;
  ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /depositaire/);

  // d) Double signature (statut encore en_preparation, drapeau déjà posé) : 409.
  s.depositaire_signed = 1;
  s.logistique_signed = 1;
  const avant = { m1: materielPlate('m1').quantite_stock, m2: materielPlate('m2').quantite_stock };
  ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 409);
  assert.strictEqual(materielPlate('m1').quantite_stock, avant.m1, 'aucun débit sur double');
  assert.strictEqual(materielPlate('m2').quantite_stock, avant.m2);
});

test('stock insuffisant sur une ligne parmi plusieurs : 409, RIEN ne change (preuve chiffrée)', async () => {
  reinitialiser();
  await poserSignatures1et2('s1', ['l1', 'l2']);
  // m1 a la place (10 >= 2) mais m2 a seulement 1 unité pour 3 demandées.
  materielPlate('m2').quantite_stock = 1;

  const avant = {
    m1: materielPlate('m1').quantite_stock,        // 10
    m2: materielPlate('m2').quantite_stock,        // 1
    statut: sortiePlate('s1').statut,
    impacte: sortiePlate('s1').stock_impacte,
    logistique: sortiePlate('s1').logistique_signed,
    nbMouvements: TABLES.mouvements.length,
  };

  const ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);

  assert.strictEqual(ctx.status, 409, '409 attendu');
  assert.match(ctx.body.error.message, /Stock insuffisant pour « Clavier compact »/);
  assert.match(ctx.body.error.message, /quantité demandée 3/);
  assert.match(ctx.body.error.message, /quantité disponible 1/);

  // ✧ PREUVE CHIFFRÉE : le stock est INTACT, rien n'a été débité.
  const apres = {
    m1: materielPlate('m1').quantite_stock,
    m2: materielPlate('m2').quantite_stock,
    statut: sortiePlate('s1').statut,
    impacte: sortiePlate('s1').stock_impacte,
    logistique: sortiePlate('s1').logistique_signed,
    nbMouvements: TABLES.mouvements.length,
  };
  // Le stock est INTACT (avant === après sur CHAQUE valeur, incl. les
  // mouvements de signatures de l'étape 3 déjà présents en base).
  assert.deepStrictEqual(avant, apres, 'avant === après, inchangé');
  assert.strictEqual(
    TABLES.mouvements.filter((m) => m.action === 'Sortie validée, stock débité').length,
    0,
    'aucun mouvement de validation'
  );
});

test('rejeu : une 2e signature logistique ne débite rien de plus', async () => {
  reinitialiser();
  await poserSignatures1et2('s1', ['l1', 'l2']);
  await controleur.sign(contexteAppel('s1', { role: 'logistique' }, 'logistique'));

  const apresPremiere = {
    m1: materielPlate('m1').quantite_stock, // 8
    m2: materielPlate('m2').quantite_stock, // 2
  };

  // 2e tentative : refusée.
  const ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);
  assert.ok(ctx.status === 400 || ctx.status === 409, 'refusée, peu importe le code exact');

  // Le stock n'a PAS re-débité.
  assert.strictEqual(materielPlate('m1').quantite_stock, apresPremiere.m1);
  assert.strictEqual(materielPlate('m2').quantite_stock, apresPremiere.m2);
  // Un mouvement par ligne + signature logistique (pas de doublon de
  // validation) + les 2 mouvements de signatures de l'étape 3 : 5 au total.
  assert.strictEqual(TABLES.mouvements.filter((m) => m.sortie_id === 's1').length, 5);
});

test('concurrence : deux signatures logistique simultanées — une seule valide', async () => {
  reinitialiser();
  // Les signatures 1-2 sont posées DANS LA BASE (pas via sign, pour que les
  // deux appels partent exactement en même temps).
  const s = sortiePlate('s1');
  s.magasinier_signed = 1;
  s.depositaire_signed = 1;

  const [r1, r2] = await Promise.all([
    controleur.sign(contexteAppel('s1', { role: 'logistique' }, 'logistique')),
    controleur.sign(contexteAppel('s1', { role: 'logistique' }, 'logistique')),
  ]);

  const statuses = [r1 && r1.meta && r1.meta.statut, r2 && r2.meta && r2.meta.statut];
  assert.strictEqual(
    statuses.filter((x) => x === 'validee').length,
    1,
    `exactement 1 validation (obtenu : ${JSON.stringify(statuses)})`
  );

  // Stock débité UNE SEULE fois, jamais négatif.
  assert.strictEqual(materielPlate('m1').quantite_stock, 8);
  assert.strictEqual(materielPlate('m2').quantite_stock, 2);
  assert.ok(materielPlate('m1').quantite_stock >= 0 && materielPlate('m2').quantite_stock >= 0);
  // Mouvements pour exactement UNE validation.
  assert.strictEqual(TABLES.mouvements.filter((m) => m.sortie_id === 's1').length, 3);
});

test('concurrence : deux sorties disputent un stock insuffisant — une seule réussit, jamais négatif', async () => {
  reinitialiser();
  // m1 : 3 unités ; chaque sortie en demande 2.
  materielPlate('m1').quantite_stock = 3;
  creerSortie('s2', [
    { document_id: 'l2b', materiel_id: 'm1', designation: 'Tapis de souris (S2)', quantite: 2 },
  ], { reference: 'SOR-2034-002' });
  const s2 = sortiePlate('s2');
  s2.magasinier_signed = 1;
  s2.depositaire_signed = 1;
  const s1 = sortiePlate('s1');
  s1.magasinier_signed = 1;
  s1.depositaire_signed = 1;

  const [r1, r2] = await Promise.all([
    controleur.sign(contexteAppel('s1', { role: 'logistique' }, 'logistique')),
    controleur.sign(contexteAppel('s2', { role: 'logistique' }, 'logistique')),
  ]);

  const validees = [r1, r2].filter((r) => r && r.meta && r.meta.statut === 'validee');
  assert.strictEqual(validees.length, 1, 'exactement une sortie validée');

  // Stock débité EXACTEMENT une fois : 3 - 2 = 1, jamais négatif.
  assert.strictEqual(materielPlate('m1').quantite_stock, 1);
  assert.ok(materielPlate('m1').quantite_stock >= 0, 'stock jamais négatif');
});

test('echec simulé du traçage : TOUT est annulé, le stock est intact', async () => {
  reinitialiser();
  const s = sortiePlate('s1');
  s.magasinier_signed = 1;
  s.depositaire_signed = 1;
  echecTracageSimule = true;

  const avant = {
    m1: materielPlate('m1').quantite_stock, // 10
    m2: materielPlate('m2').quantite_stock, // 5
    statut: sortiePlate('s1').statut,
    impacte: sortiePlate('s1').stock_impacte,
  };

  const ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  const reponse = await controleur.sign(ctx);
  void reponse;
  assert.strictEqual(ctx.status, 500, 'échec du traçage = validation échouée');
  assert.match(ctx.body.error.message, /annul/);

  // Tout est annulé (rollback).
  assert.strictEqual(materielPlate('m1').quantite_stock, avant.m1, 'stock m1 intact');
  assert.strictEqual(materielPlate('m2').quantite_stock, avant.m2, 'stock m2 intact');
  assert.strictEqual(sortiePlate('s1').stock_impacte, 0, 'stock_impacte reste false');
  assert.strictEqual(sortiePlate('s1').statut, 'en_preparation');
  assert.strictEqual(sortiePlate('s1').logistique_signed, 0, 'aucune signature');
  assert.strictEqual(TABLES.mouvements.length, 0, 'aucun mouvement');
  // Le rollback est réellement passé par la remise en état des tables.
  assert.ok(journal.warns.some((w) => /annul/.test(w)), 'l échec est journalisé');
});

test('sortie figée : une validee ne peut plus être signée ni rejetée', async () => {
  reinitialiser();
  await poserSignatures1et2('s1', ['l1', 'l2']);
  await controleur.sign(contexteAppel('s1', { role: 'logistique' }, 'logistique'));
  assert.strictEqual(sortiePlate('s1').statut, 'validee');

  // a) signature (n'importe quel rôle) : 400.
  let ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  ctx = contexteAppel('s1', {
    role: 'magasinier',
    controles: [{ ligne: 'l1', etat: 'neuf' }, { ligne: 'l2', etat: 'neuf' }],
  }, 'magasinier');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);

  // b) rejet : 400.
  ctx = contexteAppel('s1', { motif: 'après la validation' }, 'logistique');
  await controleur.reject(ctx);
  assert.strictEqual(ctx.status, 400);

  // c) AUCUNE route d'écriture résiduelle sur la routeur (GET/POST seulement,
  //    pas de PUT/PATCH/DELETE — et pas de route core update/delete).
  const mod = require(ROUTES);
  for (const route of mod.routes) {
    assert.ok(
      ['GET', 'POST'].includes(route.method),
      `méthode inattendue : ${route.method} ${route.path}`
    );
  }
});

test('numeros_logistiques : enregistrés TELS QUELS ; ligne etrangere, > 100 chars ou champ manquant : 400', async () => {
  reinitialiser();
  let s = sortiePlate('s1');
  s.magasinier_signed = 1;
  s.depositaire_signed = 1;

  // a) Enregistrés tels quels (espaces internes et casse préservés, pas de
  //    trim, pas de format imposé).
  let ctx = contexteAppel('s1', {
    role: 'logistique',
    numeros_logistiques: [
      { ligne: 'l1', numero_logistique: '  N-35 2025 /A  ' },
      { ligne: 'l2', numero_logistique: 'BL#9' },
    ],
  }, 'logistique');
  const reponse = await controleur.sign(ctx);
  assert.strictEqual(reponse.meta.statut, 'validee');
  const l1 = TABLES.sortie_lignes.find((l) => l.document_id === 'l1');
  const l2 = TABLES.sortie_lignes.find((l) => l.document_id === 'l2');
  assert.strictEqual(l1.numero_logistique, '  N-35 2025 /A  ', 'texte enregistré tel quel');
  assert.strictEqual(l2.numero_logistique, 'BL#9');

  // b) Ligne d'une AUTRE sortie : refusée, rien n'est signé ni débité.
  reinitialiser();
  TABLES.sortie_lignes.push({
    document_id: 'lX', sortie_id: 's2', materiel_id: 'm1',
    designation: 'Autre sortie', quantite: 1, numero_logistique: null,
  });
  s = sortiePlate('s1');
  s.magasinier_signed = 1;
  s.depositaire_signed = 1;
  ctx = contexteAppel('s1', {
    role: 'logistique',
    numeros_logistiques: [{ ligne: 'lX', numero_logistique: 'FAQ' }],
  }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /ne fait pas partie de cette sortie/);
  assert.strictEqual(sortiePlate('s1').logistique_signed, 0, 'aucune signature');
  assert.strictEqual(materielPlate('m1').quantite_stock, 10, 'aucun débit');

  // c) 101 caractères : refusé.
  reinitialiser();
  s = sortiePlate('s1');
  s.magasinier_signed = 1;
  s.depositaire_signed = 1;
  ctx = contexteAppel('s1', {
    role: 'logistique',
    numeros_logistiques: [{ ligne: 'l1', numero_logistique: 'A'.repeat(101) }],
  }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);

  // d) numero_logistique absent : refusé.
  ctx = contexteAppel('s1', {
    role: 'logistique',
    numeros_logistiques: [{ ligne: 'l1' }],
  }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);

  // e) 100 caractères exactement : accepté.
  reinitialiser();
  s = sortiePlate('s1');
  s.magasinier_signed = 1;
  s.depositaire_signed = 1;
  ctx = contexteAppel('s1', {
    role: 'logistique',
    numeros_logistiques: [{ ligne: 'l1', numero_logistique: 'B'.repeat(100) }],
  }, 'logistique');
  const ok = await controleur.sign(ctx);
  assert.strictEqual(ok.meta.statut, 'validee');
});

test('permissions : le périmètre logistique refuse ni Demandeur ni Comptable', () => {
  const source = lire(INDEX);
  const frappe = source.match(/const ROLES_SIGNATURE_SORTIE = \[[^\]]*\]/);
  assert.ok(frappe, 'ROLES_SIGNATURE_SORTIE déclarée');
  assert.doesNotMatch(frappe[0], /'demandeur'|'comptable'/);
});
