'use strict';

/**
 * Étape 2 + 3 du circuit de sortie — création complète, signatures 1/2 et rejet.
 *
 * Harnais `node --test`, SANS démarrer Strapi ni toucher la vraie base :
 * l'objet `strapi` simulé est injecté dans le contrôleur en remplaçant
 * `@strapi/strapi` dans le cache de `require` (rien n'atteint node_modules,
 * tout tourne en mémoire ici). Les données vivent dans des tableaux
 * réinitialisés entre les tests.
 *
 * Engagements verrouillés :
 *   étape 2  — POST /sorties/create-complete crée la sortie avec le statut
 *              « en_preparation », une référence SOR-AAAA-NNN, ses lignes
 *              reliées au bon matériel, et le stock INCHANGÉ ;
 *   étape 3  — signature 1 (magasinier, états enregistrés DANS le même
 *              appel), signature 2 (dépositaire), ordre strict, refus
 *              « logistique », contrôle du stock (409 sans écriture),
 *              rejet (motif obligatoire, statut annulee, ni re-signature
 *              ni re-rejet), Demandeur toujours exclu du circuit.
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
      if ('$in' in valeur) {
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
      return peuple(uid, entite);
    },
    async update({ documentId, data } = {}) {
      const entite = stock.find((e) => e.documentId === documentId);
      if (!entite) throw new Error(`Enregistrement introuvable : ${documentId}`);
      Object.assign(entite, data);
      return peuple(uid, entite);
    },
  };
}

const appSimule = {
  documents,
  db: {
    /** Transaction à annulation : snapshot à l'entrée, restauration intégrale
     *  si le callback lève. Sans elle, createComplete échouerait aussitôt
     *  (« Création impossible : app.db.transaction is not a function »). */
    async transaction(cb) {
      const instantane = Object.fromEntries(
        Object.entries(CONTENEURS).map(([uid, rows]) => [uid, rows.map((r) => ({ ...r }))])
      );
      try {
        return await cb({ trx: {} });
      } catch (e) {
        for (const [uid, rows] of Object.entries(instantane)) {
          CONTENEURS[uid].length = 0;
          CONTENEURS[uid].push(...rows);
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
          const user = UTILISATEURS.find((u) => u.id === where.id);
          if (!user) return null;
          // getRoleCode lit `role.code || role.type`.
          return { id: user.id, role: { code: user.roleType, type: user.roleType } };
        },
      };
    },
  },
  log: {
    warn(message) {
      journalAvertissements.push(message);
    },
  },
};

global.strapi = appSimule;

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

  CONTENEURS['api::material.material'].push(
    // valeur_unitaire POSITIVE exigée par createComplete (le prix vient de la
    // fiche, jamais du client) : les fixtures doivent satisfaire le contrat.
    { documentId: 'm1', designation: 'Tapis de souris', quantite_stock: 10, valeur_unitaire: 5000 },
    { documentId: 'm2', designation: 'Clavier compact', quantite_stock: 5, valeur_unitaire: 3000 }
  );

  CONTENEURS['api::sortie-ligne.sortie-ligne'].push(
    { documentId: 'l1', sortie: 's1', materiel: 'm1', designation: 'Tapis de souris', quantite: 2 },
    { documentId: 'l2', sortie: 's1', materiel: 'm2', designation: 'Clavier compact', quantite: 3 },
    // Sortie « étrangère » : ses lignes ne doivent jamais être touchées par
    // les contrôles de s1.
    { documentId: 'lX', sortie: 's2', materiel: 'm1', designation: 'Tapis de souris (autre)', quantite: 1 }
  );

  CONTENEURS['api::sortie.sortie'].push({
    documentId: 's1',
    reference: 'SOR-2026-001',
    date_sortie: '2026-10-13',
    statut: 'en_preparation',
    magasinier_signed: false,
    depositaire_signed: false,
    logistique_signed: false,
  });
}

/** Contexte Koa simulé : params + corps enveloppé `data` + utilisateur. */
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

function sortieEnBase(documentId) {
  return CONTENEURS['api::sortie.sortie'].find((s) => s.documentId === documentId);
}

function ligneEnBase(documentId) {
  return CONTENEURS['api::sortie-ligne.sortie-ligne'].find((l) => l.documentId === documentId);
}

