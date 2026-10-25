'use strict';

/**
 * material router
 *
 * LECTURE PUBLIQUE (`find` / `findOne`) : le stock est un catalogue de
 * référence (désignation, quantité, catégorie, statut) que l'écran « Demande »
 * doit pouvoir proposer même à un profil connecté en mode démonstration
 * (sans jeton Strapi) — sinon le demandeur ne peut pas choisir de matériel
 * réel. Aucune donnée personnelle n'y figure.
 *
 * ÉCRITURE AUTHENTIFIÉE : `create` / `update` / `delete` restent protégés
 * (Strapi) et le garde-fou `roleGuard` continue d'interdire l'écriture au
 * demandeur. Le rôle `public` ne reçoit QUE `material.find` / `material.findOne`
 * (voir src/index.js) : aucune permission d'écriture ne lui est accordée.
 */
const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::material.material', {
  find: { auth: false },
  findOne: { auth: false },
  // create/update/delete : `auth` omis = comportement par défaut de Strapi 5
  // (authentification requise). Attention : `auth: true` est invalide dans
  // cette version et fait échouer le démarrage à l'initialisation du routage.
});
