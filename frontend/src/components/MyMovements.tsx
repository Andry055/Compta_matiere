import { useState } from "react"
import { List, ArrowDown, ArrowUp, Calendar, Filter, Download } from "lucide-react"
import { User } from "../App"

interface MyMovementsProps {
  user: User
}

interface Movement {
  id: number
  type: 'entry' | 'exit'
  equipment: string
  quantity: number
  reference: string
  timestamp: string
  status: 'completed' | 'pending' | 'approved'
  destination?: string
  recipient?: string
  supplier?: string
  notes?: string
}

const mockMovements: Movement[] = [
  {
    id: 1,
    type: 'entry',
    equipment: 'Ordinateurs portables HP EliteBook',
    quantity: 15,
    reference: 'ENT-2025-001',
    timestamp: '2025-01-08 14:30',
    status: 'completed',
    supplier: 'TechnoFournisseur SARL',
    notes: 'Livraison prévue - BL#12345'
  },
  {
    id: 2,
    type: 'exit',
    equipment: 'Claviers Logitech MX Keys',
    quantity: 8,
    reference: 'EXT-2025-003',
    timestamp: '2025-01-08 11:15',
    status: 'completed',
    destination: 'IT - Développement',
    recipient: 'Pierre Dupont',
    notes: 'Remplacement équipement défaillant'
  },
  {
    id: 3,
    type: 'entry',
    equipment: 'Écrans Dell UltraSharp 24"',
    quantity: 5,
    reference: 'ENT-2025-002',
    timestamp: '2025-01-08 09:45',
    status: 'pending',
    supplier: 'Distrib\'IT France',
    notes: 'En attente de validation'
  },
  {
    id: 4,
    type: 'exit',
    equipment: 'Souris sans fil',
    quantity: 12,
    reference: 'EXT-2025-002',
    timestamp: '2025-01-07 16:20',
    status: 'completed',
    destination: 'Finance - Comptabilité',
    recipient: 'Marie Martin',
    notes: 'Déploiement nouveau personnel'
  },
  {
    id: 5,
    type: 'entry',
    equipment: 'Imprimantes Canon ImageClass',
    quantity: 3,
    reference: 'ENT-2025-003',
    timestamp: '2025-01-07 13:10',
    status: 'approved',
    supplier: 'Bureau Solutions',
    notes: 'Commande urgente approuvée'
  },
  {
    id: 6,
    type: 'exit',
    equipment: 'Téléphones IP Cisco',
    quantity: 6,
    reference: 'EXT-2025-001',
    timestamp: '2025-01-06 10:30',
    status: 'completed',
    destination: 'Service Client',
    recipient: 'Sophie Dubois',
    notes: 'Extension équipe support'
  },
  {
    id: 7,
    type: 'entry',
    equipment: 'Webcams Logitech C920',
    quantity: 20,
    reference: 'ENT-2025-004',
    timestamp: '2025-01-05 15:45',
    status: 'completed',
    supplier: 'Matériel Express',
    notes: 'Équipement télétravail'
  },
  {
    id: 8,
    type: 'exit',
    equipment: 'Casques audio professionnel',
    quantity: 10,
    reference: 'EXT-2025-004',
    timestamp: '2025-01-05 09:20',
    status: 'completed',
    destination: 'Marketing - Communication',
    recipient: 'Jean Moreau',
    notes: 'Matériel production vidéo'
  }
]

