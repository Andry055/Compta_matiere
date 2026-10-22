'use strict';

/**
 * anomalie router
 *
 * Routes de gestion des anomalies de réception :
 *   GET    /anomalies              liste des anomalies
 *   GET    /anomalies/:documentId  détail d'une anomalie
 *   POST   /anomalies              déclaration d'une anomalie
 *   PATCH  /anomalies/:documentId/resolve  résolution ou rejet
 *
 * Déclarées explicitement (pas de createCoreRouter). Les permissions sont
 * accordées aux rôles habilités dans src/index.js (bootstrap).
 */

const UID = 'api::anomalie.anomalie';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/anomalies',
      handler: 'anomalie.find',
    },
    {
      method: 'GET',
      path: '/anomalies/:documentId',
      handler: 'anomalie.findOne',
    },
    {
      method: 'POST',
      path: '/anomalies',
      handler: 'anomalie.create',
    },
    {
      method: 'PATCH',
      path: '/anomalies/:documentId/resolve',
      handler: 'anomalie.resolve',
    },
  ],
};

void UID;
