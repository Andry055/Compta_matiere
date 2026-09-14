// Types pour la comptabilité matière conforme au journal d'entreprise

export interface JournalEntry {
  id: string
  numeroOrdre: string // Numéro d'ordre unique dans le journal
  pieceJustificative: string // Référence de la pièce justificative
  dateEntree: string // Date d'entrée dans le journal
  origine: OrigineSortie // Origine des entrées / destination des sorties
  numeroNomenclature: string // Numéro d'ordre de la nomenclature
  designation: string // Désignation du matériel
  espece: string // Type/catégorie du matériel
  uniteNombre: number // Quantité en nombre d'unités
  prixUnitaire: number // Prix unitaire
  valeurTotale: number // Valeur totale (uniteNombre * prixUnitaire)
  qualite: QualiteMateriel // État/qualité du matériel
  statut: StatutMateriel // Statut actuel
  observations?: string // Notes et observations
  createdBy: string // Utilisateur qui a créé l'entrée
  updatedAt: string // Dernière mise à jour
}

export interface OrigineSortie {
  type: 'fournisseur' | 'entreprise' | 'donation' | 'retour' | 'transfert'
  nom: string // Nom du fournisseur/entreprise ou type de donation
  reference?: string // Référence fournisseur ou numéro de commande
  adresse?: string
  contact?: string
}

export interface QualiteMateriel {
  etat: 'neuf' | 'bon' | 'moyen' | 'defaillant' | 'hs' // Hors service
  notes?: string
  dateControle?: string
  controlePar?: string
}

export type StatutMateriel = 'en_stock' | 'distribue' | 'maintenance' | 'reforme' | 'sortie'

export interface NomenclatureItem {
  numero: string
  designation: string
  categorie: string
  specification: string
  uniteStock: string // kg, pièce, mètre, etc.
  seuilAlerte: number
  dureeVie?: number // en mois
}

export interface MouvementStock {
  id: string
  journalEntryId: string
  type: 'entree' | 'sortie'
  numeroOrdre: string
  dateOperation: string
  quantiteAvant: number
  quantiteMouvement: number
  quantiteApres: number
  destination?: string // Pour les sorties
  operateur: string
  motif: string
  pieceJustificative: string
}

// Interface pour les rapports comptables
export interface RapportComptable {
  periode: {
    debut: string
    fin: string
  }
  totalEntrees: {
    quantite: number
    valeur: number
  }
  totalSorties: {
    quantite: number
    valeur: number
  }
  stockActuel: {
    quantite: number
    valeur: number
  }
  mouvements: MouvementStock[]
  anomalies: AnomalieStock[]
}

export interface AnomalieStock {
  type: 'rupture' | 'surstockage' | 'ecart_inventaire' | 'peremption'
  materielId: string
  description: string
  dateDetection: string
  statut: 'detectee' | 'en_cours' | 'resolue'
  actionCorrective?: string
}

// Types pour l'interface utilisateur
export interface FiltresJournal {
  dateDebut?: string
  dateFin?: string
  origine?: string
  statut?: StatutMateriel
  nomenclature?: string
  numeroOrdre?: string
}

export interface OptionsAffichage {
  grouperPar: 'date' | 'origine' | 'nomenclature' | 'statut'
  trierPar: 'date' | 'numeroOrdre' | 'valeur' | 'designation'
  ordreTri: 'asc' | 'desc'
  afficherValeurs: boolean
  afficherDetails: boolean
}