import { useState } from "react"
import { ClipboardList, Check, X, Clock, User as UserIcon, Building, Calendar, MessageSquare } from "lucide-react"
import { User } from "../App"

interface PendingRequestsProps {
  user: User
}

interface Request {
  id: number
  type: 'equipment' | 'transfer' | 'maintenance'
  title: string
  requester: string
  department: string
  submittedDate: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_review' | 'approved' | 'rejected'
  description: string
  equipment?: string
  quantity?: number
  reason: string
  expectedDate?: string
}

const mockRequests: Request[] = [
  {
    id: 1,
    type: 'equipment',
    title: 'Demande d\'ordinateurs portables',
    requester: 'Claire Dubois',
    department: 'Marketing - Communication',
    submittedDate: '2025-01-08 09:30',
    priority: 'high',
    status: 'pending',
    description: 'Besoin urgent de 3 ordinateurs portables pour la nouvelle équipe marketing',
    equipment: 'Ordinateurs portables',
    quantity: 3,
    reason: 'Embauche de nouveaux employés',
    expectedDate: '2025-01-15'
  },
  {
    id: 2,
    type: 'transfer',
    title: 'Transfert imprimante multifonction',
    requester: 'Jean Martin',
    department: 'Finance - Comptabilité',
    submittedDate: '2025-01-07 14:20',
    priority: 'medium',
    status: 'pending',
    description: 'Transfert d\'une imprimante multifonction du service RH vers Finance',
    equipment: 'Imprimante Canon ImageClass MF445dw',
    quantity: 1,
    reason: 'Réorganisation des services',
    expectedDate: '2025-01-10'
  },
  {
    id: 3,
    type: 'equipment',
    title: 'Matériel de présentation',
    requester: 'Sophie Bernard',
    department: 'Direction Générale',
    submittedDate: '2025-01-07 11:15',
    priority: 'urgent',
    status: 'in_review',
    description: 'Projecteur et système audio pour salle de conférence',
    equipment: 'Projecteur + système audio',
    quantity: 1,
    reason: 'Réunion clients importante',
    expectedDate: '2025-01-09'
  },
  {
    id: 4,
    type: 'maintenance',
    title: 'Réparation écrans défaillants',
    requester: 'Pierre Moreau',
    department: 'IT - Développement',
    submittedDate: '2025-01-06 16:45',
    priority: 'low',
    status: 'pending',
    description: 'Deux écrans avec problèmes d\'affichage nécessitent une intervention',
    equipment: 'Écrans Dell UltraSharp',
    quantity: 2,
    reason: 'Problèmes techniques',
    expectedDate: '2025-01-12'
  },
  {
    id: 5,
    type: 'equipment',
    title: 'Casques audio équipe support',
    requester: 'Marie Dubois',
    department: 'Service Client',
    submittedDate: '2025-01-06 10:30',
    priority: 'medium',
    status: 'pending',
    description: 'Casques audio professionnels pour améliorer la qualité des appels',
    equipment: 'Casques audio Plantronics',
    quantity: 5,
    reason: 'Amélioration qualité service',
    expectedDate: '2025-01-11'
  }
]

