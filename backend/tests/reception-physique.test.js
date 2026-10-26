'use strict';

/**
 * Tests backend du contrôleur de réception physique (/api/receptions-physiques).
 *
 * Conventions : node:test / node:assert, mock Strapi à la manière de
 * backend/tests/sortie-logistique.test.js. Aucun code applicatif n'est modifié.
 * Le seul fichier créé par cette mission est ce fichier de test.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const CONTROLEUR = path.join(RACINE, 'src', 'api', 'reception-physique', 'controllers', 'reception-physique.js');

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ═════════════════════════════════════════ Tables simulées ════════════════════════════════════════════ */

const TABLES = {
  'api::reception-physique.reception-physique': [],
  'api::sortie.sortie': [],
  'api::direction.direction': [],
};

let compteurDocument = 0;
const appelsSuper = { create: 0, find: 0, findOne: 0 };

/* ═══════════════════════════════════════════ État des appels de notification ══════════════════════════════════════════════════════════ */

const appelsNotification = { creerEntrees: 0, distribuerNotifications: 0 };
let dernierAppelCreerEntrees = null;
let dernierAppelDestinataires = null;
const tousAppelsCreerEntrees = [];
// 'ok' | 'erreurCreerEntrees' | 'erreurDistribuer' : force une échec pour tester la résilience.
let modeNotification = 'ok';

/* ═════════════════════════════════════════ Données de référence ════════════════════════════════════════════════════════ */

const UTILISATEURS = [
  { id: 101, roleType: 'demandeur', username: 'Randriamampionona Tolotra', email: 'tolotra.randria@mtefop.gov.mg', documentId: 'u-dem', department: 'Direction des Ressources Humaines - Service Gestion Personnel' },
  { id: 105, roleType: 'depositaire', username: 'Depositaire Test', email: 'dep@test.mg', documentId: 'u-dep', department: 'Direction des Ressources Humaines - Service Gestion Personnel' },
  { id: 102, roleType: 'magasinier', username: 'Magasinier Test', email: 'maga@test.mg', documentId: 'u-maga', department: 'Direction Logistique - Service Stock' },
  { id: 103, roleType: 'logistique', username: 'Logistique Test', email: 'log@test.mg', documentId: 'u-log', department: 'Direction Logistique - Service Approvisionnement' },
  { id: 104, roleType: 'comptable', username: 'Comptable Test', email: 'comp@test.mg', documentId: 'u-comp', department: 'Direction Financière - Service Comptabilité' },
];

const DIRECTIONS_SEED = [
  { documentId: 'd_drh', nom_direction: 'Direction des Ressources Humaines' },
  { documentId: 'd_dlog', nom_direction: 'Direction Logistique' },
  { documentId: 'd_df', nom_direction: 'Direction Financière' },
];

const SORTIES_SEED = [
  { document_id: 's_se_drh', reference: 'SOR-2026-001', statut: 'sortie_effectuee', direction: { documentId: 'd_drh' } },
  { document_id: 's_ep_drh', reference: 'SOR-2026-002', statut: 'en_preparation', direction: { documentId: 'd_drh' } },
  { document_id: 's_se_dlog', reference: 'SOR-2026-003', statut: 'sortie_effectuee', direction: { documentId: 'd_dlog' } },
  { document_id: 's_va_drh', reference: 'SOR-2026-004', statut: 'validee', direction: { documentId: 'd_drh' } },
  { document_id: 's_an_drh', reference: 'SOR-2026-005', statut: 'annulee', direction: { documentId: 'd_drh' } },
];

const RECEPTIONS_SEED = [
  { document_id: 'r1', sortie: { documentId: 's_se_drh', direction: { documentId: 'd_drh' } }, date_reception: '2026-10-25T10:00:00.000Z', statut: 'conforme', quantite_prevue: 10, quantite_recue: 8, utilisateur: 'Randriamampionona Tolotra' },
  { document_id: 'r2', sortie: { documentId: 's_se_dlog', direction: { documentId: 'd_dlog' } }, date_reception: '2026-10-24T10:00:00.000Z', statut: 'anomalie', quantite_prevue: 5, quantite_recue: 3, utilisateur: 'Autre Utilisateur' },
];

/* ══════════════════════════════════════════ Helpers de correspondance ═══════════════════════════════════════════════════════════ */

