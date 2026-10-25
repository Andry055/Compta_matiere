'use strict';

/**
 * reception controller
 *
 * Endpoints custom de la réception physique :
 *   GET    /api/receptions              liste des réceptions
 *   GET    /api/receptions/:documentId  détail d'une réception
 *   POST   /api/receptions              création d'une réception (dépositaire)
 *   POST   /api/receptions/:documentId/lignes  ajout d'une ligne de réception
 *
 * Contrôles effectués ICI, côté serveur :
 *   - le rôle connecté doit être « depositaire » (sinon 403) ;
 *   - la sortie liée doit être « validee » (sinon 400) ;
 *   - la direction de l'utilisateur = direction de la sortie (sinon 403) ;
 *   - quantite_recue <= quantite_commandee (sinon 400) ;
 *   - clé d'idempotence (idem-key) pour éviter les doubles soumissions ;
 *   - verrou optimiste sur `version` (sinon 409).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const {
  guardedCoreController,
  getRoleCode,
  DEMANDEUR_ROLE,
} = require('../../../utils/roleGuard');
// Définition unique du « jour » métier : le fuseau applicatif (Madagascar).
const { dateDuJour } = require('../../../utils/horloge');

const RECEPTION_UID = 'api::reception.reception';
const RECEPTION_LIGNE_UID = 'api::reception-ligne.reception-ligne';
const SORTIE_UID = 'api::sortie.sortie';
const SORTIE_LIGNE_UID = 'api::sortie-ligne.sortie-ligne';
const MATERIEL_UID = 'api::material.material';
const MOUVEMENT_UID = 'api::mouvement.mouvement';
const OUTBOX_SERVICE_PATH = '../../../api/notification-outbox/services/notification-outbox';

const DEPOSITAIRE_ROLE = 'depositaire';

/**
 * Erreur métier levée dans le flux de création : le contrôleur la convertit
 * en réponse 400/403/409 hors de toute transaction.
 */
class ErreurReception extends Error {
  constructor(statusTransaction, message) {
    super(message);
    this.name = 'ErreurReception';
    this.statusTransaction = statusTransaction;
  }
}

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  const noms = { 403: 'ForbiddenError', 404: 'NotFoundError', 409: 'ConflictError' };
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

function erreurInterne(ctx, message) {
  ctx.status = 500;
  ctx.body = { error: { status: 500, name: 'ApplicationError', message } };
  return ctx.body;
}

function baseHandler(ctrl, nom, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[nom];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${nom} » introuvable sur ${RECEPTION_UID}.`);
  }
  return handler.call(ctrl, ctx);
}

/** Nom de l'utilisateur (auteur de la réception / d'une ligne). */
function nomUtilisateur(user) {
  return (
    (user && (user.username || user.email)) ||
    (user && `Utilisateur #${user.id}`) ||
    ''
  );
}

/** Réception peuplée : lignes (avec leur matériel) + direction de l'en-tête. */
async function loadReception(strapi, documentId) {
  return strapi.documents(RECEPTION_UID).findOne({
    documentId,
    populate: {
      lignes: { populate: ['materiel', 'sortie_ligne'] },
      direction: true,
      sortie: true,
    },
  });
}

/** Récupère le code rôle de l'utilisateur connecté. */
async function roleConnecte(strapi, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user || !user.id) return null;
  return (await getRoleCode(strapi, user.id)).toLowerCase();
}

/** Récupère le documentId de la direction de l'utilisateur (jamais department). */
async function directionUtilisateur(strapi, userId) {
  const user = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({ where: { id: userId }, populate: ['direction'] });
  if (!user || !user.direction) return null;
  return user.direction.documentId;
}

/**
 * Détermine le statut d'une réception à partir des reliquats cumulés par
 * article sur toutes les réceptions de la sortie.
 *
 * Règles (R9-R11) :
 *   - complete : tous les articles ont reliquat_cumule = 0 (ET au moins une
 *     ligne reçue).
 *   - partielle : au moins un article a reliquat_cumule > 0 ET au moins une
 *     ligne a quantite_recue > 0.
 *   - en_cours : aucune ligne n'a quantite_recue > 0.
 */
