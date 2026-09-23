import { useEffect, useRef, useState } from "react";
import { Bell, Check, Clipboard, Package, ArrowUpFromLine, Inbox } from "lucide-react";
import { User } from "../App";
import {
  AppNotification,
  getNotifications,
  getUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications";

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

interface NotificationBellProps {
  user?: User;
  /** force un rendu à jour lorsque les données changent */
  version?: number;
}

/**
 * Cloche de notifications du header : compteur des notifications non lues
 * et liste déroulante (espace Demandeur et autres rôles).
 */
export function NotificationBell({ user, version = 0 }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState<AppNotification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setItems(getNotifications(user));
    setUnread(getUnreadNotifications(user));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, version]);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center">
            <span className="text-white text-[10px] leading-3">
              {unread.length}
            </span>
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <span className="text-sm text-card-foreground font-medium">
              Notifications
            </span>
            <button
              onClick={handleMarkAll}
              disabled={unread.length === 0}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Tout marquer comme lu
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
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
          </div>
        </div>
      )}
    </div>
  );
}
