'use strict';

/**
 * Calculs des rapports annuels de reddition de compte des matières.
 *
 * Module PUR : aucune dépendance à Strapi — reçoit des tableaux de lignes
 * déjà extraits de la base. Toute la logique est testable unitairement
 * (tests/reddition.test.js) sans démarrer l'application.
 *
 * Conventions de statuts (cohérentes avec les content-types) :
 *   - entrée comptabilisée  : entree.statut === 'validee'
 *   - sortie comptabilisée  : sortie.statut === 'sortie_effectuee'
 *   - une année couvre le 1er janvier 00:00 au 31 décembre 23:59 (UTC+3 :
 *     les dates sont stockées en `date` ISO ; on compare par préfixe AAAA).
 *
 * Toutes les valeurs sont des montants en Ariary (décimaux Strapi) ; les
 * documents officiels les arrondissent à l'entier à l'affichage uniquement
 * (cf. frontend/src/lib/nombreEnLettres.ts).
 */

const STATUT_ENTREE_VALIDE = 'validee';
const STATUT_SORTIE_EFFECTUEE = 'sortie_effectuee';

/**
 * Normalise une ligne de mouvement vers la forme utilisée par les calculs.
 * `nomenclature` peut venir de la ligne ou du matériel rattaché.
 */
function normaliserLigne(ligne, sens) {
  const materiel = (ligne && ligne.materiel) || {};
  return {
    id: ligne.id,
    documentId: ligne.documentId,
    sens, // 'entree' | 'sortie'
    date: (ligne.entree && ligne.entree.date_entree) || (ligne.sortie && ligne.sortie.date_sortie) || ligne.date || null,
    reference: (ligne.entree && ligne.entree.reference) || (ligne.sortie && ligne.sortie.reference) || ligne.reference || null,
    statut: (ligne.entree && ligne.entree.statut) || (ligne.sortie && ligne.sortie.statut) || null,
    quantite: Number(ligne.quantite) || 0,
    montant: Number(ligne.montant) || 0,
    valeurUnitaire: Number(ligne.valeur_unitaire) || 0,
    designation: ligne.designation || materiel.designation || null,
    nomenclature: ligne.nomenclature || materiel.nomenclature || null,
    materielId: (materiel && (materiel.documentId || materiel.id)) || null,
    pieceJustificative: ligne.piece_justificative || (ligne.entree && ligne.entree.numero_facture) || null,
    numeroFacture: (ligne.entree && ligne.entree.numero_facture) || null,
    numeroOrdre: ligne.numero_ordre || null,
  };
}

