import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMaterialsOrThrow, MaterialOption } from "./api";
import { getDerniereSync, marquerSync } from "./lastSync";

export interface ChangementQuantite {
  documentId: string;
  designation: string;
  ancienne: number;
  nouvelle: number;
}

/**
 * Compare deux listes selon documentId, quantite_stock, statut, valeur,
 * désignation et photo de référence.
 */
export function ontChange(
  prev: MaterialOption[],
  next: MaterialOption[]
): boolean {
  if (prev.length !== next.length) return true;
  const mapPrev = new Map<string, MaterialOption>();
  for (const item of prev) {
    mapPrev.set(item.documentId, item);
  }
  for (const item of next) {
    const p = mapPrev.get(item.documentId);
    if (!p) return true;
    if (
      (p.quantiteStock ?? 0) !== (item.quantiteStock ?? 0) ||
      (p.statut ?? "") !== (item.statut ?? "") ||
      (p.valeurUnitaire ?? 0) !== (item.valeurUnitaire ?? 0) ||
      p.designation !== item.designation ||
      p.photos?.[0] !== item.photos?.[0] ||
      // Vignette de repli (photo de la ligne rattachée) : une nouvelle photo
      // de ligne doit apparaître sans attendre F5.
      p.photoDeLigne !== item.photoDeLigne
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Détecte les matériels dont la quantité a changé entre deux lectures.
 */
export function detecterChangementsQuantite(
  prev: MaterialOption[],
  next: MaterialOption[]
): ChangementQuantite[] {
  const mapPrev = new Map<string, MaterialOption>();
  for (const item of prev) {
    mapPrev.set(item.documentId, item);
  }
  const changements: ChangementQuantite[] = [];
  for (const item of next) {
    const p = mapPrev.get(item.documentId);
    if (p) {
      const ancienne = p.quantiteStock ?? 0;
      const nouvelle = item.quantiteStock ?? 0;
      if (ancienne !== nouvelle) {
        changements.push({
          documentId: item.documentId,
          designation: item.designation,
          ancienne,
          nouvelle,
        });
      }
    }
  }
  return changements;
}

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

export interface UseMaterialsLiveResult {
  materials: MaterialOption[];
  isLoading: boolean;
  isInitialError: boolean;
  isRefreshing: boolean;
  messageErreur: string | null;
  derniereSync: Date | null;
  changementsQuantite: ChangementQuantite[];
  refresh: () => Promise<void>;
}

/**
 * Hook de lecture en quasi temps réel du stock matériel (GET /api/materials).
 *
 * - Premier chargement : état « chargement ».
 * - Rafraîchissements silencieux ultérieurs (sans repasser par l'écran de chargement).
 * - Déclencheurs :
 *   1. Événement `stock-mis-a-jour`
 *   2. Retour sur l'onglet (`visibilitychange` / `focus`)
 *   3. Reconnexion réseau (`online`)
 *   4. Sondage toutes les 20 secondes (en pause si onglet masqué ou hors-ligne)
 *   5. Bouton ou appel explicite `refresh()`
 * - Une seule requête à la fois (ignore tout déclencheur concurrent).
 * - Nettoyage complet des timers au démontage.
 * - Ne remplace les données que si elles ont changé.
 * - Expose les matériels dont la quantité vient de changer (signalée quelques secondes).
 * - En cas d'échec réseau après un premier succès : conserve les données et affiche
 *   « Connexion indisponible, dernière synchro à HH:MM ».
 */
export function useMaterialsLive(): UseMaterialsLiveResult {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialError, setIsInitialError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [derniereSync, setDerniereSync] = useState<Date | null>(getDerniereSync());
  const [changementsQuantite, setChangementsQuantite] = useState<ChangementQuantite[]>([]);

  // Horloge de re-rendu régulier pour l'affichage précis « Synchronisé il y a X s »
  const [, setTick] = useState(0);

  const materialsRef = useRef<MaterialOption[]>(materials);
  materialsRef.current = materials;

  const derniereSyncRef = useRef<Date | null>(derniereSync);
  derniereSyncRef.current = derniereSync;

  const hasLoadedOnceRef = useRef(false);
  const inProgressRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chgtTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSilently = useCallback(async () => {
    if (inProgressRef.current) return;
    inProgressRef.current = true;
    setIsRefreshing(true);

    try {
      const rows = await fetchMaterialsOrThrow();
      const now = new Date();
      marquerSync(now);
      setDerniereSync(now);
      setMessageErreur(null);
      setIsInitialError(false);

      const prev = materialsRef.current;
      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        materialsRef.current = rows;
        setMaterials(rows);
      } else {
        if (ontChange(prev, rows)) {
          const chgts = detecterChangementsQuantite(prev, rows);
          if (chgts.length > 0) {
            setChangementsQuantite(chgts);
            if (chgtTimerRef.current) clearTimeout(chgtTimerRef.current);
            chgtTimerRef.current = setTimeout(() => {
              setChangementsQuantite([]);
            }, 4000);
          }
          materialsRef.current = rows;
          setMaterials(rows);
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

    const handleStockUpdate = () => {
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

    window.addEventListener("stock-mis-a-jour", handleStockUpdate);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stopPolling();
      stopTicking();
      if (chgtTimerRef.current) clearTimeout(chgtTimerRef.current);
      window.removeEventListener("stock-mis-a-jour", handleStockUpdate);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [fetchSilently, startPolling, stopPolling, startTicking, stopTicking]);

  return {
    materials,
    isLoading,
    isInitialError,
    isRefreshing,
    messageErreur,
    derniereSync,
    changementsQuantite,
    refresh: fetchSilently,
  };
}
