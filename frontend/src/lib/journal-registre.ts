// Transformation pure des entrées/sorties Strapi en lignes du Journal Comptable.
// Ce module ne parle pas au réseau, ne touche pas au localStorage et ne modifie
// aucune donnée en base : il ne fait que projeter des EntreeRecord / SortieRecord
// en JournalEntry pour affichage dans Journal.tsx.

import {
  EntreeRecord,
  SortieRecord,
  EntreeLigne,
} from "./movements";
import type { JournalEntry, OrigineSortie, QualiteMateriel } from "../types/accounting";

// ---------------------------------------------------------------------------
// Type de l'écriture affichée dans le Journal
// ---------------------------------------------------------------------------

/** Une ligne affichée dans le Journal Comptable. Elle est construite à partir
 *  d'un EntreeRecord (ou d'un SortieRecord) et non persistée elle-même. */
export interface JournalLigne {
  /** Identifiant unique de la ligne interne au Journal (n'est pas le numéro
   *  d'ordre affiché : ce dernier est calculé). */
  id: string;
  /** Numéro d'ordre calculé à l'affichage (ex. "2026-0001"). */
  numeroOrdre: string;
  /** Référence ENT-AAAA-NNN ou équivalent de l'écriture source. */
  reference: string;
  /** Date de validation de l'écriture (3ᵉ signature ou date de sortie). */
  dateValidation: string;
  /** Nom du fournisseur ou de l'émetteur. */
  fournisseur: string;
  /** Pièce justificative principale (bon de livraison / facture / etc.). */
  pieceJustificative: string | null;
  /** Quantité totale de la ligne. */
  quantite: number;
  /** Désignation du matériel. */
  designation: string;
  /** Nomenclature du matériel. */
  numeroNomenclature: string;
  /** Prix unitaire (entrée) ou valeur unitaire (sortie). */
  prixUnitaire: number;
  /** Montant total de la ligne. */
  montant: number;
  /** Espèce / catégorie. */
  espece: string;
  /** Sens du mouvement : "Entrée" ou "Sortie". */
  sens: "Entrée" | "Sortie";
  /** État constaté du matériel (si disponible). */
  etatConstate?: QualiteMateriel["etat"] | null;
  /** Origine / type de mouvement. */
  origine: OrigineSortie["type"];
  /** Observations complémentaires. */
  observations?: string;
  /** Identifiant de l'écriture source (pour le détail). */
  sourceId: string;
}

// ---------------------------------------------------------------------------
// Transformation pure des entrées
// ---------------------------------------------------------------------------

/** Nombre de signatures obtenues sur une entrée. */
function signaturesObtenues(entree: EntreeRecord): number {
  let count = 0;
  if (entree.signatures?.depositaire) count += 1;
  if (entree.signatures?.chefService1) count += 1;
  if (entree.signatures?.chefService2) count += 1;
  return count;
}

/** Date de la 3ᵉ signature (dépositaire, chef de service 1, chef de service 2)
 *  selon la règle du registre : on prend la plus récente des dates de signature
 *  présentes. Si aucune signature n'est présente, on retombe sur la date
 *  d'entrée de l'écriture. */
function dateTroisiemeSignature(entree: EntreeRecord): string {
  const dates = [
    entree.signatures?.depositaire,
    entree.signatures?.chefService1,
    entree.signatures?.chefService2,
  ].filter((d): d is string => !!d);
  if (dates.length === 0) return entree.dateEntree;
  return dates.reduce((plusRecente, d) => (d > plusRecente ? d : plusRecente), dates[0]);
}

/** Référence d'une entrée pour le registre.
 *  Motivé par la règle "référence ENT-AAAA-NNN" : la référence affichée dans
 *  le registre est la référence de l'écriture source (ex. ENT-2026-0001). */
function referenceEntree(entree: EntreeRecord): string {
  return entree.reference || `ENT-${entree.id}`;
}

/** Pièce justificative principale d'une entrée.
 *  Règle : on privilégie le bon de livraison, sinon la facture, sinon la
 *  première pièce justificative disponible. Si rien n'est renseigné, on
 *  retourne null pour afficher le badge "Sans pièce justificative". */
function pieceJustificativeEntree(entree: EntreeRecord): string | null {
  const docs = entree.documents ?? [];
  const bonLivraison = docs.find(
    (d) =>
      d.type.toLowerCase().includes("bon de livraison") ||
      d.nom.toLowerCase().includes("bon de livraison")
  );
  if (bonLivraison) return bonLivraison.nom;

  const facture = docs.find(
    (d) =>
      d.type.toLowerCase().includes("facture") ||
      d.nom.toLowerCase().includes("facture")
  );
  if (facture) return facture.nom;

  const premierePiece = docs.find((d) => d.nom && d.nom !== "—");
  if (premierePiece) return premierePiece.nom;

  return null;
}

