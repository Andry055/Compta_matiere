import axios from "axios";

// URL du backend Strapi (définie dans .env : VITE_API_URL)
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:1337";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
});

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
