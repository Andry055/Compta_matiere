// ---------------------------------------------------------------------------
// REDDITION DE COMPTE — client des rapports annuels
//
// Consomme les endpoints lecture seule du backend :
//   GET /api/rapports/recapitulation?annee=AAAA
//   GET /api/rapports/recapitulations?depuis=AAAA&jusqu=AAAA
//   GET /api/rapports/etat-appreciatif?annee=AAAA
//   GET /api/rapports/inventaire?annee=AAAA
//   GET /api/rapports/grand-livre?materiel=ID&annee=AAAA
//   GET /api/rapports/bordereau?annee=AAAA[&jusqu=AAAA]
//
// Accès : dépositaire, comptable, logistique (contrôle aussi côté serveur).
// Les fonctions retournent `null` si non connecté / non autorisé / backend
// injoignable : l'écran affiche alors « Aucune donnée pour cette année ».
// ---------------------------------------------------------------------------

import { api } from "./api";

/* ────────────────────────────── Types ────────────────────────────── */

export interface LigneMouvementApi {
  id?: number | string;
  documentId?: string;
  sens: "entree" | "sortie";
  date: string | null;
  reference: string | null;
  statut: string | null;
  quantite: number;
  montant: number;
  valeurUnitaire: number;
  designation: string | null;
  nomenclature: string | null;
  materielId: string | null;
  pieceJustificative: string | null;
  numeroFacture: string | null;
}

export interface RecapLigne {
  nomenclature: string;
  existant: number;
  entrees: number;
  total: number;
  sorties: number;
  reste: number;
  quantiteEntree?: number;
  quantiteSortie?: number;
}

export interface RecapTotaux {
  existant: number;
  entrees: number;
  total: number;
  sorties: number;
  reste: number;
}

export interface Recapitulation {
  annee: number;
  lignes: RecapLigne[];
  totaux: RecapTotaux;
}

export interface MouvementGroupe {
  reference: string | null;
  date: string | null;
  lignes: LigneMouvementApi[];
  montant: number;
}

export interface EtatAppreciatif {
  annee: number;
  mouvementsEntree: MouvementGroupe[];
  mouvementsSortie: MouvementGroupe[];
  nombrePieces: number;
  totalEntrees: number;
  totalSorties: number;
}

export interface InventaireArticle {
  materielId: string | null;
  designation: string;
  nomenclature: string;
  unite: string;
  prixUnitaire: number;
  quantites: { existant: number; entrees: number; sorties: number; reste: number };
  valeurs: { existant: number; entrees: number; total: number; sorties: number; reste: number };
}

export interface InventaireSection {
  nomenclature: string;
  articles: InventaireArticle[];
  totaux: {
    quantites: { existant: number; entrees: number; sorties: number; reste: number };
    valeurs: { existant: number; entrees: number; total: number; sorties: number; reste: number };
  };
}

export interface Inventaire {
  annee: number;
  sections: InventaireSection[];
}

export interface GrandLivreMouvement {
  date: string | null;
  reference: string | null;
  sens: "entree" | "sortie";
  quantiteEntree: number;
  quantiteSortie: number;
  quantiteCumulee: number;
  montant: number;
  pieceJustificative: string | null;
}

/** En-tête de la Fiche de stock : identité du matériel + photo de RÉFÉRENCE
 *  (champ media `photos` de material, première image). Absente = null : le
 *  reste de la fiche s'affiche normalement. */
export interface GrandLivreMateriel {
  documentId?: string;
  designation: string | null;
  nomenclature: string | null;
  photo: string | null;
}

export interface GrandLivre {
  materielId: string;
  /** Fiche matériel rattachée (lecture seule, renvoyée par le serveur). */
  materiel?: GrandLivreMateriel | null;
  annee: number | null;
  mouvements: GrandLivreMouvement[];
  totalEntreesQ: number;
  totalSortiesQ: number;
  quantiteFinale: number;
}

export interface BordereauAnnee {
  annee: number;
  ordresEntree: number;
  factures: number;
}

export interface Bordereau {
  parAnnee: BordereauAnnee[];
  totalOrdres: number;
  totalFactures: number;
}

/* ─────────────────────────── Appels API ─────────────────────────── */

async function getRapport<T>(path: string, params: Record<string, string | number>): Promise<T | null> {
  try {
    const { data } = await api.get(path, { params, timeout: 15000 });
    return (data?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export function fetchRecapitulation(annee: number): Promise<Recapitulation | null> {
  return getRapport("/api/rapports/recapitulation", { annee });
}

export function fetchRecapitulations(depuis: number, jusqu: number): Promise<Recapitulation[] | null> {
  return getRapport("/api/rapports/recapitulations", { depuis, jusqu });
}

export function fetchEtatAppreciatif(annee: number): Promise<EtatAppreciatif | null> {
  return getRapport("/api/rapports/etat-appreciatif", { annee });
}

export function fetchInventaire(annee: number): Promise<Inventaire | null> {
  return getRapport("/api/rapports/inventaire", { annee });
}

export function fetchGrandLivre(materielId: string, annee?: number): Promise<GrandLivre | null> {
  const params: Record<string, string | number> = { materiel: materielId };
  if (annee) params.annee = annee;
  return getRapport("/api/rapports/grand-livre", params);
}

export function fetchBordereau(annee: number, jusqu?: number): Promise<Bordereau | null> {
  const params: Record<string, string | number> = { annee };
  if (jusqu && jusqu > annee) params.jusqu = jusqu;
  return getRapport("/api/rapports/bordereau", params);
}
