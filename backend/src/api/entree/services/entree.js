'use strict';

/**
 * entree service
 *
 * Règle métier des entrées (validation à trois signatures) :
 *   0/3 -> En attente
 *   1/3 ou 2/3 -> Partiellement signée (affichée côté client)
 *   3/3 (depositaire_signed AND chef_service_1_signed AND chef_service_2_signed)
 *        -> status = VALIDEE
 *
 * La règle est appliquée côté serveur : le statut ne peut jamais devenir
 * « validee » sans les trois signatures, et une entrée « validee » dont une
 * signature est retirée redescend en « verifiee ».
 */

const { createCoreService } = require('@strapi/strapi').factories;

const SIGNATURE_FLAGS = [
  'depositaire_signed',
  'chef_service_1_signed',
  'chef_service_2_signed',
];

const SIGNATURE_DATES = {
  depositaire_signed: 'date_signature_depositaire',
  chef_service_1_signed: 'date_signature_chef_service_1',
  chef_service_2_signed: 'date_signature_chef_service_2',
};

function countSignatures(data) {
  return SIGNATURE_FLAGS.filter((flag) => data[flag] === true).length;
}

/**
 * Applique la règle métier sur les données à écrire.
 * @param {object} data données de la requête (mutées)
 * @param {object} existing enregistrement existant (update) ou null (create)
 */
function applySignatureRule(data, existing) {
  const merged = Object.assign({}, existing || {}, data);

  // Horodatage automatique d'une nouvelle signature
  SIGNATURE_FLAGS.forEach((flag) => {
    if (data[flag] === true && !(existing && existing[flag] === true)) {
      data[SIGNATURE_DATES[flag]] = new Date().toISOString();
    }
  });

  if (merged.statut === 'rejetee') return; // rejet géré par le responsable

  const total = countSignatures(merged);
  if (total === SIGNATURE_FLAGS.length) {
    data.statut = 'validee';
  } else if (merged.statut === 'validee') {
    // Une entrée sans ses 3 signatures ne peut pas rester « validée »
    data.statut = total > 0 ? 'verifiee' : 'en_attente';
  }
}

module.exports = createCoreService('api::entree.entree', ({ strapi }) => ({
  async create(params) {
    const data = params.data || {};
    applySignatureRule(data, null);
    return super.create({ ...params, data });
  },

  async update(params) {
    const { documentId, data } = params;
    let existing = null;
    try {
      existing = await strapi.documents('api::entree.entree').findOne({
        documentId,
        fields: ['statut', ...SIGNATURE_FLAGS],
      });
    } catch (e) {
      existing = null;
    }
    if (data) applySignatureRule(data, existing);
    return super.update(params);
  },
}));
