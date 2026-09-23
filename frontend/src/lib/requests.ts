// Demandes partagées : source unique utilisée par la page « Demandes »,
// le tableau de bord et le module « Sorties » (lien demande -> sortie).
// Aucune donnée nouvelle : ce sont les demandes historiquement présentes
// dans src/components/Requests.tsx.

export interface Request {
  id: number;
  type: "Entrée" | "Sortie";
  equipment: string;
  requestedBy: string;
  department: string;
  reason: string;
  quantity: number;
  requestDate: string;
  status: "En attente" | "Approuvé" | "Rejeté";
  priority: "Normal" | "Urgent" | "Critique";
  approver?: string;
  notes?: string;
}

export const mockRequests: Request[] = [
  {
    id: 1,
    type: "Entrée",
    equipment: "Ordinateur portable Dell",
    requestedBy: "Marie Dubois",
    department: "IT - Développement",
    reason: "Nouveau collaborateur",
    quantity: 1,
    requestDate: "2025-01-20",
    status: "En attente",
    priority: "Urgent",
  },
  {
    id: 2,
    type: "Sortie",
    equipment: "Imprimante Canon",
    requestedBy: "Pierre Martin",
    department: "Finance",
    reason: "Réparation",
    quantity: 1,
    requestDate: "2025-01-19",
    status: "Approuvé",
    priority: "Normal",
    approver: "Jean Directeur",
  },
  {
    id: 3,
    type: "Sortie",
    equipment: "Ordinateur portable Dell",
    requestedBy: "Randriamampionona Tolotra",
    department: "DRH - Service du Personnel",
    reason: "Renouvellement poste de travail",
    quantity: 1,
    requestDate: "2025-01-21",
    status: "En attente",
    priority: "Normal",
  },
  {
    id: 4,
    type: "Entrée",
    equipment: "Vidéoprojecteur Epson",
    requestedBy: "Rakotoson Jean",
    department: "Direction du Travail (DT)",
    reason: "Équipement salle de réunion",
    quantity: 1,
    requestDate: "2025-01-21",
    status: "Approuvé",
    priority: "Urgent",
    approver: "Rakotomalala Hery",
  },
];
