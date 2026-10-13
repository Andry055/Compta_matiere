'use strict';

/**
 * Fonctions pures pour le contrôle d'accès aux sorties (filtre demandeur).
 */

function filtreAppropriation(filtreClient, documentIds) {
  const appropriation = { documentId: { $in: documentIds || [] } };

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
