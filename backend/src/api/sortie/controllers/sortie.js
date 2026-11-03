'use strict';

/**
 * sortie controller
 *
 * Endpoints custom (circuit de sortie, même modèle que les entrées) :
 *   POST /api/sorties/create-complete    création complète (entête + lignes)
 *   POST /api/sorties/:documentId/sign   signature contrôlée par rôle
 *   POST /api/sorties/:documentId/reject rejet par un habilité
 *
 * Circuit cible (ordre strict) : magasinier → dépositaire comptable →
 * chef logistique. À l'étape 4, la 3ᵉ signature (logistique) valide la
 * sortie et DÉBITE le stock, en une seule transaction de base de données :
 * validation, baisse des stocks et mouvements réussissent ensemble ou
 * échouent ensemble — aucun état intermédiaire n'est jamais visible.
 * Le statut reste « en_preparation » après les signatures 1 et 2 ; il passe
 * à « validee » uniquement à la 3ᵉ signature.
 *
 * Contrôles effectués ICI, côté serveur (le frontend n'est jamais une
 * source de sécurité) :
 *   - le rôle connecté doit correspondre à la signature demandée ;
 *   - l'ordre du workflow est respecté (1 puis 2 puis 3) ;
 *   - une signature enregistrée n'est jamais modifiable (409) ;
 *   - le Demandeur ne signe ni ne rejette jamais.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const {
  guardedCoreController,
  getRoleCode,
  DEMANDEUR_ROLE,
} = require('../../../utils/roleGuard');
const {
  filtreAppropriation,
  verifierAccesSortie,
} = require('../../../utils/sortieAcces');
// Définition unique du « jour » métier : le fuseau applicatif (Madagascar),
// indépendant de la configuration du serveur.
const { dateDuJour } = require('../../../utils/horloge');
// Création d'un ordre de sortie : logique PARTAGÉE avec la voie
// « depuis une demande approuvée » (utils/creationSortie.js). Un seul chemin
// de création : mêmes contrôles, même transaction, mêmes messages.
const {
  preparerSortie,
  creerSortieEtLignes,
  tracerMouvementSortie,
  ErreurCreationSortie,
} = require('../../../utils/creationSortie');

const SORTIE_UID = 'api::sortie.sortie';
const SORTIE_LIGNE_UID = 'api::sortie-ligne.sortie-ligne';
const MOUVEMENT_UID = 'api::mouvement.mouvement';

const { findUtilisateursParRoleEtDirection } = require('../../../utils/destinatairesNotifications');
const { creerEntrees, distribuerNotifications } = require('../../../api/notification-outbox/services/notification-outbox');

/** Noms des tables SQL (collectionName des schémas) : utilisés par le SQL
 *  conditionnel ATOMIQUE de la validation (verrou stock_impacte et
 *  décrémentations du stock, dans la transaction). */
const TABLE_SORTIES = 'sorties';
const TABLE_MATERIALS = 'materials';

/**
 * Rôle autorisé pour signer. Correspondance entre les rôles Strapi et les
 * signataires réglementaires du circuit de sortie :
 *   magasinier   -> MAGASINIER (et admin) — ordre 1
 *   depositaire  -> DEPOSITAIRE (et admin) — ordre 2
 *   logistique   -> LOGISTIQUE (et admin) — ordre 3 (bientôt, refusé à l'étape 3)
 */
const SIGNATURE_ROLES = {
  magasinier: {
    flag: 'magasinier_signed',
    dateField: 'date_signature_magasinier',
    signerField: 'signataire_magasinier',
    roles: ['magasinier'],
    order: 1,
  },
  depositaire: {
    flag: 'depositaire_signed',
    dateField: 'date_signature_depositaire',
    signerField: 'signataire_depositaire',
    roles: ['depositaire'],
    order: 2,
  },
  logistique: {
    flag: 'logistique_signed',
    dateField: 'date_signature_logistique',
    signerField: 'signataire_logistique',
    roles: ['logistique'],
    order: 3,
  },
};

const ETATS_VALIDES = ['neuf', 'bon', 'moyen', 'defaillant'];

/** Erreur métier levée DANS la transaction de validation : le rollback est
 *  déclenché par strapi.db.transaction (tout est annulé), puis l'erreur est
 *  convertie en réponse 400/409/500 hors de la transaction. */
class ErreurTransaction extends Error {
  constructor(statusTransaction, message) {
    super(message);
    this.name = 'ErreurTransaction';
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

async function isDemandeurSession(strapi, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user || !user.id) return false;
  const code = await getRoleCode(strapi, user.id);
  return code === DEMANDEUR_ROLE;
}

function withAppropriationFilter(ctx, documentIds) {
  ctx.query.filters = filtreAppropriation(ctx.query.filters, documentIds || []);
}

function baseHandler(ctrl, nom, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[nom];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${nom} » introuvable sur ${SORTIE_UID}.`);
  }
  return handler.call(ctrl, ctx);
}

/** documentId des sorties créées par cet utilisateur (via SA demande). */
async function documentIdsPossedesPar(strapi, user) {
  const rows = await strapi.documents(SORTIE_UID).findMany({
    filters: {
      demande: {
        demandeur: {
          documentId: user.documentId,
        },
      },
    },
    fields: ['documentId'],
    limit: -1,
  });
  return (rows || []).map((l) => l.documentId);
}

/** documentId des sorties de la direction de l'utilisateur (pour un demandeur,
 *  il voit toutes les sorties de sa direction, pas seulement les siennes).
 *  Le `department` est de la forme « <DIRECTION> - <SERVICE> » (ex. « DRH -
 *  Service Gestion Personnel ») ou parfois seulement le nom de direction. */
async function documentIdsDuDirection(strapi, user) {
  const departement = user.department || '';
  const separateur = departement.indexOf(' - ');
  const directionNom = separateur >= 0
    ? departement.slice(0, separateur).trim()
    : departement.trim();
  if (!directionNom) return [];

  const directions = await strapi.documents('api::direction.direction').findMany({
    filters: { nom_direction: { $eqi: directionNom } },
    fields: ['documentId'],
    limit: -1,
  });
  if (!directions || directions.length === 0) return [];

  const directionIds = directions.map((d) => d.documentId);

  const rows = await strapi.documents(SORTIE_UID).findMany({
    filters: {
      direction: { documentId: { $in: directionIds } },
    },
    fields: ['documentId'],
    limit: -1,
  });
  return (rows || []).map((l) => l.documentId);
}

/** Sortie peuplée : lignes (avec leur matériel) + données d'en-tête. */
async function loadSortie(strapi, documentId) {
  return strapi.documents(SORTIE_UID).findOne({
    documentId,
    populate: {
      lignes: { populate: ['materiel'] },
      direction: true,
      service: true,
      demande: true,
      mouvements: true,
    },
  });
}

/** Nom de l'utilisateur (signataire / auteur d'un mouvement). */
function nomUtilisateur(user) {
  return (
    (user && (user.username || user.email)) ||
    (user && `Utilisateur #${user.id}`) ||
    ''
  );
}

