'use strict';

/**
 * mouvement router
 * Routes explicites en lecture seule (GET liste et GET détail).
 * POST, PUT et DELETE ne sont pas définis, donc ils renverront 404 par défaut.
 * L'historique de traçabilité n'est ni modifiable ni supprimable par un profil « demandeur » : garde-fou serveur (src/utils/roleGuard.js).
 */

const UID = 'api::mouvement.mouvement';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/mouvements',
      handler: 'mouvement.find',
    },
    {
      method: 'GET',
      path: '/mouvements/:id',
      handler: 'mouvement.findOne',
    },
  ],
};

void UID;