async function determinerStatutReception(app, sortieDocumentId) {
  // Trouver toutes les réceptions de cette sortie.
  const receptions = await app.documents(RECEPTION_UID).findMany({
    filters: { sortie: { $eq: sortieDocumentId } },
  });
  const receptionIds = receptions.map((r) => r.documentId);
  if (receptionIds.length === 0) return 'en_cours';

  // Trouver toutes les lignes de réception de ces réceptions.
  const lignes = await app.documents(RECEPTION_LIGNE_UID).findMany({
    filters: { reception: { $in: receptionIds } },
  });
  if (lignes.length === 0) return 'en_cours';

  // Quantités commandées par ligne de sortie (source de vérité : la sortie).
  const sortie = await app.documents(SORTIE_UID).findOne({
    documentId: sortieDocumentId,
  });
  if (!sortie || !Array.isArray(sortie.lignes)) return 'en_cours';

  const commandeParSortieLigne = {};
  for (const sl of sortie.lignes) {
    commandeParSortieLigne[sl.documentId] = Number(sl.quantite) || 0;
  }

  // Quantités reçues cumulées par ligne de sortie.
  const recuParSortieLigne = {};
  let quelqueRecu = false;
  for (const ligne of lignes) {
    const sl = ligne.sortie_ligne;
    if (!recuParSortieLigne[sl]) recuParSortieLigne[sl] = 0;
    recuParSortieLigne[sl] += Number(ligne.quantite_recue) || 0;
    if (Number(ligne.quantite_recue) > 0) quelqueRecu = true;
  }

  if (!quelqueRecu) return 'en_cours';

  // Tous les reliquats cumulés = 0 ?
  const tousZero = Object.keys(commandeParSortieLigne).every(
    (slId) => (commandeParSortieLigne[slId] || 0) - (recuParSortieLigne[slId] || 0) <= 0
  );
  return tousZero ? 'complete' : 'partielle';
}

