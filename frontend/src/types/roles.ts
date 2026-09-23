// Définition des 5 rôles métier réglementaires de la comptabilité matière

export type AppRole = 'depositaire' | 'magasinier' | 'logistique' | 'comptable' | 'demandeur';

export type DemandeurLevel = 'service' | 'direction';

export type SignRole = 'depositaire' | 'magasinier' | 'logistique' | null;

export interface RoleConfig {
  key: AppRole;
  label: string;
  defaultEmployeeName: string;
  description: string;
  pages: string[];
  signRole: SignRole;
  canApprove: boolean;
  levelLock: DemandeurLevel | 'dynamic' | null;
}

export const ROLES_CONFIG: Record<AppRole, RoleConfig> = {
  depositaire: {
    key: 'depositaire',
    label: 'Dépositaire par service',
    defaultEmployeeName: 'Rakotomalala Hery',
    description: "Dépositaire du service : réceptionne et enregistre les arrivées, tient le grand livre, traite et approuve les demandes, signe les sorties, déclare les pertes et clôture l'inventaire annuel.",
    pages: ['dashboard', 'arrivee', 'journal', 'equipment', 'requests', 'distribution', 'movements', 'pertes', 'inventaire', 'departments', 'reports', 'users', 'settings'],
    signRole: 'depositaire',
    canApprove: true,
    levelLock: null,
  },
  magasinier: {
    key: 'magasinier',
    label: 'Magasinier',
    defaultEmployeeName: 'Andriamampianina Fara',
    description: "Réceptionne le matériel au magasin, contrôle son état physique à l'arrivée, consulte le stock, signe les sorties et participe aux mises au rebut.",
    pages: ['dashboard', 'arrivee', 'equipment', 'distribution', 'movements', 'pertes'],
    signRole: 'magasinier',
    canApprove: false,
    levelLock: null,
  },
  logistique: {
    key: 'logistique',
    label: 'Chef logistique',
    defaultEmployeeName: 'Razafindrakoto Tojo',
    description: "Supervise la chaîne d'approvisionnement, appose la 3ème signature obligatoire de sortie et suit l'historique des mouvements.",
    pages: ['dashboard', 'distribution', 'movements'],
    signRole: 'logistique',
    canApprove: false,
    levelLock: null,
  },
  comptable: {
    key: 'comptable',
    label: 'Comptable',
    defaultEmployeeName: 'Ravaomanana Nirina',
    description: "Vérifie le journal de comptabilité matière, audite la valorisation et les déclarations de perte, et produit les rapports de reddition de comptes.",
    pages: ['dashboard', 'journal', 'movements', 'pertes', 'reports'],
    signRole: null,
    canApprove: false,
    levelLock: null,
  },
  demandeur: {
    key: 'demandeur',
    label: 'Demandeur',
    defaultEmployeeName: 'Randriamampionona Tolotra',
    description: "Exprime les besoins en matériel pour son service ou sa direction et assure le suivi direct de ses demandes.",
    pages: ['dashboard', 'equipment', 'entries', 'exits', 'requests', 'reports'],
    signRole: null,
    canApprove: false,
    levelLock: 'dynamic',
  },
};
