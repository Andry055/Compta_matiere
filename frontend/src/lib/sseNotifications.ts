/**
 * Client SSE (Server-Sent Events) pour les notifications push en temps réel.
 *
 * Le backend expose `GET /api/notifications/stream` (authentifié via JWT
 * passé en paramètre de requête, car EventSource ne supporte pas les
 * en-têtes personnalisés). Ce module ouvre le flux, écoute les événements
 * et les redistribue aux abonnés via `onSSEEvent`.
 *
 * Reconnexion automatique après 3 secondes en cas de coupure.
 */

import { API_URL } from "./api";

export interface SseEvent {
  type: string;
  data: any;
}

let eventSource: EventSource | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let listeners: Array<(event: SseEvent) => void> = [];
let isConnecting = false;
let currentJwt: string | null = null;
let currentUserId: number | null = null;

/**
 * Ouvre (ou rouvre) la connexion SSE pour l'utilisateur donné.
 * Appelée à la connexion d'un Demandeur.
 */
export function connectSSE(userId: number, jwt: string): void {
  if (eventSource?.readyState === EventSource.OPEN) return;
  if (isConnecting) return;

  isConnecting = true;
  currentJwt = jwt;
  currentUserId = userId;

  const url = new URL(`${API_URL}/api/notifications/stream`);
  url.searchParams.set('jwt', encodeURIComponent(jwt));

  const es = new EventSource(url.toString());

  es.onopen = () => {
    isConnecting = false;
    console.log('[SSE] Connecté (utilisateur #' + userId + ')');
  };

  es.onmessage = (event) => {
    // Le type provient du champ `event:` du flux SSE (ex. 'demande_aboutie',
    // 'ordre_pret_distribution', 'ordre_sortie_autorise').
    // Les messages sans `event:` explicite sont de type 'message'.
    const type = (event as any).type || 'message';
    try {
      const data = JSON.parse(event.data);
      listeners.forEach((cb) => cb({ type, data }));
    } catch {
      listeners.forEach((cb) => cb({ type, data: event.data }));
    }
  };

  es.onerror = () => {
    es.close();
    eventSource = null;
    isConnecting = false;
    // Reconnexion après 3 secondes si l'utilisateur est toujours le même.
    if (currentUserId !== null && currentJwt) {
      reconnectTimeout = setTimeout(() => {
        connectSSE(currentUserId!, currentJwt!);
      }, 3000);
    }
  };

  eventSource = es;
}

/**
 * Ferme la connexion SSE et annule toute reconnexion en attente.
 * Appelée à la déconnexion ou au changement d'utilisateur.
 */
export function disconnectSSE(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  isConnecting = false;
  currentJwt = null;
  currentUserId = null;
  listeners = [];
}

/**
 * S'abonne aux événements SSE. Retourne une fonction de désabonnement.
 */
export function onSSEEvent(callback: (event: SseEvent) => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

/**
 * Indique si une connexion SSE est actuellement ouverte.
 */
export function isSSEConnected(): boolean {
  return eventSource?.readyState === EventSource.OPEN;
}
