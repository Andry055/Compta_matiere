// ---------------------------------------------------------------------------
// Entrées / Sorties / Traçabilité
//
// Source unique de vérité pour les pages « Entrées » et « Sorties ».
// Les lignes reprennent les données déjà présentes dans l'application
// (Journal comptable, Mouvements, Mes Mouvements, Demandes) : mêmes
// références, mêmes matériels, mêmes fournisseurs, mêmes bénéficiaires.
// Les colonnes structurelles manquantes (direction, service, responsable)
// sont dérivées de ces données ; les tables Strapi correspondantes sont
// décrites dans backend/src/api/* et remplaceront ces données locales
// dès que le frontend sera branché sur l'API (voir src/lib/api.ts).
// ---------------------------------------------------------------------------

import { Request } from "./requests";

export type StatutEntree =
  | "Brouillon"
  | "En attente"
  | "Vérifiée"
  | "Validée"
  | "Rejetée";
export type StatutSortie =
  | "Demandée"
  | "En préparation"
  | "Validée"
  | "Sortie effectuée"
  | "Annulée";

export const STATUTS_ENTREE: StatutEntree[] = [
  "Brouillon",
  "En attente",
  "Vérifiée",
  "Validée",
  "Rejetée",
];

export const STATUTS_SORTIE: StatutSortie[] = [
  "Demandée",
  "En préparation",
  "Validée",
  "Sortie effectuée",
  "Annulée",
];

/** Ligne d'historique : date, utilisateur, action, matériel, quantité, statut, référence */
export interface TraceEvent {
  date: string;
  utilisateur: string;
  action: string;
  materiel: string;
  quantite: number;
  statut: string;
  reference: string;
}

export interface DocumentRef {
  nom: string;
  type: string;
}

/** Ligne matérielle d'une entrée (tableau « ORDRE D'ENTRÉE ») */
export interface EntreeLigne {
  numeroOrdre: number;
  /** Référence du bien (ex. MAT-2026-001) */
  reference?: string;
  designation: string;
  espece: string;
  unite: string;
  quantite: number;
  prixUnitaire: number;
  montant: number;
  nomenclature: string;
  pieceJustificative: string;
  observation: string;
}

/**
 * Informations administratives du modèle « ORDRE D'ENTRÉE » :
 * chapitre, journal, budget, SOA, type d'opération, documents.
 */
export interface EntreeAdmin {
  numeroChapitre: string;
  libelleChapitre: string;
  subdivisionChapitre: string;
  numeroOrdreJournal: string;
  budgetGeneral: string;
  soa: string;
  typeOperation: "materiel_en_approvisionnement" | "materiel_en_service" | "";
  adresseFournisseur: string;
  dateFacture: string;
  bonLivraison: string;
  dateBonLivraison: string;
  referenceMarche: string;
  pieceJustificative: string;
  declarationNom: string;
  declarationFonction: string;
  declarationDate: string;
  /** Motif de l'entrée (acquisition, don, retour, transfert…) */
  motifEntree: string;
  /** Observations complémentaires saisies à l'étape 5 */
  observations: string;
}

export const ENTREE_ADMIN_VIDE: EntreeAdmin = {
  numeroChapitre: "",
  libelleChapitre: "",
  subdivisionChapitre: "",
  numeroOrdreJournal: "",
  budgetGeneral: "",
  soa: "",
  typeOperation: "",
  adresseFournisseur: "",
  dateFacture: "",
  bonLivraison: "",
  dateBonLivraison: "",
  referenceMarche: "",
  pieceJustificative: "",
  declarationNom: "",
  declarationFonction: "",
  declarationDate: "",
  motifEntree: "",
  observations: "",
};

/** Étiquettes lisibles du type d'opération */
export const TYPE_OPERATION_LABELS: Record<string, string> = {
  materiel_en_approvisionnement: "Matériel en approvisionnement",
  materiel_en_service: "Matériel en service",
};

