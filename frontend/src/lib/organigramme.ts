// ---------------------------------------------------------------------------
// Organigramme : DIRECTION → SERVICE → RESPONSABLES
//
// Source principale : l'API Strapi (fetchDirections / fetchServices dans
// src/lib/api.ts). Ce module fournit :
//  - un référentiel de repli hors ligne (formulaire toujours utilisable),
//  - le filtrage « les services dépendent de la direction sélectionnée »,
//  - la résolution automatique des responsables d'un service
//    (Dépositaire du service, Chef de service 1, Chef de service 2).
//
// Aucun « Dépositaire général » : l'entrée se fait au niveau du service.
// ---------------------------------------------------------------------------

import type { RefOption } from "./api";

const DEMO_PREFIXE = "demo-";

export interface DirectionDemo extends RefOption {
  libelle: string;
  services: RefOption[];
}

/**
 * Référentiel de démonstration (repli quand l'API est injoignable).
 * Exemple de la spécification : DAF → Comptabilité, Ressources Humaines,
 * Informatique, Logistique.
 */
export const DIRECTIONS_DEMO: DirectionDemo[] = [
  {
    documentId: `${DEMO_PREFIXE}dir-daf`,
    nom: "DAF",
    libelle: "Direction des Affaires Administratives",
    directeur: "Directeur DAF",
    services: [
      {
        documentId: `${DEMO_PREFIXE}svc-daf-compta`,
        nom: "Comptabilité",
        directionId: `${DEMO_PREFIXE}dir-daf`,
        depositaire: "Jean Rakoto",
        responsable: "Responsable Comptabilité",
        chefService1: "Responsable Comptabilité",
        chefService2: "Chef de service adjoint",
      },
      {
        documentId: `${DEMO_PREFIXE}svc-daf-rh`,
        nom: "Ressources Humaines",
        directionId: `${DEMO_PREFIXE}dir-daf`,
        depositaire: "Hery Rasoa",
        responsable: "Responsable RH",
        chefService1: "Responsable RH",
        chefService2: "Chef de service adjoint",
      },
      {
        documentId: `${DEMO_PREFIXE}svc-daf-it`,
        nom: "Informatique",
        directionId: `${DEMO_PREFIXE}dir-daf`,
        depositaire: "Mialy Andria",
        responsable: "Responsable Informatique",
        chefService1: "Responsable Informatique",
        chefService2: "Chef de service adjoint",
      },
      {
        documentId: `${DEMO_PREFIXE}svc-daf-log`,
        nom: "Logistique",
        directionId: `${DEMO_PREFIXE}dir-daf`,
        depositaire: "Tovo Ranaivo",
        responsable: "Responsable Logistique",
        chefService1: "Responsable Logistique",
        chefService2: "Chef de service adjoint",
      },
    ],
  },
  {
    documentId: `${DEMO_PREFIXE}dir-drh`,
    nom: "DRH",
    libelle: "Direction des Ressources Humaines",
    directeur: "Directeur DRH",
    services: [
      {
        documentId: `${DEMO_PREFIXE}svc-drh-rh`,
        nom: "Ressources Humaines",
        directionId: `${DEMO_PREFIXE}dir-drh`,
        depositaire: "Noro Hainga",
        responsable: "Responsable DRH",
        chefService1: "Responsable DRH",
        chefService2: "Chef de service adjoint",
      },
      {
        documentId: `${DEMO_PREFIXE}svc-drh-admin`,
        nom: "Administration",
        directionId: `${DEMO_PREFIXE}dir-drh`,
        depositaire: "Lova Andriam",
        responsable: "Responsable Administration",
        chefService1: "Responsable Administration",
        chefService2: "Chef de service adjoint",
      },
    ],
  },
  {
    documentId: `${DEMO_PREFIXE}dir-dsi`,
    nom: "DSI",
    libelle: "Direction des Systèmes d'Information",
    directeur: "Directeur DSI",
    services: [
      {
        documentId: `${DEMO_PREFIXE}svc-dsi-dev`,
        nom: "Développement",
        directionId: `${DEMO_PREFIXE}dir-dsi`,
        depositaire: "Faly Rakoto",
        responsable: "Responsable Développement",
        chefService1: "Responsable Développement",
        chefService2: "Chef de service adjoint",
      },
      {
        documentId: `${DEMO_PREFIXE}svc-dsi-exp`,
        nom: "Exploitation",
        directionId: `${DEMO_PREFIXE}dir-dsi`,
        depositaire: "Haja Nira",
        responsable: "Responsable Exploitation",
        chefService1: "Responsable Exploitation",
        chefService2: "Chef de service adjoint",
      },
    ],
  },
];

/** Directions du repli hors ligne */
export const DIRECTIONS_REPLI: RefOption[] = DIRECTIONS_DEMO.map((d) => ({
  documentId: d.documentId,
  nom: d.nom,
  directeur: d.directeur,
}));

/** Services du repli hors ligne (déjà rattachés à leur direction) */
export const SERVICES_REPLI: RefOption[] = DIRECTIONS_DEMO.flatMap(
  (d) => d.services
);

/** true si l'identifiant provient du référentiel de repli (pas de l'API) */
export function estIdentifiantRepli(id: string): boolean {
  return !id || id.startsWith(DEMO_PREFIXE);
}

/**
 * Règle métier : le service dépend de la direction sélectionnée.
 * Seuls les services de la direction choisie sont proposés.
 * Si aucun service n'est rattaché (API non peuplée), on n'empêche pas
 * l'utilisateur de continuer : la liste complète est laissée.
 */
export function filtrerServicesParDirection(
  services: RefOption[],
  directionId: string
): RefOption[] {
  if (!directionId) return services;
  const rattaches = services.filter((s) => !!s.directionId);
  if (rattaches.length === 0) return services;
  return services.filter((s) => s.directionId === directionId);
}

export interface ResponsablesService {
  depositaire: string;
  chefService1: string;
  chefService2: string;
}

/**
 * Responsables automatiques d'un service (récupérés dès la sélection de la
 * Direction et du Service) : Dépositaire du service, Chef de service 1,
 * Chef de service 2. Replis successifs : champs dédiés → responsable du
 * service → directeur de la direction.
 */
export function responsablesDuService(
  service: RefOption | undefined,
  direction?: RefOption
): ResponsablesService {
  const depositaire =
    service?.depositaire || service?.responsable || direction?.directeur || "";
  const chefService1 = service?.chefService1 || service?.responsable || "";
  const chefService2 =
    service?.chefService2 || direction?.directeur || service?.responsable || "";
  return { depositaire, chefService1, chefService2 };
}
