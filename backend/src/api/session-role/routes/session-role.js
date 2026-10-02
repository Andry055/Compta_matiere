'use strict';

/**
 * session router
 *
 * Une seule route : GET /api/session/role — le rôle RÉEL de l'utilisateur
 * connecté. AUCUNE route CRUD n'est exposée : ce content type ne sert que de
 * support technique à la route (Strapi n'attache une route Content API qu'à un
 * content type) et ne stocke rien.
 *
 * `auth` n'est pas désactivé : la route exige un jeton. La permission
 * `api::session-role.session-role.role` est accordée à tous les rôles métier
 * lors du bootstrap (src/index.js).
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/session/role',
      handler: 'session-role.role',
    },
  ],
};
