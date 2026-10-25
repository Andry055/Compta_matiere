'use strict';

/**
 * Étape 5 du circuit de sortie — remise au détenteur.
 *
 * Harnais `node --test`, SANS démarrer Strapi ni toucher la vraie base :
 * l'objet `strapi` simulé est injecté dans le contrôleur en remplaçant
 * `@strapi/strapi` dans le cache de `require` (rien n'atteint node_modules,
 * tout tourne en mémoire ici). Les données vivent dans des tableaux
 * réinitialisés entre les tests.
 *
 * Engagements verrouillés :
 *   étape 5  — POST /sorties/:documentId/remise enregistre le détenteur
 *              et la date, met à jour la demande liée si nécessaire,
 *              trace le mouvement et passe le statut à sortie_effectuee ;
 *              rôles restreints à magasinier et dépositaire uniquement ;
 *              vérifications de statut, de date et de champs obligatoires ;
 *              rollback en cas d'échec de traçage ou de mise à jour demande ;
 *              aucune modification du stock.
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
// Définition canonique du jour métier (fuseau de l'application).
const { dateDuJour } = require(path.join(RACINE, 'src', 'utils', 'horloge.js'));

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

function demandeDe(ref) {
  // Tolère une référence déjà peuplée (objet) comme un documentId (string).
  if (ref && typeof ref === 'object') return { ...ref };
  const d = CONTENEURS['api::demande.demande'].find((e) => e.documentId === ref);
  return d ? { ...d } : null;
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
    // La remise met à jour la demande liée : elle doit être peuplée
    // (objet avec documentId) comme le fait loadSortie côté serveur.
    if (entite.demande) copie.demande = demandeDe(entite.demande);
  }
  if (uid === 'api::demande.demande') {
    copie.sorties = CONTENEURS['api::sortie.sortie']
      .filter((s) => s.demande && s.demande.documentId === entite.documentId)
      .map((s) => ({ ...s }));
  }
  return copie;
}

/* Journal d'annulation de la transaction COURANTE : chaque écriture du
 * harnais (create / update) y dépose son « avant ». Si le callback de
 * app.db.transaction lève, tout est restauré dans l'ordre inverse — comme
 * @strapi/database (rollback réel, exigé par les tests de rollback).
 * Hors transaction (null), les écritures sont directes et irréversibles. */
let journalEcritures = null;

