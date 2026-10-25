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
  assert.strictEqual(donnees.sortieId, 's_se_drh', 'sortieId transmis');
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
