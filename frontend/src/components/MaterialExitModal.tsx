import { useState } from "react"
import { ArrowUp, Search, Save, Package, Calendar, User as UserIcon, Building, X, Scan, Loader2, Check, AlertCircle } from "lucide-react"
import { User } from "../App"

interface MaterialExitModalProps {
  user: User
  isOpen: boolean
  onClose: () => void
}

interface ExitItem {
  id: string
  name: string
  serialNumber: string
  category: string
  quantity: number
  destination: string
  recipientName: string
  recipientDepartment: string
  notes: string
}

const destinations = [
  "IT - Développement",
  "Finance - Comptabilité", 
  "RH - Administration",
  "Marketing - Communication",
  "Logistique - Entrepôt",
  "Production - Atelier",
  "Service Client",
  "Direction Générale"
]

const mockAvailableEquipment = [
  {
    id: "1",
    name: "Ordinateur portable HP EliteBook",
    serialNumber: "HP240501A",
    category: "Informatique",
    availableQuantity: 5
  },
  {
    id: "2", 
    name: "Clavier mécanique Logitech",
    serialNumber: "LG789456",
    category: "Périphériques",
    availableQuantity: 12
  },
  {
    id: "3",
    name: "Écran Dell UltraSharp 24\"", 
    serialNumber: "DL987321",
    category: "Affichage",
    availableQuantity: 8
  },
  {
    id: "4",
    name: "Souris sans fil",
    serialNumber: "MS123789",
    category: "Périphériques", 
    availableQuantity: 15
  },
  {
    id: "5",
    name: "Téléphone IP Cisco",
    serialNumber: "CS789012",
    category: "Communication",
    availableQuantity: 3
  }
]

