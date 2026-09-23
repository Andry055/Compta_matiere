// ---------------------------------------------------------------------------
// Demandes de l'espace « Demandeur »
//
// Source unique de vérité pour la page « Mes demandes » et le tableau de bord.
// Les lignes reprennent le cycle DEMANDER -> VALIDATION -> PREPARATION ->
// SORTIE -> TRACABILITE. Lecture API Strapi (/api/demandes) avec repli sur
// les données locales lorsque le backend est hors ligne, comme pour les
// entrées / sorties (voir src/lib/api.ts).
// ---------------------------------------------------------------------------

import { User } from "../App";
import { ActivityItem, SortieRecord, sortieRecords } from "./movements";

export type StatutDemande =
  | "Brouillon"
  | "En attente"
  | "En cours"
  | "Validée"
  | "Refusée"
  | "Annulée"
  | "Sortie effectuée";

export type PrioriteDemande = "Normal" | "Urgent" | "Critique";

export const STATUTS_DEMANDE: StatutDemande[] = [
  "Brouillon",
  "En attente",
  "En cours",
  "Validée",
  "Refusée",
  "Annulée",
  "Sortie effectuée",
];

export const PRIORITES_DEMANDE: PrioriteDemande[] = [
  "Normal",
  "Urgent",
  "Critique",
];

/** Une ligne de matériel demandé (plusieurs matériels par demande) */
export interface DemandeLigne {
  categorie: string;
  materiel: string;
  quantite: number;
  motif: string;
}

/** Une demande (regroupement de lignes) */
export interface DemandeRecord {
  id: number;
  /** Référence officielle DEM-AAAA-NNN (ex. DEM-2025-014) */
  reference: string;
  date: string;
  dateEnvoi?: string;
  dateValidation?: string;
  lignes: DemandeLigne[];
  priorite: PrioriteDemande;
  statut: StatutDemande;
  motif?: string;
  observation?: string;
  direction: string;
  service: string;
  demandeur: string;
  fonction?: string;
  validePar?: string;
  /** Sortie associée (SORT-AAAA-NNN) une fois la demande traitée */
  sortieReference?: string;
  /** Identifiants des lignes serveur (regroupement d'une même référence) */
  ids?: number[];
}

// ---------------------------------------------------------------------------
// Données de démarrage (périmètre des demandeurs)
// ---------------------------------------------------------------------------

const TOLOTRA = {
  demandeur: "Randriamampionona Tolotra",
  direction: "DRH",
  service: "Service du Personnel",
  fonction: "Chargé du personnel",
};

const JEAN = {
  demandeur: "Rakotoson Jean",
  direction: "Direction du Travail (DT)",
  service: "Direction du Travail (DT)",
  fonction: "Chef de service",
};

