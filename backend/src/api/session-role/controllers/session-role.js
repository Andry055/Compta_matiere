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

const USER_MODEL_UID = 'plugin::users-permissions.user';
const ROLE_MODEL_UID = 'plugin::users-permissions.role';
const DIRECTION_UID = 'api::direction.direction';

// Rôles acceptés pour un compte applicatif.
const ROLES_VALIDES = [
  'admin',
  'depositaire',
  'magasinier',
  'logistique',
  'comptable',
  'demandeur',
];
const STATUTS_VALIDES = ['Actif', 'Inactif', 'Suspendu'];

function reponseErreur(ctx, status, name, message) {
  ctx.status = status;
  ctx.body = { error: { status, name, message } };
  return ctx.body;
}

/** true si le jeton appartient au rôle administrateur. */
async function estAdministrateur(app, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user || !user.id) return false;
  return (await getRoleCode(app, user.id)) === 'admin';
}

/** Statut d'affichage → drapeaux users-permissions. */
function drapeauxStatut(statut) {
  const valeur = String(statut || '').trim();
  if (!STATUTS_VALIDES.includes(valeur)) return null;
  if (valeur === 'Suspendu') return { confirmed: true, blocked: true };
  if (valeur === 'Inactif') return { confirmed: false, blocked: false };
  return { confirmed: true, blocked: false };
}

async function resoudreRole(app, roleType) {
  const type = String(roleType || '').trim().toLowerCase();
  if (!ROLES_VALIDES.includes(type)) {
    return { ok: false, message: 'Rôle invalide.' };
  }
  const role = await app.db.query(ROLE_MODEL_UID).findOne({ where: { type } });
  if (!role) {
    return { ok: false, message: `Rôle « ${type} » introuvable.` };
  }
  return { ok: true, value: role };
}

async function resoudreDirection(app, directionId) {
  if (directionId === undefined || directionId === null || directionId === '') {
    return { ok: true, value: null };
  }
  const id = Number(directionId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: 'Direction invalide.' };
  }
  const direction = await app.db.query(DIRECTION_UID).findOne({ where: { id } });
  if (!direction) {
    return { ok: false, message: 'Direction introuvable.' };
  }
  return { ok: true, value: direction.id };
}

