import { useState } from "react"
import { Shield, Clock, MapPin, AlertTriangle, CheckCircle, Eye, EyeOff } from "lucide-react"

interface LoginActivity {
  id: number
  user: string
  email: string
  role: string
  timestamp: string
  ipAddress: string
  location: string
  device: string
  status: 'success' | 'failed' | 'blocked'
}

const mockLoginActivity: LoginActivity[] = [
  {
    id: 1,
    user: "Admin Système",
    email: "admin@comptamatiere.com",
    role: "admin",
    timestamp: "2025-01-08 14:30:25",
    ipAddress: "192.168.1.100",
    location: "Paris, France",
    device: "Chrome 120 on Windows",
    status: "success"
  },
  {
    id: 2,
    user: "Marie Dubois",
    email: "marie.dubois@comptamatiere.com",
    role: "staff",
    timestamp: "2025-01-08 14:15:10",
    ipAddress: "192.168.1.105",
    location: "Paris, France",
    device: "Firefox 121 on Linux",
    status: "success"
  },
  {
    id: 3,
    user: "Tentative inconnue",
    email: "hacker@example.com",
    role: "unknown",
    timestamp: "2025-01-08 13:45:33",
    ipAddress: "45.123.456.789",
    location: "Unknown Location",
    device: "Unknown",
    status: "blocked"
  },
  {
    id: 4,
    user: "Pierre Martin",
    email: "pierre.martin@comptamatiere.com",
    role: "staff",
    timestamp: "2025-01-08 13:20:15",
    ipAddress: "192.168.1.110",
    location: "Paris, France",
    device: "Safari 17 on macOS",
    status: "success"
  },
  {
    id: 5,
    user: "Sophie Bernard",
    email: "sophie.bernard@comptamatiere.com",
    role: "staff",
    timestamp: "2025-01-08 12:55:42",
    ipAddress: "192.168.1.115",
    location: "Paris, France",
    device: "Edge 120 on Windows",
    status: "failed"
  }
]

export function SecurityDashboard() {
  const [activities] = useState<LoginActivity[]>(mockLoginActivity)
  const [showIpAddresses, setShowIpAddresses] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'blocked'>('all')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'failed': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'success': return 'Succès'
      case 'failed': return 'Échec'
      case 'blocked': return 'Bloqué'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <Clock className="h-4 w-4" />
      case 'blocked': return <AlertTriangle className="h-4 w-4" />
      default: return null
    }
  }

  const filteredActivities = activities.filter(activity => 
    filterStatus === 'all' || activity.status === filterStatus
  )

  const stats = {
    total: activities.length,
    successful: activities.filter(a => a.status === 'success').length,
    failed: activities.filter(a => a.status === 'failed').length,
    blocked: activities.filter(a => a.status === 'blocked').length
  }

  const maskIpAddress = (ip: string) => {
    if (showIpAddresses) return ip
    const parts = ip.split('.')
    return `${parts[0]}.${parts[1]}.***.**`
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Sécurité et Authentification
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Surveillance des connexions et activité sécuritaire
          </p>
        </div>
        
        <button
          onClick={() => setShowIpAddresses(!showIpAddresses)}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm"
        >
          {showIpAddresses ? (
            <>
              <EyeOff className="h-4 w-4" />
              Masquer IP
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Afficher IP
            </>
          )}
        </button>
      </div>

      {/* Statistics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total Tentatives</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Connexions Réussies</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.successful}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Clock className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Échecs</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.failed}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">Bloquées</div>
              <div className="text-lg sm:text-xl text-card-foreground">{stats.blocked}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Filtrer par statut</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
          >
            <option value="all">Toutes les tentatives</option>
            <option value="success">Succès uniquement</option>
            <option value="failed">Échecs uniquement</option>
            <option value="blocked">Bloquées uniquement</option>
          </select>
        </div>
      </div>

      {/* Activity Log */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Journal des Connexions ({filteredActivities.length})
          </h3>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden p-4 space-y-3">
          {filteredActivities.map((activity) => (
            <div key={activity.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(activity.status)}
                  <span className="text-sm text-card-foreground">{activity.user}</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getStatusColor(activity.status)}`}>
                  {getStatusText(activity.status)}
                </span>
              </div>
              
              <div className="text-xs text-muted-foreground">{activity.email}</div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">IP:</span>
                  <div className="text-card-foreground font-mono">{maskIpAddress(activity.ipAddress)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Localisation:</span>
                  <div className="text-card-foreground">{activity.location}</div>
                </div>
              </div>
              
              <div className="text-xs">
                <span className="text-muted-foreground">Date:</span>
                <div className="text-card-foreground">{new Date(activity.timestamp).toLocaleString('fr-FR')}</div>
              </div>
              
              <div className="text-xs">
                <span className="text-muted-foreground">Appareil:</span>
                <div className="text-card-foreground">{activity.device}</div>
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
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Utilisateur</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Date/Heure</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Adresse IP</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Localisation</th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">Appareil</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((activity) => (
                  <tr key={activity.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(activity.status)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(activity.status)}`}>
                          {getStatusText(activity.status)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {activity.user}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {activity.email}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString('fr-FR')}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                      {maskIpAddress(activity.ipAddress)}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {activity.location}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {activity.device}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredActivities.length === 0 && (
          <div className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-sm text-muted-foreground mb-2">Aucune activité trouvée</h4>
            <p className="text-xs text-muted-foreground">
              Aucune connexion ne correspond aux critères sélectionnés
            </p>
          </div>
        )}
      </div>

      {/* Security Recommendations */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Recommandations de Sécurité
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="text-sm text-card-foreground">Mesures Actives</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Authentification par email/mot de passe activée</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Sessions avec expiration automatique</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Surveillance des tentatives de connexion</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Contrôle d'accès basé sur les rôles</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-sm text-card-foreground">Améliorations Possibles</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span>Authentification à deux facteurs (2FA)</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span>Politique de mots de passe renforcée</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span>Limitation du nombre de tentatives</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span>Notifications d'activité suspecte</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}