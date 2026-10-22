'use strict';

/**
 * Notifications SSE — stub minimal pour les tests hors Strapi.
 *
 * Fournit sseBroadcastToUser (utilisé par notification-outbox/services)
 * ainsi que sseRegister et sseCount (utilisés par le flux SSE existant).
 * Implémentation en mémoire, sans effet de bord externe.
 */

const streams = new Map(); // userId -> Set<{ write, closed }>

/**
 * Enregistre un flux SSE pour un utilisateur.
 * @param {number|string} userId
 * @param {object} stream - { write, closed }
 */
function sseRegister(userId, stream) {
  if (!streams.has(userId)) streams.set(userId, new Set());
  streams.get(userId).add(stream);
  return () => {
    stream.closed = true;
    streams.get(userId).delete(stream);
  };
}

/**
 * Diffuse un événement SSE à tous les flux d'un utilisateur.
 * @param {number|string} userId
 * @param {string} eventType
 * @param {object} payload
 * @returns {number} nombre de flux atteints
 */
function sseBroadcastToUser(userId, eventType, payload) {
  const set = streams.get(userId);
  if (!set) return 0;
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload || {})}\n\n`;
  let count = 0;
  for (const stream of set) {
    if (!stream.closed && typeof stream.write === 'function') {
      stream.write(message);
      count += 1;
    }
  }
  return count;
}

/**
 * Retourne le nombre de flux SSE actifs pour un utilisateur.
 * @param {number|string} userId
 * @returns {number}
 */
function sseCount(userId) {
  const set = streams.get(userId);
  return set ? set.size : 0;
}

module.exports = {
  sseRegister,
  sseBroadcastToUser,
  sseCount,
};
