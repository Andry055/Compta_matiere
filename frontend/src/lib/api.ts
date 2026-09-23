import axios from "axios";
import {
  EntreeRecord,
  SortieRecord,
  StatutEntree,
  StatutSortie,
  EntreeAdmin,
  EntreeLigne,
  ENTREE_ADMIN_VIDE,
  DocumentRef,
} from "./movements";

// URL du backend Strapi (définie dans .env : VITE_API_URL)
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:1337";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
});

// ---------------------------------------------------------------------------
// Session Strapi (JWT) : connexion Content API
//
// Le jeton est stocké dans localStorage et envoyé automatiquement sur chaque
// requête : c'est lui qui permet au Demandeur de créer et de retrouver SES
// demandes persistées côté serveur.
// ---------------------------------------------------------------------------

const JWT_KEY = "strapi_jwt";
const AUTH_USER_KEY = "strapi_auth_user";

export interface StrapiRole {
  id?: number;
  type?: string;
  code?: string;
  name?: string;
}

export interface StrapiAuthUser {
  id: number;
  documentId?: string;
  username: string;
  email: string;
  department?: string | null;
  fonction?: string | null;
  role?: StrapiRole | null;
}

export function getStrapiJwt(): string | null {
  try {
    return localStorage.getItem(JWT_KEY);
  } catch {
    return null;
  }
}

export function setStrapiSession(jwt: string, user: StrapiAuthUser) {
  try {
    localStorage.setItem(JWT_KEY, jwt);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    /* mode privé : on ignore */
  }
}

