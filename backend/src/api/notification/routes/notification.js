'use strict';

/**
 * Route SSE pour les notifications push en temps réel.
 *
 * GET /api/notifications/stream — flux SSE dédié à l'utilisateur authentifié.
 * Le client se connecte via EventSource avec le JWT en paramètre de requête.
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications/stream',
      handler: 'notification.stream',
      config: {
        auth: false, // authentification gérée manuellement (JWT en query param)
      },
    },
  ],
};
