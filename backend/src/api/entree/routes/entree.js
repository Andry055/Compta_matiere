'use strict';

/**
 * entree router
 *
 * Lecture publique (comme direction / service / employee) : find / findOne.
 * Les endpoints custom (signature, création complète, rejet) exigent une
 * session : les permissions correspondantes sont accordées aux rôles
 * habilités dans src/index.js (bootstrap).
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::entree.entree', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
    createComplete: { auth: true },
    sign: { auth: true },
    reject: { auth: true },
  },
});
