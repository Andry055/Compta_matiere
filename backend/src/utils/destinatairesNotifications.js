'use strict';

/**
 * Utilitaire de résolution des destinataires de notifications SSE.
 *
 * Fournit une fonction pour trouver les utilisateurs d'un rôle métier donné
 * rattachés à une direction donnée. Cette résolution repose sur la relation
 * explicite utilisateur → direction (champ `direction` ajouté au schéma
 * users-permissions), avec un repli sur le champ `department` (chaîne) pour
 * compatibilité avec les utilisateurs existants non encore migrés.
 */
const { normaliser } = require('../api/demande/controllers/demande');

/**
 * Trouve les utilisateurs d'un rôle donné rattachés à une direction donnée.
 *
 * La résolution repose d'abord sur la relation explicite utilisateur →
 * direction (champ `direction` du schéma users-permissions).
 * En cas d'absence de résultat, un repli est effectué sur le champ `department`
 * (chaîne de forme « Direction - Service » ou « Direction ») pour ne pas
 * bloquer les notifications sur des utilisateurs non encore migrés.
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

  // 1. Résoudre le numeric id de la direction à partir de son documentId
  let directionIdNumeric;
  try {
    const direction = await app.documents('api::direction.direction').findOne({
      documentId: directionId,
      fields: ['id'],
    });
    if (!direction) {
      app.log.warn(
        `[destinatairesNotifications] Direction "${directionId}" introuvable : aucun destinataire pour le rôle "${roleCode}".`
      );
      return [];
    }
    directionIdNumeric = direction.id;
  } catch (e) {
    app.log.warn(
      `[destinatairesNotifications] Échec de la lecture de la direction "${directionId}": ${e.message}`
    );
    return [];
  }

  // 2. La relation utilisateur → direction est stockée via la table de liaison
  //    up_users_direction_lnk (pas de colonne direction_document_id sur up_users).
  let userIds;
  try {
    userIds = await app.db.connection('up_users_direction_lnk')
      .where({ direction_id: directionIdNumeric })
      .pluck('user_id');
  } catch (e) {
    app.log.warn(
      `[destinatairesNotifications] Échec de la requête sur up_users_direction_lnk pour direction="${directionId}": ${e.message}`
    );
    return [];
  }

  if (!userIds || userIds.length === 0) {
    app.log.debug(
      `[destinatairesNotifications] Aucun utilisateur rattaché à la direction "${directionId}" (via up_users_direction_lnk).`
    );
    return [];
  }

  // 3. Récupérer les utilisateurs avec leur rôle
  let users;
  try {
    users = await app.documents('plugin::users-permissions.user').findMany({
      where: { id: { $in: userIds } },
      populate: ['role'],
    });
  } catch (e) {
    app.log.warn(
      `[destinatairesNotifications] Échec de la requête utilisateurs rôle="${roleCode}": ${e.message}`
    );
    return [];
  }

  if (!users || users.length === 0) {
    return [];
  }

  const correspondants = [];
  const utilisateursSansRole = [];

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

  if (correspondants.length > 0) {
    app.log.debug(
      `[destinatairesNotifications] ${correspondants.length} utilisateur(s) trouvé(s) pour le rôle "${roleCode}" dans la direction "${directionId}".`
    );
    return correspondants.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
    }));
  }

  // 4. Repli : correspondance sur le champ `department` (utilisateurs non migrés)
  // On récupère le nom/abréviation de la direction cible pour matcher le department.
  let directionNom = '';
  let directionAbrev = '';
  try {
    const direction = await app.documents('api::direction.direction').findOne({
      documentId: directionId,
      fields: ['nom_direction', 'abreviation'],
    });
    if (direction) {
      directionNom = direction.nom_direction || '';
      directionAbrev = direction.abreviation || '';
    }
  } catch (e) {
    app.log.warn(
      `[destinatairesNotifications] Impossible de lire la direction "${directionId}" pour le repli department: ${e.message}`
    );
  }

  if (!directionNom && !directionAbrev) {
    app.log.debug(
      `[destinatairesNotifications] Repli department impossible : direction "${directionId}" introuvable ou sans nom/abréviation.`
    );
    return [];
  }

  const nomNorm = normaliser(directionNom);
  const abrevNorm = normaliser(directionAbrev);

  // Même pattern que la résolution principale : on peuple le rôle et on filtre en JS.
  try {
    users = await app.documents('plugin::users-permissions.user').findMany({
      populate: ['role'],
    });
  } catch (e) {
    app.log.warn(
      `[destinatairesNotifications] Échec de la requête repli department rôle="${roleCode}": ${e.message}`
    );
    return [];
  }

  if (!users || users.length === 0) {
    return [];
  }

  const correspondantsDepartment = [];
  for (const u of users) {
    if (!u || !u.role || !u.department) continue;
    const code = (u.role.code || u.role.type || '').toString().toLowerCase();
    if (code !== roleCode.toString().toLowerCase()) continue;

    const dept = typeof u.department === 'string' ? u.department.trim() : '';
    if (!dept) continue;

    // Le département a la forme « <DIRECTION> - <SERVICE> » ou juste « <DIRECTION> ».
    const sep = dept.indexOf(' - ');
    const gauche = sep >= 0 ? dept.slice(0, sep).trim() : dept;
    const gaucheNorm = normaliser(gauche);

    if (gaucheNorm === nomNorm || gaucheNorm === abrevNorm) {
      correspondantsDepartment.push(u);
    }
  }

  if (correspondantsDepartment.length > 0) {
    app.log.debug(
      `[destinatairesNotifications] Repli department : ${correspondantsDepartment.length} ${roleCode}(s) trouvé(s) pour la direction "${directionId}" (nom="${directionNom}", abrév="${directionAbrev}").`
    );
    return correspondantsDepartment.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
    }));
  }

  app.log.debug(
    `[destinatairesNotifications] Aucun utilisateur avec le rôle "${roleCode}" trouvé dans la direction "${directionId}" (ni par relation direction, ni par repli department).`
  );
  return [];
}

module.exports = {
  findUtilisateursParRoleEtDirection,
};
