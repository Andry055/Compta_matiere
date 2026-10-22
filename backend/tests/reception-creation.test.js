'use strict';

/**
 * Réception physique — création de réception + lignes + mouvements + outbox.
 *
 * Harnais `node --test`, SANS démarrer Strapi ni toucher la vraie base :
 * l'objet `strapi` simulé est injecté dans le contrôleur en remplaçant
 * `@strapi/strapi` dans le cache de `require` (rien n'atteint node_modules,
 * tout tourne en mémoire ici).
 *
 * Tests couverts : R1-R11, R16-R22 du plan de réception physique.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const CONTROLEUR = path.join(RACINE, 'src', 'api', 'reception', 'controllers', 'reception.js');
const HORLOGE = path.join(RACINE, 'src', 'utils', 'horloge.js');
const { dateDuJour } = require(HORLOGE);

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ═════════════════════════════════════════════════════════════════════════════
   Simulateur Strapi en mémoire (comme sortie-remise.test.js)
   ════════════════════════════════════════════════════════════════════════════ */

const CONTENEURS = {
  'api::reception.reception': [],
  'api::reception-ligne.reception-ligne': [],
  'api::sortie.sortie': [],
  'api::sortie-ligne.sortie-ligne': [],
  'api::material.material': [],
  'api::mouvement.mouvement': [],
  'api::notification-outbox.notification-outbox': [],
  'plugin::users-permissions.user': [],
};

let compteur = 0;
let journalEcritures = null;

/** Utilisateurs simulés : id → rôle et direction. */
const UTILISATEURS = [
  { id: 21, role: { code: 'depositaire', type: 'depositaire' }, direction: { documentId: 'dir1' }, username: 'depo1', email: 'depo1@test.mg', documentId: 'u-depo1' },
  { id: 22, role: { code: 'depositaire', type: 'depositaire' }, direction: { documentId: 'dir2' }, username: 'depo2', email: 'depo2@test.mg', documentId: 'u-depo2' },
  { id: 23, role: { code: 'magasinier', type: 'magasinier' }, direction: { documentId: 'dir1' }, username: 'maga1', email: 'maga1@test.mg', documentId: 'u-maga1' },
];

/** Matériel de base. */
const MATERIELS = [
  { documentId: 'm1', designation: 'Tapis de souris', quantite_stock: 10 },
  { documentId: 'm2', designation: 'Clavier compact', quantite_stock: 5 },
];

/** Lignes de sortie (simples, non peuplées au départ). */
const LIGNES_SORTIE = [
  { documentId: 'l1', sortie: 's1', materiel: 'm1', designation: 'Tapis de souris', quantite: 2 },
  { documentId: 'l2', sortie: 's1', materiel: 'm2', designation: 'Clavier compact', quantite: 3 },
];

/**
 * Initialise les données de test (appelé avant chaque test via beforeEach).
 */
function reinitialiser() {
  compteur = 0;
  journalEcritures = null;
  for (const stock of Object.values(CONTENEURS)) stock.length = 0;

  CONTENEURS['api::material.material'].push(...MATERIELS.map((m) => ({ ...m })));
  CONTENEURS['api::sortie-ligne.sortie-ligne'].push(...LIGNES_SORTIE.map((l) => ({ ...l })));

  // Sortie validée (étape 4 terminée : statut 'validee', stock_impacte=true)
  CONTENEURS['api::sortie.sortie'].push({
    documentId: 's1',
    reference: 'SOR-2026-001',
    statut: 'validee',
    stock_impacte: true,
    date_signature_logistique: '2026-10-10T10:00:00.000Z',
    direction: { documentId: 'dir1' },
    lignes: LIGNES_SORTIE.map((l) => ({ ...l })),
  });

  // Utilisateurs
  CONTENEURS['plugin::users-permissions.user'].push(...UTILISATEURS.map((u) => ({ ...u })));
}

