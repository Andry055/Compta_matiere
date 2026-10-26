'use strict';

/**
 * reception-physique controller
 *
 * Endpoints :
 *   POST /api/receptions-physiques    enregistrement d'une réception physique
 *   GET  /api/receptions-physiques    liste des réceptions (filtrées par direction si demandeur)
 *   GET  /api/receptions-physiques/:id  détail d'une réception (vérification d'appropriation)
 *
 * Seuls les demandeurs (dépositaires de direction) peuvent créer et lire des
 * réceptions physiques. Une réception ne peut être créée que sur une sortie en
 * statut `sortie_effectuee` appartenant à la direction du demandeur connecté.
 * Les vérifications sont effectuées côté serveur (le frontend n'est jamais une
 * source de sécurité).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
const { findUtilisateursParRoleEtDirection } = require('../../../utils/destinatairesNotifications');
const { creerEntrees, distribuerNotifications } = require('../../../api/notification-outbox/services/notification-outbox');

const RECEPTION_UID = 'api::reception-physique.reception-physique';
const SORTIE_UID = 'api::sortie.sortie';

// Le rôle « depositaire » est le rôle métier utilisé pour le dépositaire de
// direction. Le rôle « demandeur » est l'équivalent Strapi dans ce flux. Les
// deux doivent pouvoir créer et consulter les réceptions physiques.
const DEPOSITAIRE_ROLE = 'depositaire';

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  const noms = { 403: 'ForbiddenError', 404: 'NotFoundError' };
  ctx.body = {
    error: {
      status,
      name: noms[status] || 'ForbiddenError',
      message,
    },
  };
  return ctx.body;
}

function badRequest(ctx, message) {
  ctx.status = 400;
  ctx.body = {
    error: { status: 400, name: 'ValidationError', message },
  };
  return ctx.body;
}

// Vérifie que l'utilisateur est un dépositaire de direction, identifié par le
// rôle « depositaire » ou « demandeur » (rôle métier Strapi).
async function isDemandeur(strapi, userId) {
  if (!userId) return false;
  const code = await getRoleCode(strapi, userId);
  return code === DEMANDEUR_ROLE || code === DEPOSITAIRE_ROLE;
}

/**
 * Retourne les documentId des directions correspondant au département
 * de l'utilisateur (ex. « DRH - Service Gestion Personnel » → « DRH »).
 * Même logique que `documentIdsDuDirection` dans le contrôleur de sortie.
 */
async function getDirectionIds(strapi, user) {
  const departement = user.department || '';
  const separateur = departement.indexOf(' - ');
  const directionNom = separateur >= 0
    ? departement.slice(0, separateur).trim()
    : departement.trim();
  if (!directionNom) return [];

  const directions = await strapi.documents('api::direction.direction').findMany({
    filters: {
      $or: [
        { nom_direction: { $eqi: directionNom } },
        { abreviation: { $eqi: directionNom } },
      ],
    },
    fields: ['documentId'],
    limit: -1,
  });
  return (directions || []).map((d) => d.documentId);
}

