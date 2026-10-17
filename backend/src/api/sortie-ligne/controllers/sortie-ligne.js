'use strict';

/**
 * sortie-ligne controller
 * Routeur explicite en lecture seule (GET liste et GET détail).
 * Aucune opération d'écriture n'est exposée via cette route.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');
const { callCoreHandler } = require('../../../utils/coreHandler');

module.exports = guardedCoreController(createCoreController, 'api::sortie-ligne.sortie-ligne', {
  // GET /api/sortie-lignes
  async find(ctx) {
    // Deleguer à la méthode find du contrôleur core
    return callCoreHandler(this, 'find', ctx);
  },

  // GET /api/sortie-lignes/:id
  async findOne(ctx) {
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
        message: 'Cette méthode n\'est pas autorisée.',
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
        message: 'Cette méthode n\'est pas autorisée.',
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
        message: 'Cette méthode n\'est pas autorisée.',
      },
    };
    return ctx.body;
  },
});