/** Désignation principale d'une entrée.
 *  Règle : si l'entrée a des lignes, on prend la désignation de la première
 *  ligne non vide ; sinon on utilise la désignation globale de l'écriture. */
function designationEntree(entree: EntreeRecord): string {
  const lignes = entree.lignes ?? [];
  const ligne = lignes.find(
    (l) => l.designation && l.designation !== "—"
  );
  if (ligne) return ligne.designation;
  return entree.materiel || "—";
}

/** Nomenclature principale d'une entrée.
 *  Règle : si l'entrée a des lignes, on prend la nomenclature de la première
 *  ligne non vide ; sinon on utilise la nomenclature globale (vide si aucune). */
function nomenclatureEntree(entree: EntreeRecord): string {
  const lignes = entree.lignes ?? [];
  const ligne = lignes.find(
    (l) => l.nomenclature && l.nomenclature !== ""
  );
  if (ligne) return ligne.nomenclature;
  return entree.admin?.numeroOrdreJournal || "";
}

/** État constaté d'une entrée.
 *  Règle : si l'entrée a des lignes avec un état constaté, on prend le premier
 *  État non null ; sinon on retourne null. */
function etatConstateEntree(entree: EntreeRecord): QualiteMateriel["etat"] | null {
  const lignes = entree.lignes ?? [];
  const ligne = lignes.find(
    (l) => l.etat && l.etat !== "neuf"
  );
  if (ligne) return ligne.etat;
  const premiereLigne = lignes.find((l) => l.etat);
  if (premiereLigne) return premiereLigne.etat;
  return null;
}

/** Type d'origine d'une entrée.
 *  Règle : on déduit le type depuis le fournisseur ou la mention dans
 *  l'administration. Si rien n'est renseigné, on utilise "fournisseur" par
 *  défaut. */
function origineEntree(entree: EntreeRecord): OrigineSortie["type"] {
  const fournisseur = entree.fournisseur.toLowerCase();
  if (fournisseur.includes("don") || fournisseur.includes("donation")) return "donation";
  if (fournisseur.includes("retour")) return "retour";
  if (fournisseur.includes("transfert")) return "transfert";
  return "fournisseur";
}

/** Construit les lignes du Journal à partir des lignes d'une entrée.
 *  Une entrée peut avoir plusieurs lignes matérielles ; on crée une ligne de
 *  journal par ligne d'entrée. */
function lignesJournalDepuisEntree(
  entree: EntreeRecord,
  numeroOrdre: string,
  dateValidation: string
): JournalLigne[] {
  const lignes = entree.lignes ?? [];
  if (lignes.length === 0) {
    // Si l'entrée n'a pas de lignes, on crée une ligne unique avec les données
    // globales de l'écriture.
    return [
      {
        id: `${entree.id}-1`,
        numeroOrdre,
        reference: referenceEntree(entree),
        dateValidation,
        fournisseur: entree.fournisseur || "—",
        pieceJustificative: pieceJustificativeEntree(entree),
        quantite: entree.quantite || 0,
        designation: designationEntree(entree),
        numeroNomenclature: nomenclatureEntree(entree),
        prixUnitaire: 0,
        montant: entree.total ?? entree.quantite * 0,
        espece: entree.categorie || "—",
        sens: "Entrée",
        etatConstate: etatConstateEntree(entree),
        origine: origineEntree(entree),
        observations: entree.admin?.observations || undefined,
        sourceId: entree.id,
      },
    ];
  }

  return lignes.map((ligne, index) => ({
    id: `${entree.id}-${index + 1}`,
    numeroOrdre,
    reference: referenceEntree(entree),
    dateValidation,
    fournisseur: entree.fournisseur || "—",
    pieceJustificative: ligne.pieceJustificative || pieceJustificativeEntree(entree),
    quantite: ligne.quantite || 0,
    designation: ligne.designation || "—",
    numeroNomenclature: ligne.nomenclature || "",
    prixUnitaire: ligne.prixUnitaire || 0,
    montant: ligne.montant || 0,
    espece: ligne.espece || entree.categorie || "—",
    sens: "Entrée",
    etatConstate: ligne.etat || null,
    origine: origineEntree(entree),
    observations: ligne.observation || undefined,
    sourceId: entree.id,
  }));
}

