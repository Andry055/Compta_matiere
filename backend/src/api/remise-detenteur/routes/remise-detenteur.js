'use strict';

/**
 * remise-detenteur router
 *
 * Lecture (find / findOne) + création (create) des remises au détenteur.
 * Les routes custom sont déclarées explicitement : `createCoreRouter` ne génère
 * que les 5 routes CRUD core et ignore toute clé de config dont le nom ne
 * correspond pas à une route core.
 * Les permissions correspondantes sont accordées aux rôles habilités dans
 * src/index.js (bootstrap).
 */

const UID = 'api::remise-detenteur.remise-detenteur';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/remises-detenteurs',
      handler: 'remise-detenteur.find',
    },
    {
      method: 'GET',
      path: '/remises-detenteurs/:id',
      handler: 'remise-detenteur.findOne',
    },
    {
      method: 'POST',
      path: '/remises-detenteurs',
      handler: 'remise-detenteur.create',
    },
  ],
};

void UID;