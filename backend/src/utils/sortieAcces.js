'use strict';

/**
 * Fonctions pures pour le contrôle d'accès aux sorties (filtre demandeur).
 */

function filtreAppropriation(filtreClient, documentIds) {
  const ids = documentIds || [];

  // Un `$in` vide est SUPPRIMÉ par le sanitizer de Strapi (un tableau vide
  // est retiré de la requête) : la condition disparaîtrait et le demandeur
  // verrait alors TOUTES les sorties. « Aucun résultat » est donc exprimé
  // par une condition qui, elle, survit au sanitizer (un documentId n'est
  // jamais nul).
  const appropriation = ids.length
    ? { documentId: { $in: ids } }
    : { documentId: { $null: true } };

  if (!filtreClient) {
    return appropriation;
  }

  return {
    $and: [filtreClient, appropriation],
  };
}

function verifierAccesSortie(ctx, documentId, documentIdsPossedes) {
  const possedes = documentIdsPossedes || [];
  const id = documentId;
  if (!id || !possedes.includes(id)) {
    ctx.status = 404;
    ctx.body = {
      error: {
        status: 404,
        name: 'NotFoundError',
        message: 'Sortie introuvable.',
      },
    };
    return ctx.body;
  }
  return null;
}

module.exports = {
  filtreAppropriation,
  verifierAccesSortie,
};
