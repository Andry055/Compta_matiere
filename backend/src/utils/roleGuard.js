'use strict';

/**
 * Garde-fou d'écriture côté backend.
 *
 * Les permissions globales se gèrent dans Administration -> Rôles, mais certaines
 * opérations sont interdites par principe pour un profil « demandeur » :
 *  - modifier des données de mouvement (entrées / sorties / stock),
 *  - signer ou valider une entrée à la place d'un responsable,
 *  - supprimer des données importantes,
 *  - approuver sa propre demande.
 *
 * Le profil « demandeur » reste autorisé à créer et suivre SES demandes
 * (création, brouillon, envoi, annulation) : c'est la seule ressource en
 * écriture qui lui ouvre.
 *
 * Les vérifications sont effectuées ici, côté serveur : le frontend ne
 * constitue jamais une source de sécurité.
 */

const DEMANDEUR_ROLE = 'demandeur';
const DEMANDE_UID = 'api::demande.demande';

// Statuts qu'un demandeur peut lui-même donner à sa demande.
const DEMANDEUR_ALLOWED_STATUTS = ['brouillon', 'en_attente', 'annulee'];

async function getRoleCode(strapi, userId) {
  try {
    const user = await strapi.db
      .query('plugin::users-permissions.user')
      .findOne({ where: { id: userId }, populate: ['role'] });
    if (!user || !user.role) return '';
    // Strapi users-permissions : le code du rôle est `type`
    // (`code` reste toléré pour compatibilité).
    const code = user.role.code || user.role.type || '';
    return code.toString().toLowerCase();
  } catch (e) {
    return '';
  }
}

function forbid(ctx, message) {
  ctx.status = 403;
  ctx.body = {
    error: {
      status: 403,
      name: 'ForbiddenError',
      message,
    },
  };
}

/**
 * Vérifie qu'un profil « demandeur » a le droit d'écrire sur `uid`.
 * Toutes les ressources sauf `api::demande.demande` lui sont interdites.
 */
async function assertCanWrite(strapi, ctx, uid) {
  const userId = ctx.state && ctx.state.user ? ctx.state.user.id : null;
  if (!userId) {
    return; // non authentifie -> gere par l'authentification Strapi
  }

  const code = await getRoleCode(strapi, userId);
  if (!code || code !== DEMANDEUR_ROLE) return;

  if (uid !== DEMANDE_UID) {
    forbid(
      ctx,
      "Votre rôle (Demandeur) ne vous permet pas de modifier ou de supprimer ces données."
    );
    return;
  }

  const method = (ctx.request.method || 'GET').toUpperCase();

  // Suppression interdite (aucun droit « supprimer » pour ce rôle).
  if (method === 'DELETE') {
    forbid(ctx, 'Votre rôle (Demandeur) ne permet pas de supprimer une demande.');
    return;
  }

  const body = (ctx.request.body && ctx.request.body.data) || {};

  // La possession de la demande est forcée côté serveur par le contrôleur
  // (`create` fixe `demandeur` à l'utilisateur connecté) : impossible de
  // créer une demande au nom d'un autre.

  // Jamais d'auto-validation : statuts de décision réservés aux responsables.
  if (
    body.statut &&
    !DEMANDEUR_ALLOWED_STATUTS.includes(body.statut)
  ) {
    forbid(
      ctx,
      'Seul un responsable habilité peut valider, rejeter ou faire avancer une demande.'
    );
    return;
  }

  // Mise à jour : uniquement sur ses propres demandes, tant qu'elles ne sont
  // pas clôturées (validée / refusée / sortie effectuée).
  if (method === 'PUT' || method === 'PATCH') {
    const documentId = ctx.params && ctx.params.documentId;
    if (documentId) {
      try {
        const existing = await strapi
          .documents(DEMANDE_UID)
          .findOne({ documentId, populate: ['demandeur'] });
        if (!existing) {
          forbid(ctx, 'Demande introuvable.');
          return;
        }
        const ownerId =
          existing.demandeur && existing.demandeur.id
            ? existing.demandeur.id
            : null;
        if (ownerId && ownerId !== userId) {
          forbid(ctx, 'Vous ne pouvez modifier que vos propres demandes.');
          return;
        }
        if (
          existing.statut &&
          !DEMANDEUR_ALLOWED_STATUTS.includes(existing.statut)
        ) {
          forbid(
            ctx,
            'Cette demande a déjà été traitée par un responsable et ne peut plus être modifiée.'
          );
          return;
        }
      } catch (e) {
        forbid(ctx, 'Impossible de vérifier la demande.');
        return;
      }
    }
  }
}

/**
 * Contrôleur core avec garde-fou en écriture (create/update/delete).
 * `customMethods` permet d'ajouter des endpoints custom (ex. signature
 * d'une entrée) qui héritent du même contexte Strapi.
 */
function guardedCoreController(createCoreController, uid, customMethods = {}) {
  return createCoreController(uid, ({ strapi: app }) => ({
    async create(ctx) {
      await assertCanWrite(app, ctx, uid);
      if (ctx.status === 403) return ctx.body;
      return super.create(ctx);
    },
    async update(ctx) {
      await assertCanWrite(app, ctx, uid);
      if (ctx.status === 403) return ctx.body;
      return super.update(ctx);
    },
    async delete(ctx) {
      await assertCanWrite(app, ctx, uid);
      if (ctx.status === 403) return ctx.body;
      return super.delete(ctx);
    },
    ...customMethods,
  }));
}

module.exports = { assertCanWrite, guardedCoreController, getRoleCode, DEMANDEUR_ROLE };
