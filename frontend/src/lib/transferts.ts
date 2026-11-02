// ---------------------------------------------------------------------------
// TRANSFERTS ENTRE SERVICES (même Direction uniquement)
//
// Règle métier :
//   DIRECTION → SERVICE SOURCE → TRANSFERT → SERVICE DESTINATAIRE
//   → Mise à jour du stock → Traçabilité
//   PAS DE SORTIE, PAS DE NOUVELLE ENTRÉE.
//
// Une transfert concerne un matériel DÉJÀ enregistré dans le stock d'une
// Direction et change uniquement le service de destination.
// (Direction A ≠ Direction B → il s'agit d'un TRANSFERT : SORTIE → ENTRÉE,
//  opération distincte, gérée hors de cette rubrique.)
//
// Validation à TROIS signatures obligatoires, dans l'ordre :
//   0/3 En attente → 1/3 Responsable du transfert → 2/3 Dépositaire
//   → 3/3 Logistique → ✓ TRANSFERT VALIDÉ
// (les anciens transferts, créés avant la suppression des deux chefs de
//  service, restent réglés sur 4 validations — cf. validationsAttendues).
// Un transfert validé n'est plus modifiable.
// ---------------------------------------------------------------------------

import { EntreeRecord, getStatutEntreeAffiche } from "./movements";

export type TransfertStatut = "En attente" | "Validée";

export interface TransfertValidationInfo {
  date: string; // ISO
  signataire: string;
}

export type TransfertCleValidation =
  | "responsableTransfert"
  | "depositaire"
  | "logistique"
  // Conservées pour lire les anciens enregistrements (circuit à 4 signatures) :
  // elles ne figurent plus dans TRANSFERT_VALIDATIONS, donc jamais proposées.
  | "chefService1"
  | "chefService2";

export interface TransfertHistorique {
  date: string;
  libelle: string;
}

export interface TransfertRecord {
  id: string;
  /** TRF-AAAA-NNN */
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
  /** Créateur (nom + email) : signe la validation 1/3 « Responsable du transfert » */
  createur: string;
  createurEmail: string;
  responsables: {
    responsableTransfert: string;
    depositaire: string;
    /** Chef logistique : 3ᵉ signataire du circuit actuel. */
    logistique?: string;
    /** Anciennes signatures : plus saisies depuis la suppression des deux
     *  chefs de service (présentes uniquement sur les anciens transferts). */
    chefService1?: string;
    chefService2?: string;
  };
  validations: Partial<Record<TransfertCleValidation, TransfertValidationInfo>>;
  statut: TransfertStatut;
  historique: TransfertHistorique[];
}

/** Les 3 validations obligatoires (dans l'ordre du workflow) */
export const TRANSFERT_VALIDATIONS: Array<{
  key: TransfertCleValidation;
  label: string;
}> = [
  { key: "responsableTransfert", label: "Responsable du transfert" },
  { key: "depositaire", label: "Dépositaire" },
  { key: "logistique", label: "Logistique" },
];

/** Clés du circuit historique (4 signatures), dans l'ordre. */
const ANCIEN_CIRCUIT: TransfertCleValidation[] = [
  "responsableTransfert",
  "depositaire",
  "chefService1",
  "chefService2",
];

/** Nombre de validations attendues par un transfert donné :
 *  4 pour un enregistrement antérieur à la suppression des chefs de service
 *  (il porte encore leurs responsables), 3 sinon. */
export function validationsAttendues(a: TransfertRecord): number {
  return clesAttendues(a).length;
}

/** Clés de validation attendues pour CE transfert : les 3 actuelles, ou les
 *  4 de l'ancien circuit pour un enregistrement qui les porte encore. */
export function clesAttendues(a: TransfertRecord): TransfertCleValidation[] {
  const ancienCircuit =
    a.responsables.chefService1 !== undefined ||
    a.responsables.chefService2 !== undefined ||
    a.validations.chefService1 !== undefined ||
    a.validations.chefService2 !== undefined;
  return ancienCircuit ? ANCIEN_CIRCUIT : TRANSFERT_VALIDATIONS.map((v) => v.key);
}

// Le motif est une donnée SAISIE par l'utilisateur (champ libre) : il n'y a
// plus de liste de motifs imposée.

const CLE = "comptamatiere_transferts_v2";
/** Ancienne clé (module renommé « affectations ») : relue une fois pour ne
 *  pas perdre les traces historiques déjà enregistrées dans le navigateur. */
const CLE_ANCIENNE = "comptamatiere_affectations_v2";

export function listerTransferts(): TransfertRecord[] {
  try {
    let raw = localStorage.getItem(CLE);
    if (!raw) {
      const ancien = localStorage.getItem(CLE_ANCIENNE);
      if (ancien) {
        localStorage.setItem(CLE, ancien);
        raw = ancien;
      }
    }
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TransfertRecord[]) : [];
  } catch {
    return [];
  }
}

function persister(records: TransfertRecord[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(records));
  } catch {
    /* mode privé : on ignore */
  }
}

/**
 * Fusionne les transferts en base (serveur) avec les traces historiques restées
 * dans le localStorage. Doublons résolus PAR RÉFÉRENCE : la version serveur
 * l'emporte, les créations locales non remontées sont conservées.
 */
export function fusionnerTransferts(
  locales: TransfertRecord[],
  serveur: TransfertRecord[]
): TransfertRecord[] {
  const referencesServeur = new Set(serveur.map((a) => a.reference));
  return [
    ...serveur,
    ...locales.filter((a) => !referencesServeur.has(a.reference)),
  ];
}

// ---------------------------------------------------------------------------
// État des validations
// ---------------------------------------------------------------------------