export function PendingRequests({ user }: PendingRequestsProps) {
  const [requests, setRequests] = useState<Request[]>(mockRequests)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_review'>('all')
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all')
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null)
  const [actionNotes, setActionNotes] = useState('')

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'in_review': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgent'
      case 'high': return 'Élevée'
      case 'medium': return 'Moyenne'
      case 'low': return 'Faible'
      default: return priority
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente'
      case 'in_review': return 'En cours'
      case 'approved': return 'Approuvée'
      case 'rejected': return 'Rejetée'
      default: return status
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'equipment': return 'Équipement'
      case 'transfer': return 'Transfert'
      case 'maintenance': return 'Maintenance'
      default: return type
    }
  }

  const filteredRequests = requests.filter(request => {
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus
    const matchesPriority = filterPriority === 'all' || request.priority === filterPriority
    return matchesStatus && matchesPriority
  })

  const handleAction = (requestId: number, action: 'approve' | 'reject') => {
    const actionText = action === 'approve' ? 'approuvée' : 'rejetée'
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    
    setRequests(requests.map(req => 
      req.id === requestId 
        ? { ...req, status: newStatus as any }
        : req
    ))
    
    setSelectedRequest(null)
    setActionNotes('')
    alert(`Demande ${actionText} avec succès!`)
  }

  const takeAction = (requestId: number) => {
    setRequests(requests.map(req => 
      req.id === requestId 
        ? { ...req, status: 'in_review' as any }
        : req
    ))
    alert('Demande prise en charge!')
  }

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    inReview: requests.filter(r => r.status === 'in_review').length,
    urgent: requests.filter(r => r.priority === 'urgent').length
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
            Demandes en Attente
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Traitement des demandes d'équipements et transferts
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Total Demandes
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {stats.total}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Clock className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                En Attente
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {stats.pending}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                En Cours
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {stats.inReview}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center text-xs">
              !
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Urgentes
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {stats.urgent}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Statut
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="in_review">En cours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Priorité
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="all">Toutes les priorités</option>
              <option value="urgent">Urgent</option>
              <option value="high">Élevée</option>
              <option value="medium">Moyenne</option>
              <option value="low">Faible</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Demandes à Traiter ({filteredRequests.length})
          </h3>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden p-4 space-y-3">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="border border-border rounded-lg p-3 space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-card-foreground truncate">
                    {request.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getTypeText(request.type)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getPriorityColor(
                      request.priority
                    )}`}
                  >
                    {getPriorityText(request.priority)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                      request.status
                    )}`}
                  >
                    {getStatusText(request.status)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Demandeur:</span>
                  <div className="text-card-foreground">
                    {request.requester}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <div className="text-card-foreground truncate">
                    {request.department}
                  </div>
                </div>
              </div>

              <div className="text-xs">
                <span className="text-muted-foreground">Date:</span>
                <div className="text-card-foreground">
                  {new Date(request.submittedDate).toLocaleDateString("fr-FR")}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRequest(request)}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  Voir Détails
                </button>
                {request.status === "pending" && (
                  <button
                    onClick={() => takeAction(request.id)}
                    className="px-3 py-2 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                  >
                    Prendre en Charge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Demande
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Demandeur
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Priorité
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
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="max-w-[200px]">
                        <div className="text-sm text-card-foreground truncate">
                          {request.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {request.description}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {getTypeText(request.type)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-card-foreground">
                        {request.requester}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {request.department}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(request.submittedDate).toLocaleDateString(
                        "fr-FR"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getPriorityColor(
                          request.priority
                        )}`}
                      >
                        {getPriorityText(request.priority)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {getStatusText(request.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Détails
                        </button>
                        {request.status === "pending" && (
                          <button
                            onClick={() => takeAction(request.id)}
                            className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90"
                          >
                            Prendre
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredRequests.length === 0 && (
          <div className="p-8 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-sm text-muted-foreground mb-2">
              Aucune demande trouvée
            </h4>
            <p className="text-xs text-muted-foreground">
              Aucune demande ne correspond aux critères sélectionnés
            </p>
          </div>
        )}
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-card-foreground">
                Détails de la Demande
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground">Demandeur</div>
                  <div className="text-card-foreground flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    {selectedRequest.requester}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Direction</div>
                  <div className="text-card-foreground flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {selectedRequest.department}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Date de soumission
                  </div>
                  <div className="text-card-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedRequest.submittedDate).toLocaleString(
                      "fr-FR"
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Date souhaitée
                  </div>
                  <div className="text-card-foreground">
                    {selectedRequest.expectedDate
                      ? new Date(
                          selectedRequest.expectedDate
                        ).toLocaleDateString("fr-FR")
                      : "Non spécifiée"}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getPriorityColor(
                    selectedRequest.priority
                  )}`}
                >
                  Priorité: {getPriorityText(selectedRequest.priority)}
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${getStatusColor(
                    selectedRequest.status
                  )}`}
                >
                  {getStatusText(selectedRequest.status)}
                </span>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">
                  Description
                </div>
                <div className="text-card-foreground p-3 bg-muted/30 rounded-lg">
                  {selectedRequest.description}
                </div>
              </div>

              {selectedRequest.equipment && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Équipement
                    </div>
                    <div className="text-card-foreground">
                      {selectedRequest.equipment}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Quantité
                    </div>
                    <div className="text-card-foreground">
                      {selectedRequest.quantity}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground mb-2">Motif</div>
                <div className="text-card-foreground">
                  {selectedRequest.reason}
                </div>
              </div>

              {selectedRequest.status === "in_review" && (
                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Notes d'action
                  </div>
                  <textarea
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Commentaires sur la décision..."
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm"
              >
                Fermer
              </button>
              {selectedRequest.status === "in_review" && (
                <>
                  <button
                    onClick={() => handleAction(selectedRequest.id, "reject")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 text-sm"
                  >
                    <X className="h-4 w-4" />
                    Rejeter
                  </button>
                  <button
                    onClick={() => handleAction(selectedRequest.id, "approve")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Check className="h-4 w-4" />
                    Approuver
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}