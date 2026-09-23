'use strict';

/**
 * entree-ligne controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');

module.exports = guardedCoreController(
  createCoreController,
  'api::entree-ligne.entree-ligne'
);
