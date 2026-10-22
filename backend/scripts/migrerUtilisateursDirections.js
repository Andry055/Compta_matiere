'use strict';

/**
 * Migration : peupler la relation `direction` sur les utilisateurs existants
 * à partir de leur champ `department`.
 *
 * Règle : on assigne une direction UNIQUEMENT quand le `department` permet une
 * correspondance fiable (nom ou abréviation exact, insensible à la casse).
 * Sinon, le champ reste null (aucun attributage automatique sans preuve).
 *
 * Usage : node backend/scripts/migrerUtilisateursDirections.js
 * (à exécuter avec l'environnement Strapi chargé, ou via `strapi console`).
 */

const { normaliser } = require('../api/demande/controllers/demande');

async function migrerUtilisateursDirections({ strapi }) {
  const app = strapi;
  const users = await app.documents('plugin::users-permissions.user').findMany({
    fields: ['id', 'email', 'username', 'department', 'direction'],
    populate: ['role'],
    limit: -1,
  });

  const directions = await app.documents('api::direction.direction').findMany({
    fields: ['documentId', 'nom_direction', 'abreviation'],
    limit: -1,
  });

  const dirParNom = new Map();
  const dirParAbrev = new Map();
  for (const d of directions || []) {
    const nom = normaliser(d.nom_direction || '');
    const abrev = normaliser(d.abreviation || '');
    if (nom) dirParNom.set(nom, d.documentId);
    if (abrev) dirParAbrev.set(abrev, d.documentId);
  }

  let assignees = 0;
  let ignores = 0;

  for (const user of users || []) {
    const dept = typeof user.department === 'string' ? user.department.trim() : '';
    if (!dept) {
      ignores += 1;
      continue;
    }

    // Le département a la forme « <DIRECTION> - <SERVICE> » ou juste « <DIRECTION> ».
    const sep = dept.indexOf(' - ');
    const gauche = sep >= 0 ? dept.slice(0, sep).trim() : dept;
    const droite = sep >= 0 ? dept.slice(sep + 3).trim() : null;

    let cibleId = null;

    // 1. Si la partie après « - » est un nom d'abréviation de direction.
    if (droite) {
      const id = dirParAbrev.get(normaliser(droite)) || dirParNom.get(normaliser(droite));
      if (id) { cibleId = id; }
    }
    // 2. Sinon, la partie avant « - » comme nom ou abréviation.
    if (!cibleId) {
      cibleId = dirParNom.get(normaliser(gauche)) || dirParAbrev.get(normaliser(gauche));
    }

    if (!cibleId) {
      ignores += 1;
      continue;
    }

    // Éviter de réécrire si déjà correct.
    const deja = user.direction && user.direction.documentId === cibleId;
    if (deja) continue;

    await app.documents('plugin::users-permissions.user').update({
      documentId: user.id,
      data: { direction: cibleId },
    });
    assignees += 1;
    app.log.info(
      `[migration] Utilisateur ${user.email} (#${user.id}) → direction ${cibleId}`
    );
  }

  app.log.info(
    `[migration] Terminé : ${assignees} utilisateur(s) affecté(s) à une direction, ${ignores} ignoré(s).`
  );
}

module.exports = { migrerUtilisateursDirections };

// Exécution directe si appelé comme script.
if (require.main === module) {
  console.log('Ce script doit être exécuté dans le contexte Strapi (strapi console).');
}