export function MyMovements({ user }: MyMovementsProps) {
  const [movements] = useState<Movement[]>(mockMovements)
  const [typeFilter, setTypeFilter] = useState<'all' | 'entry' | 'exit'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'approved'>('all')
  const [dateFilter, setDateFilter] = useState('week')
  const [searchTerm, setSearchTerm] = useState('')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'pending': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'approved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Terminé'
      case 'pending': return 'En attente'
      case 'approved': return 'Approuvé'
      default: return status
    }
  }

  const filteredMovements = movements.filter(movement => {
    const matchesType = typeFilter === 'all' || movement.type === typeFilter
    const matchesStatus = statusFilter === 'all' || movement.status === statusFilter
    const matchesSearch = movement.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.reference.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Simple date filtering
    let matchesDate = true
    if (dateFilter !== 'all') {
      const movementDate = new Date(movement.timestamp)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - movementDate.getTime()) / (1000 * 60 * 60 * 24))
      
      switch (dateFilter) {
        case 'today':
          matchesDate = daysDiff === 0
          break
        case 'week':
          matchesDate = daysDiff <= 7
          break
        case 'month':
          matchesDate = daysDiff <= 30
          break
      }
    }
    
    return matchesType && matchesStatus && matchesSearch && matchesDate
  })

  const stats = {
    total: movements.length,
    entries: movements.filter(m => m.type === 'entry').length,
    exits: movements.filter(m => m.type === 'exit').length,
    pending: movements.filter(m => m.status === 'pending').length
  }

  const exportData = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Type,Référence,Équipement,Quantité,Date,Statut,Destination/Fournisseur,Destinataire,Notes\n" +
      filteredMovements.map(m => 
        `${m.type === 'entry' ? 'Entrée' : 'Sortie'},${m.reference},"${m.equipment}",${m.quantity},${m.timestamp},${getStatusText(m.status)},"${m.destination || m.supplier || ''}","${m.recipient || ''}","${m.notes || ''}"`
      ).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `mouvements_${user.name.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <List className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
            Mes Mouvements
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Historique complet de vos opérations d'entrée et sortie
          </p>
        </div>
        
        <button
          onClick={exportData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exporter CSV</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Statistics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <List className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total Mouvements</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <ArrowDown className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Entrées</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.entries}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <ArrowUp className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Sorties</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.exits}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">En Attente</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.pending}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg text-card-foreground">Filtres</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Rechercher</label>
              <input
                type="text"
                placeholder="Équipement ou référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="all">Tous les types</option>
                <option value="entry">Entrées</option>
                <option value="exit">Sorties</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Statut</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="completed">Terminé</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm text-muted-foreground mb-2">Période</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Movements List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Historique ({filteredMovements.length} {filteredMovements.length !== stats.total && `/ ${stats.total}`})
          </h3>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden p-4 space-y-3">
          {filteredMovements.map((movement) => (
            <div key={movement.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {movement.type === 'entry' ? (
                    <ArrowDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                  <span className="text-sm text-card-foreground">
                    {movement.type === 'entry' ? 'Entrée' : 'Sortie'}
                  </span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getStatusColor(movement.status)}`}>
                  {getStatusText(movement.status)}
                </span>
              </div>
              
              <div className="text-sm text-card-foreground">{movement.equipment}</div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Quantité:</span>
                  <div className="text-card-foreground">{movement.quantity}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Référence:</span>
                  <div className="text-card-foreground font-mono">{movement.reference}</div>
                </div>
              </div>
              
              <div className="text-xs">
                <span className="text-muted-foreground">Date:</span>
                <div className="text-card-foreground">{new Date(movement.timestamp).toLocaleString('fr-FR')}</div>
              </div>
              
              {(movement.destination || movement.supplier) && (
                <div className="text-xs">
                  <span className="text-muted-foreground">
                    {movement.type === 'entry' ? 'Fournisseur:' : 'Destination:'}
                  </span>
                  <div className="text-card-foreground">{movement.destination || movement.supplier}</div>
                </div>
              )}
              
              {movement.notes && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Notes:</span>
                  <div className="text-card-foreground">{movement.notes}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Référence</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Équipement</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Quantité</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Destination/Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((movement) => (
                  <tr key={movement.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {movement.type === 'entry' ? (
                          <ArrowDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                        <span className="text-sm text-card-foreground">
                          {movement.type === 'entry' ? 'Entrée' : 'Sortie'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                      {movement.reference}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[200px] truncate">
                      {movement.equipment}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {movement.quantity}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(movement.timestamp).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(movement.status)}`}>
                        {getStatusText(movement.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[150px] truncate">
                      {movement.destination || movement.supplier || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredMovements.length === 0 && (
          <div className="p-8 text-center">
            <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-sm text-muted-foreground mb-2">Aucun mouvement trouvé</h4>
            <p className="text-xs text-muted-foreground">
              Essayez de modifier vos critères de filtrage
            </p>
          </div>
        )}
      </div>
    </div>
  )
}