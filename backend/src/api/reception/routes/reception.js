'use strict';

/**
 * reception router
 *
 * Routes de la réception physique :
 *   GET    /receptions              liste des réceptions
 *   GET    /receptions/:documentId  détail d'une réception
 *   POST   /receptions              création d'une réception
 *   POST   /receptions/:documentId/lignes  ajout d'une ligne de réception
 *
 * Déclarées explicitement (pas de createCoreRouter) : seules les routes
 * listées ici sont accessibles. Les permissions sont accordées aux rôles
 * habilités dans src/index.js (bootstrap).
 */

const UID = 'api::reception.reception';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/receptions',
      handler: 'reception.find',
    },
    {
      method: 'GET',
      path: '/receptions/:documentId',
      handler: 'reception.findOne',
    },
    {
      method: 'POST',
      path: '/receptions',
      handler: 'reception.create',
    },
    {
      method: 'POST',
      path: '/receptions/:documentId/lignes',
      handler: 'reception.createLigne',
    },
  ],
};

void UID;