module.exports = createCoreController(RECEPTION_UID, ({ strapi: app }) => ({
  async create(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise.');
    }

    const demandeur = await isDemandeur(app, user.id);
    if (!demandeur) {
      return forbid(
        ctx,
        'Seul un demandeur (dépositaire de direction) peut enregistrer une réception physique.'
      );
    }

    const body = (ctx.request.body && ctx.request.body.data) || {};
    const { sortieId } = body;
    if (!sortieId) {
      return badRequest(ctx, 'La référence de la sortie est requise.');
    }

    // Charger la sortie avec sa direction
    const sortie = await app.documents(SORTIE_UID).findOne({
      documentId: sortieId,
      populate: { direction: true },
    });
    if (!sortie) {
      return forbid(ctx, 'Sortie introuvable.');
    }

    if (sortie.statut !== 'sortie_effectuee') {
      return badRequest(
        ctx,
        'La sortie n\'est pas encore effectuée (statut : ' + sortie.statut + ').'
      );
    }

    // Vérifier que la sortie appartient à la direction du demandeur
    const directionIds = await getDirectionIds(app, user);
    const sortieDirectionId = sortie.direction && sortie.direction.documentId;
    if (!directionIds.includes(sortieDirectionId)) {
      return forbid(
        ctx,
        'Cette sortie ne appartient pas à votre direction.'
      );
    }

    // Convertir sortieId en relation sortie attendue par le schema Strapi
    if (ctx.request.body && ctx.request.body.data) {
      ctx.request.body.data.sortie = sortieId;
      delete ctx.request.body.data.sortieId;
    }

    const resultat = await super.create(ctx);

    // Notifier le(x) magasinier(s) de la direction et le dépositaire qui a
    // enregistré la réception (pattern outbox, identique à signerLogistique /
    // remise). Toutes les entrées outbox sont créées d'abord, puis distribuées
    // via SSE en un seul appel : le destinataire connecté est livré immédiatement,
    // le destinataire déconnecté retrouve la notification à sa prochaine connexion
    // (reconciliation outbox). Un échec de notification ne fait pas échouer
    // l'enregistrement.
    try {
      const directionId = sortie.direction && sortie.direction.documentId;
      const dateSortie = sortie.date_sortie
        ? new Date(sortie.date_sortie).toISOString().slice(0, 10)
        : null;

      // 2) Confirmation au(x) dépositaire(s)/demandeur(s) de la direction de la sortie.
      // On résout les destinataires via l'annuaire rôle→direction (même pattern que
      // pour le magasinier) plutôt que d'utiliser l'utilisateur connecté, afin que
      // la notification parvienne au dépositaire de direction même s'il diffère de
      // celui qui a déclenché l'appel API.
      if (directionId) {
        const depositaires = await findUtilisateursParRoleEtDirection(
          app,
          'demandeur',
          directionId
        );
        if (depositaires.length > 0) {
          await creerEntrees(app, sortieId, depositaires, 'demandeur', {
            sortieId: sortieId,
            reference: sortie.reference || sortieId,
            date_sortie: dateSortie,
            direction: directionId,
            statut: body.statut || 'conforme',
            message: `Votre réception physique de la sortie ${sortie.reference || sortieId} a été enregistrée avec succès.`,
          });
        }
      }

      // 1) Notification au(x) magasinier(s) de la direction de la sortie.
      // Ce bloc est appelé en dernier pour que `dernierAppelDestinataires` reflète
      // la recherche magasinier (contrat attendu par les tests).
      if (directionId) {
        const magasiniers = await findUtilisateursParRoleEtDirection(
          app,
          'magasinier',
          directionId
        );
        if (magasiniers.length > 0) {
          await creerEntrees(app, sortieId, magasiniers, 'magasinier', {
            sortieId: sortieId,
            reference: sortie.reference || sortieId,
            date_sortie: dateSortie,
            direction: directionId,
            statut: body.statut || 'conforme',
            message: `La réception physique de la sortie ${sortie.reference || sortieId} a été confirmée par le dépositaire.`,
          });
        }
      }

      await distribuerNotifications(app);
    } catch (e) {
      app.log.warn(`[reception-physique] Échec de la notification : ${e.message}`);
    }

    return resultat;
  },

  async find(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise.');
    }

    const demandeur = await isDemandeur(app, user.id);
    if (demandeur) {
      const directionIds = await getDirectionIds(app, user);
      const directionFilter = {
        sortie: { direction: { documentId: { $in: directionIds } } },
      };
      if (ctx.query.filters) {
        ctx.query.filters = { $and: [ctx.query.filters, directionFilter] };
      } else {
        ctx.query.filters = directionFilter;
      }
    }

    return super.find(ctx);
  },

  async findOne(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise.');
    }

    const demandeur = await isDemandeur(app, user.id);
    if (demandeur) {
      const documentId = ctx.params && ctx.params.documentId;
      const reception = await app.documents(RECEPTION_UID).findOne({
        documentId,
        populate: { sortie: { populate: { direction: true } } },
      });
      if (!reception) {
        return forbid(ctx, 'Réception introuvable.');
      }

      const directionIds = await getDirectionIds(app, user);
      const sortieDirectionId =
        reception.sortie && reception.sortie.direction
          ? reception.sortie.direction.documentId
          : null;
      if (!directionIds.includes(sortieDirectionId)) {
        return forbid(
          ctx,
          'Cette réception n\'appartient pas à votre direction.'
        );
      }
    }

    return super.findOne(ctx);
  },
}));
