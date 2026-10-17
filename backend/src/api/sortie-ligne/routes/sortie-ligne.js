'use strict';

/**
 * sortie-ligne router
 * Routes explicites en lecture seule (GET liste et GET détail).
 * POST, PUT et DELETE ne sont pas définis, donc ils renverront 404 par défaut,
 * mais pour être explicite, on pourrait les ajouter avec 405 si nécessaire.
 * Selon les conventions du projet, seules les routes définies ici sont accessibles.
 */

const UID = 'api::sortie-ligne.sortie-ligne';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/sortie-lignes',
      handler: 'sortie-ligne.find',
    },
    {
      method: 'GET',
      path: '/sortie-lignes/:id',
      handler: 'sortie-ligne.findOne',
    },
  ],
};

void UID;