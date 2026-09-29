'use strict';

/**
 * entree router
 *
 * Lecture publique (comme direction / service / employee) : find / findOne.
 * Les endpoints custom (signature, création complète, rejet) exigent une
 * session : les permissions correspondantes sont accordées aux rôles
 * habilités dans src/index.js (bootstrap).
 */

const UID = 'api::entree.entree';

// ⚠️ Les endpoints custom (create-complete / sign / reject) sont déclarés ICI
// explicitement, sur le modèle de affectation.js : `createCoreRouter` ne
// génère que les 5 routes CRUD core (find/findOne/create/update/delete) et
// ignore toute clé de config dont le nom ne correspond pas à une route core —
// ce qui rend les routes custom déclarées dans sa config silencieusement
// inaccessibles (405 constaté sur POST /api/entrees/create-complete).
module.exports = {
  routes: [
    // find/findOne authentifiés : avec `auth: false`, Strapi traite la
    // requête comme publique MÊME si un JWT est envoyé (l'utilisateur n'est
    // pas résolu) et le sanitizer Content-API retire alors TOUTES les
    // relations (lignes, fournisseur) de la réponse — ce qui rendait les
    // entrées illisibles pour le frontend. Le frontend envoie toujours le
    // JWT (intercepteur axios) : ces routes doivent résoudre l'utilisateur.
    {
      method: 'GET',
      path: '/entrees',
      handler: 'entree.find',
    },
    // Le handler core findOne lit ctx.params.id (le routeur core déclare
    // `/:id`) : en Strapi 5 la valeur passée est le documentId.
    {
      method: 'GET',
      path: '/entrees/:id',
      handler: 'entree.findOne',
    },
    {
      method: 'POST',
      path: '/entrees/create-complete',
      handler: 'entree.createComplete',
    },
    {
      method: 'POST',
      path: '/entrees/:documentId/sign',
      handler: 'entree.sign',
    },
    {
      method: 'POST',
      path: '/entrees/:documentId/reject',
      handler: 'entree.reject',
    },
  ],
};

// UID réservé aux handlers : vérifié au chargement (erreur claire si le
// contrôleur ou l'action venait à manquer).
void UID;
