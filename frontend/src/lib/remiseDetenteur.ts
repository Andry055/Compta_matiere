/**
 * Remise du matériel au détenteur — règles métier PURES + persistance locale.
 * ---------------------------------------------------------------------------
 * Rappel du circuit :
 *
 *   Sortie validée (stock débité)  →  Remise au magasinier  →  Sortie effectuée
 *        →  RÉCEPTION PHYSIQUE par la direction destinataire
 *        →  REMISE AU DÉTENTEUR (ce module) : la direction désigne, pour
 *           chaque matériel reçu, la personne qui en devient responsable.
 *
 * Deux invariants structurent ce module :
 *
 *  1. LE STOCK N'EST JAMAIS TOUCHÉ. Il a été débité une seule fois, à la
 *     validation logistique. Aucun enregistrement produit par ce module ne
 *     contient de quantité de stock, de statut de stock ni d'opération
 *     d'inventaire : la remise ne fait qu'attribuer une responsabilité.
 *
 *  2. UNE SEULE REMISE PAR DOSSIER. La remise est un acte de garde : une
 *     fois enregistrée, elle est clôturée. On ne peut ni la rejouer, ni
 *     déduire le stock une seconde fois.
 *
 * Aucune API backend n'existe à ce jour pour cet acte (le dossier de sortie
 * porte un seul `detenteur_nom` global, et l'endpoint de remise exige la
 * sortie en statut « validée », avant la réception physique). Les remises
 * sont donc conservées LOCALEMENT, dans le navigateur — l'interface le
 * signale explicitement à l'utilisateur (« mode simulation »).
 */

import type { SortieRecord } from "./movements";
import type { ReceptionPhysiqueRecord } from "./api";
import { dateDuJourLocal } from "./remiseSortie";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Un matériel du dossier, prêt à être remis à un détenteur nommé. */
export interface MaterielRemis {
  /** Identifiant de la ligne de sortie (ou identifiant de synthèse). */
  ligneId: string;
  designation: string;
  /**
   * Quantité reçue lors de la réception physique.
   * `null` quand elle n'est pas déterminable (réception agrégée sur un
   * dossier multi-matériaux) : l'interface affiche alors « — » plutôt
   * qu'un chiffre faux.
   */
  quantiteRecue: number | null;
  /** État constaté (neuf | bon | moyen | defaillant), si connu. */
  etat: string | null;
  /** Nom du détenteur — OBLIGATOIRE. */
  detenteurNom: string;
  /** Observation facultative propre au matériel. */
  observation: string;
}

/** Une remise enregistrée (simulation locale). */
export interface RemiseDetenteurRecord {
  id: string;
  /** Dossier de sortie concerné. */
  sortieId: string;
  reference: string;
  direction: string;
  /** Date de la réception physique (ISO). */
  dateReception: string;
  /** Demandeur connecté au moment de la remise. */
  demandeur: string;
  /** Date de la remise (YYYY-MM-DD, heure locale). */
  dateRemise: string;
  materiels: MaterielRemis[];
  /** Attestation de remise physique effective : toujours `true` (obligatoire). */
  attestation: true;
  dateEnregistrement: string;
}

/* ------------------------------------------------------------------ */
/* Validation du nom du détenteur                                      */
/* ------------------------------------------------------------------ */

/** Longueur maximale retenue côté serveur pour un nom de détenteur. */
export const LONGUEUR_MAX_DETENTEUR = 150;

/**
 * Caractères admis dans un nom de personne : lettres (accentuées ou non),
 * espaces, apostrophes droites ou typographiques, tirets et points (les
 * initiales « R. Rakoto » ou « Jean-Pierre »).
 */
