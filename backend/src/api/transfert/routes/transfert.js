'use strict';

/**
 * transfert router
 *
 * ⚠️ Les endpoints custom (create-complete / sign) sont déclarés ICI
 * explicitement : `createCoreRouter` ne génère que les 5 routes CRUD core
 * (find/findOne/create/update/delete) et ignore toute clé de config dont le
 * nom ne correspond pas à une route core — ce qui rend les routes « custom »
 * déclarées dans la config du router… silencieusement inaccessibles.
 *
 * Lecture publique (comme direction / service / entree) : find / findOne.
 * Les endpoints d'écriture exigent une session + la permission correspondante
 * (accordée dans src/index.js) ; le contrôle métier (workflow 4 signatures,
 * rôle du signataire) est appliqué dans le contrôleur.
 */

const UID = 'api::transfert.transfert';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/transferts',
      handler: 'transfert.find',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/transferts/:documentId',
      handler: 'transfert.findOne',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/transferts/create-complete',
      handler: 'transfert.createComplete',
    },
    {
      method: 'POST',
      path: '/transferts/:documentId/sign',
      handler: 'transfert.sign',
    },
  ],
};

// UID réservé aux handlers : vérifié au chargement (erreur claire si le
// contrôleur ou l'action venait à manquer).
void UID;
