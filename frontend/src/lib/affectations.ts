// ---------------------------------------------------------------------------
// AFFECTATIONS ENTRE SERVICES (même Direction uniquement)
//
// Règle métier :
//   DIRECTION → SERVICE SOURCE → AFFECTATION → SERVICE DESTINATAIRE
//   → Mise à jour du stock → Traçabilité
//   PAS DE SORTIE, PAS DE NOUVELLE ENTRÉE.
//
// Une affectation concerne un matériel DÉJÀ enregistré dans le stock d'une
// Direction et change uniquement le service de destination.
// (Direction A ≠ Direction B → il s'agit d'un TRANSFERT : SORTIE → ENTRÉE,
//  opération distincte, gérée hors de cette rubrique.)
//
// Validation à QUATRE signatures obligatoires, dans l'ordre :
//   0/4 En attente → 1/4 Responsable du transfert → 2/4 Dépositaire
//   → 3/4 Chef de service 1 → 4/4 → ✓ AFFECTATION VALIDÉE
// Une affectation validée n'est plus modifiable.
// ---------------------------------------------------------------------------

import { EntreeRecord, getStatutEntreeAffiche } from "./movements";

export type AffectationStatut = "En attente" | "Validée";

export interface AffectationValidationInfo {
  date: string; // ISO
  signataire: string;
}

export type AffectationCleValidation =
  | "responsableTransfert"
  | "depositaire"
  | "chefService1"
  | "chefService2";

export interface AffectationHistorique {
  date: string;
  libelle: string;
}

export interface AffectationRecord {
  id: string;
  /** AFF-AAAA-NNN */
  reference: string;
  /** Identifiant porté par le QR Code (aucune donnée sensible) */
  qrToken: string;
  /** Date de création (ISO yyyy-mm-dd) */
  date: string;
  direction: string;
  serviceSource: string;
  serviceDestinataire: string;
  materiel: string;
  materielReference: string;
  quantite: number;
  motif: string;
  observation: string;
  /** Créateur (nom + email) : signe la validation 1/4 « Responsable du transfert » */
  createur: string;
  createurEmail: string;
  responsables: {
    responsableTransfert: string;
    depositaire: string;
    chefService1: string;
    chefService2: string;
  };
  validations: Partial<Record<AffectationCleValidation, AffectationValidationInfo>>;
  statut: AffectationStatut;
  historique: AffectationHistorique[];
}

/** Les 4 validations obligatoires (dans l'ordre du workflow) */
export const AFFECTATION_VALIDATIONS: Array<{
  key: AffectationCleValidation;
  label: string;
}> = [
  { key: "responsableTransfert", label: "Responsable du transfert" },
  { key: "depositaire", label: "Dépositaire" },
  { key: "chefService1", label: "Chef de service 1" },
  { key: "chefService2", label: "Chef de service 2" },
];

/** Motifs d'affectation (liste imposée) */
export const MOTIFS_AFFECTATION = [
  "Réaffectation interne",
  "Changement de service",
  "Besoin du service",
];

const CLE = "comptamatiere_affectations_v2";

export function listerAffectations(): AffectationRecord[] {
  try {
    const raw = localStorage.getItem(CLE);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AffectationRecord[]) : [];
  } catch {
    return [];
  }
}

function persister(records: AffectationRecord[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(records));
  } catch {
    /* mode privé : on ignore */
  }
}

// ---------------------------------------------------------------------------
// État des validations
// ---------------------------------------------------------------------------

export interface AffectationValidationEtat {
  key: AffectationCleValidation;
  label: string;
  signed: boolean;
  date?: string;
  signataire?: string;
}

export function getValidationsAffectation(
  a: AffectationRecord
): AffectationValidationEtat[] {
  return AFFECTATION_VALIDATIONS.map(({ key, label }) => ({
    key,
    label,
    signed: !!a.validations?.[key],
    date: a.validations?.[key]?.date,
    signataire: a.validations?.[key]?.signataire,
  }));
}

export function getValidationCount(a: AffectationRecord): number {
  return getValidationsAffectation(a).filter((v) => v.signed).length;
}

/** 4/4 → « Validée », sinon « En attente » (progression affichée x/4) */
export function getStatutAffectationAffiche(a: AffectationRecord): string {
  return getValidationCount(a) >= 4 ? "Validée" : "En attente";
}

