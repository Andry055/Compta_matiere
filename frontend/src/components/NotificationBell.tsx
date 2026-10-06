import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  Inbox,
  Lock,
  Package,
  ArrowUpFromLine,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { User } from "../App";
import {
  AppNotification,
  getNotifications,
  getUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications";
import { fetchEntrees } from "../lib/api";
import {
  NotificationEtape,
  notificationsPourRole,
} from "../lib/notificationEtapes";
import { AppRole, ROLES_CONFIG } from "../types/roles";

function notifIcon(type: AppNotification["type"]) {
  switch (type) {
    case "demande":
      return Clipboard;
    case "sortie":
      return ArrowUpFromLine;
    case "entree":
      return Inbox;
    default:
      return Package;
  }
}

function etapeIcon(type: NotificationEtape["type"]) {
  switch (type) {
    case "ecart":
      return Lock;
    case "reception_confirmee":
      return CheckCircle2;
    default:
      return ClipboardCheck;
  }
}

/** Décalque de la couleur d'icône du panneau Arrivée Matériel : rouge pour un
 *  écart bloquant, vert quand le relais est validé, bleu pour l'action en cours. */
function etapeIconColor(type: NotificationEtape["type"]) {
  switch (type) {
    case "ecart":
      return "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400";
    case "reception_confirmee":
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
    default:
      return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
  }
}

/** Rôles du flux Arrivée Matériel : seuls eux ont des actions en attente
 *  (signature, contrôle, validation). Pour les autres rôles, la section est
 *  simplement absente. */
const ROLES_AVEC_ETAPES: AppRole[] = ["depositaire", "magasinier", "logistique"];

interface NotificationBellProps {
  user?: User;
  /** force un rendu à jour lorsque les données changent */
  version?: number;
  /** Ouvre l'écran Arrivée Matériel sur la pièce visée par une notification. */
  onOpenEntree?: (entreeId: string | number) => void;
}

/**
 * Cloche de notifications du header : UNIQUE point de notifications de
 * l'application.
 *
 * Elle agrège deux flux, tous deux affichés ici :
 *   1. les ACTIONS EN ATTENTE du rôle connecté dans le circuit de réception
 *      (dérivées du serveur via fetchEntrees, cf. notificationEtapes) ;
 *   2. les notifications d'information du module lib/notifications.
 *
 * Les actions en attente sont un indicateur d'ÉTAT, pas des messages : elles
 * ne se marquent pas « lues », elles se soldent en signant. Un clic ouvre
 * directement la pièce concernée.
 */
export function NotificationBell({
  user,
  version = 0,
  onOpenEntree,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState<AppNotification[]>([]);
  const [etapes, setEtapes] = useState<NotificationEtape[]>([]);
  const [chargementEtapes, setChargementEtapes] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const role = (user?.role ?? null) as AppRole | null;
  const aDesEtapes = !!role && ROLES_AVEC_ETAPES.includes(role);

  const refresh = () => {
    setItems(getNotifications(user));
    setUnread(getUnreadNotifications(user));
  };

  /** Recharge les pièces en circulation et en dérive les actions du rôle. */
  const chargerEtapes = useCallback(async () => {
    if (!role || !ROLES_AVEC_ETAPES.includes(role)) {
      setEtapes([]);
      return;
    }
    setChargementEtapes(true);
    const entrees = await fetchEntrees();
    // null = backend injoignable / session expirée : on garde la liste
    // précédente plutôt que d'annoncer « aucune action en attente », qui
    // serait un faux rassurant.
    if (entrees) setEtapes(notificationsPourRole(role, entrees));
    setChargementEtapes(false);
  }, [role]);

  useEffect(() => {
    refresh();
    void chargerEtapes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, version, chargerEtapes]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // À l'ouverture on relit le serveur : le badge ne doit jamais proposer une
  // pièce déjà traitée par un autre poste depuis la dernière visite.
  useEffect(() => {
    if (!open) return;
    void chargerEtapes();
  }, [open, chargerEtapes]);

  const handleToggle = () => {
    setOpen((v) => !v);
  };

  const handleOpenItem = (id: string) => {
    markNotificationRead(id);
    refresh();
  };

  const handleMarkAll = () => {
    markAllNotificationsRead(user);
    refresh();
  };

  const handleOpenEtape = (etape: NotificationEtape) => {
    setOpen(false);
    if (onOpenEntree) onOpenEntree(etape.entreeId);
  };

  const nbNonLues = unread.length;
  const total = nbNonLues + etapes.length;
  const roleLabel = role ? ROLES_CONFIG[role].label : "";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Mes notifications"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center">
            <span className="text-white text-[10px] leading-3">
              {total > 9 ? "9+" : total}
            </span>
          </span>
        )}
        <span className="sr-only">Mes notifications</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20">
            <span className="text-sm text-card-foreground font-medium">
              Mes notifications
            </span>
            {nbNonLues > 0 && (
              <button
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* ── 1) Actions en attente du rôle (circuit Arrivée Matériel) ── */}
            {aDesEtapes && etapes.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  En attente — {roleLabel}
                </p>
                {etapes.map((n) => {
                  const Icon = etapeIcon(n.type);
                  const ouvrable = !!onOpenEntree;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpenEtape(n)}
                      disabled={!ouvrable}
                      title={ouvrable ? "Ouvrir cette pièce" : undefined}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                        ouvrable ? "hover:bg-muted/40 cursor-pointer" : ""
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${etapeIconColor(
                          n.type
                        )}`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-snug text-card-foreground">
                          {n.title}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {n.body}
                        </span>
                        <span className="block text-[10px] text-muted-foreground mt-1">
                          {new Date(n.date).toLocaleString("fr-FR")}
                        </span>
                      </span>
                      {ouvrable && (
                        <ChevronRight className="mt-1.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
                <div className="h-px bg-border" />
              </>
            )}

            {/* ── 2) Notifications d'information (flux historique) ── */}
            <p className="px-4 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Informations
            </p>
            {items.length === 0 ? (
              <div className="px-4 pb-6 pt-2 text-center text-sm text-muted-foreground">
                Aucune notification pour le moment.
              </div>
            ) : (
              items.map((item) => {
                const Icon = notifIcon(item.type);
                const isUnread = unread.some((n) => n.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleOpenItem(item.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${
                      isUnread ? "bg-blue-50/60 dark:bg-blue-900/10" : ""
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                        isUnread
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-card-foreground">
                        {item.message}
                      </span>
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {new Date(item.date).toLocaleDateString("fr-FR")}
                      </span>
                    </span>
                    {isUnread && (
                      <span className="mt-2 h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}

            {chargementEtapes && (
              <p className="flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground border-t border-border">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Vérification des pièces en cours…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}