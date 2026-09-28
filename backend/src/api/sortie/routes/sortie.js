'use strict';

/**
 * sortie router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

// Lecture publique (comme direction / service / employee) :
// l'écriture reste protégée par l'authentification + src/utils/roleGuard.js
module.exports = createCoreRouter('api::sortie.sortie', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
