'use strict';

/**
 * Appel d'un handler core (find, findOne, create, ...) du contrôleur de base.
 *
 * ATTENTION : `factories.createCoreController(uid)` retourne une FABRIQUE
 * `({ strapi }) => contrôleur`, pas un contrôleur. Déconstruire le résultat
 * (`const { find } = createCoreController(uid)`) donne donc `undefined` et
 * provoque un 500 « Cannot read properties of undefined (reading 'call') ».
 *
 * Le contrôleur custom courant possède le contrôleur core comme prototype
 * (cf. Object.setPrototypeOf(userCtrl, baseController) dans @strapi/core) :
 * on récupère donc le handler sur ce prototype et on l'exécute avec `this`
 * conservé, ce qui préserve l'accès à `strapi`, `services`, `sanitizeQuery`…
 */
function callCoreHandler(ctrl, name, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[name];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${name} » introuvable sur le contrôleur courant.`);
  }
  return handler.call(ctrl, ctx);
}

module.exports = { callCoreHandler };
