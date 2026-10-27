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
    <div className={`cm-sidebar ${isMobile ? 'w-80' : 'w-72'} flex flex-col h-full`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="cm-brand-mark">
              <Package className="h-5 w-5" />
            </span>
            <span className="cm-title text-base text-sidebar-foreground">AssetTrack</span>
          </div>
          {isMobile && onClose && (
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-sidebar-accent text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="cm-eyebrow mt-2 text-sidebar-foreground/60">
          Interface Personnel
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto cm-scroll">
        <nav className="space-y-1">
          <p className="cm-eyebrow mb-3 px-3 text-sidebar-foreground/50">
            Actions Principales
          </p>
          {navItems.map((item) => {
            const IconComponent = item.icon
            const isActive = activeSection === item.key
            return (
              <button
                key={item.key}
                onClick={() => onSectionChange(item.key)}
                data-active={isActive ? "true" : "false"}
                aria-current={isActive ? "page" : undefined}
                className="cm-nav-item group"
              >
                <IconComponent className="cm-nav-icon h-4 w-4" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="truncate font-medium">{item.title}</div>
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
        <div className="cm-panel-flat mt-6 p-3">
          <p className="cm-eyebrow mb-2">
            Mes Statistiques
          </p>
          <div className="space-y-2 text-xs text-sidebar-foreground">
            <div className="flex justify-between">
              <span>Entrées aujourd'hui:</span>
              <span className="cm-num font-semibold text-green-600 dark:text-green-400">8</span>
            </div>
            <div className="flex justify-between">
              <span>Sorties aujourd'hui:</span>
              <span className="cm-num font-semibold text-blue-600 dark:text-blue-400">5</span>
            </div>
            <div className="flex justify-between">
              <span>En attente:</span>
              <span className="cm-num font-semibold text-orange-600 dark:text-orange-400">2</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-3 sm:p-4 border-t border-sidebar-border">
        <div className="cm-panel-flat flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {user.department}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}