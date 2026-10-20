'use strict';

/**
 * Création d'un ORDRE DE SORTIE — logique partagée.
 *
 * Un seul chemin de création pour TOUS les ordres de sortie :
 *  - la voie classique du formulaire de distribution
 *    (`POST /api/sorties/create-complete`) ;
 *  - la voie « depuis une demande approuvée »
 *    (`POST /api/demandes/:documentId/creer-ordre`, étape 3).
 *
 * Les DEUX appelent `preparerSortie()` puis `creerSortieEtLignes()` : mêmes
 * contrôles (quantités entières, stock, valeur unitaire, doublons, unicité de
 * la demande), mêmes messages d'erreur, même transaction, même référence
 * `SOR-AAAA-NNN`. Un ordre ne peut donc jamais être fabriqué par un chemin
 * plus permissif que l'autre.
 *
 * Règles appliquées ici (côté serveur — le frontend n'est jamais une source
 * de sécurité) :
 *  - la date de sortie est obligatoire ;
 *  - au moins une ligne, quantité entière ≥ 1 ;
 *  - le justificatif (pièce justificative) est obligatoire ;
 *  - au moins une destination : direction, service ou bénéficiaire ;
 *  - chaque quantité doit rester couverte par le STOCK ACTUEL de la fiche ;
 *  - pas deux lignes sur le même matériel ;
 *  - la fiche de stock doit porter une valeur unitaire > 0 (sinon aucun
 *    montant n'est calculable) ;
 *  - une demande ne porte qu'UN ordre : si un ordre existe déjà pour elle,
 *    la création est refusée (409).
 */

const SORTIE_UID = 'api::sortie.sortie';
const SORTIE_LIGNE_UID = 'api::sortie-ligne.sortie-ligne';
const MATERIEL_UID = 'api::material.material';
const MOUVEMENT_UID = 'api::mouvement.mouvement';

/** Statuts d'une demande qui peuvent être transformées en ordre de sortie. */
const STATUTS_DEMANDE_LIABLE = ['approuvee', 'preparation'];

/** Erreur métier : le contrôleur la convertit en réponse HTTP. */
class ErreurCreationSortie extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ErreurCreationSortie';
    this.status = status;
  }
}

/** Résout une fiche de stock par documentId (ou par désignation exacte). */
async function resoudreMateriel(app, ligne) {
  const materielIdLigne = ligne.materiel_id || ligne.materielId || null;
  if (materielIdLigne) {
    try {
      const materiel = await app.documents(MATERIEL_UID).findOne({
        documentId: materielIdLigne,
      });
      if (materiel) return materiel;
    } catch (e) {
      /* fiche introuvable */
    }
  }
  if (ligne.designation && String(ligne.designation).trim()) {
    try {
      const rows = await app.documents(MATERIEL_UID).findMany({
        filters: { designation: { $eqi: String(ligne.designation).trim() } },
        limit: 1,
      });
      if (rows && rows.length > 0) return rows[0];
    } catch (e) {
      /* fiche introuvable */
    }
  }
  return null;
}

/**
 * Contrôles + résolution des lignes d'un ordre de sortie.
 *
 * Retourne `{ entete, lignes }` où `lignes[i].materiel` est la fiche de stock
 * RÉSOLUE (et non un identifiant), ou lève `ErreurCreationSortie` (400/409).
 * Aucune écriture n'a lieu à ce stade : une sortie partielle ne doit jamais
 * exister.
 */
