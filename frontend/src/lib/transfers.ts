// ---------------------------------------------------------------------------
// AFFECTATION ENTRE SERVICES / TRANSFERT ENTRE DIRECTIONS
//
// Règle métier (spécification) :
//  - Direction source == Direction destination
//      → AFFECTATION INTERNE : pas de sortie, pas de nouvelle entrée.
//        Seulement une modification de destination + traçabilité.
//  - Direction source != Direction destination
//      → TRANSFERT : SORTIE → TRANSFERT → ENTRÉE dans la nouvelle Direction,
//        puis validation par les responsables du service destination.
//
// Les événements sont persistés en local (localStorage) et affichés dans
// l'historique de l'entrée concernée. Une entrée créée par transfert porte
// la référence ENT-AAAA-TNN et démarre « En attente » (0/3) : elle n'est
// VALIDÉE qu'après les 3 validations du service destination.
// ---------------------------------------------------------------------------

import {
  EntreeAdmin,
  EntreeLigne,
  EntreeRecord,
  ENTREE_ADMIN_VIDE,
} from "./movements";

export type TypeMouvementService = "affectation_interne" | "transfert";

export interface AffectationRecord {
  id: string;
  type: TypeMouvementService;
  date: string; // ISO
  /** Référence de l'entrée (ou du matériel) d'origine */
  entreeSourceRef: string;
  materiel: string;
  quantite: number;
  directionSource: string;
  serviceSource: string;
  directionDestination: string;
  serviceDestination: string;
  motif: string;
  utilisateur: string;
  /** Transfert uniquement : références générées (SORTIE / ENTRÉE) */
  referenceSortie?: string;
  referenceEntreeDestination?: string;
}

const CLE_AFFECTATIONS = "comptamatiere_affectations";
const CLE_ENTREES_TRANSFERT = "comptamatiere_entrees_transfert";

