'use strict';

/**
 * demande service
 *
 * Génération de la référence officielle « DEM-AAAA-NNN » (ex. DEM-2025-014)
 * lorsqu'elle n'est pas fournie, et comptage pour le suivi du Demandeur.
 */

const { createCoreService } = require('@strapi/strapi').factories;

function pad(n, size) {
  return String(n).padStart(size, '0');
}

/** Prochaine référence DEM-AAAA-NNN de l'année en cours. */
async function nextReference(strapi) {
  const year = new Date().getFullYear();
  const prefix = `DEM-${year}-`;
  let count = 0;
  try {
    const rows = await strapi.documents('api::demande.demande').findMany({
      fields: ['reference'],
      limit: 500,
    });
    count = rows.filter(
      (row) => row.reference && row.reference.startsWith(prefix)
    ).length;
  } catch (e) {
    count = 0;
  }
  return `${prefix}${pad(count + 1, 3)}`;
}

module.exports = createCoreService('api::demande.demande', ({ strapi }) => ({
  async create(params) {
    const data = params.data || {};
    if (!data.reference) {
      data.reference = await nextReference(strapi);
    }
    if (!data.groupe) {
      data.groupe = data.reference;
    }
    return super.create({ ...params, data });
  },

  nextReference: () => nextReference(strapi),
}));