function materielEnBase(documentId) {
  return CONTENEURS['api::material.material'].find((m) => m.documentId === documentId);
}

function controlesDe(s1 = true) {
  const controles = [{ ligne: 'l1', etat: 'neuf' }];
  if (s1) controles.push({ ligne: 'l2', etat: 'bon', observations: '  Étiquette refaite  ' });
  return controles;
}

/* ───────────────── Étape 2 : POST /sorties/create-complete ──────────────── */

test('createComplete : sortie créée en en_preparation, lignes reliées, stock intact', async () => {
  reinitialiser();
  const ctx = contexteAppel(undefined, {
    date_sortie: '2026-10-13',
    justificatif: 'Bon n° 41',
    beneficiaire: 'Service Formation',
    lignes: [
      { designation: 'Tapis de souris', quantite: 2, valeur_unitaire: 5000 },
      { materiel_id: 'm2', quantite: 1 },
    ],
  }, 'depositaire');

  const reponse = await controleur.createComplete(ctx);

  assert.strictEqual(ctx.status, 201, 'réponse 201');
  const sortie = reponse.data;
  assert.match(sortie.reference, /^SOR-\d{4}-\d{3}$/, 'référence générée');
  assert.strictEqual(sortie.statut, 'en_preparation', 'statut initial');

  const lignesCreees = CONTENEURS['api::sortie-ligne.sortie-ligne']
    .filter((l) => l.sortie === sortie.documentId);
  assert.strictEqual(lignesCreees.length, 2);
  assert.strictEqual(lignesCreees[0].materiel, 'm1', 'résolution par designation');
  assert.strictEqual(lignesCreees[1].materiel, 'm2', 'résolution par materiel_id');

  assert.strictEqual(materielEnBase('m1').quantite_stock, 10, 'stock jamais touché à la création');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 5);

  const mouvements = CONTENEURS['api::mouvement.mouvement'];
  assert.strictEqual(mouvements.length, 1);
  assert.strictEqual(mouvements[0].type, 'sortie');
  assert.strictEqual(mouvements[0].action, 'Sortie créée');
  assert.strictEqual(mouvements[0].statut, 'en_preparation');
  assert.strictEqual(mouvements[0].sortie, sortie.documentId, 'mouvement relié à la sortie');
});

test('createComplete : refus (403) hors dépositaire, validation (400) sans aucune création', async () => {
  reinitialiser();

  // a) Un comptable (pourtant signataire des entrées) ne crée PAS de sortie.
  const ctxComptable = contexteAppel(undefined, { date_sortie: '2026-10-13', lignes: [{ materiel_id: 'm1', quantite: 1 }] }, 'comptable');
  await controleur.createComplete(ctxComptable);
  assert.strictEqual(ctxComptable.status, 403);
  assert.match(ctxComptable.body.error.message, /d.positaire/i);

  // b) Date manquante / quantité invalide : 400, RIEN n'est créé.
  const nbSorties = CONTENEURS['api::sortie.sortie'].length;
  const ctxSansDate = contexteAppel(undefined, { lignes: [{ materiel_id: 'm1', quantite: 1 }] }, 'depositaire');
  await controleur.createComplete(ctxSansDate);
  assert.strictEqual(ctxSansDate.status, 400);
  assert.match(ctxSansDate.body.error.message, /Date de sortie/);

  const ctxQuantite = contexteAppel(undefined, {
    date_sortie: '2026-10-13',
    lignes: [{ materiel_id: 'm1', quantite: 0 }],
  }, 'depositaire');
  await controleur.createComplete(ctxQuantite);
  assert.strictEqual(ctxQuantite.status, 400);
  assert.match(ctxQuantite.body.error.message, /Quantit./);

  assert.strictEqual(CONTENEURS['api::sortie.sortie'].length, nbSorties, 'aucune création partielle');
});

/* ─────────────────── Étape 3 : le cycle valide en entier ────────────────── */

