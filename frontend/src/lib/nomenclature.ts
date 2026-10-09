// Liste de référence des CODES DE NOMENCLATURE du MTEFoP.
//
// Les classeurs historiques (2017-2020) rangent les matières sous trois codes
// numériques précis. Le champ `nomenclature` (material et entree-ligne) était
// jusqu'ici un texte libre : toute reformulation créait une ligne fantôme dans
// la reddition de compte (récapitulation / inventaire groupés PAR nomenclature).
//
// Cette liste est volontairement EN DUR dans le code (pas de content-type
// Strapi) : trois valeurs stables, lues par la saisie (liste déroulante) et par
// les documents officiels. Les valeurs texte libre déjà en base ne sont PAS
// rétro-modifiées : seules les NOUVELLES saisies passent par cette liste.

export interface CodeNomenclature {
  /** Code à 2 chiffres — valeur réellement persistée. */
  code: string;
  /** Libellé historique de la classe. */
  libelle: string;
}

/** Les 3 codes de référence, dans l'ordre historique. */
export const NOMENCLATURES: CodeNomenclature[] = [
  { code: "03", libelle: "Mobilier" },
  { code: "05", libelle: "Matériel, véhicules et informatique" },
  { code: "10", libelle: "Matériel fixe" },
];

/** Libellé complet affiché dans les listes : « 05 — Matériel, véhicules… ». */
export function libelleNomenclature(code: string | null | undefined): string {
  if (!code) return "";
  const trouve = NOMENCLATURES.find((n) => n.code === code);
  return trouve ? `${trouve.code} — ${trouve.libelle}` : code;
}

/** La valeur est-elle un des 3 codes de référence ? */
export function estCodeNomenclature(
  code: string | null | undefined
): boolean {
  return !!code && NOMENCLATURES.some((n) => n.code === code);
}
