'use strict';

/**
 * rapport service — relais vers le module de calculs pur.
 * (Les handlers du contrôleur appellent directement redition-calculs.js ;
 * ce service expose les mêmes fonctions pour une réutilisation future.)
 */

const calculs = require('./redition-calculs');

module.exports = {
  ...calculs,
};
