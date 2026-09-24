// ---------------------------------------------------------------------------
// TRANSFERTS ENTRE DIRECTIONS (Direction A → Direction B)
//
// Règle métier (spécification) :
//   Direction origine ≠ Direction destination
//     → SORTIE du stock de la Direction origine
//     → TRANSFERT (statut « En transfert », référence TRF-AAAA-NNN)
//     → ENTRÉE dans le stock de la Direction destination
//   (Différent de l'AFFECTATION INTERNE : même Direction, pas de sortie.)
//
// Persistance locale (localStorage), dans l'esprit du module Affectations.
// Une entrée « suite à transfert » est créée automatiquement dans la Direction
// destination et démarre « En attente » (0/3) : elle n'est VALIDÉE qu'après
// les 3 validations des responsables du service destinataire.
// ---------------------------------------------------------------------------

import { EntreeRecord } from "./movements";
import {
  DIRECTIONS_REPLI,
  SERVICES_REPLI,
  responsablesDuService,
} from "./organigramme";

// ---------------------------------------------------------------------------
// Types et statuts
// ---------------------------------------------------------------------------

/**
 * Statuts du cycle de vie d'un transfert (spécification §14).
 * La progression SORTIE → ENTRÉE est dérivée des signatures enregistrées.
 */
export type TransfertStatut =
  | "Brouillon"
  | "Sortie en attente"
  | "Sortie validée"
  | "En transfert"
  | "Réception en attente"
  | "Réception partiellement validée"
  | "Réception validée"
  | "Entrée en stock"
  | "Terminé"
  | "Rejeté";

export const STATUTS_TRANSFERT: TransfertStatut[] = [
  "Brouillon",
  "Sortie en attente",
  "Sortie validée",
  "En transfert",
  "Réception en attente",
  "Réception partiellement validée",
  "Réception validée",
  "Entrée en stock",
  "Terminé",
  "Rejeté",
];

export interface TransfertHistorique {
  date: string; // ISO (date + heure)
  libelle: string;
  utilisateur?: string;
}

export interface TransfertRecord {
  id: string;
  /** TRF-AAAA-NNN — numéro de transfert unique */
  reference: string;
  /** Identifiant porté par le QR Code (aucune donnée sensible) */
  qrToken: string;
  date: string; // ISO yyyy-mm-dd (création du transfert)
  directionOrigine: string;
  serviceOrigine: string;
  directionDestination: string;
  serviceDestination: string;
  materiel: string;
  materielReference?: string;
  quantite: number;
  motif: string;
  observation?: string;
  createur: string;
  createurEmail?: string;
  /** Référence de l'entrée d'origine du matériel dans la Direction origine */
  entreeSourceRef?: string;
  /** Responsables de la Direction ORIGINE (validation de la sortie) */
  responsablesOrigine: {
    depositaire: string;
    chefService1: string;
    chefService2: string;
  };
  /** Responsables de la Direction DESTINATION (validation de la réception) */
  responsablesDestination: {
    depositaire: string;
    chefService1: string;
    chefService2: string;
  };
  /** Validation de la SORTIE (Direction origine, 3 signatures ordonnées) */
  signaturesSortie: Partial<{
    depositaire: string; // ISO de signature
    chefService1: string;
    chefService2: string;
  }>;
  signatairesSortie?: Partial<{
    depositaire: string;
    chefService1: string;
    chefService2: string;
  }>;
  /** Validation de la RÉCEPTION (Direction destination, 3 signatures ordonnées) */
  signaturesReception: Partial<{
    depositaire: string;
    chefService1: string;
    chefService2: string;
  }>;
  signatairesReception?: Partial<{
    depositaire: string;
    chefService1: string;
    chefService2: string;
  }>;
  /** Date effective de la sortie (sortie validée) */
  dateSortie?: string;
  /** Date effective de la réception (réception validée) */
  dateReception?: string;
  statut: TransfertStatut;
  historique: TransfertHistorique[];
}

