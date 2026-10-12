// fake-apis.ts
// Simulation des API Strapi pour les tests côté frontend.
// Ces fonctions retournent des données simulées en mémoire, jamais issues du
// localStorage ni de la base réelle. Elles sont utilisées par les tests pour
// vérifier le comportement du Journal sans appeler le backend.

import type { EntreeRecord, SortieRecord } from "./movements";
import type { EchecApi } from "./api";

// ---------------------------------------------------------------------------
// Simulation de fetchEntrees()
// ---------------------------------------------------------------------------

/** Simule fetchEntrees() avec une liste d'entrées valides. */
export function simulateFetchEntrees(
  entrees: EntreeRecord[] = [],
  erreur?: EchecApi
): Promise<EntreeRecord[] | null> {
  if (erreur) {
    return Promise.resolve(null);
  }
  return Promise.resolve(entrees);
}

/** Simule fetchEntrees() avec succès et quelques entrées valides. */
export async function entreesSimulatees(): Promise<EntreeRecord[]> {
  return [
    {
      id: "ENT-2026-0001",
      reference: "ENT-2026-0001",
      dateEntree: "2026-02-15",
      materiel: "Ordinateur portable professionnel",
      categorie: "Informatique",
      quantite: 5,
      fournisseur: "TechnoFournisseur SARL",
      numeroFacture: "BC-2026-015",
      direction: "DAF - Service Comptabilité Matière",
      service: "Service Comptabilité Matière",
      statut: "Validée",
      responsable: "Rakotomalala Hery",
      documents: [
        { nom: "BC-2026-015", type: "Bon de livraison" },
        { nom: "FAC-2026-015", type: "Facture / pièce justificative" },
      ],
      signatures: {
        depositaire: "2026-02-15T10:15:00",
        chefService1: "2026-02-15T11:05:00",
        chefService2: "2026-02-15T14:30:00",
      },
      statutServeur: "validee",
    },
    {
      id: "ENT-2026-0002",
      reference: "ENT-2026-0002",
      dateEntree: "2026-02-20",
      materiel: "Imprimante laser couleur",
      categorie: "Bureautique",
      quantite: 2,
      fournisseur: "Bureau Solutions",
      numeroFacture: "BC-2026-016",
      direction: "DAF - Service Comptabilité Matière",
      service: "Service Comptabilité Matière",
      statut: "Validée",
      responsable: "Rakotomalala Hery",
      documents: [
        { nom: "BC-2026-016", type: "Bon de livraison" },
      ],
      signatures: {
        depositaire: "2026-02-20T09:00:00",
        chefService1: "2026-02-20T10:00:00",
        chefService2: "2026-02-20T11:00:00",
      },
      statutServeur: "validee",
    },
    {
      id: "ENT-2026-0003",
      reference: "ENT-2026-0003",
      dateEntree: "2026-03-01",
      materiel: "Téléphones IP Cisco",
      categorie: "Communication",
      quantite: 10,
      fournisseur: "Donation Entreprise Partenaire",
      numeroFacture: "DON-2026-001",
      direction: "DAF - Service Comptabilité Matière",
      service: "Service Comptabilité Matière",
      statut: "Validée",
      responsable: "Rakotomalala Hery",
      documents: [
        { nom: "DON-2026-001", type: "Acte de donation" },
      ],
      signatures: {
        depositaire: "2026-03-01T14:00:00",
        chefService1: "2026-03-01T15:00:00",
        chefService2: "2026-03-01T16:00:00",
      },
      statutServeur: "validee",
    },
    {
      id: "ENT-2026-0004",
      reference: "ENT-2026-0004",
      dateEntree: "2026-03-10",
      materiel: "Écrans Dell UltraSharp 24 pouces",
      categorie: "Informatique",
      quantite: 8,
      fournisseur: "Digital Store",
      numeroFacture: "BC-2026-017",
      direction: "DAF - Service Comptabilité Matière",
      service: "Service Comptabilité Matière",
      statut: "Validée",
      responsable: "Rakotomalala Hery",
      documents: [
        { nom: "BC-2026-017", type: "Bon de livraison" },
        { nom: "FAC-2026-017", type: "Facture / pièce justificative" },
      ],
      signatures: {
        depositaire: "2026-03-10T10:00:00",
        chefService1: "2026-03-10T11:00:00",
        chefService2: "2026-03-10T14:00:00",
      },
      statutServeur: "validee",
    },
  ];
}

/** Simule fetchEntrees() avec succès et des entrées en cours. */
export async function entreesEnCourSimulatees(): Promise<EntreeRecord[]> {
  return [
    {
      id: "ENT-2026-0005",
      reference: "ENT-2026-0005",
      dateEntree: "2026-03-15",
      materiel: "Claviers Logitech MX Keys",
      categorie: "Périphériques",
      quantite: 5,
      fournisseur: "Fournisseur Claviers",
      numeroFacture: "—",
      direction: "DAF - Service Comptabilité Matière",
      service: "Service Comptabilité Matière",
      statut: "En attente",
      responsable: "Rakotomalala Hery",
      documents: [],
      signatures: {
        depositaire: "2026-03-15T10:00:00",
      },
      statutServeur: "en_attente",
    },
    {
      id: "ENT-2026-0006",
      reference: "ENT-2026-0006",
      dateEntree: "2026-03-20",
      materiel: "Souris sans fil",
      categorie: "Périphériques",
      quantite: 10,
      fournisseur: "Fournisseur Souris",
      numeroFacture: "—",
      direction: "DAF - Service Comptabilité Matière",
      service: "Service Comptabilité Matière",
      statut: "Vérifiée",
      responsable: "Rakotomalala Hery",
      documents: [
        { nom: "BC-2026-006", type: "Bon de livraison" },
      ],
      signatures: {
        depositaire: "2026-03-20T09:00:00",
        chefService1: "2026-03-20T10:00:00",
      },
      statutServeur: "verifiee",
    },
  ];
}