function documents(uid) {
  const stock = CONTENEURS[uid];
  if (!stock) throw new Error(`uid inconnu dans la simulation : ${uid}`);
  // Objet STABLE par uid : les tests de rollback remplacent temporairement
  // create / update sur le retour de documents() — un objet neuf à chaque
  // appel rendrait ce patch sans effet.
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
    // Transaction SÉRIELLE avec rollback réel (journal d'écritures ci-dessus).
    // La remise n'utilise jamais le `trx` knex passé au callback : une tentative
    // d'utilisation échoue explicitement plutôt que de faire semblant de marcher.
    async transaction(cb) {
      const precedent = journalEcritures;
      journalEcritures = [];
      try {
        const resultat = await cb({
          trx: () => {
            throw new Error('trx (knex) non simulé dans ce harnais');
          },
        });
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
global.strapi = appSimule;
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
    // Demande liée : la remise la met à jour (approuvee -> sortie_effectuee).
    demande: 'd1',
  });

  // Demande liée à la sortie
  CONTENEURS['api::demande.demande'].push({
    documentId: 'd1',
    reference: 'DEM-2026-001',
    type: 'sortie',
    designation_materiel: 'Tapis de souris',
    quantite: 5,
    statut: 'approuvee', // Demande approuvée pouvant être mise à jour
    date_demande: '2026-10-01',
    demandeur: 'u-dem',
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

test('remise valide : statut sortie_effectuee, détenteur et date enregistrés, stock inchangé, mouvement tracé, demande liée passée à sortie_effectuee', async () => {
  reinitialiser();
  const ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur',
      date_remise: '2026-10-13'
    }
  }, 'magasinier');

  const reponse = await controleur.remise(ctx);

  assert.strictEqual(ctx.status, 200, 'réponse 200');
  const sortie = reponse.data;
  assert.strictEqual(sortie.statut, 'sortie_effectuee', 'statut final');
  assert.strictEqual(sortie.detenteur_nom, 'Jean Martin', 'detenteur_nom enregistré');
  assert.strictEqual(sortie.detenteur_fonction, 'Ingénieur', 'detenteur_fonction enregistré');
  assert.strictEqual(sortie.date_remise, '2026-10-13', 'date_remise enregistrée');

  // Stock inchangé (pas d'impact sur le stock)
  assert.strictEqual(materielEnBase('m1').quantite_stock, 10, 'stock matériel 1 inchangé');
  assert.strictEqual(materielEnBase('m2').quantite_stock, 5, 'stock matériel 2 inchangé');
  assert.strictEqual(sortie.stock_impacte, true, 'stock_impacte reste true');

  // Vérification de la demande liée mise à jour
  const demande = demandeEnBase('d1');
  assert.strictEqual(demande.statut, 'sortie_effectuee', 'demande liée passée à sortie_effectuee');
  assert.strictEqual(reponse.meta.demande_mise_a_jour, true, 'meta.demande_mise_a_jour à true');

  // Vérification du mouvement de traçage
  const mouvements = CONTENEURS['api::mouvement.mouvement'];
  assert.strictEqual(mouvements.length, 1, 'un mouvement créé');
  const mouvement = mouvements[0];
  assert.strictEqual(mouvement.type, 'sortie', 'type de mouvement sortie');
  assert.strictEqual(mouvement.action, 'Remise au détenteur', 'action du mouvement');
  assert.strictEqual(mouvement.statut, 'sortie_effectuee', 'statut du mouvement');
  assert.strictEqual(mouvement.sortie, 's1', 'mouvement relié à la sortie');
  assert.match(mouvement.observations, /Jean Martin/, 'observations contenant le nom du détenteur');
  assert.match(mouvement.observations, /Ingénieur/, 'observations contenant la fonction du détenteur');

  // Vérification que le stock n'a pas été impacté (les quantités en stock sont les mêmes qu'au début)
  // (déjà vérifié ci-dessus)
});

test('remise : refus (403) hors magasinier et dépositaire', async () => {
  reinitialiser();

  // a) Le logistique ne peut pas effectuer de remise
  const ctxLogistique = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'logistique');
  await controleur.remise(ctxLogistique);
  assert.strictEqual(ctxLogistique.status, 403);
  assert.match(ctxLogistique.body.error.message, /Votre rôle ne permet pas d'effectuer une remise/);

  // b) Le comptable ne peut pas effectuer de remise
  const ctxComptable = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'comptable');
  await controleur.remise(ctxComptable);
  assert.strictEqual(ctxComptable.status, 403);
  assert.match(ctxComptable.body.error.message, /Votre rôle ne permet pas d'effectuer une remise/);

  // c) Le demandeur ne peut jamais effectuer de remise
  const ctxDemandeur = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'demandeur');
  await controleur.remise(ctxDemandeur);
  assert.strictEqual(ctxDemandeur.status, 403);
  assert.match(ctxDemandeur.body.error.message, /Demandeur/);
});

test('remise : statut obligatoire — jamais de remise hors validee', async () => {
  reinitialiser();

  // a) Statut en_preparation
  sortieEnBase('s1').statut = 'en_preparation';
  const ctx1 = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'magasinier');
  await controleur.remise(ctx1);
  assert.strictEqual(ctx1.status, 400);
  assert.match(ctx1.body.error.message, /La remise n'est possible que pour une sortie « validee »/);

  // b) Statut annulee
  sortieEnBase('s1').statut = 'annulee';
  const ctx2 = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'magasinier');
  await controleur.remise(ctx2);
  assert.strictEqual(ctx2.status, 400);
  assert.match(ctx2.body.error.message, /La remise n'est possible que pour une sortie « validee »/);

  // c) Statut déjà sortie_effectuee
  sortieEnBase('s1').statut = 'sortie_effectuee';
  const ctx3 = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'magasinier');
  await controleur.remise(ctx3);
  assert.strictEqual(ctx3.status, 409);
  assert.match(ctx3.body.error.message, /Remise déjà enregistrée/);
});

