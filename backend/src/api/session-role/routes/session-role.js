'use strict';

/**
 * session router
 *
 * Routes de session en lecture seule. Le content type ne sert que de support
 * technique (Strapi n'attache une route Content API qu'à un content type) et
 * ne stocke rien.
 *
 * `auth` n'est pas désactivé : la route exige un jeton. La permission
 * La route `role` est accordée aux utilisateurs connectés ; les routes
 * `users` (lecture), `createUser` et `updateUser` sont réservées au rôle
 * admin (src/index.js et contrôleur).
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
    {
      method: 'POST',
      path: '/session/users',
      handler: 'session-role.createUser',
    },
    {
      method: 'PUT',
      path: '/session/users/:id',
      handler: 'session-role.updateUser',
    },
    {
      method: 'DELETE',
      path: '/session/users/:id',
      handler: 'session-role.deleteUser',
    },
  ],
};