function messageEcriture(e, action) {
  const message = String((e && e.message) || '');
  if (/unique|duplicate/i.test(message)) {
    return "Ce nom d'utilisateur ou cet email est déjà utilisé.";
  }
  return `${action} impossible : ${message || 'erreur inconnue'}`;
}

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
          phone: compte.phone || (employe && employe.phone) || null,
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

  /**
   * POST /api/session/users
   * Création d'un compte applicatif. Réservé à l'administrateur.
   * Corps : { username, email, password, roleType, status,
   *           directionId?, department?, fonction? }
   */
  async createUser(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return reponseErreur(ctx, 401, 'UnauthorizedError', 'Connexion requise.');
    }
    if (!(await estAdministrateur(strapi, ctx))) {
      return reponseErreur(
        ctx,
        403,
        'ForbiddenError',
        "Seul le rôle administrateur peut créer un utilisateur."
      );
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const username = String(body.username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (username.length < 3) {
      return reponseErreur(
        ctx,
        400,
        'ValidationError',
        "Le nom d'utilisateur doit comporter au moins 3 caractères."
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reponseErreur(ctx, 400, 'ValidationError', 'Adresse email invalide.');
    }
    if (password.length < 6) {
      return reponseErreur(
        ctx,
        400,
        'ValidationError',
        'Le mot de passe doit comporter au moins 6 caractères.'
      );
    }

    const role = await resoudreRole(strapi, body.roleType);
    if (!role.ok) {
      return reponseErreur(ctx, 400, 'ValidationError', role.message);
    }
    const direction = await resoudreDirection(strapi, body.directionId);
    if (!direction.ok) {
      return reponseErreur(ctx, 400, 'ValidationError', direction.message);
    }
    const statut = drapeauxStatut(body.status || 'Actif');
    if (!statut) {
      return reponseErreur(ctx, 400, 'ValidationError', 'Statut invalide.');
    }

    try {
      const cree = await strapi
        .plugin('users-permissions')
        .service('user')
        .add({
          username,
          email,
          password,
          provider: 'local',
          confirmed: statut.confirmed,
          blocked: statut.blocked,
          role: role.value.id,
          direction: direction.value,
          department:
            String(body.department || '').trim() || null,
          fonction: String(body.fonction || '').trim() || null,
          phone: String(body.phone || '').trim() || null,
        });
      ctx.status = 201;
      return { data: { id: cree.id } };
    } catch (e) {
      return reponseErreur(
        ctx,
        400,
        'ValidationError',
        messageEcriture(e, 'Création')
      );
    }
  },

  /**
   * PUT /api/session/users/:id
   * Modification d'un compte applicatif. Réservé à l'administrateur.
   * Le mot de passe n'est modifié que s'il est fourni (non vide).
   */
  async updateUser(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return reponseErreur(ctx, 401, 'UnauthorizedError', 'Connexion requise.');
    }
    if (!(await estAdministrateur(strapi, ctx))) {
      return reponseErreur(
        ctx,
        403,
        'ForbiddenError',
        "Seul le rôle administrateur peut modifier un utilisateur."
      );
    }

    const id = Number(ctx.params && ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reponseErreur(ctx, 400, 'ValidationError', 'Identifiant utilisateur invalide.');
    }
    const existant = await strapi.db.query(USER_MODEL_UID).findOne({ where: { id } });
    if (!existant) {
      return reponseErreur(ctx, 404, 'NotFoundError', 'Utilisateur introuvable.');
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const data = {};

    if (body.username !== undefined) {
      const username = String(body.username || '').trim();
      if (username.length < 3) {
        return reponseErreur(
          ctx,
          400,
          'ValidationError',
          "Le nom d'utilisateur doit comporter au moins 3 caractères."
        );
      }
      data.username = username;
    }

    if (body.email !== undefined) {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reponseErreur(ctx, 400, 'ValidationError', 'Adresse email invalide.');
      }
      data.email = email;
    }

    if (body.password !== undefined && String(body.password).length > 0) {
      const password = String(body.password);
      if (password.length < 6) {
        return reponseErreur(
          ctx,
          400,
          'ValidationError',
          'Le mot de passe doit comporter au moins 6 caractères.'
        );
      }
      data.password = password;
    }

    if (body.roleType !== undefined) {
      const role = await resoudreRole(strapi, body.roleType);
      if (!role.ok) {
        return reponseErreur(ctx, 400, 'ValidationError', role.message);
      }
      data.role = role.value.id;
    }

    if (body.status !== undefined) {
      const statut = drapeauxStatut(body.status);
      if (!statut) {
        return reponseErreur(ctx, 400, 'ValidationError', 'Statut invalide.');
      }
      data.confirmed = statut.confirmed;
      data.blocked = statut.blocked;
    }

    if (body.directionId !== undefined) {
      const direction = await resoudreDirection(strapi, body.directionId);
      if (!direction.ok) {
        return reponseErreur(ctx, 400, 'ValidationError', direction.message);
      }
      data.direction = direction.value;
    }

    if (body.department !== undefined) {
      data.department = String(body.department || '').trim() || null;
    }
    if (body.fonction !== undefined) {
      data.fonction = String(body.fonction || '').trim() || null;
    }
    if (body.phone !== undefined) {
      data.phone = String(body.phone || '').trim() || null;
    }

    try {
      await strapi.plugin('users-permissions').service('user').edit(id, data);
      return { data: { id } };
    } catch (e) {
      return reponseErreur(
        ctx,
        400,
        'ValidationError',
        messageEcriture(e, 'Modification')
      );
    }
  },

  /**
   * DELETE /api/session/users/:id
   * Suppression d'un compte applicatif. Réservée à l'administrateur, qui ne
   * peut pas supprimer son propre compte (il se retrouverait sans session).
   */
  async deleteUser(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return reponseErreur(ctx, 401, 'UnauthorizedError', 'Connexion requise.');
    }
    if (!(await estAdministrateur(strapi, ctx))) {
      return reponseErreur(
        ctx,
        403,
        'ForbiddenError',
        "Seul le rôle administrateur peut supprimer un utilisateur."
      );
    }

    const id = Number(ctx.params && ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reponseErreur(ctx, 400, 'ValidationError', 'Identifiant utilisateur invalide.');
    }
    if (id === user.id) {
      return reponseErreur(
        ctx,
        400,
        'ValidationError',
        'Vous ne pouvez pas supprimer votre propre compte.'
      );
    }

    const existant = await strapi.db.query(USER_MODEL_UID).findOne({ where: { id } });
    if (!existant) {
      return reponseErreur(ctx, 404, 'NotFoundError', 'Utilisateur introuvable.');
    }

    try {
      await strapi.plugin('users-permissions').service('user').remove({ id });
      return { data: { id } };
    } catch (e) {
      return reponseErreur(
        ctx,
        400,
        'ValidationError',
        "Suppression impossible : ce compte est probablement lié à des données existantes. Suspendez-le plutôt."
      );
    }
  },
};
