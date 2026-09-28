import { useEffect, useState } from "react"
import { Clipboard, Plus, Check, X, Clock, Filter, Search, Loader2, RotateCcw, AlertCircle, FileText, ArrowRight, History, Package } from "lucide-react"
import { User as UserType } from "../App"
import { Request, mockRequests } from "../lib/requests"
import { sortieRecords, getSortieTrace, splitDepartement } from "../lib/movements"
import { MyRequests } from "./MyRequests"

interface RequestsProps {
  user?: UserType
  /** Ouvre directement le détail d'une demande (lien « Demande associée » venu de la page Sorties) */
  detailRequestId?: number
  /** Notifie le parent que le détail demandé a été ouvert */
  onDetailConsumed?: () => void
}

export function Requests({ user, detailRequestId, onDetailConsumed }: RequestsProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("Tous")
  const [loadingRequests, setLoadingRequests] = useState<{ [key: number]: string }>({})
  const [showSuccessMessage, setShowSuccessMessage] = useState<{ message: string; type: string } | null>(null)
  const [requests, setRequests] = useState<Request[]>(mockRequests)
  const [showNewRequestModal, setShowNewRequestModal] = useState(false)
  const [newRequest, setNewRequest] = useState<{
    equipment: string
    reason: string
    quantity: number
    priority: Request['priority']
    type: Request['type']
  }>({
    equipment: "",
    reason: "",
    quantity: 1,
    priority: "Normal",
    type: "Sortie",
  })

  const [detailRequest, setDetailRequest] = useState<Request | null>(null)

  // Ouverture automatique du détail (lien « Demande associée » depuis Sorties)
  useEffect(() => {
    if (!detailRequestId) return
    const target = requests.find((r) => r.id === detailRequestId)
    if (target) {
      setDetailRequest(target)
    }
    // Toujours libérer la demande demandée (même si elle n'existe pas encore)
    onDetailConsumed?.()
  }, [detailRequestId, requests, onDetailConsumed])

  // Fonctionnalité : cloisonnement par périmètre et par rôle
  const isDemandeur = user?.role === "demandeur"

  // Espace Demandeur : page dédiée « Mes demandes »
  if (isDemandeur) {
    return (
      <MyRequests
        user={user}
        detailRequestId={detailRequestId}
        onDetailConsumed={onDetailConsumed}
      />
    )
  }

  const scopedRequests =
    isDemandeur && user?.department
      ? requests.filter((request) => request.department === user.department)
      : requests

  const handleCreateRequest = () => {
    if (!newRequest.equipment.trim()) return
    const created: Request = {
      id: Math.max(0, ...requests.map((r) => r.id)) + 1,
      type: newRequest.type,
      equipment: newRequest.equipment.trim(),
      requestedBy: user?.name || "Demandeur",
      department: user?.department || "—",
      reason: newRequest.reason.trim() || "—",
      quantity: Number(newRequest.quantity) || 1,
      requestDate: new Date().toISOString().slice(0, 10),
      status: "En attente",
      priority: newRequest.priority,
    }
    setRequests((prev) => [created, ...prev])
    setShowNewRequestModal(false)
    setNewRequest({ equipment: "", reason: "", quantity: 1, priority: "Normal", type: "Sortie" })
    setShowSuccessMessage({ message: "Demande créée avec succès!", type: "create" })
    setTimeout(() => setShowSuccessMessage(null), 4000)
  }

  const filteredRequests = scopedRequests.filter(request => {
    const matchesSearch = request.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.requestedBy.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "Tous" || request.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approuvé': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'Validée': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'Préparée': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'Effectuée': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'Historisé': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'En attente': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'Rejeté': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critique': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'Urgent': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'Normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const pendingCount = scopedRequests.filter(r => r.status === 'En attente').length
  const approvedToday = scopedRequests.filter(r => r.status === 'Approuvé' && r.requestDate === '2025-01-20').length

  const handleStatusChange = async (requestId: number, newStatus: 'Approuvé' | 'Rejeté' | 'En attente', actionType: string) => {
    setLoadingRequests(prev => ({ ...prev, [requestId]: actionType }))
    
    // Simulate API call delay
    setTimeout(() => {
      setRequests(prev => prev.map(request => 
        request.id === requestId 
          ? { ...request, status: newStatus, approver: newStatus !== 'En attente' ? 'Admin' : undefined }
          : request
      ))
      
      setLoadingRequests(prev => {
        const updated = { ...prev }
        delete updated[requestId]
        return updated
      })

      // Show success message
      const messages = {
        'approve': 'Demande approuvée avec succès!',
        'reject': 'Demande rejetée avec succès!',
        'pending': 'Demande remise en attente!'
      }
      
      setShowSuccessMessage({
        message: messages[actionType as keyof typeof messages],
        type: actionType
      })
      
      setTimeout(() => setShowSuccessMessage(null), 4000)
    }, 1200)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Success Notification */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg shadow-xl text-green-800 dark:from-green-900/30 dark:to-green-800/30 dark:border-green-800 dark:text-green-400 animate-in slide-in-from-right-full duration-300">
          <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full dark:bg-green-900/50">
            {showSuccessMessage.type === "approve" && (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
            {showSuccessMessage.type === "reject" && (
              <X className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            {showSuccessMessage.type === "pending" && (
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            )}
            {showSuccessMessage.type === "create" && (
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">
              {showSuccessMessage.message}
            </div>
            <div className="text-xs text-green-700 dark:text-green-300">
              Action effectuée avec succès.
            </div>
          </div>
          <button
            onClick={() => setShowSuccessMessage(null)}
            className="ml-4 text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            {isDemandeur ? "Mes Demandes" : "Gestion des Demandes"}
          </h1>
          <p className="text-muted-foreground">
            Suivi des demandes d'entrée et de sortie d'équipements
          </p>
        </div>
        <button
          onClick={() => setShowNewRequestModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle Demande
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Clipboard className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Demandes
              </div>
              <div className="text-xl text-card-foreground">
                {scopedRequests.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-sm text-muted-foreground">En Attente</div>
              <div className="text-xl text-card-foreground">{pendingCount}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Check className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Approuvées Aujourd'hui
              </div>
              <div className="text-xl text-card-foreground">
                {approvedToday}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center text-xs">
              !
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Urgentes</div>
              <div className="text-xl text-card-foreground">
                {
                  scopedRequests.filter(
                    (r) => r.priority === "Urgent" || r.priority === "Critique"
                  ).length
                }
              </div>
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
              placeholder="Rechercher par équipement ou demandeur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
          >
            <option value="Tous">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="Approuvé">Approuvé</option>
            <option value="Rejeté">Rejeté</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Liste des Demandes ({filteredRequests.length})
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
                    Demandeur
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Direction
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Raison
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
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                          request.type === "Entrée"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}
                      >
                        {request.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {request.equipment}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {request.requestedBy}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {request.department}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[150px] truncate">
                      {request.reason}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getPriorityColor(
                          request.priority
                        )}`}
                      >
                        {request.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDetailRequest(request)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          Détails
                        </button>
                        {!isDemandeur && request.status === "En attente" && (
                          <>
                            {/* Approve Button */}
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  request.id,
                                  "Approuvé",
                                  "approve"
                                )
                              }
                              disabled={
                                loadingRequests[request.id] === "approve"
                              }
                              className="group relative inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-xs font-medium disabled:cursor-not-allowed disabled:scale-100"
                              aria-label="Approuver la demande"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                              {loadingRequests[request.id] === "approve" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 group-hover:scale-110 transition-transform duration-200" />
                              )}

                              <span className="relative">
                                {loadingRequests[request.id] === "approve"
                                  ? "Approuv..."
                                  : "Approuver"}
                              </span>

                              <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </button>

                            {/* Reject Button */}
                            <button
                              onClick={() =>
                                handleStatusChange(
                                  request.id,
                                  "Rejeté",
                                  "reject"
                                )
                              }
                              disabled={
                                loadingRequests[request.id] === "reject"
                              }
                              className="group relative inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-xs font-medium disabled:cursor-not-allowed disabled:scale-100"
                              aria-label="Rejeter la demande"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                              {loadingRequests[request.id] === "reject" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3 group-hover:scale-110 transition-transform duration-200" />
                              )}

                              <span className="relative">
                                {loadingRequests[request.id] === "reject"
                                  ? "Rejet..."
                                  : "Rejeter"}
                              </span>

                              <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </button>
                          </>
                        )}

                        {/* Reset to Pending Button (for approved/rejected requests) */}
                        {!isDemandeur &&
                          (request.status === "Approuvé" ||
                            request.status === "Rejeté") && (
                          <button
                            onClick={() =>
                              handleStatusChange(
                                request.id,
                                "En attente",
                                "pending"
                              )
                            }
                            disabled={loadingRequests[request.id] === "pending"}
                            className="group relative inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-md shadow-orange-500/25 hover:shadow-lg hover:shadow-orange-500/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-xs font-medium disabled:cursor-not-allowed disabled:scale-100"
                            aria-label="Remettre en attente"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                            {loadingRequests[request.id] === "pending" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-300" />
                            )}

                            <span className="relative">
                              {loadingRequests[request.id] === "pending"
                                ? "Remise..."
                                : "En attente"}
                            </span>

                            <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
      </div>

      {/* Nouvelle Demande Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-card-foreground">Nouvelle Demande</h3>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Équipement
                </label>
                <input
                  type="text"
                  value={newRequest.equipment}
                  onChange={(e) => setNewRequest({ ...newRequest, equipment: e.target.value })}
                  placeholder="Désignation du matériel"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Type
                  </label>
                  <select
                    value={newRequest.type}
                    onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value as Request['type'] })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  >
                    <option value="Entrée">Entrée</option>
                    <option value="Sortie">Sortie</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newRequest.quantity}
                    onChange={(e) => setNewRequest({ ...newRequest, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Priorité
                </label>
                <select
                  value={newRequest.priority}
                  onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value as Request['priority'] })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Critique">Critique</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Motif
                </label>
                <textarea
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                  rows={3}
                  placeholder="Justification de la demande"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateRequest}
                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Détails / traçabilité de la demande */}
      {detailRequest &&
        (() => {
          const linkedSortie = sortieRecords.find(
            (s) => s.demandeId === detailRequest.id
          )
          const orga = splitDepartement(detailRequest.department)
          const isApproved = detailRequest.status === "Approuvé"
          const isRejected = detailRequest.status === "Rejeté"
          const isPrepared =
            !!linkedSortie &&
            ["Validée", "Sortie effectuée", "En préparation"].includes(
              linkedSortie.statut
            )
          const isOut = linkedSortie?.statut === "Sortie effectuée"

          // Demande → Validation → Préparation → Sortie → Traçabilité
          const steps = [
            { label: "Demande", statut: "Créée", ok: true },
            {
              label: "Validation",
              statut: isApproved
                ? "Validée"
                : isRejected
                ? "Rejetée"
                : "En attente",
              ok: isApproved,
            },
            {
              label: "Préparation du matériel",
              statut: isPrepared ? "Préparée" : "En attente",
              ok: isPrepared,
            },
            {
              label: "Sortie du matériel",
              statut: isOut ? "Effectuée" : "En attente",
              ok: isOut,
            },
            {
              label: "Traçabilité du mouvement",
              statut: isOut ? "Historisé" : "—",
              ok: isOut,
            },
          ]

          const historique: Array<{
            date: string
            utilisateur: string
            action: string
            statut: string
          }> = [
            {
              date: detailRequest.requestDate,
              utilisateur: detailRequest.requestedBy,
              action: "Demande créée",
              statut: "En attente",
            },
            ...(detailRequest.approver
              ? [
                  {
                    date: detailRequest.requestDate,
                    utilisateur: detailRequest.approver,
                    action: isApproved
                      ? "Demande validée"
                      : isRejected
                      ? "Demande rejetée"
                      : "Demande traitée",
                    statut: detailRequest.status,
                  },
                ]
              : []),
            ...(linkedSortie
              ? getSortieTrace(linkedSortie)
                  .filter((event) => event.statut !== "—" && event.statut !== "En attente")
                  .map((event) => ({
                    date: event.date,
                    utilisateur: event.utilisateur,
                    action: event.action,
                    statut: event.statut,
                  }))
              : []),
          ]

          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border">
                  <div>
                    <h3 className="text-lg text-card-foreground flex items-center gap-2">
                      <Clipboard className="h-5 w-5 text-primary" />
                      Demande n° {detailRequest.id}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                          detailRequest.status
                        )}`}
                      >
                        {detailRequest.status}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getPriorityColor(
                          detailRequest.priority
                        )}`}
                      >
                        {detailRequest.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {detailRequest.type} - {detailRequest.equipment}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailRequest(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Chaîne de traçabilité */}
                  <div>
                    <h4 className="text-sm text-card-foreground mb-3">
                      Suivi de la demande
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      {steps.map((step, index) => (
                        <div key={step.label} className="flex items-center gap-2">
                          <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                              step.ok
                                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "border-border bg-muted/30 text-muted-foreground"
                            }`}
                          >
                            <span className="font-medium">{step.label}</span>
                            <span className="opacity-70">({step.statut})</span>
                          </div>
                          {index < steps.length - 1 && (
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Informations */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Statut</div>
                      <div className="text-sm text-card-foreground">
                        {detailRequest.status}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Équipement demandé
                      </div>
                      <div className="text-sm text-card-foreground">
                        {detailRequest.equipment}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Quantité</div>
                      <div className="text-sm text-card-foreground">
                        {detailRequest.quantity}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Demandeur</div>
                      <div className="text-sm text-card-foreground">
                        {detailRequest.requestedBy}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Direction</div>
                      <div className="text-sm text-card-foreground">
                        {orga.direction}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Service</div>
                      <div className="text-sm text-card-foreground">{orga.service}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Date de demande
                      </div>
                      <div className="text-sm text-card-foreground">
                        {new Date(detailRequest.requestDate).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Motif</div>
                      <div className="text-sm text-card-foreground">
                        {detailRequest.reason}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Priorité</div>
                      <div className="text-sm text-card-foreground">
                        {detailRequest.priority}
                      </div>
                    </div>
                  </div>

                  {/* Validations */}
                  <div className="p-4 border border-border rounded-lg bg-muted/20">
                    <h4 className="text-sm text-card-foreground mb-2 flex items-center gap-2">
                      <Check className="h-4 w-4" />
                      Validations
                    </h4>
                    <div className="text-sm text-muted-foreground">
                      {detailRequest.approver ? (
                        <>
                          Validée par <span className="text-card-foreground">
                            {detailRequest.approver}
                          </span>{" "}
                          le {new Date(detailRequest.requestDate).toLocaleDateString("fr-FR")}
                        </>
                      ) : (
                        "En attente de validation par le responsable habilité."
                      )}
                    </div>
                  </div>

                  {/* Sortie associée */}
                  <div className="p-4 border border-border rounded-lg bg-muted/20">
                    <h4 className="text-sm text-card-foreground mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Sortie associée
                    </h4>
                    {linkedSortie ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Référence de sortie
                          </div>
                          <div className="text-sm font-mono text-card-foreground">
                            {linkedSortie.reference}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Date de sortie
                          </div>
                          <div className="text-sm text-card-foreground">
                            {new Date(linkedSortie.dateSortie).toLocaleDateString(
                              "fr-FR"
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Statut
                          </div>
                          <div className="text-sm text-card-foreground">
                            {linkedSortie.statut}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Bénéficiaire
                          </div>
                          <div className="text-sm text-card-foreground">
                            {linkedSortie.beneficiaire}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Responsable
                          </div>
                          <div className="text-sm text-card-foreground">
                            {linkedSortie.responsable}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Direction / Service
                          </div>
                          <div className="text-sm text-card-foreground">
                            {linkedSortie.direction} / {linkedSortie.serviceDemandeur}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune sortie enregistrée pour le moment.
                      </p>
                    )}
                  </div>

                  {/* Historique */}
                  <div>
                    <h4 className="text-sm text-card-foreground mb-3 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Historique
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                              Date
                            </th>
                            <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                              Utilisateur
                            </th>
                            <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                              Action
                            </th>
                            <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                              Statut
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {historique.map((event, index) => (
                            <tr
                              key={index}
                              className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {new Date(event.date).toLocaleDateString("fr-FR")}
                              </td>
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {event.utilisateur}
                              </td>
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {event.action}
                              </td>
                              <td className="py-2 px-3 text-sm">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                                    event.statut
                                  )}`}
                                >
                                  {event.statut}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
    </div>
  );
}