'use strict';

/**
 * material controller
 *
 * Le stock ne peut pas être modifié directement par un profil « demandeur » :
 * le garde-fou est appliqué côté serveur (voir src/utils/roleGuard.js).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');

module.exports = guardedCoreController(
  createCoreController,
  'api::material.material'
);
