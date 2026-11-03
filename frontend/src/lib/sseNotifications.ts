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
let connectedUserId: number | null = null; // Track the user ID we're actually connected for

/**
 * Ouvre (ou rouvre) la connexion SSE pour l'utilisateur donné.
 * Appelée à la connexion d'un Demandeur.
 */
export function connectSSE(userId: number, jwt: string): void {
  console.log('[SSE] connectSSE appelé pour userId:', userId, '| état:', {
    connectedUserId,
    eventSourceReady: eventSource?.readyState,
    isConnecting,
    currentUserId
  });

  // Si déjà connecté pour cet utilisateur, ne rien faire.
  if (connectedUserId === userId && eventSource?.readyState === EventSource.OPEN) {
    console.log('[SSE] Déjà connecté pour cet utilisateur, ignoré');
    return;
  }
  // Si une connexion est en cours pour le même user, ne pas en créer une nouvelle.
  if (isConnecting && currentUserId === userId) {
    console.log('[SSE] Connexion en cours pour cet utilisateur, ignoré');
    return;
  }
  // Si on change d'utilisateur, déconnecter l'ancien d'abord.
  if (connectedUserId !== null && connectedUserId !== userId) {
    console.log('[SSE] Changement d\'utilisateur, déconnexion de l\'ancien:', connectedUserId)
    disconnectSSE();
  }

  isConnecting = true;
  currentJwt = jwt;
  currentUserId = userId;

  const url = new URL(`${API_URL}/api/sse/stream`);
  url.searchParams.set('jwt', encodeURIComponent(jwt));

  const es = new EventSource(url.toString());

  es.onopen = () => {
    isConnecting = false;
    connectedUserId = userId;
    console.log('[SSE] ✅ Connecté avec succès (utilisateur #' + userId + ')');
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
  // enregistrés pour ce type précis (cf. spec EventSource).
  // On doit donc s'abonner explicitement à CHAQUE type d'événement utilisé.
  const eventTypes = [
    "nouvelle_demande",
    "demande_aboutie",
    "ordre_pret_distribution",
    "ordre_sortie_autorise",
    "preparation_terminee",
    "preparation_rejetee",
  ];
  for (const type of eventTypes) {
    es.addEventListener(type, traiterEvenement as EventListener);
  }

  es.onerror = () => {
    es.close();
    eventSource = null;
    isConnecting = false;
    // Reconnexion après 3 secondes si l'utilisateur courant a toujours un JWT valide.
    // On vérifie currentUserId (l'utilisateur pour lequel on VEUT se connecter)
    // et pas connectedUserId (qui n'est défini qu'après onopen réussi).
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
  console.log('[SSE] disconnectSSE appelé, état actuel:', {
    hasEventSource: !!eventSource,
    readyState: eventSource?.readyState,
    isConnecting,
    currentUserId,
    connectedUserId,
    listenersCount: listeners.length
  });

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (eventSource) {
    console.log('[SSE] Fermeture de la connexion EventSource')
    eventSource.close();
    eventSource = null;
  }
  isConnecting = false;
  currentJwt = null;
  currentUserId = null;
  connectedUserId = null;
  listeners = [];

  console.log('[SSE] Déconnexion terminée, état nettoyé')
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