// ---------------------------------------------------------------------------
// Numérotation chronologique
// ---------------------------------------------------------------------------

/** Calcule le numéro d'ordre d'une entrée selon la règle du registre :
 *  numéro chronologique par année, basé sur la date de la 3ᵉ signature
 *  (dépositaire), puis la référence en cas d'égalité.
 *
 *  Cette fonction est pure et ne modifie pas l'écriture source. */
export function calculerNumeroOrdre(
  entree: EntreeRecord,
  dateValidation: string
): string {
  const annee = dateValidation.slice(0, 4);
  // Le numéro est calculé à l'affichage ; on utilise l'index de l'écriture
  // dans la liste triée pour déterminer le numéro. Cette fonction est appelée
  // après le tri, donc l'index reflète la position chronologique.
  return annee;
}

/** Attribue les numéros d'ordre aux lignes d'une entrée après tri.
 *  Cette fonction est appelée sur la liste triée des entrées validées,
 *  donc le numéro reflète la position chronologique dans le registre. */
export function assignerNumerosOrdre(
  lignes: JournalLigne[],
  index: number
): JournalLigne {
  const annee = lignes[index]?.dateValidation.slice(0, 4) || new Date().getFullYear().toString();
  const numero = String(index + 1).padStart(4, "0");
  return {
    ...lignes[index],
    numeroOrdre: `${annee}-${numero}`,
  } as JournalLigne;
}

// ---------------------------------------------------------------------------
// Transformation des entrées en lignes de journal
// ---------------------------------------------------------------------------

/** Transforme une entrée validée en lignes de journal.
 *  Une entrée peut donner plusieurs lignes si elle a plusieurs lignes matérielles. */
export function entreeVersLignesJournal(
  entree: EntreeRecord
): JournalLigne[] {
  const dateValidation = dateTroisiemeSignature(entree);
  const numeroOrdre = `${dateValidation.slice(0, 4)}`; // sera complété par assignerNumerosOrdre
  const lignes = lignesJournalDepuisEntree(entree, numeroOrdre, dateValidation);

  // Si l'entrée n'a pas de lignes, on utilise la désignation globale
  if (lignes.length === 1 && !entree.lignes?.length) {
    return lignes;
  }

  return lignes;
}

/** Date de validation d'une sortie pour le registre : c'est la 3ᵉ signature
 *  (chef logistique, horodatage ISO posé par le serveur) qui déclenche
 *  l'écriture au journal et le débit du stock — jamais la date de remise. */
function dateValidationSortie(sortie: SortieRecord): string {
  return (
    sortie.dateSignatureLogistique || sortie.dateRemise || sortie.dateSortie
  );
}

/** Valorisation d'une sortie : somme des lignes peuplées (montant serveur,
 *  sinon quantité × valeur unitaire). 0 quand les lignes ne sont pas
 *  chargées — le journal n'invente jamais de montant. */
function montantSortie(sortie: SortieRecord): number {
  return (sortie.lignes || []).reduce((total, ligne) => {
    const montantLigne =
      ligne.montant != null && ligne.montant !== 0
        ? Number(ligne.montant) || 0
        : (Number(ligne.quantite) || 0) * (Number(ligne.valeurUnitaire) || 0);
    return total + montantLigne;
  }, 0);
}

/** Transforme une sortie comptabilisée en ligne de journal.
 *  Déclenchée dès la validation du chef logistique (3ᵉ signature). */
export function sortieVersLigneJournal(
  sortie: SortieRecord
): JournalLigne {
  const quantite = sortie.quantite || 0;
  const montant = montantSortie(sortie);

  return {
    id: sortie.id,
    numeroOrdre: "", // sera complété par assignerNumerosOrdre
    reference: sortie.reference || `SORT-${sortie.id}`,
    dateValidation: dateValidationSortie(sortie),
    fournisseur: sortie.demandeur || sortie.beneficiaire || "—",
    pieceJustificative: sortie.justificatif && sortie.justificatif !== "—"
      ? sortie.justificatif
      : null,
    quantite,
    designation: sortie.materiel || "—",
    numeroNomenclature: "",
    prixUnitaire: 0,
    montant,
    espece: sortie.categorie || "—",
    sens: "Sortie",
    etatConstate: undefined,
    origine: "entreprise",
    observations: sortie.justificatif || undefined,
    sourceId: sortie.id,
  };
}

// ---------------------------------------------------------------------------
// Transformation principale
// ---------------------------------------------------------------------------