/**
 * Aux signatures 1 et 2, vérifie que chaque ligne reste couverte par le
 * stock ACTUEL du matériel (la baisse définitive a lieu à l'étape 4, avec
 * une vérification atomique ; ici il s'agit d'alerter avant de signer).
 * Retourne un message d'erreur (nom du matériel + quantités) ou null.
 */
async function verifierStockDisponible(app, sortie) {
  for (const ligne of sortie.lignes || []) {
    const materiel = ligne.materiel;
    if (!materiel) continue; // ligne sans matériel relié : rien à couvrir
    const quantiteStock = Number(materiel.quantite_stock) || 0;
    const quantiteDemandee = Number(ligne.quantite) || 0;
    if (quantiteDemandee > quantiteStock) {
      return (
        `Stock insuffisant pour « ${materiel.designation || materiel.documentId} » : ` +
        `quantité demandée ${quantiteDemandee}, quantité en stock ${quantiteStock}.`
      );
    }
  }
  return null;
}

/**
 * ÉTAPE 4 — signature du chef logistique : validation finale + baisse du stock.
 *
 * Tout se déroule dans UNE transaction (strapi.db.transaction, liaisons
 * automatiques par AsyncLocalStorage vérifiées dans @strapi/database) :
 *   1. réception de toutes les pénuries EN LECTURE SEULE dans la transaction :
 *      pour chaque matériel, lecture de quantite_stock actuelle ; si quantite
 *      demandée > stock, la ligne est inscrite dans la liste des insuffisances ;
 *      si la liste n'est pas vide, 409 avec toutes les lignes listées, AUCUNE
 *      décrémentation, ROLLBACK avec le stock intact.
 *   2. verrou anti-double exécution : UPDATE conditionnel
 *      sorties.stock_impacte false->true (0 ligne modifiée => 409) ;
 *   3. décrémentations ATOMIQUES du stock :
 *      UPDATE materials SET quantite_stock = quantite_stock - X
 *      WHERE document_id = ? AND quantite_stock >= X
 *      (0 ligne modifiée => 409, nom du matériel + quantités, rollback) ;
 *      NOTE : si une concurrence a passé entre la lecture et la décrémentation,
 *      la décrémentation peut échouer même si la lecture est passée — dans ce
 *      cas on annule avec la ligne fautive (même principe : rollback complet).
 *   4. numeros_logistiques sur les lignes (texte enregistré TEL QUEL, jamais
 *      généré, jamais de format imposé, 100 caractères maximum) ;
 *   5. signature logistique + statut validee + date ISO posée par le serveur ;
 *   6. mouvements : un mouvement « Sortie validée, stock débité » PAR ligne
 *      + un mouvement « Signature logistique ».
 * Un échec de traçage constitue un échec de validation : la transaction est
 * annulée (une sortie sans trace ne doit pas exister).
 */