function correspondRich(entite, filtres) {
  if (!filtres) return true;
  return Object.entries(filtres).every(([cle, valeur]) => {
    // Opérateur logique OU au niveau du filtre (ex. { $or: [...] } utilisé par getDirectionIds).
    if (cle === '$or') {
      return Array.isArray(valeur) && valeur.some((condition) => correspondRich(entite, condition));
    }
    if (valeur === null || valeur === undefined) return entite[cle] === valeur;
    if (typeof valeur === 'object' && !Array.isArray(valeur)) {
      if ('$startsWith' in valeur) {
        return String(entite[cle] == null ? '' : entite[cle]).startsWith(valeur.$startsWith);
      }
      if ('$eqi' in valeur) {
        return String(entite[cle] == null ? '' : entite[cle]).toLowerCase() === String(valeur.$eqi).toLowerCase();
      }
      if ('$in' in valeur) return valeur.$in.includes(entite[cle]);
      const cible = entite[cle];
      if (cible && typeof cible === 'object') return correspondRich(cible, valeur);
      return false;
    }
    return entite[cle] === valeur;
  });
}

function reinitialiser() {
  for (const t of Object.values(TABLES)) t.length = 0;
  TABLES['api::direction.direction'].push(...DIRECTIONS_SEED.map((d) => ({ ...d })));
  TABLES['api::sortie.sortie'].push(...SORTIES_SEED.map((s) => ({ ...s })));
  TABLES['api::reception-physique.reception-physique'].push(...RECEPTIONS_SEED.map((r) => ({ ...r })));
  compteurDocument = 0;
  appelsSuper.create = 0;
  appelsSuper.find = 0;
  appelsSuper.findOne = 0;
  appelsNotification.creerEntrees = 0;
  appelsNotification.distribuerNotifications = 0;
  dernierAppelCreerEntrees = null;
  dernierAppelDestinataires = null;
  tousAppelsCreerEntrees.length = 0;
  modeNotification = 'ok';
}

/* ══════════════════════════════════════════ Objet strapi simulé ══════════════════════════════════════════════════════════════ */

const appSimule = {
  db: {
    query(uid) {
      if (uid !== 'plugin::users-permissions.user') {
        throw new Error(`db.query non simulé pour : ${uid}`);
      }
      return {
        async findOne({ where } = {}) {
          const user = UTILISATEURS.find((u) => u.id === where.id);
          if (!user) return null;
          return { id: user.id, role: { code: user.roleType, type: user.roleType } };
        },
      };
    },
  },
  documents(uid) {
    const stock = TABLES[uid];
    if (!stock) throw new Error(`uid simulé inconnu : ${uid}`);
    return {
      async findOne({ documentId, populate } = {}) {
        const row = stock.find((r) => r.document_id === documentId);
        if (!row) return null;
        return { ...row };
      },
      async findMany({ filters, fields, limit } = {}) {
        let rows = stock.map((r) => ({ ...r }));
        if (filters) {
          rows = rows.filter((r) => correspondRich(r, filters));
        }
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
        compteurDocument += 1;
        const row = { document_id: data.documentId || `doc-sql-${compteurDocument}` };
        Object.assign(row, data);
        stock.push(row);
        return { ...row };
      },
    };
  },
  log: { warn(m) {} },
};

/* ══════════════════════════════════════════ Base des méthodes super ═══════════════════════════════════════════════════════════════ */

const baseMethodes = {
  async create(ctx) {
    appelsSuper.create++;
    ctx.status = 201;
    return { data: { documentId: 'doc-recep-1', id: 1 } };
  },
  async find(ctx) {
    appelsSuper.find++;
    return { data: [] };
  },
  async findOne(ctx) {
    appelsSuper.findOne++;
    return { data: {} };
  },
};

function fauxCreateCoreController(uid, setup) {
  const customs = setup({ strapi: appSimule });
  // Object.setPrototypeOf garantit que super.create/find/findOne résout
  // vers baseMethodes (les méthodes conservent leur [[HomeObject]] car
  // définies dans l'objet littéral retourné par setup()).
  Object.setPrototypeOf(customs, baseMethodes);
  return customs;
}

