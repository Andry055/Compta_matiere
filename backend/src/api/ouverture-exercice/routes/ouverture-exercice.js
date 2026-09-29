'use strict';

/**
 * ouverture-exercice router (CRUD core).
 * Les permissions sont gérées via Users & Permissions (accordées dans
 * src/index.js) : par défaut aucun rôle n'y accède.
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::ouverture-exercice.ouverture-exercice');
