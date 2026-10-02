'use strict';

/**
 * session controller
 *
 * GET /api/session/role
 *
 * Rôle RÉEL de l'utilisateur connecté.
 *
 * Pourquoi cette route existe : la réponse de `POST /api/auth/local` ne
 * contient PAS la relation `role`. Le contrôleur `auth` du plugin
 * users-permissions utilise un `sanitizeUser` LOCAL (et non
 * `userService.sanitizeUser`), qui passe l'utilisateur par
 * `strapi.contentAPI.sanitize.output` : la relation vers
 * `plugin::users-permissions.user` n'est jamais lisible en Content API et se
 * trouve donc retirée. Même constat sur `GET /api/users/me`.
 *
 * Conséquence côté interface : le rôle affiché était déduit de la réponse de
 * connexion, donc ABSENT — l'écran basculait alors sur les comptes de
 * démonstration codés en dur, et pouvait afficher « Magasinier » alors que le
 * jeton appartenait à un autre compte (signature refusée en 403 côté
 * serveur). Cette route restitue la vérité : elle est lue en base, sans
 * passer par le sanitizer.
 *
 * La réponse est calculée à partir de `ctx.state.user` : elle ne peut donc
 * concerner que l'utilisateur dont le jeton accompagne la requête.
 */

const { getRoleCode } = require('../../../utils/roleGuard');

/** Résout le rôle métier (type + nom) de l'utilisateur connecté. */
async function roleDeLUtilisateur(app, userId) {
  const type = await getRoleCode(app, userId);
  if (!type) return null;
  try {
    const role = await app.db
      .query('plugin::users-permissions.role')
      .findOne({ where: { type } });
    if (role) {
      return { id: role.id, name: role.name, type: role.type };
    }
  } catch (e) {
    app.log.warn(`[session] Rôle « ${type} » introuvable : ${e.message}`);
  }
  // Le type est résolu mais la ligne de rôle est absente : on le renvoie
  // quand même (le frontend s'appuie sur `type`, pas sur `name`).
  return { id: null, name: null, type };
}

module.exports = {
  /**
   * GET /api/session/role
   * → { data: { id, documentId, username, email, department, fonction,
   *             role: { id, name, type } | null } }
   */
  async role(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user) {
      ctx.status = 401;
      ctx.body = {
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Authentification requise.',
        },
      };
      return ctx.body;
    }

    const role = await roleDeLUtilisateur(strapi, user.id);

    // La réponse est bâtie à la main (et non via le Document Service) : elle
    // ne transite par aucun sanitizer, le champ `role` est donc réellement
    // présent — c'est tout l'objet de cette route.
    return {
      data: {
        id: user.id,
        documentId: user.documentId,
        username: user.username,
        email: user.email,
        department: user.department ?? null,
        fonction: user.fonction ?? null,
        role,
      },
    };
  },
};
