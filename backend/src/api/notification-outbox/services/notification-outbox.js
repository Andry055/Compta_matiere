'use strict';

/**
 * Service distributeur de notifications outbox.
 *
 * Responsabilités :
 *   - Revendiquer atomiquement les entrées en attente (status 'pending' → 'processing')
 *     pour qu'aucun worker concurrent ne traite deux fois la même entrée.
 *   - Envoyer chaque entrée via SSE au destinataire visé.
 *   - Marquer 'sent' en cas de succès, 'failed' après le nombre maximal de tentatives,
 *     ou repousser en 'pending' pour un retry ultérieur avec backoff.
 *
 * Ce service est appelé :
 *   1. Immédiatement après validation d'une sortie (depuis signerLogistique) pour
 *      traiter les entrées fraîchement créées.
 *   2. Périodiquement (cron / setInterval) pour reprendre les entrées en échec.
 */

const { sseBroadcastToUser } = require('../../../lib/notifications');

const TABLE_OUTBOX = 'notification_outboxes';

const MAX_TENTATIVES = 5;

const EVENT_TYPE_PAR_ROLE = {
  depositaire: 'ordre_pret_distribution',
  magasinier: 'ordre_sortie_autorise',
  demandeur: 'demande_aboutie',
};

const OUTBOX_UID = 'api::notification-outbox.notification-outbox';

/**
 * Crée les entrées outbox pour une liste de destinataires.
 * Doit être appelée à l'intérieur d'un rappel `app.db.transaction(...)` pour
 * que les insertions rejoignent automatiquement la transaction en cours.
 *
 * @param {object} app - instance Strapi
 * @param {string} sortieDocumentId - documentId de la sortie
 * @param {Array<{id, email, username}>} destinataires - liste des utilisateurs cibles
 * @param {string} role - rôle métier des destinataires ('depositaire' | 'magasinier')
 * @param {object} payload - données de l'événement SSE
 * @returns {Promise<void>}
 */
async function creerEntrees(app, sortieDocumentId, destinataires, role, payload) {
  const eventType = EVENT_TYPE_PAR_ROLE[role];
  if (!eventType) {
    throw new Error(`Rôle de destinataire inconnu pour l'outbox : ${role}`);
  }

  const maintenant = new Date();

  for (const destinataire of destinataires || []) {
    await app.documents(OUTBOX_UID).create({
      data: {
        sortie: sortieDocumentId,
        eventType,
        recipientId: destinataire.id,
        recipientRole: role,
        payload,
        status: 'pending',
        attempts: 0,
      },
    });
  }
}

/**
 * Type d'événement de la notification « nouvelle demande ».
 */
const EVENT_TYPE_NOUVELLE_DEMANDE = 'nouvelle_demande';

/**
 * Clé d'idempotence d'un événement `nouvelle_demande`.
 *
 * Elle est UNIQUE en base (attribut `cleUnicite`) : une même demande ne peut
 * produire qu'une seule notification pour un même destinataire. Elle est
 * aussi reprise dans le payload (`notifId`) afin que le frontend utilise le
 * MÊME identifiant pour l'événement SSE et pour la réconciliation au
 * rechargement : c'est ce qui empêche le doublon d'affichage.
 *
 * @param {string} demandeDocumentId - documentId de la demande
 * @param {number|string} recipientId - identifiant numérique du destinataire
 * @returns {string}
 */
function cleUniciteNouvelleDemande(demandeDocumentId, recipientId) {
  return `${EVENT_TYPE_NOUVELLE_DEMANDE}:${demandeDocumentId}:${recipientId}`;
}

/**
 * Vrai si une entrée outbox portant cette clé d'idempotence existe déjà.
 *
 * @param {object} app - instance Strapi
 * @param {string} cleUnicite - clé d'idempotence
 * @returns {Promise<boolean>}
 */
async function entreeDejaNotifiee(app, cleUnicite) {
  try {
    const existante = await app.db.query(OUTBOX_UID).findOne({
      where: { cleUnicite },
    });
    return Boolean(existante);
  } catch (e) {
    // Lecture impossible : on ne peut rien affirmer, on laisse l'insertion
    // décider (et éventualiser l'annulation de la transaction).
    return false;
  }
}

