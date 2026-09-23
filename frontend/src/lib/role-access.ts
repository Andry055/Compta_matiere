// Contrôle d'accès par rôle pour le flux de réception matériel (4 étapes).
//
// Répartition des responsabilités :
//   Étape 1 — Dépositaire comptable : bon de livraison + articles.
//   Étape 2 — Magasinier : BL/articles en lecture seule, il vérifie lui-même
//             l'état et la conformité puis certifie la réception physique.
//   Étape 3 — Dépositaire comptable : enregistrement au journal.
//   Étape 4 — PV de réception (document final, aucun rôle éditeur).
//
// Mécanisme aligné sur celui des signatures de sortie (DistributionRequests :
// égalité stricte entre le rôle du titulaire de session et le rôle requis),
// mais appliqué AU NIVEAU LOGIQUE : les champs sont désactivés dans l'UI ET
// toute mise à jour d'état sur un champ protégé est refusée côté gestionnaire
// (impossible de contourner via les DevTools).

import { AppRole, ROLES_CONFIG } from "../types/roles";
import { ReceptionData } from "../types/accounting";

/** Rôle requis pour agir sur chaque étape du flux de réception.
 *  L'étape 4 (PV) est consultable par tous. */
export const STEP_ROLE_REQUIREMENTS: Record<number, AppRole> = {
  1: "depositaire",
  2: "magasinier",
  3: "depositaire",
};

/** Champs de ReceptionData dont l'écriture est réservée au rôle propriétaire de l'étape.
 *  Le magasinier édite UNIQUEMENT les contrôles (état/conformité) et sa
 *  certification à l'étape 2 ; BL et articles restent la propriété du
 *  dépositaire (étapes 1 et 3). */
const PROTECTED_FIELDS: Partial<Record<keyof ReceptionData, number>> = {
  fournisseur: 1,
  numeroBL: 1,
  dateBL: 1,
  articles: 1,
  observationsBL: 1,
  controles: 2,
  magasinierCertifie: 2,
  depositaireCertifie: 3,
  journalEntryId: 3,
  dateEnregistrement: 3,
};

/** Message affiché (toast) lorsqu'une action est tentée par le mauvais rôle. */
export const DENIED_ACTION_MESSAGE =
  "Seul le titulaire de ce rôle peut valider cette étape.";

/** Clé de persistance de la réception en cours (localStorage). Permet au
 *  magasinier de retrouver, dans sa session, la liste enregistrée par le
 *  dépositaire — comme un transfert entre deux postes. */
export const RECEPTION_STORAGE_KEY = "receptionEnCours";

export interface ReceptionUpdateGuard {
  allowed: boolean;
  deniedStep?: number;
  requiredRole?: AppRole;
}

/** Rôle actif de la session simulée : reprend le rôle métier de l'utilisateur
 *  connecté s'il en a un, sinon Magasinier par défaut. */
export function resolveActiveRole(
  userRole: string | null | undefined
): AppRole {
  if (userRole && userRole in ROLES_CONFIG) {
    return userRole as AppRole;
  }
  return "magasinier";
}

/** Un rôle ne peut agir sur une étape que s'il correspond exactement au rôle
 *  requis (même règle que canSign dans DistributionRequests). */
export function canPerformStepAction(
  activeRole: AppRole,
  step: number
): boolean {
  const requiredRole = STEP_ROLE_REQUIREMENTS[step];
  if (!requiredRole) return true;
  return activeRole === requiredRole;
}

/**
 * Verrou logique appliqué AVANT toute mise à jour de ReceptionData : refuse le
 * lot de modifications si au moins un champ appartient à une étape verrouillée
 * pour le rôle actif. L'état n'est alors jamais modifié, même si un composant
 * est manipulé programmatiquement via les DevTools.
 */
export function guardReceptionUpdate(
  partial: Partial<ReceptionData>,
  activeRole: AppRole
): ReceptionUpdateGuard {
  for (const key of Object.keys(partial) as (keyof ReceptionData)[]) {
    const step = PROTECTED_FIELDS[key];
    if (step !== undefined && !canPerformStepAction(activeRole, step)) {
      return {
        allowed: false,
        deniedStep: step,
        requiredRole: STEP_ROLE_REQUIREMENTS[step],
      };
    }
  }
  return { allowed: true };
}

/**
 * Charge la réception en cours persistée par le dépositaire (localStorage).
 * Retourne null si absente, illisible ou dans une forme obsolète (ancien
 * schéma) — l'appelant repart alors d'un état vierge.
 */
export function loadPersistedReception(): ReceptionData | null {
  try {
    const raw = localStorage.getItem(RECEPTION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ReceptionData;
    // Garde de forme : champs obligatoires du schéma actuel.
    const validShape =
      Array.isArray(data.articles) &&
      Array.isArray(data.controles) &&
      typeof data.journalEntryId === "string" &&
      typeof data.magasinierCertifie === "boolean" &&
      typeof data.depositaireCertifie === "boolean";
    return validShape ? data : null;
  } catch {
    return null;
  }
}

/**
 * Persiste la réception en cours. Appelé à chaque étape franchie (fin d'étape 1
 * côté dépositaire, confirmation / écart côté magasinier) pour simuler la
 * transmission entre les deux rôles.
 */
export function persistReception(data: ReceptionData): void {
  try {
    localStorage.setItem(RECEPTION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota indisponible ou navigation privée : le flux reste fonctionnel en
    // mémoire pour la session en cours, on ignore silencieusement.
  }
}

/** Nom affiché pour le titulaire du rôle : l'utilisateur réellement connecté si
 *  son rôle correspond, sinon le titulaire attitré du rôle (ROLES_CONFIG). */
export function getSessionUserName(
  activeRole: AppRole,
  user: { name: string; role: string | null } | null
): string {
  if (user && user.role === activeRole) {
    return user.name;
  }
  return ROLES_CONFIG[activeRole].defaultEmployeeName;
}
