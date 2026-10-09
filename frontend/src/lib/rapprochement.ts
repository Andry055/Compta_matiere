// Rapprochement de désignation → fiche matériel (saisie d'une entrée).
//
// Point de l'audit : la correspondance se faisait par ÉGALITÉ EXACTE de texte
// uniquement. La moindre variation (« Routeur Cisco RV 340 » vs « Routeur
// Cisco RV340 », « Ordinateur portable Dell » vs « …Dell Latitude ») créait une
// ligne orpheline en désignation libre, invisible dans la Fiche de stock.
//
// Ici : comparaison APPROXIMATIVE CLASSIQUE (normalisation + distance de
// Levenshtein + recouvrement des mots) — AUCUNE détection par IA ni embeddings.
//
// Ce module ne fait que PROPOSER : la décision reste toujours humaine
// (l'écran affiche la suggestion, l'utilisateur confirme ou déclare un nouvel
// article). Rien n'est jamais lié automatiquement.

import type { MaterialOption } from "./api";

/** Seuil de ressemblance retenu (1 - distance / longueur max). */
export const SEUIL_RESSEMBLANCE = 0.7;

/** Nombre maximal de correspondances proposées pour une même désignation. */
export const NOMBRE_CANDIDATS_MAX = 3;

/** Désignation trop courte pour raisonner (« PC », « chaise »…) : aucune
 *  proposition — on n'affiche jamais de rapprochement sur 2 lettres. */
export const LONGUEUR_MINIMALE = 3;

/**
 * Clé de comparaison : insensible à la casse, aux accents et aux espaces
 * multiples (« Routeur Cisco RV 340 » ≈ « routeur  cisco rv340 »).
 */
export function normaliserDesignation(valeur: string | null | undefined): string {
  return String(valeur ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Distance d'édition de Levenshtein (nombre minimal d'insertions /
 * suppressions / substitutions). Implémentation classique deux lignes —
 * suffisante pour des désignations de quelques dizaines de caractères.
 */
export function distanceLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let precedente = new Array(b.length + 1);
  let courante = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) precedente[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    courante[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      courante[j] = Math.min(
        precedente[j] + 1, // suppression
        courante[j - 1] + 1, // insertion
        precedente[j - 1] + cout // substitution
      );
    }
    const swap = precedente;
    precedente = courante;
    courante = swap;
  }
  return precedente[b.length];
}

/** Ressemblance normalisée : 1 = identique, 0 = sans aucun rapport. */
export function ressemblance(a: string, b: string): number {
  const ga = normaliserDesignation(a);
  const gb = normaliserDesignation(b);
  if (!ga && !gb) return 1;
  const longueurMax = Math.max(ga.length, gb.length);
  if (longueurMax === 0) return 1;
  return 1 - distanceLevenshtein(ga, gb) / longueurMax;
}

/** Tous les mots de la désignation la plus COURTE se retrouvent-ils dans la
 *  plus longue ? (« Ordinateur portable Dell » ⊂ « Ordinateur portable Dell
 *  Latitude »). Les variantes de formulation allongées sont ainsi repérées,
 *  là où la distance seule resterait sous le seuil. Reciproque fausse : les
 *  mots doivent être au moins 2 et la forme courte ≥ 4 caractères, sinon
 *  « PC » se rapprocherait de n'importe quoi. */
export function motsCommuns(
  designation: string,
  candidat: string
): boolean {
  const a = normaliserDesignation(designation);
  const b = normaliserDesignation(candidat);
  if (a.length < 4 || b.length < 4) return false;
  const petit = a.length <= b.length ? a : b;
  const grand = a.length <= b.length ? b : a;
  const motsPetit = petit.split(" ").filter(Boolean);
  if (motsPetit.length < 2) return false;
  const motsGrand = new Set(grand.split(" ").filter(Boolean));
  return motsPetit.every((mot) => motsGrand.has(mot));
}

export type RaisonRapprochement = "texte_proche" | "mots_communs";

export interface CandidatRapprochement {
  materiel: MaterialOption;
  /** Distance d'édition après normalisation (0 = texte identique). */
  distance: number;
  /** 1 - distance / longueur max — critère de tri. */
  ressemblance: number;
  raison: RaisonRapprochement;
}

/**
 * Propose les matériels existants qui RESSEMBLENT à `designation`.
 * Retourne une liste TRIÉE (meilleur candidat d'abord), limitée à
 * `NOMBRE_CANDIDATS_MAX`. Une liste vide signifie « aucune correspondance
 * proche » — l'utilisateur pourra alors créer un nouvel article, jamais la
 * suggestion n'est appliquée à sa place.
 */
export function trouverRapprochements(
  designation: string | null | undefined,
  materiels: MaterialOption[],
  options?: { seuil?: number; maximum?: number }
): CandidatRapprochement[] {
  const cle = normaliserDesignation(designation);
  if (cle.length < LONGUEUR_MINIMALE || !Array.isArray(materiels)) return [];

  const seuil = options?.seuil ?? SEUIL_RESSEMBLANCE;
  const maximum = options?.maximum ?? NOMBRE_CANDIDATS_MAX;

  const candidats: CandidatRapprochement[] = [];
  for (const materiel of materiels) {
    const autre = normaliserDesignation(materiel?.designation);
    if (autre.length < 1) continue;

    const distance = distanceLevenshtein(cle, autre);
    const score = ressemblance(cle, autre);
    let raison: RaisonRapprochement | null = null;
    if (score >= seuil || distance === 0) raison = "texte_proche";
    else if (motsCommuns(cle, autre)) raison = "mots_communs";
    if (!raison) continue;

    candidats.push({ materiel, distance, ressemblance: score, raison });
  }

  return candidats
    .sort(
      (x, y) =>
        y.ressemblance - x.ressemblance ||
        x.distance - y.distance ||
        String(x.materiel.designation).localeCompare(
          String(y.materiel.designation)
        )
    )
    .slice(0, maximum);
}
