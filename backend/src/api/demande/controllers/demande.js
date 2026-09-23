'use strict';

/**
 * demande controller
 *
 * Règles pour le profil « demandeur » (appliquées côté serveur) :
 *  - créer une demande (brouillon ou en attente uniquement) — la possession
 *    (`demandeur`) est forcée à l'utilisateur connecté, jamais prise du
 *    corps de requête ;
 *  - consulter uniquement SES demandes (filtrage serveur) ;
 *  - modifier / annuler ses propres demandes tant qu'elles ne sont pas
 *    traitées (brouillon, en attente, annulée) ;
 *  - ne JAMAIS approuver, rejeter ni supprimer lui-même
 *    (validation réservée aux responsables) ;
 *  - ne jamais toucher aux entrées / sorties / stock (voir roleGuard.js).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { assertCanWrite, getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');

const DEMANDEUR_ALLOWED_STATUTS = ['brouillon', 'en_attente', 'annulee'];

function forbid(ctx, message) {
  ctx.status = 403;
  ctx.body = {
    error: {
      status: 403,
      name: 'ForbiddenError',
      message,
    },
  };
  return ctx.body;
}

/** S'assure que la relation `demandeur` est peuplée pour le filtrage. */
function withDemandeurPopulate(populate) {
  if (!populate) return ['demandeur'];
  if (Array.isArray(populate)) {
    return populate.includes('demandeur') ? populate : [...populate, 'demandeur'];
  }
  if (typeof populate === 'object') {
    return { ...populate, demandeur: true };
  }
  if (populate === 'demandeur') return populate;
  return [populate, 'demandeur'];
}

async function isDemandeur(app, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user) return false;
  const code = await getRoleCode(app, user.id);
  return code === DEMANDEUR_ROLE;
}

module.exports = createCoreController(
  'api::demande.demande',
  ({ strapi: app }) => ({
    /** Le Demandeur ne list que ses propres demandes (contrôle serveur). */
    async find(ctx) {
      if (await isDemandeur(app, ctx)) {
        const user = ctx.state.user;
        ctx.query.populate = withDemandeurPopulate(ctx.query.populate);
        const res = await super.find(ctx);
        if (res && Array.isArray(res.data)) {
          res.data = res.data.filter(
            (row) =>
              row.demandeur &&
              (row.demandeur.id === user.id ||
                row.demandeur.documentId === user.documentId)
          );
        }
        return res;
      }
      return super.find(ctx);
    },

    /** Un Demandeur ne lit que ses propres demandes. */
    async findOne(ctx) {
      if (await isDemandeur(app, ctx)) {
        const user = ctx.state.user;
        ctx.query.populate = withDemandeurPopulate(ctx.query.populate);
        const res = await super.findOne(ctx);
        const row = res && res.data;
        if (!row) return res;
        const owned =
          row.demandeur &&
          (row.demandeur.id === user.id ||
            row.demandeur.documentId === user.documentId);
        if (!owned) {
          ctx.status = 404;
          ctx.body = {
            error: {
              status: 404,
              name: 'NotFound',
              message: 'Demande introuvable.',
            },
          };
          return ctx.body;
        }
        return res;
      }
      return super.findOne(ctx);
    },

    async create(ctx) {
      await assertCanWrite(app, ctx, 'api::demande.demande');
      if (ctx.status === 403) return ctx.body;

      const body = ctx.request.body && ctx.request.body.data;
      if (body) {
        // Possession forcée : la demande appartient à l'utilisateur connecté
        // (impossible de créer une demande au nom d'un tiers).
        if (ctx.state && ctx.state.user && ctx.state.user.documentId) {
          body.demandeur = ctx.state.user.documentId;
        }
        if (
          body.statut &&
          ctx.state &&
          ctx.state.user &&
          !DEMANDEUR_ALLOWED_STATUTS.includes(body.statut)
        ) {
          return forbid(
            ctx,
            'Seul un responsable habilité peut fixer ce statut de demande.'
          );
        }
      }
      return super.create(ctx);
    },

    async update(ctx) {
      await assertCanWrite(app, ctx, 'api::demande.demande');
      if (ctx.status === 403) return ctx.body;
      return super.update(ctx);
    },

    async delete(ctx) {
      await assertCanWrite(app, ctx, 'api::demande.demande');
      if (ctx.status === 403) return ctx.body;
      return super.delete(ctx);
    },
  })
);