export function MaterialExitModal({ user, isOpen, onClose }: MaterialExitModalProps) {
  const [exitItems, setExitItems] = useState<ExitItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEquipment, setSelectedEquipment] = useState<typeof mockAvailableEquipment[0] | null>(null)
  const [exitReference, setExitReference] = useState("")
  const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0])
  const [currentExit, setCurrentExit] = useState({
    quantity: 1,
    destination: "",
    recipientName: "",
    recipientDepartment: "",
    notes: ""
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [showNotification, setShowNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})

  const generateReference = () => {
    const date = new Date()
    const ref = `EXT-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(exitItems.length + 1).padStart(3, '0')}`
    setExitReference(ref)
  }

  const filteredEquipment = mockAvailableEquipment.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addExitItem = async () => {
    // Validate required fields
    const errors: { [key: string]: string } = {}
    
    if (!selectedEquipment) {
      errors.equipment = "Veuillez sélectionner un équipement"
    }
    if (!currentExit.destination.trim()) {
      errors.destination = "La destination est obligatoire"
    }
    if (!currentExit.recipientName.trim()) {
      errors.recipientName = "Le nom du destinataire est obligatoire"
    }
    if (selectedEquipment && currentExit.quantity > selectedEquipment.availableQuantity) {
      errors.quantity = `Quantité non disponible. Maximum: ${selectedEquipment.availableQuantity}`
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      setShowNotification({
        type: 'error',
        message: 'Veuillez corriger les erreurs dans le formulaire'
      })
      setTimeout(() => setShowNotification(null), 4000)
      return
    }

    setFormErrors({})
    setIsAddingItem(true)

    // Simulate API call delay
    setTimeout(() => {
      const newExitItem: ExitItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: selectedEquipment!.name,
        serialNumber: selectedEquipment!.serialNumber,
        category: selectedEquipment!.category,
        quantity: currentExit.quantity,
        destination: currentExit.destination,
        recipientName: currentExit.recipientName,
        recipientDepartment: currentExit.recipientDepartment,
        notes: currentExit.notes
      }

      setExitItems([...exitItems, newExitItem])
      setSelectedEquipment(null)
      setCurrentExit({
        quantity: 1,
        destination: "",
        recipientName: "",
        recipientDepartment: "",
        notes: ""
      })
      setSearchTerm("")

      if (!exitReference) {
        generateReference()
      }

      setIsAddingItem(false)
      setShowNotification({
        type: 'success',
        message: 'Élément ajouté à la sortie!'
      })
      setTimeout(() => setShowNotification(null), 3000)
    }, 800)
  }

  const removeExitItem = (id: string) => {
    setExitItems(exitItems.filter(item => item.id !== id))
  }

  const saveExit = async () => {
    if (exitItems.length === 0) {
      setShowNotification({
        type: 'error',
        message: 'Ajoutez au moins un élément avant de sauvegarder'
      })
      setTimeout(() => setShowNotification(null), 4000)
      return
    }

    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate 95% success rate
          if (Math.random() > 0.05) {
            resolve(null)
          } else {
            reject(new Error('Erreur de connexion au serveur'))
          }
        }, 2000)
      })

      const exit = {
        reference: exitReference,
        items: exitItems,
        exitDate,
        processedBy: user.name,
        department: user.department,
        timestamp: new Date().toISOString()
      }

      console.log("Saving exit:", exit)
      
      setShowNotification({
        type: 'success',
        message: 'Sortie sauvegardée avec succès!'
      })
      
      // Close modal after delay
      setTimeout(() => {
        resetForm()
        onClose()
        setShowNotification(null)
      }, 1500)

    } catch (error) {
      setShowNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'
      })
      setTimeout(() => setShowNotification(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setExitItems([])
    setExitReference("")
    setSearchTerm("")
    setSelectedEquipment(null)
    setCurrentExit({
      quantity: 1,
      destination: "",
      recipientName: "",
      recipientDepartment: "",
      notes: ""
    })
  }

  const handleClose = () => {
    if (exitItems.length > 0) {
      if (confirm("Vous avez des éléments non sauvegardés. Voulez-vous vraiment fermer ?")) {
        resetForm()
        onClose()
      }
    } else {
      resetForm()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      {/* Success/Error Notification */}
      {showNotification && (
        <div
          className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl text-white animate-in slide-in-from-right-full duration-300 ${
            showNotification.type === "success"
              ? "bg-gradient-to-r from-blue-500 to-blue-600"
              : "bg-gradient-to-r from-red-500 to-red-600"
          }`}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
            {showNotification.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">
              {showNotification.message}
            </div>
            <div className="text-xs opacity-90">
              {showNotification.type === "success"
                ? "Opération réussie"
                : "Une erreur est survenue"}
            </div>
          </div>
          <button
            onClick={() => setShowNotification(null)}
            className="ml-4 text-white/80 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
              <ArrowUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg text-card-foreground">
                Nouvelle Sortie de Matériel
              </h2>
              <p className="text-sm text-muted-foreground">
                Enregistrer la sortie d'équipements vers les directions
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Exit Information */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="text-sm text-card-foreground mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Informations de la Sortie
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Référence de sortie
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={exitReference}
                    onChange={(e) => setExitReference(e.target.value)}
                    placeholder="Auto-généré"
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                  <button
                    onClick={generateReference}
                    className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Date de sortie
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                <span>Traité par: {user.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>Direction: {user.department}</span>
              </div>
            </div>
          </div>

          {/* Equipment Selection */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="text-sm text-card-foreground mb-4">
              Sélectionner un Équipement
            </h3>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un équipement..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>

            {/* Available Equipment */}
            <div className="grid gap-2 max-h-32 overflow-y-auto mb-4">
              {filteredEquipment.map((equipment) => (
                <button
                  key={equipment.id}
                  onClick={() => setSelectedEquipment(equipment)}
                  className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors text-sm ${
                    selectedEquipment?.id === equipment.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <div>
                    <div className="text-card-foreground">{equipment.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {equipment.serialNumber} • {equipment.category}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Dispo: {equipment.availableQuantity}
                  </div>
                </button>
              ))}
            </div>

            {selectedEquipment && (
              <div className="p-4 border border-border rounded-lg bg-muted/30">
                <h4 className="text-sm text-card-foreground mb-3">
                  Configuration de la sortie
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedEquipment.availableQuantity}
                      value={currentExit.quantity}
                      onChange={(e) =>
                        setCurrentExit({
                          ...currentExit,
                          quantity: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Destination *
                    </label>
                    <select
                      value={currentExit.destination}
                      onChange={(e) => {
                        setCurrentExit({
                          ...currentExit,
                          destination: e.target.value,
                        });
                        if (formErrors.destination) {
                          setFormErrors({ ...formErrors, destination: "" });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                        formErrors.destination
                          ? "border-red-500 focus:ring-red-500"
                          : "border-border"
                      }`}
                    >
                      <option value="">Sélectionner...</option>
                      {destinations.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    {formErrors.destination && (
                      <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.destination}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Nom du destinataire *
                    </label>
                    <input
                      type="text"
                      value={currentExit.recipientName}
                      onChange={(e) => {
                        setCurrentExit({
                          ...currentExit,
                          recipientName: e.target.value,
                        });
                        if (formErrors.recipientName) {
                          setFormErrors({ ...formErrors, recipientName: "" });
                        }
                      }}
                      placeholder="Nom du bénéficiaire"
                      className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                        formErrors.recipientName
                          ? "border-red-500 focus:ring-red-500"
                          : "border-border"
                      }`}
                    />
                    {formErrors.recipientName && (
                      <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.recipientName}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">
                      Service destinataire
                    </label>
                    <input
                      type="text"
                      value={currentExit.recipientDepartment}
                      onChange={(e) =>
                        setCurrentExit({
                          ...currentExit,
                          recipientDepartment: e.target.value,
                        })
                      }
                      placeholder="Service ou équipe"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm text-muted-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={currentExit.notes}
                    onChange={(e) =>
                      setCurrentExit({ ...currentExit, notes: e.target.value })
                    }
                    placeholder="Motif de la sortie, conditions particulières..."
                    rows={2}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={addExitItem}
                    disabled={isAddingItem}
                    className="group relative inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-sm font-medium disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-90"
                  >
                    {/* Background Effects */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                    {/* Loading Overlay */}
                    {isAddingItem && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-blue-500/10 animate-pulse" />
                    )}

                    {/* Icon */}
                    <div className="relative flex items-center justify-center w-4 h-4">
                      {isAddingItem ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4 group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-300" />
                      )}
                    </div>

                    {/* Text */}
                    <span className="relative">
                      {isAddingItem ? "Ajout..." : "Ajouter à la Sortie"}
                    </span>

                    {/* Border Glow */}
                    <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Exit Items List */}
          {exitItems.length > 0 && (
            <div className="border border-border rounded-lg">
              <div className="p-4 border-b border-border bg-muted/20">
                <h3 className="text-sm text-card-foreground">
                  Éléments en Sortie ({exitItems.length})
                </h3>
              </div>

              <div className="max-h-40 overflow-y-auto">
                {exitItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-card-foreground truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.serialNumber} • Qté: {item.quantity} •{" "}
                        {item.destination}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Destinataire: {item.recipientName}
                      </div>
                    </div>
                    <button
                      onClick={() => removeExitItem(item.id)}
                      className="ml-4 text-destructive hover:text-destructive/80 text-xs px-2 py-1 rounded hover:bg-destructive/10"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 sm:p-6 bg-muted/20">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm transition-colors"
            >
              Annuler
            </button>
            <ScannerButton
              onScan={(data) => {
                setShowNotification({
                  type: "success",
                  message: `Code scanné: ${data}`,
                });
                setTimeout(() => setShowNotification(null), 3000);
              }}
            />
            <button
              onClick={saveExit}
              disabled={exitItems.length === 0 || isSubmitting}
              className={`group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 transform-gpu overflow-hidden ${
                exitItems.length > 0 && !isSubmitting
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/40 hover:scale-105 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {/* Background Effects */}
              {exitItems.length > 0 && !isSubmitting && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out" />
                </>
              )}

              {/* Loading Overlay */}
              {isSubmitting && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/10 animate-pulse" />
              )}

              {/* Icon */}
              <div className="relative flex items-center justify-center w-4 h-4">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                )}
              </div>

              {/* Text */}
              <span className="relative">
                {isSubmitting ? "Sauvegarde..." : "Sauvegarder Sortie"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Scanner Button Component
interface ScannerButtonProps {
  onScan: (data: string) => void
}

function ScannerButton({ onScan }: ScannerButtonProps) {
  const [isScanning, setIsScanning] = useState(false)

  const handleScan = async () => {
    setIsScanning(true)
    
    // Simulate scanning process
    setTimeout(() => {
      const mockScannedData = `EQP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      onScan(mockScannedData)
      setIsScanning(false)
    }, 2000)
  }

  return (
    <button
      onClick={handleScan}
      disabled={isScanning}
      className="group relative inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg transition-all duration-200 hover:bg-muted hover:border-primary/50 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg" />
      
      {/* Icon */}
      <div className="relative flex items-center justify-center w-4 h-4">
        {isScanning ? (
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
        ) : (
          <Scan className="h-4 w-4 group-hover:text-purple-600 transition-colors duration-200" />
        )}
      </div>
      
      {/* Text */}
      <span className="relative group-hover:text-purple-600 transition-colors duration-200">
        {isScanning ? 'Scan...' : 'Scanner'}
      </span>
      
      {/* Scanning Animation */}
      {isScanning && (
        <div className="absolute inset-0 border-2 border-purple-500/30 rounded-lg animate-pulse" />
      )}
      
      {/* Hover Border */}
      <div className="absolute inset-0 border border-purple-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </button>
  )
}