const seedDemandes: DemandeRecord[] = [
  {
    id: 14,
    reference: "DEM-2025-014",
    date: "2025-01-08T09:15:00",
    dateEnvoi: "2025-01-08T09:20:00",
    dateValidation: "2025-01-08T11:30:00",
    lignes: [
      {
        categorie: "Informatique",
        materiel: "Ordinateur portable HP",
        quantite: 2,
        motif: "Nouveau poste de travail",
      },
      {
        categorie: "Affichage",
        materiel: 'Écran Dell UltraSharp 24"',
        quantite: 2,
        motif: "Nouveau poste de travail",
      },
    ],
    priorite: "Normal",
    statut: "Sortie effectuée",
    motif: "Installation de deux nouveaux postes",
    observation: "Livraison souhaitée avant la fin du mois.",
    ...TOLOTRA,
    validePar: "Razafindrakoto Tojo",
    sortieReference: "SORT-2025-008",
  },
  {
    id: 13,
    reference: "DEM-2025-013",
    date: "2025-01-07T10:05:00",
    dateEnvoi: "2025-01-07T10:10:00",
    dateValidation: "2025-01-08T08:45:00",
    lignes: [
      {
        categorie: "Bureautique",
        materiel: "Imprimante Canon",
        quantite: 1,
        motif: "Service",
      },
    ],
    priorite: "Urgent",
    statut: "Validée",
    motif: "Remplacement imprimante défaillante",
    ...TOLOTRA,
    validePar: "Razafindrakoto Tojo",
  },
  {
    id: 12,
    reference: "DEM-2025-012",
    date: "2025-01-06",
    dateEnvoi: "2025-01-06",
    dateValidation: "2025-01-08",
    lignes: [
      {
        categorie: "Périphériques",
        materiel: "Clavier et souris sans fil",
        quantite: 3,
        motif: "Renouvellement",
      },
    ],
    priorite: "Normal",
    statut: "Validée",
    motif: "Postes de travail vétustes",
    ...TOLOTRA,
    validePar: "Rakotomalala Hery",
  },
  {
    id: 11,
    reference: "DEM-2025-011",
    date: "2025-01-07T14:02:00",
    dateEnvoi: "2025-01-07T14:05:00",
    lignes: [
      {
        categorie: "Communication",
        materiel: "Téléphone IP Cisco",
        quantite: 2,
        motif: "Nouveau collaborateur",
      },
    ],
    priorite: "Normal",
    statut: "En attente",
    motif: "Arrivée de deux contractuels",
    ...TOLOTRA,
  },
  {
    id: 10,
    reference: "DEM-2025-010",
    date: "2025-01-03",
    dateEnvoi: "2025-01-03",
    dateValidation: "2025-01-05",
    lignes: [
      {
        categorie: "Informatique",
        materiel: "Ordinateur portable HP",
        quantite: 1,
        motif: "Renouvellement",
      },
    ],
    priorite: "Critique",
    statut: "Refusée",
    motif: "Renouvellement anticipé",
    validePar: "Rakotomalala Hery",
    observation: "Refusé : poste encore sous garantie.",
    ...TOLOTRA,
  },
  {
    id: 9,
    reference: "DEM-2025-009",
    date: "2025-01-05",
    dateEnvoi: "2025-01-05",
    lignes: [
      {
        categorie: "Affichage",
        materiel: "Vidéoprojecteur Epson",
        quantite: 1,
        motif: "Salle de réunion",
      },
    ],
    priorite: "Urgent",
    statut: "En cours",
    motif: "Salle de réunion du service",
    ...TOLOTRA,
  },
  {
    id: 15,
    reference: "DEM-2025-015",
    date: "2025-01-08",
    lignes: [
      {
        categorie: "Périphériques",
        materiel: "Webcam Logitech C920",
        quantite: 2,
        motif: "Visioconférence",
      },
    ],
    priorite: "Normal",
    statut: "Brouillon",
    motif: "Salle de visioconférence",
    observation: "À compléter avant envoi.",
    ...TOLOTRA,
  },
  {
    id: 8,
    reference: "DEM-2025-008",
    date: "2025-01-04",
    dateEnvoi: "2025-01-04",
    dateValidation: "2025-01-06",
    lignes: [
      {
        categorie: "Informatique",
        materiel: "Ordinateur portable Dell",
        quantite: 1,
        motif: "Nouveau collaborateur",
      },
    ],
    priorite: "Normal",
    statut: "Validée",
    motif: "Poste d'accueil",
    ...JEAN,
    validePar: "Rakotomalala Hery",
  },
];

// ---------------------------------------------------------------------------
// Persistance locale (repli lorsque l'API ne répond pas)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "comptamatiere.demandes.v1";

function loadLocal(): DemandeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveLocal(rows: DemandeRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

/** Fusionne données de démarrage + demandes créées localement */
export function getAllDemandes(): DemandeRecord[] {
  const locals = loadLocal();
  const byId = new Map<number, DemandeRecord>();
  seedDemandes.forEach((d) => byId.set(d.id, d));
  locals.forEach((d) => byId.set(d.id, d));
  return Array.from(byId.values()).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id
  );
}

/** Enregistre (ou remplace) une demande dans le stock local */
export function persistDemande(record: DemandeRecord) {
  const locals = loadLocal().filter((d) => d.id !== record.id);
  locals.push(record);
  saveLocal(locals);
}

// ---------------------------------------------------------------------------
// Portée du profil connecté
// ---------------------------------------------------------------------------

function memesOrga(a: string, b: string): boolean {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;
  if (x.length >= 3 && y.includes(x)) return true;
  if (y.length >= 3 && x.includes(y)) return true;
  return false;
}