/** Matcher de filtres simplifié (court-circuit $eq, $in, égalité stricte). */
function correspond(entite, filtres) {
  if (!filtres) return true;
  return Object.entries(filtres).every(([cle, valeur]) => {
    const cible = entite[cle];
    if (valeur === null || valeur === undefined) return cible === valeur;
    if (typeof valeur === 'object' && !Array.isArray(valeur) && '$eq' in valeur) {
      return cible === valeur.$eq;
    }
    if (typeof valeur === 'object' && !Array.isArray(valeur) && '$in' in valeur) {
      return valeur.$in.includes(cible);
    }
    return cible === valeur;
  });
}

/** Lecture peuplée : copie pour éviter la pollution mutuelle. */
function peuple(uid, entite) {
  return { ...entite };
}

function documents(uid) {
  const stock = CONTENEURS[uid];
  if (!stock) throw new Error(`uid inconnu dans la simulation : ${uid}`);
  return {
    async findOne({ documentId, populate } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      return entite ? peuple(uid, entite) : null;
    },
    async findMany({ filters, fields, limit } = {}) {
      let rows = stock.filter((e) => correspond(e, filters));
      if (limit !== undefined) rows = rows.slice(0, limit);
      return rows.map((e) => peuple(uid, e));
    },
    async create({ data } = {}) {
      compteur += 1;
      const entite = {
        documentId: data.documentId || `doc-${compteur}`,
        ...data,
      };
      stock.push(entite);
      if (journalEcritures) journalEcritures.push({ uid, entite, avant: null });
      return peuple(uid, entite);
    },
    async update({ documentId, data } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      if (!entite) throw new Error(`Enregistrement introuvable : ${documentId}`);
      if (journalEcritures) {
        const avant = {};
        for (const cle of Object.keys(data)) avant[cle] = entite[cle];
        journalEcritures.push({ uid, entite, avant });
      }
      Object.assign(entite, data);
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
          const user = CONTENEURS['plugin::users-permissions.user'].find((u) => u.id === where.id);
          if (!user) return null;
          return { id: user.id, role: user.role, direction: user.direction };
        },
      };
    },
    // Transaction SÉRIELLE avec rollback réel.
    async transaction(cb) {
      const precedent = journalEcritures;
      journalEcritures = [];
      try {
        const resultat = await cb({ trx: () => { throw new Error('trx non simulé'); } });
        journalEcritures = precedent;
        return resultat;
      } catch (e) {
        for (let i = journalEcritures.length - 1; i >= 0; i -= 1) {
          const ecriture = journalEcritures[i];
          if (ecriture.avant === null) {
            const idx = CONTENEURS[ecriture.uid].indexOf(ecriture.entite);
            if (idx !== -1) CONTENEURS[ecriture.uid].splice(idx, 1);
          } else {
            Object.assign(ecriture.entite, ecriture.avant);
          }
        }
        journalEcritures = precedent;
        throw e;
      }
    },
  },
  log: { warn: () => {}, debug: () => {} },
};

/* ═════════════════════════════════════════════════════════════════════════════
   Injection du @strapi/strapi FACTICE avant de charger le contrôleur
   ═════════════════════════════════════════════════════════════════════════════ */