export function clearStrapiSession() {
  try {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function getStrapiAuthUser(): StrapiAuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Envoi automatique du jeton sur chaque requête Content API
api.interceptors.request.use((config) => {
  const jwt = getStrapiJwt();
  if (jwt) {
    config.headers.set("Authorization", `Bearer ${jwt}`);
  }
  return config;
});

/**
 * Connexion à l'API Strapi (POST /api/auth/local).
 * Retourne `null` si les identifiants sont invalides ou si le backend est
 * injoignable : l'appelant bascule alors sur les comptes de démonstration.
 */
export async function strapiLogin(
  identifier: string,
  password: string
): Promise<{ jwt: string; user: StrapiAuthUser } | null> {
  try {
    const { data } = await api.post(
      "/api/auth/local",
      { identifier, password },
      { timeout: 5000 }
    );
    if (data && data.jwt && data.user) {
      setStrapiSession(data.jwt, data.user);
      return { jwt: data.jwt, user: data.user };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entrées / Sorties : lecture de l'API avec repli sur les données locales
// ---------------------------------------------------------------------------

const STATUTS_ENTREE_API: Record<string, StatutEntree> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  verifiee: "Vérifiée",
  validee: "Validée",
  rejetee: "Rejetée",
};

const STATUTS_SORTIE_API: Record<string, StatutSortie> = {
  demandee: "Demandée",
  en_preparation: "En préparation",
  validee: "Validée",
  sortie_effectuee: "Sortie effectuée",
  annulee: "Annulée",
};

interface StrapiEntity {
  id: number;
  documentId?: string;
  reference?: string | null;
  date_entree?: string | null;
  date_sortie?: string | null;
  numero_facture?: string | null;
  statut?: string | null;
  responsable?: string | null;
  beneficiaire?: string | null;
  justificatif?: string | null;
  notes?: string | null;
  observations?: string | null;
  fournisseur?: { nom?: string | null } | null;
  direction?: { nom_direction?: string | null } | null;
  service?: { nom_service?: string | null } | null;
  demande?: {
    id?: number;
    demandeur?: { nom?: string | null; prenom?: string | null } | null;
  } | null;
  lignes?: Array<{
    id: number;
    numero_ordre?: number | null;
    designation?: string | null;
    espece?: string | null;
    unite?: string | null;
    quantite?: number | null;
    valeur_unitaire?: number | null;
    montant?: number | null;
    nomenclature?: string | null;
    piece_justificative?: string | null;
    observations?: string | null;
    materiel?: {
      designation?: string | null;
      categorie?: { nom?: string | null } | null;
    } | null;
  }> | null;
}

/** Champs administratifs + signatures d'une entrée Strapi */
interface StrapiEntreeChamps {
  total?: number | null;
  numero_chapitre?: string | null;
  libelle_chapitre?: string | null;
  subdivision_chapitre?: string | null;
  numero_ordre_journal?: string | null;
  budget_general?: string | null;
  soa?: string | null;
  type_operation?: string | null;
  adresse_fournisseur?: string | null;
  date_facture?: string | null;
  bon_livraison?: string | null;
  reference_marche?: string | null;
  piece_justificative?: string | null;
  declaration_nom?: string | null;
  declaration_fonction?: string | null;
  declaration_date?: string | null;
  depositaire_signed?: boolean;
  chef_service_1_signed?: boolean;
  chef_service_2_signed?: boolean;
  date_signature_depositaire?: string | null;
  date_signature_chef_service_1?: string | null;
  date_signature_chef_service_2?: string | null;
  signataire_depositaire?: string | null;
  signataire_chef_service_1?: string | null;
  signataire_chef_service_2?: string | null;
  affectation_depositaire?: string | null;
  affectation_chef_service_1?: string | null;
  affectation_chef_service_2?: string | null;
  qr_token?: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapEntree(row: StrapiEntity & StrapiEntreeChamps): EntreeRecord {
  const lignes = row.lignes ?? [];
  const materiels = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.designation || ligne.designation)
        .filter((value): value is string => !!value)
    )
  );
  const categories = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.categorie?.nom)
        .filter((value): value is string => !!value)
    )
  );

  const admin: EntreeAdmin = {
    ...ENTREE_ADMIN_VIDE,
    numeroChapitre: row.numero_chapitre || "",
    libelleChapitre: row.libelle_chapitre || "",
    subdivisionChapitre: row.subdivision_chapitre || "",
    numeroOrdreJournal: row.numero_ordre_journal || "",
    budgetGeneral: row.budget_general || "",
    soa: row.soa || "",
    typeOperation: (row.type_operation as EntreeAdmin["typeOperation"]) || "",
    adresseFournisseur: row.adresse_fournisseur || "",
    dateFacture: row.date_facture || "",
    bonLivraison: row.bon_livraison || "",
    referenceMarche: row.reference_marche || "",
    pieceJustificative: row.piece_justificative || "",
    declarationNom: row.declaration_nom || "",
    declarationFonction: row.declaration_fonction || "",
    declarationDate: row.declaration_date || "",
  };

  const documents: DocumentRef[] = [];
  if (row.numero_facture)
    documents.push({ nom: row.numero_facture, type: "Facture / pièce justificative" });
  if (row.bon_livraison)
    documents.push({ nom: row.bon_livraison, type: "Bon de livraison" });
  if (row.reference_marche)
    documents.push({ nom: row.reference_marche, type: "Marché / convention" });
  if (row.piece_justificative)
    documents.push({ nom: row.piece_justificative, type: "Pièce justificative" });

  const lignesMappees: EntreeLigne[] = lignes.map((l, i) => ({
    numeroOrdre: l.numero_ordre ?? i + 1,
    designation: l.designation || l.materiel?.designation || "—",
    espece: l.espece || l.materiel?.categorie?.nom || "—",
    unite: l.unite || "unité",
    quantite: Number(l.quantite) || 0,
    prixUnitaire: Number(l.valeur_unitaire) || 0,
    montant: Number(l.montant) || 0,
    nomenclature: l.nomenclature || "",
    pieceJustificative: l.piece_justificative || "",
    observation: l.observations || "",
  }));

  return {
    id: row.documentId || String(row.id),
    reference: row.reference || `ENT-${row.id}`,
    dateEntree: row.date_entree || today(),
    materiel: materiels.join(", ") || row.notes || "—",
    categorie: categories.join(", ") || "—",
    quantite: lignes.reduce(
      (sum, ligne) => sum + (Number(ligne.quantite) || 0),
      0
    ),
    fournisseur: row.fournisseur?.nom || "—",
    numeroFacture: row.numero_facture || "—",
    direction: row.direction?.nom_direction || "—",
    service: row.service?.nom_service || "—",
    statut: STATUTS_ENTREE_API[row.statut || ""] || "En attente",
    responsable: row.responsable || "—",
    documents,
    signatures: {
      depositaire: row.depositaire_signed ? row.date_signature_depositaire || today() : undefined,
      chefService1: row.chef_service_1_signed
        ? row.date_signature_chef_service_1 || today()
        : undefined,
      chefService2: row.chef_service_2_signed
        ? row.date_signature_chef_service_2 || today()
        : undefined,
    },
    signataires: {
      depositaire: row.signataire_depositaire || undefined,
      chefService1: row.signataire_chef_service_1 || undefined,
      chefService2: row.signataire_chef_service_2 || undefined,
    },
    affectations: {
      depositaire: row.affectation_depositaire || undefined,
      chefService1: row.affectation_chef_service_1 || undefined,
      chefService2: row.affectation_chef_service_2 || undefined,
    },
    qrToken: row.qr_token || undefined,
    total: row.total ?? undefined,
    admin,
    lignes: lignesMappees,
  };
}