test('cycle valide : magasinier avec états puis dépositaire, statut et stock inchangés', async () => {
  reinitialiser();

  // --- Signature 1 : magasinier, contrôle par ligne -------------------------
  const ctx1 = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'magasinier');
  const reponse1 = await controleur.sign(ctx1);

  assert.strictEqual(ctx1.status, 200, `signature 1 acceptée (${ctx1.status})`);
  const sortie1 = reponse1.data;
  assert.strictEqual(sortie1.magasinier_signed, true);
  assert.strictEqual(sortie1.signataire_magasinier, 'Andriamampianina Fara', 'nom du signataire posé SEUL par le serveur');
  assert.ok(!Number.isNaN(Date.parse(sortie1.date_signature_magasinier)), 'date-heure ISO');
  assert.strictEqual(sortie1.depositaire_signed, false);

  // Contrôles enregistrés DANS le même appel.
  const l1 = ligneEnBase('l1');
  const l2 = ligneEnBase('l2');
  assert.strictEqual(l1.etat, 'neuf');
  assert.strictEqual(l2.etat, 'bon');
  assert.strictEqual(l2.observations, 'Étiquette refaite', 'observations nettoyées');

  // Statut inchangé + stock inchangé + mouvement tracé.
  assert.strictEqual(sortie1.statut, 'en_preparation');
  assert.strictEqual(reponse1.meta.statut, 'en_preparation');
  assert.strictEqual(reponse1.meta.signatures, 1);
  assert.strictEqual(materielEnBase('m1').quantite_stock, 10);
  assert.strictEqual(materielEnBase('m2').quantite_stock, 5);

  let mouvements = CONTENEURS['api::mouvement.mouvement'];
  assert.strictEqual(mouvements.length, 1);
  assert.strictEqual(mouvements[0].action, 'Signature magasinier');
  assert.strictEqual(mouvements[0].type, 'sortie');
  assert.strictEqual(mouvements[0].reference, 'SOR-2026-001');
  assert.strictEqual(mouvements[0].sortie, 's1');

  // --- Signature 2 : dépositaire (sans controles) ----------------------------
  const ctx2 = contexteAppel('s1', { role: 'depositaire' }, 'depositaire');
  const reponse2 = await controleur.sign(ctx2);

  assert.strictEqual(ctx2.status, 200, `signature 2 acceptée (${ctx2.status})`);
  const sortie2 = reponse2.data;
  assert.strictEqual(sortie2.depositaire_signed, true);
  assert.strictEqual(sortie2.signataire_depositaire, 'Rakotomalala Hery');
  assert.ok(!Number.isNaN(Date.parse(sortie2.date_signature_depositaire)));
  assert.strictEqual(sortie2.statut, 'en_preparation', 'le statut reste en_preparation après 2 signatures');
  assert.strictEqual(reponse2.meta.signatures, 2);

  mouvements = CONTENEURS['api::mouvement.mouvement'];
  assert.strictEqual(mouvements.length, 2);
  assert.strictEqual(mouvements[1].action, 'Signature dépositaire');

  // La signature du dépositaire ne touche ni les états ni le stock.
  assert.strictEqual(ligneEnBase('l1').etat, 'neuf');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 5);
});

/* ───────────────────── Étape 3 : contrôles des rejets ───────────────────── */

test('sign : mauvais rôle (403), jamais le Demandeur ni le Comptable', async () => {
  reinitialiser();

  // a) Le dépositaire ne peut pas poser la signature 1.
  const ctxRole = contexteAppel('s1', { role: 'magasinier' }, 'depositaire');
  await controleur.sign(ctxRole);
  assert.strictEqual(ctxRole.status, 403);
  assert.match(ctxRole.body.error.message, /Votre r.le/);
  assert.strictEqual(sortieEnBase('s1').magasinier_signed, false);

  // b) Le Demandeur — quel que soit le rôle demandé.
  const ctxDemandeur = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'demandeur');
  await controleur.sign(ctxDemandeur);
  assert.strictEqual(ctxDemandeur.status, 403);
  assert.match(ctxDemandeur.body.error.message, /Demandeur/);

  // c) Le Comptable n'appartient pas au circuit de sortie.
  const ctxComptable = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'comptable');
  await controleur.sign(ctxComptable);
  assert.strictEqual(ctxComptable.status, 403);
});

