// Contrôle d'accès par rôle pour le flux de réception matériel (4 étapes).
//
// Répartition des responsabilités :
//   Étape 1 — Dépositaire comptable : bon de livraison + articles.
//   Étape 2 — Magasinier : BL/articles en lecture seule, il vérifie lui-même
//             l'état et la conformité puis certifie la réception physique.
//   Étape 3 — Logistique : 2ᵉ signature du circuit (chef_service_2).
//   Étape 4 — PV de réception + certification et signature FINALE du
//             dépositaire comptable (seul rôle éditeur de cette étape).
//
// Mécanisme aligné sur celui des signatures de sortie (DistributionRequests :
// égalité stricte entre le rôle du titulaire de session et le rôle requis),
// mais appliqué AU NIVEAU LOGIQUE : les champs sont désactivés dans l'UI ET
// toute mise à jour d'état sur un champ protégé est refusée côté gestionnaire
// (impossible de contourner via les DevTools).

import { AppRole, ROLES_CONFIG } from "../types/roles";
import { ReceptionData } from "../types/accounting";

/** Rôle requis pour agir sur chaque étape du flux de réception.
 *  L'étape 4 est CONSULTABLE par tous, mais la case de certification qui
 *  autorise la signature finale n'est éditable que par le dépositaire.
 *  Étape 3 : la signature serveur posée est chef_service_2 (logistique) —
 *  l'ordre réel est magasinier → logistique → dépositaire (décision figée).
 *  Le libellé affiché de l'étape reste inchangé (dette UX notée). */
export const STEP_ROLE_REQUIREMENTS: Record<number, AppRole> = {
  1: "depositaire",
  2: "magasinier",
  3: "logistique",
  4: "depositaire",
};

/** Champs de ReceptionData dont l'écriture est réservée au rôle propriétaire de l'étape.
 *  Le magasinier édite UNIQUEMENT les contrôles (état/conformité) et sa
 *  certification à l'étape 2 ; BL et articles restent la propriété du
 *  dépositaire (étape 1).
 *  `depositaireCertifie` appartient à l'ÉTAPE 4 : c'est là que le dépositaire
 *  coche la case qui autorise sa signature finale (canProceed, étape 4). Tant
 *  qu'elle était rattachée à l'étape 3 (réservée à la logistique), le guard
 *  refusait la coche au dépositaire — même depuis l'étape 4 — et le bouton
 *  « Signer la validation finale » restait bloqué. */
const PROTECTED_FIELDS: Partial<Record<keyof ReceptionData, number>> = {
  fournisseur: 1,
  numeroBL: 1,
  dateBL: 1,
  articles: 1,
  observationsBL: 1,
  controles: 2,
  magasinierCertifie: 2,
  depositaireCertifie: 4,
  journalEntryId: 3,
  dateEnregistrement: 3,
};

/** Message affiché (toast) lorsqu'une action est tentée par le mauvais rôle. */
export const DENIED_ACTION_MESSAGE =
  "Seul le titulaire de ce rôle peut valider cette étape.";

// [Supprimé — Étape 6] RECEPTION_STORAGE_KEY, loadPersistedReception et
// persistReception : la réception vit désormais en BASE (circuit entree) et
// l'état de l'écran est relu depuis fetchEntrees() — le localStorage n'est
// plus une source de données du flux (aucun consommateur restant).

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
