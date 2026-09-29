'use strict';

/**
 * Garde-fou de LECTURE des rapports de reddition de compte.
 *
 * Seuls les rôles suivants peuvent consulter ces documents officiels :
 *   - depositaire (responsable des données de réception),
 *   - comptable (production de la reddition),
 *   - logistique (chef du service concerné, signature des états),
 *   - admin / authenticated (administration).
 *
 * Le profil « demandeur » (et tout autre) est refusé avec 403. Comme pour
 * roleGuard.js, la vérification est faite côté serveur : le frontend ne
 * constitue jamais une source de sécurité.
 */

const ROLES_RAPPORTS = ['depositaire', 'comptable', 'logistique'];
const ROLES_ADMIN = ['admin', 'authenticated'];

/**
 * @returns {Object|undefined} réponse d'erreur si l'accès est refusé,
 *   sinon undefined (le contrôle passe).
 */
async function assertCanReadRapports(strapi, ctx) {
  const user = ctx.state && ctx.state.user ? ctx.state.user : null;
  if (!user || !user.id) {
    ctx.status = 401;
    ctx.body = {
      error: {
        status: 401,
        name: 'UnauthorizedError',
        message: 'Connexion requise pour consulter les rapports.',
      },
    };
    return ctx.body;
  }

  let code = '';
  try {
    const u = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: user.id }, populate: ['role'] });
    code = ((u && u.role && (u.role.type || u.role.code)) || '')
      .toString()
      .toLowerCase();
  } catch (e) {
    code = '';
  }

  if (ROLES_ADMIN.includes(code) || ROLES_RAPPORTS.includes(code)) {
    return undefined; // autorisé
  }

  ctx.status = 403;
  ctx.body = {
    error: {
      status: 403,
      name: 'ForbiddenError',
      message:
        'Seuls les profils Dépositaire, Comptable et Logistique peuvent consulter les rapports de reddition de compte.',
    },
  };
  return ctx.body;
}

module.exports = { assertCanReadRapports, ROLES_RAPPORTS };
