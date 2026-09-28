'use strict';

/**
 * affectation service
 *
 * Règle métier des affectations (validation à QUATRE signatures) :
 *   0/4 -> En attente
 *   1/4, 2/4, 3/4 -> En attente (progression x/4 affichée côté client)
 *   4/4 (responsable_transfert_signed AND depositaire_signed
 *        AND chef_service_1_signed AND chef_service_2_signed)
 *        -> statut = validee  (affectation verrouillée, stock mis à jour côté client)
 *
 * La règle est appliquée côté serveur : le statut ne peut jamais devenir
 * « validee » sans les quatre signatures, et une affectation « validee » dont
 * une signature est retirée redescend en « en_attente ».
 *
 * NB : la création passe par le contrôleur `createComplete` (jamais par un
 * create nu) : les drapeaux de signature y sont toujours initialisés à
 * false — impossible de fabriquer une affectation déjà validée.
 */

const { createCoreService } = require('@strapi/strapi').factories;

const AFFECTATION_UID = 'api::affectation.affectation';

const SIGNATURE_FLAGS = [
  'responsable_transfert_signed',
  'depositaire_signed',
  'chef_service_1_signed',
  'chef_service_2_signed',
];

const SIGNATURE_DATES = {
  responsable_transfert_signed: 'date_signature_responsable_transfert',
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

  const total = countSignatures(merged);
  if (total === SIGNATURE_FLAGS.length) {
    data.statut = 'validee';
  } else if (merged.statut === 'validee') {
    // Une affectation sans ses 4 signatures ne peut pas rester « validée »
    data.statut = 'en_attente';
  }
}

module.exports = createCoreService(AFFECTATION_UID, ({ strapi }) => ({
  async create(params) {
    const data = params.data || {};
    applySignatureRule(data, null);
    return super.create({ ...params, data });
  },

  async update(params) {
    const { documentId, data } = params;
    let existing = null;
    try {
      existing = await strapi.documents(AFFECTATION_UID).findOne({
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