/**
 * Crée l'entrée outbox de l'événement `nouvelle_demande` (demande créée par
 * un demandeur → notification adressée au seul dépositaire général).
 *
 * L'événement est lié à la DEMANDE (et non à une sortie) : la relation
 * `sortie` reste vide.
 *
 * IDEMPOTENCE : la clé `cleUnicite` est UNIQUE en base. Une notification déjà
 * présente pour cette demande n'est pas recréée — l'opération est donc sans
 * effet de bord sur la demande, qui reste enregistrée.
 *
 * NOTE — la détection du doublon ne se fie PAS au message de l'erreur : le
 * dialecte SQLite de Strapi transforme TOUTE violation de contrainte (errno
 * 19 : UNIQUE, NOT NULL, CHECK…) en `NotNullError`, ce qui perd la nature
 * exacte de l'erreur. On vérifie donc l'EXISTENCE de la ligne après l'échec :
 * si elle est là, c'est bien un doublon, sinon l'erreur est réelle et doit
 * être propagée (la transaction est alors annulée).
 *
 * Doit être appelée à l'intérieur d'un rappel `app.db.transaction(...)` :
 * en Strapi 5 le service de documents rejoint la transaction ambiante, la
 * demande et sa notification sont donc écrites ensemble (ou pas du tout).
 *
 * @param {object} app - instance Strapi
 * @param {string} demandeDocumentId - documentId de la demande
 * @param {{id: number, email?: string, username?: string}} destinataire - destinataire résolu
 * @param {object} payload - données de l'événement SSE
 * @returns {Promise<boolean>} true si l'entrée a été créée, false si elle existait déjà
 */
async function creerEntreeNouvelleDemande(app, demandeDocumentId, destinataire, payload) {
  const cleUnicite = cleUniciteNouvelleDemande(demandeDocumentId, destinataire.id);

  if (await entreeDejaNotifiee(app, cleUnicite)) {
    app.log.warn(
      `[notification-outbox] Une notification « ${EVENT_TYPE_NOUVELLE_DEMANDE} » existe déjà pour la demande ${demandeDocumentId} : elle n'est pas recréée.`
    );
    return false;
  }

  try {
    await app.documents(OUTBOX_UID).create({
      data: {
        demande: demandeDocumentId,
        eventType: EVENT_TYPE_NOUVELLE_DEMANDE,
        recipientId: destinataire.id,
        recipientRole: 'depositaire',
        cleUnicite,
        payload: { ...(payload || {}), notifId: cleUnicite },
        status: 'pending',
        attempts: 0,
      },
    });
    return true;
  } catch (e) {
    // La notification existe-t-elle DÉJÀ (doublon concurrent) ? Si oui, la
    // demande n'a rien perdu : on n'annule pas sa création. Sinon, l'erreur
    // est technique et doit remonter pour annuler la transaction.
    if (await entreeDejaNotifiee(app, cleUnicite)) {
      app.log.warn(
        `[notification-outbox] Une notification « ${EVENT_TYPE_NOUVELLE_DEMANDE} » existe déjà pour la demande ${demandeDocumentId} : elle n'est pas recréée.`
      );
      return false;
    }
    throw e;
  }
}

/**
 * Revendique atomiquement toutes les entrées en attente et les passe en
 * 'processing'. Retourne les entrées revendiquées pour traitement.
 *
 * L'unicité est garantie par le WHERE status = 'pending' : deux appels
 * concurrents ne revendiqueront jamais la même entrée.
 *
 * ATTENTION — cette requête est du SQL BRUT : les noms de colonnes sont
 * ceux de la TABLE (snake_case), pas ceux des attributs Strapi (camelCase).
 * `last_attempt_at` / `updated_at` / `last_error` sont donc les noms
 * corrects ; les former camelCase ('lastAttemptAt', 'updatedAt',
 * 'lastError') fait échouer l'UPDATE avec « no such column » et bloque
 * TOUTE distribution.
 *
 * @param {object} trx - transaction Knex active
 * @returns {Promise<Array<object>>} entrées revendiquées (status 'processing')
 */
async function reclamerEntrees(trx) {
  const maintenant = new Date();

  const revendiquees = await trx(TABLE_OUTBOX)
    .where({ status: 'pending' })
    .update({
      status: 'processing',
      attempts: trx.raw('attempts + 1'),
      last_attempt_at: maintenant,
      updated_at: maintenant,
    })
    .returning('*');

  return revendiquees || [];
}

/**
 * Envoie une entrée outbox via SSE à son destinataire.
 *
 * @param {object} app - instance Strapi
 * @param {object} entree - entrée outbox revendiquée
 * @returns {Promise<number>} nombre de flux SSE sur lesquels l'événement a été écrit
 */