/* ══════════════════════════════════════════ Mock @strapi/strapi ══════════════════════════════════════════════════════════════════════ */

const cheminStrapi = require.resolve('@strapi/strapi');
require.cache[cheminStrapi] = {
  id: cheminStrapi,
  filename: cheminStrapi,
  loaded: true,
  exports: { factories: { createCoreController: fauxCreateCoreController } },
};

/* ═══════════════════════════════════════════ Mocks modules de notification ════════════════════════════════════════════════════════════════ */

const magasinierRef = UTILISATEURS.find((u) => u.roleType === 'magasinier');
const depositaireRef = UTILISATEURS.find((u) => u.roleType === 'depositaire');

const cheminDestinataires = require.resolve(path.join(RACINE, 'src', 'utils', 'destinatairesNotifications.js'));
require.cache[cheminDestinataires] = {
  id: cheminDestinataires,
  filename: cheminDestinataires,
  loaded: true,
  exports: {
    findUtilisateursParRoleEtDirection: async (app, roleCode, directionId) => {
      dernierAppelDestinataires = { roleCode, directionId };
      if (roleCode === 'magasinier') return [magasinierRef];
      if (roleCode === 'demandeur') return [depositaireRef];
      return [];
    },
  },
};

const cheminNotifOutbox = require.resolve(path.join(RACINE, 'src', 'api', 'notification-outbox', 'services', 'notification-outbox.js'));
require.cache[cheminNotifOutbox] = {
  id: cheminNotifOutbox,
  filename: cheminNotifOutbox,
  loaded: true,
  exports: {
    creerEntrees: async (app, sortieDocumentId, destinataires, role, payload) => {
      appelsNotification.creerEntrees++;
      dernierAppelCreerEntrees = { sortieDocumentId, destinataires, role, payload };
      tousAppelsCreerEntrees.push({ sortieDocumentId, destinataires, role, payload });
      if (modeNotification === 'erreurCreerEntrees') {
        throw new Error('Outbox indisponible (test)');
      }
    },
    distribuerNotifications: async (app) => {
      appelsNotification.distribuerNotifications++;
      if (modeNotification === 'erreurDistribuer') {
        throw new Error('Distributeur indisponible (test)');
      }
      return { traitees: 0, envoyees: 0, echecs: 0 };
    },
  },
};

global.strapi = appSimule;
const controleur = require(CONTROLEUR);

/* ══════════════════════════════════════════ Contexte d'appel ══════════════════════════════════════════════════════════════════════════ */

function contexteAppel(corps, utilisateur) {
  return {
    params: {},
    request: { body: corps === undefined ? undefined : { data: corps } },
    state: { user: utilisateur },
    status: 200,
    body: null,
    query: {},
  };
}

/* ═══════════════════════════════════════════ Scénarios de tests ═════════════════════════════════════════════════════════════════════════ */

test('Test 1 — Création autorisée : demandeur valide, sortie sortie_effectuee, même direction', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh',
      date_reception: '2026-10-25T10:00:00.000Z',
      statut: 'conforme',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  assert.strictEqual(ctx.status, 201, 'statut 201 attendu en cas de succès');
  assert.strictEqual(resultat.data.documentId, 'doc-recep-1', 'réception créée');
});

test('Test 1bis — Création autorisée : depositaire valide, sortie sortie_effectuee, même direction', async () => {
  reinitialiser();

  const depositaire = UTILISATEURS.find((u) => u.roleType === 'depositaire');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh',
      date_reception: '2026-10-25T10:00:00.000Z',
      statut: 'conforme',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: depositaire.username,
    },
    depositaire
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  assert.strictEqual(ctx.status, 201, 'statut 201 attendu en cas de succès');
  assert.strictEqual(resultat.data.documentId, 'doc-recep-1', 'réception créée');
});

