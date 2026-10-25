'use strict';

/**
 * Étape 4 — test d'INTEGRATION sur une base temporaire RÉELLEMENT démarrée
 * (Strapi 5 + SQLite), puis supprimée.
 *
 * Contrairement aux suites simulées (sortie-logistique.test.js), tout ici
 * passe par le vrai moteur : vraie transaction de @strapi/database
 * (AsyncLocalStorage + pool), vraie décrémentation atomique SQL
 * (WHERE quantite_stock >= X), vrai UPDATE conditionnel du verrou
 * stock_impacte, vrais mouvements écrits dans la table `mouvements`.
 *
 * La base de TRAVAIL (.tmp/data.db) n'est jamais touchée : ce test définit
 * DATABASE_FILENAME AVANT le démarrage pour créer un FICHIER SQLITE
 * TEMPORAIRE dédié, supprimé à la fin (finally).
 *
 * Les utilisateurs de démo et les rôles métier sont créés par le bootstrap
 * de Strapi (même mécanique qu'en production) ; le test crée SEULEMENT ses
 * matériels / sorties de mesure dans la base temporaire.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// ─── Base temporaire : CONFIGURÉE AVANT tout chargement de Strapi ──────────
const RACINE_BACKEND = path.resolve(__dirname, '..');
const SUBDOSSIER = path.join(RACINE_BACKEND, '.tmp');
const FICHIER_BASE = path.join(SUBDOSSIER, 'integration-etape-4.db');

fs.mkdirSync(SUBDOSSIER, { recursive: true });
if (fs.existsSync(FICHIER_BASE)) {
  // Sous Windows, le fichier SQLite peut rester verrouillé brièvement après
  // un run avorté (Strapi non détruit proprement). On retry avec attente.
  (async () => {
    for (let tentative = 0; tentative < 10; tentative += 1) {
      try {
        fs.rmSync(FICHIER_BASE, { force: true });
        break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  })();
}
process.env.DATABASE_FILENAME = path.join('.tmp', 'integration-etape-4.db');

const { createStrapi } = require('@strapi/strapi');
const CONTROLEUR = path.join(RACINE_BACKEND, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const CONTROLEUR_RAPPORT = path.join(RACINE_BACKEND, 'src', 'api', 'rapport', 'controllers', 'rapport.js');

let strapi = null;
let controleur = null;
let controleurRapport = null;

test.before(async () => {
  strapi = createStrapi({
    appDir: RACINE_BACKEND,
    // Strapi 5 charge les config depuis appDir pour un projet JS pur.
    distDir: RACINE_BACKEND,
    autoReload: false,
    serveAdminPanel: false,
  });
  await strapi.load();
  // Le contrôleur exporté est le résultat de
  // guardedCoreController(createCoreController, ...) : en Strapi 5,
  // createCoreController renvoie une FONCTION paresseuse qui reçoit
  // l'instance Strapi chargée sous la forme ({ strapi }) et retourne
  // l'objet fusionné avec les méthodes custom
  // (find, findOne, createComplete, sign, reject) — même mécanique que
  // lors du bootstrap réel de l'application.
  controleur = require(CONTROLEUR)({ strapi });
  if (typeof controleur.sign !== 'function') {
    throw new Error(
      `controleur.sign attendu, obtenu : ${Object.keys(controleur).join(', ')}`
    );
  }
  // Contrôleur RÉEL des rapports de reddition (grand livre / fiche de stock).
  controleurRapport = require(CONTROLEUR_RAPPORT)({ strapi });
  if (typeof controleurRapport.grandLivre !== 'function') {
    throw new Error(
      `controleurRapport.grandLivre attendu, obtenu : ${Object.keys(controleurRapport).join(', ')}`
    );
  }
});

test.after(async () => {
  if (strapi) {
    try { await strapi.destroy(); } catch (e) { /* le fichier sera libéré */ }
  }
  // La base temporaire est SUPPRIMÉE ensuite, comme demandé.
  for (let tentative = 0; tentative < 10; tentative += 1) {
    try {
      fs.rmSync(FICHIER_BASE, { force: true });
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
});

