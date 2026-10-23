'use strict';

/**
 * reception-physique router
 *
 * Lecture (find / findOne) + création (create) des réceptions physiques.
 * Les routes custom sont déclarées explicitement : `createCoreRouter` ne génère
 * que les 5 routes CRUD core et ignore toute clé de config dont le nom ne
 * correspond pas à une route core.
 * Les permissions correspondantes sont accordées aux rôles habilités dans
 * src/index.js (bootstrap).
 */

const UID = 'api::reception-physique.reception-physique';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/receptions-physiques',
      handler: 'reception-physique.find',
    },
    {
      method: 'GET',
      path: '/receptions-physiques/:id',
      handler: 'reception-physique.findOne',
    },
    {
      method: 'POST',
      path: '/receptions-physiques',
      handler: 'reception-physique.create',
    },
  ],
};

void UID;
