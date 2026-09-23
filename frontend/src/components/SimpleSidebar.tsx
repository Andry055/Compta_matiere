import { 
  LayoutDashboard, 
  ArrowUpDown, 
  Package,
  Building,
  Clipboard,
  BarChart3,
  User as UserIcon,
  Settings,
  X,
  Truck,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine
} from "lucide-react"
import { User } from "../App"
import { ROLES_CONFIG, AppRole } from "../types/roles"

const navItems = [
  {
    title: "Tableau de Bord",
    icon: LayoutDashboard,
    key: "dashboard",
    description: "Vue d'ensemble"
  },
  {
    title: "Journal Comptable",
    icon: BookOpen,
    key: "journal",
    description: "Registre officiel"
  },
  {
    title: "Équipements",
    icon: Package,
    key: "equipment",
    description: "Inventaire détaillé"
  },
  {
    title: "Entrées",
    icon: ArrowDownToLine,
    key: "entries",
    description: "Suivi des entrées de matériels"
  },
  {
    title: "Sorties",
    icon: ArrowUpFromLine,
    key: "exits",
    description: "Suivi des sorties de matériels"
  },
  {
    title: "Distribution",
    icon: Truck,
    key: "distribution",
    description: "Gestion des distributions"
  },
  {
    title: "Mouvements",
    icon: ArrowUpDown,
    key: "movements",
    description: "Entrées et sorties"
  },
  {
    title: "Directions",
    icon: Building,
    key: "departments",
    description: "Organisation des services"
  },
  {
    title: "Demandes",
    icon: Clipboard,
    key: "requests",
    description: "Gestion des demandes"
  },
  {
    title: "Rapports",
    icon: BarChart3,
    key: "reports",
    description: "Exports et analyses"
  },
  {
    title: "Utilisateurs",
    icon: UserIcon,
    key: "users",
    description: "Gestion des utilisateurs"
  },
  {
    title: "Paramètres",
    icon: Settings,
    key: "settings",
    description: "Configuration système"
  },
]

interface SimpleSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  user?: User
  isMobile?: boolean
  onClose?: () => void
}

export function SimpleSidebar({ activeSection, onSectionChange, user, isMobile = false, onClose }: SimpleSidebarProps) {
  // Fonctionnalité : filtrer les rubriques selon le rôle métier
  const userRole = (user?.role || 'depositaire') as AppRole
  const allowedPages = user?.role === 'admin'
    ? navItems.map((item) => item.key)
    : (ROLES_CONFIG[userRole]?.pages || navItems.map((item) => item.key))
  const visibleItems = navItems.filter((item) => allowedPages.includes(item.key))

  const roleLabel = ROLES_CONFIG[userRole]?.label || (user?.role === 'admin' ? 'Administrateur Système' : 'Personnel')

  return (
    <div className={`${isMobile ? 'w-80' : 'w-72'} bg-sidebar border-r border-sidebar-border flex flex-col h-full`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-sidebar-primary" />
            <span className="text-lg text-sidebar-foreground">ComptaMatière</span>
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          Système de Gestion d'Équipements
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
        <nav className="space-y-2">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider mb-4 px-1">
            Navigation
          </p>
          {visibleItems.map((item) => {
            const IconComponent = item.icon
            const isActive = activeSection === item.key
            return (
              <button
                key={item.key}
                onClick={() => onSectionChange(item.key)}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-200 group ${
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="truncate">{item.title}</div>
                  {item.description && (
                    <div className="text-xs text-sidebar-foreground/50 mt-0.5 truncate hidden sm:block">
                      {item.key === "requests" && user?.role === "demandeur"
                        ? "Gestion de mes demandes"
                        : item.description}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* User Info */}
      <div className="p-3 sm:p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
            <UserIcon className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-sidebar-foreground truncate">
              {user?.name || 'Admin Système'}
            </div>
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {roleLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