/* ───────────────────────── Helpers de harnais réel ────────────────────── */

const UIDS = {
  sortie: 'api::sortie.sortie',
  ligne: 'api::sortie-ligne.sortie-ligne',
  materiels: 'api::material.material',
  mouvement: 'api::mouvement.mouvement',
};

let compteur = 0;

async function materielDeTest(designation, quantiteStock) {
  compteur += 1;
  return strapi.documents(UIDS.materiels).create({
    data: {
      designation: `${designation} (IT-${Date.now()}-${compteur})`,
      quantite_stock: quantiteStock,
      statut: 'en_stock',
    },
  });
}

/** Utilisateur RÉEL (row users-permissions) pour passer getRoleCode. */
async function utilisateurDuRole(type) {
  const role = await strapi.db.query('plugin::users-permissions.role')
    .findOne({ where: { type } });
  assert.ok(role, `rôle bootstrap attendu : ${type}`);
  const email = `${type}.integ-${type}@mtefop.gov.mg`;
  let user = await strapi.db.query('plugin::users-permissions.user')
    .findOne({ where: { email } });
  if (!user) {
    user = await strapi.db.query('plugin::users-permissions.user').create({
      data: {
        username: `Integration ${type}`,
        email,
        password: 'integration-uniquement-temporaire',
        provider: 'local',
        confirmed: true,
        blocked: false,
        role: role.id,
      },
    });
  }
  return { id: user.id, username: user.username, email: user.email };
}

async function sortieDeTest(materiel, quantite, reference) {
  compteur += 1;
  const sortie = await strapi.documents(UIDS.sortie).create({
    data: {
      reference: reference || `SOR-INT-${String(compteur).padStart(3, '0')}`,
      date_sortie: '2030-01-01',
      statut: 'en_preparation',
    },
  });
  const ligne = await strapi.documents(UIDS.ligne).create({
    data: {
      sortie: sortie.documentId,
      materiel: materiel.documentId,
      designation: materiel.designation,
      quantite,
    },
  });
  return { sortie, ligne };
}

/** Pose les signatures 1-2 DIRECTEMENT en base (le sujet du test d'intégra est
 *  la 3e signature : verrou + décrémentation atomique + mouvements). */
async function poserSignatures1et2(sortieDocumentId) {
  await strapi.documents(UIDS.sortie).update({
    documentId: sortieDocumentId,
    data: {
      magasinier_signed: true,
      depositaire_signed: true,
      signataire_magasinier: 'Integration Magasinier',
      signataire_depositaire: 'Integration Dépositaire',
      date_signature_magasinier: new Date().toISOString(),
      date_signature_depositaire: new Date().toISOString(),
    },
  });
}

function contexte(documentId, corps, user) {
  return {
    params: { documentId },
    request: { body: { data: corps } },
    state: { user },
    status: 200,
    body: null,
    query: {},
  };
}

async function stockReel(documentId) {
  return (await strapi.db.connection('materials')
    .where('document_id', documentId)
    .first('quantite_stock')).quantite_stock;
}

/** GET /api/rapports/grand-livre rappelé PAR LE CONTRÔLEUR RÉEL, en se
 *  connectant comme le dépositaire (profil qui tient le grand livre). */
async function grandLivreReel(materielDocumentId, utilisateur) {
  const ctx = {
    params: {},
    query: { materiel: materielDocumentId },
    state: { user: utilisateur },
    status: 200,
    body: null,
  };
  await controleurRapport.grandLivre(ctx);
  assert.strictEqual(ctx.status, 200, JSON.stringify(ctx.body && ctx.body.error));
  return ctx.body.data;
}

/* ═══════════════════════════ Les scénarios réels ═══════════════════════ */