test('Test 2 — Absence d\'authentification', async () => {
  reinitialiser();

  const ctx = contexteAppel(
    { sortieId: 's_se_drh', date_reception: '2026-10-25T10:00:00.000Z', quantite_prevue: 10, quantite_recue: 8, utilisateur: 'x' },
    null
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour requête non authentifiée');
  assert.match(resultat.error.message, /Authentification requise/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 3 — Rôle non autorisé (magasinier)', async () => {
  reinitialiser();

  const magasinier = UTILISATEURS.find((u) => u.roleType === 'magasinier');
  const ctx = contexteAppel(
    { sortieId: 's_se_drh', date_reception: '2026-10-25T10:00:00.000Z', quantite_prevue: 10, quantite_recue: 8, utilisateur: magasinier.username },
    magasinier
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour rôle non demandeur');
  assert.match(resultat.error.message, /demandeur/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 4 — Sortie d\'une autre direction', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur'); // DRH → directionIds = ['d_drh']
  const ctx = contexteAppel(
    {
      sortieId: 's_se_dlog', // Direction Logistique, pas DRH
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour mauvaise direction');
  assert.match(resultat.error.message, /direction/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 4bis — Sortie d\'une autre direction (depositaire refusé)', async () => {
  reinitialiser();

  const depositaire = UTILISATEURS.find((u) => u.roleType === 'depositaire'); // DRH → directionIds = ['d_drh']
  const ctx = contexteAppel(
    {
      sortieId: 's_se_dlog', // Direction Logistique, pas DRH
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: depositaire.username,
    },
    depositaire
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour mauvaise direction');
  assert.match(resultat.error.message, /direction/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 5 — Statut de sortie incorrect (en_preparation)', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_ep_drh', // statut en_preparation
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 400, '400 attendu pour statut incorrect');
  assert.match(resultat.error.message, /effectuée/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 6 — sortieId absent', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 400, '400 attendu quand sortieId absent');
  assert.match(resultat.error.message, /référence de la sortie/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 7 — Sortie introuvable', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_inexistante',
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour sortie introuvable');
  assert.match(resultat.error.message, /Sortie introuvable/);
  assert.strictEqual(appelsSuper.create, 0, 'super.create ne doit pas être appelé');
});

test('Test 8 — Liste et filtrage par direction (find)', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur'); // DRH → directionIds = ['d_drh']
  const ctx = contexteAppel(undefined, demandeur);

  const resultat = await controleur.find(ctx);

  assert.strictEqual(appelsSuper.find, 1, 'super.find doit être appelé');
  assert.ok(ctx.query.filters, 'un filtre doit être construit');
  assert.deepStrictEqual(ctx.query.filters, {
    sortie: { direction: { documentId: { $in: ['d_drh'] } } },
  }, 'le filtre de direction doit cibler la direction du demandeur');
});

test('Test 8bis — findOne : réception de la direction du demandeur autorisée', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur'); // DRH → directionIds = ['d_drh']
  const ctx = contexteAppel(undefined, demandeur);
  ctx.params = { documentId: 'r1' }; // r1 a pour sortie s_se_drh (direction d_drh)

  const resultat = await controleur.findOne(ctx);

  assert.strictEqual(appelsSuper.findOne, 1, 'super.findOne doit être appelé');
  assert.strictEqual(resultat.data.documentId, undefined, 'super.findOne retourné tel quel');
});

test('Test 8ter — findOne : réception d\'une autre direction refusée', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur'); // DRH → directionIds = ['d_drh']
  const ctx = contexteAppel(undefined, demandeur);
  ctx.params = { documentId: 'r2' }; // r2 a pour sortie s_se_dlog (direction d_dlog)

  const resultat = await controleur.findOne(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour réception d\'une autre direction');
  assert.match(resultat.error.message, /direction/);
  assert.strictEqual(appelsSuper.findOne, 0, 'super.findOne ne doit pas être appelé');
});

test('Test 9 — Transmission des champs obligatoires à la création', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const corps = {
    sortieId: 's_se_drh',
    date_reception: '2026-10-25T10:00:00.000Z',
    statut: 'conforme',
    quantite_prevue: 10,
    quantite_recue: 8,
    utilisateur: demandeur.username,
    type_anomalie: 'endommage',
    description_anomalie: 'Matériel rayé',
  };
  const ctx = contexteAppel(corps, demandeur);

  await controleur.create(ctx);

  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  const donnees = ctx.request.body.data;
  assert.strictEqual(donnees.sortie, 's_se_drh', 'sortieId converti en relation sortie avant super.create');
  assert.strictEqual(donnees.sortieId, undefined, 'sortieId retiré du corps avant super.create');
  assert.strictEqual(donnees.date_reception, '2026-10-25T10:00:00.000Z', 'date_reception transmis');
  assert.strictEqual(donnees.quantite_prevue, 10, 'quantite_prevue transmis');
  assert.strictEqual(donnees.quantite_recue, 8, 'quantite_recue transmis');
  assert.strictEqual(donnees.utilisateur, demandeur.username, 'utilisateur transmis');
  assert.strictEqual(donnees.type_anomalie, 'endommage', 'type_anomalie transmis');
  assert.strictEqual(donnees.description_anomalie, 'Matériel rayé', 'description_anomalie transmis');
  // Limite : ce test unitaire vérifie la transmission au contrôleur/Strapi,
  // non la persistance réelle en base de données.
});

test('Test 10 — Absence de débit de stock', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh',
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  await controleur.create(ctx);

  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  // Le service est createCoreService (aucune logique personnalisée) et le
  // contrôleur n'accède jamais à la table materials. Aucune table materials
  // n'est déclarée dans la simulation : aucun débit de stock n'est déclenché.
  assert.ok(!TABLES.materials, 'aucune table materials n\'est touchée par le parcours de réception');
});

test('Test 11 — Gestion des erreurs Strapi sur super.create', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const corps = {
    sortieId: 's_se_drh',
    date_reception: '2026-10-25T10:00:00.000Z',
    quantite_prevue: 10,
    quantite_recue: 8,
    utilisateur: demandeur.username,
  };

  const createOriginal = baseMethodes.create;
  baseMethodes.create = async () => {
    throw new Error('Erreur base de données simulée');
  };

  const ctx = contexteAppel(corps, demandeur);

  await assert.rejects(
    () => controleur.create(ctx),
    /Erreur base de données simulée/
  );

  baseMethodes.create = createOriginal;
});

/* ═══════════════════════════════════════════ Tests de notification magasinier ══════════════════════════════════════════════════════════════ */

test('Test 12 — Notification envoyée au magasinier de la direction de la sortie en cas de succès', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur'); // DRH → directionIds = ['d_drh']
  const magasinier = UTILISATEURS.find((u) => u.roleType === 'magasinier');
  const depositaire = UTILISATEURS.find((u) => u.roleType === 'depositaire');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh', // statut sortie_effectuee, direction d_drh
      date_reception: '2026-10-25T10:00:00.000Z',
      statut: 'conforme',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 201, 'statut 201 attendu en cas de succès');
  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  assert.strictEqual(appelsNotification.creerEntrees, 2, 'creerEntrees doit être appelé deux fois (magasinier + dépositaire)');
  assert.strictEqual(appelsNotification.distribuerNotifications, 1, 'distribuerNotifications doit être appelé une fois');

  // Vérifier l'appel pour le magasinier.
  const appelMagasinier = tousAppelsCreerEntrees.find((a) => a.role === 'magasinier');
  assert.ok(appelMagasinier, 'un appel creerEntrees pour le magasinier doit exister');
  assert.strictEqual(appelMagasinier.destinataires[0].id, magasinier.id, 'le destinataire magasinier doit être le magasinier de la direction');
  assert.strictEqual(appelMagasinier.sortieDocumentId, 's_se_drh', 'l\'identifiant de la sortie doit être transmis');
  assert.strictEqual(appelMagasinier.payload.direction, 'd_drh', 'la direction de la sortie doit figurer dans le payload');
  assert.strictEqual(appelMagasinier.payload.statut, 'conforme', 'le statut de réception doit figurer dans le payload');
  assert.match(appelMagasinier.payload.message, /confirmée/, 'le payload magasinier doit mentionner la confirmation de réception');
  assert.strictEqual(dernierAppelDestinataires.roleCode, 'magasinier', 'les destinataires doivent être recherchés pour le rôle magasinier');
  assert.strictEqual(dernierAppelDestinataires.directionId, 'd_drh', 'la recherche doit cibler la direction de la sortie');

  // Vérifier l'appel pour le dépositaire/demandeur.
  const appelDepositaire = tousAppelsCreerEntrees.find((a) => a.role === 'demandeur');
  assert.ok(appelDepositaire, 'un appel creerEntrees pour le dépositaire doit exister');
  assert.strictEqual(appelDepositaire.destinataires[0].id, depositaire.id, 'le destinataire dépositaire doit être l\'utilisateur connecté');
  assert.match(appelDepositaire.payload.message, /enregistrée avec succès/, 'le payload dépositaire doit mentionner l\'enregistrement réussi');
  assert.strictEqual(appelDepositaire.payload.direction, 'd_drh', 'la direction doit figurer dans le payload dépositaire');
});

test('Test 13 — Aucune notification en cas d\'absence d\'authentification', async () => {
  reinitialiser();

  const ctx = contexteAppel(
    { sortieId: 's_se_drh', date_reception: '2026-10-25T10:00:00.000Z', quantite_prevue: 10, quantite_recue: 8, utilisateur: 'x' },
    null
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour requête non authentifiée');
  assert.strictEqual(appelsNotification.creerEntrees, 0, 'aucune entrée outbox sans authentification');
  assert.strictEqual(appelsNotification.distribuerNotifications, 0, 'aucune distribution sans authentification');
});

test('Test 14 — Aucune notification quand la sortie appartient à une autre direction', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur'); // DRH
  const ctx = contexteAppel(
    {
      sortieId: 's_se_dlog', // Direction Logistique, pas DRH
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour mauvaise direction');
  assert.strictEqual(appelsNotification.creerEntrees, 0, 'aucune entrée outbox pour une autre direction');
  assert.strictEqual(appelsNotification.distribuerNotifications, 0, 'aucune distribution pour une autre direction');
});

test('Test 15 — Aucune notification quand le statut de la sortie est incorrect', async () => {
  reinitialiser();

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_ep_drh', // statut en_preparation
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 400, '400 attendu pour statut incorrect');
  assert.strictEqual(appelsNotification.creerEntrees, 0, 'aucune entrée outbox si la sortie n\'est pas effectuée');
  assert.strictEqual(appelsNotification.distribuerNotifications, 0, 'aucune distribution si la sortie n\'est pas effectuée');
});

test('Test 16 — Aucune notification quand l\'utilisateur n\'a pas le rôle demandeur', async () => {
  reinitialiser();

  const magasinier = UTILISATEURS.find((u) => u.roleType === 'magasinier');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh',
      date_reception: '2026-10-25T10:00:00.000Z',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: magasinier.username,
    },
    magasinier
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 403, '403 attendu pour rôle non demandeur');
  assert.strictEqual(appelsNotification.creerEntrees, 0, 'aucune entrée outbox pour un magasinier');
  assert.strictEqual(appelsNotification.distribuerNotifications, 0, 'aucune distribution pour un magasinier');
});

test('Test 17 — Échec de creerEntrees n\'empêche pas la création (201 conservé)', async () => {
  reinitialiser();
  modeNotification = 'erreurCreerEntrees';

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh',
      date_reception: '2026-10-25T10:00:00.000Z',
      statut: 'conforme',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 201, 'la création doit rester 201 même si la notification échoue');
  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  assert.strictEqual(appelsNotification.creerEntrees, 1, 'creerEntrees doit avoir été tenté');
  assert.strictEqual(appelsNotification.distribuerNotifications, 0, 'distribuerNotifications ne doit pas être appelé si creerEntrees a échoué');
});

test('Test 18 — Échec de distribuerNotifications n\'empêche pas la création (201 conservé)', async () => {
  reinitialiser();
  modeNotification = 'erreurDistribuer';

  const demandeur = UTILISATEURS.find((u) => u.roleType === 'demandeur');
  const ctx = contexteAppel(
    {
      sortieId: 's_se_drh',
      date_reception: '2026-10-25T10:00:00.000Z',
      statut: 'conforme',
      quantite_prevue: 10,
      quantite_recue: 8,
      utilisateur: demandeur.username,
    },
    demandeur
  );

  const resultat = await controleur.create(ctx);

  assert.strictEqual(ctx.status, 201, 'la création doit rester 201 même si la distribution échoue');
  assert.strictEqual(appelsSuper.create, 1, 'super.create doit être appelé');
  assert.strictEqual(appelsNotification.creerEntrees, 2, 'creerEntrees doit avoir été appelé deux fois (magasinier + dépositaire)');
  assert.strictEqual(appelsNotification.distribuerNotifications, 1, 'distribuerNotifications doit avoir été tenté');
});
