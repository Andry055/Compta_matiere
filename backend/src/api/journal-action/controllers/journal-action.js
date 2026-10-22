'use strict';

/**
 * journal-action controller
 *
 * Journal d'action des anomalies — LECTURE SEULE, immuable :
 *   GET /journal-actions  liste des entrées de journal (tracabilité des statuts)
 *
 * Aucune opération d'écriture sur ce contrôleur : les entrées ne s'ajoutent
 * que depuis le contrôleur anomalie (déclaration / résolution) et ne peuvent
 * jamais être modifiées ni supprimées.
 */

const { createCoreController } = require('@strapi/strapi').factories;

const JOURNAL_ACTION_UID = 'api::journal-action.journal-action';

function baseHandler(ctrl, nom, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[nom];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${nom} » introuvable sur ${JOURNAL_ACTION_UID}.`);
  }
  return handler.call(ctrl, ctx);
}

module.exports = createCoreController(JOURNAL_ACTION_UID, ({ strapi: app }) => ({
  /**
   * GET /api/journal-actions
   * Liste des entrées de journal (lecture seule, immuable).
   */
  async find(ctx) {
    return baseHandler(this, 'find', ctx);
  },
}));
