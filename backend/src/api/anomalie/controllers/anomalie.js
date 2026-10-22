'use strict';

/**
 * anomalie controller
 *
 * Endpoints de gestion des anomalies de réception :
 *   GET    /anomalies              liste des anomalies
 *   GET    /anomalies/:documentId  détail d'une anomalie
 *   POST   /anomalies              déclaration d'une anomalie
 *   PATCH  /anomalies/:documentId/resolve  résolution ou rejet (statut + journal)
 *
 * Contrôles :
 *   - création réservée au rôle « depositaire » (403 sinon) ;
 *   - résolution/rejet réservée au rôle « depositaire » (403 sinon) ;
 *   - verrou optimiste sur `version` (409 en cas de conflit) ;
 *   - journalisation immuable dans journal-action à chaque changement de statut.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const {
  guardedCoreController,
  getRoleCode,
  DEMANDEUR_ROLE,
} = require('../../../utils/roleGuard');

const ANOMALIE_UID = 'api::anomalie.anomalie';
const JOURNAL_ACTION_UID = 'api::journal-action.journal-action';
const RECEPTION_LIGNE_UID = 'api::reception-ligne.reception-ligne';

const DEPOSITAIRE_ROLE = 'depositaire';

class ErreurAnomalie extends Error {
  constructor(statusTransaction, message) {
    super(message);
    this.name = 'ErreurAnomalie';
    this.statusTransaction = statusTransaction;
  }
}

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  const noms = { 403: 'ForbiddenError', 404: 'NotFoundError', 409: 'ConflictError' };
  ctx.body = {
    error: {
      status,
      name: noms[status] || 'ForbiddenError',
      message,
    },
  };
  return ctx.body;
}

function badRequest(ctx, message) {
  ctx.status = 400;
  ctx.body = {
    error: { status: 400, name: 'ValidationError', message },
  };
  return ctx.body;
}

function erreurInterne(ctx, message) {
  ctx.status = 500;
  ctx.body = { error: { status: 500, name: 'ApplicationError', message } };
  return ctx.body;
}

function baseHandler(ctrl, nom, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[nom];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${nom} » introuvable sur ${ANOMALIE_UID}.`);
  }
  return handler.call(ctrl, ctx);
}

function nomUtilisateur(user) {
  return (
    (user && (user.username || user.email)) ||
    (user && `Utilisateur #${user.id}`) ||
    ''
  );
}

async function loadAnomalie(strapi, documentId) {
  return strapi.documents(ANOMALIE_UID).findOne({
    documentId,
    populate: {
      reception: true,
      reception_ligne: { populate: ['materiel'] },
      responsable: true,
    },
  });
}

async function roleConnecte(strapi, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user || !user.id) return null;
  return (await getRoleCode(strapi, user.id)).toLowerCase();
}

/** Écrit une entrée immuable dans le journal d'action de l'anomalie. */
async function journaliser(strapi, anomalie, action, auteurId, ancienStatut, nouveauStatut, commentaire) {
  const maintenant = new Date().toISOString();
  await strapi.documents(JOURNAL_ACTION_UID).create({
    data: {
      anomalie: anomalie.documentId,
      action,
      auteur: auteurId,
      date: maintenant,
      ancien_statut: ancienStatut,
      nouveau_statut: nouveauStatut,
      commentaire: typeof commentaire === 'string' ? commentaire : null,
    },
  });
}