/** Découpe « Direction - Service » du département du profil connecté */
export function splitDepartementDemandeur(dept: string): {
  direction: string;
  service: string;
} {
  const parts = (dept || "").split(" - ");
  if (parts.length > 1) {
    return { direction: parts[0].trim(), service: parts.slice(1).join(" - ").trim() };
  }
  return { direction: dept.trim(), service: dept.trim() };
}

/** Demandes visibles par le profil (ses demandes + celles de son périmètre) */
export function getDemandesForUser(user?: User): DemandeRecord[] {
  const all = getAllDemandes();
  if (!user || user.role !== "demandeur") return all;
  const { direction, service } = splitDepartementDemandeur(user.department || "");
  return all.filter(
    (d) =>
      (user.name && d.demandeur === user.name) ||
      memesOrga(d.direction, direction) ||
      memesOrga(d.service, service)
  );
}

// ---------------------------------------------------------------------------
// Références / statistiques
// ---------------------------------------------------------------------------

/** Prochaine référence DEM-AAAA-NNN à partir de la liste existante */
export function nextDemandeReference(list: DemandeRecord[]): string {
  const year = new Date().getFullYear();
  const prefix = `DEM-${year}-`;
  let max = 0;
  list.forEach((d) => {
    if (d.reference && d.reference.startsWith(prefix)) {
      const n = parseInt(d.reference.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function getStatsDemandes(list: DemandeRecord[]) {
  const validees = list.filter(
    (d) => d.statut === "Validée" || d.statut === "Sortie effectuée"
  ).length;
  return {
    total: list.length,
    enAttente: list.filter((d) => d.statut === "En attente").length,
    validees,
    refusees: list.filter((d) => d.statut === "Refusée").length,
    brouillons: list.filter((d) => d.statut === "Brouillon").length,
    annulees: list.filter((d) => d.statut === "Annulée").length,
    enCours: list.filter((d) => d.statut === "En cours").length,
    sortiesEffectuees: list.filter((d) => d.statut === "Sortie effectuée").length,
  };
}

/** Badges de statut cohérents (cf. design des statuts) */
export function statutDemandeBadge(statut: StatutDemande | string): string {
  switch (statut) {
    case "Validée":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "En attente":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "En cours":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "Refusée":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "Annulée":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "Sortie effectuée":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "Brouillon":
      return "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export function prioriteDemandeBadge(priorite: PrioriteDemande | string): string {
  switch (priorite) {
    case "Critique":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "Urgent":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    default:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  }
}

export function formatDateCourt(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

/** Matériels d'une demande, sous forme d'une chaîne lisible */
export function materielsDemande(d: DemandeRecord): string {
  return d.lignes
    .map((l) => `${l.materiel} × ${l.quantite}`)
    .join(", ");
}

export function quantiteDemande(d: DemandeRecord): number {
  return d.lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0), 0);
}

// ---------------------------------------------------------------------------
// Lien demande -> sortie
// ---------------------------------------------------------------------------

/** Sortie associée à une demande (par référence ou par identifiant) */
export function getSortieOfDemande(
  d: DemandeRecord,
  sorties: SortieRecord[] = sortieRecords
): SortieRecord | null {
  if (d.sortieReference) {
    const byRef = sorties.find((s) => s.reference === d.sortieReference);
    if (byRef) return byRef;
  }
  const ids = [d.id, ...(d.ids || [])];
  return sorties.find((s) => s.demandeId && ids.includes(s.demandeId)) || null;
}

// ---------------------------------------------------------------------------
// Timeline de suivi (cf. §12 — Demande créée -> ... -> Sortie effectuée)
// ---------------------------------------------------------------------------

export interface TimelineStep {
  label: string;
  statut: string;
  date?: string;
  ok: boolean;
  acteur?: string;
}

export function getTimelineDemande(
  d: DemandeRecord,
  sorties: SortieRecord[] = sortieRecords
): TimelineStep[] {
  const sortie = getSortieOfDemande(d, sorties);
  const refusee = d.statut === "Refusée";
  const annulee = d.statut === "Annulée";

  const envoyee = !!d.dateEnvoi || d.statut !== "Brouillon";
  const validee =
    d.statut === "Validée" ||
    d.statut === "Sortie effectuée" ||
    (!!d.dateValidation && !refusee);
  const preparee =
    !!sortie &&
    ["En préparation", "Validée", "Sortie effectuée"].includes(sortie.statut);
  const sortieFaite =
    d.statut === "Sortie effectuée" || sortie?.statut === "Sortie effectuée";

  return [
    {
      label: "Demande créée",
      statut: "Créée",
      date: d.date,
      ok: true,
      acteur: d.demandeur,
    },
    {
      label: "Demande envoyée",
      statut: envoyee ? "Envoyée" : "Brouillon",
      date: d.dateEnvoi,
      ok: envoyee && !annulee,
      acteur: d.demandeur,
    },
    {
      label: "En cours de traitement",
      statut: annulee
        ? "Annulée"
        : refusee
        ? "Rejetée"
        : envoyee
        ? "Traitement en cours"
        : "En attente",
      date: envoyee && !annulee && !refusee ? d.dateEnvoi : undefined,
      ok: envoyee && !annulee && !refusee && d.statut !== "En attente",
    },
    {
      label: refusee ? "Demande refusée" : "Demande validée",
      statut: refusee
        ? "Refusée"
        : annulee
        ? "Annulée"
        : validee
        ? "Validée"
        : "En attente",
      date: d.dateValidation,
      ok: validee,
      acteur: d.validePar,
    },
    {
      label: "Matériel préparé",
      statut: preparee ? "Préparé" : "En attente",
      date: sortieFaite || preparee ? sortie?.dateSortie : undefined,
      ok: preparee,
      acteur: sortie?.responsable,
    },
    {
      label: "Sortie effectuée",
      statut: sortieFaite
        ? "Effectuée"
        : sortie
        ? sortie.statut
        : "En attente",
      date: sortieFaite ? sortie?.dateSortie : undefined,
      ok: sortieFaite,
      acteur: sortie?.beneficiaire,
    },
  ];
}

// ---------------------------------------------------------------------------
// Activité récente (tableau de bord Demandeur)
// ---------------------------------------------------------------------------

/**
 * « Mes activités récentes » : demandes créées / validées, sorties
 * effectuées, matériel disponible — dans le périmètre du profil.
 */
export function getActiviteDemandeur(
  demandes: DemandeRecord[],
  sorties: SortieRecord[]
): ActivityItem[] {
  const items: ActivityItem[] = [];

  demandes.forEach((d) => {
    items.push({
      date: d.date,
      label: `Demande ${d.reference} créée`,
      detail: `${materielsDemande(d)} — ${d.service}`,
      type: "demande",
    });
    if (d.dateValidation && (d.statut === "Validée" || d.statut === "Refusée")) {
      items.push({
        date: d.dateValidation,
        label: `Demande ${d.reference} ${
          d.statut === "Validée" ? "validée" : "refusée"
        }`,
        detail: `${materielsDemande(d)}${
          d.validePar ? ` — par ${d.validePar}` : ""
        }`,
        type: "validation",
      });
    }
    if (d.statut === "Sortie effectuée" && d.sortieReference) {
      items.push({
        date: d.dateValidation || d.date,
        label: `Sortie ${d.sortieReference} préparée`,
        detail: materielsDemande(d),
        type: "preparation",
      });
    }
  });

  sorties.forEach((s) => {
    if (s.statut === "Sortie effectuée") {
      items.push({
        date: s.dateSortie,
        label: `Sortie ${s.reference !== "—" ? s.reference : s.id} effectuée`,
        detail: `${s.materiel} × ${s.quantite} — ${s.beneficiaire}`,
        type: "sortie",
      });
    }
  });

  return items
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);
}

/** « État de mes demandes » : répartition graphique simple */
export function getRepartitionDemandes(list: DemandeRecord[]) {
  const ordre: StatutDemande[] = [
    "En attente",
    "En cours",
    "Validée",
    "Sortie effectuée",
    "Refusée",
    "Brouillon",
    "Annulée",
  ];
  const couleurs: Record<StatutDemande, string> = {
    "En attente": "bg-orange-500",
    "En cours": "bg-blue-500",
    Validée: "bg-green-500",
    "Sortie effectuée": "bg-purple-500",
    Refusée: "bg-red-500",
    Brouillon: "bg-slate-400",
    Annulée: "bg-gray-500",
  };
  const total = Math.max(1, list.length);
  return ordre
    .map((statut) => {
      const count = list.filter((d) => d.statut === statut).length;
      return {
        statut,
        count,
        percent: Math.round((count / total) * 100),
        color: couleurs[statut],
      };
    })
    .filter((row) => row.count > 0);
}

// ---------------------------------------------------------------------------
// Lecture / écriture API (repli local si le backend ne répond pas)
// ---------------------------------------------------------------------------

interface StrapiDemandeRow {
  id: number;
  documentId?: string;
  reference?: string | null;
  groupe?: string | null;
  designation_materiel?: string | null;
  quantite?: number | null;
  motif?: string | null;
  observation?: string | null;
  fonction?: string | null;
  priorite?: string | null;
  statut?: string | null;
  date_demande?: string | null;
  date_envoi?: string | null;
  date_validation?: string | null;
  valide_par?: string | null;
  direction?: { nom_direction?: string | null } | null;
  service?: { nom_service?: string | null } | null;
  demandeur?: { id?: number; username?: string | null } | null;
}

const STATUTS_API: Record<string, StatutDemande> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  en_cours: "En cours",
  approuvee: "Validée",
  rejetee: "Refusée",
  preparation: "En cours",
  annulee: "Annulée",
  sortie_effectuee: "Sortie effectuée",
};

const PRIORITES_API: Record<string, PrioriteDemande> = {
  normal: "Normal",
  urgent: "Urgent",
  critique: "Critique",
};

function mapStrapiDemande(row: StrapiDemandeRow): DemandeRecord {
  return {
    id: row.id,
    reference: row.reference || `DEM-API-${row.id}`,
    date: (row.date_demande || new Date().toISOString().slice(0, 10)) as string,
    dateEnvoi: row.date_envoi || undefined,
    dateValidation: row.date_validation || undefined,
    lignes: [
      {
        categorie: "—",
        materiel: row.designation_materiel || "—",
        quantite: Number(row.quantite) || 1,
        motif: row.motif || "—",
      },
    ],
    priorite: PRIORITES_API[row.priorite || ""] || "Normal",
    statut: STATUTS_API[row.statut || ""] || "En attente",
    motif: row.motif || undefined,
    observation: row.observation || undefined,
    direction: row.direction?.nom_direction || "—",
    service: row.service?.nom_service || "—",
    demandeur: row.demandeur?.username || "—",
    fonction: row.fonction || undefined,
    validePar: row.valide_par || undefined,
    sortieReference: undefined,
    ids: [row.id],
  };
}

/**
 * Charge les demandes du profil connecté depuis Strapi (/api/demandes).
 *
 * Le contrôleur serveur limite déjà la liste aux demandes de l'utilisateur
 * connecté (contrôle côté base de données, pas seulement frontend).
 *
 * Retourne `null` si le backend est injoignable ou non connecté
 * (repli sur les données locales par l'appelant).
 */
export async function fetchDemandes(): Promise<DemandeRecord[] | null> {
  try {
    const { api, getStrapiJwt } = await import("./api");
    if (!getStrapiJwt()) return null; // sans jeton : pas d'accès serveur
    const { data } = await api.get("/api/demandes", {
      timeout: 5000,
      params: {
        sort: "date_demande:desc",
        "pagination[pageSize]": 100,
        populate: ["direction", "service", "demandeur"],
      },
    });
    const rows: StrapiDemandeRow[] = data?.data ?? [];
    if (!rows.length) return null;

    // Regroupement des lignes qui partagent la même référence (groupe)
    const byGroup = new Map<string, DemandeRecord>();
    rows.forEach((row) => {
      const key = row.groupe || row.reference || `DEM-API-${row.id}`;
      const mapped = mapStrapiDemande(row);
      const current = byGroup.get(key);
      if (current) {
        current.lignes.push(...mapped.lignes);
        current.ids = [...(current.ids || []), row.id];
      } else {
        byGroup.set(key, { ...mapped, reference: key });
      }
    });
    return Array.from(byGroup.values());
  } catch {
    return null;
  }
}
