'use strict';

const { sseRegister } = require('../../../lib/notifications');

/**
 * Contrôleur des notifications push en temps réel (SSE).
 *
 * GET /api/notifications/stream
 *
 * Ouvre une connexion SSE pour l'utilisateur authentifié. Le client se
 * connecte via l'API EventSource du navigateur. Comme EventSource ne permet
 * pas de définir d'en-têtes personnalisés, le JWT est transmis en paramètre
 * de requête (`?jwt=...`) et vérifié côté serveur via le service jwt de
 * users-permissions.
 */
module.exports = {
  async stream(ctx) {
    const jwt = ctx.query && ctx.query.jwt;
    if (!jwt || typeof jwt !== 'string') {
      ctx.status = 401;
      ctx.body = { error: { status: 401, name: 'UnauthorizedError', message: 'Jeton manquant.' } };
      return;
    }

    // Vérification du JWT (pas d'en-tête Authorization avec EventSource).
    let token;
    try {
      token = await strapi.plugin('users-permissions').service('jwt').verify(jwt);
    } catch (e) {
      ctx.status = 401;
      ctx.body = { error: { status: 401, name: 'UnauthorizedError', message: 'Jeton invalide.' } };
      return;
    }

    const userId = token && (token.id || token.userId);
    if (!userId) {
      ctx.status = 401;
      ctx.body = { error: { status: 401, name: 'UnauthorizedError', message: 'Jeton sans identifiant utilisateur.' } };
      return;
    }

    // En-têtes SSE.
    ctx.status = 200;
    ctx.set('Content-Type', 'text/event-stream');
    ctx.set('Cache-Control', 'no-cache, no-transform');
    ctx.set('Connection', 'keep-alive');
    ctx.set('X-Accel-Buffering', 'no'); // désactive le buffering côté nginx

    // Message de bienvenue pour valider l'ouverture du canal.
    ctx.res.write('event: connected\ndata: {"status":"ok","userId":' + JSON.stringify(userId) + '}\n\n');

    // Enregistre le flux pour cet utilisateur (retrait auto à la fermeture).
    sseRegister(userId, ctx.res);

    // La réponse reste ouverte : le client garde la connexion SSE active.
    // ctx.body n'est pas défini intentionnellement.
  },
};