test('remise : le détenteur est optionnel, sa longueur est validée quand fourni', async () => {
  // a) remise SANS detenteur_nom ni detenteur_fonction : accepté (le
  //    détenteur s'identifie à l'affectation, après la réception physique).
  reinitialiser();
  let ctx = contexteAppel('s1', {
    data: {
      date_remise: '2026-10-13'
    }
  }, 'magasinier');
  const reponse = await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 200, 'remise sans détenteur acceptée');
  assert.strictEqual(reponse.data.statut, 'sortie_effectuee', 'statut final');
  assert.strictEqual(reponse.data.detenteur_nom, undefined, 'detenteur_nom non écrit');
  assert.strictEqual(reponse.data.detenteur_fonction, undefined, 'detenteur_fonction non écrit');

  // b) detenteur_nom trop long (> 150 caractères) : refusé.
  reinitialiser();
  const nomTropLong = 'a'.repeat(151);
  ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: nomTropLong,
      date_remise: '2026-10-13'
    }
  }, 'magasinier');
  await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /detenteur_nom limité à 150 caractères/);

  // c) detenteur_fonction trop long (> 150 caractères) : refusé.
  reinitialiser();
  const fonctionTropLongue = 'b'.repeat(151);
  ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: fonctionTropLongue,
      date_remise: '2026-10-13'
    }
  }, 'magasinier');
  await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /detenteur_fonction limité à 150 caractères/);
});

test('remise : validation de la date_remise', async () => {
  reinitialiser();

  // a) date_remise au mauvais format
  let ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur',
      date_remise: '13-10-2026' // Format JJ-MM-AAAA au lieu de AAAA-MM-JJ
    }
  }, 'magasinier');
  await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /date_remise doit être au format YYYY-MM-DD/);

  // b) date_remise postérieure à aujourd'hui — '2026-12-32' passe la regex
  // format (\d{4}-\d{2}-\d{2}), mais new Date(2026, 11, 32) déborde vers
  // le 1er janvier 2027 qui est postérieur à aujourd'hui.
  ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur',
      date_remise: '2026-12-32' // Déborde en jan 2027 (date future)
    }
  }, 'magasinier');
  await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 400);
  // La regex passe ; l'erreur est "postérieure à aujourd'hui"
  assert.match(ctx.body.error.message, /postérieure à aujourd'hui/);

  // c) date_remise antérieure à la date de validation logistique
  // La date de validation logistique est fixée à 2026-10-10 dans reinitialiser()
  ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur',
      date_remise: '2026-10-09' // Un jour avant la validation
    }
  }, 'magasinier');
  await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /date_remise ne peut pas être antérieure à la date de validation logistique/);

  // d) date_remise valide (aujourd'hui ou entre validation et aujourd'hui)
  // Chaque sous-test doit réinitialiser la sortie (le sous-test c l'a laissée intacte).
  reinitialiser();
  ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur',
      date_remise: '2026-10-10' // Même jour que la validation
    }
  }, 'magasinier');
  const reponseD = await controleur.remise(ctx);
  assert.strictEqual(ctx.status, 200); // Devrait réussir
  assert.strictEqual(reponseD.data.date_remise, '2026-10-10');
});

test('remise : demande non approuvée non modifiée', async () => {
  reinitialiser();

  // Changer le statut de la demande à quelque chose d'autre qu'approuvee ou preparation
  demandeEnBase('d1').statut = 'en_attente';

  const ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
    }
  }, 'magasinier');
  const reponse = await controleur.remise(ctx);

  assert.strictEqual(ctx.status, 200);
