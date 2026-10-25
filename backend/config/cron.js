'use strict';

/**
 * Tâches cron planifiées du backend.
 *
 * Ce fichier enregistre les tâches récurrentes exécutées par Strapi.
 * Chaque clé est une expression cron ; la valeur est la fonction exécutée.
 */

/**
 * Retry périodique des notifications outbox en attente ou en échec.
 *
 * S'exécute chaque minute pour distribuer les entrées restées en 'pending'
 * (destinataire déconnecté au moment de l'émission de la remise) et
 * reprendre les entrées en 'failed' qui n'ont pas encore épuisé leurs
 * tentatives. Lorsqu'un destinataire (demandeur) ouvre un flux SSE, le
 * prochain passage de ce cron lui délivre les notifications en attente.
 *
 * La réconciliation frontend (GET /api/notification-outbox/notifications
 * à la connexion du demandeur) constitue le filet de sécurité ultime pour
 * les entrées qui auraient épuisé leurs tentatives.
 */
const { distribuerNotifications } = require('../src/api/notification-outbox/services/notification-outbox');

module.exports = {
  '*/1 * * * *': async () => {
    try {
      const app = strapi;
      const result = await distribuerNotifications(app);
      if (result.traitees > 0) {
        app.log.info(
          `[notification-outbox] Cron retry : ${result.traitees} entrée(s) traitée(s), ${result.envoyees} envoyée(s), ${result.echecs} échec(s).`
        );
      }
    } catch (e) {
      strapi.log.error(
        `[notification-outbox] Erreur lors du retry périodique outbox : ${e.message}`
      );
    }
  },
};
