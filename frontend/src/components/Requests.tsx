import { useState, useEffect } from "react"
import { Clipboard, Plus, Check, X, Clock, Search, Loader2, RotateCcw } from "lucide-react"
import { User as UserType } from "../App"
import { getDemandes, saveDemandes, approveDemande } from "../lib/store"
import { DemandeMateriel } from "../types/accounting"

export function Requests({ user }: { user?: UserType }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("Tous")
  const [loadingRequests, setLoadingRequests] = useState<{ [key: string]: string }>({})
  const [showSuccessMessage, setShowSuccessMessage] = useState<{ message: string; type: string } | null>(null)
  
  const [requests, setRequests] = useState<DemandeMateriel[]>([])
  
  useEffect(() => {
    setRequests(getDemandes())
  }, [])

  const [showNewRequestModal, setShowNewRequestModal] = useState(false)
  const [newRequest, setNewRequest] = useState<{
    equipmentDemande: string
    motif: string
    quantite: number
    priorite: DemandeMateriel['priorite']
    typeDemande: DemandeMateriel['typeDemande']
  }>({
    equipmentDemande: "",
    motif: "",
    quantite: 1,
    priorite: "Normal",
    typeDemande: "Sortie",
  })

  // Fonctionnalité : cloisonnement par périmètre et par rôle
  const isDemandeur = user?.role === "demandeur"
  const isDepositaire = user?.role === "depositaire"

  const scopedRequests =
    isDemandeur && user?.department
      ? requests.filter((request) => request.direction === user.department)
      : requests

  const handleCreateRequest = () => {
    if (!newRequest.equipmentDemande.trim()) return
    const created: DemandeMateriel = {
      id: `D-${new Date().getFullYear()}-${String(requests.length + 1).padStart(3, '0')}`,
      typeDemande: newRequest.typeDemande,
      equipementDemande: newRequest.equipmentDemande.trim(),
      demandeurId: user?.id || "EMP-Unknown",
      demandeurNom: user?.name || "Demandeur Inconnu",
      direction: user?.department || "—",
      motif: newRequest.motif.trim() || "—",
      quantite: Number(newRequest.quantite) || 1,
      dateDemande: new Date().toISOString().slice(0, 10),
      statut: "en_attente",
      priorite: newRequest.priorite,
    }
    const updatedRequests = [created, ...requests]
    setRequests(updatedRequests)
    saveDemandes(updatedRequests)
    
    setShowNewRequestModal(false)
    setNewRequest({ equipmentDemande: "", motif: "", quantite: 1, priorite: "Normal", typeDemande: "Sortie" })
    setShowSuccessMessage({ message: "Demande créée avec succès!", type: "create" })
    setTimeout(() => setShowSuccessMessage(null), 4000)
  }

  const filteredRequests = scopedRequests.filter(request => {
    const matchesSearch = request.equipementDemande.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.demandeurNom.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "Tous" 
      ? true 
      : (statusFilter === "En attente" && request.statut === "en_attente") ||
        (statusFilter === "Approuvé" && request.statut === "approuvee") ||
        (statusFilter === "Rejeté" && request.statut === "rejetee")
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approuvee': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'en_attente': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'rejetee': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approuvee': return 'Approuvé'
      case 'en_attente': return 'En attente'
      case 'rejetee': return 'Rejeté'
      default: return status
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

  const pendingCount = scopedRequests.filter(r => r.statut === 'en_attente').length
  const todayStr = new Date().toISOString().slice(0, 10)
  const approvedToday = scopedRequests.filter(r => r.statut === 'approuvee' && r.dateApprobation === todayStr).length

  const handleStatusChange = async (requestId: string, newStatus: 'approuvee' | 'rejetee' | 'en_attente', actionType: string) => {
    setLoadingRequests(prev => ({ ...prev, [requestId]: actionType }))
    
    setTimeout(() => {
      if (newStatus === 'approuvee' && user) {
        approveDemande(requestId, user.id, user.name);
      } else {
        const currentRequests = getDemandes();
        const req = currentRequests.find(r => r.id === requestId);
        if (req) {
          req.statut = newStatus;
          saveDemandes(currentRequests);
        }
      }
      
      // Refresh state
      setRequests(getDemandes());
      
      setLoadingRequests(prev => {
        const updated = { ...prev }
        delete updated[requestId]
        return updated
      })

      const messages = {
        'approve': 'Demande approuvée. Une sortie est générée et attend les signatures.',
        'reject': 'Demande rejetée avec succès!',
        'pending': 'Demande remise en attente!'
      }
      
      setShowSuccessMessage({
        message: messages[actionType as keyof typeof messages],
        type: actionType
      })
      
      setTimeout(() => setShowSuccessMessage(null), 4000)
    }, 800)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Success Notification */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg shadow-xl text-green-800 dark:from-green-900/30 dark:to-green-800/30 dark:border-green-800 dark:text-green-400 animate-in slide-in-from-right-full duration-300">
          <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full dark:bg-green-900/50">
            {showSuccessMessage.type === "approve" && <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
            {showSuccessMessage.type === "reject" && <X className="h-4 w-4 text-red-600 dark:text-red-400" />}
            {showSuccessMessage.type === "pending" && <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
            {showSuccessMessage.type === "create" && <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
          </div>
          <div>
            <div className="font-semibold text-sm">
              {showSuccessMessage.message}
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
        {isDemandeur && (
          <button
            onClick={() => setShowNewRequestModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Demande
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Clipboard className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Total Demandes</div>
              <div className="text-xl text-card-foreground">{scopedRequests.length}</div>
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
              <div className="text-sm text-muted-foreground">Approuvées Aujourd'hui</div>
              <div className="text-xl text-card-foreground">{approvedToday}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center text-xs font-bold">
              !
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Urgentes</div>
              <div className="text-xl text-card-foreground">
                {scopedRequests.filter((r) => r.priorite === "Urgent" || r.priorite === "Critique").length}
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
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Type</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">ID</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Équipement</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Demandeur</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Direction</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Motif</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Priorité</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                          request.typeDemande === "Entrée"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                        }`}>
                        {request.typeDemande}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{request.id}</td>
                    <td className="py-3 px-4 text-sm font-medium">{request.equipementDemande} (x{request.quantite})</td>
                    <td className="py-3 px-4 text-sm text-card-foreground">{request.demandeurNom}</td>
                    <td className="py-3 px-4 text-sm text-card-foreground">{request.direction}</td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[150px] truncate" title={request.motif}>
                      {request.motif}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getPriorityColor(request.priorite)}`}>
                        {request.priorite}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(request.statut)}`}>
                        {getStatusLabel(request.statut)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isDemandeur && <span className="text-sm text-muted-foreground">—</span>}
                        {isDepositaire && request.statut === "en_attente" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(request.id, "approuvee", "approve")}
                              disabled={loadingRequests[request.id] === "approve"}
                              className="group relative inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 text-xs font-medium"
                            >
                              {loadingRequests[request.id] === "approve" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Approuver
                            </button>
                            <button
                              onClick={() => handleStatusChange(request.id, "rejetee", "reject")}
                              disabled={loadingRequests[request.id] === "reject"}
                              className="group relative inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 text-xs font-medium"
                            >
                              {loadingRequests[request.id] === "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                              Rejeter
                            </button>
                          </>
                        )}
                        {isDepositaire && (request.statut === "approuvee" || request.statut === "rejetee") && (
                          <button
                            onClick={() => handleStatusChange(request.id, "en_attente", "pending")}
                            disabled={loadingRequests[request.id] === "pending"}
                            className="group relative inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 text-xs font-medium"
                          >
                            {loadingRequests[request.id] === "pending" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Annuler
                          </button>
                        )}
                        {!isDemandeur && !isDepositaire && <span className="text-sm text-muted-foreground">Lecture seule</span>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRequests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      Aucune demande trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Nouvelle Demande */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-card-foreground">Nouvelle Demande</h3>
              <button onClick={() => setShowNewRequestModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Équipement</label>
                <input
                  type="text"
                  value={newRequest.equipmentDemande}
                  onChange={(e) => setNewRequest({ ...newRequest, equipmentDemande: e.target.value })}
                  placeholder="Désignation du matériel"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Type</label>
                  <select
                    value={newRequest.typeDemande}
                    onChange={(e) => setNewRequest({ ...newRequest, typeDemande: e.target.value as DemandeMateriel['typeDemande'] })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  >
                    <option value="Entrée">Entrée</option>
                    <option value="Sortie">Sortie</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Quantité</label>
                  <input
                    type="number"
                    min={1}
                    value={newRequest.quantite}
                    onChange={(e) => setNewRequest({ ...newRequest, quantite: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Priorité</label>
                <select
                  value={newRequest.priorite}
                  onChange={(e) => setNewRequest({ ...newRequest, priorite: e.target.value as DemandeMateriel['priorite'] })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgent">Urgent</option>
                  <option value="Critique">Critique</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Motif</label>
                <textarea
                  value={newRequest.motif}
                  onChange={(e) => setNewRequest({ ...newRequest, motif: e.target.value })}
                  rows={3}
                  placeholder="Justification de la demande"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewRequestModal(false)} className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                Annuler
              </button>
              <button onClick={handleCreateRequest} className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}