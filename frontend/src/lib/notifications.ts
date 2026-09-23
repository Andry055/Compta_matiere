// ---------------------------------------------------------------------------
// Notifications de l'espace « Demandeur »
//
// Dérivées des vraies données de l'application (demandes, sorties, entrées).
// Les accusés de lecture sont conservés dans localStorage.
// ---------------------------------------------------------------------------

import { User } from "../App";
import { getDemandesForUser, getAllDemandes } from "./demandes";
import {
  entreeRecords,
  sortieRecords,
  getStatutEntreeAffiche,
} from "./movements";

export interface AppNotification {
  id: string;
  type: "demande" | "sortie" | "entree" | "stock";
  message: string;
  date: string;
}

const READ_KEY = "comptamatiere.notifs.read";

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Liste des notifications du profil connecté */
export function getNotifications(user?: User): AppNotification[] {
  if (user?.role === "demandeur") {
    return getNotificationsDemandeur(user);
  }
  return getNotificationsGeneriques();
}

function getNotificationsDemandeur(user: User): AppNotification[] {
  const items: AppNotification[] = [];
  const demandes = getDemandesForUser(user);

  demandes.forEach((d) => {
    if (d.statut === "Validée") {
      items.push({
        id: `dem-validee-${d.reference}`,
        type: "demande",
        message: `Votre demande ${d.reference} a été validée.`,
        date: d.dateValidation || d.date,
      });
    } else if (d.statut === "Refusée") {
      items.push({
        id: `dem-refusee-${d.reference}`,
        type: "demande",
        message: `Votre demande ${d.reference} a été refusée.`,
        date: d.dateValidation || d.date,
      });
    } else if (d.statut === "En attente") {
      items.push({
        id: `dem-attente-${d.reference}`,
        type: "demande",
        message: `Votre demande ${d.reference} est en attente de validation.`,
        date: d.dateEnvoi || d.date,
      });
    } else if (d.statut === "Brouillon") {
      items.push({
        id: `dem-brouillon-${d.reference}`,
        type: "demande",
        message: `Votre demande ${d.reference} nécessite une information complémentaire avant envoi.`,
        date: d.date,
      });
    }

    if (d.statut === "Sortie effectuée" && d.sortieReference) {
      items.push({
        id: `sortie-${d.sortieReference}`,
        type: "sortie",
        message: `La sortie ${d.sortieReference} est prête.`,
        date: d.dateValidation || d.date,
      });
    }
  });

  // Entrées rejetées / matériel disponible
  const entreeRejetee = entreeRecords.find(
    (e) => getStatutEntreeAffiche(e) === "Rejetée"
  );
  if (entreeRejetee) {
    items.push({
      id: `entree-${entreeRejetee.reference}`,
      type: "entree",
      message: `L'entrée ${entreeRejetee.reference} a été rejetée par le responsable.`,
      date: entreeRejetee.dateEntree,
    });
  }

  items.push({
    id: "stock-disponible",
    type: "stock",
    message: "Le matériel demandé est disponible en stock.",
    date: "2025-01-08",
  });

  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function getNotificationsGeneriques(): AppNotification[] {
  const enAttente = getAllDemandes().filter(
    (d) => d.statut === "En attente"
  ).length;
  const dernieresEntrees = entreeRecords.slice(0, 1).length;
  return [
    {
      id: "gen-entrees",
      type: "entree",
      message: `${dernieresEntrees} entrée(s) récente(s) enregistrée(s) au journal.`,
      date: entreeRecords[0]?.dateEntree || "2025-01-08",
    },
    {
      id: "gen-demandes",
      type: "demande",
      message: `${enAttente} demande(s) en attente de traitement.`,
      date: "2025-01-08",
    },
    {
      id: "gen-sorties",
      type: "sortie",
      message: `${sortieRecords.filter((s) => s.statut === "Sortie effectuée").length} sortie(s) effectuée(s) ce mois.`,
      date: "2025-01-08",
    },
  ];
}

/** Notifications non lues */
export function getUnreadNotifications(user?: User): AppNotification[] {
  const read = readIds();
  return getNotifications(user).filter((n) => !read.includes(n.id));
}

/** Marque une notification comme lue */
export function markNotificationRead(id: string) {
  const read = readIds();
  if (!read.includes(id)) {
    writeIds([...read, id]);
  }
}

/** Marque toutes les notifications comme lues */
export function markAllNotificationsRead(user?: User) {
  const ids = getNotifications(user).map((n) => n.id);
  const read = readIds();
  writeIds(Array.from(new Set([...read, ...ids])));
}