async function envoyerEntree(app, entree) {
  const userId = Number(entree.recipientId);
  if (!Number.isInteger(userId) || userId <= 0) {
    // Destinataire absent ou invalide : la notification ne peut pas être
    // adressée. On échoue explicitement plutôt que de diffuser à un
    // identifiant fantôme (qui renverrait 0 flux et ferait boucler les
    // tentatives sans jamais être délivrée).
    throw new Error(
      `Destinataire invalide pour l'entrée #${entree.id} : ${entree.recipientId}`
    );
  }
  return sseBroadcastToUser(userId, entree.eventType, entree.payload || {});
}

/**
 * Marque une entrée comme envoyée avec succès.
 *
 * @param {object} trx - transaction Knex active
 * @param {object} entree - entrée outbox
 * @returns {Promise<void>}
 */
async function marquerEnvoyee(trx, entree) {
  const maintenant = new Date();
  await trx(TABLE_OUTBOX)
    .where({ id: entree.id })
    .update({ status: 'sent', updated_at: maintenant });
}

/**
 * Marque une entrée en échec.
 *
 * Si le nombre maximal de tentatives est atteint, passe en 'failed'.
 * Sinon, repasse en 'pending' pour un retry ultérieur (backoff fourni par
 * le délai entre deux cycles du distributeur).
 *
 * @param {object} trx - transaction Knex active
 * @param {object} entree - entrée outbox (attents déjà incrémenté)
 * @param {string} erreur - message d'erreur
 * @returns {Promise<void>}
 */
async function marquerEchec(trx, entree, erreur) {
  const maintenant = new Date();
  const donnees = {
    last_error: erreur || '',
    updated_at: maintenant,
  };

  if (entree.attempts >= MAX_TENTATIVES) {
    donnees.status = 'failed';
  } else {
    donnees.status = 'pending';
  }

  await trx(TABLE_OUTBOX).where({ id: entree.id }).update(donnees);
}

/**
 * Traite une entrée outbox revendiquée : envoi SSE puis mise à jour du statut.
 * Retourne `true` si l'entrée a été envoyée avec succès, `false` sinon.
 *
 * @param {object} app - instance Strapi
 * @param {object} trx - transaction Knex active
 * @param {object} entree - entrée outbox
 * @returns {Promise<boolean>} true si envoyée, false sinon
 */
async function traiterEntree(app, trx, entree) {
  try {
    const nbEnvoyes = await envoyerEntree(app, entree);
    if (nbEnvoyes === 0) {
      // Aucun flux SSE ouvert pour le destinataire : la notification
      // n'a pas été délivrée. On laisse l'entrée en 'pending' pour
      // qu'elle soit reprise par un prochain passage du distributeur
      // (cron périodique) ou par la réconciliation frontend.
      throw new Error(
        `Aucun flux SSE ouvert pour l'utilisateur #${entree.recipientId}`
      );
    }
    await marquerEnvoyee(trx, entree);
    app.log.debug(
      `[notification-outbox] Entrée #${entree.id} envoyée (${entree.eventType} → utilisateur #${entree.recipientId}).`
    );
    return true;
  } catch (e) {
    app.log.warn(
      `[notification-outbox] Échec de l'envoi de l'entrée #${entree.id} (tentative ${entree.attempts}/${MAX_TENTATIVES}) : ${e.message}`
    );
    await marquerEchec(trx, entree, e.message);
    return false;
  }
}

/**
 * Distribue toutes les notifications en attente : revendication atomique,
 * envoi SSE par entrée, marquage sent/failed/pending.
 *
 * Cette fonction est idempotente : elle peut être appelée plusieurs fois sans
 * risque de doublon, grâce à la revendication atomique (status 'pending' →
 * 'processing') et à la contrainte unique en base sur (sortie, eventType, recipientId).
 *
 * @param {object} app - instance Strapi
 * @returns {Promise<{traitees: number, envoyees: number, echecs: number}>}
 */
async function distribuerNotifications(app) {
  let traitees = 0;
  let envoyees = 0;
  let echecs = 0;

  await app.db.transaction(async ({ trx }) => {
    const revendiquees = await reclamerEntrees(trx);
    traitees = revendiquees.length;

    for (const entree of revendiquees) {
      const envoyee = await traiterEntree(app, trx, entree);
      if (envoyee) {
        envoyees++;
      } else {
        echecs++;
      }
    }
  });

  return { traitees, envoyees, echecs };
}

module.exports = {
  TABLE_OUTBOX,
  MAX_TENTATIVES,
  EVENT_TYPE_PAR_ROLE,
  EVENT_TYPE_NOUVELLE_DEMANDE,
  OUTBOX_UID,
  creerEntrees,
  creerEntreeNouvelleDemande,
  reclamerEntrees,
  envoyerEntree,
  marquerEnvoyee,
  marquerEchec,
  traiterEntree,
  distribuerNotifications,
};
