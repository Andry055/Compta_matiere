'use strict';

/**
 * Contrôleur du content type NotificationOutbox.
 *
 * Fournit l'action `find` permettant à un utilisateur authentifié de lire
 * ses propres notifications en attente / envoyées / échouées, filtrées par
 * recipientId. L'accès est contrôlé par les permissions Strapi
 * (action `api::notification-outbox.notification-outbox.find`).
 */

const OUTBOX_UID = 'api::notification-outbox.notification-outbox';

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  const noms = { 403: 'ForbiddenError', 404: 'NotFoundError', 409: 'ConflictError' };
  ctx.body = {
    error: {
      status,
      name: noms[status] || 'ForbiddenError',
      message,
    },
  };
  return ctx.body;
}

module.exports = {
  /**
   * GET /api/notification-outbox/notifications
   * Retourne les notifications outbox du utilisateur connecté, triées par
   * date de création décroissante.
   *
   * Query params optionnels :
   *   - status : filtrer par statut (pending, processing, sent, failed)
   *   - limit  : nombre maximum de résultats (défaut 50)
   */
  async find(ctx) {
    const app = strapi;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour lire vos notifications.', 401);
    }

    const { status, limit } = ctx.query || {};
    const filters = { recipientId: Number(user.id) };
    if (status) {
      filters.status = status;
    }

    const nbLimit = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;

    try {
      const notifications = await app.documents(OUTBOX_UID).findMany({
        filters,
        sort: { createdAt: 'desc' },
        limit: nbLimit,
      });

      ctx.body = {
        data: notifications,
        meta: {
          recipientId: user.id,
          count: notifications.length,
        },
      };
    } catch (e) {
      app.log.error(
        `[notification-outbox] Échec de la lecture des notifications pour l'utilisateur #${user.id} : ${e.message}`
      );
      ctx.status = 500;
      ctx.body = {
        error: {
          status: 500,
          name: 'ApplicationError',
          message: 'Impossible de lire les notifications.',
        },
      };
    }
  },
};