test('integration : cycle complet sur base réelle — le stock baisse EXACTEMENT', async () => {
  const logistique = await utilisateurDuRole('logistique');
  const materiel = await materielDeTest('Tapis integration', 10);
  const { sortie } = await sortieDeTest(materiel, 2, 'SOR-INT-001');
  await poserSignatures1et2(sortie.documentId);

  const ctx = contexte(sortie.documentId, {
    role: 'logistique',
    numeros_logistiques: [{ ligne: (await strapi.documents(UIDS.ligne).findMany({
      filters: { sortie: { documentId: sortie.documentId } },
    }))[0].documentId, numero_logistique: ' IT-PROC 77 ' }],
  }, logistique);

  const reponse = await controleur.sign(ctx);
  void reponse;
  assert.strictEqual(ctx.status, 200, JSON.stringify(ctx.body && ctx.body.error));

  // ✧ PREUVE CHIFFRÉE RÉELLE : stock 10 - 2 = 8 (lu en base via SQL brut).
  assert.strictEqual(await stockReel(materiel.documentId), 8);

  const relue = await strapi.documents(UIDS.sortie).findOne({
    documentId: sortie.documentId,
    populate: { lignes: true },
  });
  assert.strictEqual(relue.statut, 'validee');
  assert.strictEqual(relue.logistique_signed, true);
  assert.strictEqual(relue.stock_impacte, true);
  assert.ok(!Number.isNaN(Date.parse(relue.date_signature_logistique)));
  assert.strictEqual(relue.lignes[0].numero_logistique, ' IT-PROC 77 ', 'numéro enregistré TEL QUEL');

  // Mouvements : 1 par ligne + « Signature logistique » = 2 pour 1 ligne.
  const mouvements = await strapi.documents(UIDS.mouvement).findMany({
    filters: { sortie: { documentId: sortie.documentId } },
    limit: -1,
  });
  assert.strictEqual(mouvements.length, 2);
  const parLigne = mouvements.filter((m) => m.action === 'Sortie validée, stock débité');
  assert.strictEqual(parLigne.length, 1);
  assert.strictEqual(parLigne[0].quantite, 2);
  assert.ok(mouvements.some((m) => m.action === 'Signature logistique'));

  // ✧ Rejeu : une 2e signature logistique ne débite RIEN de plus.
  const stockApres = await stockReel(materiel.documentId);
  const ctx2 = contexte(sortie.documentId, { role: 'logistique' }, logistique);
  await controleur.sign(ctx2);
  assert.ok(ctx2.status === 400 || ctx2.status === 409);
  assert.strictEqual(await stockReel(materiel.documentId), stockApres);
});

test('integration : stock insuffisant — 409, stock theorique AVANT === APRES (preuve chiffrée)', async () => {
  const logistique = await utilisateurDuRole('logistique');
  const materiel = await materielDeTest('Clavier integration', 1);
  const { sortie } = await sortieDeTest(materiel, 3, 'SOR-INT-002');
  await poserSignatures1et2(sortie.documentId);

  const avant = await stockReel(materiel.documentId); // 1
  const ctx = contexte(sortie.documentId, { role: 'logistique' }, logistique);
  const reponse = await controleur.sign(ctx);
  void reponse;
  assert.strictEqual(ctx.status, 409, JSON.stringify(ctx.body && ctx.body.error));
  assert.match(ctx.body.error.message, /Stock insuffisant/);
  assert.match(ctx.body.error.message, /quantité demandée 3/);
  assert.match(ctx.body.error.message, /quantité disponible 1/);

  // ✧ PREUVE CHIFFRÉE : avant === après — AUCUN débit sur la base réelle.
  const apres = await stockReel(materiel.documentId);
  assert.strictEqual(avant, 1);
  assert.strictEqual(apres, 1);
  assert.strictEqual(avant, apres);

  const relue = await strapi.documents(UIDS.sortie).findOne({ documentId: sortie.documentId });
  assert.strictEqual(relue.statut, 'en_preparation');
  assert.strictEqual(relue.stock_impacte, false);
  assert.strictEqual(relue.logistique_signed, false);
});

