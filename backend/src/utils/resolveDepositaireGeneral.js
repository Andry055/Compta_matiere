'use strict';

/**
 * Résolveur dédié du compte du dépositaire général.
 *
 * Le destinataire de l'événement `nouvelle_demande` est EXCLUSIVEMENT le
 * compte `hery.rakoto@mtefop.gov.mg`, identifié par son adresse email
 * (unicité garantie par le schéma users-permissions). Cette résolution est
 * indépendante de la direction du demandeur et n'utilise pas
 * `findUtilisateursParRoleEtDirection`.
 *
 * Aucun nouveau rôle applicatif n'est créé. Aucun compte n'est créé ni
 * modifié : on ne fait que LIRE le compte existant.
 */

/** Adresse email du seul destinataire autorisé pour `nouvelle_demande`. */
const DESTINATAIRE_EMAIL = 'hery.rakoto@mtefop.gov.mg';

/** Rôle métier attendu pour ce compte. */
const ROLE_ATTENDU = 'depositaire';

/**
 * Résout le compte du dépositaire général par email.
 *
 * @param {object} app - instance Strapi
 * @returns {Promise<{ok: boolean, user?: {id: number, email: string, username: string}, reason?: string}>}
 */
async function resoudreDepositaireGeneral(app) {
  let users;
  try {
    users = await app.db.query('plugin::users-permissions.user').findMany({
      where: { email: DESTINATAIRE_EMAIL },
      // La relation `role` doit être peuplée : sans elle, `user.role` est
      // undefined et le contrôle de rôle échoue (résolution impossible).
      populate: ['role'],
    });
  } catch (e) {
    app.log.warn(
      `[resolveDepositaireGeneral] Échec de la requête pour ${DESTINATAIRE_EMAIL} : ${e.message}`
    );
    return { ok: false, reason: 'erreur_requete' };
  }

  if (!users || users.length === 0) {
    app.log.warn(
      `[resolveDepositaireGeneral] Compte introuvable : ${DESTINATAIRE_EMAIL}`
    );
    return { ok: false, reason: 'absent' };
  }

  if (users.length > 1) {
    app.log.warn(
      `[resolveDepositaireGeneral] Plusieurs comptes pour ${DESTINATAIRE_EMAIL} (ambigu : ${users.length} résultats)`
    );
    return { ok: false, reason: 'ambigu' };
  }

  const u = users[0];

  if (u.blocked === true) {
    app.log.warn(
      `[resolveDepositaireGeneral] Compte bloqué : ${DESTINATAIRE_EMAIL}`
    );
    return { ok: false, reason: 'bloque' };
  }

  if (u.confirmed !== true) {
    app.log.warn(
      `[resolveDepositaireGeneral] Compte non confirmé : ${DESTINATAIRE_EMAIL}`
    );
    return { ok: false, reason: 'non_confirme' };
  }

  const roleCode = (u.role && (u.role.code || u.role.type)) || '';
  if (roleCode.toString().toLowerCase() !== ROLE_ATTENDU.toLowerCase()) {
    app.log.warn(
      `[resolveDepositaireGeneral] Rôle inattendu pour ${DESTINATAIRE_EMAIL} : ${roleCode}`
    );
    return { ok: false, reason: 'role_inconnu' };
  }

  return {
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      username: u.username,
    },
  };
}

module.exports = {
  resoudreDepositaireGeneral,
  DESTINATAIRE_EMAIL,
  ROLE_ATTENDU,
};