test('sign : mauvais ordre (400 en nommant la signature manquante), double signature (409)', async () => {
  reinitialiser();

  // a) Le dépositaire ne peut pas signer avant le magasinier : le message
  //    NOMME la signature manquante.
  const ctxOrdre = contexteAppel('s1', { role: 'depositaire' }, 'depositaire');
  await controleur.sign(ctxOrdre);
  assert.strictEqual(ctxOrdre.status, 400);
  assert.match(ctxOrdre.body.error.message, /magasinier/);
  assert.strictEqual(sortieEnBase('s1').depositaire_signed, false);

  // b) Double signature : 409 Conflict, rien n'est réécrit.
  const ctx1 = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'magasinier');
  await controleur.sign(ctx1);
  assert.strictEqual(ctx1.status, 200);
  const dateOriginale = sortieEnBase('s1').date_signature_magasinier;

  const ctxBis = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'magasinier');
  await controleur.sign(ctxBis);
  assert.strictEqual(ctxBis.status, 409);
  assert.match(ctxBis.body.error.message, /enregistr.e|enregistree/);
  assert.strictEqual(sortieEnBase('s1').date_signature_magasinier, dateOriginale, 'signature jamais réécrite');

  // Aucun mouvement supplémentaire.
  assert.strictEqual(CONTENEURS['api::mouvement.mouvement'].length, 1);
});

test('sign : controles obligatoires — sans controles, ligne manquante, ligne d une autre sortie ou état invalide : 400 et RIEN enregistré', async () => {
  reinitialiser();

  const etatAvant = () => ({
    magasinier_signed: sortieEnBase('s1').magasinier_signed,
    l1: (ligneEnBase('l1').etat),
    l2: (ligneEnBase('l2').etat),
    mouvements: CONTENEURS['api::mouvement.mouvement'].length,
  });

  // a) Sans controles du tout.
  let ctx = contexteAppel('s1', { role: 'magasinier' }, 'magasinier');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /Contr.les obligatoires/);
  assert.deepStrictEqual(etatAvant(), {
    magasinier_signed: false, l1: undefined, l2: undefined, mouvements: 0,
  });

  // b) Une ligne manque (l2 absente).
  ctx = contexteAppel('s1', { role: 'magasinier', controles: [controlesDe()[0]] }, 'magasinier');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /Clavier compact/, 'la désignation concernée est nommée');
  assert.strictEqual(sortieEnBase('s1').magasinier_signed, false);

  // c) Une ligne d'une AUTRE sortie.
  ctx = contexteAppel('s1', {
    role: 'magasinier',
    controles: [...controlesDe(), { ligne: 'lX', etat: 'neuf' }],
  }, 'magasinier');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /ne fait pas partie de cette sortie/);
  assert.strictEqual(ligneEnBase('lX').etat, undefined, 'la ligne étrangère est intacte');

  // d) Un état invalide.
  ctx = contexteAppel('s1', {
    role: 'magasinier',
    controles: [{ ligne: 'l1', etat: 'neuf' }, { ligne: 'l2', etat: 'cassé' }],
  }, 'magasinier');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /Clavier compact/);
  assert.deepStrictEqual(etatAvant(), {
    magasinier_signed: false, l1: undefined, l2: undefined, mouvements: 0,
  });
});

test('sign : stock devenu insuffisant — 409 nommant matériel et quantités, aucune modification', async () => {
  reinitialiser();

  // Le magasin n'a plus que 1 « Clavier compact » alors que la sortie en
  // demande 3 : la signature est refusée AVANT toute écriture.
  materielEnBase('m2').quantite_stock = 1;

  const ctx = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'magasinier');
  await controleur.sign(ctx);

  assert.strictEqual(ctx.status, 409);
  assert.match(ctx.body.error.message, /Stock insuffisant/);
  assert.match(ctx.body.error.message, /Clavier compact/);
  assert.match(ctx.body.error.message, /quantit. demand.e 3/);
  assert.match(ctx.body.error.message, /quantit. en stock 1/);

  const sortie = sortieEnBase('s1');
  assert.strictEqual(sortie.magasinier_signed, false);
  assert.strictEqual(ligneEnBase('l1').etat, undefined, 'aucun état enregistré');
  assert.strictEqual(ligneEnBase('l2').etat, undefined);
  assert.strictEqual(materielEnBase('m2').quantite_stock, 1, 'stock inchangé');
  assert.strictEqual(CONTENEURS['api::mouvement.mouvement'].length, 0);
});test('sign : le rôle logistique passe maintenant par la validation étape 4 (débit du stock)', async () => {
  reinitialiser();

  // Désormais la 3ᵉ signature exige magasinier ET dépositaire : le message
  // nomme la première signature manquante.
  const ctx = contexteAppel('s1', { role: 'logistique' }, 'logistique');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /magasinier/, 'signature manquante nommée');
  // La sortie reste intouchable.
  const sortie = sortieEnBase('s1');
  assert.strictEqual(sortie.logistique_signed, false);
  assert.strictEqual(sortie.magasinier_signed, false);
});

