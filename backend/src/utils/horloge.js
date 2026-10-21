'use strict';

/**
 * Fuseau horaire de l'application et définition unique du « jour » métier.
 *
 * PROBLÈME RÉSOLU
 * ---------------
 * La route de remise comparait des INSTANTS construits dans le fuseau du
 * SERVEUR (`new Date(annee, mois - 1, jour)`, `new Date()` tronqué à
 * minuit) et utilisait le jour UTC comme valeur par défaut
 * (`toISOString().slice(0, 10)`). Sur un serveur qui n'est pas réglé sur
 * Madagascar, deux conséquences :
 *
 *   - une remise datée d'aujourd'hui (à Madagascar) était REFUSÉE
 *     (« date_remise ne peut pas être postérieure à aujourd'hui ») ;
 *   - la valeur par défaut était le jour UTC, soit un jour AVANCÉ par
 *     rapport au jour malgache entre 21:00 et 24:00 UTC.
 *
 * ICI, « aujourd'hui » est le jour calendaire de l'application (Madagascar),
 * quelle que soit la configuration du serveur. Les dates sont manipulées
 * comme des DATES (AAAA-MM-JJ), jamais comme des instants : l'ordre
 * lexicographique de ce format est l'ordre chronologique.
 */

/** Fuseau applicatif : Madagascar (UTC+3, sans heure d'été). */
const FUSEAU_APPLICATION = 'Indian/Antananarivo';

const FORMATTEUR = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU_APPLICATION,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Date calendaire (AAAA-MM-JJ) d'un instant, vue du fuseau applicatif.
 *
 * @param {Date|string|number} instant instant à convertir
 * @returns {string|null} la date au format AAAA-MM-JJ, ou null si l'instant
 *                          est illisible (aucune borne ne peut alors être
 *                          calculée).
 */
function dateDuJour(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (!d || Number.isNaN(d.getTime())) return null;

  let annee = null;
  let mois = null;
  let jour = null;
  for (const partie of FORMATTEUR.formatToParts(d)) {
    if (partie.type === 'year') annee = partie.value;
    else if (partie.type === 'month') mois = partie.value;
    else if (partie.type === 'day') jour = partie.value;
  }
  if (!annee || !mois || !jour) return null;
  return `${annee}-${mois}-${jour}`;
}

/**
 * Compare deux dates AAAA-MM-JJ (ordre lexicographique = ordre
 * chronologique).
 *
 * @returns {number} négatif si a < b, 0 si a = b, positif si a > b
 */
function comparerDates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

module.exports = {
  FUSEAU_APPLICATION,
  dateDuJour,
  comparerDates,
};