module.exports = guardedCoreController(createCoreController, RECEPTION_UID, {
  /**
   * GET /api/receptions
   * Liste des réceptions. Tous les rôles métier lisent ; l'isolation par
   * direction est appliquée côté contrôleur si nécessaire.
   */
  async find(ctx) {
    const app = strapi;
    return baseHandler(this, 'find', ctx);
  },

  /**
   * GET /api/receptions/:documentId
   * Détail d'une réception (404 si introuvable, jamais 403).
   */
  async findOne(ctx) {
    const app = strapi;
    return baseHandler(this, 'findOne', ctx);
  },

  /**
   * POST /api/receptions
 * Création d'une réception avec ses lignes, mouvements et entrées outbox,
 * le tout dans une transaction Strapi.
 *
 * Contrôles :
 *   - rôle 'depositaire' (sinon 403) ;
   * - sortie liée en statut 'validee' (sinon 400) ;
   * - direction de l'utilisateur = direction de la sortie (sinon 403) ;
   * - date_reception >= date_signature_logistique (sinon 400) ;
   * - quantite_recue <= quantite_commandee par ligne (sinon 400) ;
   * - clé d'idempotence (idem-key) pour éviter les doubles soumissions ;
   * - verrou optimiste sur `version` (sinon 409) sur mise à jour ultérieure.
   */
  async create(ctx) {
    const app = strapi;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour créer une réception.', 401);
    }

    const code = await roleConnecte(app, ctx);
    if (code !== DEPOSITAIRE_ROLE) {
      return forbid(
        ctx,
        'Seul le dépositaire peut créer une réception physique.'
      );
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Clé d'idempotence : même idem-key => même résultat, pas de doublon ---
    const idemKey = body.idem_key || body.idemKey;
    if (!idemKey || typeof idemKey !== 'string') {
      return badRequest(ctx, 'Clé d\'idempotence « idem_key » obligatoire.');
    }

    // Déjà créée avec cette clé ? Retourne l'existante (idempotente).
    const existante = await app.documents(RECEPTION_UID).findMany({
      filters: { idem_key: { $eq: idemKey } },
      fields: ['documentId', 'numero', 'statut', 'version'],
      limit: 1,
    });
    if (existante && existante.length > 0) {
      return { data: existante[0] };
    }

    // --- Résolution de la sortie liée ---
    const sortieDocumentId = body.sortie;
    if (!sortieDocumentId || typeof sortieDocumentId !== 'string') {
      return badRequest(ctx, 'Champ « sortie » obligatoire (documentId de la sortie).');
    }

    const sortie = await app.documents(SORTIE_UID).findOne({
      documentId: sortieDocumentId,
      populate: { direction: true, lignes: { populate: ['materiel'] } },
    });
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFoundError', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // La sortie doit être validée (stock déjà débité) avant réception.
    if (sortie.statut !== 'validee') {
      return badRequest(
        ctx,
        `La réception n'est possible que pour une sortie « validee » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    // Direction de l'utilisateur = direction de la sortie.
    const dirUser = await directionUtilisateur(app, user.id);
    if (!dirUser || dirUser !== sortie.direction.documentId) {
      return forbid(
        ctx,
        'Vous ne pouvez créer une réception que pour une sortie de votre propre direction.'
      );
    }

    // La sortie ne doit pas déjà être complètement réceptionnée
    // (tous les reliquats cumulés = 0 par article).
    const statutExistant = await determinerStatutReception(app, sortieDocumentId);
    if (statutExistant === 'complete') {
      return badRequest(
        ctx,
        `La sortie ${sortieDocumentId} est déjà complètement réceptionnée (tous les reliquats cumulés = 0).`
      );
    }

    // --- Champs de l'en-tête ---
    const numero = body.numero;
    if (!numero || typeof numero !== 'string') {
      return badRequest(ctx, 'Champ « numero » obligatoire.');
    }

    const depositaireNom = body.depositaire_nom;
    const depositaireFonction = body.depositaire_fonction;
    if (!depositaireNom || typeof depositaireNom !== 'string') {
      return badRequest(ctx, 'Champ « depositaire_nom » obligatoire.');
    }
    if (!depositaireFonction || typeof depositaireFonction !== 'string') {
      return badRequest(ctx, 'Champ « depositaire_fonction » obligatoire.');
    }

    const dateReception = body.date_reception || dateDuJour(new Date()).slice(0, 10);

    // R8 : date_reception >= date_signature_logistique.
    if (sortie.date_signature_logistique) {
      const dateSignLog =
        typeof sortie.date_signature_logistique === 'string'
          ? sortie.date_signature_logistique.slice(0, 10)
          : new Date(sortie.date_signature_logistique).toISOString().slice(0, 10);
      if (dateReception < dateSignLog) {
        return badRequest(
          ctx,
          `La date de réception (${dateReception}) ne peut pas être antérieure à la date de signature logistique (${dateSignLog}).`
        );
      }
    }

    // --- Lignes de réception (optionnelles à la création ; ajoutées via createLigne) ---
    const lignesRecues = Array.isArray(body.lignes) ? body.lignes : [];

    // Création atomique dans une transaction.
    let receptionCreee;
    try {
      receptionCreee = await strapi.db.transaction(async ({ trx }) => {
        // 1. Créer la réception (statut provisoire 'en_cours', version=1).
        const reception = await app.documents(RECEPTION_UID).create({
          data: {
            idem_key: idemKey,
            numero,
            date_reception: dateReception,
            statut: 'en_cours',
            version: 1,
            depositaire_nom: depositaireNom,
            depositaire_fonction: depositaireFonction,
            direction: sortie.direction.documentId,
            sortie: sortieDocumentId,
            observations: typeof body.observations === 'string' ? body.observations : null,
            createdBy: user.id,
            updatedBy: user.id,
          },
        });

        // 2. Créer les lignes de réception + mouvements (si lignes fournies).
        if (lignesRecues.length > 0) {
          for (const ligne of lignesRecues) {
          const sortieLigneDocumentId = ligne.sortie_ligne;
          const materielDocumentId = ligne.materiel;
          const quantiteRecue = Number(ligne.quantite_recue);
          const quantiteCommandee = Number(ligne.quantite_commandee);

          if (!Number.isInteger(quantiteRecue) || quantiteRecue < 0) {
            const err = new Error(
              `quantite_recue invalide pour la ligne ${sortieLigneDocumentId}`
            );
            err.status = 400;
            throw err;
          }

          // Vérifier que la sortie_ligne existe et appartient à cette sortie.
          const sortieLigne = await app.documents(SORTIE_LIGNE_UID).findOne({
            documentId: sortieLigneDocumentId,
          });
          if (!sortieLigne) {
            const err = new Error(`Ligne de sortie introuvable : ${sortieLigneDocumentId}`);
            err.status = 404;
            throw err;
          }
          // En simulation, sortieLigne.sortie peut être une chaîne (documentId)
          // ou un objet peuplé { documentId }. Accepter les deux formes.
          const sortieLigneSortieId =
            typeof sortieLigne.sortie === 'string'
              ? sortieLigne.sortie
              : sortieLigne.sortie && sortieLigne.sortie.documentId;
          if (sortieLigneSortieId && sortieLigneSortieId !== sortieDocumentId) {
            const err = new Error(
              `La ligne de sortie ${sortieLigneDocumentId} n'appartient pas à la sortie ${sortieDocumentId}`
            );
            err.status = 400;
            throw err;
          }

          // R6 : quantite_recue <= quantite_commandee.
          if (quantiteRecue > quantiteCommandee) {
            const err = new Error(
              `Quantité reçue (${quantiteRecue}) supérieure à la quantité commandée (${quantiteCommandee}) sur la ligne ${sortieLigneDocumentId}`
            );
            err.status = 400;
            throw err;
          }

          const quantiteReliquat = quantiteCommandee - quantiteRecue;

          await app.documents(RECEPTION_LIGNE_UID).create({
            data: {
              reception: reception.documentId,
              sortie_ligne: sortieLigneDocumentId,
              materiel: materielDocumentId,
              quantite_commandee: quantiteCommandee,
              quantite_recue: quantiteRecue,
              quantite_reliquat: quantiteReliquat,
              etat: ligne.etat || 'neuf',
              observations: typeof ligne.observations === 'string' ? ligne.observations : null,
            },
          });

          // Mouvement 'Réception physique'.
          await app.documents(MOUVEMENT_UID).create({
            data: {
              action: 'Réception physique',
              quantite: quantiteRecue,
              sortie: sortieDocumentId,
              materiel: materielDocumentId,
              date: dateReception,
              createdBy: user.id,
            },
          });
        }
        }

        // 3. Déterminer le statut + 4. Créer les entrées outbox,
        // uniquement si des lignes de réception ont été traitées.
        if (lignesRecues.length > 0) {
          const statutFinal = await determinerStatutReception(app, sortieDocumentId);
          if (statutFinal !== 'en_cours') {
            await app.documents(RECEPTION_UID).update({
              documentId: reception.documentId,
              data: { statut: statutFinal, version: reception.version + 1, updatedBy: user.id },
            });
          }

          const { creerEntrees } = require(OUTBOX_SERVICE_PATH);
          const destinataires = [{ id: user.id, email: user.email, username: user.username }];
          const eventType =
            statutFinal === 'complete' ? 'reception_complete' : 'reception_partielle';
          await creerEntrees(app, sortieDocumentId, destinataires, eventType, {
            reception: reception.documentId,
            numero,
            statut: statutFinal,
          });
        }

        return reception;
      });
    } catch (e) {
      if (e.status === 400 || e.status === 404) {
        return badRequest(ctx, e.message);
      }
      throw e;
    }

    // Après le commit de la transaction : distribuer les notifications.
    // L'échec de la distribution ne doit pas faire échouer la création
    // de la réception (best-effort).
    try {
      const { distribuerNotifications } = require(OUTBOX_SERVICE_PATH);
      await distribuerNotifications(app);
    } catch {
      // Notifications best-effort : l'échec est ignoré ici.
    }

    const complete = await loadReception(app, receptionCreee.documentId);
    ctx.status = 201;
    return { data: complete };
  },

  /**
   * POST /api/receptions/:documentId/lignes
   * Ajoute une ligne de réception à une réception existante.
   *
   * Contrôles :
   *   - rôle 'depositaire' (sinon 403) ;
   *   - réception existe et est « en_cours » (sinon 400/404) ;
   *   - quantite_recue <= quantite_commandee (sinon 400) ;
   *   - verrou optimiste sur `version` (sinon 409).
   */
  async createLigne(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour ajouter une ligne.', 401);
    }

    const code = await roleConnecte(app, ctx);
    if (code !== DEPOSITAIRE_ROLE) {
      return forbid(ctx, 'Seul le dépositaire peut ajouter une ligne de réception.');
    }

    const reception = await app.documents(RECEPTION_UID).findOne({
      documentId,
      populate: { lignes: { populate: ['materiel'] } },
    });
    if (!reception) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFoundError', message: 'Réception introuvable.' } };
      return ctx.body;
    }

    if (reception.statut !== 'en_cours') {
      return badRequest(
        ctx,
        `Une ligne ne peut être ajoutée qu'à une réception « en_cours » (statut actuel : ${reception.statut || '—'}).`
      );
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Verrou optimiste sur version ---
    const versionEnvoi = body.version;
    if (versionEnvoi === undefined || Number(versionEnvoi) !== reception.version) {
      return forbid(
        ctx,
        `Conflit de version : la réception a été modifiée (version attendue ${reception.version}, envoyée ${versionEnvoi === undefined ? 'absente' : versionEnvoi}).`,
        409
      );
    }

    // --- Sortie ligne liée ---
    const sortieLigneDocumentId = body.sortie_ligne;
    if (!sortieLigneDocumentId || typeof sortieLigneDocumentId !== 'string') {
      return badRequest(ctx, 'Champ « sortie_ligne » obligatoire.');
    }

    const sortieLigne = await app.documents(SORTIE_LIGNE_UID).findOne({
      documentId: sortieLigneDocumentId,
      populate: { materiel: true },
    });
    if (!sortieLigne) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFoundError', message: 'Ligne de sortie introuvable.' } };
      return ctx.body;
    }

    // La ligne de sortie doit appartenir à la sortie de cette réception.
    if (sortieLigne.sortie && sortieLigne.sortie.documentId !== reception.sortie.documentId) {
      return badRequest(
        ctx,
        'La ligne de sortie liée n\'appartient pas à la sortie de cette réception.'
      );
    }

    // --- Quantités : reçue <= commandée ---
    const quantiteRecue = Number(body.quantite_recue);
    const quantiteCommandee = Number(sortieLigne.quantite) || 0;
    if (!Number.isInteger(quantiteRecue) || quantiteRecue < 0) {
      return badRequest(ctx, 'Champ « quantite_recue » obligatoire (entier positif).');
    }
    if (quantiteRecue > quantiteCommandee) {
      return badRequest(
        ctx,
        `Quantité reçue (${quantiteRecue}) supérieure à la quantité commandée (${quantiteCommandee}).`
      );
    }

    // --- Matériel ---
    const materielDocumentId = body.materiel || (sortieLigne.materiel && sortieLigne.materiel.documentId);
    if (!materielDocumentId || typeof materielDocumentId !== 'string') {
      return badRequest(ctx, 'Champ « materiel » obligatoire.');
    }

    const materiel = await app.documents(MATERIEL_UID).findOne({ documentId: materielDocumentId });
    if (!materiel) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFoundError', message: 'Matériel introuvable.' } };
      return ctx.body;
    }

    const maintenant = new Date().toISOString();
    const quantiteReliquat = quantiteCommandee - quantiteRecue;

    const ligne = await app.documents(RECEPTION_LIGNE_UID).create({
      data: {
        reception: documentId,
        sortie_ligne: sortieLigneDocumentId,
        materiel: materielDocumentId,
        quantite_commandee: quantiteCommandee,
        quantite_recue: quantiteRecue,
        quantite_reliquat: quantiteReliquat,
        etat: body.etat || 'neuf',
        observations: typeof body.observations === 'string' ? body.observations : null,
      },
    });

    // Incrémente la version de la réception (verrou optimiste pour la prochaine ligne).
    await app.documents(RECEPTION_UID).update({
      documentId,
      data: { version: reception.version + 1, updatedBy: user.id },
    });

    const complete = await loadReception(app, documentId);
    ctx.status = 201;
    return { data: complete };
  },
});