function mapSortie(row: StrapiEntity): SortieRecord {
  const lignes = row.lignes ?? [];
  const materiels = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.designation)
        .filter((value): value is string => !!value)
    )
  );
  const categories = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.categorie?.nom)
        .filter((value): value is string => !!value)
    )
  );
  const demandeur = row.demande?.demandeur
    ? [row.demande.demandeur.prenom, row.demande.demandeur.nom]
        .filter(Boolean)
        .join(" ")
    : undefined;

  return {
    id: row.documentId || String(row.id),
    reference: row.reference || "—",
    dateSortie: row.date_sortie || today(),
    materiel: materiels.join(", ") || row.observations || "—",
    categorie: categories.join(", ") || "—",
    quantite: lignes.reduce(
      (sum, ligne) => sum + (Number(ligne.quantite) || 0),
      0
    ),
    serviceDemandeur: row.service?.nom_service || "—",
    direction: row.direction?.nom_direction || "—",
    demandeId: row.demande?.id,
    demandeur,
    beneficiaire: row.beneficiaire || "—",
    responsable: row.responsable || "—",
    statut: STATUTS_SORTIE_API[row.statut || ""] || "Demandée",
    justificatif: row.justificatif || "—",
    documents: row.justificatif
      ? [{ nom: row.justificatif, type: "Justificatif de sortie" }]
      : [],
  };
}

/**
 * Charge les entrées depuis Strapi (/api/entrees).
 * Retourne `null` si le backend est injoignable ou en erreur, et `[]` s'il
 * répond sans donnée : l'appelant retombe alors sur les données locales.
 */
