'use strict';

/**
 * direction router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::direction.direction', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