/** Année d'une date ISO (préfixe) : '2017-06-05' -> 2017. */
function anneeDe(dateIso) {
  if (!dateIso || typeof dateIso !== 'string') return null;
  const m = dateIso.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * Regroupe des lignes par nomenclature et somme quantités et montants.
 * Retourne une Map « nomenclature -> { quantite, montant, lignes } ».
 */
function sommerParNomenclature(lignes) {
  const acc = new Map();
  for (const l of lignes) {
    const cle = l.nomenclature || '—';
    if (!acc.has(cle)) {
      acc.set(cle, { quantite: 0, montant: 0, lignes: [] });
    }
    const g = acc.get(cle);
    g.quantite += l.quantite;
    g.montant += l.montant;
    g.lignes.push(l);
  }
  return acc;
}

/**
 * Filtre les lignes comptabilisables d'une année pour un sens donné.
 * Une ligne est comptabilisée si :
 *   - sa date est dans l'année,
 *   - le document parent (entrée/sortie) a le statut final requis.
 */
function lignesDeLAnnee(lignes, annee, sens) {
  const statutRequis = sens === 'entree' ? STATUT_ENTREE_VALIDE : STATUT_SORTIE_EFFECTUEE;
  return lignes.filter(
    (l) => anneeDe(l.date) === annee && l.statut === statutRequis
  );
}

/**
 * RÉCAPITULATION ANNUELLE
 *
 * Une ligne par nomenclature (triée) puis une ligne TOTAUX :
 *   Existant au 1er janvier | Entrées | Total | Sorties | Reste au 31 déc.
 *
 * `ouvertures` : [{ annee, nomenclature, montant_existant }] — le stock
 * d'ouverture de l'année demandée sert de point de départ. S'il est absent,
 * on retombe sur le reste de l'année précédente lorsqu'il est fourni par
 * l'appelant (voir calculerRecapitulationMultiAnnee).
 */
function calculerRecapitulation({ annee, entrees, sorties, ouvertures = [] }) {
  const entreesAnnee = lignesDeLAnnee(entrees, annee, 'entree');
  const sortiesAnnee = lignesDeLAnnee(sorties, annee, 'sortie');

  const parEntrees = sommerParNomenclature(entreesAnnee);
  const parSorties = sommerParNomenclature(sortiesAnnee);

  // Nomenclatures présentes dans l'un des trois jeux de données
  const cles = new Set();
  for (const k of parEntrees.keys()) cles.add(k);
  for (const k of parSorties.keys()) cles.add(k);
  for (const o of ouvertures) {
    if (o.annee === annee) cles.add(o.nomenclature || '—');
  }

  const ouvertureParNom = new Map(
    ouvertures
      .filter((o) => o.annee === annee)
      .map((o) => [o.nomenclature || '—', Number(o.montant_existant) || 0])
  );

  const lignes = Array.from(cles)
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }))
    .map((nom) => {
      const existant = ouvertureParNom.get(nom) || 0;
      const entreesMontant = parEntrees.get(nom)?.montant || 0;
      const total = existant + entreesMontant;
      const sortiesMontant = parSorties.get(nom)?.montant || 0;
      const reste = total - sortiesMontant;
      return {
        nomenclature: nom,
        existant,
        entrees: entreesMontant,
        total,
        sorties: sortiesMontant,
        reste,
        // Quantités (utiles pour l'inventaire et le grand-livre)
        quantiteEntree: parEntrees.get(nom)?.quantite || 0,
        quantiteSortie: parSorties.get(nom)?.quantite || 0,
      };
    });

  const totaux = lignes.reduce(
    (t, l) => ({
      existant: t.existant + l.existant,
      entrees: t.entrees + l.entrees,
      total: t.total + l.total,
      sorties: t.sorties + l.sorties,
      reste: t.reste + l.reste,
    }),
    { existant: 0, entrees: 0, total: 0, sorties: 0, reste: 0 }
  );

  return { annee, lignes, totaux };
}

/**
 * Enchaîne les exercices : le reste de l'année N devient l'existant de N+1
 * (report automatique quand aucune ouverture manuelle ne le définit).
 *
 * `ouvertures` peut contenir des lignes pour n'importe quelle année ; le
 * report ne s'applique qu'aux années sans ouverture explicite.
 */
function calculerRecapitulationsChainees({ anneeDebut, anneeFin, entrees, sorties, ouvertures = [] }) {
  const resultats = [];
  let report = null; // reste de l'année précédente (par nomenclature)

  for (let annee = anneeDebut; annee <= anneeFin; annee++) {
    const ouverturesAnnee = ouvertures.filter((o) => o.annee === annee);
    let existants = {};

    if (ouverturesAnnee.length > 0) {
      for (const o of ouverturesAnnee) {
        existants[o.nomenclature || '—'] = Number(o.montant_existant) || 0;
      }
    } else if (report) {
      existants = { ...report };
    }

    // Injecte les existants comme « ouvertures » virtuelles de l'année
    const ouverturesVirtuelles = Object.entries(existants).map(
      ([nomenclature, montant_existant]) => ({ annee, nomenclature, montant_existant })
    );

    const recap = calculerRecapitulation({ annee, entrees, sorties, ouvertures: ouverturesVirtuelles });
    resultats.push(recap);

    // Report : reste par nomenclature (clés union de l'existant et du calcul)
    const reste = {};
    for (const l of recap.lignes) reste[l.nomenclature] = l.reste;
    for (const [nom, montant] of Object.entries(existants)) {
      if (!(nom in reste)) reste[nom] = montant; // nomenclature sans mouvement
    }
    report = reste;
  }

  return resultats;
}

