import { DemandeMateriel, SortieMateriel } from '../types/accounting';

const DEMANDES_KEY = 'compta_demandes';
const SORTIES_KEY = 'compta_sorties';

// Mock data initiale
const initialDemandes: DemandeMateriel[] = [
  {
    id: 'D-2025-001',
    typeDemande: 'Sortie',
    demandeurId: 'EMP005',
    demandeurNom: 'Pierre Durand',
    direction: 'Informatique',
    equipementDemande: 'Vidéoprojecteur Epson',
    quantite: 1,
    motif: 'Équipement salle de réunion',
    dateDemande: '2025-01-20',
    statut: 'en_attente',
    priorite: 'Urgent'
  },
  {
    id: 'D-2025-002',
    typeDemande: 'Sortie',
    demandeurId: 'EMP003',
    demandeurNom: 'Sophie Martin',
    direction: 'Ressources Humaines',
    equipementDemande: 'Imprimante Laser HP',
    quantite: 1,
    motif: 'Renouvellement matériel défectueux',
    dateDemande: '2025-01-21',
    statut: 'approuvee',
    priorite: 'Normal',
    approuvePar: 'EMP001',
    dateApprobation: '2025-01-21'
  }
];

const initialSorties: SortieMateriel[] = [
  {
    id: 'S-2025-001',
    demandeId: 'D-2025-002',
    equipementDemande: 'Imprimante Laser HP',
    demandeurNom: 'Sophie Martin',
    direction: 'Ressources Humaines',
    quantite: 1,
    dateCreation: '2025-01-21',
    statut: 'en_attente_signatures',
    signatures: {
      depositaire: {
        signePar: 'Jean Dupont',
        signeParId: 'EMP001',
        dateSignature: '2025-01-21'
      }
    }
  }
];

export const getDemandes = (): DemandeMateriel[] => {
  const stored = localStorage.getItem(DEMANDES_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(DEMANDES_KEY, JSON.stringify(initialDemandes));
  return initialDemandes;
};

export const saveDemandes = (demandes: DemandeMateriel[]) => {
  localStorage.setItem(DEMANDES_KEY, JSON.stringify(demandes));
};

export const getSorties = (): SortieMateriel[] => {
  const stored = localStorage.getItem(SORTIES_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(SORTIES_KEY, JSON.stringify(initialSorties));
  return initialSorties;
};

export const saveSorties = (sorties: SortieMateriel[]) => {
  localStorage.setItem(SORTIES_KEY, JSON.stringify(sorties));
};

export const approveDemande = (demandeId: string, depositaireId: string, depositaireNom: string) => {
  const demandes = getDemandes();
  const demande = demandes.find(d => d.id === demandeId);
  if (!demande) return;

  demande.statut = 'approuvee';
  demande.approuvePar = depositaireId;
  demande.dateApprobation = new Date().toISOString().split('T')[0];
  saveDemandes(demandes);

  // Si c'est une demande de sortie, on génère l'objet Sortie
  if (demande.typeDemande === 'Sortie') {
    const sorties = getSorties();
    const newSortie: SortieMateriel = {
      id: `S-${new Date().getFullYear()}-${String(sorties.length + 1).padStart(3, '0')}`,
      demandeId: demande.id,
      equipementDemande: demande.equipementDemande,
      demandeurNom: demande.demandeurNom,
      direction: demande.direction,
      quantite: demande.quantite,
      dateCreation: new Date().toISOString().split('T')[0],
      statut: 'en_attente_signatures',
      signatures: {} // Aucune signature initialement (le dépositaire signera explicitement ensuite)
    };
    sorties.push(newSortie);
    saveSorties(sorties);
  }
};

export const signSortie = (sortieId: string, role: 'depositaire' | 'magasinier' | 'logistique', signerId: string, signerNom: string) => {
  const sorties = getSorties();
  const sortie = sorties.find(s => s.id === sortieId);
  if (!sortie) return;

  sortie.signatures[role] = {
    signePar: signerNom,
    signeParId: signerId,
    dateSignature: new Date().toISOString().split('T')[0]
  };

  // Si les 3 signatures sont présentes, on valide la sortie
  if (sortie.signatures.depositaire && sortie.signatures.magasinier && sortie.signatures.logistique) {
    sortie.statut = 'validee';
  }

  saveSorties(sorties);
};
