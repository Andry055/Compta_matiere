'use strict';

/**
 * Routes du content type NotificationOutbox.
 *
 * GET /api/notification-outbox/notifications — lire les notifications de
 * l'utilisateur authentifié (filtrées par recipientId).
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/notifications',
      handler: 'notification-outbox.find',
    },
  ],
};
