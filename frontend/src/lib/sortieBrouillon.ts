/**
 * Fonctions pures et testables pour la gestion du brouillon de sortie
 * dans l'onglet Distribution (rôle dépositaire).
 */

import type { MaterialOption } from "./api";
import type { NouvelleSortiePayload } from "./api";

/**
 * Valide le brouillon de sortie selon les règles métier :
 * - pièce justificative non vide
 * - au moins une destination (direction, service et/ou bénéficiaire)
 * - au moins une ligne
 * - quantité entière ≥ 1 et ≤ stock disponible pour chaque ligne
 * - matériel résolu sur une FICHE de stock existante (le serveur refuse toute
 *   désignation inconnue : une ligne « texte libre » finirait en 400)
 * - fiche pourvue d'une valeur unitaire > 0 (sinon aucun montant n'est
 *   calculable : le serveur répond 400 « Valeur unitaire manquante sur la
 *   fiche de X » — cinq fiches sur quinze sont concernées aujourd'hui)
 * - pas de doublon de matériel (même materiel_id ou même designation)
 */
export function validerSortieBrouillon(
  justificatif: string,
  directionId: string | undefined,
  serviceId: string | undefined,
  beneficiaire: string,
  lignes: Array<{
    materielId?: string;
    designation?: string;
    quantite: number;
    materiel?: MaterialOption; // Optionnel, fourni si disponible
  }>,
  stockDisponible: Record<string, number> // materielId → quantite disponible
): { estValide: boolean; erreurs: string[] } {
  const erreurs: string[] = [];

  // 1. Pièce justificative non vide
  if (!justificatif || justificatif.trim() === "") {
    erreurs.push("Pièce justificative obligatoire.");
  }

  // 2. Au moins une destination
  const hasDirection = !!directionId && directionId.trim() !== "";
  const hasService = !!serviceId && serviceId.trim() !== "";
  const hasBeneficiaire = !!beneficiaire && beneficiaire.trim() !== "";

  if (!(hasDirection || hasService || hasBeneficiaire)) {
    erreurs.push("Une destination est obligatoire : direction, service ou bénéficiaire.");
  }

  // 3. Au moins une ligne
  if (lignes.length === 0) {
    erreurs.push("Au moins un matériel est requis.");
  } else {
    // 4. Validation de chaque ligne
    const matièresVues = new Set<string>();

    for (const [index, ligne] of lignes.entries()) {
      const ligneNum = index + 1;

      // Quantité : entier ≥ 1
      if (!Number.isInteger(ligne.quantite) || ligne.quantite < 1) {
        erreurs.push(`Ligne ${ligneNum} : quantité invalide (doit être un entier ≥ 1).`);
        continue; // Passe à la ligne suivante pour d'autres validations
      }

      // Détermination du materiel_id effectif. Une simple designation ne suffit
      // PAS : le serveur ne sait résoudre qu'une fiche existante (recherche
      // exacte) — une designation libre est refusée en 400 à la création.
      const materielIdEffectif = ligne.materielId || ligne.materiel?.documentId || null;

      if (!materielIdEffectif) {
        erreurs.push(
          `Ligne ${ligneNum} : matériel introuvable dans le stock — choisissez une fiche existante (« ${ligne.designation || ''} » ne correspond à aucun matériel).`
        );
        continue;
      }

      // Prix de la fiche : sans valeur unitaire > 0, aucun montant n'est
      // calculable — le serveur refuse aussi (400 « Valeur unitaire manquante
      // sur la fiche de X »). Signalé ICI, avant l'envoi, plutôt qu'un échec
      // réseau opaque dont la raison n'apparaît que dans le toast.
      if (ligne.materiel && !(Number(ligne.materiel.valeurUnitaire) > 0)) {
        erreurs.push(
          `Ligne ${ligneNum} : « ${ligne.materiel.designation} » n'a pas de valeur unitaire — complétez le prix de la fiche avant de créer l'ordre.`
        );
      }

      // Vérification du stock (si materiel connu et stock disponible)
      if (ligne.materiel && ligne.materiel.documentId) {
        const materielId = ligne.materiel.documentId;
        const stockDisponibleMateriel = stockDisponible[materielId] ?? 0;

        if (ligne.quantite > stockDisponibleMateriel) {
          erreurs.push(
            `Ligne ${ligneNum} : stock insuffisant pour « ${ligne.materiel.designation} » : ` +
            `demandé ${ligne.quantite}, disponible ${stockDisponibleMateriel}.`
          );
        }
      }

      // 5. Pas de doublon de matériel
      if (matièresVues.has(materielIdEffectif)) {
        erreurs.push(
          `Ligne ${ligneNum} : doublon de matériel - ce matériel est déjà présent dans une ligne précédente.`
        );
      } else {
        matièresVues.add(materielIdEffectif);
      }
    }
  }

  return {
    estValide: erreurs.length === 0,
    erreurs,
  };
}

