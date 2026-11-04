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
// Validation à DEUX signatures obligatoires, dans l'ordre :
//   0/2 En attente → 1/2 Responsable du transfert → 2/2 → ✓ TRANSFERT VALIDÉ
// (les anciens transferts, créés avant la suppression des deux chefs de
//  service, restent réglés sur 4 validations — cf. validationsAttendues).
// Un transfert validé n'est plus modifiable.
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
  // Conservées pour lire les anciens enregistrements (circuit à 4 signatures) :
  // elles ne figurent plus dans AFFECTATION_VALIDATIONS, donc jamais proposées.
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
  /** Direction choisie comme destination : le matériel QUITTE la Direction du
   *  compte (service d'origine automatique) pour rejoindre cette Direction. */
  directionDestinataire: string;
  serviceSource: string;
  /** Ancien format (transfert interne au sein d'une même Direction) : conservé
   *  pour les enregistrements existants. Les nouveaux transferts ne renseignent
   *  plus de service destinataire — la destination est une Direction. */
  serviceDestinataire: string;
  materiel: string;
  materielReference: string;
  quantite: number;
  motif: string;
  observation: string;
  /** Créateur (nom + email) : signe la validation 1/2 « Responsable du transfert » */
  createur: string;
  createurEmail: string;
  responsables: {
    responsableTransfert: string;
    depositaire: string;
    /** Anciennes signatures : plus saisies depuis la suppression des deux
     *  chefs de service (présentes uniquement sur les anciens transferts). */
    chefService1?: string;
    chefService2?: string;
  };
  validations: Partial<Record<AffectationCleValidation, AffectationValidationInfo>>;
  statut: AffectationStatut;
  historique: AffectationHistorique[];
}

/** Les 2 validations obligatoires (dans l'ordre du workflow) */
export const AFFECTATION_VALIDATIONS: Array<{
  key: AffectationCleValidation;
  label: string;
}> = [
  { key: "responsableTransfert", label: "Responsable du transfert" },
  { key: "depositaire", label: "Dépositaire" },
];

/** Nombre de validations attendues par un transfert donné :
 *  4 pour un enregistrement antérieur à la suppression des chefs de service
 *  (il porte encore leurs responsables), 2 sinon. */
export function validationsAttendues(a: AffectationRecord): number {
  return clesAttendues(a).length;
}

/** Clés de validation attendues pour CE transfert : les 2 actuelles, ou les
 *  4 de l'ancien circuit pour un enregistrement qui les porte encore. */
export function clesAttendues(a: AffectationRecord): AffectationCleValidation[] {
  const actuelles = AFFECTATION_VALIDATIONS.map((v) => v.key);
  const ancienCircuit =
    a.responsables.chefService1 !== undefined ||
    a.responsables.chefService2 !== undefined ||
    a.validations.chefService1 !== undefined ||
    a.validations.chefService2 !== undefined;
  return ancienCircuit
    ? [...actuelles, "chefService1", "chefService2"]
    : actuelles;
}

// Le motif est une donnée SAISIE par l'utilisateur (champ libre) : il n'y a
// plus de liste de motifs imposée.

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
  return clesAttendues(a).filter((cle) => a.validations[cle]).length;
}

/** 2/2 → « Validée », sinon « En attente » (progression affichée x/2) */
export function getStatutAffectationAffiche(a: AffectationRecord): string {
  return getValidationCount(a) >= validationsAttendues(a)
    ? "Validée"
    : "En attente";
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
  directionDestinataire: string;
  serviceSource: string;
  /** Optionnel : seul l'ancien format interne le renseignait. */
  serviceDestinataire?: string;
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

/** Direction destinataire d'un transfert.
 *  Anciens enregistrements (transfert interne) : la seule Direction du record. */
export function directionDestinataireDe(a: AffectationRecord): string {
  return (a.directionDestinataire || "").trim() || a.direction;
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
    directionDestinataire: input.directionDestinataire,
    serviceSource: input.serviceSource,
    serviceDestinataire: input.serviceDestinataire || "",
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
    historique: [{ date, libelle: `Création du transfert par ${input.createur || "—"}` }],
  };

  persister([record, ...existantes]);
  return record;
}

// ---------------------------------------------------------------------------
// Validation (workflow ordonné, immuable après 2/2)
// ---------------------------------------------------------------------------

export interface UtilisateurValidation {
  name?: string;
  email?: string;
  role?: string | null;
}

/**
 * Qui a le droit de poser la validation `key` ?
 *  - Responsable du transfert : le CRÉATEUR du transfert (ou l'admin),
 *  - Dépositaire              : rôle depositaire (ou admin).
 * Un Demandeur ne signe JAMAIS à la place d'un responsable (sauf 1/2 sur sa
 * propre création, en tant que créateur/responsable du transfert).
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
  // « chefService1 » / « chefService2 » : circuit supprimé, jamais posables.
  return false;
}

/**
 * Pose une validation. L'ordre est imposé (les validations précédentes
 * doivent exister) et un transfert validé (2/2) n'est plus modifiable.
 * À 2/2 : statut « Validée » + le stock est mis à jour (source −quantité /
 * Direction destinataire +quantité).
 */
export function validerAffectation(
  reference: string,
  key: AffectationCleValidation,
  user: UtilisateurValidation
): AffectationRecord {
  const records = listerAffectations();
  const record = records.find((a) => a.reference === reference);
  if (!record) throw new Error("Transfert introuvable.");
  if (record.statut === "Validée")
    throw new Error(
      `Transfert déjà validé (${validationsAttendues(record)}/${validationsAttendues(record)}) : il n'est plus modifiable.`
    );
  if (record.validations[key])
    throw new Error("Cette validation a déjà été enregistrée (jamais modifiable).");

  const indexCle = AFFECTATION_VALIDATIONS.findIndex((v) => v.key === key);
  if (indexCle < 0)
    throw new Error("Cette validation n'existe plus dans le circuit d'approbation.");
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
    { date: maintenant.slice(0, 10), libelle: `Validation ${label} (${indexCle + 1}/${AFFECTATION_VALIDATIONS.length}) — ${signataire}` },
  ];

  const attendues = validationsAttendues(record);
  const total = clesAttendues(record).filter((cle) => record.validations[cle])
    .length;
  if (total >= attendues) {
    record.statut = "Validée";
    record.historique = [
      ...record.historique,
      {
        date: maintenant.slice(0, 10),
        libelle: `✓ Transfert validé (${attendues}/${attendues}) — stock mis à jour : −${record.quantite} (${record.serviceSource}) / +${record.quantite} (${directionDestinataireDe(record)})`,
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
    // `service` peut être vide : la destination d'un transfert est une
    // Direction, pas un service (la ligne de stock est alors rattachée à la
    // seule Direction destinataire).
    if (!direction || !materiel || !quantite) return;
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
    ajouter(
      directionDestinataireDe(a),
      a.serviceDestinataire,
      a.materiel,
      a.materielReference,
      a.quantite
    );
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
