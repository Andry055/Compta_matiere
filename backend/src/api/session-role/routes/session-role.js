'use strict';

/**
 * session router
 *
 * Routes de session en lecture seule. Le content type ne sert que de support
 * technique (Strapi n'attache une route Content API qu'à un content type) et
 * ne stocke rien.
 *
 * `auth` n'est pas désactivé : la route exige un jeton. La permission
 * La route `role` est accordée aux utilisateurs connectés ; la route `users`
 * est réservée au rôle admin (src/index.js).
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/session/role',
      handler: 'session-role.role',
    },
    {
      method: 'GET',
      path: '/session/users',
      handler: 'session-role.users',
    },
  ],
};