export interface TransfertValidationEtat {
  key: TransfertCleValidation;
  label: string;
  signed: boolean;
  date?: string;
  signataire?: string;
}

export function getValidationsTransfert(
  a: TransfertRecord
): TransfertValidationEtat[] {
  return TRANSFERT_VALIDATIONS.map(({ key, label }) => ({
    key,
    label,
    signed: !!a.validations?.[key],
    date: a.validations?.[key]?.date,
    signataire: a.validations?.[key]?.signataire,
  }));
}

export function getValidationCount(a: TransfertRecord): number {
  return clesAttendues(a).filter((cle) => a.validations[cle]).length;
}

/** n/n → « Validée », sinon « En attente » (progression affichée x/3) */
export function getStatutTransfertAffiche(a: TransfertRecord): string {
  return getValidationCount(a) >= validationsAttendues(a)
    ? "Validée"
    : "En attente";
}

export function statutTransfertBadge(statut: string): string {
  return statut === "Validée"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

export interface NouveauTransfert {
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
  responsables: TransfertRecord["responsables"];
  createur: string;
  createurEmail: string;
}

function prochaineReference(existantes: TransfertRecord[]): string {
  const annee = new Date().getFullYear();
  const numeros = existantes
    .map((a) => Number((a.reference || "").split("-")[2]))
    .filter((n) => Number.isFinite(n));
  const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `TRF-${annee}-${String(suivant).padStart(3, "0")}`;
}

/** Direction destinataire d'un transfert.
 *  Anciens enregistrements (transfert interne) : la seule Direction du record. */
export function directionDestinataireDe(a: TransfertRecord): string {
  return (a.directionDestinataire || "").trim() || a.direction;
}

export function creerTransfert(
  input: NouveauTransfert
): TransfertRecord {
  const existantes = listerTransferts();
  const reference = prochaineReference(existantes);
  const date = new Date().toISOString().slice(0, 10);

  const record: TransfertRecord = {
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
// Validation (workflow ordonné, immuable après n/n)
// ---------------------------------------------------------------------------

export interface UtilisateurValidation {
  name?: string;
  email?: string;
  role?: string | null;
}

/**
 * Qui a le droit de poser la validation `key` ?
 *  - Responsable du transfert : le CRÉATEUR du transfert (ou l'admin),
 *  - Dépositaire              : rôle depositaire (ou admin),
 *  - Logistique               : rôle logistique (ou admin).
 * Un Demandeur ne signe JAMAIS à la place d'un responsable (sauf 1/3 sur sa
 * propre création, en tant que créateur/responsable du transfert).
 */
export function peutValiderTransfert(
  user: UtilisateurValidation | undefined,
  a: TransfertRecord,
  key: TransfertCleValidation
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
  if (key === "logistique") return user.role === "logistique";
  // « chefService1 » / « chefService2 » : circuit supprimé, jamais posables.
  return false;
}

/**
 * Pose une validation. L'ordre est imposé (les validations précédentes
 * doivent exister) et un transfert validé (n/n) n'est plus modifiable.
 * À 3/3 : statut « Validée » + le stock est mis à jour (source −quantité /
 * Direction destinataire +quantité).
 */
export function validerTransfert(
  reference: string,
  key: TransfertCleValidation,
  user: UtilisateurValidation
): TransfertRecord {
  const records = listerTransferts();
  const record = records.find((a) => a.reference === reference);
  if (!record) throw new Error("Transfert introuvable.");
  if (record.statut === "Validée")
    throw new Error(
      `Transfert déjà validé (${validationsAttendues(record)}/${validationsAttendues(record)}) : il n'est plus modifiable.`
    );
  if (record.validations[key])
    throw new Error("Cette validation a déjà été enregistrée (jamais modifiable).");

  const indexCle = TRANSFERT_VALIDATIONS.findIndex((v) => v.key === key);
  if (indexCle < 0)
    throw new Error("Cette validation n'existe plus dans le circuit d'approbation.");
  for (let i = 0; i < indexCle; i += 1) {
    const precedent = TRANSFERT_VALIDATIONS[i].key;
    if (!record.validations[precedent]) {
      throw new Error(
        `Workflow respecté : validation « ${TRANSFERT_VALIDATIONS[i].label} » attendue avant celle-ci.`
      );
    }
  }

  if (!peutValiderTransfert(user, record, key))
    throw new Error("Votre rôle ne vous permet pas de poser cette validation.");

  const maintenant = new Date().toISOString();
  const signataire = user.name || user.email || "—";
  record.validations = {
    ...record.validations,
    [key]: { date: maintenant, signataire },
  };

  const label = TRANSFERT_VALIDATIONS[indexCle].label;
  record.historique = [
    ...record.historique,
    { date: maintenant.slice(0, 10), libelle: `Validation ${label} (${indexCle + 1}/${TRANSFERT_VALIDATIONS.length}) — ${signataire}` },
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

export function getStatistiquesTransferts(records?: TransfertRecord[]) {
  const liste = records ?? listerTransferts();
  const dates = liste.map((a) => a.date).filter(Boolean).sort();
  const reference = dates[dates.length - 1] || new Date().toISOString().slice(0, 10);
  const duMois = liste.filter((a) => a.date.slice(0, 7) === reference.slice(0, 7)).length;
  const validees = liste.filter((a) => getStatutTransfertAffiche(a) === "Validée").length;
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
//   −/+ transferts validées (source → destinataire).
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
  transferts: TransfertRecord[]
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

  // 2) Transferts VALIDÉES → source −qté, destinataire +qté
  for (const a of transferts) {
    if (getStatutTransfertAffiche(a) !== "Validée") continue;
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