const CARACTERES_DETENTEUR = /^[A-Za-zÀ-ÖØ-öø-ÿ'’\-. ]+$/u;

export interface ValidationDetenteur {
  ok: boolean;
  message?: string;
}

/** Un nom de détenteur est-il valide ? */
export function validerNomDetenteur(nom: string): ValidationDetenteur {
  const valeur = (nom ?? "").trim();

  if (!valeur) {
    return { ok: false, message: "Le nom du détenteur est obligatoire." };
  }
  if (valeur.length < 2) {
    return {
      ok: false,
      message: "Le nom du détenteur doit comporter au moins 2 caractères.",
    };
  }
  if (valeur.length > LONGUEUR_MAX_DETENTEUR) {
    return {
      ok: false,
      message: `Le nom du détenteur est limité à ${LONGUEUR_MAX_DETENTEUR} caractères.`,
    };
  }
  if (!CARACTERES_DETENTEUR.test(valeur)) {
    return {
      ok: false,
      message:
        "Le nom du détenteur ne peut contenir que des lettres, espaces, apostrophes, tirets ou points.",
    };
  }
  return { ok: true };
}

/** Tous les matériels ont-ils un détenteur valide ? */
export function validerDetenteurs(
  materiels: Array<Pick<MaterielRemis, "designation" | "detenteurNom">>
): ValidationDetenteur {
  for (const materiel of materiels) {
    const verdict = validerNomDetenteur(materiel.detenteurNom);
    if (!verdict.ok) {
      return {
        ok: false,
        message: `« ${materiel.designation} » : ${verdict.message}`,
      };
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Réception physique                                                  */
/* ------------------------------------------------------------------ */

/** Les réceptions physiques connues pour un dossier de sortie. */
export function receptionsDuDossier(
  sortieId: string,
  receptionsServeur: ReceptionPhysiqueRecord[] = []
): ReceptionPhysiqueRecord[] {
  return (receptionsServeur ?? []).filter(
    (reception) => reception?.sortieId === sortieId
  );
}

/**
 * La réception physique de ce dossier est-elle CONFIRMÉE ?
 *
 * Une réception est confirmée dès qu'un enregistrement serveur existe pour
 * ce dossier avec une quantité reçue strictement positive. Une réception
 * partielle reste une réception confirmée : le dossier peut être remis pour
 * la part effectivement reçue.
 */
export function receptionConfirmee(
  sortieId: string,
  receptionsServeur: ReceptionPhysiqueRecord[] = []
): boolean {
  return receptionsDuDossier(sortieId, receptionsServeur).some(
    (reception) => Number(reception.quantite_recue) > 0
  );
}

/** Total réceptionné pour un dossier. */
export function totalRecu(
  sortieId: string,
  receptionsServeur: ReceptionPhysiqueRecord[] = []
): number {
  return receptionsDuDossier(sortieId, receptionsServeur).reduce(
    (total, reception) => total + (Number(reception.quantite_recue) || 0),
    0
  );
}

/** Date de la réception physique la plus récente (ISO), ou `null`. */
export function dateReceptionRecente(
  sortieId: string,
  receptionsServeur: ReceptionPhysiqueRecord[] = []
): string | null {
  const dates = receptionsDuDossier(sortieId, receptionsServeur)
    .map((reception) => reception.date_reception)
    .filter((date): date is string => Boolean(date))
    .sort();
  return dates.length ? dates[dates.length - 1] : null;
}

/* ------------------------------------------------------------------ */
/* Matériels du dossier                                                */
/* ------------------------------------------------------------------ */

/**
 * Quantité reçue imputée à une ligne du dossier.
 *
 * La réception physique est enregistrée de façon AGRÉGÉE (une quantité
 * pour le dossier), et non ligne par ligne. L'imputation suit donc la règle
 * suivante, qui ne laisse jamais passer un chiffre faux :
 *
 *  - dossier à un seul matériel : le total réceptionné lui revient
 *    intégralement ;
 *  - dossier multi-matériaux : le total n'est pas ventilable, on affiche la
 *    quantité de la ligne si la réception est complète, sinon `null` (« — ») ;
 *  - aucune réception : `null`.
 */
export function quantiteRecueParLigne(
  sortie: SortieRecord,
  receptionsServeur: ReceptionPhysiqueRecord[] = []
): number | null {
  const recu = totalRecu(sortie.id, receptionsServeur);
  if (recu <= 0) return null;

  const lignes = sortie.lignes ?? [];
  if (lignes.length === 0) return recu;
  if (lignes.length === 1) return recu;

  const prevu = lignes.reduce((total, ligne) => total + (Number(ligne.quantite) || 0), 0);
  return recu >= prevu ? prevu : null;
}

/**
 * Les matériels du dossier, prêts à être confiés à un détenteur.
 *
 * Les quantités et les états repris ici sont en LECTURE SEULE : le
 * formulaire ne permet jamais de les modifier.
 */
export function materielsDuDossier(
  sortie: SortieRecord,
  receptionsServeur: ReceptionPhysiqueRecord[] = []
): MaterielRemis[] {
  const lignes = sortie.lignes ?? [];

  if (lignes.length === 0) {
    // Dossier sans ligne exploitée : on synthétise une entrée à partir de
    // l'en-tête de la sortie, pour ne jamais présenter un registre vide.
    return [
      {
        ligneId: sortie.id,
        designation: sortie.materiel || "Matériel",
        quantiteRecue: totalRecu(sortie.id, receptionsServeur) || null,
        etat: null,
        detenteurNom: "",
        observation: "",
      },
    ];
  }

  return lignes.map((ligne, index) => ({
    ligneId: ligne.documentId || `${sortie.id}-${index}`,
    designation: ligne.designation,
    quantiteRecue: quantiteRecueParLigne(sortie, receptionsServeur),
    etat: ligne.etat ?? null,
    detenteurNom: "",
    observation: "",
  }));
}

/* ------------------------------------------------------------------ */
/* Persistance locale (simulation)                                     */
/* ------------------------------------------------------------------ */

const CLE_STOCKAGE = "comptamatiere_remise_detenteur_v1";

/** Lit les remises enregistrées dans le navigateur. */
export function listerRemises(): RemiseDetenteurRecord[] {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    const parses = brut ? JSON.parse(brut) : [];
    return Array.isArray(parses) ? (parses as RemiseDetenteurRecord[]) : [];
  } catch {
    return [];
  }
}

function persister(remises: RemiseDetenteurRecord[]): void {
  try {
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(remises));
  } catch {
    /* mode privé / quota : la remise reste en mémoire pour la session */
  }
}

/** La remise de ce dossier est-elle déjà clôturée ? */
export function estDejaRemise(sortieId: string): boolean {
  return listerRemises().some((remise) => remise.sortieId === sortieId);
}

/** La remise enregistrée pour ce dossier, si elle existe. */
export function remisePourSortie(
  sortieId: string
): RemiseDetenteurRecord | null {
  return listerRemises().find((remise) => remise.sortieId === sortieId) ?? null;
}

export type ResultatEnregistrement =
  | { ok: true; record: RemiseDetenteurRecord }
  | { ok: false; message: string };

/**
 * Enregistre la remise — en SIMULATION, uniquement dans le navigateur.
 *
 * Refuse une seconde remise pour le même dossier : l'acte de garde est
 * irréversible dans l'application, exactement comme une remise de sortie.
 * L'enregistrement ne contient AUCUN champ de stock : cette fonction ne
 * déduit jamais de quantité (le stock a déjà été débité à la validation).
 */
export function enregistrerRemise(
  entree: Omit<
    RemiseDetenteurRecord,
    "id" | "dateEnregistrement" | "dateRemise" | "attestation"
  >
): ResultatEnregistrement {
  if (estDejaRemise(entree.sortieId)) {
    return {
      ok: false,
      message: "La remise de ce dossier est déjà enregistrée.",
    };
  }

  const verdictDetenteurs = validerDetenteurs(entree.materiels);
  if (!verdictDetenteurs.ok) {
    return { ok: false, message: verdictDetenteurs.message ?? "Détenteur invalide." };
  }

  const maintenant = new Date();
  const record: RemiseDetenteurRecord = {
    id: `RMD-${maintenant.getTime()}-${entree.sortieId}`,
    sortieId: entree.sortieId,
    reference: entree.reference,
    direction: entree.direction,
    dateReception: entree.dateReception,
    demandeur: entree.demandeur,
    dateRemise: dateDuJourLocal(maintenant),
    materiels: entree.materiels.map((materiel) => ({
      ...materiel,
      detenteurNom: materiel.detenteurNom.trim(),
      observation: (materiel.observation ?? "").trim(),
    })),
    attestation: true,
    dateEnregistrement: maintenant.toISOString(),
  };

  persister([record, ...listerRemises()]);
  return { ok: true, record };
}

/** Vide la simulation (réinitialisation de l'outil de démonstration). */
export function viderRemises(): void {
  try {
    localStorage.removeItem(CLE_STOCKAGE);
  } catch {
    /* rien à faire */
  }
}
