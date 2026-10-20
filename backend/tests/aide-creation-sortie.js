'use strict';

/**
 * Faux « app » Strapi pour tester l'utilitaire de création d'ordre de sortie
 * (`src/utils/creationSortie.js`) SANS démarrer Strapi.
 *
 * Les tests `lot1-test-03/04/05/06` vérifiaient jusqu'ici la présence de
 * certaines CHAÎNES dans la source du contrôleur : c'était une recherche de
 * texte dans le code (incompatible avec la méthode retenue pour l'audit) et
 * cela liait les tests à l'emplacement exact de la logique. La logique de
 * création vit désormais dans un utilitaire PARTAGÉ par les deux portes
 * (formulaire classique et création depuis une demande approuvée) : ces
 * tests l'exercent donc RÉELLEMENT, sur un faux `app`.
 *
 * Le faux `app` implémente uniquement ce que l'utilitaire utilise :
 *   - `documents(uid).findOne / findMany / create` sur trois tables ;
 *   - `db.transaction(fn)` qui rolled-back en cas d'exception ;
 *   - `log.warn`.
 */

const UID_MATERIEL = 'api::material.material';
const UID_DEMANDE = 'api::demande.demande';
const UID_SORTIE = 'api::sortie.sortie';
const UID_LIGNE = 'api::sortie-ligne.sortie-ligne';
const UID_MOUVEMENT = 'api::mouvement.mouvement';

/** Correspondance d'un filtre simplifié (le seul que l'utilitaire utilise). */
function correspondFiltre(row, filtres) {
  if (!filtres) return true;
  return Object.entries(filtres).every(([champ, attendu]) => {
    if (attendu && typeof attendu === 'object' && !Array.isArray(attendu)) {
      if ('$eqi' in attendu) {
        return String(row[champ] || '').toLowerCase() === String(attendu.$eqi).toLowerCase();
      }
      if ('$startsWith' in attendu) {
        return String(row[champ] || '').startsWith(attendu.$startsWith);
      }
      if ('documentId' in attendu) {
        return String(row[champ] || '') === String(attendu.documentId);
      }
      return false;
    }
    return String(row[champ] || '') === String(attendu);
  });
}

/**
 * @param {object} options
 * @param {Array} options.materiaux fiches de stock (documentId, designation, quantite_stock, valeur_unitaire)
 * @param {Array} options.demandes  demandes (documentId, reference, statut)
 * @param {Array} options.sorties   ordres déjà existants (documentId, reference, demande)
 * @param {boolean} options.transactionCasse force l'échec de la transaction
 */
function creerAppFaux(options = {}) {
  const etat = {
    materiaux: (options.materiaux || []).map((m) => ({ ...m })),
    demandes: (options.demandes || []).map((d) => ({ ...d })),
    sorties: (options.sorties || []).map((s) => ({ ...s })),
    lignes: [],
    mouvements: [],
    transactionCasse: options.transactionCasse === true,
  };
  let compteur = 0;

  const table = (uid) => {
    if (uid === UID_MATERIEL) return etat.materiaux;
    if (uid === UID_DEMANDE) return etat.demandes;
    if (uid === UID_SORTIE) return etat.sorties;
    if (uid === UID_LIGNE) return etat.lignes;
    if (uid === UID_MOUVEMENT) return etat.mouvements;
    return [];
  };

  const app = {
    etat,
    log: { warn() {}, info() {}, error() {} },
    documents(uid) {
      return {
        async findOne({ documentId } = {}) {
          return table(uid).find((row) => row.documentId === documentId) || null;
        },
        async findMany({ filters, limit } = {}) {
          let rows = table(uid).filter((row) => correspondFiltre(row, filters));
          if (typeof limit === 'number' && limit > 0) rows = rows.slice(0, limit);
          return rows.map((row) => ({ ...row }));
        },
        async create({ data } = {}) {
          compteur += 1;
          const row = { documentId: `${uid}#${compteur}`, ...data };
          if (uid === UID_SORTIE) {
            etat.sorties.push(row);
          } else if (uid === UID_LIGNE) {
            etat.lignes.push(row);
          } else if (uid === UID_MOUVEMENT) {
            etat.mouvements.push(row);
          }
          return { ...row };
        },
      };
    },
    db: {
      async transaction(fn) {
        const sauvegarde = JSON.stringify({
          sorties: etat.sorties,
          lignes: etat.lignes,
          mouvements: etat.mouvements,
        });
        if (etat.transactionCasse) {
          throw new Error('transaction cassée (simulation)');
        }
        try {
          return await fn({ trx: {} });
        } catch (e) {
          // ROLLBACK : l'état est restauré, rien ne doit subsister.
          etat.sorties = JSON.parse(sauvegarde).sorties;
          etat.lignes = JSON.parse(sauvegarde).lignes;
          etat.mouvements = JSON.parse(sauvegarde).mouvements;
          throw e;
        }
      },
    },
  };
  return app;
}

/** Fiche de stock prête à l'emploi. */
function ficheStock(documentId, designation, quantiteStock, valeurUnitaire = 100) {
  return {
    documentId,
    designation,
    quantite_stock: quantiteStock,
    valeur_unitaire: valeurUnitaire,
  };
}

module.exports = {
  creerAppFaux,
  ficheStock,
  UID_MATERIEL,
  UID_DEMANDE,
  UID_SORTIE,
  UID_LIGNE,
  UID_MOUVEMENT,
};