/** Transforme les entrées et sorties validées en lignes de journal.
 *
 *  Règle : seules les entrées au statut "Validée" (3 signatures) sont incluses.
 *  Les entrées en cours (en_attente, verifiee) ne sont pas incluses.
 *  Les sorties sont comptabilisées dès la validation du chef logistique
 *  (3ᵉ signature → statut "Validée"), et restent au registre après la remise
 *  ("Sortie effectuée").
 *
 *  Le tri est effectué par date de validation (plus récent d'abord) puis par
 *  référence en cas d'égalité.
 *
 *  Les numéros d'ordre sont attribués après le tri, selon la position
 *  chronologique dans le registre. */
export function transformerEntreesEnLignesJournal(
  entrees: EntreeRecord[]
): JournalLigne[] {
  // 1. Filtrer les entrées validées seulement
  const entreesValidees = entrees.filter((e) => e.statut === "Validée");

  // 2. Pour chaque entrée validée, créer les lignes de journal
  const toutesLesLignes: JournalLigne[] = [];
  for (const entree of entreesValidees) {
    const lignes = entreeVersLignesJournal(entree);
    toutesLesLignes.push(...lignes);
  }

  // 3. Trier par date de validation (plus récent d'abord), puis par référence
  toutesLesLignes.sort((a, b) => {
    const dateA = a.dateValidation;
    const dateB = b.dateValidation;
    if (dateA !== dateB) {
      return dateA > dateB ? -1 : 1;
    }
    // Égalité : trier par référence
    const refA = a.reference;
    const refB = b.reference;
    return refA.localeCompare(refB);
  });

  // 4. Attribuer les numéros d'ordre après tri
  return toutesLesLignes.map((ligne, index) => {
    const annee = ligne.dateValidation.slice(0, 4);
    const numero = String(index + 1).padStart(4, "0");
    return {
      ...ligne,
      numeroOrdre: `${annee}-${numero}`,
    };
  });
}

/** Transforme les sorties comptabilisées en lignes de journal.
 *  DÉCLENCHEMENT : la 3ᵉ signature du chef logistique (statut "Validée",
 *  stock déjà débité) suffit à inscrire la sortie au journal — la remise
 *  ("Sortie effectuée") la maintient au registre sans la dupliquer.
 *  Les sorties sont ajoutées après les entrées, triées par date de validation
 *  (plus récente d'abord). */
