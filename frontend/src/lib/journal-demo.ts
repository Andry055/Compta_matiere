// journal-demo.ts
// Données de démonstration pour les tests du Journal.
// Ces données sont purement fictives et servent uniquement à illustrer le
// comportement attendu du Journal. Elles ne sont JAMAIS utilisées en production
// ni sauvegardées dans le localStorage.

import type { EntreeRecord } from "./movements";

// ---------------------------------------------------------------------------
// Écritures valides (simulent des entrées déjà validées par les 3 signatures)
// ---------------------------------------------------------------------------

/** Écriture valide n° 1 : ordinateur portable professionnel. */
export const entreeValide1: EntreeRecord = {
  id: "ENT-2026-0001",
  reference: "ENT-2026-0001",
  dateEntree: "2026-01-15",
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
    depositaire: "2026-01-15T10:15:00",
    chefService1: "2026-01-15T11:05:00",
    chefService2: "2026-01-15T14:30:00",
  },
  statutServeur: "validee",
};

/** Écriture valide n° 2 : imprimante laser couleur. */
export const entreeValide2: EntreeRecord = {
  id: "ENT-2026-0002",
  reference: "ENT-2026-0002",
  dateEntree: "2026-01-20",
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
    depositaire: "2026-01-20T09:00:00",
    chefService1: "2026-01-20T10:00:00",
    chefService2: "2026-01-20T11:00:00",
  },
  statutServeur: "validee",
};

/** Écriture valide n° 3 : téléphones IP Cisco (donation). */
export const entreeValide3: EntreeRecord = {
  id: "ENT-2026-0003",
  reference: "ENT-2026-0003",
  dateEntree: "2026-02-01",
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
    depositaire: "2026-02-01T14:00:00",
    chefService1: "2026-02-01T15:00:00",
    chefService2: "2026-02-01T16:00:00",
  },
  statutServeur: "validee",
};

/** Écriture valide n° 4 : écrans Dell UltraSharp (retour maintenance). */
export const entreeValide4: EntreeRecord = {
  id: "ENT-2026-0004",
  reference: "ENT-2026-0004",
  dateEntree: "2026-02-10",
  materiel: "Écrans Dell UltraSharp 24 pouces",
  categorie: "Informatique",
  quantite: 8,
  fournisseur: "Retour maintenance",
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
    depositaire: "2026-02-10T10:00:00",
    chefService1: "2026-02-10T11:00:00",
    chefService2: "2026-02-10T12:00:00",
  },
  statutServeur: "validee",
};

// ----------------------------------------------------------------------- groupe
// Écritures en cours (non validées)
// ----------------------------------------------------------------------- groupe

/** Écriture en attente n° 1 : claviers Logitech. */
export const entreeEnAttente1: EntreeRecord = {
  id: "ENT-2026-0005",
  reference: "ENT-2026-0005",
  dateEntree: "2026-02-15",
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
    depositaire: "2026-02-15T10:00:00",
  },
  statutServeur: "en_attente",
};

/** Écriture en attente n° 2 : souris sans fil. */
export const entreeEnAttente2: EntreeRecord = {
  id: "ENT-2026-0006",
  reference: "ENT-2026-0006",
  dateEntree: "2026-02-20",
  materiel: "Souris sans fil",
  categorie: "Périphériques",
  quantite: 10,
  fournisseur: "Fournisseur Souris",
  numeroFacture: "—",
  direction: "DAF - Service Comptabilité Matière",
  service: "Service Comptabilité Matière",
  statut: "En attente",
  responsable: "Rakotomalala Hery",
  documents: [],
  signatures: {
    depositaire: "2026-02-20T09:00:00",
  },
  statutServeur: "en_attente",
};

/** Écriture vérifiée n° 1 : webcam Logitech. */
export const entreeVerifiee1: EntreeRecord = {
  id: "ENT-2026-0007",
  reference: "ENT-2026-0007",
  dateEntree: "2026-02-25",
  materiel: "Webcam Logitech C920",
  categorie: "Périphériques",
  quantite: 3,
  fournisseur: "Fournisseur Webcams",
  numeroFacture: "BC-2026-007",
  direction: "DAF - Service Comptabilité Matière",
  service: "Service Comptabilité Matière",
  statut: "Vérifiée",
  responsable: "Rakotomalala Hery",
  documents: [
    { nom: "BC-2026-007", type: "Bon de livraison" },
  ],
  signatures: {
    depositaire: "2026-02-25T10:00:00",
    chefService1: "2026-02-25T11:00:00",
  },
  statutServeur: "verifiee",
};

// ---------------------------------------------------------------------------
// Liste complète des entrées de démonstration
// ---------------------------------------------------------------------------

/** Ensemble des entrées de démonstration (valides + en cours). */
export const entreesDemo: EntreeRecord[] = [
  entreeValide1,
  entreeValide2,
  entreeValide3,
  entreeValide4,
  entreeEnAttente1,
  entreeEnAttente2,
  entreeVerifiee1,
];

/** Seulement les entrées validées (pour les tests du registre). */
export const entreesValideesDemo: EntreeRecord[] = [
  entreeValide1,
  entreeValide2,
  entreeValide3,
  entreeValide4,
];

/** Seulement les entrées en cours (pour les tests de l'onglet "Non comptabilisées"). */
export const entreesEnCourDemo: EntreeRecord[] = [
  entreeEnAttente1,
  entreeEnAttente2,
  entreeVerifiee1,
];
