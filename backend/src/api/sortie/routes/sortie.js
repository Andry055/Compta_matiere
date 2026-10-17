'use strict';

/**
 * sortie router
 *
 * Lecture (find / findOne) + endpoints custom du circuit de sortie, déclarés
 * explicitement comme dans entree.js : `createCoreRouter` ne génère que les 5
 * routes CRUD core et ignore toute clé de config dont le nom ne correspond
 * pas à une route core — ce qui rend les routes custom déclarées dans sa
 * config silencieusement inaccessibles.
 * Les permissions correspondantes sont accordées aux rôles habilités dans
 * src/index.js (bootstrap).
 */

const UID = 'api::sortie.sortie';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/sorties',
      handler: 'sortie.find',
    },
    {
      method: 'GET',
      path: '/sorties/distributions',
      handler: 'sortie.findDistributions',
    },
    {
      method: 'GET',
      path: '/sorties/:id',
      handler: 'sortie.findOne',
    },
    {
      method: 'POST',
      path: '/sorties/create-complete',
      handler: 'sortie.createComplete',
    },
    {
      method: 'POST',
      path: '/sorties/:documentId/sign',
      handler: 'sortie.sign',
    },
    {
      method: 'POST',
      path: '/sorties/:documentId/reject',
      handler: 'sortie.reject',
    },
    {
      method: 'POST',
      path: '/sorties/:documentId/remise',
      handler: 'sortie.remise',
    },
  ],
};

void UID;
