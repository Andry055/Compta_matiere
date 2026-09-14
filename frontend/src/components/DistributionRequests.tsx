import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { ClipboardList, Clock, CheckCircle, XCircle, AlertTriangle, User, Building, Package, Calendar, Search, Filter } from "lucide-react"
import { toast } from "sonner"

// Types pour les demandes de distribution
interface DistributionRequest {
  id: string
  equipmentId: string
  equipmentName: string
  equipmentSerial: string
  requestedBy: string
  requestedByEmail: string
  requestedByDepartment: string
  targetDepartment: string
  targetDepartmentManager: string
  requestDate: string
  requestedDeliveryDate?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'en_attente' | 'en_revision' | 'approuve' | 'distribue' | 'refuse' | 'annule'
  reason: string
  notes?: string
  reviewedBy?: string
  reviewDate?: string
  reviewNotes?: string
  distributionDate?: string
}

// Données fictives de demandes
const distributionRequests: DistributionRequest[] = [
  {
    id: "DR001",
    equipmentId: "EQ001",
    equipmentName: "Ordinateur Portable Dell",
    equipmentSerial: "DL2024001",
    requestedBy: "Sophie Martin",
    requestedByEmail: "sophie.martin@company.com",
    requestedByDepartment: "Ressources Humaines",
    targetDepartment: "Marketing",
    targetDepartmentManager: "Julie Moreau",
    requestDate: "2024-01-20",
    requestedDeliveryDate: "2024-01-25",
    priority: "medium",
    status: "en_attente",
    reason: "Remplacement pour nouveau employé",
    notes: "Urgent pour l'intégration du nouveau collaborateur"
  },
  {
    id: "DR002",
    equipmentId: "EQ004",
    equipmentName: "Projecteur Epson",
    equipmentSerial: "EP2024004",
    requestedBy: "Pierre Durand",
    requestedByEmail: "pierre.durand@company.com",
    requestedByDepartment: "Informatique",
    targetDepartment: "Formation",
    targetDepartmentManager: "Anne Rousseau",
    requestDate: "2024-01-19",
    requestedDeliveryDate: "2024-01-22",
    priority: "high",
    status: "approuve",
    reason: "Sessions de formation prévues",
    reviewedBy: "Admin Système",
    reviewDate: "2024-01-20",
    reviewNotes: "Approuvé pour la formation des nouveaux employés"
  },
  {
    id: "DR003",
    equipmentId: "EQ002",
    equipmentName: "Imprimante Laser HP",
    equipmentSerial: "HP2024002",
    requestedBy: "Jean Dupont",
    requestedByEmail: "jean.dupont@company.com",
    requestedByDepartment: "Comptabilité",
    targetDepartment: "Comptabilité",
    targetDepartmentManager: "Jean Dupont",
    requestDate: "2024-01-18",
    priority: "low",
    status: "refuse",
    reason: "Imprimante de secours",
    reviewedBy: "Admin Système",
    reviewDate: "2024-01-19",
    reviewNotes: "Demande refusée - imprimante actuelle encore fonctionnelle"
  },
  {
    id: "DR004",
    equipmentId: "EQ006",
    equipmentName: "Téléphone IP Cisco",
    equipmentSerial: "CS2024006",
    requestedBy: "Marie Dubois",
    requestedByEmail: "marie.dubois@company.com",
    requestedByDepartment: "Comptabilité",
    targetDepartment: "Direction",
    targetDepartmentManager: "Michel Bernard",
    requestDate: "2024-01-21",
    requestedDeliveryDate: "2024-01-24",
    priority: "urgent",
    status: "distribue",
    reason: "Équipement direction générale",
    reviewedBy: "Admin Système",
    reviewDate: "2024-01-21",
    reviewNotes: "Distribution immédiate approuvée",
    distributionDate: "2024-01-21"
  }
]

