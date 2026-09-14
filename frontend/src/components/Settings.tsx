import { useState } from "react"
import { Settings as SettingsIcon, Key, Shield, Database, Bell, Palette, Globe, Save, AlertCircle } from "lucide-react"

interface SettingsSection {
  id: string
  name: string
  icon: any
  description: string
}

const settingsSections: SettingsSection[] = [
  {
    id: "security",
    name: "Sécurité",
    icon: Shield,
    description: "Mots de passe, authentification et sécurité"
  },
  {
    id: "system",
    name: "Système",
    icon: Database,
    description: "Configuration système et base de données"
  },
  {
    id: "notifications",
    name: "Notifications",
    icon: Bell,
    description: "Paramètres de notifications et alertes"
  },
  {
    id: "appearance",
    name: "Apparence",
    icon: Palette,
    description: "Thème et interface utilisateur"
  },
  {
    id: "general",
    name: "Général",
    icon: Globe,
    description: "Paramètres généraux de l'application"
  }
]

export function Settings() {
  const [activeSection, setActiveSection] = useState("security")
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [formData, setFormData] = useState({
    // Security settings
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorEnabled: false,
    passwordExpiry: "90",
    sessionTimeout: "30",
    
    // System settings
    backupFrequency: "daily",
    maintenanceMode: false,
    logLevel: "info",
    maxFileSize: "10",
    
    // Notification settings
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    alertThreshold: "5",
    
    // Appearance settings
    theme: "auto",
    language: "fr",
    dateFormat: "dd/mm/yyyy",
    timezone: "Europe/Paris",
    
    // General settings
    companyName: "ComptaMatière",
    companyEmail: "admin@company.com",
    supportEmail: "support@company.com",
    maxUsers: "100"
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = (section: string) => {
    console.log(`Saving ${section} settings:`, formData)
    alert(`Paramètres ${section} sauvegardés!`)
  }

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-card-foreground mb-4">Changement de mot de passe</h3>
        <div className="grid gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Mot de passe actuel</label>
            <input
              type="password"
              value={formData.currentPassword}
              onChange={(e) => handleInputChange('currentPassword', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              placeholder="Entrez votre mot de passe actuel"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Nouveau mot de passe</label>
            <input
              type="password"
              value={formData.newPassword}
              onChange={(e) => handleInputChange('newPassword', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              placeholder="Entrez un nouveau mot de passe"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              placeholder="Confirmez le nouveau mot de passe"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg text-card-foreground mb-4">Paramètres de sécurité</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Expiration du mot de passe (jours)</label>
            <select
              value={formData.passwordExpiry}
              onChange={(e) => handleInputChange('passwordExpiry', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="30">30 jours</option>
              <option value="60">60 jours</option>
              <option value="90">90 jours</option>
              <option value="365">1 an</option>
              <option value="0">Jamais</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Délai d'expiration de session (minutes)</label>
            <select
              value={formData.sessionTimeout}
              onChange={(e) => handleInputChange('sessionTimeout', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 heure</option>
              <option value="120">2 heures</option>
              <option value="480">8 heures</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.twoFactorEnabled}
              onChange={(e) => handleInputChange('twoFactorEnabled', e.target.checked)}
              className="rounded border-border focus:ring-ring"
            />
            <span className="text-sm text-card-foreground">Activer l'authentification à deux facteurs</span>
          </label>
        </div>
      </div>
    </div>
  )

  const renderSystemSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-card-foreground mb-4">Sauvegarde et maintenance</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Fréquence de sauvegarde</label>
            <select
              value={formData.backupFrequency}
              onChange={(e) => handleInputChange('backupFrequency', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="hourly">Chaque heure</option>
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Niveau de logs</label>
            <select
              value={formData.logLevel}
              onChange={(e) => handleInputChange('logLevel', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="error">Erreurs seulement</option>
              <option value="warn">Erreurs et avertissements</option>
              <option value="info">Informations</option>
              <option value="debug">Debug (détaillé)</option>
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Taille maximale des fichiers (MB)</label>
            <input
              type="number"
              value={formData.maxFileSize}
              onChange={(e) => handleInputChange('maxFileSize', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              min="1"
              max="100"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={formData.maintenanceMode}
                onChange={(e) => handleInputChange('maintenanceMode', e.target.checked)}
                className="rounded border-border focus:ring-ring"
              />
              <span className="text-sm text-card-foreground">Mode maintenance</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-card-foreground mb-4">Types de notifications</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.emailNotifications}
              onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
              className="rounded border-border focus:ring-ring"
            />
            <span className="text-sm text-card-foreground">Notifications par email</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.pushNotifications}
              onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
              className="rounded border-border focus:ring-ring"
            />
            <span className="text-sm text-card-foreground">Notifications push</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.smsNotifications}
              onChange={(e) => handleInputChange('smsNotifications', e.target.checked)}
              className="rounded border-border focus:ring-ring"
            />
            <span className="text-sm text-card-foreground">Notifications SMS</span>
          </label>
        </div>
      </div>
      <div>
        <h3 className="text-lg text-card-foreground mb-4">Seuils d'alerte</h3>
        <div>
          <label className="block text-sm text-muted-foreground mb-2">Seuil d'alerte pour équipements en maintenance</label>
          <input
            type="number"
            value={formData.alertThreshold}
            onChange={(e) => handleInputChange('alertThreshold', e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            min="1"
            max="50"
          />
          <p className="text-xs text-muted-foreground mt-1">Nombre d'équipements avant déclenchement d'alerte</p>
        </div>
      </div>
    </div>
  )

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-card-foreground mb-4">Interface utilisateur</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Thème</label>
            <select
              value={formData.theme}
              onChange={(e) => handleInputChange('theme', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
              <option value="auto">Automatique</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Langue</label>
            <select
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Format de date</label>
            <select
              value={formData.dateFormat}
              onChange={(e) => handleInputChange('dateFormat', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="dd/mm/yyyy">DD/MM/YYYY</option>
              <option value="mm/dd/yyyy">MM/DD/YYYY</option>
              <option value="yyyy-mm-dd">YYYY-MM-DD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Fuseau horaire</label>
            <select
              value={formData.timezone}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
              <option value="Europe/London">Europe/London (UTC+0)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg text-card-foreground mb-4">Informations de l'entreprise</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Nom de l'entreprise</label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Email de l'entreprise</label>
            <input
              type="email"
              value={formData.companyEmail}
              onChange={(e) => handleInputChange('companyEmail', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Email support</label>
            <input
              type="email"
              value={formData.supportEmail}
              onChange={(e) => handleInputChange('supportEmail', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Nombre maximum d'utilisateurs</label>
            <input
              type="number"
              value={formData.maxUsers}
              onChange={(e) => handleInputChange('maxUsers', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              min="1"
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "security": return renderSecuritySettings()
      case "system": return renderSystemSettings()
      case "notifications": return renderNotificationSettings()
      case "appearance": return renderAppearanceSettings()
      case "general": return renderGeneralSettings()
      default: return renderSecuritySettings()
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">Paramètres Système</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Configuration de l'application et paramètres de sécurité
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Mobile Settings Navigation */}
        <div className="lg:hidden">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="w-full flex items-center justify-between p-3 bg-card border border-border rounded-lg"
          >
            <span className="text-sm text-card-foreground">
              {settingsSections.find(s => s.id === activeSection)?.name}
            </span>
            <span className="text-muted-foreground">
              {showMobileMenu ? '−' : '+'}
            </span>
          </button>
          
          {showMobileMenu && (
            <div className="mt-2 bg-card border border-border rounded-lg p-2 space-y-1">
              {settingsSections.map((section) => {
                const IconComponent = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id)
                      setShowMobileMenu(false)
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50 text-card-foreground'
                    }`}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    <div>
                      <div className="text-sm">{section.name}</div>
                      <div className={`text-xs mt-1 ${
                        activeSection === section.id 
                          ? 'text-primary-foreground/70' 
                          : 'text-muted-foreground'
                      }`}>
                        {section.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Desktop Settings Navigation */}
        <div className="hidden lg:block lg:w-1/4">
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <h3 className="text-sm text-muted-foreground uppercase tracking-wider mb-4">Catégories</h3>
            <div className="space-y-2">
              {settingsSections.map((section) => {
                const IconComponent = section.icon
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted/50 text-card-foreground'
                    }`}
                  >
                    <IconComponent className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm">{section.name}</div>
                      <div className={`text-xs mt-1 ${
                        activeSection === section.id 
                          ? 'text-primary-foreground/70' 
                          : 'text-muted-foreground'
                      }`}>
                        {section.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:w-3/4">
          <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="p-4 sm:p-6 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg text-card-foreground">
                  {settingsSections.find(s => s.id === activeSection)?.name}
                </h3>
                <button 
                  onClick={() => handleSave(activeSection)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  <Save className="h-4 w-4" />
                  Sauvegarder
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {renderContent()}
            </div>
          </div>

          {/* Warning Alert */}
          <div className="mt-4 sm:mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm text-orange-900 dark:text-orange-100">Important</h4>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Certains changements peuvent nécessiter un redémarrage de l'application pour prendre effet.
                  Assurez-vous de sauvegarder vos modifications avant de fermer la session.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}