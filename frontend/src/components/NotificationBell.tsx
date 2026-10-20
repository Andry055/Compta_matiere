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
  Truck,
} from "lucide-react";
import { User } from "../App";
import {
  AppNotification,
  getNotifications,
  getUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications";
import { fetchEntrees, fetchOrdresValidesPourDepositaire } from "../lib/api";
import {
  NotificationEtape,
  notificationsPourRole,
  notificationsPourRoleSortie,
} from "../lib/notificationEtapes";
import { sortiesActionsStore } from "../lib/sortiesActionsStore";
import type { AlerteSorties } from "../lib/sortieAlertes";
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
    case "sortie":
      return Truck; // Or maybe ArrowUpFromLine to match the notifIcon?
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
    case "sortie":
      return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
    default:
      return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
  }
}

/** Rôles du flux Arrivée Matériel : seuls eux ont des actions en attente
 *  (signature, contrôle, validation). Pour les autres rôles, la section est
 *  simplement absente. */
const ROLES_AVEC_ETAPES: AppRole[] = ["depositaire", "magasinier", "logistique"];

/**
 * Traduit les alertes du store (dérivées des données serveur) en lignes
 * d'affichage. UN groupe d'ordres découverts ensemble = UNE seule alerte :
 * plusieurs ordres arrivés en même temps ne gonflent pas le badge.
 */
function alertesSortiesEnEtapes(
  alertes: AlerteSorties[],
  variante: "preparer" | "autoriser" = "preparer"
): NotificationEtape[] {
  return alertes.map((alerte) => {
    const plusieurs = alerte.references.length > 1;
    const refs = alerte.references.join(", ");
    if (variante === "autoriser") {
      // MÊMES règles que le magasinier (groupe unique, disparition à la
      // signature) mais libellé propre au rôle logistique.
      return {
        id: `sortie-autorisation-${alerte.ids.join("-")}`,
        entreeId: alerte.ids[0],
        reference: refs,
        type: "sortie" as const,
        title: plusieurs
          ? `Nouveaux ordres à autoriser : ${refs}`
          : `Nouvel ordre à autoriser : ${refs}`,
        body: plusieurs
          ? `${alerte.references.length} ordres attendent votre signature 3 : ${refs}.`
          : `L'ordre ${alerte.references[0]} est prêt pour votre signature 3.`,
        date: alerte.date,
      };
    }
    return {
      id: `sortie-alerte-${alerte.ids.join("-")}`,
      entreeId: alerte.ids[0],
      reference: refs,
      type: "sortie" as const,
      title: plusieurs ? "Nouvelles sorties à préparer" : "Nouvelle sortie à préparer",
      body: plusieurs
        ? `${alerte.references.length} nouveaux ordres attendent votre signature : ${refs}.`
        : `La sortie ${alerte.references[0]} attend votre signature de préparation.`,
      date: alerte.date,
    };
  });
}

