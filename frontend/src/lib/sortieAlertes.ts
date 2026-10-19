// Alertes « nouvel ordre à préparer » de la cloche du magasinier.
//
// Décision de principe (phase 2 — preuves) : les alertes ne sont NI persistées
// (pas de localStorage, cf. pushNotification) NI envoyées au premier
// chargement. Elles sont DÉRIVÉES des données serveur, recalculées à chaque
// relevé, donc :
//   - aucun alerte au premier chargement ni après un rechargement : les ordres
//     déjà connus deviennent la ligne de base ;
//   - une alerte par ordre réellement NOUVEAU ;
//   - une SEULE alerte groupée quand plusieurs ordres arrivent ensemble ;
//   - l'alerte disparaît dès que l'ordre est signé (il quitte la sélection
//     serveur, donc l'alerte n'a plus aucun membre visible).
//
// Ce module est PUR : mêmes entrées, mêmes sorties, aucune écriture.

import type { SortieRecord } from "./api";
import { estAPreparerPourMagasinier } from "./sortieControle";

/** Une alerte = un GROUPE d'ordres découverts en même temps. */
export interface AlerteSorties {
  /** Identifiants des ordres découverts ensemble. */
  ids: string[];
  /** Références des ordres encore éligibles (celles affichées). */
  references: string[];
  /** ISO, date de découverte du groupe. */
  date: string;
}

export interface EtatAlertesSorties {
  /** Tous les identifiants jamais vus comme éligibles (cumul, mémoire vive). */
  connus: Set<string>;
  /** Groupes découverts, du plus ancien au plus récent. */
  groupes: AlerteSorties[];
  /** false tant que le PREMIER relevé n'a pas servi de ligne de base. */
  initialise: boolean;
}

export function etatAlertesInitial(): EtatAlertesSorties {
  return { connus: new Set(), groupes: [], initialise: false };
}

/**
 * Recalcule l'état des alertes à partir d'un relevé serveur.
 *
 * - Premier appel (aucun ordre connu) : les ordres présents deviennent la
 *   ligne de base, AUCUNE alerte n'est produite.
 * - Appels suivants : les ordres éligibles inconnus forment UN groupe.
 * - Une alerte n'est conservée que si au moins un de ses ordres est encore
 *   éligible : signée => l'alerte disparaît.
 */
export function recalculerAlertes(
  etat: EtatAlertesSorties,
  sorties: SortieRecord[],
  /** Règle d'éligibilité du rôle : signature 1 absente (magasinier, par défaut)
   *  ou signatures 1 et 2 posées (chef logistique → « nouvel ordre à
   *  autoriser »). Étend le mécanisme sans changer son comportement par défaut. */
  eligibilite: (sortie: SortieRecord) => boolean = estAPreparerPourMagasinier
): EtatAlertesSorties {
  const eligibles = sorties.filter(eligibilite);
  const parId = new Map(eligibles.map((s) => [s.id, s.reference]));
  const idsActuels = new Set(parId.keys());

  // Premier relevé : tout ce qui existe DÉJÀ devient la ligne de base. Sans
  // ce réglage, chaque ordre déjà en attente serait traité comme « nouveau »
  // au premier chargement (et après chaque rechargement de page).
  if (!etat.initialise) {
    return { connus: new Set(idsActuels), groupes: [], initialise: true };
  }

  const nouveaux = [...idsActuels].filter((id) => !etat.connus.has(id));
  const references = nouveaux.map((id) => parId.get(id)!);

  const groupes =
    nouveaux.length > 0
      ? [
          ...etat.groupes,
          { ids: nouveaux, references, date: new Date().toISOString() },
        ]
      : etat.groupes;

  const visibles = groupes
    .map((groupe) => {
      const ids = groupe.ids.filter((id) => idsActuels.has(id));
      return {
        ...groupe,
        ids,
        references: ids.map((id) => parId.get(id)!),
      };
    })
    .filter((groupe) => groupe.ids.length > 0);

  return {
    connus: new Set([...etat.connus, ...idsActuels]),
    groupes: visibles,
    initialise: true,
  };
}

/** Alertes à afficher, du plus récent au plus ancien. */
export function alertesVisibles(etat: EtatAlertesSorties): AlerteSorties[] {
  return [...etat.groupes].reverse();
}

/** Nombre d'alertes distinctes affichées au badge de la cloche. */
export function compterAlertes(etat: EtatAlertesSorties): number {
  return etat.groupes.length;
}
