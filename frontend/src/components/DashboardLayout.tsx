import { SimpleSidebar } from "./SimpleSidebar"
import { Dashboard } from "./Dashboard"
import { Equipment } from "./Equipment"
import { Journal } from "./Journal"
import { Distribution } from "./Distribution"
import { Movements } from "./Movements"
import { Departments } from "./Departments"
import { Requests } from "./Requests"
import { EntriesPage } from "./EntriesPage"
import { AffectationsPage } from "./AffectationsPage"
import { ExitsPage } from "./ExitsPage"
import { Reports } from "./Reports"
import { Users } from "./Users"
import { Settings } from "./Settings"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { Menu, Package, Shield, Wifi, Check, X, LogOut } from "lucide-react"
import { useState, useEffect } from "react"
import { User } from "../App"
import { ROLES_CONFIG, AppRole } from "../types/roles"
import { ErrorBoundary } from "./ErrorBoundary"

interface DashboardLayoutProps {
  user: User
  onLogout: () => void
}

export function DashboardLayout({ user, onLogout }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("dashboard")
  const [isMobile, setIsMobile] = useState(false)
  // Lien « Demande associée » ouvert depuis la page Sorties
  const [requestDetailId, setRequestDetailId] = useState<number | null>(null)

  // Fonctionnalité : config du rôle connecté
  const userRole = (user.role || 'depositaire') as AppRole
  const roleConfig = ROLES_CONFIG[userRole]

  // Detect mobile screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Fonctionnalité : si la section active n'est pas autorisée pour ce rôle, revenir au tableau de bord
  useEffect(() => {
    if (user.role !== 'admin' && roleConfig?.pages && !roleConfig.pages.includes(activeSection)) {
      setActiveSection("dashboard")
    }
  }, [user.role, roleConfig, activeSection])

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard user={user} />
      case "entries":
        return <EntriesPage user={user} />
      case "affectations":
        return <AffectationsPage user={user} />
      case "exits":
        return (
          <ExitsPage
            user={user}
            onViewRequest={(id) => {
              setRequestDetailId(id)
              setActiveSection("requests")
            }}
          />
        )
      case "journal":
        return <Journal />
      case "equipment":
        return <Equipment user={user} />
      case "distribution":
        return <Distribution />
      case "movements":
        return <Movements />
      case "departments":
        return <Departments />
      case "requests":
        return (
          <Requests
            user={user}
            detailRequestId={requestDetailId ?? undefined}
            onDetailConsumed={() => setRequestDetailId(null)}
          />
        )
      case "reports":
        return <Reports user={user} />
      case "users":
        return <Users />
      case "settings":
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
    if (section !== "requests") {
      setRequestDetailId(null)
    }
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${isMobile ? 'fixed' : 'relative'}
        ${isMobile && !mobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
        ${isMobile ? 'z-50' : ''}
        ${!isMobile && !sidebarOpen ? '-translate-x-full' : ''}
        transition-transform duration-300 ease-in-out
        ${isMobile ? 'w-80' : ''}
      `}>
        <SimpleSidebar 
          activeSection={activeSection} 
          onSectionChange={handleSectionChange}
          user={user}
          isMobile={isMobile}
          onClose={() => setMobileMenuOpen(false)}
        />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between p-3 sm:p-4 border-b border-border bg-background shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileMenuOpen(!mobileMenuOpen)
                } else {
                  setSidebarOpen(!sidebarOpen)
                }
              }}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {isMobile && mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
              <span className="sr-only">Toggle sidebar</span>
            </button>
            {(!sidebarOpen || isMobile) && (
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="text-foreground hidden sm:inline">ComptaMatière</span>
              </div>
            )}
          </div>

          {/* System Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compliance Status - Hidden on small screens */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-700 dark:text-blue-300">
                Conforme 94%
              </span>
            </div>

            {/* User Info - Hidden on mobile */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm text-foreground">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {roleConfig?.label || (user.role === 'admin' ? 'Administrateur' : user.department)}
              </span>
            </div>

            {/* Notifications (compteur des non lues) */}
            <NotificationBell user={user} />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Logout */}
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-destructive hover:text-destructive-foreground transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Se déconnecter</span>
            </button>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary
            title="Impossible de charger la page."
            message="Le module demandé n'a pas pu s'afficher. Réessayez ou revenez au tableau de bord."
            onRetry={() => setActiveSection("dashboard")}
          >
            {renderContent()}
          </ErrorBoundary>
        </main>

        {/* Status Bar - Hidden on mobile */}
        <footer className="border-t border-border bg-background px-4 sm:px-6 py-2 shrink-0 hidden sm:block">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Wifi className="h-3 w-3 text-green-600" />
                <span>Connecté</span>
              </div>
              <div className="hidden md:block">Dernière sync: Il y a 2 min</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:block">Version 1.0.0</div>
              <div className="hidden xl:block">© 2025 ComptaMatière - Gestion Centralisée</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
