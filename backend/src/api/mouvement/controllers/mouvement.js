'use strict';

/**
 * mouvement controller
 *
 * L'historique de traçabilité n'est ni modifiable ni supprimable par un
 * profil « demandeur » : garde-fou serveur (src/utils/roleGuard.js).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController } = require('../../../utils/roleGuard');

module.exports = guardedCoreController(createCoreController, 'api::mouvement.mouvement');
