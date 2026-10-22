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
 *
 * EVENT_TYPE de réception physique (ajoutés pour la réception / anomalies) :
 *   - 'reception_partielle'  → rôle 'depositaire'
 *   - 'reception_complete'   → rôle 'depositaire'
 *   - 'anomalie_ouverte'     → rôle 'depositaire'
 *   - 'anomalie_resolue'     → rôle 'depositaire'
 */

const { sseBroadcastToUser } = require('../../../lib/notifications');

const TABLE_OUTBOX = 'notification_outboxes';

const MAX_TENTATIVES = 5;

const EVENT_TYPE_PAR_ROLE = {
  depositaire: 'ordre_pret_distribution',
  magasinier: 'ordre_sortie_autorise',
  demandeur: 'demande_aboutie',
};

/**
 * EVENT_TYPE spécifiques à la réception physique et aux anomalies,
 * associés au rôle 'depositaire' (destinataire de ces notifications).
 */
const EVENT_TYPE_RECEPTION = {
  reception_partielle: 'depositaire',
  reception_complete: 'depositaire',
  anomalie_ouverte: 'depositaire',
  anomalie_resolue: 'depositaire',
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
 * @param {string} role - rôle métier ou EVENT_TYPE de réception ('depositaire' | 'magasinier' | 'reception_partielle' | ...)
 * @param {object} payload - données de l'événement SSE
 * @returns {Promise<void>}
 */
async function creerEntrees(app, sortieDocumentId, destinataires, role, payload) {
  let eventType = EVENT_TYPE_PAR_ROLE[role];
  if (!eventType && EVENT_TYPE_RECEPTION[role]) {
    // Le paramètre role est en fait un EVENT_TYPE de réception : on l'utilise tel quel.
    eventType = role;
  }
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
        recipientRole: EVENT_TYPE_PAR_ROLE[role] || EVENT_TYPE_RECEPTION[role] || role,
        payload,
        status: 'pending',
        attempts: 0,
      },
    });
  }
}

/**
 * Revendique atomiquement toutes les entrées en attente et les passe en
 * 'processing'. Retourne les entrées revendiquées pour traitement.
 *
 * L'unicité est garantie par le WHERE status = 'pending' : deux appels
 * concurrents ne revendiqueront jamais la même entrée.
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
      lastAttemptAt: maintenant,
      updatedAt: maintenant,
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
    .update({ status: 'sent', updatedAt: maintenant });
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
    lastError: erreur || '',
    updatedAt: maintenant,
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
 *
 * @param {object} app - instance Strapi
 * @param {object} trx - transaction Knex active
 * @param {object} entree - entrée outbox
 * @returns {Promise<void>}
 */
async function traiterEntree(app, trx, entree) {
  try {
    await envoyerEntree(app, entree);
    await marquerEnvoyee(trx, entree);
    app.log.debug(
      `[notification-outbox] Entrée #${entree.id} envoyée (${entree.eventType} → utilisateur #${entree.recipientId}).`
    );
  } catch (e) {
    app.log.warn(
      `[notification-outbox] Échec de l'envoi de l'entrée #${entree.id} (tentative ${entree.attempts}/${MAX_TENTATIVES}) : ${e.message}`
    );
    await marquerEchec(trx, entree, e.message);
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
      try {
        await traiterEntree(app, trx, entree);
        // Compter le résultat final après traitement
        if (entree.status === 'sent') {
          envoyees++;
        } else {
          echecs++;
        }
      } catch (e) {
        echecs++;
        app.log.warn(
          `[notification-outbox] Erreur non attrapée sur l'entrée #${entree.id} : ${e.message}`
        );
      }
    }
  });

  return { traitees, envoyees, echecs };
}

module.exports = {
  TABLE_OUTBOX,
  MAX_TENTATIVES,
  EVENT_TYPE_PAR_ROLE,
  EVENT_TYPE_RECEPTION,
  OUTBOX_UID,
  creerEntrees,
  reclamerEntrees,
  envoyerEntree,
  marquerEnvoyee,
  marquerEchec,
  traiterEntree,
  distribuerNotifications,
};