export function statutAffectationBadge(statut: string): string {
  return statut === "Validée"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export interface NouvelleAffectation {
  direction: string;
  serviceSource: string;
  serviceDestinataire: string;
  materiel: string;
  materielReference?: string;
  quantite: number;
  motif: string;
  observation?: string;
  responsables: AffectationRecord["responsables"];
  createur: string;
  createurEmail: string;
}

function prochaineReference(existantes: AffectationRecord[]): string {
  const annee = new Date().getFullYear();
  const numeros = existantes
    .map((a) => Number((a.reference || "").split("-")[2]))
    .filter((n) => Number.isFinite(n));
  const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `AFF-${annee}-${String(suivant).padStart(3, "0")}`;
}

export function creerAffectation(
  input: NouvelleAffectation
): AffectationRecord {
  const existantes = listerAffectations();
  const reference = prochaineReference(existantes);
  const date = new Date().toISOString().slice(0, 10);

  const record: AffectationRecord = {
    id: reference,
    reference,
    qrToken: reference,
    date,
    direction: input.direction,
    serviceSource: input.serviceSource,
    serviceDestinataire: input.serviceDestinataire,
    materiel: input.materiel,
    materielReference: input.materielReference || "—",
    quantite: Math.max(1, Number(input.quantite) || 1),
    motif: input.motif,
    observation: input.observation || "",
    createur: input.createur || "—",
    createurEmail: input.createurEmail || "",
    responsables: input.responsables,
    validations: {},
    statut: "En attente",
    historique: [{ date, libelle: `Création de l'affectation par ${input.createur || "—"}` }],
  };

  persister([record, ...existantes]);
  return record;
}

// ---------------------------------------------------------------------------
// Validation (workflow ordonné, immuable après 4/4)
// ---------------------------------------------------------------------------

export interface UtilisateurValidation {
  name?: string;
  email?: string;
  role?: string | null;
}

/**
 * Qui a le droit de poser la validation `key` ?
 *  - Responsable du transfert : le CRÉATEUR de l'affectation (ou l'admin),
 *  - Dépositaire              : rôle depositaire (ou admin),
 *  - Chef de service 1        : rôle magasinier (ou admin),
 *  - Chef de service 2        : rôle logistique (ou admin).
 * Un Demandeur ne signe JAMAIS à la place d'un responsable (sauf 1/4 sur sa
 * propre affectation, en tant que créateur/responsable du transfert).
 */
export function peutValiderAffectation(
  user: UtilisateurValidation | undefined,
  a: AffectationRecord,
  key: AffectationCleValidation
): boolean {
  if (!user || a.statut === "Validée") return false;
  if (a.validations[key]) return false;

  const estCreateur =
    (!!user.name && user.name === a.createur) ||
    (!!user.email && user.email === a.createurEmail);
  const estAdmin = user.role === "admin";

  if (key === "responsableTransfert") return estCreateur || estAdmin;
  if (estAdmin) return true;
  if (user.role === "demandeur") return false; // jamais pour un responsable
  if (key === "depositaire") return user.role === "depositaire";
  if (key === "chefService1") return user.role === "magasinier";
  if (key === "chefService2") return user.role === "logistique";
  return false;
}

/**
 * Pose une validation. L'ordre est imposé (les validations précédentes
 * doivent exister) et une affectation validée (4/4) n'est plus modifiable.
 * À 4/4 : statut « Validée » + le stock du service est mis à jour
 * (source −quantité / destinataire +quantité ; le total de la Direction est
 * inchangé : ni entrée, ni sortie).
 */
export function validerAffectation(
  reference: string,
  key: AffectationCleValidation,
  user: UtilisateurValidation
): AffectationRecord {
  const records = listerAffectations();
  const record = records.find((a) => a.reference === reference);
  if (!record) throw new Error("Affectation introuvable.");
  if (record.statut === "Validée")
    throw new Error(
      "Affectation déjà validée (4/4) : elle n'est plus modifiable."
    );
  if (record.validations[key])
    throw new Error("Cette validation a déjà été enregistrée (jamais modifiable).");

  const indexCle = AFFECTATION_VALIDATIONS.findIndex((v) => v.key === key);
  for (let i = 0; i < indexCle; i += 1) {
    const precedent = AFFECTATION_VALIDATIONS[i].key;
    if (!record.validations[precedent]) {
      throw new Error(
        `Workflow respecté : validation « ${AFFECTATION_VALIDATIONS[i].label} » attendue avant celle-ci.`
      );
    }
  }

  if (!peutValiderAffectation(user, record, key))
    throw new Error("Votre rôle ne vous permet pas de poser cette validation.");

  const maintenant = new Date().toISOString();
  const signataire = user.name || user.email || "—";
  record.validations = {
    ...record.validations,
    [key]: { date: maintenant, signataire },
  };

  const label = AFFECTATION_VALIDATIONS[indexCle].label;
  record.historique = [
    ...record.historique,
    { date: maintenant.slice(0, 10), libelle: `Validation ${label} (${indexCle + 1}/4) — ${signataire}` },
  ];

  const total = AFFECTATION_VALIDATIONS.filter((v) => record.validations[v.key])
    .length;
  if (total >= 4) {
    record.statut = "Validée";
    record.historique = [
      ...record.historique,
      {
        date: maintenant.slice(0, 10),
        libelle: `✓ Affectation validée (4/4) — stock mis à jour : −${record.quantite} (${record.serviceSource}) / +${record.quantite} (${record.serviceDestinataire})`,
      },
    ];
  }

  persister(
    records.map((a) => (a.reference === reference ? record : a))
  );
  return record;
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

function formatMois(isoDate: string): string {
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const d = new Date(isoDate);
  return `${mois[d.getMonth()]} ${d.getFullYear()}`;
}

export function getStatistiquesAffectations(records?: AffectationRecord[]) {
  const liste = records ?? listerAffectations();
  const dates = liste.map((a) => a.date).filter(Boolean).sort();
  const reference = dates[dates.length - 1] || new Date().toISOString().slice(0, 10);
  const duMois = liste.filter((a) => a.date.slice(0, 7) === reference.slice(0, 7)).length;
  const validees = liste.filter((a) => getStatutAffectationAffiche(a) === "Validée").length;
  return {
    total: liste.length,
    duMois,
    enAttente: liste.length - validees,
    validees,
    moisLabel: formatMois(reference),
  };
}

// ---------------------------------------------------------------------------
// STOCK PAR SERVICE
//
// Le stock d'un service est CALCULÉ :
//   + entrées validées rattachées à (Direction / Service),
//   −/+ affectations validées (source → destinataire).
// Le total de la Direction reste toujours identique (pas d'entrée/sortie).
// ---------------------------------------------------------------------------

export interface StockLigne {
  direction: string;
  service: string;
  materiel: string;
  reference?: string;
  quantite: number;
}

function cleStock(direction: string, service: string, materiel: string): string {
  return `${direction.trim().toLowerCase()}|${service.trim().toLowerCase()}|${materiel
    .trim()
    .toLowerCase()}`;
}

/** Stock consolidé (Direction / Service / Matériel) */
export function calculerStock(
  entrees: EntreeRecord[],
  affectations: AffectationRecord[]
): StockLigne[] {
  const map = new Map<string, StockLigne>();

  const ajouter = (
    direction: string,
    service: string,
    materiel: string,
    reference: string | undefined,
    quantite: number
  ) => {
    if (!direction || !service || !materiel || !quantite) return;
    const cle = cleStock(direction, service, materiel);
    const existant = map.get(cle);
    if (existant) {
      existant.quantite += quantite;
      if (!existant.reference && reference) existant.reference = reference;
    } else {
      map.set(cle, {
        direction,
        service,
        materiel,
        reference,
        quantite,
      });
    }
  };

  // 1) Entrées VALIDÉES → dans le stock de leur service
  for (const e of entrees) {
    if (getStatutEntreeAffiche(e) !== "Validée") continue;
    if (e.lignes && e.lignes.length > 0) {
      for (const l of e.lignes) {
        ajouter(e.direction, e.service, l.designation, l.reference, Number(l.quantite) || 0);
      }
    } else {
      ajouter(e.direction, e.service, e.materiel, undefined, Number(e.quantite) || 0);
    }
  }

  // 2) Affectations VALIDÉES → source −qté, destinataire +qté
  for (const a of affectations) {
    if (getStatutAffectationAffiche(a) !== "Validée") continue;
    ajouter(a.direction, a.serviceSource, a.materiel, a.materielReference, -a.quantite);
    ajouter(a.direction, a.serviceDestinataire, a.materiel, a.materielReference, a.quantite);
  }

  return Array.from(map.values()).filter((l) => l.quantite > 0);
}

/** Matériaux disponibles dans un service donné */
export function stockDuService(
  stock: StockLigne[],
  direction: string,
  service: string
): StockLigne[] {
  return stock.filter(
    (l) =>
      l.direction.trim().toLowerCase() === direction.trim().toLowerCase() &&
      l.service.trim().toLowerCase() === service.trim().toLowerCase() &&
      l.quantite > 0
  );
}
