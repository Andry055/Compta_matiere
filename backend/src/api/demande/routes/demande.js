'use strict';

/**
 * demande router
 *
 * Les 5 routes CRUD core (find / findOne / create / update / delete) sont
 * générées par `createCoreRouter` ; les endpoints de DÉCISION de l'étape 2
 * (« approuver » / « rejeter ») sont déclarés ICI explicitement :
 * `createCoreRouter` ne génère que les routes core et ignore toute clé de
 * config dont le nom ne correspond pas à une route core — les routes custom
 * déclarées dans sa config sont silencieusement inaccessibles (405).
 *
 * Les permissions correspondantes (`api::demande.demande.approuver` /
 * `api::demande.demande.rejeter`) sont accordées au rôle « depositaire »
 * dans src/index.js (bootstrap) ; le contrôle métier (rôle, statut, stock,
 * motif) est appliqué dans le contrôleur.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

/**
 * Le module exporte une FONCTION : les routes core sont instanciées au
 * moment de l'enregistrement des routes API (le content-type est alors
 * résolvable), pas au simple chargement du fichier.
 */
module.exports = () => {
  const core = createCoreRouter('api::demande.demande');
  return {
    routes: [
      ...core.routes,
      {
        method: 'POST',
        path: '/demandes/:documentId/approuver',
        handler: 'demande.approuver',
      },
      {
        method: 'POST',
        path: '/demandes/:documentId/rejeter',
        handler: 'demande.rejeter',
      },
      // Étape 3 « Ordre de sortie » : création de l'ordre DEPUIS la demande
      // approuvée (préremplissage fait par le serveur, une demande = un
      // ordre). Permission : `api::demande.demande.creerOrdre` (rôle
      // « depositaire » + administrateur applicatif, voir src/index.js).
      {
        method: 'POST',
        path: '/demandes/:documentId/creer-ordre',
        handler: 'demande.creerOrdre',
      },
    ],
  };
};