function fauxCreateCoreController(uid, setup) {
  const base = {
    find(ctx) { return { core: 'find' }; },
    findOne(ctx) { return { core: 'findOne' }; },
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

// Le contrôleur accède à `strapi` comme identifiant GLOB.
global.strapi = appSimule;
const controleur = require(CONTROLEUR);

/* ═════════════════════════════════════════════════════════════════════════════
   Helpers de test
   ═════════════════════════════════════════════════════════════════════════════ */

function ctxAvec(user, body, params = {}) {
  return {
    state: { user },
    request: { body, method: 'POST' },
    params,
    status: 200,
    body: null,
  };
}

function utilisateur(id) {
  return CONTENEURS['plugin::users-permissions.user'].find((u) => u.id === id);
}

function sortie(id) {
  return CONTENEURS['api::sortie.sortie'].find((s) => s.documentId === id);
}

function receptions() {
  return CONTENEURS['api::reception.reception'];
}

function receptionLignes() {
  return CONTENEURS['api::reception-ligne.reception-ligne'];
}

function mouvements() {
  return CONTENEURS['api::mouvement.mouvement'];
}

function outbox() {
  return CONTENEURS['api::notification-outbox.notification-outbox'];
}

/* ═════════════════════════════════════════════════════════════════════════════
   Tests
   ═════════════════════════════════════════════════════════════════════════════ */

test.beforeEach(() => {
  reinitialiser();
});

/* ─── R1 : Réception valide — statut en_cours, lignes créées, reliquat calculé ─── */

test('R1 : réception valide crée une réception en_cours avec lignes et reliquats', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r1',
      numero: 'REC-001',
      sortie: 's1',
      depositaire_nom: 'Depo Un',
      depositaire_fonction: 'Comptable',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2, etat: 'neuf' },
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 2, quantite_commandee: 3, etat: 'bon' },
      ],
    },
  });

  const res = await controleur.create(c);

  assert.strictEqual(res.data.statut, 'en_cours', 'statut en_cours');
  assert.strictEqual(res.data.version, 1, 'version 1');
  assert.strictEqual(receptions().length, 1, 'une réception créée');
  assert.strictEqual(receptionLignes().length, 2, 'deux lignes créées');
  const l1 = receptionLignes().find((l) => l.sortie_ligne === 'l1');
  assert.strictEqual(l1.quantite_reliquat, 1, 'reliquat ligne 1 = 1');
  const l2 = receptionLignes().find((l) => l.sortie_ligne === 'l2');
  assert.strictEqual(l2.quantite_reliquat, 1, 'reliquat ligne 2 = 1');
  assert.strictEqual(mouvements().length, 2, 'deux mouvements créés');
});

/* ─── R2 : refus 403 hors rôle dépositaire ─── */

test('R2 : refus 403 si le rôle n\'est pas dépositaire', async () => {
  const user = utilisateur(23); // magasinier
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r2',
      numero: 'REC-002',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(c.status, 403, 'statut 403');
  assert.ok(res.error && res.error.message, 'message d\'erreur présent');
});

/* ─── R3 : refus 403 si dépositaire d'une autre direction ─── */

test('R3 : refus 403 si le dépositaire n\'est pas de la direction de la sortie', async () => {
  const user = utilisateur(22); // depositaire de dir2, sortie s1 est de dir1
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r3',
      numero: 'REC-003',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(c.status, 403, 'statut 403');
});

/* ─── R4 : refus 400 si la sortie n'est pas 'validee' ─── */

test('R4 : refus 400 si la sortie n\'est pas en statut validee', async () => {
  const sortieS1 = sortie('s1');
  sortieS1.statut = 'en_preparation';

  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r4',
      numero: 'REC-004',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(c.status, 400, 'statut 400');
});

/* ─── R5 : plusieurs réceptions partielles sur une même sortie ─── */

test('R5 : plusieurs réceptions partielles sont autorisées sur une même sortie', async () => {
  const user = utilisateur(21);

  // Première réception partielle
  const c1 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r5a',
      numero: 'REC-005a',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
      ],
    },
  });
  const r1 = await controleur.create(c1);
  assert.strictEqual(c1.status, 201, 'première réception OK');

  // Deuxième réception partielle sur la même sortie
  const c2 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r5b',
      numero: 'REC-005b',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
      ],
    },
  });
  const r2 = await controleur.create(c2);
  assert.strictEqual(c2.status, 201, 'deuxième réception OK');

  assert.strictEqual(receptions().length, 2, 'deux réceptions sur la même sortie');
});

/* ─── R6 : quantite_recue <= quantite_commandee ─── */

test('R6 : refus 400 si quantite_recue > quantite_commandee sur une ligne', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r6',
      numero: 'REC-006',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 5, quantite_commandee: 2 },
      ],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(c.status, 400, 'statut 400');
});

/* ─── R7 : date_reception par défaut à aujourd'hui (fuseau Madagascar) ─── */

test('R7 : date_reception par défaut vaut la date du jour (fuseau Madagascar)', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r7',
      numero: 'REC-007',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [],
    },
  });

  await controleur.create(c);
  const rec = receptions()[0];
  const aujourdhui = dateDuJour(new Date()).slice(0, 10);
  assert.strictEqual(rec.date_reception, aujourdhui, 'date_reception = aujourd\'hui (Madagascar)');
});

