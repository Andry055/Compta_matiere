import { useState } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, Calendar, Download } from "lucide-react"

interface Movement {
  id: number
  equipment: string
  equipmentId: number
  serialNumber: string
  type: 'Entrée' | 'Sortie'
  quantity: number
  department: string
  agent: string
  date: string
  time: string
  reason: string
  status: 'Validé' | 'En attente' | 'Annulé'
  approver?: string
  notes?: string
}

const mockMovements: Movement[] = [
  {
    id: 1,
    equipment: "Ordinateur portable HP EliteBook",
    equipmentId: 1,
    serialNumber: "HP240501A",
    type: "Entrée",
    quantity: 1,
    department: "IT - Développement",
    agent: "Marie Dubois",
    date: "2025-01-20",
    time: "14:30",
    reason: "Nouvelle attribution",
    status: "Validé",
    approver: "Jean Directeur",
    notes: "Attribution pour nouveau projet",
  },
  {
    id: 2,
    equipment: "Clavier mécanique Logitech",
    equipmentId: 2,
    serialNumber: "LG789456",
    type: "Sortie",
    quantity: 1,
    department: "RH - Recrutement",
    agent: "Pierre Martin",
    date: "2025-01-20",
    time: "10:15",
    reason: "Transfert Direction",
    status: "En attente",
    notes: "Transfert vers service comptabilité",
  },
  {
    id: 3,
    equipment: 'Écran Dell UltraSharp 24"',
    equipmentId: 3,
    serialNumber: "DL987321",
    type: "Sortie",
    quantity: 1,
    department: "Finance - Comptabilité",
    agent: "Sophie Bernard",
    date: "2025-01-19",
    time: "16:45",
    reason: "Maintenance",
    status: "Validé",
    approver: "Claire Manager",
    notes: "Défaillance écran - réparation",
  },
  {
    id: 4,
    equipment: "Imprimante laser Canon",
    equipmentId: 4,
    serialNumber: "CN445678",
    type: "Entrée",
    quantity: 1,
    department: "Finance - Comptabilité",
    agent: "Antoine Rousseau",
    date: "2025-01-19",
    time: "09:20",
    reason: "Retour maintenance",
    status: "Validé",
    approver: "Claire Manager",
    notes: "Maintenance terminée - remise en service",
  },
  {
    id: 5,
    equipment: "Téléphone IP Cisco",
    equipmentId: 5,
    serialNumber: "CS789012",
    type: "Entrée",
    quantity: 1,
    department: "Commercial - Ventes",
    agent: "Lucie Moreau",
    date: "2025-01-18",
    time: "11:30",
    reason: "Nouvel équipement",
    status: "Validé",
    approver: "Marc Superviseur",
    notes: "Achat pour extension équipe",
  },
];

export function Movements() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("Tous")
  const [statusFilter, setStatusFilter] = useState("Tous")
  const [dateFilter, setDateFilter] = useState("")
  const [showDetails, setShowDetails] = useState<number | null>(null)

  const filteredMovements = mockMovements.filter(movement => {
    const matchesSearch = movement.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.agent.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "Tous" || movement.type === typeFilter
    const matchesStatus = statusFilter === "Tous" || movement.status === statusFilter
    const matchesDate = !dateFilter || movement.date === dateFilter
    return matchesSearch && matchesType && matchesStatus && matchesDate
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Validé': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'En attente': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'Annulé': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getTypeIcon = (type: string) => {
    return type === 'Entrée' ? ArrowUp : ArrowDown
  }

  const getTypeColor = (type: string) => {
    return type === 'Entrée' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  }

  const totalEntries = mockMovements.filter(m => m.type === 'Entrée').length
  const totalExits = mockMovements.filter(m => m.type === 'Sortie').length
  const pendingCount = mockMovements.filter(m => m.status === 'En attente').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Gestion des Mouvements
          </h1>
          <p className="text-muted-foreground">
            Suivi des entrées et sorties d'équipements
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ArrowUp className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">Total Entrées</div>
              <div className="text-xl text-card-foreground">{totalEntries}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ArrowDown className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Total Sorties</div>
              <div className="text-xl text-card-foreground">{totalExits}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="h-8 w-8 p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Mouvements
              </div>
              <div className="text-xl text-card-foreground">
                {mockMovements.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center text-xs">
              !
            </div>
            <div>
              <div className="text-sm text-muted-foreground">En Attente</div>
              <div className="text-xl text-card-foreground">{pendingCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par équipement, numéro de série ou agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous types</option>
              <option value="Entrée">Entrées</option>
              <option value="Sortie">Sorties</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous statuts</option>
              <option value="Validé">Validé</option>
              <option value="En attente">En attente</option>
              <option value="Annulé">Annulé</option>
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Movements List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Liste des Mouvements ({filteredMovements.length})
          </h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Équipement
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    N° Série
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Direction
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Agent
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Date/Heure
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => {
                  const TypeIcon = getTypeIcon(movement.type);
                  return (
                    <tr
                      key={movement.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4" />
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getTypeColor(
                              movement.type
                            )}`}
                          >
                            {movement.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground max-w-[200px] truncate">
                        {movement.equipment}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground font-mono">
                        {movement.serialNumber}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {movement.department}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {movement.agent}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        <div>
                          <div>{movement.date}</div>
                          <div className="text-xs text-muted-foreground">
                            {movement.time}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                            movement.status
                          )}`}
                        >
                          {movement.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() =>
                            setShowDetails(
                              showDetails === movement.id ? null : movement.id
                            )
                          }
                          className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                        >
                          {showDetails === movement.id ? "Masquer" : "Détails"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Movement Details */}
          {showDetails && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
              {filteredMovements
                .filter((movement) => movement.id === showDetails)
                .map((movement) => (
                  <div key={movement.id}>
                    <h4 className="text-lg mb-3 text-card-foreground">
                      Détails du mouvement #{movement.id}
                    </h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Raison
                        </div>
                        <div className="text-card-foreground">
                          {movement.reason}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Quantité
                        </div>
                        <div className="text-card-foreground">
                          {movement.quantity}
                        </div>
                      </div>
                      {movement.approver && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">
                            Approuvé par
                          </div>
                          <div className="text-card-foreground">
                            {movement.approver}
                          </div>
                        </div>
                      )}
                      {movement.notes && (
                        <div className="md:col-span-2">
                          <div className="text-sm text-muted-foreground mb-1">
                            Notes
                          </div>
                          <div className="text-card-foreground">
                            {movement.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}