export const SORTIE_VALIDATIONS: Array<{
  key: "depositaire" | "chefService1" | "chefService2";
  label: string;
}> = [
  { key: "depositaire", label: "Dépositaire (origine)" },
  { key: "chefService1", label: "Chef de service 1 (origine)" },
  { key: "chefService2", label: "Chef de service 2 (origine)" },
];

export const RECEPTION_VALIDATIONS: Array<{
  key: "depositaire" | "chefService1" | "chefService2";
  label: string;
}> = [
  { key: "depositaire", label: "Dépositaire (destination)" },
  { key: "chefService1", label: "Chef de service 1 (destination)" },
  { key: "chefService2", label: "Chef de service 2 (destination)" },
];

export const MOTIFS_TRANSFERT = [
  "Transfert vers une autre Direction",
  "Réorganisation administrative",
  "Besoin du service destinataire",
  "Mutualisation des équipements",
];

// ---------------------------------------------------------------------------
// Persistance locale
// ---------------------------------------------------------------------------

const CLE_TRANSFERTS = "comptamatiere_transferts_v1";

function lire(): TransfertRecord[] {
  try {
    const raw = localStorage.getItem(CLE_TRANSFERTS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TransfertRecord[]) : [];
  } catch {
    return [];
  }
}

function persister(records: TransfertRecord[]) {
  try {
    localStorage.setItem(CLE_TRANSFERTS, JSON.stringify(records));
  } catch {
    /* mode privé : on ignore */
  }
}

export function listerTransferts(): TransfertRecord[] {
  return lire();
}

function sauverRecord(maj: TransfertRecord) {
  persister(lire().map((t) => (t.reference === maj.reference ? maj : t)));
}

function trouver(reference: string): TransfertRecord | undefined {
  return lire().find((t) => t.reference === reference);
}

// ---------------------------------------------------------------------------
// Statuts dérivés et affichage
// ---------------------------------------------------------------------------

export function getSignatureSortieCount(t: TransfertRecord): number {
  return SORTIE_VALIDATIONS.filter((v) => t.signaturesSortie?.[v.key]).length;
}

export function getSignatureReceptionCount(t: TransfertRecord): number {
  return RECEPTION_VALIDATIONS.filter((v) => t.signaturesReception?.[v.key]).length;
}

export interface TransfertValidationEtat {
  key: "depositaire" | "chefService1" | "chefService2";
  label: string;
  signed: boolean;
  date?: string;
  signataire?: string;
}

export function getValidationsSortie(t: TransfertRecord): TransfertValidationEtat[] {
  return SORTIE_VALIDATIONS.map(({ key, label }) => ({
    key,
    label,
    signed: !!t.signaturesSortie?.[key],
    date: t.signaturesSortie?.[key],
    signataire: t.signatairesSortie?.[key],
  }));
}

export function getValidationsReception(t: TransfertRecord): TransfertValidationEtat[] {
  return RECEPTION_VALIDATIONS.map(({ key, label }) => ({
    key,
    label,
    signed: !!t.signaturesReception?.[key],
    date: t.signaturesReception?.[key],
    signataire: t.signatairesReception?.[key],
  }));
}

/**
 * Statut affiché dérivé de l'état réel des signatures (source de vérité) :
 *   SORTIE VALIDÉE → EN TRANSFERT → RÉCEPTION EN COURS → RÉCEPTION VALIDÉE →
 *   ENTRÉE EN STOCK → TERMINÉ
 */
export function getStatutTransfertAffiche(t: TransfertRecord): string {
  if (t.statut === "Rejeté") return "Rejeté";
  if (t.statut === "Terminé") return "Terminé";
  const sortie = getSignatureSortieCount(t);
  const reception = getSignatureReceptionCount(t);
  if (sortie < 3) return sortie === 0 ? "Sortie en attente" : "Sortie en attente";
  if (reception === 0) return "En transfert";
  if (reception < 3) return "Réception partiellement validée";
  return "Entrée en stock";
}