test('sign : statut obligatoire — jamais de signature hors en_preparation', async () => {
  reinitialiser();

  sortieEnBase('s1').statut = 'validee';
  const ctx = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'magasinier');
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /en_preparation/);
  assert.strictEqual(ligneEnBase('l1').etat, undefined);
});

/* ─────────────────────── Étape 3 : la méthode reject ────────────────────── */

test('reject : motif obligatoire, statut annulee, second rejet refusé', async () => {
  reinitialiser();

  // a) Motif vide → 400.
  let ctx = contexteAppel('s1', { motif: '   ' }, 'depositaire');
  await controleur.reject(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /Motif/);

  // b) Rejet valable → statut annulee + motif_rejet, stock intact.
  ctx = contexteAppel('s1', { motif: 'Le matériel est déjà affecté à un autre service.' }, 'magasinier');
  const reponse = await controleur.reject(ctx);

  assert.strictEqual(ctx.status, 200);
  assert.strictEqual(reponse.data.statut, 'annulee');
  assert.strictEqual(reponse.data.motif_rejet, 'Le matériel est déjà affecté à un autre service.');
  assert.strictEqual(materielEnBase('m1').quantite_stock, 10, 'aucun effet sur le stock');

  const mouvements = CONTENEURS['api::mouvement.mouvement'];
  assert.strictEqual(mouvements.length, 1);
  assert.strictEqual(mouvements[0].action, 'Sortie rejetée');
  assert.strictEqual(mouvements[0].statut, 'annulee');
  assert.strictEqual(mouvements[0].observations, 'Le matériel est déjà affecté à un autre service.');

  // c) Second rejet : 400 « Cette sortie a déjà été rejetée ».
  ctx = contexteAppel('s1', { motif: 'encore' }, 'depositaire');
  await controleur.reject(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /rejet.e|rejetee/);
  assert.strictEqual(CONTENEURS['api::mouvement.mouvement'].length, 1, 'mouvement non réécrit');
});

test('reject : impossible de rejeter une sortie validee ; le Demandeur ne peut pas rejeter', async () => {
  reinitialiser();

  // a) Sortie validée : refus 400.
  sortieEnBase('s1').statut = 'validee';
  let ctx = contexteAppel('s1', { motif: 'trop tard' }, 'logistique');
  await controleur.reject(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /Une sortie valid.e/);

  // b) Sortie sortie_effectuee : refus 400 aussi.
  sortieEnBase('s1').statut = 'sortie_effectuee';
  ctx = contexteAppel('s1', { motif: 'trop tard' }, 'logistique');
  await controleur.reject(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /effectu.e|sortie_effectuee/);

  // c) Le Demandeur — jamais.
  sortieEnBase('s1').statut = 'en_preparation';
  ctx = contexteAppel('s1', { motif: 'ouin' }, 'demandeur');
  await controleur.reject(ctx);
  assert.strictEqual(ctx.status, 403);
  assert.match(ctx.body.error.message, /Demandeur/);
  assert.strictEqual(sortieEnBase('s1').statut, 'en_preparation');
});

