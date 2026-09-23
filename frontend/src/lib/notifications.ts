// Notifications par rôle — persistées en localStorage, agrégées et lues depuis
// le panneau de notifications. Un rôle ne voit que SES notifications.
//
// Événements du flux de réception :
//   - enregistrement validé par le dépositaire → notifie le magasinier
//   - écart signalé par le magasinier          → notifie le dépositaire
//   - correction revalidée par le dépositaire  → notifie le magasinier
//   - réception confirmée par le magasinier    → notifie le dépositaire

import { AppRole, ROLES_CONFIG } from "../types/roles";

export type NotificationType =
  | "enregistrement"
  | "ecart"
  | "correction"
  | "reception_confirmee";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  date: string; // ISO
  targetRole: AppRole;
  read: boolean;
  /** BL concerné, pour le contexte dans le panneau. */
  numeroBL?: string;
}

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