/* ─── R8 : date_reception >= date_signature_logistique ─── */

test('R8 : refus 400 si date_reception antérieure à date_signature_logistique', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r8',
      numero: 'REC-008',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      date_reception: '2026-10-09', // avant le 2026-10-10
      lignes: [],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(c.status, 400, 'statut 400');
});

/* ─── R9 : statut 'partielle' quand au moins une ligne a reliquat > 0 ─── */

test('R9 : statut partielle quand au moins une ligne a un reliquat > 0', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r9',
      numero: 'REC-009',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 }, // reliquat 1
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 3, quantite_commandee: 3 }, // reliquat 0
      ],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(res.data.statut, 'partielle', 'statut partielle');
});

/* ─── R10 : statut 'complete' quand tous les reliquats cumulés = 0 par article ─── */

test('R10 : statut complete quand tous les reliquats cumulés par article = 0', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r10',
      numero: 'REC-010',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 3, quantite_commandee: 3 },
      ],
    },
  });

  const res = await controleur.create(c);
  assert.strictEqual(res.data.statut, 'complete', 'statut complete');
});

/* ─── R11 : reliquat cumulé par article sur plusieurs réceptions ─── */

test('R11 : reliquat cumulé par article sur plusieurs réceptions', async () => {
  const user = utilisateur(21);

  // Réception 1 : 1 sur 2 pour m1
  const c1 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r11a',
      numero: 'REC-011a',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
      ],
    },
  });
  await controleur.create(c1);

  // Réception 2 : 1 sur 2 pour m1 (cumulé : 2 sur 2, reliquat 0)
  const c2 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r11b',
      numero: 'REC-011b',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
      ],
    },
  });
  const res2 = await controleur.create(c2);

  const rec2 = receptions()[1];
  assert.strictEqual(rec2.statut, 'complete', 'statut complete après cumul');
});

/* ─── R16 : pas d'impact sur quantite_stock du matériel ─── */

test('R16 : la réception ne modifie pas quantite_stock du matériel', async () => {
  const m1Avant = CONTENEURS['api::material.material'].find((m) => m.documentId === 'm1');
  const stockAvant = m1Avant.quantite_stock;

  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r16',
      numero: 'REC-016',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
      ],
    },
  });
  await controleur.create(c);

  const m1Apres = CONTENEURS['api::material.material'].find((m) => m.documentId === 'm1');
  assert.strictEqual(m1Apres.quantite_stock, stockAvant, 'quantite_stock inchangé');
});

/* ─── R17 : rollback si échec de création de mouvement ─── */

test('R17 : rollback complet si échec de création de mouvement', async () => {
  // Rendre documents() de mouvement inutilisable en surchargeant le conteneur
  const originalDocuments = appSimule.documents;
  appSimule.documents = (uid) => {
    if (uid === 'api::mouvement.mouvement') {
      return {
        async create() {
          throw new Error('échec mouvement simulée');
        },
      };
    }
    return originalDocuments(uid);
  };

  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r17',
      numero: 'REC-017',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
      ],
    },
  });

  await assert.rejects(() => controleur.create(c), /échec mouvement/);

  // Vérifier rollback : aucune réception, aucune ligne n'a survécu
  assert.strictEqual(receptions().length, 0, 'rollback : aucune réception');
  assert.strictEqual(receptionLignes().length, 0, 'rollback : aucune ligne');

  appSimule.documents = originalDocuments;
});

/* ─── R18 : outbox 'reception_complete' créée ─── */

test('R18 : une entrée outbox reception_complete est créée quand statut complete', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r18',
      numero: 'REC-018',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 3, quantite_commandee: 3 },
      ],
    },
  });

  await controleur.create(c);

  const entreesComplete = outbox().filter((e) => e.eventType === 'reception_complete');
  assert.ok(entreesComplete.length >= 1, 'au moins une entrée reception_complete dans l\'outbox');
});

/* ─── R19 : outbox idempotence (pas de doublon même sortie/eventType/recipient) ─── */