test('reject et sign : impossible de signer une sortie annulee', async () => {
  reinitialiser();

  // Annulation d'abord.
  const ctxRejet = contexteAppel('s1', { motif: 'erreur de saisie' }, 'depositaire');
  await controleur.reject(ctxRejet);
  assert.strictEqual(ctxRejet.status, 200);

  // Puis tentative de signature : 400 (statut ≠ en_preparation).
  const ctxSign = contexteAppel('s1', { role: 'magasinier', controles: controlesDe() }, 'magasinier');
  await controleur.sign(ctxSign);
  assert.strictEqual(ctxSign.status, 400);
  assert.match(ctxSign.body.error.message, /en_preparation/);
  assert.strictEqual(ligneEnBase('l1').etat, undefined, 'aucun contrôle enregistré');
});

/* ───────────────────── Périmètre : schéma, routes, permissions ──────────── */

test('le schéma sortie expose motif_rejet (texte) — seul ajout de l étape 3', () => {
  const schema = JSON.parse(lire(SCHEMA));
  assert.strictEqual(schema.attributes.motif_rejet.type, 'text');
  assert.strictEqual(schema.attributes.motif_rejet.required, undefined, 'champ optionnel');
});

test('les routes sign et reject sont explicitement déclarées', () => {
  const mod = require(ROUTES);
  const signatures = mod.routes.map((r) => `${r.method} ${r.path}`);
  assert.ok(signatures.includes('POST /sorties/:documentId/sign'), routes(mod));
  assert.ok(signatures.includes('POST /sorties/:documentId/reject'), routes(mod));
  assert.ok(signatures.includes('POST /sorties/create-complete'), routes(mod));

  const handlers = mod.routes.map((r) => r.handler);
  assert.ok(handlers.includes('sortie.sign'));
  assert.ok(handlers.includes('sortie.reject'));

  function routes(mod) {
    return 'routes présentes : ' + mod.routes.map((r) => `${r.method} ${r.path}`).join(', ');
  }
});

test('permissions : sign et reject accordées à magasinier/dépositaire/logistique UNIQUEMENT', () => {
  const source = lire(INDEX);

  // a) La liste d'actions de signature des sorties est exactement attendue.
  const debut = source.indexOf('const SORTIE_SIGN_ACTIONS = [');
  assert.notStrictEqual(debut, -1, 'SORTIE_SIGN_ACTIONS déclarée');
  const blocActions = source.slice(debut, source.indexOf('];', debut));
  const actions = blocActions.match(/'api::sortie\.sortie\.(sign|reject)'/g) || [];
  assert.strictEqual(actions.length, 2, 'sign + reject, rien de plus');
  assert.ok(blocActions.includes("'api::sortie.sortie.sign'"));
  assert.ok(blocActions.includes("'api::sortie.sortie.reject'"));

  // b) Le périmètre de rôles est strictement magasinier / dépositaire / logistique.
  assert.match(
    source,
    /const ROLES_SIGNATURE_SORTIE = \[\s*'magasinier',\s*'depositaire',\s*'logistique'\s*\];/
  );

  // c) Les listes d'ENTRÉES n'ont pas glissé d'action de sortie.
  const demandeurEntree = source.slice(
    source.indexOf('const DEMANDEUR_ENTREE_ACTIONS = ['),
    source.indexOf('];', source.indexOf('const DEMANDEUR_ENTREE_ACTIONS = ['))
  );
  assert.doesNotMatch(demandeurEntree, /api::sortie/);

  // d) Le Demandeur ne reçoit JAMAIS sign/reject (aucune liste à son nom).
  for (const liste of ['DEMAND_ACTIONS']) {
    const bloc = source.slice(
      source.indexOf(`const ${liste} = [`),
      source.indexOf('];', source.indexOf(`const ${liste} = [`))
    );
    assert.doesNotMatch(bloc, /sortie\.sortie\.(sign|reject)/);
  }
});

/* ───── Contrat du payload frontend : la ligne est identifiée par ID ──────── */

