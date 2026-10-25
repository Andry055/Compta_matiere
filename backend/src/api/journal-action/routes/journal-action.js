'use strict';

/**
 * journal-action router
 *
 * Route du journal d'action des anomalies :
 *   GET /journal-actions  liste des entrées de journal (lecture seule)
 *
 * Déclarée explicitement. Aucune route d'écriture : le journal est immuable
 * et ne s'alimente que depuis le contrôleur anomalie.
 */

const UID = 'api::journal-action.journal-action';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/journal-actions',
      handler: 'journal-action.find',
    },
  ],
};

void UID;
