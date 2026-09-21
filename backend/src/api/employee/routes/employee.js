'use strict';

/**
 * employee router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::employee.employee', {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
