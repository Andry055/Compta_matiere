'use strict';

/**
 * Utility to secure populate and filters for demandeur role.
 * Removes any populate that reaches a relation sortie, sorties, lignes_sortie or sortie_lignes (at any level).
 * Removes any filters that query these relations.
 * @param {Object} ctx - Strapi context
 * @returns {void} Modifies ctx.query in place
 */
function securePopulateAndFilters(ctx) {
  // Only apply for demandeur role
  if (!ctx.state || !ctx.state.user) {
    return;
  }

  // We need to check if the user is demandeur, but we don't have direct access to role checking here.
  // The controller should pass the user role or we need to check via strapi.
  // However, to avoid circular dependencies, we'll assume the controller will call this only for demandeur.
  // Alternatively, we can check the role here by importing roleGuard utilities.
  const { getRoleCode, DEMANDEUR_ROLE } = require('./roleGuard');

  // Since we're in a utility, we need to access strapi to check role.
  // But this utility might be called outside of a request context?
  // Actually, it will be called in controller methods where strapi is available.
  // We'll modify the function to accept strapi as parameter or get it from context.
  // For simplicity, let's assume the controller will bind or pass necessary dependencies.
  // However, to keep it clean, we'll check role using the same method as in controllers.

  // Let's get strapi from the context (it's available in controllers via strapi variable)
  // But in this utility, we don't have direct access. We'll change approach:
  // The controller will check if user is demandeur, and if so, call this utility.
  // So we'll document that this utility should only be called for demandeur role.

  // For now, we'll implement the filtering logic and assume caller ensures it's for demandeur.

  const query = ctx.query || {};

  // Populate : on NE RETIRE QUE les segments interdits. Si plus rien ne doit
  // être peuplé, la clé `populate` est supprimée de la requête : la laisser
  // à `false` fait rejeter la requête (400) par Strapi, et la laisser à `{}`
  // fait peupler TOUTES les relations (donc ré-ouvrir l'accès aux sorties
  // des autres).
  if (query.populate !== undefined && query.populate !== null) {
    const filtre = filterPopulate(query.populate);
    if (filtre === undefined) {
      delete query.populate;
    } else {
      query.populate = filtre;
    }
  }

  // Filtres : les TABLEAUX sont conservés tels quels (un tableau d'opérateurs
  // comme `$in` ou `$and` deviendrait sinon un objet indexé, inopérant pour
  // Strapi : le filtre d'isolation du serveur ne serait plus appliqué).
  if (query.filters) {
    query.filters = filterFilters(query.filters);
  }

  // Tri : même règle que les filtres (un tableau de tris reste un tableau).
  if (query.sort) {
    query.sort = filterSort(query.sort);
  }

  ctx.query = query;
}

/**
 * Recursively filter populate object to remove paths that lead to sortie relations.
 * @param {any} populate - The populate value from query
 * @returns {any} Filtered populate, ou `undefined` s'il ne reste rien à peupler
 */
function filterPopulate(populate) {
  if (typeof populate === 'boolean') {
    return populate;
  }

  if (typeof populate === 'string') {
    // Relation interdite : ce segment seul est retiré de la requête.
    if (isForbiddenRelation(populate)) {
      return undefined;
    }
    return populate;
  }

  if (Array.isArray(populate)) {
    const restant = populate
      .map(item => filterPopulate(item))
      .filter(item => item !== undefined);
    return restant.length ? restant : undefined;
  }

  if (populate && typeof populate === 'object') {
    const filtered = {};
    for (const [key, value] of Object.entries(populate)) {
      if (isForbiddenRelation(key)) {
        // Skip this populate entry entirely
        continue;
      }
      // Recursively filter the value (which could be an object for nested populate)
      const sous = filterPopulate(value);
      if (sous === undefined) {
        continue;
      }
      filtered[key] = sous;
    }
    // Plus aucun segment autorisé : ne rien peupler du tout.
    return Object.keys(filtered).length ? filtered : undefined;
  }

  return populate;
}

/**
 * Recursively filter filters object to remove conditions on forbidden relations.
 * Les TABLEAUX sont conservés comme tableaux (condition d'opérateurs Strapi :
 * `$in`, `$and`, `$or`... un tableau aplati en objet indexé devient
 * inopérant et supprime notamment le filtre d'isolation posé par le serveur).
 * @param {any} filters - The filters value from query
 * @returns {any} Filtered filters
 */
function filterFilters(filters) {
  if (Array.isArray(filters)) {
    return filters.map(condition => filterFilters(condition));
  }

  if (!filters || typeof filters !== 'object') {
    return filters;
  }

  const filtered = {};
  for (const [key, value] of Object.entries(filters)) {
    // Check if this key is a forbidden relation
    if (isForbiddenRelation(key)) {
      // Skip this filter entirely
      continue;
    }

    // Recursively filter the value (which could be an object for nested conditions)
    filtered[key] = filterFilters(value);
  }

  return filtered;
}

/**
 * Check if a string represents a forbidden relation path.
 * @param {string} path - The path to check (e.g., 'sortie', 'lignes_sortie.populate')
 * @returns {boolean} True if the path contains forbidden relations
 */
function isForbiddenRelation(path) {
  if (typeof path !== 'string') {
    return false;
  }

  const forbidden = ['sortie', 'sorties', 'lignes_sortie', 'sortie_lignes'];

  // Check if the path starts with any forbidden term followed by dot or end of string
  // Also check if it contains dotted notation like 'populate[sortie]'
  // We'll do a simple check: if any forbidden term appears as a separate word in dot notation
  // or in bracket notation.

  // Convert brackets to dots for easier checking: populate[sortie][lignes] -> populate.sortie.lignes
  const normalized = path.replace(/\[([^\]]+)\]/g, '.$1');

  // Split by dot and check each segment
  const segments = normalized.split('.');
  return segments.some(segment => forbidden.includes(segment));
}

/**
 * Recursively filter sort object to remove conditions on forbidden relations.
 * @param {any} sort - The sort value from query
 * @returns {any} Filtered sort
 */
function filterSort(sort) {
  if (Array.isArray(sort)) {
    return sort.map(entry => filterSort(entry));
  }

  if (!sort || typeof sort !== 'object') {
    return sort;
  }

  const filtered = {};
  for (const [key, value] of Object.entries(sort)) {
    // Check if this key is a forbidden relation
    if (isForbiddenRelation(key)) {
      // Skip this sort entirely
      continue;
    }

    // Recursively filter the value (which could be an object for nested sort)
    filtered[key] = filterSort(value);
  }

  return filtered;
}

module.exports = {
  securePopulateAndFilters,
};