// La demande ne doit pas être modifiée
assert.strictEqual(demandeEnBase('d1').statut, 'en_attente', 'demande inchangée');
assert.strictEqual(reponse.meta.demande_mise_a_jour, false, 'meta.demande_mise_a_jour à false');
// Mais la remise doit quand même réussir
assert.strictEqual(reponse.data.statut, 'sortie_effectuee', 'remise effectuée malgré tout');
});

test('remise : rollback en cas d\'échec de traçage', async () => {
  reinitialiser();

  // documents() retourne un NOUVEL objet à chaque appel : patcher sa méthode
  // create ne persiste pas entre les appels. On injecte l\'erreur en
  // empoisonnant le conteneur : un push d\'un objet sentinelle qui fera
  // échouer le findOne suivant est trop invasif. La seule approche fiable
  // est d\'intercepter la fonction `documents` globalement via global.strapi.
  const origDocuments = appSimule.documents.bind(appSimule);
  global.strapi.documents = function(uid) {
    const depot = origDocuments(uid);
    if (uid === 'api::mouvement.mouvement') {
      depot.create = async () => { throw new Error('Échec simulé de création de mouvement'); };
    }
    return depot;
  };

  try {
    const ctx = contexteAppel('s1', {
      data: {
        detenteur_nom: 'Jean Martin',
        detenteur_fonction: 'Ingénieur'
      }
    }, 'magasinier');
    await controleur.remise(ctx);

    // La remise doit avoir échoué
    assert.strictEqual(ctx.status, 500);
    assert.match(ctx.body.error.message, /Remise impossible \(tout a été annulé\)/);

    // Le statut doit rester validee (rollback)
    assert.strictEqual(sortieEnBase('s1').statut, 'validee', 'statut resté validee après rollback');

    // La demande ne doit pas avoir été modifiée
    assert.strictEqual(demandeEnBase('d1').statut, 'approuvee', 'demande inchangée après rollback');

    // Aucun mouvement ne doit avoir été créé
    const mouvements = CONTENEURS['api::mouvement.mouvement'];
    assert.strictEqual(mouvements.length, 0, 'aucun mouvement créé après rollback');
  } finally {
    global.strapi.documents = origDocuments;
  }
});

test("remise : rollback en cas d'échec de mise à jour de la demande", async () => {
  reinitialiser();

  // Même logique que le test précédent : intercepter documents() globalement.
  const origDocuments2 = appSimule.documents.bind(appSimule);
  global.strapi.documents = function(uid) {
    const depot = origDocuments2(uid);
    if (uid === 'api::demande.demande') {
      const origUpdate = depot.update.bind(depot);
      depot.update = async function({ documentId, data } = {}) {
        if (documentId === 'd1') throw new Error('Échec simulé de mise à jour de demande');
        return origUpdate({ documentId, data });
      };
    }
    return depot;
  };

  try {
    const ctx = contexteAppel('s1', {
      data: {
        detenteur_nom: 'Jean Martin',
        detenteur_fonction: 'Ingénieur'
      }
    }, 'magasinier');
    await controleur.remise(ctx);

    // La remise doit avoir échoué
    assert.strictEqual(ctx.status, 500);
    assert.match(ctx.body.error.message, /Remise impossible \(tout a été annulé\)/);

    // Le statut doit rester validee (rollback)
    assert.strictEqual(sortieEnBase('s1').statut, 'validee', 'statut resté validee après rollback');

    // La demande ne doit pas avoir été modifiée
    assert.strictEqual(demandeEnBase('d1').statut, 'approuvee', 'demande inchangée après rollback');

    // Aucun mouvement ne doit avoir été créé (rollback complet)
    const mouvements = CONTENEURS['api::mouvement.mouvement'];
    assert.strictEqual(mouvements.length, 0, 'aucun mouvement créé après rollback');
  } finally {
    global.strapi.documents = origDocuments2;
  }
});