async function signerLogistique(app, ctx, sortie, documentId, user, body) {
  const lignes = sortie.lignes || [];

  // --- Ligne sans fiche matériel : refus AVANT la transaction (400) ----------
  // La décrémentation atomique cible la fiche par documentId : sans fiche,
  // rien ne peut être débité de manière fiable.
  const sansFiche = lignes.filter((l) => !l.materiel || !l.materiel.documentId);
  if (sansFiche.length > 0) {
    return badRequest(
      ctx,
      `Validation impossible : ${sansFiche.length} ligne(s) sans fiche matériel — ${sansFiche
        .map((l) => l.designation || `Ligne ${l.documentId}`)
        .join(', ')}. Une sortie ne peut pas être validée sans fiche matériel.`
    );
  }

  // --- numeros_logistiques facultatifs : { ligne, numero_logistique } --------
  const numeros = Array.isArray(body.numeros_logistiques)
    ? body.numeros_logistiques
    : [];
  const numerosParLigne = new Map();
  for (const element of numeros) {
    if (!element || typeof element.ligne !== 'string' || !element.ligne) {
      return badRequest(
        ctx,
        'numeros_logistiques : chaque élément doit contenir { ligne, numero_logistique }.'
      );
    }
    if (
      typeof element.numero_logistique !== 'string' ||
      element.numero_logistique.length === 0 ||
      element.numero_logistique.length > 100
    ) {
      return badRequest(
        ctx,
        'numeros_logistiques : numero_logistique obligatoire (texte de 100 caractères maximum).'
      );
    }
    if (!lignes.some((l) => l.documentId === element.ligne)) {
      return badRequest(
        ctx,
        `La ligne ${element.ligne} ne fait pas partie de cette sortie.`
      );
    }
    numerosParLigne.set(element.ligne, element.numero_logistique);
  }

  // --- Eléments des mouvements (recalculés côté serveur, jamais du client) --
  const signataire = nomUtilisateur(user);
  const maintenant = new Date().toISOString();
  const jour = maintenant.slice(0, 10);
  const totalQuantite = lignes.reduce(
    (s, l) => s + (Number(l.quantite) || 0),
    0
  );

  // Valide les décrémentations et EXIGE le traçage : les exceptions ci
  // dessous (ErreurTransaction ou erreur brute) annulent TOUT.
  try {
    await app.db.transaction(async ({ trx }) => {
      // 1) Réception de toutes les pénuries AVANT toute écriture.
      //    Lis chaque stock, collecte les insuffisances ; si au moins une
      //    pénurie existe, annule immédiatement avec la liste complète.
      const insuffisances = [];
      for (const ligne of lignes) {
        const materielId = ligne.materiel.documentId;
        const courant = await trx(TABLE_MATERIALS)
          .where({ document_id: materielId })
          .first('quantite_stock');
        const stock = courant ? Number(courant.quantite_stock) || 0 : 0;
        const demande = Number(ligne.quantite) || 0;
        if (demande > stock) {
          insuffisances.push({
            materiel: ligne.materiel.designation || ligne.designation || materielId,
            demande,
            stock,
            materielId,
          });
        }
      }
      if (insuffisances.length > 0) {
        const message = insuffisances
          .map(
            (inv) =>
              `Stock insuffisant pour « ${inv.materiel} » : quantité demandée ${inv.demande}, quantité disponible ${inv.stock}.`
          )
          .join(' ');
        throw new ErreurTransaction(409, message);
      }

      // 2) Verrou anti-double exécution : false -> true, conditionnel.
      const nbVerrou = await trx(TABLE_SORTIES)
        .where({ document_id: documentId, stock_impacte: false })
        .update({ stock_impacte: true });
      if (!nbVerrou) {
        throw new ErreurTransaction(
          409,
          'Cette sortie a déjà été validée : le stock a déjà été débité une seule fois.'
        );
      }

      // 3) Décrémentations atomiques (ordre stable par fiche matériel pour
      //    limiter les verrous croisés entre sorties concurrentes).
      const lignesTriees = [...lignes].sort((a, b) =>
        a.materiel.documentId < b.materiel.documentId ? -1 : 1
      );
      for (const ligne of lignesTriees) {
        const quantite = Number(ligne.quantite) || 0;
        const nbDecrement = await trx(TABLE_MATERIALS)
          .where({ document_id: ligne.materiel.documentId })
          .where('quantite_stock', '>=', quantite)
          .decrement('quantite_stock', quantite);
        if (!nbDecrement) {
          const courant = await trx(TABLE_MATERIALS)
            .where({ document_id: ligne.materiel.documentId })
            .first('quantite_stock');
          throw new ErreurTransaction(
            409,
            `Stock insuffisant pour « ${
              ligne.materiel.designation || ligne.designation || ligne.materiel.documentId
            } » : quantité demandée ${quantite}, quantité disponible ${
              courant ? Number(courant.quantite_stock) || 0 : 0
            }. Aucune modification enregistrée.`
          );
        }
      }

      // 4) numeros_logistiques (seule écriture demandée au client : un texte,
      //    enregistré tel quel — jamais généré, jamais de format imposé).
      for (const [ligneId, numero] of numerosParLigne) {
        await app.documents(SORTIE_LIGNE_UID).update({
          documentId: ligneId,
          data: { numero_logistique: numero },
        });
      }

      // 5) Signature logistique + validation (date ISO serveur = date de
      //    validation pour le Journal).
      await app.documents(SORTIE_UID).update({
        documentId,
        data: {
          logistique_signed: true,
          signataire_logistique: signataire,
          date_signature_logistique: maintenant,
          stock_impacte: true,
          statut: 'validee',
        },
      });

      // 6) Mouvements, dans la même transaction — UN PAR ligne + signature.
      //    SANS try/catch avalant : un échec de traçage annule toute la
      //    validation (throw = rollback automatique).
      for (const ligne of lignes) {
        await app.documents(MOUVEMENT_UID).create({
          data: {
            reference: sortie.reference,
            type: 'sortie',
            date_mouvement: jour,
            utilisateur: signataire,
            action: 'Sortie validée, stock débité',
            materiel:
              ligne.materiel.designation ||
              ligne.designation ||
              ligne.materiel.documentId,
            quantite: Number(ligne.quantite) || 0,
            statut: 'validee',
            sortie: documentId,
            observations:
              ligne.materiel.documentId === ligne.designation
                ? null
                : `Fiche matériel : ${ligne.materiel.documentId}`,
          },
        });
      }
      await app.documents(MOUVEMENT_UID).create({
        data: {
          reference: sortie.reference,
          type: 'sortie',
          date_mouvement: jour,
          utilisateur: signataire,
          action: 'Signature logistique',
          materiel:
            lignes
              .map((l) => l.materiel.designation || l.designation)
              .filter(Boolean)
              .join(', ') || '—',
          quantite: totalQuantite,
          statut: 'validee',
          sortie: documentId,
          observations:
            `Sortie validée par le chef logistique : stock débité (${lignes.length} ligne(s)).`,
        },
      });

      // --- Création des entrées outbox (dans la même transaction) ----------
      // Les notifications sont persistées atomiquement avec la validation du
      // stock. Leur envoi effectif a lieu après le commit, via le distributeur.
      const directionId = sortie.direction?.documentId;
      const reference = sortie.reference || documentId;
      const dateSortie = sortie.date_sortie
        ? new Date(sortie.date_sortie).toISOString().slice(0, 10)
        : null;

      const payloadDepot = {
        sortieId: documentId,
        reference,
        date_sortie: dateSortie,
        direction: directionId,
        message: `Un ordre de sortie (${reference}) est validé et prêt à être distribué vers votre direction.`,
      };

      const payloadMag = {
        sortieId: documentId,
        reference,
        date_sortie: dateSortie,
        direction: directionId,
        message: `Un ordre de sortie (${reference}) est autorisé : les matériels peuvent être préparés pour l'expédition.`,
      };

      const depositaires = await findUtilisateursParRoleEtDirection(
        app,
        'depositaire',
        directionId
      );
      const magasiniers = await findUtilisateursParRoleEtDirection(
        app,
        'magasinier',
        directionId
      );

      await creerEntrees(app, documentId, depositaires, 'depositaire', payloadDepot);
      await creerEntrees(app, documentId, magasiniers, 'magasinier', payloadMag);
    });
  } catch (e) {
    // La transaction a été annulée par strapi.db.transaction : ni stock, ni
    // signature, ni mouvement ne subsistent.
    if (e instanceof ErreurTransaction) {
      if (e.statusTransaction === 409) return forbid(ctx, e.message, 409);
      return badRequest(ctx, e.message);
    }
    app.log.warn(`[sortie] Validation annulée (tout est annulé) : ${e.message}`);
    return erreurInterne(
      ctx,
      `Validation impossible (tout a été annulé) : ${e.message}`
    );
  }

  // --- Distribution des notifications outbox (après transaction réussie) ---
  // Les entrées ont été créées dans la transaction (atomicité avec le stock).
  // Le distributeur les revendique et les envoie via SSE, avec retry en cas
  // d'échec. Un échec d'envoi n'annule pas la validation déjà commitée.
  try {
    await distribuerNotifications(app);
  } catch (e) {
    app.log.warn(
      `[sortie] Échec de la distribution des notifications outbox : ${e.message}`
    );
  }

  const finale = await loadSortie(app, documentId);
  return {
    data: finale,
    meta: {
      signatures: 3,
      statut: 'validee',
      date_validation: maintenant,
    },
  };
}

