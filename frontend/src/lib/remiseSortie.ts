/**
 * Remise de matériel au détenteur — règles métier PURES.
 *
 * Aucun React, aucun appel réseau ici : les fonctions sont testables seules.
 * Le composant `RemiseOrdreSortie` ne fait que l'orchestration (saisie,
 * envoi, conclusion sur l'état réel) ; toutes les décisions de règle
 * (quelles sorties sont à remettre, quel payload est envoyé, quelle date est
 * « aujourd'hui ») vivent ici.
 *
 * Rappel du circuit : le stock est débité à la VALIDATION LOGISTIQUE.
 * La remise ne touche donc JAMAIS au stock — elle ne fait qu'enregistrer
 * quand le matériel a été remis (et, le cas échéant, par quel mandataire).
 */

import type { SortieRecord } from "./movements";
import type { PayloadRemise } from "./api";

/** Statut affiché d'une sortie validée : le matériel est prêt à partir. */
export const STATUT_VALIDEE = "Validée";
/** Statut affiché d'une sortie déjà remise au détenteur. */
export const STATUT_REMISE = "Sortie effectuée";

/** Cette sortie attend-elle encore une remise au détenteur ? */
export function estARemettre(sortie: Pick<SortieRecord, "statut">): boolean {
  return sortie.statut === STATUT_VALIDEE;
}

/** Cette sortie a-t-elle déjà été remise (bon de sortie signé) ? */
export function estRemise(sortie: Pick<SortieRecord, "statut">): boolean {
  return sortie.statut === STATUT_REMISE;
}

/* ------------------------------------------------------------------ */
/* Date                                                                */
/* ------------------------------------------------------------------ */

/**
 * Date du jour au format YYYY-MM-DD, calculée en HEURE LOCALE.
 *
 * Volontairement pas de `toISOString()` : cette méthode donne la date UTC,
 * qui peut être la veille (entre 21:00 et 24:00 UTC, heure de Madagascar
 * UTC+3). La date de remise est une date civilement locale : on utilise
 * donc les accesseurs locaux (`getFullYear`, `getMonth`, `getDate`).
 */
export function dateDuJourLocal(date: Date = new Date()): string {
  const annee = String(date.getFullYear());
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${annee}-${mois}-${jour}`;
}

/** La date est-elle postérieure à la date de référence ? (comparaison de
 *  chaînes : le format YYYY-MM-DD se compare lexicographiquement). */
export function dateEstDansLeFutur(date: string, aujourdhui: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date > aujourdhui;
}

/* ------------------------------------------------------------------ */
/* Payload                                                             */
/* ------------------------------------------------------------------ */

/**
 * Construit le payload de remise à partir de la saisie.
 *
 * Le détenteur n'est plus saisi à la remise : il s'identifie lors de
 * l'affectation, après la réception physique. Seuls le mandataire
 * (optionnel) et la date de remise sont envoyés.
 *
 * Le mandataire est OPTIONNEL : s'il est vide, il n'est pas envoyé (le
 * serveur n'écrit alors rien). Les valeurs sont nettoyées (espaces de
 * début/fin) — c'est le serveur qui applique ses propres règles.
 */
export function construirePayloadRemise(champs: {
  mandataireNom: string;
  dateRemise: string;
}): PayloadRemise {
  const payload: PayloadRemise = {
    date_remise: champs.dateRemise,
  };
  const mandataire = (champs.mandataireNom ?? "").trim();
  if (mandataire) payload.mandataire_nom = mandataire;
  return payload;
}

/* ------------------------------------------------------------------ */
/* Traitement des erreurs                                              */
/* ------------------------------------------------------------------ */

/** Réponse d'erreur axios, vue de façon minimale. */
interface ErreurHttp {
  response?: {
    status?: number;
    data?: { error?: { message?: string } };
  };
}

/** Message renvoyé par le serveur, s'il y en a un. */
export function messageServeur(erreur: unknown, defaut: string): string {
  const reponse = (erreur as ErreurHttp | undefined)?.response;
  const message = reponse?.data?.error?.message;
  return typeof message === "string" && message.trim() ? message : defaut;
}

/**
 * Le résultat de l'envoi est-il INCERTAIN ?
 *
 * Incertain = aucune réponse du serveur (coupure, délai dépassé, CORS).
 * Le serveur a alors peut-être enregistré la remise avant que la connexion
 * ne tombe : on ne peut donc pas afficher « échec ». Il faut recharger
 * l'ordre et conclure sur son état RÉEL.
 */
export function estResultatIncertain(erreur: unknown): boolean {
  return !(erreur as ErreurHttp | undefined)?.response;
}

/** Code HTTP renvoyé par le serveur, s'il y en a un. */
export function codeHttp(erreur: unknown): number | undefined {
  return (erreur as ErreurHttp | undefined)?.response?.status;
}