/**
 * ÉTAT APPRÉCIATIF — mouvements de l'année avec pièces justificatives.
 * Le nombre de pièces = nombre de factures / ordres d'entrée de l'année
 * (une entrée validée = une pièce, identifiée par sa référence).
 */
function calculerEtatAppreciatif({ annee, entrees, sorties }) {
  const entreesAnnee = lignesDeLAnnee(entrees, annee, 'entree');
  const sortiesAnnee = lignesDeLAnnee(sorties, annee, 'sortie');

  // Déduplique les pièces par référence d'entrée
  const pieces = new Set(
    entreesAnnee
      .map((l) => l.reference)
      .filter(Boolean)
  );

  const mouvementsEntree = Object.values(
    entreesAnnee.reduce((acc, l) => {
      const cle = l.reference || `ligne-${l.id}`;
      if (!acc[cle]) {
        acc[cle] = {
          reference: l.reference,
          date: l.date,
          lignes: [],
          montant: 0,
        };
      }
      acc[cle].lignes.push(l);
      acc[cle].montant += l.montant;
      return acc;
    }, {})
  );

  const mouvementsSortie = Object.values(
    sortiesAnnee.reduce((acc, l) => {
      const cle = l.reference || `ligne-${l.id}`;
      if (!acc[cle]) {
        acc[cle] = {
          reference: l.reference,
          date: l.date,
          lignes: [],
          montant: 0,
        };
      }
      acc[cle].lignes.push(l);
      acc[cle].montant += l.montant;
      return acc;
    }, {})
  );

  return {
    annee,
    mouvementsEntree,
    mouvementsSortie,
    nombrePieces: pieces.size,
    totalEntrees: mouvementsEntree.reduce((t, m) => t + m.montant, 0),
    totalSorties: mouvementsSortie.reduce((t, m) => t + m.montant, 0),
  };
}

/**
 * INVENTAIRE ANNUEL PAR NOMENCLATURE — détail par article.
 * `materiaux` : [{ documentId, designation, nomenclature, valeur_unitaire, unite }]
 * Les quantités existant/entrées/sorties/reste sont sommées par matériel.
 */