test('remise : date_remise par défaut à aujourd\'hui', async () => {
  reinitialiser();
  const ctx = contexteAppel('s1', {
    data: {
      detenteur_nom: 'Jean Martin',
      detenteur_fonction: 'Ingénieur'
      // date_remise omise volontairement pour tester la valeur par défaut
    }
  }, 'magasinier');
  const reponse = await controleur.remise(ctx);

  assert.strictEqual(ctx.status, 200);
  // La date_remise par défaut est « aujourd'hui » AU FUSEAU DE L'APPLICATION
  // (Indian/Antananarivo), et non le jour UTC : entre 21:00 et 24:00 UTC les
  // deux jours diffèrent. On aligne l'assertion sur la définition canonique
  // du jour métier (src/utils/horloge.js) au lieu du jour UTC brut.
  const aujourdhui = dateDuJour(new Date());
  assert.strictEqual(reponse.data.date_remise, aujourdhui, 'date_remise par défaut à aujourd\'hui');
});

/* ───────────────────── Périmètre : schéma, routes, permissions ──────────── */

test('le schéma sortie expose detenteur_nom, detenteur_fonction et date_remise (texte)', () => {
  const schema = JSON.parse(lire(SCHEMA));
  assert.strictEqual(schema.attributes.detenteur_nom.type, 'text');
  assert.strictEqual(schema.attributes.detenteur_fonction.type, 'text');
  assert.strictEqual(schema.attributes.date_remise.type, 'text');
  // Ces champs sont optionnels (pas required)
  assert.strictEqual(schema.attributes.detenteur_nom.required, undefined);
  assert.strictEqual(schema.attributes.detenteur_fonction.required, undefined);
  assert.strictEqual(schema.attributes.date_remise.required, undefined);
});

test('les routes remise sont explicitement déclarées', () => {
  const mod = require(ROUTES);
  const routes = mod.routes.map((r) => `${r.method} ${r.path}`);
  assert.ok(routes.includes('POST /sorties/:documentId/remise'));

  const handlers = mod.routes.map((r) => r.handler);
  assert.ok(handlers.includes('sortie.remise'));
});

test('permissions : remise accordée à magasinier/depositaire UNIQUEMENT', () => {
  const source = lire(INDEX);

  // a) La liste d'actions de remise des sorties est exactement attendue.
  const debut = source.indexOf('const SORTIE_REMISE_ACTIONS = [');
  assert.notStrictEqual(debut, -1, 'SORTIE_REMISE_ACTIONS déclarée');
  const blocActions = source.slice(debut, source.indexOf('];', debut));
  const actions = blocActions.match(/'api::sortie\.sortie\.remise'/g) || [];
  assert.strictEqual(actions.length, 1, 'seulement remise');
  assert.ok(blocActions.includes("'api::sortie.sortie.remise'"));

  // b) Le périmètre de rôles est strictement magasinier / dépositaire.
  // source.indexOf(']; ', debutRoles) donne le slice SANS ']' — on inclut
  // le ']' en ajoutant 1 au résultat du indexOf pour avoir le bloc complet.
  const debutRoles = source.indexOf('const ROLES_REMISE_SORTIE = [');
  assert.notStrictEqual(debutRoles, -1, 'ROLES_REMISE_SORTIE déclarée');
  const finRoles = source.indexOf('];', debutRoles) + 2; // +2 pour inclure ']'
  const blocRoles = source.slice(debutRoles, finRoles);
  assert.match(
    blocRoles,
    /const ROLES_REMISE_SORTIE\s*=\s*\[\s*'magasinier'\s*,\s*'depositaire'\s*\]/
  );

  // c) Le Demandeur ne reçoit JAMAIS remise (aucune liste à son nom).
  for (const liste of ['DEMAND_ACTIONS']) {
    const bloc = source.slice(
      source.indexOf(`const ${liste} = [`),
      source.indexOf('];', source.indexOf(`const ${liste} = [`))
    );
    assert.doesNotMatch(bloc, /api::sortie\/sortie\/remise/);
  }
});