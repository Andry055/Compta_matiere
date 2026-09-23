'use strict';

/**
 * sortie-ligne controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');

module.exports = guardedCoreController(
  createCoreController,
  'api::sortie-ligne.sortie-ligne'
);
