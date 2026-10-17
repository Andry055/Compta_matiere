'use strict';

/**
 * mouvement controller
 * Routeur explicite en lecture seule (GET liste et GET détail).
 * Aucune opération d'écriture n'est exposée via cette route.
 * L'historique de traçabilité n'est ni modifiable ni supprimable par un profil « demandeur » : garde-fou serveur (src/utils/roleGuard.js).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');
const { callCoreHandler } = require('../../../utils/coreHandler');

module.exports = guardedCoreController(createCoreController, 'api::mouvement.mouvement', {
  // GET /api/mouvements
  async find(ctx) {
    // Appliquer la sécurité pour le rôle demandeur
    if (ctx.state && ctx.state.user) {
      const { getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
      const userRoleCode = await getRoleCode(strapi, ctx.state.user.id);
      if (userRoleCode === DEMANDEUR_ROLE) {
        const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
        securePopulateAndFilters(ctx);
      }
    }
    // Deleguer à la méthode find du contrôleur core
    return callCoreHandler(this, 'find', ctx);
  },

  // GET /api/mouvements/:id
  async findOne(ctx) {
    // Appliquer la sécurité pour le rôle demandeur
    if (ctx.state && ctx.state.user) {
      const { getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
      const userRoleCode = await getRoleCode(strapi, ctx.state.user.id);
      if (userRoleCode === DEMANDEUR_ROLE) {
        const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
        securePopulateAndFilters(ctx);
      }
    }
    // Deleguer à la méthode findOne du contrôleur core
    return callCoreHandler(this, 'findOne', ctx);
  },

  // Interdire toutes les opérations d'écriture
  async create(ctx) {
    ctx.status = 405;
    ctx.body = {
      error: {
        status: 405,
        name: 'MethodNotAllowedError',
        message: "Cette méthode n'est pas autorisée.",
      },
    };
    return ctx.body;
  },

  async update(ctx) {
    ctx.status = 405;
    ctx.body = {
      error: {
        status: 405,
        name: 'MethodNotAllowedError',
        message: "Cette méthode n'est pas autorisée.",
      },
    };
    return ctx.body;
  },

  async delete(ctx) {
    ctx.status = 405;
    ctx.body = {
      error: {
        status: 405,
        name: 'MethodNotAllowedError',
        message: "Cette méthode n'est pas autorisée.",
      },
    };
    return ctx.body;
  },
});