/**
 * Calcule le total estimé d'une sortie (à titre indicatif).
 * Le serveur est l'autorité pour le prix et le montant final.
 */
export function calculerTotalEstime(
  lignes: Array<{
    quantite: number;
    materiel?: MaterialOption; // Optionnel, fourni si disponible
  }>
): number {
  return lignes.reduce((total, ligne) => {
    const prixUnitaire = ligne.materiel?.valeurUnitaire ?? 0;
    return total + (ligne.quantite * prixUnitaire);
  }, 0);
}

// ---------------------------------------------------------------------------
// Lien « Demande liée » (champ texte du formulaire)
// ---------------------------------------------------------------------------

/** Fiche de demande rattachable à un ordre de sortie (champs utiles au lien). */
export interface DemandeLiablee {
  /** documentId Strapi : C'EST ce que le serveur attend dans `demande_id`. */
  documentId: string;
  /** Référence officielle affichée à l'utilisateur (ex. DEM-2026-014). */
  reference: string;
  /** Statut serveur brut (enum api::demande.demande). */
  statut: string;
}

export type ResolutionDemande =
  | { ok: true; documentId: string }
  | { ok: false; message: string };

/** Les seuls statuts que createComplete accepte pour un lien. */
export const STATUTS_LIAISON_DEMANDE = ["approuvee", "preparation"];

/**
 * Apparie la saisie « Demande liée » (texte libre : référence OU documentId)
 * à une demande réellement rattachable, en reproduisant les contrôles du
 * serveur : demande existante + statut approuvee/preparation.
 *
 * Sans cela, TOUTE saisie provoquait un 400 « Demande introuvable. » dont la
 * raison n'apparaît pas dans la console (aucune demande en base au départ,
 * et le formulaire envoyait le TEXTE TAPÉ, jamais un documentId).
 */
export function apparierDemande(
  tape: string,
  demandes: DemandeLiablee[]
): ResolutionDemande {
  const saisie = tape.trim();

  if (demandes.length === 0) {
    return {
      ok: false,
      message:
        "Aucune demande en base : laissez le champ « Demande liée » vide (toute saisie serait refusée à la création).",
    };
  }

  const cherche = saisie.toLowerCase();
  const trouvee = demandes.find(
    (demande) =>
      demande.documentId.toLowerCase() === cherche ||
      demande.reference.toLowerCase() === cherche
  );

  if (!trouvee) {
    return {
      ok: false,
      message: `Aucune demande ne correspond à « ${saisie} » (${demandes.length} demande(s) disponible(s)) : vérifiez la référence (ex. DEM-2026-014) ou laissez le champ vide.`,
    };
  }

  if (!STATUTS_LIAISON_DEMANDE.includes(trouvee.statut)) {
    return {
      ok: false,
      message: `La demande ${trouvee.reference || trouvee.documentId} a le statut « ${trouvee.statut} » : seules les demandes « approuvee » ou « preparation » peuvent être liées à un ordre de sortie.`,
    };
  }

  return { ok: true, documentId: trouvee.documentId };
}

/**
 * Construit le payload à envoyer au serveur à partir du brouillon.
 * Conforme exactement à ce que le serveur attend dans POST /api/sorties/create-complete.
 */
export function construirePayloadSortie(
  dateSortie: string,
  justificatif: string,
  directionId: string | undefined,
  serviceId: string | undefined,
  beneficiaire: string,
  demandeId: string | undefined,
  lignes: Array<{
    materielId?: string;
    designation?: string;
    quantite: number;
    observations?: string;
  }>
): NouvelleSortiePayload {
  // Nettoyage des valeurs vides
  const justificatifNettoye = justificatif.trim();
  const beneficiaireNettoye = beneficiaire.trim() || undefined;
  const demandeIdNettoye = demandeId?.trim() || undefined;

  // Construction des lignes (en s'assurant que designation est présent si materiel_id absent)
  const lignesNettoyees = lignes.map(ligne => ({
    // Champ nommé EXACTEMENT comme l'attend le serveur (materiel_id) :
    // materielId serait ignoré et la ligne retomberait sur une résolution par
    // texte, impossible si la saisie est une recherche partielle.
    materiel_id: ligne.materielId?.trim() || undefined,
    designation: ligne.designation?.trim() || undefined,
    quantite: ligne.quantite,
    observations: ligne.observations?.trim() || undefined,
  }));

  const payload: NouvelleSortiePayload = {
    date_sortie: dateSortie,
    justificatif: justificatifNettoye,
    direction_id: directionId?.trim() || undefined,
    service_id: serviceId?.trim() || undefined,
    beneficiaire: beneficiaireNettoye,
    lignes: lignesNettoyees,
  };

  // La clé demande_id n'est JAMAIS présente dans le payload si le champ est vide
  // (ni undefined, ni null, ni chaîne vide).
  if (demandeIdNettoye) {
    payload.demande_id = demandeIdNettoye;
  }

  return payload;
}
