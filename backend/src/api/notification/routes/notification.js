'use strict';

const { sseRegister } = require('../../../lib/notifications');

/**
 * Route SSE pour les notifications push en temps réel.
 *
 * GET /api/sse/stream — flux SSE dédié à l'utilisateur authentifié.
 * Le client se connecte via EventSource avec le JWT en paramètre de requête.
 * Le path "/sse/stream" (plutôt que "/notifications/stream") évite le conflit
 * avec la route CRUD automatique GET /api/notifications/:documentId de Strapi 5.
 */

module.exports = {
  // La route SSE /api/sse/stream est enregistrée explicitement dans
  // backend/src/index.js via strapi.server.routes(). Ce fichier de route
  // est laissé vide car Strapi 5 ne charge pas automatiquement les fichiers
  // api/*/routes/* pour ces APIs ; la déclaration explicite dans index.js
  // est la source unique d'enregistrement.
  routes: [],
};