module.exports = guardedCoreController(createCoreController, ANOMALIE_UID, {
  /**
   * GET /api/anomalies
   * Liste des anomalies.
   */
  async find(ctx) {
    const app = strapi;
    return baseHandler(this, 'find', ctx);
  },

  /**
   * GET /api/anomalies/:documentId
   * Détail d'une anomalie (404 si introuvable).
   */
  async findOne(ctx) {
    const app = strapi;
    return baseHandler(this, 'findOne', ctx);
  },

  /**
   * POST /api/anomalies
   * Déclaration d'une anomalie sur une ligne de réception.
   * Réservée au rôle « depositaire ».
   */
  async create(ctx) {
    const app = strapi;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour déclarer une anomalie.', 401);
    }

    const code = await roleConnecte(app, ctx);
    if (code !== DEPOSITAIRE_ROLE) {
      return forbid(ctx, 'Seul le dépositaire peut déclarer une anomalie.');
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    const receptionDocumentId = body.reception;
    if (!receptionDocumentId || typeof receptionDocumentId !== 'string') {
      return badRequest(ctx, 'Champ « reception » obligatoire.');
    }

    const typeAnomalie = body.type_anomalie;
    if (!typeAnomalie || !['manquant', 'endommage', 'non_conforme', 'autre'].includes(typeAnomalie)) {
      return badRequest(ctx, 'Champ « type_anomalie » obligatoire (manquant, endommage, non_conforme, autre).');
    }

    const description = body.description;
    if (!description || typeof description !== 'string' || description.trim() === '') {
      return badRequest(ctx, 'Champ « description » obligatoire (texte non vide).');
    }

    const receptionLigneDocumentId = body.reception_ligne;
    if (!receptionLigneDocumentId || typeof receptionLigneDocumentId !== 'string') {
      return badRequest(ctx, 'Champ « reception_ligne » obligatoire.');
    }

    const maintenant = new Date().toISOString();
    const anomalie = await app.documents(ANOMALIE_UID).create({
      data: {
        reception: receptionDocumentId,
        reception_ligne: receptionLigneDocumentId,
        type_anomalie,
        description: description.trim(),
        statut: 'ouverte',
        version: 1,
        date_ouverture: maintenant,
        responsable: user.id,
      },
    });

    // Journalisation immuable : création = statut « ouverte ».
    await journaliser(
      app,
      anomalie,
      'ouverte',
      user.id,
      null,
      'ouverte',
      'Anomalie déclarée.'
    );

    const complete = await loadAnomalie(app, anomalie.documentId);
    ctx.status = 201;
    return { data: complete };
  },

  /**
   * PATCH /api/anomalies/:documentId/resolve
   * Résolution ou rejet d'une anomalie (statut 'resolue' ou 'rejetee').
   * Réservée au rôle « depositaire ». Verrou optimiste sur `version`.
   * Journalisation immuable dans journal-action.
   */
  async resolve(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour résoudre une anomalie.', 401);
    }

    const code = await roleConnecte(app, ctx);
    if (code !== DEPOSITAIRE_ROLE) {
      return forbid(ctx, 'Seul le dépositaire peut résoudre ou rejeter une anomalie.');
    }

    const anomalie = await app.documents(ANOMALIE_UID).findOne({ documentId });
    if (!anomalie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFoundError', message: 'Anomalie introuvable.' } };
      return ctx.body;
    }

    // Déjà traitée : pas de modification (immuable).
    if (anomalie.statut === 'resolue' || anomalie.statut === 'rejetee') {
      return forbid(
        ctx,
        `Cette anomalie est déjà ${anomalie.statut} et ne peut plus être modifiée.`,
        409
      );
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Verrou optimiste sur version ---
    const versionEnvoi = body.version;
    if (versionEnvoi === undefined || Number(versionEnvoi) !== anomalie.version) {
      return forbid(
        ctx,
        `Conflit de version : l'anomalie a été modifiée (version attendue ${anomalie.version}, envoyée ${versionEnvoi === undefined ? 'absente' : versionEnvoi}).`,
        409
      );
    }

    const nouveauStatut = body.statut;
    if (nouveauStatut !== 'resolue' && nouveauStatut !== 'rejetee') {
      return badRequest(
        ctx,
        "Champ « statut » obligatoire (« resolue » ou « rejetee »)."
      );
    }

    const commentaire = typeof body.commentaire === 'string' ? body.commentaire.trim() : null;

    // Mise à jour de l'anomalie + incrémentation de version.
    await app.documents(ANOMALIE_UID).update({
      documentId,
      data: {
        statut: nouveauStatut,
        version: anomalie.version + 1,
        date_resolution: nouveauStatut === 'resolue' ? new Date().toISOString() : anomalie.date_resolution,
        responsable: user.id,
      },
    });

    // Journalisation immuable : transition de statut.
    const action = nouveauStatut === 'resolue' ? 'resolue' : 'rejetee';
    await journaliser(
      app,
      anomalie,
      action,
      user.id,
      anomalie.statut,
      nouveauStatut,
      commentaire
    );

    const complete = await loadAnomalie(app, documentId);
    return { data: complete };
  },
});