test('integration : line sans fiche materiel — 400, rien de modifié', async () => {
  const logistique = await utilisateurDuRole('logistique');
  const materiel = await materielDeTest('Ecran integration', 4);
  const { sortie } = await sortieDeTest(materiel, 1, 'SOR-INT-003');
  await poserSignatures1et2(sortie.documentId);
  // La ligne PERD sa fiche matérielle (cas de test, jamais de quoi réel).
  const lignes = await strapi.documents(UIDS.ligne).findMany({
    filters: { sortie: { documentId: sortie.documentId } },
  });
  await strapi.documents(UIDS.ligne).update({
    documentId: lignes[0].documentId,
    data: { materiel: null },
  });

  const stockAvant = await stockReel(materiel.documentId);
  const ctx = contexte(sortie.documentId, { role: 'logistique' }, logistique);
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 400);
  assert.match(ctx.body.error.message, /fiche mat/);
  assert.strictEqual(await stockReel(materiel.documentId), stockAvant, 'stock intact');
});

test('integration : deux signatures CONCURRENTES (Promise.all) — un seul débit', async () => {
  const logistique = await utilisateurDuRole('logistique');
  const materiel = await materielDeTest('Chargeur integration', 7);
  const { sortie } = await sortieDeTest(materiel, 2, 'SOR-INT-004');
  await poserSignatures1et2(sortie.documentId);

  const [c1, c2] = [
    contexte(sortie.documentId, { role: 'logistique' }, logistique),
    contexte(sortie.documentId, { role: 'logistique' }, logistique),
  ];
  const [r1, r2] = await Promise.all([
    controleur.sign(c1),
    controleur.sign(c2),
  ]);

  const validees = [c1, c2].filter((c) => c.status === 200).length;
  assert.strictEqual(validees, 1, `exactement une validation (200/200: ${c1.status}/${c2.status})`);
  const refus = (c1.error || c2.body);
  void refus; void r1; void r2;

  // La REALITE : rangé stock SQLite — EXACTEMENT UN débit de 2.
  assert.strictEqual(await stockReel(materiel.documentId), 5);

  // Mouvements : exactement une validation complète
  // (1 ligne + « Signature logistique » = 2).
  const mouvements = await strapi.documents(UIDS.mouvement).findMany({
    filters: { sortie: { documentId: sortie.documentId } },
    limit: -1,
  });
  assert.strictEqual(mouvements.length, 2);
});