function lire<T>(cle: string): T[] {
  try {
    const raw = localStorage.getItem(cle);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function ecrire(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* mode privé : on ignore */
  }
}

export function listerAffectations(): AffectationRecord[] {
  return lire<AffectationRecord>(CLE_AFFECTATIONS);
}

function memeChaine(a: string, b: string): boolean {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

/**
 * Décision automatique :
 * même Direction → affectation interne (aucun mouvement de stock sortant),
 * Directions différentes → transfert complet (SORTIE → TRANSFERT → ENTRÉE).
 */
export function evaluerTypeMouvement(
  directionSource: string,
  directionDestination: string
): TypeMouvementService {
  return memeChaine(directionSource, directionDestination)
    ? "affectation_interne"
    : "transfert";
}

export interface DemandeAffectation {
  entree: EntreeRecord;
  directionDestination: string;
  serviceDestination: string;
  quantite: number;
  motif: string;
  utilisateur: string;
}

export interface ResultatAffectation {
  affectation: AffectationRecord;
  /** Créée uniquement en cas de transfert entre Directions */
  entreeDestination?: EntreeRecord;
}

function prochaineReferenceTransfert(): string {
  const annee = new Date().getFullYear();
  const existantes = getEntreesTransfert();
  const numeros = existantes
    .map((e) => Number((e.reference || "").split("T")[1]))
    .filter((n) => Number.isFinite(n));
  const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `ENT-${annee}-T${String(suivant).padStart(2, "0")}`;
}

function construireEntreeDestination(
  demande: DemandeAffectation,
  affectation: AffectationRecord
): EntreeRecord {
  const { entree } = demande;
  const quantite = Math.max(1, Number(demande.quantite) || 1);
  const reference = prochaineReferenceTransfert();
  const lignes: EntreeLigne[] =
    entree.lignes && entree.lignes.length > 0
      ? entree.lignes.map((l, i) => ({
          ...l,
          numeroOrdre: i + 1,
          quantite: i === 0 ? quantite : l.quantite,
          montant:
            i === 0
              ? Math.round(
                  quantite * (Number(l.prixUnitaire) || 0) * 100
                ) / 100
              : l.montant,
        }))
      : [
          {
            numeroOrdre: 1,
            reference: "",
            designation: entree.materiel,
            espece: entree.categorie,
            unite: "Unité",
            quantite,
            prixUnitaire: 0,
            montant: 0,
            nomenclature: "",
            pieceJustificative: entree.numeroFacture,
            observation: `Transfert depuis ${entree.direction} / ${entree.service}`,
          },
        ];

  const admin: EntreeAdmin = {
    ...ENTREE_ADMIN_VIDE,
    motifEntree: `Transfert depuis ${entree.direction} / ${entree.service}`,
    observations: demande.motif || "",
    pieceJustificative: entree.numeroFacture || "",
  };

  return {
    id: reference,
    reference,
    dateEntree: new Date().toISOString().slice(0, 10),
    materiel: entree.materiel,
    categorie: entree.categorie,
    quantite,
    fournisseur: `Transfert interne (${entree.direction} → ${demande.directionDestination})`,
    numeroFacture: entree.numeroFacture,
    direction: demande.directionDestination,
    service: demande.serviceDestination,
    statut: "En attente",
    responsable: demande.utilisateur || entree.responsable,
    documents: [
      {
        nom: `Transfert issu de ${entree.reference}`,
        type: "Transfert entre Directions",
      },
    ],
    qrToken: reference,
    total: lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
    admin,
    lignes,
  };
}

/**
 * Enregistre une affectation (même Direction) ou un transfert
 * (Directions différentes). Retourne l'opération créée et, pour un
 * transfert, l'entrée générée dans la Direction destination.
 */
export function enregistrerAffectation(
  demande: DemandeAffectation
): ResultatAffectation {
  const { entree } = demande;
  const type = evaluerTypeMouvement(
    entree.direction,
    demande.directionDestination
  );

  const affectation: AffectationRecord = {
    id: `AFF-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`.toUpperCase(),
    type,
    date: new Date().toISOString(),
    entreeSourceRef: entree.reference,
    materiel: entree.materiel,
    quantite: Math.max(1, Number(demande.quantite) || 1),
    directionSource: entree.direction,
    serviceSource: entree.service,
    directionDestination: demande.directionDestination,
    serviceDestination: demande.serviceDestination,
    motif: demande.motif || "",
    utilisateur: demande.utilisateur || "—",
  };

  let entreeDestination: EntreeRecord | undefined;

  if (type === "transfert") {
    // SORTIE de la direction source puis ENTRÉE dans la direction cible.
    affectation.referenceSortie = `SORT-${affectation.id.slice(4, 12)}`;
    entreeDestination = construireEntreeDestination(demande, affectation);
    affectation.referenceEntreeDestination = entreeDestination.reference;
    const entrees = getEntreesTransfert();
    ecrire(CLE_ENTREES_TRANSFERT, [entreeDestination, ...entrees]);
  }

  const affectations = listerAffectations();
  ecrire(CLE_AFFECTATIONS, [affectation, ...affectations]);

  return { affectation, entreeDestination };
}

/** Entrées générées par transfert entre Directions (affichées avec les autres) */
export function getEntreesTransfert(): EntreeRecord[] {
  return lire<EntreeRecord>(CLE_ENTREES_TRANSFERT);
}

export interface EvenementHistorique {
  date: string;
  libelle: string;
  detail: string;
}

/**
 * Historique d'affectation/transfert rattaché à une référence d'entrée :
 * - affectation interne : « Affectation interne » (destination modifiée),
 * - transfert : SORTIE → TRANSFERT → ENTRÉE dans la nouvelle Direction,
 * - entrée créée par transfert : provenance.
 */
export function getHistoriqueAffectations(
  reference: string
): EvenementHistorique[] {
  const evenements: EvenementHistorique[] = [];
  for (const a of listerAffectations()) {
    const date = a.date.slice(0, 10);
    if (a.entreeSourceRef === reference) {
      if (a.type === "affectation_interne") {
        evenements.push({
          date,
          libelle: "Affectation interne",
          detail: `${a.serviceSource} → ${a.serviceDestination} (même Direction ${a.directionSource}) — pas de sortie, pas de nouvelle entrée, ${a.quantite} unité(s)`,
        });
      } else {
        evenements.push(
          {
            date,
            libelle: "Sortie (transfert)",
            detail: `${a.directionSource} / ${a.serviceSource} → ${a.directionDestination} / ${a.serviceDestination} — ${a.quantite} unité(s)`,
          },
          {
            date,
            libelle: "Transfert entre Directions",
            detail: `Réf. ${a.referenceSortie || "—"}${
              a.motif ? ` — ${a.motif}` : ""
            }`,
          },
          {
            date,
            libelle: "Entrée dans la nouvelle Direction",
            detail: `Entrée ${a.referenceEntreeDestination || "—"} en attente de validation par les responsables du service ${a.serviceDestination}`,
          }
        );
      }
    }
    if (a.referenceEntreeDestination === reference) {
      evenements.push({
        date,
        libelle: "Créée par transfert",
        detail: `Transfert en provenance de ${a.directionSource} / ${a.serviceSource} (entrée ${a.entreeSourceRef})`,
      });
    }
  }
  return evenements.sort((a, b) => (a.date < b.date ? -1 : 1));
}