export function DistributionRequests() {
  const [requests, setRequests] = useState<DistributionRequest[]>(distributionRequests)
  const [filteredRequests, setFilteredRequests] = useState<DistributionRequest[]>(distributionRequests)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState<DistributionRequest | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Filtrage et recherche
  useEffect(() => {
    let filtered = requests

    if (searchTerm) {
      filtered = filtered.filter(req => 
        req.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.equipmentSerial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.targetDepartment.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(req => req.status === statusFilter)
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(req => req.priority === priorityFilter)
    }

    setFilteredRequests(filtered)
  }, [requests, searchTerm, statusFilter, priorityFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_attente':
        return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">En Attente</Badge>
      case 'en_revision':
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">En Révision</Badge>
      case 'approuve':
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">Approuvé</Badge>
      case 'distribue':
        return <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Distribué</Badge>
      case 'refuse':
        return <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">Refusé</Badge>
      case 'annule':
        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800">Annulé</Badge>
      default:
        return <Badge variant="outline">Inconnu</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'low':
        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800">Faible</Badge>
      case 'medium':
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">Moyenne</Badge>
      case 'high':
        return <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">Élevée</Badge>
      case 'urgent':
        return <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">Urgente</Badge>
      default:
        return <Badge variant="outline">-</Badge>
    }
  }

  const handleRequestAction = async (requestId: string, action: 'approve' | 'reject' | 'distribute', notes?: string) => {
    setIsProcessing(true)
    
    try {
      // Simulation API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setRequests(prev => prev.map(req => 
        req.id === requestId 
          ? {
              ...req,
              status: action === 'approve' ? 'approuve' : action === 'reject' ? 'refuse' : 'distribue',
              reviewedBy: 'Admin Système',
              reviewDate: new Date().toISOString().split('T')[0],
              reviewNotes: notes,
              ...(action === 'distribute' && { distributionDate: new Date().toISOString().split('T')[0] })
            }
          : req
      ))
      
      const actionText = action === 'approve' ? 'approuvée' : action === 'reject' ? 'refusée' : 'distribuée'
      toast.success(`Demande ${actionText}`, {
        description: `La demande de distribution a été ${actionText} avec succès`
      })
      
      setReviewDialogOpen(false)
      setSelectedRequest(null)
    } catch (error) {
      toast.error("Erreur lors du traitement", {
        description: "Une erreur s'est produite lors du traitement de la demande"
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getRequestStats = () => {
    const total = requests.length
    const enAttente = requests.filter(req => req.status === 'en_attente').length
    const approuve = requests.filter(req => req.status === 'approuve').length
    const distribue = requests.filter(req => req.status === 'distribue').length
    const refuse = requests.filter(req => req.status === 'refuse').length
    
    return { total, enAttente, approuve, distribue, refuse }
  }

  const stats = getRequestStats()

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 space-y-6 p-4 sm:p-6 overflow-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl">Demandes de Distribution</h1>
          <p className="text-muted-foreground">
            Gérez les demandes de distribution d'équipements entre directions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Toutes demandes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">En Attente</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-yellow-600">{stats.enAttente}</div>
              <p className="text-xs text-muted-foreground">À traiter</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Approuvées</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-green-600">{stats.approuve}</div>
              <p className="text-xs text-muted-foreground">
                En attente distribution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Distribuées</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-emerald-600">{stats.distribue}</div>
              <p className="text-xs text-muted-foreground">Terminées</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Refusées</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-red-600">{stats.refuse}</div>
              <p className="text-xs text-muted-foreground">Non approuvées</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtres et Recherche</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Rechercher par équipement, demandeur, direction..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="en_attente">En attente</SelectItem>
                      <SelectItem value="en_revision">En révision</SelectItem>
                      <SelectItem value="approuve">Approuvé</SelectItem>
                      <SelectItem value="distribue">Distribué</SelectItem>
                      <SelectItem value="refuse">Refusé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-48">
                  <Select
                    value={priorityFilter}
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Priorité" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes priorités</SelectItem>
                      <SelectItem value="low">Faible</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Élevée</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Liste des Demandes</CardTitle>
            <CardDescription>
              Toutes les demandes de distribution d'équipements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune demande trouvée</p>
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base">{request.equipmentName}</h3>
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>#{request.equipmentSerial}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {new Date(request.requestDate).toLocaleDateString(
                                "fr-FR"
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {(request.status === "en_attente" ||
                          request.status === "approuve") && (
                          <Button
                            onClick={() => {
                              setSelectedRequest(request);
                              setReviewDialogOpen(true);
                            }}
                            size="sm"
                          >
                            {request.status === "en_attente"
                              ? "Réviser"
                              : "Distribuer"}
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          Détails
                        </Button>
                      </div>
                    </div>

                    {/* Request Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Demandeur:</span>
                          <span>
                            {request.requestedBy} (
                            {request.requestedByDepartment})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Direction cible:</span>
                          <span>{request.targetDepartment}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="font-medium">Raison:</span>{" "}
                          {request.reason}
                        </div>
                        {request.requestedDeliveryDate && (
                          <div>
                            <span className="font-medium">
                              Livraison souhaitée:
                            </span>{" "}
                            {new Date(
                              request.requestedDeliveryDate
                            ).toLocaleDateString("fr-FR")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Review Info */}
                    {request.reviewDate && (
                      <div className="pt-2 border-t border-border space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">Révisé par:</span>{" "}
                          {request.reviewedBy} le{" "}
                          {new Date(request.reviewDate).toLocaleDateString(
                            "fr-FR"
                          )}
                        </div>
                        {request.reviewNotes && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Notes:</span>{" "}
                            {request.reviewNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Révision de la Demande</DialogTitle>
              <DialogDescription>
                Approuver, refuser ou distribuer cette demande d'équipement
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <RequestReviewForm
                request={selectedRequest}
                onAction={handleRequestAction}
                isLoading={isProcessing}
                onCancel={() => {
                  setReviewDialogOpen(false);
                  setSelectedRequest(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Composant formulaire de révision
interface RequestReviewFormProps {
  request: DistributionRequest
  onAction: (requestId: string, action: 'approve' | 'reject' | 'distribute', notes?: string) => void
  isLoading: boolean
  onCancel: () => void
}

function RequestReviewForm({ request, onAction, isLoading, onCancel }: RequestReviewFormProps) {
  const [notes, setNotes] = useState("")
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'distribute' | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedAction) {
      onAction(request.id, selectedAction, notes)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Request Info */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
        <h4 className="text-base">{request.equipmentName}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Série:</span> {request.equipmentSerial}
          </div>
          <div>
            <span className="font-medium">Demandeur:</span> {request.requestedBy}
          </div>
          <div>
            <span className="font-medium">De:</span> {request.requestedByDepartment}
          </div>
          <div>
            <span className="font-medium">Vers:</span> {request.targetDepartment}
          </div>
        </div>
        <div className="text-sm">
          <span className="font-medium">Raison:</span> {request.reason}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes de révision</Label>
        <Textarea
          id="notes"
          placeholder="Ajouter des notes concernant cette décision..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-4">
        <div className="flex gap-2">
          {request.status === 'en_attente' && (
            <>
              <Button 
                type="button"
                onClick={() => setSelectedAction('approve')}
                variant={selectedAction === 'approve' ? 'default' : 'outline'}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approuver
              </Button>
              <Button 
                type="button"
                onClick={() => setSelectedAction('reject')}
                variant={selectedAction === 'reject' ? 'destructive' : 'outline'}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Refuser
              </Button>
            </>
          )}
          {request.status === 'approuve' && (
            <Button 
              type="button"
              onClick={() => setSelectedAction('distribute')}
              variant={selectedAction === 'distribute' ? 'default' : 'outline'}
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marquer comme Distribué
            </Button>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Annuler
          </Button>
          <Button 
            type="submit" 
            disabled={!selectedAction || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Traitement...
              </>
            ) : (
              'Confirmer'
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}