async function preparerSortie(app, body) {
  // --- Champs obligatoires --------------------------------------------------
  if (!body.date_sortie) {
    throw new ErreurCreationSortie(400, 'Date de sortie obligatoire.');
  }
  const lignes = Array.isArray(body.lignes) ? body.lignes : [];
  if (lignes.length === 0) {
    throw new ErreurCreationSortie(400, 'Au moins un matériel est requis.');
  }
  for (const ligne of lignes) {
    const quantite = Number(ligne.quantite);
    if (!Number.isFinite(quantite) || quantite <= 0 || !Number.isInteger(quantite)) {
      throw new ErreurCreationSortie(
        400,
        'Quantité invalide : elle doit être un entier supérieur à 0.'
      );
    }
  }

  // --- Pièce justificative --------------------------------------------------
  const justificatif = body.justificatif || '';
  if (!justificatif || String(justificatif).trim() === '') {
    throw new ErreurCreationSortie(400, 'Justificatif obligatoire.');
  }

  // --- Destination ----------------------------------------------------------
  const directionId = body.direction_id || body.direction || null;
  const serviceId = body.service_id || body.service || null;
  const beneficiaire = body.beneficiaire || '';
  if (!directionId && !serviceId && (!beneficiaire || String(beneficiaire).trim() === '')) {
    throw new ErreurCreationSortie(
      400,
      'Une destination est obligatoire : direction, service ou bénéficiaire.'
    );
  }

  // --- Résolution des fiches + stock + doublons ----------------------------
  const materiaux = [];
  const idsVus = new Set();
  for (const ligne of lignes) {
    const materiel = await resoudreMateriel(app, ligne);
    if (!materiel) {
      throw new ErreurCreationSortie(
        400,
        `Matériel introuvable pour la ligne « ${ligne.designation || ligne.materiel_id || ligne.materielId || ''} ».`
      );
    }
    const quantiteStock = Number(materiel.quantite_stock) || 0;
    const quantiteDemandee = Number(ligne.quantite) || 0;
    if (quantiteDemandee > quantiteStock) {
      throw new ErreurCreationSortie(
        400,
        `Stock insuffisant pour « ${materiel.designation || materiel.documentId} » : quantité demandée ${quantiteDemandee}, quantité disponible ${quantiteStock}.`
      );
    }
    if (idsVus.has(materiel.documentId)) {
      throw new ErreurCreationSortie(
        400,
        `Doublon de matériel : deux lignes ciblent le même matériel (« ${materiel.designation || materiel.documentId} »).`
      );
    }
    idsVus.add(materiel.documentId);
    materiaux.push(materiel);
  }

  // --- Valeur unitaire (le prix vient TOUJOURS de la fiche) ----------------
  for (const materiel of materiaux) {
    const valeurUnitaire = Number(materiel.valeur_unitaire) || 0;
    if (!valeurUnitaire || valeurUnitaire <= 0) {
      throw new ErreurCreationSortie(
        400,
        `Valeur unitaire manquante sur la fiche de ${materiel.designation || materiel.documentId}.`
      );
    }
  }

  // --- Demande liée : existence, statut, unicité ---------------------------
  const demandeId = body.demande_id || body.demande || null;
  if (demandeId) {
    let demande = null;
    try {
      demande = await app.documents('api::demande.demande').findOne({
        documentId: demandeId,
      });
    } catch (e) {
      demande = null;
    }
    if (!demande) {
      throw new ErreurCreationSortie(400, 'Demande introuvable.');
    }
    if (!STATUTS_DEMANDE_LIABLE.includes(demande.statut)) {
      throw new ErreurCreationSortie(
        400,
        `La demande doit avoir un statut « approuvee » ou « preparation » (actuel : ${demande.statut}).`
      );
    }
    // UNE DEMANDE, UN ORDRE : un second ordre pour la même demande est
    // refusé (409) — contrôle fait AVANT toute écriture.
    const ordresLies = await app.documents(SORTIE_UID).findMany({
      filters: { demande: { documentId: demandeId } },
      fields: ['documentId', 'reference'],
      limit: -1,
    });
    if (ordresLies && ordresLies.length > 0) {
      const reference = ordresLies[0].reference || '';
      throw new ErreurCreationSortie(
        409,
        reference
          ? `Un ordre de sortie existe déjà pour cette demande (${reference}) : une demande ne porte qu'un seul ordre.`
          : "Un ordre de sortie existe déjà pour cette demande : une demande ne porte qu'un seul ordre."
      );
    }
  }

  return {
    entete: {
      date_sortie: body.date_sortie,
      direction: directionId,
      service: serviceId,
      demande: demandeId,
      beneficiaire: beneficiaire || null,
      responsable: body.responsable || null,
      justificatif: String(justificatif).trim(),
      observations: body.observations || null,
    },
    lignes: lignes.map((ligne, index) => ({
      materiel: materiaux[index],
      quantite: Number(ligne.quantite),
      designation: ligne.designation || null,
      observations:
        typeof ligne.observations === 'string'
          ? ligne.observations.trim() || null
          : null,
    })),
  };
}