export async function fetchEntrees(): Promise<EntreeRecord[] | null> {
  try {
    const { data } = await api.get("/api/entrees", {
      timeout: 5000,
      params: {
        sort: "date_entree:desc",
        "pagination[pageSize]": 100,
        populate: {
          fournisseur: true,
          direction: true,
          service: true,
          lignes: {
            populate: { materiel: { populate: ["categorie"] } },
          },
        },
      },
    });

    const rows: StrapiEntity[] = data?.data ?? [];
    return rows.map(mapEntree);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entrées : création, signature, rejet (validation à 3 signatures)
// ---------------------------------------------------------------------------

export interface NouvelleEntreePayload {
  reference?: string;
  date_entree: string;
  numero_facture?: string;
  fournisseur_id?: string;
  direction_id?: string;
  service_id?: string;
  responsable?: string;
  notes?: string;
  /** true = enregistrement partiel (statut « Brouillon ») */
  brouillon?: boolean;
  affectation_depositaire?: string;
  affectation_chef_service_1?: string;
  affectation_chef_service_2?: string;
  lignes: Array<{
    designation: string;
    espece?: string;
    unite?: string;
    quantite: number;
    valeur_unitaire: number;
    nomenclature?: string;
    piece_justificative?: string;
    observations?: string;
    materiel_id?: string;
  }>;
  numero_chapitre?: string;
  libelle_chapitre?: string;
  subdivision_chapitre?: string;
  numero_ordre_journal?: string;
  budget_general?: string;
  soa?: string;
  type_operation?: string;
  adresse_fournisseur?: string;
  date_facture?: string;
  bon_livraison?: string;
  reference_marche?: string;
  piece_justificative?: string;
  declaration_nom?: string;
  declaration_fonction?: string;
  declaration_date?: string;
}

/** Création complète d'une entrée (entête administrative + lignes). */
export async function creerEntree(payload: NouvelleEntreePayload): Promise<EntreeRecord> {
  const { data } = await api.post("/api/entrees/create-complete", { data: payload });
  return mapEntree(data.data);
}

/** Pose une signature (rôle contrôlé côté serveur). */
export async function signerEntree(
  documentId: string,
  role: "depositaire" | "chef_service_1" | "chef_service_2"
): Promise<EntreeRecord> {
  const { data } = await api.post(`/api/entrees/${documentId}/sign`, { data: { role } });
  return mapEntree(data.data);
}

/** Rejet d'une entrée par un responsable habilité. */
export async function rejeterEntree(documentId: string): Promise<EntreeRecord> {
  const { data } = await api.post(`/api/entrees/${documentId}/reject`);
  return mapEntree(data.data);
}

export interface RefOption {
  documentId: string;
  nom: string;
}

export interface MaterialOption {
  documentId: string;
  designation: string;
  categorie?: string;
  quantiteStock?: number;
  valeurUnitaire?: number;
}

/** Liste des fournisseurs (pour le formulaire « Nouvelle entrée »). */
export async function fetchFournisseurs(): Promise<RefOption[]> {
  try {
    const { data } = await api.get("/api/fournisseurs", {
      params: { "pagination[pageSize]": 100, sort: "nom:asc" },
      timeout: 5000,
    });
    return (data?.data ?? []).map((row: { documentId?: string; id: number; nom?: string }) => ({
      documentId: row.documentId || String(row.id),
      nom: row.nom || `Fournisseur #${row.id}`,
    }));
  } catch {
    return [];
  }
}

/** Liste des directions (pour le formulaire « Nouvelle entrée »). */
export async function fetchDirections(): Promise<RefOption[]> {
  try {
    const { data } = await api.get("/api/directions", {
      params: { "pagination[pageSize]": 100, sort: "nom_direction:asc" },
      timeout: 5000,
    });
    return (data?.data ?? []).map((row: { documentId?: string; id: number; nom_direction?: string }) => ({
      documentId: row.documentId || String(row.id),
      nom: row.nom_direction || `Direction #${row.id}`,
    }));
  } catch {
    return [];
  }
}

/** Liste des services (pour le formulaire « Nouvelle entrée »). */
export async function fetchServices(): Promise<RefOption[]> {
  try {
    const { data } = await api.get("/api/services", {
      params: { "pagination[pageSize]": 100, sort: "nom_service:asc" },
      timeout: 5000,
    });
    return (data?.data ?? []).map((row: { documentId?: string; id: number; nom_service?: string }) => ({
      documentId: row.documentId || String(row.id),
      nom: row.nom_service || `Service #${row.id}`,
    }));
  } catch {
    return [];
  }
}

/** Liste des matériaux existants (pour pré-remplir les lignes du formulaire). */
export async function fetchMaterials(): Promise<MaterialOption[]> {
  try {
    const { data } = await api.get("/api/materials", {
      params: {
        "pagination[pageSize]": 200,
        sort: "designation:asc",
        populate: ["categorie"],
      },
      timeout: 5000,
    });
    return (data?.data ?? []).map(
      (row: {
        documentId?: string;
        id: number;
        designation?: string;
        quantite_stock?: number;
        valeur_unitaire?: number;
        categorie?: { nom?: string } | null;
      }) => ({
        documentId: row.documentId || String(row.id),
        designation: row.designation || `Matériel #${row.id}`,
        categorie: row.categorie?.nom || undefined,
        quantiteStock: row.quantite_stock ?? undefined,
        valeurUnitaire: row.valeur_unitaire ?? undefined,
      })
    );
  } catch {
    return [];
  }
}

/**
 * Charge les sorties depuis Strapi (/api/sorties).
 * Retourne `null` en cas d'indisponibilité, `[]` s'il répond sans donnée :
 * repli sur les données locales.
 */
export async function fetchSorties(): Promise<SortieRecord[] | null> {
  try {
    const { data } = await api.get("/api/sorties", {
      timeout: 5000,
      params: {
        sort: "date_sortie:desc",
        "pagination[pageSize]": 100,
        populate: {
          direction: true,
          service: true,
          demande: { populate: ["demandeur"] },
          lignes: {
            populate: { materiel: { populate: ["categorie"] } },
          },
        },
      },
    });

    const rows: StrapiEntity[] = data?.data ?? [];
    return rows.map(mapSortie);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types exposés au frontend (structure attendue par les composants)
// ---------------------------------------------------------------------------
export interface OrgEmployee {
  id: number;
  name: string;
  im: string;
  fonction: string;
  email: string;
  phone: string;
  CIN: string;
  status: "Actif" | "Inactif" | "Congé";
}

export interface OrgService {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
  location: string;
  employees: OrgEmployee[];
}

export interface OrgDirection {
  id: number;
  name: string;
  director: string;
  directorEmail: string;
  description: string;
  location: string;
  services: OrgService[];
}

// ---------------------------------------------------------------------------
// Types renvoyés par l'API Strapi 5
// ---------------------------------------------------------------------------
interface StrapiEmployee {
  id: number;
  documentId: string;
  im?: string;
  CIN?: string;
  nom?: string;
  prenom?: string;
  fonction?: string;
  email?: string;
  phone?: string;
  statut?: "actif" | "inactif" | "congé";
}

interface StrapiService {
  id: number;
  documentId: string;
  nom_service?: string;
  description?: string;
  responsable?: string;
  responsable_email?: string;
  localisation?: string;
  employees?: StrapiEmployee[];
}

interface StrapiDirection {
  id: number;
  documentId: string;
  nom_direction?: string;
  abreviation?: string;
  description?: string;
  directeur?: string;
  directeur_email?: string;
  localisation?: string;
  services?: StrapiService[];
}

function mapStatut(statut?: string): OrgEmployee["status"] {
  switch (statut) {
    case "inactif":
      return "Inactif";
    case "congé":
      return "Congé";
    default:
      return "Actif";
  }
}

/**
 * Récupère l'organigramme complet (directions -> services -> employés)
 * depuis le backend Strapi.
 */
export async function fetchOrganisation(): Promise<OrgDirection[]> {
  const { data } = await api.get("/api/directions", {
    params: {
      "populate[services][populate][0]": "employees",
      "sort[0]": "nom_direction:asc",
    },
  });

  const rows: StrapiDirection[] = data?.data ?? [];

  return rows.map((direction) => ({
    id: direction.id,
    name: direction.nom_direction ?? "",
    director: direction.directeur ?? "",
    directorEmail: direction.directeur_email ?? "",
    description: direction.description ?? "",
    location: direction.localisation ?? "",
    services: (direction.services ?? []).map((service) => ({
      id: service.id,
      name: service.nom_service ?? "",
      manager: service.responsable ?? "",
      managerEmail: service.responsable_email ?? "",
      description: service.description ?? "",
      location: service.localisation ?? "",
      employees: (service.employees ?? []).map((employee) => ({
        id: employee.id,
        name: [employee.prenom, employee.nom].filter(Boolean).join(" "),
        im: employee.im ?? "",
        fonction: employee.fonction ?? "",
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        CIN: employee.CIN ?? "",
        status: mapStatut(employee.statut),
      })),
    })),
  }));
}