export interface EntreeRecord {
  id: string;
  reference: string;
  dateEntree: string;
  materiel: string;
  categorie: string;
  quantite: number;
  fournisseur: string;
  numeroFacture: string;
  direction: string;
  service: string;
  statut: StatutEntree;
  responsable: string;
  documents: DocumentRef[];
  /**
   * Validation à trois signatures (Dépositaire, Chef de service 1,
   * Chef de service 2). La valeur est la date ISO de signature,
   * `undefined` = signature absente.
   */
  signatures?: {
    depositaire?: string;
    chefService1?: string;
    chefService2?: string;
  };
  /** Nom de chaque signataire (affiché sur les cartes de signature) */
  signataires?: {
    depositaire?: string;
    chefService1?: string;
    chefService2?: string;
  };
  /** Service / direction affecté à chaque validation (Dépositaire par service, chefs de service) */
  affectations?: {
    depositaire?: string;
    chefService1?: string;
    chefService2?: string;
  };
  /** Token unique du QR Code de l'entrée (aucune donnée sensible dedans) */
  qrToken?: string;
  /** Total valorisé de l'entrée (somme des montants des lignes) */
  total?: number;
  /** Informations administratives du modèle « ORDRE D'ENTRÉE » */
  admin?: EntreeAdmin;
  /** Lignes matérielles détaillées (vides pour les entrées de démonstration) */
  lignes?: EntreeLigne[];
}

export interface SortieRecord {
  id: string;
  reference: string;
  dateSortie: string;
  materiel: string;
  categorie: string;
  quantite: number;
  serviceDemandeur: string;
  direction: string;
  /** Lien avec la demande d'origine (module Demandes) */
  demandeId?: number;
  demandeur?: string;
  beneficiaire: string;
  responsable: string;
  statut: StatutSortie;
  justificatif: string;
  documents: DocumentRef[];
  /** true = mouvement issu de « Mes Mouvements » donc dans le périmètre du Demandeur */
  dansMonPerimetre?: boolean;
}

/** Découpe « Direction - Service » à partir des départements existants */
export function splitDepartement(dept: string): {
  direction: string;
  service: string;
} {
  const parts = dept.split(" - ");
  if (parts.length > 1) {
    return { direction: parts[0].trim(), service: parts.slice(1).join(" - ").trim() };
  }
  return { direction: dept.trim(), service: dept.trim() };
}

// ---------------------------------------------------------------------------
// Signatures des entrées (validation à trois signatures)
// ---------------------------------------------------------------------------

/** Les trois signatures obligatoires d'une entrée */
/** Libellés des rôles de validation — terme réglementaire : Dépositaire par service */
export const SIGNATURE_ROLE_LABELS = {
  depositaire: "Dépositaire par service",
  chefService1: "Chef de service 1",
  chefService2: "Chef de service 2",
} as const;

/** Les trois validations obligatoires d'une entrée (dans l'ordre du workflow) */
export const SIGNATURE_ROLES_ENTREE: Array<{
  key: "depositaire" | "chefService1" | "chefService2";
  label: string;
}> = [
  { key: "depositaire", label: SIGNATURE_ROLE_LABELS.depositaire },
  { key: "chefService1", label: SIGNATURE_ROLE_LABELS.chefService1 },
  { key: "chefService2", label: SIGNATURE_ROLE_LABELS.chefService2 },
];

export interface SignatureState {
  key: "depositaire" | "chefService1" | "chefService2";
  label: string;
  signed: boolean;
  date?: string;
}

/** État des 3 signatures d'une entrée */
export function getSignaturesEntree(e: EntreeRecord): SignatureState[] {
  return SIGNATURE_ROLES_ENTREE.map(({ key, label }) => ({
    key,
    label,
    signed: !!e.signatures?.[key],
    date: e.signatures?.[key],
  }));
}

/** Nombre de signatures obtenues (0/3, 1/3, 2/3, 3/3) */
export function getSignatureCount(e: EntreeRecord): number {
  return getSignaturesEntree(e).filter((s) => s.signed).length;
}

/**
 * Statut affiché d'une entrée (règle métier) :
 *  - 3/3  -> Validée
 *  - 1/3 ou 2/3 -> Partiellement signée
 *  - 0/3  -> En attente (brouillon : non soumis aux signatures)
 */