module.exports = guardedCoreController(createCoreController, SORTIE_UID, {
  /**
   * GET /api/sorties
   * Le Demandeur ne voit que SES sorties (via SA demande) ; le filtre client
   * ne peut que restreindre le résultat. Les autres rôles lisent tout.
   */
  async find(ctx) {
    const app = strapi;
    if (await isDemandeurSession(app, ctx)) {
      const miens = await documentIdsPossedesPar(app, ctx.state.user);
      const directionSorties = await documentIdsDuDirection(app, ctx.state.user);
      // Le demandeur voit ses propres sorties ET toutes celles de sa direction
      const tousIds = [...new Set([...miens, ...directionSorties])];
      withAppropriationFilter(ctx, tousIds);
      // Apply populate and filter security for demandeur
      const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
      securePopulateAndFilters(ctx);
    }
    return baseHandler(this, 'find', ctx);
  },

  /**
   * GET /api/sorties/distributions
   * Retourne seulement les sorties qui ont eu leur stock diminué
   * (statut validee ou sortie_effectuee), correspondant à la liste de distribution.
   * Accessible aux rôles dépositaire, magasinier, logistique et comptable.
   * Le Demandeur reçoit une erreur 403.
   */
  async findDistributions(ctx) {
    const app = strapi;
    // Le Demandeur n'a pas accès à cette route
    if (await isDemandeurSession(app, ctx)) {
      return forbid(ctx, "Accès refusé : cette route n'est pas accessible aux demandeurs.", 403);
    }

    // Appliquer le filtre appropriation pour les autres rôles (dépositaire, magasinier, logistique, comptable)
    // Note: Le filtre d'appropriation n'est normalement pas nécessaire pour ces rôles car ils voient tout,
    // mais on l'applique par précaution et pour utiliser l'utilitaire du point 1 comme requis.
    const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
    securePopulateAndFilters(ctx);

    // Ajouter le filtre pour ne retourner que les sorties validées ou effectuées
    ctx.query.filters = {
      ...ctx.query.filters,
      statut: {
        '$in': ['validee', 'sortie_effectuee']
      }
    };
    return baseHandler(this, 'find', ctx);
  },

  /**
   * GET /api/sorties/:id
   * Même règle, appliquée à la sortie visée (404, jamais 403).
   */
  async findOne(ctx) {
    const app = strapi;
    if (await isDemandeurSession(app, ctx)) {
      const documentId = ctx.params.id || ctx.params.documentId;
      const miens = await documentIdsPossedesPar(app, ctx.state.user);
      const refus = verifierAccesSortie(ctx, documentId, miens);
      if (refus) return refus;
      // Apply populate and filter security for demandeur
      const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
      securePopulateAndFilters(ctx);
    }
    return baseHandler(this, 'findOne', ctx);
  },

  /**
   * POST /api/sorties/create-complete (étape 2 du circuit)
   * Création complète d'un ordre de sortie : entête + lignes de matériel.
   * Réservé au profil « dépositaire » (contrôlé ICI, la permission ne couvre
   * que l'accès à la route). La sortie démarre TOUJOURS « en_preparation » :
   * impossible de fabriquer une sortie déjà signée ou déjà validée, et le
   * stock n'est PAS touché à la création.
   */
  async createComplete(ctx) {
    const app = strapi;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour créer une sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code !== 'depositaire' && code !== 'admin') {
      return forbid(ctx, "Seul le dépositaire peut créer un ordre de sortie.");
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Contrôles + résolution des lignes (LOGIQUE PARTAGÉE) ---------------
    // Le même code sert la voie « formulaire de distribution » et la voie
    // « depuis une demande approuvée » : un ordre ne peut jamais être
    // fabriqué par un chemin plus permissif que l'autre.
    let prepare;
    try {
      prepare = await preparerSortie(app, body);
    } catch (e) {
      if (e instanceof ErreurCreationSortie) {
        return e.status === 409
          ? forbid(ctx, e.message, 409)
          : badRequest(ctx, e.message);
      }
      throw e;
    }

    // --- Création (transaction unique) --------------------------------------
    const sortie = await creerSortieEtLignes(app, prepare);
    const sortieComplete = await loadSortie(app, sortie.documentId);
    await tracerMouvementSortie(
      app,
      sortieComplete,
      'Sortie créée',
      'en_preparation',
      null,
      nomUtilisateur(user)
    );

    // --- Notification aux magasiniers de la direction (création d'ordre) ---
    // Le dépositaire crée l'ordre → les magasiniers de la même direction sont
    // notifiés immédiatement via outbox + SSE pour qu'ils puissent signer
    // l'étape 1 (préparation). Même pattern que signerLogistique (ÉTAPE 4).
    try {
      const directionId = sortieComplete.direction?.documentId;
      const reference = sortieComplete.reference || sortieComplete.documentId;
      const dateSortie = sortieComplete.date_sortie
        ? new Date(sortieComplete.date_sortie).toISOString().slice(0, 10)
        : null;

      const magasiniers = await findUtilisateursParRoleEtDirection(
        app,
        'magasinier',
        directionId
      );

      if (magasiniers.length > 0) {
        const payloadMag = {
          sortieId: sortieComplete.documentId,
          reference,
          date_sortie: dateSortie,
          direction: directionId,
          message: `Un nouvel ordre de sortie (${reference}) a été créé et attend votre signature de préparation.`,
        };

        await creerEntrees(app, sortieComplete.documentId, magasiniers, 'magasinier', payloadMag);
        await distribuerNotifications(app);
      } else {
        app.log.debug(
          `[sortie] Création ${reference} : aucun magasinier trouvé pour la direction ${directionId}, notification non envoyée.`
        );
      }
    } catch (e) {
      // Ne fait pas échouer la création si la notification ne peut pas être envoyée/persistée.
      app.log.warn(`[sortie] Échec de la notification 'ordre_sortie_autorise' à la création : ${e.message}`);
    }

    ctx.status = 201;
    return { data: sortieComplete };
  },

  /**
   * POST /api/sorties/:documentId/sign (étape 3 du circuit)
   * Corpus : { role: 'magasinier' | 'depositaire' | 'logistique', controles? }
   * - rôle connecté correspondant (contrôle serveur, 403 sinon) ;
   * - statut « en_preparation » obligatoire (400 sinon) ;
   * - ordre strict : 1 (magasinier) puis 2 (dépositaire) — 400 en nommant la
   *   signature manquante, 409 en cas de double signature ;
   * - « logistique » : refusé à l'étape 3 (signature du chef logistique à
   *   l'étape suivante, avec la baisse du stock) ;
   * - signature 1 (magasinier) : `controles` obligatoire — un élément par
   *   ligne { ligne, etat, observations? }, enregistrés DANS LE MÊME appel
   *   que la signature (jamais d'état intermédiaire incohérent) ;
   * - signature 2 (dépositaire) : aucun `controles` ; signe même si une
   *   ligne est defaillant ;
   * - aux deux signatures, chaque quantité doit rester couverte par le stock
   *   actuel du matériel (409, sans rien modifier) ;
   * - le nom du signataire et la date-heure ISO sont posés SEULS par le
   *   serveur, et le statut reste « en_preparation ».
   */
  async sign(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const roleKey = body.role;

    if (!SIGNATURE_ROLES[roleKey]) {
      return badRequest(ctx, "Rôle de signature inconnu (magasinier, depositaire, logistique).");
    }

    // --- Contrôle du rôle connecté ------------------------------------------
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour signer une sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    // Le Demandeur ne signe jamais (garde-fou redondant avec roleGuard.js).
    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas de signer une sortie.");
    }

    const config = SIGNATURE_ROLES[roleKey];
    const estAdmin = code === 'admin';
    if (!estAdmin && !config.roles.includes(code)) {
      return forbid(
        ctx,
        `Votre rôle ne permet pas d'apposer la signature « ${roleKey.replace(/_/g, ' ')} ».`
      );
    }

    const sortie = await loadSortie(app, documentId);
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // --- Statut obligatoire : en_preparation ---------------------------------
    if (sortie.statut !== 'en_preparation') {
      return badRequest(
        ctx,
        `La signature n'est possible que pour une sortie « en_preparation » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    // --- Double signature interdite -------------------------------------------
    if (sortie[config.flag] === true) {
      return forbid(ctx, 'Cette signature a déjà été enregistrée et ne peut pas être modifiée.', 409);
    }

    // --- Ordre strict du workflow (TOUTES les signatures précédentes) --------
    // Pour la 3ᵉ signature, magasinier (1) ET dépositaire (2) doivent avoir
    // signé : le message nomme la première signature manquante.
    const precedents = Object.values(SIGNATURE_ROLES)
      .filter((c) => c.order < config.order)
      .sort((a, b) => a.order - b.order);
    for (const precedent of precedents) {
      if (sortie[precedent.flag] !== true) {
        return badRequest(
          ctx,
          `Signature manquante : la signature « ${precedent.signerField.replace('signataire_', '')} » doit être apposée avant celle-ci.`
        );
      }
    }

    // --- Étape 4 : la signature du chef logistique valide et débite le stock ----
    if (roleKey === 'logistique') {
      return await signerLogistique(app, ctx, sortie, documentId, user, body);
    }

    // --- Signature 1 (magasinier) : contrôle par ligne, OBLIGATOIRE -----------
    //Les lignes sont mises à jour AVANT de poser la signature (tout ou rien —
    // jamais un état intermédiaire incohérent).
    if (roleKey === 'magasinier') {
      const controles = body.controles;
      if (!Array.isArray(controles) || controles.length === 0) {
        return badRequest(
          ctx,
          'Contrôles obligatoires : un élément { ligne, etat, observations? } par ligne de la sortie.'
        );
      }
      const lignes = sortie.lignes || [];
      const parLigne = new Map();
      for (const c of controles) {
        if (c && c.ligne) parLigne.set(c.ligne, c);
      }

      // a) Chaque ligne de la sortie doit être contrôlée.
      const manquants = [];
      const misesAJour = [];
      for (const ligne of lignes) {
        const controle = parLigne.get(ligne.documentId);
        const etatValide =
          controle && controle.etat && ETATS_VALIDES.includes(controle.etat);
        if (!controle || !etatValide) {
          manquants.push(ligne.designation || `Ligne ${ligne.id || ligne.documentId}`);
          continue;
        }
        misesAJour.push({
          documentId: ligne.documentId,
          etat: controle.etat,
          observations:
            typeof controle.observations === 'string' && controle.observations.trim()
              ? controle.observations.trim()
              : null,
        });
      }
      if (manquants.length > 0) {
        return badRequest(
          ctx,
          `Contrôle incomplet : état invalide (neuf, bon, moyen ou defaillant) ou ligne manquante pour ${manquants.length} article(s) — ${manquants.join(', ')}.`
        );
      }

      // b) Un contrôle doit référencer une ligne DE CETTE sortie (jamais
      //    celle d'une autre) : sans ce garde-fou, journaliola validée depuis
      //    un autre circuit.
      for (const [ligneId] of parLigne) {
        if (!lignes.some((l) => l.documentId === ligneId)) {
          return badRequest(
            ctx,
            `La ligne ${ligneId} ne fait pas partie de cette sortie.`
          );
        }
      }

      // --- Stock actuel : chaque quantité doit rester couverte ----------------
      const insuffisant = await verifierStockDisponible(app, sortie);
      if (insuffisant) {
        // 409 AVANT toute écriture : rien n'est modifié.
        return forbid(ctx, insuffisant, 409);
      }

      // --- Enregistrement du contrôle dans le MÊME appel que la signature ----
      try {
        for (const maj of misesAJour) {
          const data = { etat: maj.etat };
          if (maj.observations) data.observations = maj.observations;
          await app.documents(SORTIE_LIGNE_UID).update({ documentId: maj.documentId, data });
        }
      } catch (e) {
        return badRequest(
          ctx,
          `Mise à jour du contrôle impossible : ${e.message}. Signature non posée.`
        );
      }
    } else {
      // --- Signature 2 (dépositaire) : aucun controles demandé, mais la
      // vérification du stock actuel reste valable (409 sans rien modifier).
      const insuffisant = await verifierStockDisponible(app, sortie);
      if (insuffisant) {
        return forbid(ctx, insuffisant, 409);
      }
    }

    // --- Pose de la signature (nom + date posés SEULS par le serveur) -------
    const signataire = nomUtilisateur(user);
    await app.documents(SORTIE_UID).update({
      documentId,
      data: {
        [config.flag]: true,
        [config.signerField]: signataire,
        [config.dateField]: new Date().toISOString(),
        // La sortie peut être signée même si une ligne est defaillant.
      },
    });

    const apres = await loadSortie(app, documentId);
    const nbSignatures = Object.values(SIGNATURE_ROLES).filter(
      (c) => apres[c.flag] === true
    ).length;

    // --- Notification au dépositaire quand le magasinier termine la préparation (signature 1) ---
    if (roleKey === 'magasinier') {
      try {
        const directionId = apres.direction?.documentId;
        const reference = apres.reference || documentId;
        const maintenant = new Date();
        const dateHeure = maintenant.toISOString(); // Format ISO complet avec date ET heure

        const depositaires = await findUtilisateursParRoleEtDirection(
          app,
          'depositaire',
          directionId
        );

        if (depositaires.length > 0) {
          const payloadPrepTerminee = {
            sortieId: documentId,
            reference,
            date_heure: dateHeure, // ISO complet : "2026-10-27T14:30:45.123Z"
            direction: directionId,
            message: `La préparation de l'ordre de sortie (${reference}) est terminée et prête pour la signature du dépositaire.`,
            signataire_magasinier: signataire,
          };

          await app.db.transaction(async () => {
            await creerEntrees(
              app,
              documentId,
              depositaires,
              'depositaire_preparation_terminee',
              payloadPrepTerminee
            );
          });
          await distribuerNotifications(app);
          app.log.info(
            `[sortie] Notification 'preparation_terminee' créée et distribuée pour la sortie ${reference} (direction=${directionId}, ${depositaires.length} dépositaire(s)).`
          );
        } else if (!directionId) {
          app.log.warn(
            `[sortie] Préparation terminée ${reference} : aucune direction sur la sortie, notification 'preparation_terminee' non envoyée.`
          );
        } else {
          app.log.warn(
            `[sortie] Préparation terminée ${reference} : aucun dépositaire trouvé pour la direction ${directionId}, notification non envoyée.`
          );
        }
      } catch (e) {
        app.log.warn(`[sortie] Échec de la notification 'preparation_terminee' : ${e.message}`);
      }
    }

    await tracerMouvementSortie(
      app,
      apres,
      `Signature ${roleKey === 'magasinier' ? 'magasinier' : 'dépositaire'}`,
      'en_preparation',
      null,
      signataire
    );

    return {
      data: apres,
      meta: {
        signatures: nbSignatures,
        statut: 'en_preparation',
      },
    };
  },

  /**
   * POST /api/sorties/:documentId/reject (étape 3 du circuit)
   * Corpus : { motif }
   * - motif obligatoire (non vide) ;
   * - autorisé aux magasinier / dépositaire / logistique uniquement (le
   *   Demandeur ne peut jamais rejeter), sur une sortie « en_preparation »
   *   SEULEMENT : statut -> « annulee », motif_rejet enregistré, aucun effet
   *   sur le stock ;
   * - refuse toute sortie déjà annulée / validée / sortie_effectuee (400).
   */
  async reject(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;

    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour rejeter une sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas de rejeter une sortie.");
    }
    const rolesAutorises = ['magasinier', 'depositaire', 'logistique'];
    if (code !== 'admin' && !rolesAutorises.includes(code)) {
      return forbid(ctx, "Votre rôle ne permet pas de rejeter une sortie.");
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const motif = typeof body.motif === 'string' ? body.motif.trim() : '';
    if (!motif) {
      return badRequest(ctx, 'Motif de rejet obligatoire (texte non vide).');
    }

    const sortie = await loadSortie(app, documentId);
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // Déjà rejetée : erreur explicite plutôt qu'un succès silencieux (le
    // mouvement et l'horodatage ne doivent pas être réécrits).
    if (sortie.statut === 'annulee') {
      return badRequest(ctx, 'Cette sortie a déjà été rejetée.');
    }
    if (sortie.statut === 'validee') {
      return badRequest(ctx, 'Une sortie validée ne peut plus être rejetée.');
    }
    if (sortie.statut === 'sortie_effectuee') {
      return badRequest(ctx, 'Une sortie déjà effectuée ne peut pas être rejetée.');
    }
    if (sortie.statut !== 'en_preparation') {
      return badRequest(
        ctx,
        `Le rejet n'est possible que pour une sortie « en_preparation » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    await app.documents(SORTIE_UID).update({
      documentId,
      data: { statut: 'annulee', motif_rejet: motif },
    });

    // --- Notification au dépositaire pour le rejet de la préparation ---
    // On notifie le dépositaire concerné (celui de la direction de la sortie)
    // avec le motif fourni par le magasinier.
    try {
      const finale = await loadSortie(app, documentId);
      const directionId = finale.direction?.documentId;
      const reference = finale.reference || documentId;
      const maintenant = new Date();
      const dateHeure = maintenant.toISOString(); // Format ISO complet avec date ET heure
      const signataire = nomUtilisateur(user);

      const depositaires = await findUtilisateursParRoleEtDirection(
        app,
        'depositaire',
        directionId
      );

      if (depositaires.length > 0) {
        const payloadPrepRejetee = {
          sortieId: documentId,
          reference,
          date_heure: dateHeure, // ISO complet : "2026-10-27T14:30:45.123Z"
          direction: directionId,
          message: `La préparation de l'ordre de sortie (${reference}) a été rejetée par le magasinier.`,
          motif_rejet: motif,
          signataire_rejet: signataire,
        };

        await app.db.transaction(async () => {
          await creerEntrees(
            app,
            documentId,
            depositaires,
            'depositaire_preparation_rejetee',
            payloadPrepRejetee
          );
        });
        await distribuerNotifications(app);
      } else if (!directionId) {
        app.log.warn(
          `[sortie] Préparation rejetée ${reference} : aucune direction sur la sortie, notification 'preparation_rejetee' non envoyée.`
        );
      } else {
        app.log.warn(
          `[sortie] Préparation rejetée ${reference} : aucun dépositaire trouvé pour la direction ${directionId}, notification non envoyée.`
        );
      }
    } catch (e) {
      app.log.warn(`[sortie] Échec de la notification 'preparation_rejetee' : ${e.message}`);
    }

    const finale = await loadSortie(app, documentId);
    await tracerMouvementSortie(
      app,
      finale,
      'Sortie rejetée',
      'annulee',
      motif,
      nomUtilisateur(user)
    );

    return { data: finale };
  },

  /**
   * ÉTAPE 5 — remise du matériel au détenteur : statut final sortie_effectuee,
   * mise à jour de la demande liée, traçage.
   *
   * Tout se déroule dans UNE transaction (strapi.db.transaction) :
   *   1. vérifications préalables (statut validee, rôles autorisés, etc.) ;
   *   2. enregistrement du détenteur et date de remise ;
   *   3. mise à jour éventuelle de la demande liée (si statut approuvee ou preparation) ;
   *   4. création du mouvement de traçage « Remise au détenteur » ;
   *   5. passage du statut à sortie_effectuee.
   * Un échec à l'étape 3 ou 4 annule toute la remise (le statut reste validee).
   * Aucune modification du stock n'est effectuée.
   */
  async remise(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // Authentification requise
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour effectuer une remise.', 401);
    }

    // Le Demandeur ne peut jamais effectuer de remise : message dédié, testé
    // AVANT la règle générale de rôles (sinon le message Demandeur était
    // inatteignable — le contrôle général renvoyait 403 en premier).
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas d'effectuer une remise.", 403);
    }

    // Vérification du rôle : seulement magasinier et depositaire autorisés
    const rolesAutorises = ['magasinier', 'depositaire'];
    if (code !== 'admin' && !rolesAutorises.includes(code)) {
      return forbid(ctx, "Votre rôle ne permet pas d'effectuer une remise.", 403);
    }

    // Chargement de la sortie
    const sortie = await loadSortie(app, documentId);
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // Vérification : pas déjà effectuée — testée AVANT le contrôle de statut
    // général (une sortie « sortie_effectuee » entrait sinon dans le 400
    // « n'est possible que pour une sortie validee » et le 409 était
    // inatteignable).
    if (sortie.statut === 'sortie_effectuee') {
      return forbid(ctx, 'Remise déjà enregistrée', 409);
    }

    // Vérification du statut : doit être validee
    if (sortie.statut !== 'validee') {
      return badRequest(
        ctx,
        `La remise n'est possible que pour une sortie « validee » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    // Validation des champs de remise. Le détenteur (nom/fonction) est
    // OPTIONNEL : il s'identifie lors de l'affectation, après la réception
    // physique, pas à la remise du magasinier.
    const { detenteur_nom, detenteur_fonction, date_remise, mandataire_nom } = body.data || body;

    let detenteurNomFinal = null;
    if (detenteur_nom !== undefined && detenteur_nom !== null && detenteur_nom !== '') {
      if (typeof detenteur_nom !== 'string') {
        return badRequest(ctx, 'detenteur_nom doit être un texte.');
      }
      detenteurNomFinal = detenteur_nom.trim();
      if (detenteurNomFinal.length > 150) {
        return badRequest(ctx, 'detenteur_nom limité à 150 caractères maximum.');
      }
    }

    let detenteurFonctionFinal = null;
    if (detenteur_fonction !== undefined && detenteur_fonction !== null && detenteur_fonction !== '') {
      if (typeof detenteur_fonction !== 'string') {
        return badRequest(ctx, 'detenteur_fonction doit être un texte.');
      }
      detenteurFonctionFinal = detenteur_fonction.trim();
      if (detenteurFonctionFinal.length > 150) {
        return badRequest(ctx, 'detenteur_fonction limité à 150 caractères maximum.');
      }
    }

    // Mandataire (OPTIONNEL) : la personne que le détenteur a mandatée pour
    // retirer le matériel à sa place. Le détenteur reste responsable. Un
    // mandataire vide n'écrit RIEN (le champ reste non renseigné).
    let mandataireFinal = null;
    if (mandataire_nom !== undefined && mandataire_nom !== null) {
      if (typeof mandataire_nom !== 'string') {
        return badRequest(ctx, 'mandataire_nom doit être un texte.');
      }
      const mandataireTaille = mandataire_nom.trim();
      if (mandataireTaille.length > 150) {
        return badRequest(ctx, 'mandataire_nom limité à 150 caractères maximum.');
      }
      if (mandataireTaille !== '') {
        mandataireFinal = mandataireTaille;
      }
    }

    // Validation de la date_remise (optionnelle)
    //
    // Le contrôle porte sur des DATES (AAAA-MM-JJ), jamais sur des instants :
    // « aujourd'hui » est le jour de l'application (Indian/Antananarivo),
    // pas celui du serveur. Deux chaînes AAAA-MM-JJ se comparent
    // lexicographiquement, ce qui est l'ordre chronologique.
    let dateRemiseFinal = null;
    if (date_remise !== undefined && date_remise !== null && date_remise !== '') {
      if (typeof date_remise !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date_remise)) {
        return badRequest(ctx, 'date_remise doit être au format YYYY-MM-DD.');
      }
      const jourAujourdhui = dateDuJour(new Date());
      if (jourAujourdhui && date_remise > jourAujourdhui) {
        return badRequest(ctx, 'date_remise ne peut pas être postérieure à aujourd\'hui.');
      }

      // Vérification : date_remise ne peut pas être antérieure à la date de
      // validation logistique (signature 3), exprimée dans le MÊME fuseau.
      // Une date de signature illisible ne produit aucune borne.
      if (sortie.date_signature_logistique) {
        const jourValidation = dateDuJour(sortie.date_signature_logistique);
        if (jourValidation && date_remise < jourValidation) {
          return badRequest(ctx, 'date_remise ne peut pas être antérieure à la date de validation logistique.');
        }
      }
      dateRemiseFinal = date_remise;
    } else {
      // Par défaut : aujourd'hui, dans le fuseau de l'application.
      dateRemiseFinal = dateDuJour(new Date());
    }

    // Transaction pour l'atomicité de la remise
    let demandeMiseAJour = false;
    try {
      await app.db.transaction(async ({ trx }) => {
        // 1. Enregistrement de la date de remise (et, le cas échéant, du
        // détenteur — désormais optionnel, saisi à l'affectation pas ici).
        const donneesRemise = {
          date_remise: dateRemiseFinal,
        };
        if (detenteurNomFinal) {
          donneesRemise.detenteur_nom = detenteurNomFinal;
        }
        if (detenteurFonctionFinal) {
          donneesRemise.detenteur_fonction = detenteurFonctionFinal;
        }
        // Un mandataire vide n'écrit RIEN : le champ n'est pas touché.
        if (mandataireFinal) {
          donneesRemise.mandataire_nom = mandataireFinal;
        }
        await app.documents(SORTIE_UID).update({
          documentId,
          data: donneesRemise,
        });

        // 2. Mise à jour éventuelle de la demande liée
        if (sortie.demande) {
          const demande = await app.documents('api::demande.demande').findOne({
            documentId: sortie.demande.documentId,
          });

          if (demande && ['approuvee', 'preparation'].includes(demande.statut)) {
            await app.documents('api::demande.demande').update({
              documentId: sortie.demande.documentId,
              data: { statut: 'sortie_effectuee' },
            });
            demandeMiseAJour = true;
          }
          // Si la demande est dans un autre statut, on ne la modifie pas
          // et demandeMiseAJour reste à false
        }

        // 3. Création du mouvement de traçage « Remise au détenteur »
        const signataire = nomUtilisateur(user);
        await app.documents(MOUVEMENT_UID).create({
          data: {
            reference: sortie.reference,
            type: 'sortie',
            date_mouvement: dateRemiseFinal,
            utilisateur: signataire,
            action: 'Remise au détenteur',
            materiel: (sortie.lignes || [])
              .map((l) => l.designation)
              .filter(Boolean)
              .join(', ') || '—',
            quantite: (sortie.lignes || []).reduce((sum, l) => sum + (Number(l.quantite) || 0), 0),
            statut: 'sortie_effectuee',
            sortie: documentId,
            observations: detenteurNomFinal
              ? `Matériel remis à ${detenteurNomFinal} (${detenteurFonctionFinal || '—'})`
              : 'Matériel remis au détenteur.',
          },
        });

        // 4. Passage du statut à sortie_effectuee
        await app.documents(SORTIE_UID).update({
          documentId,
          data: { statut: 'sortie_effectuee' },
        });
      });

      // Après la transaction réussie, on charge la sortie finale
      const sortieFinale = await loadSortie(app, documentId);

      // Notification « demande aboutie » au demandeur : persistance en outbox +
      // livraison SSE avec reprise (même pattern que signerLogistique, ÉTAPE 4).
      // Le demandeur connecté reçoit l'événement immédiatement via le
      // distributeur ; le demandeur déconnecté le retrouve à sa prochaine
      // connexion grâce à la réconciliation sur GET /api/notification-outbox/notifications.
      if (sortieFinale?.demande) {
        try {
          const demande = await app.documents('api::demande.demande').findOne({
            documentId: sortieFinale.demande.documentId,
            populate: ['demandeur'],
          });
          if (demande?.demandeur?.id) {
            const payloadDemandeAboutie = {
              demandeId: demande.documentId,
              demandeReference: demande.reference,
              sortieReference: sortieFinale.reference,
              message: `Votre demande ${demande.reference} est maintenant aboutie (sortie effectuée).`,
              date: new Date().toISOString(),
            };
            // 1. Persiste la notification en outbox (statut 'pending').
            await creerEntrees(
              app,
              documentId,
              [
                {
                  id: demande.demandeur.id,
                  email: demande.demandeur.email ?? '',
                  username: demande.demandeur.username ?? '',
                },
              ],
              'demandeur',
              payloadDemandeAboutie
            );
            // 2. Livraison SSE immédiate + reprise des entrées en échec.
            await distribuerNotifications(app);
          } else {
            app.log.warn(
              `[sortie] Remise ${sortieFinale.reference} : demande liée sans demandeur, notification 'demande_aboutie' ignorée.`
            );
          }
        } catch (e) {
          // Ne fait pas échouer la remise si la notification ne peut pas être envoyée/persistée.
          app.log.warn(`[sortie] Échec de la notification 'demande_aboutie' : ${e.message}`);
        }
      } else {
        app.log.warn(
          `[sortie] Remise ${sortieFinale?.reference || documentId} : sortie sans demande liée, notification 'demande_aboutie' ignorée.`
        );
      }

      return {
        data: sortieFinale,
        meta: {
          demande_mise_a_jour: demandeMiseAJour || false,
        },
      };
    } catch (e) {
      // En cas d'échec de la transaction, tout est annulé
      // Le statut reste validee (pas de remise enregistrée)
      app.log.warn(`[sortie] Remise annulée (tout est annulé) : ${e.message}`);
      return erreurInterne(
        ctx,
        `Remise impossible (tout a été annulé) : ${e.message}`
      );
    }
  },

  /**
   * GET /api/sorties/:documentId/mouvements
   * Piste d'audit : liste tous les mouvements de traçage d'une sortie,
   * ordonnés par date_mouvement croissante.
   * Accessible aux rôles qui lisent les sorties ; le Demandeur ne voit que
   * les mouvements de SES propres sorties.
   */
  async findMouvements(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;

    // Vérifier que la sortie existe
    const sortie = await app.documents(SORTIE_UID).findOne({ documentId });
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFoundError', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // Le Demandeur ne voit que les mouvements de SES sorties (via SA demande)
    if (await isDemandeurSession(app, ctx)) {
      const miens = await documentIdsPossedesPar(app, ctx.state.user);
      if (!miens.includes(documentId)) {
        return forbid(
          ctx,
          "Accès refusé : vous ne pouvez consulter les mouvements que de vos propres sorties.",
          403
        );
      }
    }

    const mouvements = await app.documents(MOUVEMENT_UID).findMany({
      filters: { sortie: documentId },
      sort: { date_mouvement: 'asc' },
    });

    return { data: mouvements };
  },
});
