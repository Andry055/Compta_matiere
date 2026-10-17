import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSorties, SortieRecord } from "./api";
import { getDerniereSyncSortie, marquerSyncSortie } from "./lastSync";

export interface UseSortiesLiveResult {
  sorties: SortieRecord[];
  isLoading: boolean;
  isInitialError: boolean;
  isRefreshing: boolean;
  messageErreur: string | null;
  derniereSync: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Hook de lecture en quasi temps réel des sorties (GET /api/sorties).
 *
 * - Premier chargement : état « chargement ».
 * - Rafraîchissements silencieux ultérieurs (sans repasser par l'écran de chargement).
 * - Déclencheurs :
 *   1. Événement `sortie-mis-a-jour`
 *   2. Retour sur l'onglet (`visibilitychange` / `focus`)
 *   3. Reconnexion réseau (`online`)
 *   4. Sondage toutes les 20 secondes (en pause si onglet masqué ou hors-ligne)
 *   5. Bouton ou appel explicite `refresh()`
 * - Une seule requête à la fois (ignore tout déclencheur concurrent).
 * - Nettoyage complet des timers au démontage.
 * - Ne remplace les données que si elles ont changé.
 * - En cas d'échec réseau après un premier succès : conserve les données et affiche
 *   « Connexion indisponible, dernière synchro à HH:MM ».
 */
export function useSortiesLive(): UseSortiesLiveResult {
  const [sorties, setSorties] = useState<SortieRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialError, setIsInitialError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [derniereSync, setDerniereSync] = useState<Date | null>(getDerniereSyncSortie());

  // Force un re-rendu chaque seconde : les libellés « dernière synchro il y a
  // Xs » (formatDelaiSyncExact) sont calculés au render, sans tick ils restent
  // figés. Voir useMaterialsLive.ts, même motif.
  const [, setTick] = useState(0);

  const sortiesRef = useRef<SortieRecord[]>(sorties);
  sortiesRef.current = sorties;

  const derniereSyncRef = useRef<Date | null>(derniereSync);
  derniereSyncRef.current = derniereSync;

  const hasLoadedOnceRef = useRef(false);
  const inProgressRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSilently = useCallback(async () => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;
    setIsRefreshing(true);

    try {
      const rows = await fetchSorties();
      if (rows === null) {
        throw new Error("API returned null");
      }
      const now = new Date();
      marquerSyncSortie(now);
      setDerniereSync(now);
      setMessageErreur(null);
      setIsInitialError(false);

      const prev = sortiesRef.current;
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        sortiesRef.current = rows;
        setSorties(rows);
      } else {
        // Simple comparison for sorties (could be enhanced like materials if needed)
        const changed = JSON.stringify(prev) !== JSON.stringify(rows);
        if (changed) {
          sortiesRef.current = rows;
          setSorties(rows);
        }
      }
    } catch {
      if (!hasLoadedOnceRef.current) {
        setIsInitialError(true);
      } else {
        const heure = derniereSyncRef.current
          ? formatHeureSync(derniereSyncRef.current)
          : formatHeureSync(new Date());
        setMessageErreur(`Connexion indisponible, dernière synchro à ${heure}`);
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setIsLoading(false);
      inProgressRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (!isTabVisible() || !isOnline()) {
      pollTimerRef.current = null;
      return;
    }
    pollTimerRef.current = setInterval(() => {
      if (isTabVisible() && isOnline()) {
        void fetchSilently();
      }
    }, 20000);
  }, [fetchSilently]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startTicking = useCallback(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    if (!isTabVisible()) {
      tickTimerRef.current = null;
      return;
    }
    tickTimerRef.current = setInterval(() => {
      setTick((t) => (t + 1) % 100000);
    }, 1000);
  }, []);

  const stopTicking = useCallback(() => {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Premier chargement
    void fetchSilently();
    startPolling();
    startTicking();

    const handleSortieUpdate = () => {
      void fetchSilently();
    };

    const handleVisibilityChange = () => {
      if (isTabVisible()) {
        startTicking();
        if (isOnline()) {
          void fetchSilently();
          startPolling();
        }
      } else {
        stopPolling();
        stopTicking();
      }
    };

    const handleFocus = () => {
      if (isTabVisible() && isOnline()) {
        void fetchSilently();
        startPolling();
      }
    };

    const handleOnline = () => {
      if (isTabVisible()) {
        void fetchSilently();
        startPolling();
      }
    };

    const handleOffline = () => {
      stopPolling();
    };

    window.addEventListener("sortie-mis-a-jour", handleSortieUpdate);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      stopTicking();
      window.removeEventListener("sortie-mis-a-jour", handleSortieUpdate);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [fetchSilently, startPolling, stopPolling, startTicking, stopTicking]);

  return {
    sorties,
    isLoading,
    isInitialError,
    isRefreshing,
    messageErreur,
    derniereSync,
    refresh: fetchSilently,
  };
}

/* Helper functions copied from useMaterialsLive.ts */
function formatHeureSync(date: Date | null): string {
  if (!date) return "--:--";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isTabVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

function isOnline(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") {
    return true;
  }
  return navigator.onLine;
}