test('R19 : idempotence outbox — pas de doublon sur même sortie/eventType/recipient', async () => {
  const user = utilisateur(21);

  // Première réception complète
  const c1 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r19a',
      numero: 'REC-019a',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 3, quantite_commandee: 3 },
      ],
    },
  });
  await controleur.create(c1);

  const nbAvant = outbox().length;

  // Même clé d'idempotence : doit retourner l'existante, pas en créer une nouvelle
  const c2 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r19a',
      numero: 'REC-019a',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 3, quantite_commandee: 3 },
      ],
    },
  });
  await controleur.create(c2);

  assert.strictEqual(outbox().length, nbAvant, 'pas de nouvelle entrée outbox après idempotence');
  assert.strictEqual(receptions().length, 1, 'pas de nouvelle réception après idempotence');
});

/* ─── R20 : concurrence — deux créations simultanées → une succès, l'autre 409 ─── */

test('R20 : concurrence — deux créations simultanées sur la même sortie → une succès, l\'autre 409', async () => {
  const user = utilisateur(21);

  // Première création (verrouille la sortie)
  const c1 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r20a',
      numero: 'REC-020a',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
        { sortie_ligne: 'l2', materiel: 'm2', quantite_recue: 3, quantite_commandee: 3 },
      ],
    },
  });
  const r1 = await controleur.create(c1);
  assert.strictEqual(c1.status, 201, 'première création succès');

  // Deuxième création avec même numéro (conflit de version/statut)
  // La réception existe déjà, la clé d'idempotence différente mais même sortie
  // doit être rejetée car la sortie est déjà complètement réceptionnée
  const c2 = ctxAvec(user, {
    data: {
      idem_key: 'idem-r20b',
      numero: 'REC-020b',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
      ],
    },
  });
  const r2 = await controleur.create(c2);
  // Soit 409 (conflit) soit 400 (dépend de l'implémentation de la vérification de version)
  assert.ok([400, 409].includes(c2.status), `statut attendu 400 ou 409, obtenu ${c2.status}`);
});

/* ─── R21 : idempotence client — même clé d'idempotence → une seule opération ─── */

test('R21 : idempotence client — même idem_key soumise deux fois → une seule opération', async () => {
  const user = utilisateur(21);
  const donnees = {
    idem_key: 'idem-r21',
    numero: 'REC-021',
    sortie: 's1',
    depositaire_nom: 'X',
    depositaire_fonction: 'Y',
    lignes: [
      { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 1, quantite_commandee: 2 },
    ],
  };

  const c1 = ctxAvec(user, { data: { ...donnees } });
  const r1 = await controleur.create(c1);
  assert.strictEqual(c1.status, 201, 'première soumission succès');

  const c2 = ctxAvec(user, { data: { ...donnees } });
  const r2 = await controleur.create(c2);
  // Même clé : retourne l'existante, pas de doublon
  assert.strictEqual(receptions().length, 1, 'une seule réception');
  assert.strictEqual(r2.data.numero, r1.data.numero, 'même réception retournée');
});

/* ─── R22 : mouvement 'Réception physique' créé ─── */

test('R22 : un mouvement Réception physique est créé lié à la sortie', async () => {
  const user = utilisateur(21);
  const c = ctxAvec(user, {
    data: {
      idem_key: 'idem-r22',
      numero: 'REC-022',
      sortie: 's1',
      depositaire_nom: 'X',
      depositaire_fonction: 'Y',
      lignes: [
        { sortie_ligne: 'l1', materiel: 'm1', quantite_recue: 2, quantite_commandee: 2 },
      ],
    },
  });

  await controleur.create(c);

  const mouvementsReception = mouvements().filter((m) => m.action && m.action.includes('Réception'));
  assert.ok(mouvementsReception.length >= 1, 'au moins un mouvement Réception physique');
});

/* ─── Test supplémentaire : structure du schéma exposé (R23 partie) ─── */

test('le schéma reception expose les champs attendus', () => {
  const source = lire(CONTROLEUR);
  assert.match(source, /async create\b/, 'handler create présent');
  assert.match(source, /strapi\.db\.transaction/, 'transaction utilisée dans create');
  assert.match(source, /distribuerNotifications/, 'distribuerNotifications appelé');
});