function calculerInventaire({ annee, entrees, sorties, materiaux = [], ouvertures = [] }) {
  const entreesAnnee = lignesDeLAnnee(entrees, annee, 'entree');
  const sortiesAnnee = lignesDeLAnnee(sorties, annee, 'sortie');

  const parMateriel = new Map();

  function assurer(materielId, designation, nomenclature, valeurUnitaire, unite) {
    if (!parMateriel.has(materielId)) {
      parMateriel.set(materielId, {
        materielId,
        designation: designation || '—',
        nomenclature: nomenclature || '—',
        valeurUnitaire: Number(valeurUnitaire) || 0,
        unite: unite || 'N',
        entreesQ: 0,
        sortiesQ: 0,
      });
    }
    return parMateriel.get(materielId);
  }

  // Matériaux référencés dans la base (même sans mouvement, ils existent)
  for (const m of materiaux) {
    assurer(m.documentId || m.id, m.designation, m.nomenclature, m.valeur_unitaire, m.unite);
  }
  for (const l of entreesAnnee) {
    const m = assurer(l.materielId, l.designation, l.nomenclature, l.valeurUnitaire, null);
    m.entreesQ += l.quantite;
  }
  for (const l of sortiesAnnee) {
    const m = assurer(l.materielId, l.designation, l.nomenclature, l.valeurUnitaire, null);
    m.sortiesQ += l.quantite;
  }

  // Existant au 1er janvier : montant d'ouverture ventilé par matériel
  // au prorata des entrées cumulées ? Non — l'ouverture est déclarée par
  // nomenclature ; en quantités, l'existant initial par article est la
  // quantité en stock reportée. On part de zéro par article et l'ouverture
  // en valeur est répartie par nomenclature au prorata de la valeur des
  // entrées ; sans entrée, la nomenclature garde son existant global.
  const ouverturesAnnee = ouvertures.filter((o) => o.annee === annee);
  const ouvertureParNom = new Map(
    ouverturesAnnee.map((o) => [o.nomenclature || '—', Number(o.montant_existant) || 0])
  );

  // Valeur des entrées par nomenclature (pour le prorata)
  const valeurEntreeParNom = new Map();
  for (const m of parMateriel.values()) {
    const v = m.entreesQ * m.valeurUnitaire;
    valeurEntreeParNom.set(
      m.nomenclature,
      (valeurEntreeParNom.get(m.nomenclature) || 0) + v
    );
  }

  const articles = Array.from(parMateriel.values()).map((m) => {
    const existantQ = 0; // stock physique initial par article non historisé
    const resteQ = existantQ + m.entreesQ - m.sortiesQ;
    const valeurEntrees = m.entreesQ * m.valeurUnitaire;

    // Existant en valeur : part de l'ouverture de la nomenclature
    const ouvertureNom = ouvertureParNom.get(m.nomenclature) || 0;
    const valeurEntreesNom = valeurEntreeParNom.get(m.nomenclature) || 0;
    let existantV = 0;
    if (ouvertureNom > 0 && valeurEntreesNom > 0) {
      existantV = (ouvertureNom * valeurEntrees) / valeurEntreesNom;
    } else if (ouvertureNom > 0 && valeurEntreesNom === 0) {
      // Aucune entrée dans la nomenclature : tout l'existant reste global
      existantV = 0; // ventilé seulement si un seul article
    }

    const totalV = existantV + valeurEntrees;
    const sortiesV = m.sortiesQ * m.valeurUnitaire;
    const resteV = totalV - sortiesV;

    return {
      materielId: m.materielId,
      designation: m.designation,
      nomenclature: m.nomenclature,
      unite: m.unite,
      prixUnitaire: m.valeurUnitaire,
      quantites: {
        existant: existantQ,
        entrees: m.entreesQ,
        sorties: m.sortiesQ,
        reste: resteQ,
      },
      valeurs: {
        existant: existantV,
        entrees: valeurEntrees,
        total: totalV,
        sorties: sortiesV,
        reste: resteV,
      },
    };
  });

  // Nomenclature à article unique avec ouverture sans entrée : existant
  // attribué à cet article.
  for (const nom of ouvertureParNom.keys()) {
    const articlesNom = articles.filter((a) => a.nomenclature === nom);
    const ouvertureNom = ouvertureParNom.get(nom) || 0;
    if (articlesNom.length === 1 && ouvertureNom > 0) {
      const a = articlesNom[0];
      if (a.valeurs.entrees === 0 && a.valeurs.existant === 0) {
        a.valeurs.existant = ouvertureNom;
        a.valeurs.total = ouvertureNom;
        a.valeurs.reste = ouvertureNom - a.valeurs.sorties;
      }
    }
  }

  // Groupe par nomenclature (triée)
  const parNomenclature = new Map();
  for (const a of articles.sort((x, y) => x.designation.localeCompare(y.designation, 'fr'))) {
    if (!parNomenclature.has(a.nomenclature)) parNomenclature.set(a.nomenclature, []);
    parNomenclature.get(a.nomenclature).push(a);
  }

  return {
    annee,
    sections: Array.from(parNomenclature.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }))
      .map(([nomenclature, articlesNom]) => ({
        nomenclature,
        articles: articlesNom,
        totaux: articlesNom.reduce(
          (t, a) => ({
            quantites: {
              existant: t.quantites.existant + a.quantites.existant,
              entrees: t.quantites.entrees + a.quantites.entrees,
              sorties: t.quantites.sorties + a.quantites.sorties,
              reste: t.quantites.reste + a.quantites.reste,
            },
            valeurs: {
              existant: t.valeurs.existant + a.valeurs.existant,
              entrees: t.valeurs.entrees + a.valeurs.entrees,
              total: t.valeurs.total + a.valeurs.total,
              sorties: t.valeurs.sorties + a.valeurs.sorties,
              reste: t.valeurs.reste + a.valeurs.reste,
            },
          }),
          {
            quantites: { existant: 0, entrees: 0, sorties: 0, reste: 0 },
            valeurs: { existant: 0, entrees: 0, total: 0, sorties: 0, reste: 0 },
          }
        ),
      })),
  };
}

