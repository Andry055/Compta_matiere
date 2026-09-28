// Notifications par rôle — persistées en localStorage, agrégées et lues depuis
// le panneau de notifications. Un rôle ne voit que SES notifications.
//
// Événements du flux de réception :
//   - enregistrement validé par le dépositaire → notifie le magasinier
//   - écart signalé par le magasinier          → notifie le dépositaire
//   - correction revalidée par le dépositaire  → notifie le magasinier
//   - réception confirmée par le magasinier    → notifie le dépositaire
//
// Ce module expose aussi les notifications de l'espace « Demandeur »,
// dérivées des vraies données de l'application (demandes, sorties, entrées)
// et consommées par la cloche du header (NotificationBell). Les accusés de
// lecture de ce second flux sont conservés séparément dans localStorage.

import { AppRole, ROLES_CONFIG } from "../types/roles";
import { User } from "../App";
import { getDemandesForUser, getAllDemandes } from "./demandes";
import {
  entreeRecords,
  sortieRecords,
  getStatutEntreeAffiche,
} from "./movements";

export type NotificationType =
  | "enregistrement"
  | "ecart"
  | "correction"
  | "reception_confirmee"
  | "demande"
  | "sortie"
  | "entree"
  | "stock";

export interface AppNotification {
  id: string;
  type: NotificationType;
  date: string; // ISO
  // ── Flux par rôle (réception matériel) ──
  title?: string;
  body?: string;
  targetRole?: AppRole;
  read?: boolean;
  /** BL concerné, pour le contexte dans le panneau. */
  numeroBL?: string;
  // ── Flux dérivé des données (espace Demandeur / cloche) ──
  message?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
   1) Flux par rôle — utilisé par le module Arrivée Matériel (MaterialEntry)
   ══════════════════════════════════════════════════════════════════════════ */

const NOTIF_KEY = "appNotifications";

function readAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function writeAll(notifs: AppNotification[]): void {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifs));
  } catch {
    // Quota indisponible : on ignore (le flux reste fonctionnel en mémoire).
  }
}

function generateId() {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Ajoute une notification ciblée pour un rôle. */
export function pushNotification(
  targetRole: AppRole,
  type: NotificationType,
  title: string,
  body: string,
  numeroBL?: string
): void {
  const notifs = readAll();
  notifs.unshift({
    id: generateId(),
    type,
    title,
    body,
    date: new Date().toISOString(),
    targetRole,
    read: false,
    numeroBL,
  });
  // Garde-fou : on conserve les 50 plus récentes.
  writeAll(notifs.slice(0, 50));
}

/** Notifications d'un rôle, triées du plus récent au plus ancien. */
export function getNotificationsForRole(role: AppRole): AppNotification[] {
  return readAll()
    .filter((n) => n.targetRole === role)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Nombre de notifications non lues d'un rôle (badge du header). */
export function countUnread(role: AppRole): number {
  return readAll().filter((n) => n.targetRole === role && !n.read).length;
}

/** Marque toutes les notifications d'un rôle comme lues. */
export function markAllRead(role: AppRole): void {
  const notifs = readAll().map((n) =>
    n.targetRole === role ? { ...n, read: true } : n
  );
  writeAll(notifs);
}

/** Réinitialise toutes les notifications (bouton « nouvelle réception »). */
export function clearNotifications(role?: AppRole): void {
  if (!role) {
    writeAll([]);
    return;
  }
  writeAll(readAll().filter((n) => n.targetRole !== role));
}

/** Libellé du rôle cible pour l'affichage. */
export function roleLabel(role: AppRole): string {
  return ROLES_CONFIG[role]?.label ?? role;
}

/* ══════════════════════════════════════════════════════════════════════════
   2) Flux dérivé des données — utilisé par la cloche du header
   ══════════════════════════════════════════════════════════════════════════ */

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
