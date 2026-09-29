'use strict';

/**
 * ouverture-exercice controller (CRUD core).
 *
 * Le garde-fou roleGuard.js interdit toute écriture au profil « demandeur ».
 * Les permissions Content API (find/create/update) sont accordées dans
 * src/index.js aux seuls rôles habilités (dépositaire, comptable, admin).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');

module.exports = guardedCoreController(
  createCoreController,
  'api::ouverture-exercice.ouverture-exercice'
);
