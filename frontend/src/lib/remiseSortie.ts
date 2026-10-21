/**
 * Remise de matériel au détenteur — règles métier PURES.
 *
 * Aucun React, aucun appel réseau ici : les fonctions sont testables seules.
 * Le composant `RemiseOrdreSortie` ne fait que l'orchestration (saisie,
 * envoi, conclusion sur l'état réel) ; toutes les décisions de règle
 * (quelles sorties sont à remettre, qui peut être proposé comme détenteur,
 * quel payload est envoyé, quelle date est « aujourd'hui ») vivent ici.
 *
 * Rappel du circuit : le stock est débité à la VALIDATION LOGISTIQUE.
 * La remise ne touche donc JAMAIS au stock — elle ne fait qu'enregistrer
 * qui a reçu le matériel, et quand.
 */

import type { SortieRecord } from "./movements";
import type { PayloadRemise, RefOption } from "./api";

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
/* Détenteur : données de référence et proposition                      */
/* ------------------------------------------------------------------ */

/** Personne susceptible d'être proposée comme détenteur du matériel. */
export interface CandidatDetenteur {
  /** Nom du détenteur. */
  nom: string;
  /** Fonction du détenteur (« Dépositaire », « Directeur », …). */
  fonction?: string;
  /** Nom de la direction d'affectation. */
  direction?: string;
  /** Nom du service d'affectation. */
  service?: string;
}

/** Proposition de pré-remplissage des champs « Nom » / « Fonction ». */
export interface PropositionDetenteur {
  nom: string;
  fonction: string;
}

/**
 * Normalise une chaîne pour la comparaison : insensible à la casse, aux
 * accents et aux espaces multiples. Le backend fait de même dans
 * `resoudreOrganigramme` — d'où la même approche ici, car les relations de
 * la sortie (direction, service) ne portent que des NOMS.
 */
function normaliser(valeur: string | null | undefined): string {
  return (valeur ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim()
    .toLowerCase();
}

/** Un nom vaut-il quelque chose (pas vide, pas le tiret des valeurs absentes) ? */
function nomExploitable(valeur: string | null | undefined): boolean {
  const normalisee = normaliser(valeur);
  return normalisee !== "" && normalisee !== "-" && normalisee !== "—";
}

/**
 * Propose un détenteur pour une sortie.
 *
 * Ordre de recherche : le SERVICE destinataire d'abord (c'est lui qui porte
 * le dépositaire, c'est-à-dire la personne qui reçoit matériellement le
 * matériel), puis la DIRECTION destinataire (le directeur y tient lieu de
 * responsable de repli — même chaîne que `responsablesDuService`).
 *
 * Renvoie `null` quand aucune donnée ne relie un compte à la destination :
 * les champs restent alors vides et l'utilisateur saisit le détenteur.
 */
export function proposerDetenteur(
  sortie: Pick<SortieRecord, "direction" | "serviceDemandeur">,
  personnes: CandidatDetenteur[]
): PropositionDetenteur | null {
  const candidatsValides = personnes.filter((personne) => nomExploitable(personne.nom));
  if (candidatsValides.length === 0) return null;

  // 1. Le service destinataire porte le dépositaire : c'est le bon titulaire.
  if (nomExploitable(sortie.serviceDemandeur)) {
    const cible = normaliser(sortie.serviceDemandeur);
    const duService = candidatsValides.find(
      (personne) => normaliser(personne.service) === cible
    );
    if (duService) return propositionDepuisCandidat(duService);
  }

  // 2. À défaut, le responsable de la direction destinataire. On privilégie
  //    le responsable PROPRE de la direction (le directeur) : le dépositaire
  //    d'un autre service de cette direction ne reçoit pas le matériel.
  if (nomExploitable(sortie.direction)) {
    const cible = normaliser(sortie.direction);
    const deLaDirection = candidatsValides.find(
      (personne) =>
        normaliser(personne.direction) === cible && !nomExploitable(personne.service)
    );
    if (deLaDirection) return propositionDepuisCandidat(deLaDirection);

    // Dernier recours : n'importe quel responsable rattaché à la direction.
    const autreResponsable = candidatsValides.find(
      (personne) => normaliser(personne.direction) === cible
    );
    if (autreResponsable) return propositionDepuisCandidat(autreResponsable);
  }

  return null;
}

/** Construit la proposition à partir d'un candidat. */
function propositionDepuisCandidat(candidat: CandidatDetenteur): PropositionDetenteur {
  return {
    nom: candidat.nom.trim(),
    fonction: (candidat.fonction ?? "").trim() || "Dépositaire",
  };
}

/**
 * Convertit le référentiel (services + directions) en liste de candidats
 * détenteurs.
 *
 * Le référentiel ne relie aujourd'hui PAS un compte à une direction de façon
 * exploitable pour la remise : on ne dispose que des NOMS des responsables
 * portés par les services et les directions. La fonction reste donc
 * best-effort — voir « À régler ensuite » dans le rapport de livraison.
 */
export function personnesDepuisReferentiel(
  services: RefOption[],
  directions: RefOption[]
): CandidatDetenteur[] {
  const nomParDirection = new Map<string, string>();
  for (const direction of directions) {
    nomParDirection.set(direction.documentId, direction.nom);
  }

  const personnes: CandidatDetenteur[] = [];

  // Le dépositaire du service : le destinataire réel du matériel.
  for (const service of services) {
    const nom = (service.depositaire ?? "").trim();
    if (!nom) continue;
    personnes.push({
      nom,
      fonction: "Dépositaire",
      direction: service.directionId
        ? nomParDirection.get(service.directionId)
        : undefined,
      service: service.nom,
    });
  }

  // Le directeur de la direction : responsable de repli.
  for (const direction of directions) {
    const nom = (direction.directeur ?? "").trim();
    if (!nom) continue;
    personnes.push({
      nom,
      fonction: "Directeur",
      direction: direction.nom,
    });
  }

  return personnes;
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
 * Le mandataire est OPTIONNEL : s'il est vide, il n'est pas envoyé (le
 * serveur n'écrit alors rien). Les valeurs sont nettoyées (espaces de
 * début/fin) — c'est le serveur qui applique ses propres règles.
 */
export function construirePayloadRemise(champs: {
  detenteurNom: string;
  detenteurFonction: string;
  mandataireNom: string;
  dateRemise: string;
}): PayloadRemise {
  const payload: PayloadRemise = {
    detenteur_nom: (champs.detenteurNom ?? "").trim(),
    detenteur_fonction: (champs.detenteurFonction ?? "").trim(),
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