export function statutTransfertBadge(statut: string): string {
  switch (statut) {
    case "Terminé":
    case "Entrée en stock":
    case "Réception validée":
    case "Sortie validée":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "En transfert":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "Réception partiellement validée":
    case "Sortie en attente":
    case "Réception en attente":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "Brouillon":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "Rejeté":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

// ---------------------------------------------------------------------------
// Droits de signature
// ---------------------------------------------------------------------------

export interface UtilisateurTransfert {
  name?: string;
  email?: string;
  role?: string | null;
}

function estAdmin(user: UtilisateurTransfert | undefined): boolean {
  return user?.role === "admin";
}

/** Responsable du transfert : le créateur (ou l'admin) pour la sortie. */
export function peutSignerSortie(
  user: UtilisateurTransfert | undefined,
  t: TransfertRecord,
  key: "depositaire" | "chefService1" | "chefService2"
): boolean {
  if (!user || t.statut === "Rejeté") return false;
  if (getSignatureSortieCount(t) >= 3) return false;
  if (t.signaturesSortie?.[key]) return false;
  if (estAdmin(user)) return true;
  if (user.role === "demandeur") return false; // jamais pour un responsable
  if (key === "depositaire") return user.role === "depositaire";
  if (key === "chefService1") return user.role === "magasinier";
  if (key === "chefService2") return user.role === "logistique";
  return false;
}

export function peutSignerReception(
  user: UtilisateurTransfert | undefined,
  t: TransfertRecord,
  key: "depositaire" | "chefService1" | "chefService2"
): boolean {
  if (!user || t.statut === "Rejeté") return false;
  if (getSignatureSortieCount(t) < 3) return false; // la sortie doit être validée d'abord
  if (getSignatureReceptionCount(t) >= 3) return false;
  if (t.signaturesReception?.[key]) return false;
  if (estAdmin(user)) return true;
  if (user.role === "demandeur") return false;
  if (key === "depositaire") return user.role === "depositaire";
  if (key === "chefService1") return user.role === "magasinier";
  if (key === "chefService2") return user.role === "logistique";
  return false;
}

// ---------------------------------------------------------------------------
// Création (TRF-AAAA-NNN)
// ---------------------------------------------------------------------------

export interface NouveauTransfert {
  directionOrigine: string;
  serviceOrigine: string;
  directionDestination: string;
  serviceDestination: string;
  materiel: string;
  materielReference?: string;
  quantite: number;
  motif: string;
  observation?: string;
  createur: string;
  createurEmail?: string;
  entreeSourceRef?: string;
  responsablesOrigine: TransfertRecord["responsablesOrigine"];
  responsablesDestination: TransfertRecord["responsablesDestination"];
}

function prochaineReference(existantes: TransfertRecord[]): string {
  const annee = new Date().getFullYear();
  const numeros = existantes
    .map((t) => Number((t.reference || "").split("-")[2]))
    .filter((n) => Number.isFinite(n));
  const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `TRF-${annee}-${String(suivant).padStart(3, "0")}`;
}

/** Règle métier §17 : contrôle automatique origine ≠ destination. */
export function verifierTransfertValide(
  directionOrigine: string,
  directionDestination: string
): string | null {
  if (!directionOrigine || !directionDestination) {
    return "Veuillez sélectionner les deux Directions.";
  }
  if (directionOrigine.trim().toLowerCase() === directionDestination.trim().toLowerCase()) {
    return "Direction d'origine et Direction destinataire identiques : il s'agit d'une AFFECTATION INTERNE (rubrique Affectations), pas d'un transfert.";
  }
  return null;
}

/**
 * Crée le transfert : référence TRF-AAAA-NNN, statut « Sortie en attente »,
 * QR token, historique initial. La sortie du stock n'interviendra qu'après
 * les 3 signatures de la Direction origine.
 */
export function creerTransfert(input: NouveauTransfert): TransfertRecord {
  const erreur = verifierTransfertValide(
    input.directionOrigine,
    input.directionDestination
  );
  if (erreur) throw new Error(erreur);

  const existantes = listerTransferts();
  const reference = prochaineReference(existantes);
  const maintenant = new Date().toISOString();
  const date = maintenant.slice(0, 10);

  const record: TransfertRecord = {
    id: reference,
    reference,
    qrToken: reference,
    date,
    directionOrigine: input.directionOrigine,
    serviceOrigine: input.serviceOrigine,
    directionDestination: input.directionDestination,
    serviceDestination: input.serviceDestination,
    materiel: input.materiel,
    materielReference: input.materielReference || "—",
    quantite: Math.max(1, Number(input.quantite) || 1),
    motif: input.motif,
    observation: input.observation || "",
    createur: input.createur || "—",
    createurEmail: input.createurEmail || "",
    entreeSourceRef: input.entreeSourceRef,
    responsablesOrigine: input.responsablesOrigine,
    responsablesDestination: input.responsablesDestination,
    signaturesSortie: {},
    signaturesReception: {},
    statut: "Sortie en attente",
    historique: [
      {
        date: maintenant,
        libelle: `Création du transfert par ${input.createur || "—"}`,
        utilisateur: input.createur,
      },
    ],
  };

  persister([record, ...existantes]);
  return record;
}

/** Rejet d'un transfert (sortie non encore validée) par un responsable. */
export function rejeterTransfert(reference: string, user: UtilisateurTransfert): TransfertRecord {
  const record = trouver(reference);
  if (!record) throw new Error("Transfert introuvable.");
  if (getSignatureSortieCount(record) >= 3) {
    throw new Error("Sortie déjà validée : le transfert ne peut plus être rejeté.");
  }
  if (!estAdmin(user) && user.role === "demandeur") {
    throw new Error("Votre rôle (Demandeur) ne permet pas de rejeter un transfert.");
  }
  const maj: TransfertRecord = {
    ...record,
    statut: "Rejeté",
    historique: [
      ...record.historique,
      {
        date: new Date().toISOString(),
        libelle: "Transfert rejeté",
        utilisateur: user.name || "—",
      },
    ],
  };
  sauverRecord(maj);
  return maj;
}

// ---------------------------------------------------------------------------
// Signatures (workflow ordonné, immuable après 3/3)
// ---------------------------------------------------------------------------

/**
 * Pose une signature de SORTIE (Direction origine). L'ordre est imposé :
 * Dépositaire → Chef de service 1 → Chef de service 2.
 * À 3/3 : « Sortie validée » → « En transfert » — le stock de la Direction
 * origine est diminué (consommé au calcul du stock consolidé).
 */
export function signerSortie(
  reference: string,
  key: "depositaire" | "chefService1" | "chefService2",
  user: UtilisateurTransfert
): TransfertRecord {
  const records = listerTransferts();
  const record = records.find((t) => t.reference === reference);
  if (!record) throw new Error("Transfert introuvable.");
  if (record.statut === "Rejeté") {
    throw new Error("Transfert rejeté : signature impossible.");
  }
  if (record.signaturesSortie?.[key]) {
    throw new Error("Cette signature a déjà été enregistrée (jamais modifiable).");
  }
  if (getSignatureSortieCount(record) >= 3) {
    throw new Error("Sortie déjà validée (3/3).");
  }

  const indexCle = SORTIE_VALIDATIONS.findIndex((v) => v.key === key);
  for (let i = 0; i < indexCle; i += 1) {
    const precedent = SORTIE_VALIDATIONS[i].key;
    if (!record.signaturesSortie?.[precedent]) {
      throw new Error(
        `Workflow respecté : la signature « ${SORTIE_VALIDATIONS[i].label} » doit être apposée avant celle-ci.`
      );
    }
  }

  if (!peutSignerSortie(user, record, key)) {
    throw new Error("Votre rôle ne permet pas d'apposer cette signature de sortie.");
  }

  const maintenant = new Date().toISOString();
  const signataire = user.name || user.email || "—";

  const maj: TransfertRecord = {
    ...record,
    signaturesSortie: { ...record.signaturesSortie, [key]: maintenant },
    signatairesSortie: { ...record.signatairesSortie, [key]: signataire },
    historique: [
      ...record.historique,
      {
        date: maintenant,
        libelle: `Sortie validée — ${SORTIE_VALIDATIONS[indexCle].label} (${getSignatureSortieCount(record) + 1}/3) — ${signataire}`,
        utilisateur: signataire,
      },
    ],
  };

  if (getSignatureSortieCount(maj) >= 3) {
    maj.dateSortie = maintenant;
    maj.statut = "En transfert";
    maj.historique = [
      ...maj.historique,
      {
        date: maintenant,
        libelle: `Matériel envoyé — SORTIE VALIDÉE : le stock de ${record.directionOrigine} / ${record.serviceOrigine} est diminué de ${record.quantite} unité(s)`,
        utilisateur: signataire,
      },
    ];
  }

  sauverRecord(maj);
  return maj;
}

/**
 * Pose une signature de RÉCEPTION (Direction destination). Uniquement après
 * une sortie validée (3/3). À 3/3 : « TRANSFERT RÉCEPTIONNÉ » et
 * « ENTRÉE EN STOCK VALIDÉE » — le matériel rejoint le stock de destination.
 */
export function signerReception(
  reference: string,
  key: "depositaire" | "chefService1" | "chefService2",
  user: UtilisateurTransfert
): TransfertRecord {
  const records = listerTransferts();
  const record = records.find((t) => t.reference === reference);
  if (!record) throw new Error("Transfert introuvable.");
  if (record.statut === "Rejeté") {
    throw new Error("Transfert rejeté : réception impossible.");
  }
  if (getSignatureSortieCount(record) < 3) {
    throw new Error(
      "La sortie doit d'abord être validée par les 3 responsables de la Direction d'origine."
    );
  }
  if (record.signaturesReception?.[key]) {
    throw new Error("Cette signature a déjà été enregistrée (jamais modifiable).");
  }
  if (getSignatureReceptionCount(record) >= 3) {
    throw new Error("Réception déjà validée (3/3).");
  }

  const indexCle = RECEPTION_VALIDATIONS.findIndex((v) => v.key === key);
  for (let i = 0; i < indexCle; i += 1) {
    const precedent = RECEPTION_VALIDATIONS[i].key;
    if (!record.signaturesReception?.[precedent]) {
      throw new Error(
        `Workflow respecté : la signature « ${RECEPTION_VALIDATIONS[i].label} » doit être apposée avant celle-ci.`
      );
    }
  }

  if (!peutSignerReception(user, record, key)) {
    throw new Error("Votre rôle ne permet pas d'apposer cette signature de réception.");
  }

  const maintenant = new Date().toISOString();
  const signataire = user.name || user.email || "—";

  const maj: TransfertRecord = {
    ...record,
    signaturesReception: { ...record.signaturesReception, [key]: maintenant },
    signatairesReception: { ...record.signatairesReception, [key]: signataire },
    historique: [
      ...record.historique,
      {
        date: maintenant,
        libelle: `${RECEPTION_VALIDATIONS[indexCle].label} validé (${getSignatureReceptionCount(record) + 1}/3) — ${signataire}`,
        utilisateur: signataire,
      },
    ],
  };

  if (getSignatureReceptionCount(maj) >= 3) {
    maj.dateReception = maintenant;
    maj.statut = "Terminé";
    maj.historique = [
      ...maj.historique,
      {
        date: maintenant,
        libelle: `✓ TRANSFERT RÉCEPTIONNÉ — ENTRÉE EN STOCK VALIDÉE : +${record.quantite} unité(s) dans ${record.directionDestination} / ${record.serviceDestination}`,
        utilisateur: signataire,
      },
    ];
  }

  sauverRecord(maj);
  return maj;
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
  const dates = liste.map((t) => t.date).filter(Boolean).sort();
  const reference = dates[dates.length - 1] || new Date().toISOString().slice(0, 10);
  const duMois = liste.filter((t) => t.date.slice(0, 7) === reference.slice(0, 7)).length;
  const enCours = liste.filter((t) => {
    const s = getStatutTransfertAffiche(t);
    return s !== "Terminé" && s !== "Rejeté";
  }).length;
  const enTransfert = liste.filter(
    (t) => getStatutTransfertAffiche(t) === "En transfert"
  ).length;
  const termines = liste.filter((t) => getStatutTransfertAffiche(t) === "Terminé").length;
  return {
    total: liste.length,
    duMois,
    enCours,
    enTransfert,
    termines,
    moisLabel: formatMois(reference),
  };
}

// ---------------------------------------------------------------------------
// STOCK CONSOLIDÉ (Direction / Service / Matériel)
//
// Le stock est CALCULÉ :
//   + entrées validées rattachées à (Direction / Service),
//   + affectations internes validées (source −qté / destinataire +qté),
//   − transferts SORTIE VALIDÉE (Direction origine −qté),
//   + transferts RÉCEPTION VALIDÉE (Direction destination +qté).
// ---------------------------------------------------------------------------

import { calculerStock as calculerStockAffectations, StockLigne } from "./affectations";

/**
 * Étend le calcul de stock existant (entrées + affectations) avec les
 * transferts entre Directions : sortie dès validation de la sortie (le
 * matériel quitte la Direction origine), entrée dès réception validée.
 */
export function calculerStockAvecTransferts(
  entrees: EntreeRecord[],
  affectations: import("./affectations").AffectationRecord[],
  transferts: TransfertRecord[]
): StockLigne[] {
  const base = calculerStockAffectations(entrees, affectations);
  const map = new Map<string, StockLigne>();
  for (const l of base) {
    map.set(
      `${l.direction.trim().toLowerCase()}|${l.service.trim().toLowerCase()}|${l.materiel.trim().toLowerCase()}`,
      { ...l }
    );
  }

  const ajuster = (
    direction: string,
    service: string,
    materiel: string,
    delta: number
  ) => {
    const cle = `${direction.trim().toLowerCase()}|${service.trim().toLowerCase()}|${materiel.trim().toLowerCase()}`;
    const existant = map.get(cle);
    if (existant) {
      existant.quantite += delta;
    } else if (delta > 0) {
      map.set(cle, {
        direction,
        service,
        materiel,
        reference: undefined,
        quantite: delta,
      });
    }
  };

  for (const t of transferts) {
    const sortieValidee = getSignatureSortieCount(t) >= 3 && t.statut !== "Rejeté";
    const receptionValidee = getSignatureReceptionCount(t) >= 3;
    if (sortieValidee) {
      ajuster(t.directionOrigine, t.serviceOrigine, t.materiel, -t.quantite);
    }
    if (receptionValidee) {
      ajuster(t.directionDestination, t.serviceDestination, t.materiel, +t.quantite);
    }
  }

  return Array.from(map.values()).filter((l) => l.quantite > 0);
}

// ---------------------------------------------------------------------------
// Responsables automatiques (repli hors ligne)
// ---------------------------------------------------------------------------

/** Résout les responsables d'un couple Direction / Service en mode repli. */
export function responsablesRepli(
  directionNom: string,
  serviceNom: string
): TransfertRecord["responsablesOrigine"] {
  const direction = DIRECTIONS_REPLI.find(
    (d) => d.nom.toLowerCase() === directionNom.toLowerCase()
  );
  const service = SERVICES_REPLI.find(
    (s) => s.nom.toLowerCase() === serviceNom.toLowerCase()
  );
  const r = responsablesDuService(service, direction);
  return {
    depositaire: r.depositaire || "—",
    chefService1: r.chefService1 || "—",
    chefService2: r.chefService2 || "—",
  };
}
