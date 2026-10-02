// Notifications « étapes » du flux Arrivée Matériel (MaterialEntry) —
// indicateur d'état DÉRIVÉ, calculé à chaque ouverture depuis fetchEntrees().
//
// Décision de principe (Étape 5) : AUCUNE table notification côté serveur et
// AUCUN stockage persistant (l'ancien store localStorage lib/notifications.ts
// n'est plus alimenté par ce flux — il reste en place pour ses autres
// consommateurs, hors périmètre). Ce module est pur : il prend la liste des
// entrées serveur et retourne les actions en attente pour un rôle donné.
//
// Règles de routage (mêmes règles que le contrôleur entree.js) :
//   magasinier   : entrées non signées chef_service_1 (statut en_attente ou
//                  brouillon, non rejetées).
//   logistique   : entrées signées chef_service_1 mais pas chef_service_2.
//   dépositaire  : entrées où les 2 signatures précédentes sont posées mais
//                  pas la sienne, PLUS ses brouillons non finalisés (étape 1
//                  laissée en cours — repérés par statut brouillon).

import type { EntreeRecord } from "./movements";
import { AppRole } from "../types/roles";

export interface NotificationEtape {
  /** Clé stable de la ligne (pour React key). */
  id: string;
  /** Identifiant serveur de l'entrée liée. */
  entreeId: string | number;
  /** Référence ENT-AAAA-NNN. */
  reference: string;
  /** Titre affiché en gras. */
  title: string;
  /** Détail affiché sous le titre. */
  body: string;
  /** Date affichée (création ou dernière signature connue). */
  date: string;
  /** Catégorie pour l'icône (même rendu que l'ancien panneau). */
  type: "enregistrement" | "reception_confirmee" | "ecart";
}

/** Vrai si l'entrée peut encore progresser dans le workflow (ni validée, ni rejetée). */
function estActive(e: EntreeRecord): boolean {
  const s = e.statutServeur;
  return s !== "validee" && s !== "rejetee" && !!s;
}

function aEteSignee(e: EntreeRecord, role: "depositaire" | "chefService1" | "chefService2"): boolean {
  return !!e.signatures?.[role];
}

/** Calcule les actions en attente pour le rôle donné, à partir des entrées
 *  serveur. Pur et déterministe : même liste pour deux sessions du même rôle. */
export function notificationsPourRole(
  role: AppRole,
  entrees: EntreeRecord[]
): NotificationEtape[] {
  const actives = entrees.filter(estActive);
  const items: NotificationEtape[] = [];

  for (const e of actives) {
    const bl = e.admin?.bonLivraison || e.reference;
    const fournisseur = e.fournisseur === "—" ? "" : ` (${e.fournisseur})`;

    if (role === "magasinier") {
      if (!aEteSignee(e, "chefService1")) {
        items.push({
          id: `mag-${e.id}`,
          entreeId: e.id,
          reference: e.reference,
          type: "enregistrement",
          title: "Nouveau bon de livraison à contrôler",
          body: `L'entrée ${e.reference} (BL ${bl})${fournisseur} attend votre contrôle physique.`,
          date: e.admin?.dateBonLivraison || e.dateEntree,
        });
      }
    } else if (role === "logistique") {
      if (aEteSignee(e, "chefService1") && !aEteSignee(e, "chefService2")) {
        items.push({
          id: `log-${e.id}`,
          entreeId: e.id,
          reference: e.reference,
          type: "reception_confirmee",
          title: "Entrée contrôlée — signature logistique attendue",
          body: `L'entrée ${e.reference} (BL ${bl}) a été certifiée par le magasinier. Votre signature (chef de service 2) est attendue.`,
          date: e.signatures?.chefService1 || e.dateEntree,
        });
      }
    } else if (role === "depositaire") {
      if (aEteSignee(e, "chefService1") && aEteSignee(e, "chefService2") && !aEteSignee(e, "depositaire")) {
        items.push({
          id: `dep-fin-${e.id}`,
          entreeId: e.id,
          reference: e.reference,
          type: "reception_confirmee",
          title: "Prête pour votre validation finale",
          body: `L'entrée ${e.reference} (BL ${bl}) attend votre signature finale (3/3). Le stock sera mis à jour à la validation.`,
          date: e.signatures?.chefService2 || e.dateEntree,
        });
      } else if (e.statutServeur === "brouillon") {
        items.push({
          id: `dep-brd-${e.id}`,
          entreeId: e.id,
          reference: e.reference,
          type: "enregistrement",
          title: "Saisie en cours à finaliser",
          body: `L'entrée ${e.reference} est en brouillon — transmettez-la au magasin pour lancer le circuit.`,
          date: e.dateEntree,
        });
      }
    }
    // Les autres rôles (comptable, demandeur, admin-simulé) n'ont pas
    // d'action attendue dans ce flux : liste vide.
  }

  return items;
}

/** Compteur d'actions en attente (badge). Un état recalculé n'a pas de notion
 *  de « lu » : le badge montre simplement le nombre d'actions courantes. */
export function compterNotifications(role: AppRole, entrees: EntreeRecord[]): number {
  return notificationsPourRole(role, entrees).length;
}