interface NotificationBellProps {
  user?: User;
  /** force un rendu à jour lorsque les données changent */
  version?: number;
  /** Ouvre l'écran Arrivée Matériel sur la pièce visée par une notification. */
  onOpenEntree?: (entreeId: string | number) => void;
  /** Ouvre l'espace Distribution sur une notification de sortie (dépositaire). */
  onOpenSortie?: () => void;
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
 * À quoi s'ajoute, pour le DÉPOSITAIRE, la notification dérivée du serveur
 * « sortie acceptée par le chef logistique » (3ᵉ signature), visible tant que
 * la remise n'est pas enregistrée.
 *
 * Les actions en attente sont un indicateur d'ÉTAT, pas des messages : elles
 * ne se marquent pas « lues », elles se soldent en signant. Un clic ouvre
 * directement la pièce concernée.
 */
export function NotificationBell({
  user,
  version = 0,
  onOpenEntree,
  onOpenSortie,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState<AppNotification[]>([]);
  const [etapes, setEtapes] = useState<NotificationEtape[]>([]);
  const [etapesSortie, setEtapesSortie] = useState<NotificationEtape[]>([]);
  const [etapesValidation, setEtapesValidation] = useState<NotificationEtape[]>(
    []
  );
  const [chargementEtapes, setChargementEtapes] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const role = (user?.role ?? null) as AppRole | null;
  const aDesEtapes = !!role && ROLES_AVEC_ETAPES.includes(role);
  const aDesEtapesSortie = role === "magasinier"; // signature 1
  // Chef logistique : alertes « nouvel ordre à autoriser » (signature 3),
  // dérivées du MÊME sondage partagé (aucune requête supplémentaire locale).
  const aDesAutorisations = role === "logistique";

  const refresh = () => {
    setItems(getNotifications(user));
    setUnread(getUnreadNotifications(user));
  };

  /** Recharge les pièces en circulation et en dérive les actions du rôle. */
  const chargerEtapes = useCallback(async () => {
    if (!role || !ROLES_AVEC_ETAPES.includes(role)) {
      setEtapes([]);
      setEtapesSortie([]);
      setEtapesValidation([]);
      return;
    }
    setChargementEtapes(true);

    // Fetch entries for MaterialEntry module actions
    const entrees = await fetchEntrees();
    // null = backend injoignable / session expirée : on garde la liste
    // précédente plutôt que d'annoncer « aucune action en attente », qui
    // serait un faux rassurant.
    if (entrees) setEtapes(notificationsPourRole(role, entrees));

    // Dépositaire : les ordres ACCEPTÉS par le chef logistique (3ᵉ signature)
    // servis en direct par le serveur — même garde sur le null.
    if (role === "depositaire") {
      const ordres = await fetchOrdresValidesPourDepositaire();
      if (ordres) {
        setEtapesValidation(notificationsPourRoleSortie(role, ordres));
      }
    } else {
      setEtapesValidation([]);
    }

    setChargementEtapes(false);
  }, [role]);

  // Ordres à préparer : alertes DÉRIVÉES des données serveur, lues dans le
  // store partagé (un seul sondage). La cloche ne fetch JAMAIS le détail des
  // ordres et n'écrit rien dans localStorage : une alerte existe tant qu'un
  // de ses ordres n'est pas encore signé, et disparaît dès la signature.
  useEffect(() => {
    if (!aDesEtapesSortie && !aDesAutorisations) {
      setEtapesSortie([]);
      return;
    }
    const unsubscribe = sortiesActionsStore.subscribe((state) => {
      setEtapesSortie(
        alertesSortiesEnEtapes(
          aDesAutorisations ? state.alertesAutorisation : state.alertes,
          aDesAutorisations ? "autoriser" : "preparer"
        )
      );
    });
    const libererSon = sortiesActionsStore.acquire({
      autorisation: aDesAutorisations,
    });
    return () => {
      unsubscribe();
      libererSon();
    };
  }, [aDesEtapesSortie, aDesAutorisations]);

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
    // For entrée notifications, open the entrée detail
    // For sortie notifications, we could open sortie detail if callback existed
    // For now, we use the same callback and let the caller handle the ID appropriately
    if (onOpenEntree) onOpenEntree(etape.entreeId);
  };

  /** Notification « sortie acceptée » du dépositaire : ouvre l'espace
   *  Distribution (jamais l'écran Arrivée Matériel, qui attend une entrée). */
  const handleOpenValidation = () => {
    setOpen(false);
    if (onOpenSortie) onOpenSortie();
  };

  const nbNonLues = unread.length;
  const total =
    nbNonLues + etapes.length + etapesSortie.length + etapesValidation.length;
  const roleLabel = role ? ROLES_CONFIG[role].label : "";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className="cm-btn-ghost relative inline-flex items-center justify-center h-9 w-9 rounded-lg"
        title="Mes notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-destructive rounded-full text-[10px] font-semibold flex items-center justify-center text-destructive-foreground cm-num">
            {total > 9 ? "9+" : total}
          </span>
        )}
        <span className="sr-only">Mes notifications</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Mes notifications"
          className="cm-modal absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <span className="cm-eyebrow">
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
                <p className="cm-eyebrow px-4 pt-3 pb-1">
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
                        ouvrable ? "hover:bg-accent/40 cursor-pointer" : ""
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

            {/* ── 1.bis) Actions en attente du rôle (circuit de préparation des sorties) ── */}
            {(aDesEtapesSortie || aDesAutorisations) && etapesSortie.length > 0 && (
              <>
                <p className="cm-eyebrow px-4 pt-3 pb-1">
                  En attente — {roleLabel}
                </p>
                {etapesSortie.map((n) => {
                  const Icon = etapeIcon(n.type);
                  const ouvrable = !!onOpenEntree;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpenEtape(n)}
                      disabled={!ouvrable}
                      title={ouvrable ? "Ouvrir cette pièce" : undefined}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                        ouvrable ? "hover:bg-accent/40 cursor-pointer" : ""
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

            {/* ── 1.ter) Dépositaire : sorties ACCEPTÉES par le chef logistique
                 (3ᵉ signature) — notification dérivée du serveur, visible tant
                 que la remise n'est pas enregistrée. ── */}
            {role === "depositaire" && etapesValidation.length > 0 && (
              <>
                <p className="cm-eyebrow px-4 pt-3 pb-1">
                  En attente — {roleLabel}
                </p>
                {etapesValidation.map((n) => {
                  const Icon = etapeIcon(n.type);
                  const ouvrable = !!onOpenSortie;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpenValidation()}
                      disabled={!ouvrable}
                      title={ouvrable ? "Ouvrir l'espace Distribution" : undefined}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                        ouvrable ? "hover:bg-accent/40 cursor-pointer" : ""
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
            <p className="cm-eyebrow px-4 pt-3 pb-1">
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
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors ${
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