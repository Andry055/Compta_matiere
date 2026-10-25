'use strict';

/**
 * Migration : ajout de la colonne `lastAttemptAt` à la table
 * `notification_outboxes`.
 *
 * Cette colonne est déclarée dans schema.json (attribut datetime) mais la
 * table a été créée avant son ajout : le UPDATE dans `reclamerEntrees`
 * échouait avec "no such column: lastAttemptAt", bloquant toute distribution
 * outbox. La migration ajoute la colonne (nullable, aucune donnée existante
 * n'est modifiée).
 */

module.exports = {
  async up({ db }) {
    await db.raw(
      `ALTER TABLE notification_outboxes ADD COLUMN lastAttemptAt DATETIME`
    );
  },

  async down({ db }) {
    // SQLite < 3.35.0 ne supporte pas DROP COLUMN : meilleure effort, ignoré si non supporte.
    try {
      await db.raw(
        `ALTER TABLE notification_outboxes DROP COLUMN lastAttemptAt`
      );
    } catch (e) {
      // Rollback best-effort : la colonne reste presente, ce qui n'est pas bloquant.
    }
  },
};
