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
      // Instance Strapi globale (comme les autres contrôleurs) : `this.strapi`
      // n'existe pas sur un contrôleur custom, et l'erreur était avalée par
      // getRoleCode -> le garde-fou du demandeur ne s'exécutait JAMAIS.
      const userRoleCode = await getRoleCode(strapi, ctx.state.user.id);
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
      const userRoleCode = await getRoleCode(strapi, ctx.state.user.id);
      if (userRoleCode === DEMANDEUR_ROLE) {
        const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
        securePopulateAndFilters(ctx);
      }
    }
    // Call the core findOne method
    return callCoreHandler(this, 'findOne', ctx);
  },
});
