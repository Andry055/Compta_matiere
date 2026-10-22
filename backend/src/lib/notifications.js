'use strict';

/**
 * Gestion des connexions SSE (Server-Sent Events) pour les notifications
 * push en temps réel.
 *
 * Maintient une map userId → Set de réponses HTTP (flux SSE) ouvertes.
 * Lorsqu'un événement doit être poussé à un utilisateur, on écrit sur
 * tous ses flux correspondants.
 *
 * Le stockage est en mémoire (process unique). Pour une architecture
 * multi-instances, un pub/sub (Redis) serait nécessaire.
 */

const streams = new Map(); // userId → Set<http.ServerResponse>

/**
 * Enregistre un flux SSE pour un utilisateur.
 * Le flux est retiré automatiquement à la fermeture ou sur erreur.
 */
function sseRegister(userId, res) {
  if (!streams.has(userId)) {
    streams.set(userId, new Set());
  }
  const set = streams.get(userId);
  set.add(res);

  res.on('close', () => sseUnregister(userId, res));
  res.on('error', () => sseUnregister(userId, res));
}

/**
 * Retire un flux SSE pour un utilisateur.
 */
function sseUnregister(userId, res) {
  const set = streams.get(userId);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      streams.delete(userId);
    }
  }
}

/**
 * Diffuse un événement SSE à tous les flux ouverts d'un utilisateur.
 *
 * @param {number} userId - id de l'utilisateur cible
 * @param {string} event - nom de l'événement (ex: 'demande_aboutie')
 * @param {object} data - données de l'événement (sérialisables en JSON)
 * @returns {number} nombre de flux sur lesquels l'événement a été écrit
 */
function sseBroadcastToUser(userId, event, data) {
  const set = streams.get(userId);
  if (!set || set.size === 0) return 0;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let envoyes = 0;

  for (const res of set) {
    try {
      if (!res.writableEnded) {
        res.write(payload);
        envoyes++;
      }
    } catch {
      sseUnregister(userId, res);
    }
  }

  return envoyes;
}

/**
 * Nombre total de flux SSE actuellement ouverts (monitoring / debug).
 */
function sseCount() {
  let total = 0;
  for (const set of streams.values()) total += set.size;
  return total;
}

module.exports = {
  sseRegister,
  sseBroadcastToUser,
  sseCount,
};
