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

  const url = new URL(`${API_URL}/api/sse/stream`);
  url.searchParams.set('jwt', encodeURIComponent(jwt));

  const es = new EventSource(url.toString());

  es.onopen = () => {
    isConnecting = false;
    console.log('[SSE] Connecté (utilisateur #' + userId + ')');
  };

  /**
   * Distribution d'un événement SSE aux abonnés de l'application.
   *
   * Le type de l'événement est celui du champ `event:` du flux SSE
   * (ex. 'nouvelle_demande').
   */
  const traiterEvenement = (event: MessageEvent) => {
    const type = event.type || "message";
    try {
      const data = JSON.parse(event.data);
      listeners.forEach((cb) => cb({ type, data }));
    } catch {
      listeners.forEach((cb) => cb({ type, data: event.data }));
    }
  };

  es.onmessage = traiterEvenement;

  // Les événements qui portent un NOM dans le champ `event:` ne déclenchent
  // PAS `onmessage` : le navigateur ne les distribue qu'aux écouteurs
  // enregistrés pour ce type précis (cf. spec EventSource). Sans cet
  // abonnement, l'événement « nouvelle_demande » n'arriverait jamais au
  // client et la notification n'apparaîtrait qu'au rechargement de la page
  // (réconciliation de l'outbox).
  //
  // L'abonnement est volontairement limité au flux « nouvelle demande » : les
  // autres types d'événements gardent exactement leur comportement actuel
  // (ils ne sont pas modifiés).
  es.addEventListener("nouvelle_demande", traiterEvenement as EventListener);

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
