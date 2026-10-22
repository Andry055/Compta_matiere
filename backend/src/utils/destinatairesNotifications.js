'use strict';

/**
 * Utilitaire de résolution des destinataires de notifications SSE.
 *
 * Fournit une fonction pour trouver les utilisateurs d'un rôle métier donné
 * rattachés à une direction donnée. Cette résolution repose sur la relation
 * explicite utilisateur → direction (champ `direction` ajouté au schéma
 * users-permissions), et non sur une recherche approximée sur `department`.
 */

/**
 * Trouve les utilisateurs d'un rôle donné rattachés à une direction donnée.
 *
 * La résolution repose exclusivement sur la relation explicite utilisateur →
 * direction (champ `direction` du schéma users-permissions), jamais sur une
 * recherche approximée sur `department`.
 *
 * @param {object} app - instance Strapi
 * @param {string} roleCode - code du rôle (ex: 'depositaire', 'magasinier')
 * @param {string|number} directionId - documentId de la direction cible
 * @returns {Promise<Array<{id, email, username}>>} liste des utilisateurs cibles
 */
async function findUtilisateursParRoleEtDirection(app, roleCode, directionId) {
  if (!directionId) {
    app.log.warn(
      `[destinatairesNotifications] Aucun documentId de direction fourni pour le rôle "${roleCode}" : aucune notification ne sera envoyée.`
    );
    return [];
  }

  let users;
  try {
    users = await app.db.query('plugin::users-permissions.user').findMany({
      where: { direction: { documentId: directionId } },
      populate: ['role'],
    });
  } catch (e) {
    app.log.warn(
      `[destinatairesNotifications] Échec de la requête utilisateurs rôle="${roleCode}" direction="${directionId}": ${e.message}`
    );
    return [];
  }

  if (!users || users.length === 0) {
    app.log.debug(
      `[destinatairesNotifications] Aucun utilisateur rattaché à la direction "${directionId}" pour le rôle "${roleCode}".`
    );
    return [];
  }

  const utilisateursSansRole = [];
  const correspondants = [];

  for (const u of users) {
    if (!u || !u.role) {
      utilisateursSansRole.push(u ? u.id : 'inconnu');
      continue;
    }
    const code = (u.role.code || u.role.type || '').toString().toLowerCase();
    if (code === roleCode.toString().toLowerCase()) {
      correspondants.push(u);
    }
  }

  if (utilisateursSansRole.length > 0) {
    app.log.warn(
      `[destinatairesNotifications] ${utilisateursSansRole.length} utilisateur(s) de la direction "${directionId}" sans rôle peuplé (ignorés pour le rôle "${roleCode}").`
    );
  }

  if (correspondants.length === 0) {
    (app.log?.debug || (() => {}))(
      `[destinatairesNotifications] Aucun utilisateur avec le rôle "${roleCode}" trouvé dans la direction "${directionId}" (${users.length} utilisateur(s) au total dans cette direction).`
    );
    return [];
  }

  return correspondants.map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
  }));
}

module.exports = {
  findUtilisateursParRoleEtDirection,
};