test('createComplete : payload frontend (materiel_id + designation canonique) crée tout', async () => {
  reinitialiser();

  // Exactement ce que `construirePayloadSortie` envoie après correction.
  const ctx = contexteAppel(undefined, {
    date_sortie: '2026-10-16',
    justificatif: 'Bon n° 42',
    beneficiaire: 'Service Formation',
    lignes: [
      { materiel_id: 'm1', designation: 'Tapis de souris', quantite: 2, observations: '  Neuf  ' },
      { materiel_id: 'm2', designation: 'Clavier compact', quantite: 1 },
    ],
  }, 'depositaire');

  const reponse = await controleur.createComplete(ctx);
  assert.strictEqual(ctx.status, 201, `création acceptée (statut ${ctx.status} : ${ctx.body && ctx.body.error && ctx.body.error.message})`);

  const lignes = CONTENEURS['api::sortie-ligne.sortie-ligne']
    .filter((l) => l.sortie === reponse.data.documentId);
  assert.strictEqual(lignes.length, 2, 'les deux lignes sont créées');
  assert.strictEqual(lignes[0].materiel, 'm1', 'ligne 1 reliée à la fiche');
  // Le montant vient de la FICHE (prix du client ignoré).
  assert.strictEqual(lignes[0].valeur_unitaire, 5000, 'prix de la fiche');
  assert.strictEqual(lignes[0].montant, 10000, 'montant = quantité × prix de la fiche');
  assert.strictEqual(materielEnBase('m1').quantite_stock, 10, 'stock intact à la création');
});

test('createComplete : l alias `materielId` (ancien bundle) résout la fiche', async () => {
  reinitialiser();

  const ctx = contexteAppel(undefined, {
    date_sortie: '2026-10-16',
    justificatif: 'Bon n° 43',
    beneficiaire: 'Service Formation',
    // Payload camelCase : SANS designation de repli, seule la clé compte.
    lignes: [{ materielId: 'm2', quantite: 1 }],
  }, 'depositaire');

  const reponse = await controleur.createComplete(ctx);
  assert.strictEqual(
    ctx.status,
    201,
    `alias accepté (statut ${ctx.status} : ${ctx.body && ctx.body.error && ctx.body.error.message})`
  );
  const lignes = CONTENEURS['api::sortie-ligne.sortie-ligne']
    .filter((l) => l.sortie === reponse.data.documentId);
  assert.strictEqual(lignes[0].materiel, 'm2', 'résolu par materielId, pas par texte');
});

test('createComplete : designation partielle seule reste refusée (400, rien créé)', async () => {
  reinitialiser();
  const nbSorties = CONTENEURS['api::sortie.sortie'].length;

  // Recherche tapée à la main, non appariée à une fiche : le serveur ne fait
  // QUE de lappariement exact, il refuse donc la ligne.
  const ctx = contexteAppel(undefined, {
    date_sortie: '2026-10-16',
    justificatif: 'Bon n° 44',
    beneficiaire: 'Service Formation',
    lignes: [{ designation: 'Tapis', quantite: 1 }],
  }, 'depositaire');

  await controleur.createComplete(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /Matériel introuvable/);
  assert.strictEqual(CONTENEURS['api::sortie.sortie'].length, nbSorties, 'aucune sortie créée');
});

test('createComplete : fiche sans valeur unitaire → 400 AVANT toute écriture', async () => {
  reinitialiser();
  CONTENEURS['api::material.material'].push(
    { documentId: 'm3', designation: 'Lampe sans prix', quantite_stock: 5 }
  );
  const nbSorties = CONTENEURS['api::sortie.sortie'].length;
  const nbLignes = CONTENEURS['api::sortie-ligne.sortie-ligne'].length;
  const nbMouvements = CONTENEURS['api::mouvement.mouvement'].length;

  const ctx = contexteAppel(undefined, {
    date_sortie: '2026-10-16',
    justificatif: 'Bon n° 45',
    beneficiaire: 'Service Formation',
    lignes: [{ materiel_id: 'm3', designation: 'Lampe sans prix', quantite: 1 }],
  }, 'depositaire');

  await controleur.createComplete(ctx);
  assert.strictEqual(ctx.status, 400, 'refus explicite plutôt quune ligne muette');
  assert.match(ctx.body.error.message, /Valeur unitaire manquante/);
  assert.strictEqual(CONTENEURS['api::sortie.sortie'].length, nbSorties, 'aucune sortie créée');
  assert.strictEqual(CONTENEURS['api::sortie-ligne.sortie-ligne'].length, nbLignes, 'aucune ligne créée');
  assert.strictEqual(CONTENEURS['api::mouvement.mouvement'].length, nbMouvements, 'aucun mouvement tracé');
});
