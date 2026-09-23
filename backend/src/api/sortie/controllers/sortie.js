'use strict';

/**
 * sortie controller
 *
 * La validation d'une sortie appartient au responsable :
 * un profil « demandeur » est bloqué côté serveur (src/utils/roleGuard.js).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');

module.exports = guardedCoreController(createCoreController, 'api::sortie.sortie');