export function transformerSortiesEnLignesJournal(
  sorties: SortieRecord[]
): JournalLigne[] {
  // 1. Filtrer : validées par le chef logistique OU déjà remises.
  const sortiesEffectuees = sorties.filter(
    (s) => s.statut === "Validée" || s.statut === "Sortie effectuée"
  );

  // 2. Pour chaque sortie, créer une ligne de journal
  const lignes: JournalLigne[] = sortiesEffectuees.map((sortie) =>
    sortieVersLigneJournal(sortie)
  );

  // 3. Trier par date de sortie (plus récente d'abord), puis par référence
  lignes.sort((a, b) => {
    const dateA = a.dateValidation;
    const dateB = b.dateValidation;
    if (dateA !== dateB) {
      return dateA > dateB ? -1 : 1;
    }
    const refA = a.reference;
    const refB = b.reference;
    return refA.localeCompare(refB);
  });

  // 4. Attribuer les numéros d'ordre après tri
  return lignes.map((ligne, index) => {
    const annee = ligne.dateValidation.slice(0, 4);
    const numero = String(index + 1).padStart(4, "0");
    return {
      ...ligne,
      numeroOrdre: `${annee}-${numero}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Combinaison entrées + sorties
// ---------------------------------------------------------------------------

/** Combine les lignes d'entrées et de sorties en un seul registre.
 *  Les entrées sont listées en premier, triées par date de validation,
 *  followed by les sorties, triées par date de sortie.
 *
 *  Les numéros d'ordre sont attribués séparément pour chaque groupe. */
export function creerRegistreComptable(
  entrees: EntreeRecord[],
  sorties: SortieRecord[]
): JournalLigne[] {
  const lignesEntrees = transformerEntreesEnLignesJournal(entrees);
  const lignesSorties = transformerSortiesEnLignesJournal(sorties);

  // Combiner les deux groupes
  const toutesLesLignes = [...lignesEntrees, ...lignesSorties];

  // Trier l'ensemble par date (plus récent d'abord), puis par référence
  toutesLesLignes.sort((a, b) => {
    const dateA = a.dateValidation;
    const dateB = b.dateValidation;
    if (dateA !== dateB) {
      return dateA > dateB ? -1 : 1;
    }
    const refA = a.reference;
    const refB = b.reference;
    return refA.localeCompare(refB);
  });

  // Attribuer les numéros d'ordre après tri global
  return toutesLesLignes.map((ligne, index) => {
    const annee = ligne.dateValidation.slice(0, 4);
    const numero = String(index + 1).padStart(4, "0");
    return {
      ...ligne,
      numeroOrdre: `${annee}-${numero}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Statistiques du registre
// ---------------------------------------------------------------------------

/** Calcule les statistiques du registre à partir des lignes de journal.
 *  Ces statistiques ne prennent en compte que les écritures validées
 *  (entrées validées + sorties validées par le chef logistique). */
export function statistiquesRegistre(lignes: JournalLigne[]): {
  totalEntrees: number;
  totalSorties: number;
  totalValeurEntrees: number;
  totalValeurSorties: number;
  nombreEntrees: number;
  nombreSorties: number;
} {
  const entrees = lignes.filter((l) => l.sens === "Entrée");
  const sorties = lignes.filter((l) => l.sens === "Sortie");

  return {
    totalEntrees: entrees.length,
    totalSorties: sorties.length,
    totalValeurEntrees: entrees.reduce((sum, l) => sum + l.montant, 0),
    totalValeurSorties: sorties.reduce((sum, l) => sum + l.montant, 0),
    nombreEntrees: entrees.length,
    nombreSorties: sorties.length,
  };
}

// ---------------------------------------------------------------------------
// Filtrage et recherche
// ---------------------------------------------------------------------------

/** Filtre les lignes de journal selon les critères de recherche.
 *  Cette fonction est pure et ne modifie pas les lignes source. */
export function filtrerLignesJournal(
  lignes: JournalLigne[],
  criteres: {
    searchTerm?: string;
    dateDebut?: string;
    dateFin?: string;
    origine?: string;
    sens?: "Entrée" | "Sortie" | "tout";
  } = {}
): JournalLigne[] {
  const {
    searchTerm,
    dateDebut,
    dateFin,
    origine,
    sens,
  } = criteres;

  return lignes.filter((ligne) => {
    // Recherche textuelle
    if (searchTerm) {
      const terme = searchTerm.toLowerCase();
      const match =
        ligne.numeroOrdre.toLowerCase().includes(terme) ||
        ligne.designation.toLowerCase().includes(terme) ||
        ligne.pieceJustificative?.toLowerCase().includes(terme) ||
        ligne.fournisseur.toLowerCase().includes(terme) ||
        ligne.numeroNomenclature.toLowerCase().includes(terme) ||
        ligne.reference.toLowerCase().includes(terme);
      if (!match) return false;
    }

    // Filtre par date de début
    if (dateDebut && ligne.dateValidation < dateDebut) return false;

    // Filtre par date de fin
    if (dateFin && ligne.dateValidation > dateFin) return false;

    // Filtre par origine
    if (origine && ligne.origine !== origine) return false;

    // Filtre par sens
    if (sens && sens !== "tout" && ligne.sens !== sens) return false;

    return true;
  });
}

/** Trie les lignes de journal selon les options d'affichage.
 *  Cette fonction est pure et ne modifie pas les lignes source. */
export function trierLignesJournal(
  lignes: JournalLigne[],
  options: {
    trierPar: "date" | "numeroOrdre" | "valeur" | "designation";
    ordreTri: "asc" | "desc";
  } = { trierPar: "date", ordreTri: "desc" }
): JournalLigne[] {
  const { trierPar, ordreTri } = options;

  const lignesTriees = [...lignes].sort((a, b) => {
    let valeurA: any;
    let valeurB: any;

    switch (trierPar) {
      case "date":
        valeurA = a.dateValidation;
        valeurB = b.dateValidation;
        break;
      case "numeroOrdre":
        valeurA = a.numeroOrdre;
        valeurB = b.numeroOrdre;
        break;
      case "valeur":
        valeurA = a.montant;
        valeurB = b.montant;
        break;
      case "designation":
        valeurA = a.designation.toLowerCase();
        valeurB = b.designation.toLowerCase();
        break;
      default:
        valeurA = a.numeroOrdre;
        valeurB = b.numeroOrdre;
    }

    if (ordreTri === "asc") {
      return valeurA < valeurB ? -1 : valeurA > valeurB ? 1 : 0;
    } else {
      return valeurA > valeurB ? -1 : valeurA < valeurB ? 1 : 0;
    }
  });

  return lignesTriees;
}