test('integration : validation logistique -> stock debité, grand livre du depositaire mis a jour a la remise', async () => {
  const logistique = await utilisateurDuRole('logistique');
  const depositaire = await utilisateurDuRole('depositaire');
  const magasinier = await utilisateurDuRole('magasinier');

  // 10 unités reçues (entrée validée) : c'est l'écriture d'ouverture du
  // grand livre du matériel.
  const materiel = await materielDeTest('Ordinateur portable integration', 10);
  const entree = await strapi.documents('api::entree.entree').create({
    data: {
      reference: `ENT-GL-${Date.now()}`,
      date_entree: '2026-01-05',
      statut: 'validee',
    },
  });
  await strapi.documents('api::entree-ligne.entree-ligne').create({
    data: {
      entree: entree.documentId,
      materiel: materiel.documentId,
      designation: materiel.designation,
      numero_ordre: 1,
      quantite: 10,
      valeur_unitaire: 1000,
      montant: 10000,
    },
  });

  // Ordre de sortie de 2 unités, signatures 1 et 2 posées.
  const { sortie } = await sortieDeTest(materiel, 2, 'SOR-INT-007');
  await poserSignatures1et2(sortie.documentId);

  // ── Validation par le chef logistique (étape 4) ──────────────────────────
  const avant = await grandLivreReel(materiel.documentId, depositaire);
  assert.strictEqual(avant.totalEntreesQ, 10);
  assert.strictEqual(avant.totalSortiesQ, 0);
  assert.strictEqual(avant.quantiteFinale, 10);

  const ctx = contexte(sortie.documentId, { role: 'logistique' }, logistique);
  await controleur.sign(ctx);
  assert.strictEqual(ctx.status, 200, JSON.stringify(ctx.body && ctx.body.error));

  // ✧ PREUVE CHIFFRÉE : le stock PHYSIQUE est débité immédiatement (10-2=8).
  assert.strictEqual(await stockReel(materiel.documentId), 8);

  // Le grand livre (fiche de stock) ne comptabilise QUE les sorties
  // EFFECTUÉES : la sortie « validée » n'y figure pas encore.
  const apresValidation = await grandLivreReel(materiel.documentId, depositaire);
  assert.strictEqual(apresValidation.totalSortiesQ, 0, 'sortie « validée » non encore comptabilisée');
  assert.strictEqual(apresValidation.quantiteFinale, 10);

  // ── Remise au détenteur (étape 5) → sortie_effectuee ────────────────────
  const ctxRemise = contexte(sortie.documentId, {
    data: {
      detenteur_nom: 'Rakoto Hery',
      detenteur_fonction: 'Agent administratif',
    },
  }, magasinier);
  await controleur.remise(ctxRemise);
  assert.strictEqual(ctxRemise.status, 200, JSON.stringify(ctxRemise.body && ctxRemise.body.error));

  // ✧ Le stock PHYSIQUE n'est PAS redébité par la remise (déjà fait à l'étape 4).
  assert.strictEqual(await stockReel(materiel.documentId), 8);

  // ✧ Le grand livre du dépositaire est DÉSORMÀS mis à jour : 10 - 2 = 8.
  const apresRemise = await grandLivreReel(materiel.documentId, depositaire);
  assert.strictEqual(apresRemise.mouvements.length, 2, 'entrée + sortie');
  assert.strictEqual(apresRemise.totalEntreesQ, 10);
  assert.strictEqual(apresRemise.totalSortiesQ, 2, 'sortie comptabilisée après remise');
  assert.strictEqual(apresRemise.quantiteFinale, 8, 'grand livre raccord avec le stock physique (8)');
});

test('integration : deux sorties disputent UN stock insuffisant — une seule réussit', async () => {
  const logistique = await utilisateurDuRole('logistique');
  const materiel = await materielDeTest('Souris disputée', 3);

  const a = await sortieDeTest(materiel, 2, 'SOR-INT-005');
  const b = await sortieDeTest(materiel, 2, 'SOR-INT-006');
  await poserSignatures1et2(a.sortie.documentId);
  await poserSignatures1et2(b.sortie.documentId);

  const [c1, c2] = [
    contexte(a.sortie.documentId, { role: 'logistique' }, logistique),
    contexte(b.sortie.documentId, { role: 'logistique' }, logistique),
  ];
  const res = await Promise.all([
    controleur.sign(c1),
    controleur.sign(c2),
  ]);

  // ✧ Un SEUL débit : le stock réel passe 3 - 2 = 1, jamais négatif.
  const stockFinal = await stockReel(materiel.documentId);
  assert.strictEqual(stockFinal, 1);
  assert.ok(stockFinal >= 0);

  // Exactement une sortie validee (l'autre refuse : 409 stock insuffisant).
  const validees = [c1, c2].filter((c) => c.status === 200).length;
  assert.strictEqual(validees, 1, `validees=${validees} (${c1.status}/${c2.status})`);
  for (const c of [c1, c2]) {
    if (c.status !== 200) {
      assert.match(c.body.error.message, /Stock insuffisant|d. j. t. valid.e|d j/);
    }
  }
  void res;
});
