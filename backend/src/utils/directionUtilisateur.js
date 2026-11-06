'use strict';

/**
 * Résolution des directions d'un utilisateur à partir de son libellé de
 * département.
 *
 * Le libellé `department` d'un compte est de la forme « <DIRECTION> - <SERVICE> »
 * (ex. « DRH - Service Gestion Personnel ») ou parfois seulement le nom de la
 * direction. La direction est donc la PREMIÈRE partie du libellé.
 *
 * La correspondance se fait sur le nom de la direction OU sur son
 * abréviation (« DRH »), sans distinction de casse : les comptes de
 * démonstration utilisent majoritairement l'abréviation.
 *
 * Cette fonction factorise la logique déjà présente dans les contrôleurs
 * `sortie` et `reception-physique` ; elle est utilisée par le contrôleur de la
 * remise au détenteur.
 */

/** UID du content-type direction. */
const DIRECTION_UID = 'api::direction.direction';

/**
 * @param {object} strapi instance Strapi
 * @param {object} user utilisateur connecté (avec `department`)
 * @returns {Promise<string[]>} documentId des directions de l'utilisateur
 *                                  (tableau vide si aucune direction ne
 *                                  correspond à son département)
 */
async function getDirectionIdsDuUtilisateur(strapi, user) {
  const departement = (user && user.department) || '';
  const separateur = departement.indexOf(' - ');
  const directionNom = separateur >= 0
    ? departement.slice(0, separateur).trim()
    : departement.trim();
  if (!directionNom) return [];

  const directions = await strapi.documents(DIRECTION_UID).findMany({
    filters: {
      $or: [
        { nom_direction: { $eqi: directionNom } },
        { abreviation: { $eqi: directionNom } },
      ],
    },
    fields: ['documentId'],
    limit: -1,
  });
  return (directions || []).map((d) => d.documentId);
}

module.exports = { getDirectionIdsDuUtilisateur };