/** Génère la référence `SOR-AAAA-NNN` (jamais fournie par le client). */
async function genererReference(app, dateSortie) {
  const annee = new Date(dateSortie).getFullYear();
  const prefixe = `SOR-${annee}-`;
  let reference = `${prefixe}001`;
  for (let tentative = 0; tentative < 3; tentative += 1) {
    const existantes = await app.documents(SORTIE_UID).findMany({
      filters: { reference: { $startsWith: prefixe } },
      limit: -1,
    });
    const numeros = (existantes || [])
      .map((row) => Number((row.reference || '').slice(prefixe.length)))
      .filter((n) => Number.isFinite(n));
    const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
    reference = `${prefixe}${String(suivant).padStart(3, '0')}`;
    if (!(existantes || []).some((row) => row.reference === reference)) break;
  }
  return reference;
}

/**
 * Écrit l'ordre de sortie et ses lignes dans UNE SEULE transaction.
 * La sortie démarre TOUJOURS « en_preparation » : impossible de fabriquer un
 * ordre déjà signé ou déjà validé, et le stock n'est PAS touché à la création.
 */
async function creerSortieEtLignes(app, { entete, lignes }) {
  const reference = await genererReference(app, entete.date_sortie);
  let sortie = null;
  try {
    await app.db.transaction(async ({ trx }) => {
      sortie = await app.documents(SORTIE_UID).create({
        data: {
          reference,
          date_sortie: entete.date_sortie,
          statut: 'en_preparation',
          direction: entete.direction,
          service: entete.service,
          demande: entete.demande,
          beneficiaire: entete.beneficiaire,
          responsable: entete.responsable,
          justificatif: entete.justificatif,
          observations: entete.observations,
        },
      });
      for (const ligne of lignes) {
        const valeurUnitaire = Number(ligne.materiel.valeur_unitaire) || 0;
        await app.documents(SORTIE_LIGNE_UID).create({
          data: {
            sortie: sortie.documentId,
            materiel: ligne.materiel.documentId,
            designation: ligne.designation || null,
            quantite: ligne.quantite,
            valeur_unitaire: valeurUnitaire,
            montant: ligne.quantite * valeurUnitaire,
            observations: ligne.observations,
          },
        });
      }
    });
  } catch (e) {
    throw new ErreurCreationSortie(400, `Création impossible : ${e.message}`);
  }
  return sortie;
}

/**
 * Trace l'action dans la table `mouvements` (historique non modifiable).
 * Un échec de traçage n'annule JAMAIS l'action métier déjà effectuée.
 */
async function tracerMouvementSortie(
  app,
  sortie,
  action,
  statut,
  observations,
  utilisateur = ''
) {
  try {
    await app.documents(MOUVEMENT_UID).create({
      data: {
        reference: sortie.reference,
        type: 'sortie',
        date_mouvement: new Date().toISOString().slice(0, 10),
        utilisateur,
        action,
        materiel:
          (sortie.lignes || [])
            .map((l) => l.designation)
            .filter(Boolean)
            .join(', ') || '—',
        quantite: (sortie.lignes || []).reduce(
          (sum, l) => sum + (Number(l.quantite) || 0),
          0
        ),
        statut,
        sortie: sortie.documentId,
        observations,
      },
    });
  } catch (e) {
    app.log.warn(`[sortie] Historique non tracé : ${e.message}`);
  }
}

module.exports = {
  SORTIE_UID,
  SORTIE_LIGNE_UID,
  MATERIEL_UID,
  MOUVEMENT_UID,
  STATUTS_DEMANDE_LIABLE,
  ErreurCreationSortie,
  resoudreMateriel,
  preparerSortie,
  genererReference,
  creerSortieEtLignes,
  tracerMouvementSortie,
};
