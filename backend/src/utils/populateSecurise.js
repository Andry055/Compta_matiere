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

  // Remove problematic populate
  if (query.populate) {
    query.populate = filterPopulate(query.populate);
  }

  // Remove problematic filters
  if (query.filters) {
    query.filters = filterFilters(query.filters);
  }

  // Remove problematic sort
  if (query.sort) {
    query.sort = filterSort(query.sort);
  }

  ctx.query = query;
}

/**
 * Recursively filter populate object to remove paths that lead to sortie relations.
 * @param {any} populate - The populate value from query
 * @returns {any} Filtered populate
 */
function filterPopulate(populate) {
  if (typeof populate === 'boolean') {
    return populate ? true : false;
  }

  if (typeof populate === 'string') {
    // Check if the string contains forbidden relations
    if (isForbiddenRelation(populate)) {
      return false; // Don't populate this field
    }
    return populate;
  }

  if (Array.isArray(populate)) {
    return populate
      .map(item => filterPopulate(item))
      .filter(item => item !== false); // Remove false values
  }

  if (populate && typeof populate === 'object') {
    const filtered = {};
    for (const [key, value] of Object.entries(populate)) {
      if (isForbiddenRelation(key)) {
        // Skip this populate entry entirely
        continue;
      }
      // Recursively filter the value (which could be an object for nested populate)
      filtered[key] = filterPopulate(value);
    }
    return filtered;
  }

  return populate;
}

/**
 * Recursively filter filters object to remove conditions on forbidden relations.
 * @param {any} filters - The filters value from query
 * @returns {any} Filtered filters
 */
function filterFilters(filters) {
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