/** Simule fetchEntrees() avec succès et un mélange d'entrées valides et en cours. */
export async function entreesMelangees(): Promise<EntreeRecord[]> {
  const validees = await entreesSimulatees();
  const enCour = await entreesEnCourSimulatees();
  return [...validees, ...enCour];
}

// ---------------------------------------------------------------------------
// Simulation de fetchSorties()
// ---------------------------------------------------------------------------

/** Simule fetchSorties() avec une liste de sorties effectuées. */
export async function sortiesSimulatees(): Promise<SortieRecord[]> {
  return [
    {
      id: "SORT-2026-0001",
      reference: "SORT-2026-0001",
      dateSortie: "2026-02-20",
      materiel: "Ordinateur portable HP",
      categorie: "Informatique",
      quantite: 2,
      serviceDemandeur: "Service du Personnel",
      direction: "DAF - Service Comptabilité Matière",
      demandeId: 1,
      demandeur: "Randriamampionona Tolotra",
      beneficiaire: "Randriamampionona Tolotra",
      responsable: "Rakotomalala Hery",
      statut: "Sortie effectuée",
      justificatif: "Demande DEM-2026-001 validée",
      documents: [
        { nom: "Demande DEM-2026-001", type: "Demande associée" },
        { nom: "Bon de sortie SORT-2026-0001", type: "Bon de sortie" },
      ],
    },
    {
      id: "SORT-2026-0002",
      reference: "SORT-2026-0002",
      dateSortie: "2026-02-25",
      materiel: "Claviers Logitech MX Keys",
      categorie: "Périphériques",
      quantite: 3,
      serviceDemandeur: "Service Comptabilité",
      direction: "DAF - Service Comptabilité Matière",
      demandeId: 2,
      demandeur: "Rakotomalala Hery",
      beneficiaire: "Rakotomalala Hery",
      responsable: "Rakotomalala Hery",
      statut: "Sortie effectuée",
      justificatif: "Demande DEM-2026-002 validée",
      documents: [],
    },
  ];
}

/** Simule fetchSorties() avec succès et une sortie effectuée. */
export async function sortiesEnCourSimulatees(): Promise<SortieRecord[]> {
  return [
    {
      id: "SORT-2026-0003",
      reference: "SORT-2026-0003",
      dateSortie: "2026-03-25",
      materiel: "Ergo Drako",
      categorie: "Périphériques",
      quantite: 1,
      serviceDemandeur: "Service RH",
      direction: "DAF - Service Comptabilité Matière",
      demandeId: 3,
      demandeur: "Rakotomalala Hery",
      beneficiaire: "Rakotomalala Hery",
      responsable: "Rakotomalala Hery",
      statut: "Demandée",
      justificatif: "—",
      documents: [],
    },
  ];
}

/** Simule fetchSorties() avec succès et un mélange de sorties effectuées et en attente. */
export async function sortiesMelangees(): Promise<SortieRecord[]> {
  const effectuees = await sortiesSimulatees();
  const enCour = await sortiesEnCourSimulatees();
  return [...effectuees, ...enCour];
}

// ---------------------------------------------------------------------------
// Simulation d'erreurs
// ---------------------------------------------------------------------------

/** Retourne une promesse qui échoue avec une erreur réseau. */
export function simulateError(echec: EchecApi = "reseau"): Promise<null> {
  return Promise.resolve(null);
}

/** Simule fetchEntrees() avec une erreur réseau. */
export async function fetchEntreesErreurReseau(): Promise<EntreeRecord[] | null> {
  return simulateError("reseau");
}

/** Simule fetchEntrees() avec une erreur session absente. */
export async function fetchEntreesErreurSessionAbsente(): Promise<EntreeRecord[] | null> {
  return simulateError("session_absente");
}

/** Simule fetchEntrees() avec une erreur session expirée. */
export async function fetchEntreesErreurSessionExpiree(): Promise<EntreeRecord[] | null> {
  return simulateError("session_expiree");
}

/** Simule fetchEntrees() avec une erreur accès refusé. */
export async function fetchEntreesErreurAccesRefuse(): Promise<EntreeRecord[] | null> {
  return simulateError("acces_refuse");
}

/** Simule fetchSorties() avec une erreur réseau. */
export async function fetchSortiesErreurReseau(): Promise<SortieRecord[] | null> {
  return simulateError("reseau");
}

/** Simule fetchSorties() avec une erreur session absente. */
export async function fetchSortiesErreurSessionAbsente(): Promise<SortieRecord[] | null> {
  return simulateError("session_absente");
}

/** Simule fetchSorties() avec une erreur session expirée. */
export async function fetchSortiesErreurSessionExpiree(): Promise<SortieRecord[] | null> {
  return simulateError("session_expiree");
}

/** Simule fetchSorties() avec une erreur accès refusé. */
export async function fetchSortiesErreurAccesRefuse(): Promise<SortieRecord[] | null> {
  return simulateError("acces_refuse");
}
