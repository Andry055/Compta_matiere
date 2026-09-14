import { 
  LayoutDashboard, 
  ArrowDown,
  ArrowUp,
  List,
  ClipboardList,
  User,
  Package,
  X
} from "lucide-react"
import { User as UserType } from "../App"

const navItems = [
  {
    title: "Tableau de Bord",
    icon: LayoutDashboard,
    key: "dashboard",
    description: "Vue d'ensemble personnelle"
  },
  {
    title: "Entrée Matériel",
    icon: ArrowDown,
    key: "entry",
    description: "Enregistrer les arrivées"
  },
  {
    title: "Sortie Matériel",
    icon: ArrowUp,
    key: "exit",
    description: "Gérer les expéditions"
  },
  {
    title: "Mes Mouvements",
    icon: List,
    key: "movements",
    description: "Historique personnel"
  },
  {
    title: "Demandes en Attente",
    icon: ClipboardList,
    key: "requests",
    description: "À traiter"
  },
  {
    title: "Mon Profil",
    icon: User,
    key: "profile",
    description: "Informations personnelles"
  }
]

interface StaffSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  user: UserType
  isMobile?: boolean
  onClose?: () => void
}

export function StaffSidebar({ activeSection, onSectionChange, user, isMobile = false, onClose }: StaffSidebarProps) {
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
          Interface Personnel - Gestion des Mouvements
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
        <nav className="space-y-2">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider mb-4 px-1">
            Actions Principales
          </p>
          {navItems.map((item) => {
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
                      {item.description}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Quick Stats */}
        <div className="mt-6 p-3 bg-sidebar-accent/30 rounded-lg">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider mb-2">
            Mes Statistiques
          </p>
          <div className="space-y-2 text-xs text-sidebar-foreground">
            <div className="flex justify-between">
              <span>Entrées aujourd'hui:</span>
              <span className="text-green-600 dark:text-green-400">8</span>
            </div>
            <div className="flex justify-between">
              <span>Sorties aujourd'hui:</span>
              <span className="text-blue-600 dark:text-blue-400">5</span>
            </div>
            <div className="flex justify-between">
              <span>En attente:</span>
              <span className="text-orange-600 dark:text-orange-400">2</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-3 sm:p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-sidebar-foreground truncate">{user.name}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {user.department}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}