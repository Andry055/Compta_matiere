import { useCallback, useEffect, useRef, useState } from "react";
import { sortiesActionsStore, type SortiesActionsStoreState } from "./sortiesActionsStore";
import type { AlerteSorties } from "./sortieAlertes";
import { getDerniereSyncSortie, marquerSyncSortie } from "./lastSync";

export interface UseSortiesLiveResult {
  sorties: SortieRecord[];
  isLoading: boolean;
  isInitialError: boolean;
  isRefreshing: boolean;
  messageErreur: string | null;
  derniereSync: Date | null;
  /** Total serveur filtré (badge « À préparer (n) ») — jamais de liste détaillée. */
  totalEnPreparation: number | null;
  /** Alertes « nouvel ordre » dérivées des données serveur. */
  alertes: AlerteSorties[];
  refresh: () => Promise<void>;
}

/**
 * Hook de lecture en quasi temps réel des sorties (GET /api/sorties).
 * Utilise le store partagé pour éviter les requêtes duplicates.
 */
export function useSortiesLive(): UseSortiesLiveResult {
  const [sorties, setSorties] = useState<SortieRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialError, setIsInitialError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [derniereSync, setDerniereSync] = useState<Date | null>(getDerniereSyncSortie());
  const [totalEnPreparation, setTotalEnPreparation] = useState<number | null>(null);
  const [alertes, setAlertes] = useState<AlerteSorties[]>([]);

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

  // Tick timer for updating the display every second
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to the store
  useEffect(() => {
    const handleStoreChange = (state: SortiesActionsStoreState) => {
      // Update loading state
      setIsLoading(state.loading);
      setTotalEnPreparation(state.totalEnPreparation);
      setAlertes(state.alertes);

      // Update sorties data if available
      if (state.sorties !== null) {
        sortiesRef.current = state.sorties;
        setSorties(state.sorties);

        // If we have data and it's not an error, update last sync and clear error
        if (!state.error) {
          const now = new Date();
          marquerSyncSortie(now);
          setDerniereSync(now);
          setMessageErreur(null);
          // If we had an error before, clear initial error flag if this is first load
          if (!hasLoadedOnceRef.current) {
            setIsInitialError(false);
          }
          hasLoadedOnceRef.current = true;
        }
      }

      // Handle error state
      if (state.error && state.sorties === null) {
        // If we never had successful data, set initial error
        if (!hasLoadedOnceRef.current) {
          setIsInitialError(true);
        } else {
          // If we had data before, show connection unavailable message
          const heure = derniereSyncRef.current
            ? formatHeureSync(derniereSyncRef.current)
            : formatHeureSync(new Date());
          setMessageErreur(`Connexion indisponible, dernière synchro à ${heure}`);
        }
        setIsLoading(false);
      }
    };

    // Subscribe to store updates
    const unsubscribe = sortiesActionsStore.subscribe(handleStoreChange);

    // Rejoint le sondage PARTAGÉ du store — un seul intervalle pour l'app,
    // actif même hors de l'onglet Distribution, en pause quand l'onglet est
    // masqué (le store écoute visibilitychange lui-même). `detail: true` :
    // Distribution est le SEUL consommateur du détail des ordres.
    const libererSon = sortiesActionsStore.acquire({ detail: true });

    // Start the ticker for UI updates
    const startTicking = () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tickTimerRef.current = setInterval(() => {
          setTick((t) => (t + 1) % 100000);
        }, 1000);
      }
    };

    const stopTicking = () => {
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };

    startTicking();

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined") {
        if (document.visibilityState === "visible") startTicking();
        else stopTicking();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Cleanup
    return () => {
      unsubscribe();
      libererSon();
      stopTicking();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, []); // Empty deps because we only want to subscribe once

  // Refresh function to manually trigger a fetch
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Trigger a fetch in the store; the store will update its state and notify subscribers
      await sortiesActionsStore.refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return {
    sorties,
    isLoading,
    isInitialError,
    isRefreshing,
    messageErreur,
    derniereSync,
    totalEnPreparation,
    alertes,
    refresh,
  };
}

/* Helper functions copied from useMaterialsLive.ts */
function formatHeureSync(date: Date | null): string {
  if (!date) return "--:--";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}