import { useState, useEffect } from "react"
import { X, User, Mail, Phone, Shield, Building2, Briefcase, Eye, EyeOff } from "lucide-react"

interface Employee {
  id: number
  name: string
  im: string
  fonction: string
  email: string
  phone: string
  CIN: string
  status: "Actif" | "Inactif" | "Congé"
}

interface Service {
  id: number
  name: string
  manager: string
  managerEmail: string
  description: string
  employees: Employee[]
  location: string
}

interface Direction {
  id: number
  name: string
  director: string
  directorEmail: string
  description: string
  services: Service[]
  location: string
  isCurrentAdminDirection?: boolean
}

interface UserAccount {
  id?: number
  name: string
  email: string
  phone: string
  role: 'Admin' | 'Manager' | 'Utilisateur' | 'Lecture Seule'
  directionId: number
  directionName: string
  serviceId: number
  serviceName: string
  status: 'Actif' | 'Inactif' | 'Suspendu'
  permissions: string[]
  password?: string
}

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (userData: UserAccount) => void
  user?: UserAccount | null
  mode: "create" | "edit"
  directions: Direction[]
}

const rolePermissions = {
  'Admin': ["Gestion complète", "Approbation", "Rapports", "Utilisateurs", "Configuration système"],
  'Manager': ["Gestion équipements", "Mouvements", "Rapports", "Validation demandes"],
  'Utilisateur': ["Demandes", "Consultation", "Mouvements limités"],
  'Lecture Seule': ["Consultation"]
}

export function UserModal({ isOpen, onClose, onSave, user, mode, directions }: UserModalProps) {
  const [formData, setFormData] = useState<UserAccount>({
    name: "",
    email: "",
    phone: "",
    role: "Utilisateur",
    directionId: 0,
    directionName: "",
    serviceId: 0,
    serviceName: "",
    status: "Actif",
    permissions: [],
    password: ""
  })

  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null)
  const [availableServices, setAvailableServices] = useState<Service[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (mode === "edit" && user) {
      setFormData({
        ...user,
        password: "" // Don't prefill password for security
      })
      
      // Find and set the direction
      const direction = directions.find(d => d.id === user.directionId)
      if (direction) {
        setSelectedDirection(direction)
        setAvailableServices(direction.services)
      }
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "Utilisateur",
        directionId: 0,
        directionName: "",
        serviceId: 0,
        serviceName: "",
        status: "Actif",
        permissions: rolePermissions["Utilisateur"],
        password: ""
      })
      setSelectedDirection(null)
      setAvailableServices([])
    }
    setErrors({})
  }, [mode, user, directions, isOpen])

  const handleDirectionChange = (directionId: number) => {
    const direction = directions.find(d => d.id === directionId)
    if (direction) {
      setSelectedDirection(direction)
      setAvailableServices(direction.services)
      setFormData(prev => ({
        ...prev,
        directionId: direction.id,
        directionName: direction.name,
        serviceId: 0,
        serviceName: ""
      }))
    }
  }

  const handleServiceChange = (serviceId: number) => {
    const service = availableServices.find(s => s.id === serviceId)
    if (service) {
      setFormData(prev => ({
        ...prev,
        serviceId: service.id,
        serviceName: service.name
      }))
    }
  }

  const handleRoleChange = (role: 'Admin' | 'Manager' | 'Utilisateur' | 'Lecture Seule') => {
    setFormData(prev => ({
      ...prev,
      role,
      permissions: rolePermissions[role]
    }))
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est obligatoire"
    }

    if (!formData.email.trim()) {
      newErrors.email = "L'email est obligatoire"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Format d'email invalide"
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Le téléphone est obligatoire"
    }

    if (formData.directionId === 0) {
      newErrors.direction = "Veuillez sélectionner une direction"
    }

    if (formData.serviceId === 0) {
      newErrors.service = "Veuillez sélectionner un service"
    }

    if (mode === "create" && !formData.password) {
      newErrors.password = "Le mot de passe est obligatoire"
    }

    if (formData.password && formData.password.length < 6) {
      newErrors.password = "Le mot de passe doit contenir au moins 6 caractères"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    const userData: UserAccount = {
      ...formData,
      id: mode === "edit" ? user?.id : Date.now()
    }

    onSave(userData)
    onClose()
  }

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    let password = ""
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, password }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl text-card-foreground">
            {mode === "create" ? "Nouvel Utilisateur" : "Modifier l'Utilisateur"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
              Informations Personnelles
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Nom complet *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent ${
                      errors.name ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent ${
                      errors.email ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Ex: jean.dupont@ministere.gov.mg"
                  />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Téléphone *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent ${
                      errors.phone ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder="Ex: +261 20 22 123 45"
                  />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Statut
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
                >
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="Suspendu">Suspendu</option>
                </select>
              </div>
            </div>
          </div>

          {/* Organizational Assignment */}
          <div className="space-y-4">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
              Affectation Organisationnelle
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Direction *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={formData.directionId}
                    onChange={(e) => handleDirectionChange(Number(e.target.value))}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent ${
                      errors.direction ? 'border-red-500' : 'border-border'
                    }`}
                  >
                    <option value={0}>Sélectionner une direction...</option>
                    {directions.map(direction => (
                      <option key={direction.id} value={direction.id}>
                        {direction.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.direction && <p className="text-xs text-red-500 mt-1">{errors.direction}</p>}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Service *
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={formData.serviceId}
                    onChange={(e) => handleServiceChange(Number(e.target.value))}
                    disabled={!selectedDirection}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                      errors.service ? 'border-red-500' : 'border-border'
                    }`}
                  >
                    <option value={0}>Sélectionner un service...</option>
                    {availableServices.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.service && <p className="text-xs text-red-500 mt-1">{errors.service}</p>}
              </div>
            </div>
          </div>

          {/* Role and Security */}
          <div className="space-y-4">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
              Rôle et Sécurité
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Rôle d'accès
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value as any)}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
                  >
                    <option value="Lecture Seule">Lecture Seule</option>
                    <option value="Utilisateur">Utilisateur</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Mot de passe {mode === "create" && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className={`w-full pr-20 pl-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent ${
                      errors.password ? 'border-red-500' : 'border-border'
                    }`}
                    placeholder={mode === "edit" ? "Laisser vide pour ne pas modifier" : "Mot de passe"}
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                      title="Générer un mot de passe"
                    >
                      Gen
                    </button>
                  </div>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
            </div>
          </div>

          {/* Permissions Preview */}
          <div className="space-y-3">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
              Permissions
            </h3>
            <div className="flex flex-wrap gap-2">
              {formData.permissions.map((permission, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              {mode === "create" ? "Créer l'utilisateur" : "Modifier l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}