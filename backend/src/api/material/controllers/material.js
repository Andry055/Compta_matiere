'use strict';

/**
 * material controller
 *
 * Le stock ne peut pas être modifié directement par un profil « demandeur » :
 * le garde-fou est appliqué côté serveur (voir src/utils/roleGuard.js).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');
const { callCoreHandler } = require('../../../utils/coreHandler');

module.exports = guardedCoreController(createCoreController, 'api::material.material', {
  async find(ctx) {
    // Apply populate and filter security for demandeur
    if (ctx.state && ctx.state.user) {
      const { getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
      const userRoleCode = await getRoleCode(this.strapi, ctx.state.user.id);
      if (userRoleCode === DEMANDEUR_ROLE) {
        const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
        securePopulateAndFilters(ctx);
      }
    }
    // Call the core find method
    return callCoreHandler(this, 'find', ctx);
  },

  async findOne(ctx) {
    // Apply populate and filter security for demandeur
    if (ctx.state && ctx.state.user) {
      const { getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
      const userRoleCode = await getRoleCode(this.strapi, ctx.state.user.id);
      if (userRoleCode === DEMANDEUR_ROLE) {
        const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
        securePopulateAndFilters(ctx);
      }
    }
    // Call the core findOne method
    return callCoreHandler(this, 'findOne', ctx);
  },
});