/**
 * FICHE DE STOCK / GRAND-LIVRE d'un matériel — chronologie des mouvements
 * avec quantité cumulée (tri par date puis référence).
 *
 * `materiel` (optionnel) est l'en-tête de la fiche : identité + photo de
 * référence (champ media `photos` de material) renvoyée telle quelle — ce
 * module reste PUR, aucune lecture de base ici. Absent : `materiel: null`
 * (un matériel sans photo s'affiche normalement).
 */
function calculerGrandLivre({ materielId, entrees, sorties, annee = null, materiel = null }) {
  const lignes = [];

  for (const l of entrees) {
    if (l.statut !== STATUT_ENTREE_VALIDE) continue;
    if (l.materielId !== materielId) continue;
    if (annee && anneeDe(l.date) !== annee) continue;
    lignes.push({
      date: l.date,
      reference: l.reference,
      sens: 'entree',
      quantiteEntree: l.quantite,
      quantiteSortie: 0,
      montant: l.montant,
      pieceJustificative: l.pieceJustificative || l.numeroFacture,
    });
  }
  for (const l of sorties) {
    if (l.statut !== STATUT_SORTIE_EFFECTUEE) continue;
    if (l.materielId !== materielId) continue;
    if (annee && anneeDe(l.date) !== annee) continue;
    lignes.push({
      date: l.date,
      reference: l.reference,
      sens: 'sortie',
      quantiteEntree: 0,
      quantiteSortie: l.quantite,
      montant: l.montant,
      pieceJustificative: l.pieceJustificative,
    });
  }

  lignes.sort(
    (a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.reference).localeCompare(String(b.reference))
  );

  let cumul = 0;
  const mouvements = lignes.map((l) => {
    cumul += l.quantiteEntree - l.quantiteSortie;
    return { ...l, quantiteCumulee: cumul };
  });

  return {
    materielId,
    // En-tête de la fiche : désignation / nomenclature / photo de référence.
    materiel: materiel || null,
    annee,
    mouvements,
    totalEntreesQ: mouvements.reduce((t, m) => t + m.quantiteEntree, 0),
    totalSortiesQ: mouvements.reduce((t, m) => t + m.quantiteSortie, 0),
    quantiteFinale: cumul,
  };
}

/**
 * BORDEREAU D'ENVOI — compte les pièces du dossier de reddition.
 * Le nombre d'ordres d'entrée et de factures se calcule depuis la base
 * (une entrée validée = un ordre d'entrée = une facture rattachée).
 */
function calculerBordereau({ annees, entrees }) {
  const parAnnee = annees.map((annee) => {
    const entreesAnnee = lignesDeLAnnee(entrees, annee, 'entree');
    const ordres = new Set(
      entreesAnnee.map((l) => l.reference).filter(Boolean)
    );
    const factures = new Set(
      entreesAnnee
        .map((l) => l.numeroFacture || l.reference)
        .filter(Boolean)
    );
    return { annee, ordresEntree: ordres.size, factures: factures.size };
  });

  return {
    parAnnee,
    totalOrdres: parAnnee.reduce((t, a) => t + a.ordresEntree, 0),
    totalFactures: parAnnee.reduce((t, a) => t + a.factures, 0),
  };
}

module.exports = {
  STATUT_ENTREE_VALIDE,
  STATUT_SORTIE_EFFECTUEE,
  normaliserLigne,
  anneeDe,
  lignesDeLAnnee,
  sommerParNomenclature,
  calculerRecapitulation,
  calculerRecapitulationsChainees,
  calculerEtatAppreciatif,
  calculerInventaire,
  calculerGrandLivre,
  calculerBordereau,
};