export function getStatutEntreeAffiche(e: EntreeRecord): string {
  if (e.statut === "Brouillon") return "Brouillon";
  if (e.statut === "Rejetée") return "Rejetée";
  const count = getSignatureCount(e);
  if (count >= 3) return "Validée";
  if (count >= 1) return "Partiellement signée";
  if (e.statut === "Validée") return "Validée";
  if (e.statut === "Vérifiée") return "Partiellement signée";
  return "En attente";
}

/** Badges de statut des entrées (dont « Partiellement signée ») */
export function statutEntreeBadge(statut: string): string {
  switch (statut) {
    case "Validée":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Partiellement signée":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "En attente":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "Brouillon":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "Rejetée":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

// ---------------------------------------------------------------------------
// Entrées de matériels
// ---------------------------------------------------------------------------

const DEPT_JOURNAL = "DAF - Service Comptabilité Matière";
const DEPT_MAGASIN = "DAF - Magasin & Entrepôt";

const entreeRows: Array<
  Omit<EntreeRecord, "direction" | "service"> & { dept: string }
> = [
  // -- issue de « Mes Mouvements » (entrées existantes) --------------------
  {
    id: "ENT-2025-001",
    reference: "ENT-2025-001",
    dateEntree: "2025-01-08",
    materiel: "Ordinateurs portables HP EliteBook",
    categorie: "Informatique",
    quantite: 15,
    fournisseur: "TechnoFournisseur SARL",
    numeroFacture: "BL#12345",
    dept: DEPT_MAGASIN,
    statut: "Validée",
    responsable: "Andriamampianina Fara",
    documents: [{ nom: "BL#12345", type: "Bon de livraison" }],
    signatures: {
      depositaire: "2025-01-08T10:15:00",
      chefService1: "2025-01-08T11:05:00",
      chefService2: "2025-01-08T14:30:00",
    },
  },
  {
    id: "ENT-2025-002",
    reference: "ENT-2025-002",
    dateEntree: "2025-01-08",
    materiel: 'Écrans Dell UltraSharp 24"',
    categorie: "Informatique",
    quantite: 5,
    fournisseur: "Distrib'IT France",
    numeroFacture: "—",
    dept: "IT - Développement",
    statut: "En attente",
    responsable: "Andriamampianina Fara",
    documents: [],
  },
  {
    id: "ENT-2025-003",
    reference: "ENT-2025-003",
    dateEntree: "2025-01-07",
    materiel: "Imprimantes Canon ImageClass",
    categorie: "Bureautique",
    quantite: 3,
    fournisseur: "Bureau Solutions",
    numeroFacture: "—",
    dept: "Finance - Comptabilité",
    statut: "En attente",
    responsable: "Rakotomalala Hery",
    documents: [],
    // 2/3 signatures obtenues -> Partiellement signée
    signatures: {
      depositaire: "2025-01-07T09:40:00",
      chefService1: "2025-01-07T15:10:00",
    },
  },
  {
    id: "ENT-2025-004",
    reference: "ENT-2025-004",
    dateEntree: "2025-01-05",
    materiel: "Webcams Logitech C920",
    categorie: "Périphériques",
    quantite: 20,
    fournisseur: "Matériel Express",
    numeroFacture: "—",
    dept: DEPT_MAGASIN,
    statut: "Validée",
    responsable: "Andriamampianina Fara",
    documents: [],
  },
  // -- issue du Journal comptable (entrées enregistrées) -------------------
  {
    id: "JE001",
    reference: "2024-001",
    dateEntree: "2024-01-15",
    materiel: "Ordinateur portable professionnel",
    categorie: "Informatique",
    quantite: 5,
    fournisseur: "TechnoFournisseur SARL",
    numeroFacture: "BC-2024-015",
    dept: DEPT_JOURNAL,
    statut: "Validée",
    responsable: "Rakotomalala Hery",
    documents: [
      { nom: "BC-2024-015", type: "Bon de commande / facture" },
      { nom: "Fiche de vérification 2024-001", type: "Vérification" },
    ],
  },
  {
    id: "JE002",
    reference: "2024-002",
    dateEntree: "2024-01-16",
    materiel: "Imprimante laser couleur",
    categorie: "Bureautique",
    quantite: 2,
    fournisseur: "Bureau Solutions",
    numeroFacture: "BC-2024-016",
    dept: DEPT_JOURNAL,
    statut: "Validée",
    responsable: "Rakotomalala Hery",
    documents: [{ nom: "BC-2024-016", type: "Bon de commande / facture" }],
  },
  {
    id: "JE003",
    reference: "2024-003",
    dateEntree: "2024-01-17",
    materiel: "Téléphones IP Cisco",
    categorie: "Communication",
    quantite: 10,
    fournisseur: "Donation Entreprise Partenaire",
    numeroFacture: "DON-2024-001",
    dept: DEPT_JOURNAL,
    statut: "Validée",
    responsable: "Rakotomalala Hery",
    documents: [{ nom: "DON-2024-001", type: "Acte de donation" }],
  },
  {
    id: "JE004",
    reference: "2024-004",
    dateEntree: "2024-01-18",
    materiel: "Écrans Dell UltraSharp 24 pouces",
    categorie: "Informatique",
    quantite: 8,
    fournisseur: "Digital Store",
    numeroFacture: "BC-2024-017",
    dept: DEPT_JOURNAL,
    statut: "Validée",
    responsable: "Rakotomalala Hery",
    documents: [{ nom: "BC-2024-017", type: "Bon de commande / facture" }],
  },
  {
    id: "JE005",
    reference: "2024-005",
    dateEntree: "2024-01-19",
    materiel: "Scanner Canon",
    categorie: "Bureautique",
    quantite: 1,
    fournisseur: "Retour maintenance",
    numeroFacture: "RET-2024-001",
    dept: DEPT_JOURNAL,
    statut: "Vérifiée",
    responsable: "Rakotomalala Hery",
    documents: [{ nom: "RET-2024-001", type: "Bon de retour maintenance" }],
    // 1/3 signature -> Partiellement signée
    signatures: { depositaire: "2024-01-19T11:20:00" },
  },
];

export const entreeRecords: EntreeRecord[] = entreeRows.map((row) => {
  const { dept, ...record } = row;
  const { direction, service } = splitDepartement(dept);
  return { ...record, direction, service };
});

// ---------------------------------------------------------------------------
// Sorties de matériels
// ---------------------------------------------------------------------------

const sortieRows: Array<SortieRecord> = [
  // -- sortie issue de la demande DEM-2025-014 (cycle demande -> sortie) ----
  {
    id: "SORT-2025-008",
    reference: "SORT-2025-008",
    dateSortie: "2025-01-08",
    materiel: "Ordinateur portable HP",
    categorie: "Informatique",
    quantite: 2,
    serviceDemandeur: "Service du Personnel",
    direction: "DRH",
    demandeId: 14,
    demandeur: "Randriamampionona Tolotra",
    beneficiaire: "Randriamampionona Tolotra",
    responsable: "Razafindrakoto Tojo",
    statut: "Sortie effectuée",
    justificatif: "Demande DEM-2025-014 validée",
    documents: [
      { nom: "Demande DEM-2025-014", type: "Demande associée" },
      { nom: "Bon de sortie SORT-2025-008", type: "Bon de sortie" },
    ],
  },
  // -- issue de « Mes Mouvements » (dans le périmètre du Demandeur) --------
  {
    id: "EXT-2025-003",
    reference: "EXT-2025-003",
    dateSortie: "2025-01-08",
    materiel: "Claviers Logitech MX Keys",
    categorie: "Périphériques",
    quantite: 8,
    serviceDemandeur: "Développement",
    direction: "IT",
    beneficiaire: "Pierre Dupont",
    responsable: "Razafindrakoto Tojo",
    statut: "Sortie effectuée",
    justificatif: "Remplacement équipement défaillant",
    documents: [],
    dansMonPerimetre: true,
  },
  {
    id: "EXT-2025-002",
    reference: "EXT-2025-002",
    dateSortie: "2025-01-07",
    materiel: "Souris sans fil",
    categorie: "Périphériques",
    quantite: 12,
    serviceDemandeur: "Comptabilité",
    direction: "Finance",
    beneficiaire: "Marie Martin",
    responsable: "Razafindrakoto Tojo",
    statut: "Sortie effectuée",
    justificatif: "Déploiement nouveau personnel",
    documents: [],
    dansMonPerimetre: true,
  },
  {
    id: "EXT-2025-001",
    reference: "EXT-2025-001",
    dateSortie: "2025-01-06",
    materiel: "Téléphones IP Cisco",
    categorie: "Communication",
    quantite: 6,
    serviceDemandeur: "Service Client",
    direction: "Service Client",
    beneficiaire: "Sophie Dubois",
    responsable: "Razafindrakoto Tojo",
    statut: "Sortie effectuée",
    justificatif: "Extension équipe support",
    documents: [],
    dansMonPerimetre: true,
  },
  {
    id: "EXT-2025-004",
    reference: "EXT-2025-004",
    dateSortie: "2025-01-05",
    materiel: "Casques audio professionnel",
    categorie: "Communication",
    quantite: 10,
    serviceDemandeur: "Communication",
    direction: "Marketing",
    beneficiaire: "Jean Moreau",
    responsable: "Razafindrakoto Tojo",
    statut: "Sortie effectuée",
    justificatif: "Matériel production vidéo",
    documents: [],
    dansMonPerimetre: true,
  },
  // -- issues du module Demandes (demande -> sortie) -----------------------
  {
    id: "SORT-DEM-002",
    reference: "—",
    dateSortie: "2025-01-19",
    materiel: "Imprimante Canon",
    categorie: "Bureautique",
    quantite: 1,
    serviceDemandeur: "Finance",
    direction: "Finance",
    demandeId: 2,
    demandeur: "Pierre Martin",
    beneficiaire: "Pierre Martin",
    responsable: "Jean Directeur",
    statut: "Validée",
    justificatif: "—",
    documents: [{ nom: "Demande n° 2", type: "Demande associée" }],
  },
  {
    id: "SORT-DEM-003",
    reference: "—",
    dateSortie: "2025-01-21",
    materiel: "Ordinateur portable Dell",
    categorie: "Informatique",
    quantite: 1,
    serviceDemandeur: "Service du Personnel",
    direction: "DRH",
    demandeId: 3,
    demandeur: "Randriamampionona Tolotra",
    beneficiaire: "Randriamampionona Tolotra",
    responsable: "—",
    statut: "Demandée",
    justificatif: "—",
    documents: [{ nom: "Demande n° 3", type: "Demande associée" }],
  },
  // -- issue des Mouvements (sorties en attente / validées) ----------------
  {
    id: "MOUV-S-002",
    reference: "—",
    dateSortie: "2025-01-20",
    materiel: "Clavier mécanique Logitech",
    categorie: "Périphériques",
    quantite: 1,
    serviceDemandeur: "Recrutement",
    direction: "RH",
    beneficiaire: "—",
    responsable: "Pierre Martin",
    statut: "Demandée",
    justificatif: "Transfert vers service comptabilité",
    documents: [],
  },
  {
    id: "MOUV-S-003",
    reference: "—",
    dateSortie: "2025-01-19",
    materiel: 'Écran Dell UltraSharp 24"',
    categorie: "Affichage",
    quantite: 1,
    serviceDemandeur: "Comptabilité",
    direction: "Finance",
    beneficiaire: "—",
    responsable: "Claire Manager",
    statut: "Validée",
    justificatif: "Défaillance écran - réparation",
    documents: [],
  },
];

export const sortieRecords: SortieRecord[] = sortieRows;

// ---------------------------------------------------------------------------
// Traçabilité
// ---------------------------------------------------------------------------

const ENTREE_CHAIN = [
  "Fournisseur",
  "Facture",
  "Réception",
  "Vérification",
  "Enregistrement",
  "Stock",
];

const ENTREE_ACTIONS = [
  "Fournisseur - livraison initiée",
  "Vérification de la facture / pièce justificative",
  "Réception du matériel",
  "Vérification de l'état et des quantités",
  "Enregistrement au journal comptable",
  "Mise à disposition du stock",
];

const ENTREE_STATUTS: Record<StatutEntree, string[]> = {
  "Brouillon": ["Terminé", "Conforme", "Réceptionné", "Brouillon", "Brouillon", "Brouillon"],
  "En attente": ["Terminé", "Conforme", "Réceptionné", "En attente", "En attente", "En attente"],
  "Vérifiée": ["Terminé", "Conforme", "Réceptionné", "Vérifiée", "En attente", "En attente"],
  "Validée": ["Terminé", "Conforme", "Réceptionné", "Vérifiée", "Enregistrée", "En stock"],
  "Rejetée": ["Terminé", "Conforme", "Réceptionné", "Rejetée", "Non enregistrée", "Non mis en stock"],
};

const SORTIE_CHAIN = [
  "Demande",
  "Validation",
  "Préparation",
  "Sortie",
  "Bénéficiaire",
  "Historique",
];

const SORTIE_ACTIONS = [
  "Demande créée",
  "Validation de la demande",
  "Préparation du matériel",
  "Sortie du matériel",
  "Remise au bénéficiaire",
  "Historisation du mouvement",
];

const SORTIE_STATUTS: Record<StatutSortie, string[]> = {
  "Demandée": ["Créée", "En attente", "En attente", "En attente", "—", "—"],
  "En préparation": ["Créée", "Validée", "En préparation", "En attente", "—", "—"],
  "Validée": ["Créée", "Validée", "Préparée", "En attente", "—", "—"],
  "Sortie effectuée": ["Créée", "Validée", "Préparée", "Effectuée", "Remis", "Historisé"],
  "Annulée": ["Créée", "Validée", "Annulée", "—", "—", "—"],
};

/** Étapes de traçabilité d'une entrée : Fournisseur -> ... -> Stock */
export function getEntreeChain(e: EntreeRecord): Array<{
  etape: string;
  statut: string;
  ok: boolean;
}> {
  const statuts = ENTREE_STATUTS[e.statut];
  return ENTREE_CHAIN.map((etape, i) => ({
    etape,
    statut: statuts[i],
    ok: statuts[i] === "Terminé" || statuts[i] === "Conforme" || statuts[i] === "Réceptionné" ||
        statuts[i] === "Vérifiée" || statuts[i] === "Enregistrée" || statuts[i] === "En stock",
  }));
}

/** Étapes de traçabilité d'une sortie : Demande -> ... -> Historique */
export function getSortieChain(s: SortieRecord): Array<{
  etape: string;
  statut: string;
  ok: boolean;
}> {
  const statuts = SORTIE_STATUTS[s.statut];
  return SORTIE_CHAIN.map((etape, i) => ({
    etape,
    statut: statuts[i],
    ok: ["Créée", "Validée", "Préparée", "Effectuée", "Remis", "Historisé"].includes(statuts[i]),
  }));
}

/** Historique complet d'une entrée (date, utilisateur, action, matériel, quantité, statut, référence) */
export function getEntreeTrace(e: EntreeRecord): TraceEvent[] {
  const statuts = ENTREE_STATUTS[e.statut];
  return ENTREE_ACTIONS.map((action, i) => ({
    date: e.dateEntree,
    utilisateur: i <= 2 ? e.fournisseur : e.responsable,
    action,
    materiel: e.materiel,
    quantite: e.quantite,
    statut: statuts[i],
    reference: e.reference,
  }));
}

/** Historique complet d'une sortie */
export function getSortieTrace(s: SortieRecord): TraceEvent[] {
  const statuts = SORTIE_STATUTS[s.statut];
  const utilisateurs = [
    s.demandeur || s.beneficiaire || "—",
    s.responsable,
    s.responsable,
    s.responsable,
    s.beneficiaire,
    "Système / Journal",
  ];
  return SORTIE_ACTIONS.map((action, i) => ({
    date: s.dateSortie,
    utilisateur: utilisateurs[i],
    action,
    materiel: s.materiel,
    quantite: s.quantite,
    statut: statuts[i],
    reference: s.reference !== "—" ? s.reference : s.demandeId ? `Demande n° ${s.demandeId}` : s.id,
  }));
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

function dateOfRecord(record: EntreeRecord | SortieRecord): string {
  return (
    (record as EntreeRecord).dateEntree ||
    (record as SortieRecord).dateSortie ||
    ""
  );
}

function referenceDate(dates: string[]): string {
  const sorted = dates.filter(Boolean).sort();
  return sorted[sorted.length - 1] || new Date().toISOString().slice(0, 10);
}

/** Date la plus récente des mouvements (période de référence des indicateurs) */
export function getReferenceDate(): string {
  return referenceDate([...entreeRecords, ...sortieRecords].map(dateOfRecord));
}

function formatMois(isoDate: string): string {
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const d = new Date(isoDate);
  return `${mois[d.getMonth()]} ${d.getFullYear()}`;
}

/** Libellé du mois de référence (« janvier 2025 ») pour un jeu de mouvements */
export function getMoisLabel(
  records?: Array<EntreeRecord | SortieRecord>
): string {
  const source =
    records && records.length
      ? records
      : [...entreeRecords, ...sortieRecords];
  return formatMois(referenceDate(source.map(dateOfRecord)));
}

function estDuMemeMois(date: string, reference: string): boolean {
  return date.slice(0, 7) === reference.slice(0, 7);
}

export function getStatistiquesEntrees(records: EntreeRecord[] = entreeRecords) {
  const reference = referenceDate(records.map((e) => e.dateEntree));
  return {
    total: records.length,
    duMois: records.filter((e) => estDuMemeMois(e.dateEntree, reference)).length,
    enAttente: records.filter((e) => getStatutEntreeAffiche(e) === "En attente")
      .length,
    validees: records.filter((e) => getStatutEntreeAffiche(e) === "Validée")
      .length,
    partielles: records.filter(
      (e) => getStatutEntreeAffiche(e) === "Partiellement signée"
    ).length,
    moisLabel: formatMois(reference),
  };
}

export function getStatistiquesSorties(
  records: SortieRecord[] = sortieRecords
) {
  const reference = referenceDate(records.map((s) => s.dateSortie));
  return {
    total: records.length,
    duMois: records.filter((s) => estDuMemeMois(s.dateSortie, reference)).length,
    enAttente: records.filter(
      (s) => s.statut === "Demandée" || s.statut === "En préparation"
    ).length,
    validees: records.filter(
      (s) => s.statut === "Validée" || s.statut === "Sortie effectuée"
    ).length,
    moisLabel: formatMois(reference),
  };
}

// ---------------------------------------------------------------------------
// Formatage monétaire et document « Ordre d'entrée »
// ---------------------------------------------------------------------------

/** Formatage des montants en Ariary (fr-FR) */
export function formatMontant(valeur?: number | null): string {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Ar`;
}

const ORDRE_ENTREE_LABELS: Array<{ label: string; get: (e: EntreeRecord) => string }> = [
  { label: "Numéro du chapitre", get: (e) => e.admin?.numeroChapitre || "—" },
  { label: "Libellé du chapitre", get: (e) => e.admin?.libelleChapitre || "—" },
  { label: "Subdivision du chapitre", get: (e) => e.admin?.subdivisionChapitre || "—" },
  { label: "N° d'ordre du journal", get: (e) => e.admin?.numeroOrdreJournal || "—" },
  { label: "Date", get: (e) => new Date(e.dateEntree).toLocaleDateString("fr-FR") },
  { label: "Budget général", get: (e) => e.admin?.budgetGeneral || "—" },
  { label: "SOA", get: (e) => e.admin?.soa || "—" },
  {
    label: "Type d'opération",
    get: (e) =>
      (e.admin?.typeOperation && TYPE_OPERATION_LABELS[e.admin.typeOperation]) || "—",
  },
  { label: "Ordre d'entrée n°", get: (e) => e.reference },
  { label: "Fournisseur", get: (e) => e.fournisseur },
  { label: "Adresse du fournisseur", get: (e) => e.admin?.adresseFournisseur || "—" },
  { label: "N° facture", get: (e) => e.numeroFacture },
  { label: "Date de facture", get: (e) => (e.admin?.dateFacture ? new Date(e.admin.dateFacture).toLocaleDateString("fr-FR") : "—") },
  { label: "Bon de livraison", get: (e) => e.admin?.bonLivraison || "—" },
  { label: "Référence marché / convention", get: (e) => e.admin?.referenceMarche || "—" },
  { label: "Pièce justificative", get: (e) => e.admin?.pieceJustificative || e.numeroFacture },
];

/**
 * Construit la structure du document imprimable « ORDRE D'ENTRÉE » :
 * en-tête administrative, tableau des matériels, total, déclaration de
 * prise en charge et bloc signatures. Reprend uniquement les informations
 * présentes dans le modèle Excel fourni.
 */
export function getOrdreEntreeDocument(e: EntreeRecord): {
  entete: Array<{ label: string; value: string }>;
  lignes: EntreeLigne[];
  total: number;
  declaration: { date: string; nom: string; fonction: string };
  signatures: SignatureState[];
} {
  const lignes: EntreeLigne[] =
    e.lignes && e.lignes.length > 0
      ? e.lignes
      : [
          {
            numeroOrdre: 1,
            designation: e.materiel,
            espece: e.categorie,
            unite: "unité",
            quantite: e.quantite,
            prixUnitaire: 0,
            montant: 0,
            nomenclature: "",
            pieceJustificative: e.numeroFacture,
            observation: "",
          },
        ];
  const total =
    e.total ?? lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  return {
    entete: ORDRE_ENTREE_LABELS.map(({ label, get }) => ({
      label,
      value: get(e),
    })),
    lignes,
    total,
    declaration: {
      date: e.admin?.declarationDate
        ? new Date(e.admin.declarationDate).toLocaleDateString("fr-FR")
        : new Date(e.dateEntree).toLocaleDateString("fr-FR"),
      nom: e.admin?.declarationNom || e.responsable,
      fonction: e.admin?.declarationFonction || "Dépositaire",
    },
    signatures: getSignaturesEntree(e),
  };
}

function memesOrga(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;
  if (x.startsWith(y + " ") || y.startsWith(x + " ")) return true;
  if (x.length >= 3 && y.includes(x)) return true;
  if (y.length >= 3 && x.includes(y)) return true;
  return false;
}

/**
 * Sorties visibles par le profil Demandeur (périmètre service / direction).
 * `records` vient de l'API Strapi quand elle répond, sinon des données locales.
 */
export function sortiesPerimetre(
  records: SortieRecord[],
  user?: { role?: string; name?: string; department?: string }
): SortieRecord[] {
  if (!user || user.role !== "demandeur") return records;
  const { direction, service } = splitDepartement(user.department || "");
  return records.filter(
    (s) =>
      s.dansMonPerimetre ||
      (user.name && s.demandeur === user.name) ||
      memesOrga(s.direction, direction) ||
      memesOrga(s.serviceDemandeur, service)
  );
}

// ---------------------------------------------------------------------------
// Activité récente (tableau de bord)
// ---------------------------------------------------------------------------

export interface ActivityItem {
  date: string;
  label: string;
  detail: string;
  type: "demande" | "validation" | "preparation" | "sortie" | "entree";
}

const ACTIVITY_LABELS: Record<ActivityItem["type"], string> = {
  demande: "Demande créée",
  validation: "Demande validée",
  preparation: "Matériel préparé",
  sortie: "Sortie effectuée",
  entree: "Nouvelle entrée enregistrée",
};

/** Activité récente consolidée : demandes + entrées + sorties */
export function getRecentActivity(requests: Request[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  requests.forEach((r) => {
    items.push({
      date: r.requestDate,
      label: ACTIVITY_LABELS["demande"],
      detail: `${r.type} - ${r.equipment} (${r.department})`,
      type: "demande",
    });
    if (r.status === "Approuvé") {
      items.push({
        date: r.requestDate,
        label: ACTIVITY_LABELS["validation"],
        detail: `${r.equipment} - validée par ${r.approver || "le responsable"}`,
        type: "validation",
      });
    }
  });

  sortieRecords.forEach((s) => {
    if (s.statut === "Sortie effectuée") {
      items.push({
        date: s.dateSortie,
        label: ACTIVITY_LABELS["sortie"],
        detail: `${s.materiel} - ${s.beneficiaire}`,
        type: "sortie",
      });
    } else if (s.statut === "Validée" || s.statut === "En préparation") {
      items.push({
        date: s.dateSortie,
        label: ACTIVITY_LABELS["preparation"],
        detail: `${s.materiel} - ${s.quantite} unité(s)`,
        type: "preparation",
      });
    }
  });

  entreeRecords.forEach((e) => {
    items.push({
      date: e.dateEntree,
      label: ACTIVITY_LABELS["entree"],
      detail: `${e.materiel} - ${e.fournisseur}`,
      type: "entree",
    });
  });

  return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
}
