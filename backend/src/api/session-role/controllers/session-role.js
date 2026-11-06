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

/** Résout la direction de rattachement de l'utilisateur connecté.
 *  La liaison utilisateur → direction est stockée dans la table de jonction
 *  `up_users_direction_lnk` (créée au bootstrap). Cette lecture est une
 *  lecture simple de référence, jamais une validation de mot de passe.
 *
 *  Note : `app.db.getConnection()` retourne une instance Knex (pas better-sqlite3),
 *  donc on utilise `app.db.connection.raw()` avec des paramètres liés. */
async function directionDeLUtilisateur(app, userId) {
  try {
    const rows = await app.db.connection.raw(
      'SELECT d.id, d.nom_direction FROM up_users_direction_lnk ud JOIN directions d ON d.id = ud.direction_id WHERE ud.user_id = ?',
      [userId]
    );
    const row = Array.isArray(rows) ? rows[0] : (rows && rows[0] ? rows[0] : null);
    if (row) {
      return { id: row.id, nom_direction: row.nom_direction };
    }
  } catch (e) {
    app.log.warn(
      `[session] Direction introuvable pour l'utilisateur #${userId} : ${e.message}`
    );
  }
  return null;
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
    const direction = await directionDeLUtilisateur(strapi, user.id);

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
        direction,
      },
    };
  },

  /**
   * GET /api/session/users
   * Liste des comptes et informations d'organisation, réservée à l'admin.
   * Les champs de sécurité (mot de passe, jetons) ne sont jamais renvoyés.
   */
  async users(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      ctx.status = 401;
      ctx.body = {
        error: {
          status: 401,
          name: 'UnauthorizedError',
          message: 'Connexion requise pour consulter les utilisateurs.',
        },
      };
      return ctx.body;
    }

    const roleCode = await getRoleCode(strapi, user.id);
    if (roleCode !== 'admin') {
      ctx.status = 403;
      ctx.body = {
        error: {
          status: 403,
          name: 'ForbiddenError',
          message: 'Seul le rôle administrateur peut consulter les utilisateurs.',
        },
      };
      return ctx.body;
    }

    const comptes = await strapi.db
      .query('plugin::users-permissions.user')
      .findMany({
        populate: ['role', 'direction'],
        orderBy: { username: 'asc' },
        limit: -1,
      });
    const emails = comptes.map((compte) => compte.email).filter(Boolean);
    const employes = emails.length
      ? await strapi.db.query('api::employee.employee').findMany({
          where: { email: { $in: emails } },
          populate: { service: { populate: ['direction'] } },
          limit: -1,
        })
      : [];
    const employeParEmail = new Map(
      employes.map((employe) => [employe.email.toLowerCase(), employe])
    );

    ctx.body = {
      data: comptes.map((compte) => {
        const employe = employeParEmail.get((compte.email || '').toLowerCase());
        const service = employe && employe.service;
        const direction =
          compte.direction || (service && service.direction) || null;

        return {
          id: compte.id,
          username: compte.username,
          email: compte.email,
          role: compte.role
            ? { name: compte.role.name, type: compte.role.type }
            : null,
          department: compte.department || null,
          fonction: compte.fonction || null,
          confirmed: compte.confirmed === true,
          blocked: compte.blocked === true,
          createdAt: compte.createdAt || null,
          phone: (employe && employe.phone) || null,
          direction: direction
            ? {
                id: direction.id,
                name: direction.nom_direction || null,
              }
            : null,
          service: service
            ? {
                id: service.id,
                name: service.nom_service || null,
              }
            : null,
        };
      }),
    };
  },
};
