import { SimpleSidebar } from "./SimpleSidebar"
import { Dashboard } from "./Dashboard"
import { MaterialEntry } from "./MaterialEntry"
import { formatDelaiSync, useDerniereSync } from "../lib/lastSync"
import { Equipment } from "./Equipment"
import { Journal } from "./Journal"
import { Distribution } from "./Distribution"
import { Movements } from "./Movements"
import { Departments } from "./Departments"
import { Requests } from "./Requests"
import { EntriesPage } from "./EntriesPage"
import { AffectationsPage } from "./AffectationsPage"
import { ExitsPage } from "./ExitsPage"
import { EcranReception } from "./reception/EcranReception"
import { Reports } from "./Reports"
import { MiniJournalDirection } from "./MiniJournalDirection"
import { Users } from "./Users"
import { Settings } from "./Settings"
import { ThemeToggle } from "./ThemeToggle"
import { NotificationBell } from "./NotificationBell"
import { Menu, Shield, X, LogOut } from "lucide-react"
import logo from "../../assets/logo.png"
import { useState, useEffect } from "react"
import { User } from "../App"
import type { DemandeRecord } from "../lib/demandes"
import { ROLES_CONFIG, AppRole } from "../types/roles"
import { ErrorBoundary } from "./ErrorBoundary"

interface DashboardLayoutProps {
  user: User
  onLogout: () => void
  notificationVersion?: number
}

export function DashboardLayout({ user, onLogout, notificationVersion = 0 }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  // Horodatage RÉEL de la dernière relecture serveur réussie (alimenté par
  // l'écran Réception de Matériel) — le pied de page n'affichait qu'un « il y a
  // 2 min » écrit en dur, quel que soit l'état réel.
  const derniereSync = useDerniereSync()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("dashboard")
  const [isMobile, setIsMobile] = useState(false)
  // Lien « Demande associée » ouvert depuis la page Sorties
  const [requestDetailId, setRequestDetailId] = useState<number | null>(null)
  // Pièce à ouvrir dans l'écran Arrivée Matériel, demandée par un clic sur une
  // notification de la cloche du navbar (les 3 rôles du flux de réception).
  const [entreeCibleId, setEntreeCibleId] = useState<string | number | null>(null)
  // Demande APPROUVÉE à transformer en ordre de sortie (étape 3) : posée par
  // l'écran Décision (clic « Créer l'ordre de sortie »), elle ouvre la page
  // Distribution sur l'onglet « Ordres de sortie » avec le formulaire prérempli.
  const [ordreSortieDemande, setOrdreSortieDemande] = useState<DemandeRecord | null>(null)

  // Navigation programmatique depuis un écran (ex. PV de réception → journal).
  // Passée aux écrans via la prop onNavigate.

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
  // (admin : tout autorisé ; rôle "staff" : interface dédiée StaffDashboardLayout)
  useEffect(() => {
    const isAdmin = user.role === 'admin'
    const isStaff = user.role === 'staff'
    if (!isAdmin && !isStaff && roleConfig?.pages && !roleConfig.pages.includes(activeSection)) {
      setActiveSection("dashboard")
    }
  }, [user.role, roleConfig, activeSection])

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard user={user} />
      case "arrivee":
        return (
          <MaterialEntry
            user={user}
            onNavigate={handleSectionChange}
            entreeCibleId={entreeCibleId}
            onEntreeCibleConsumed={() => setEntreeCibleId(null)}
          />
        )
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
      case "journalDirection":
        return <MiniJournalDirection user={user} />
      case "equipment":
        return <Equipment user={user} />
      case "reception":
        return <EcranReception user={user} onNavigate={handleSectionChange} />
      case "distribution":
        return (
          <Distribution
            initialDemande={ordreSortieDemande}
            onInitialDemandeConsumed={() => setOrdreSortieDemande(null)}
          />
        )
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
            onCreerOrdreSortie={handleCreerOrdreSortie}
          />
        )
      case "reports":
        return <Reports user={user} />
      case "users":
        return <Users />
      case "settings":
        return <Settings />
      default:
        return <Dashboard user={user} />
    }
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section)
    // Une navigation classique invalide la pièce demandée par une notification :
    // l'utilisateur choisit librement son écran d'arrivée.
    setEntreeCibleId(null)
    // …ainsi que la demande en attente de transformation en ordre de sortie :
    // seul un clic sur « Créer l'ordre de sortie » doit ouvrir le formulaire
    // prérempli.
    setOrdreSortieDemande(null)
    if (section !== "requests") {
      setRequestDetailId(null)
    }
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  // Ouverture d'une pièce depuis une notification de la cloche du navbar : la
  // cible est posée AVANT le changement d'écran (handleSectionChange effacerait
  // toute cible), pour que l'écran Arrivée Matériel s'ouvre directement sur le
  // bon de livraison à traiter.
  const handleOuvrirNotification = (entreeId: string | number) => {
    setEntreeCibleId(entreeId)
    setActiveSection("arrivee")
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  // Étape 3 : le dépositaire clique sur « Créer l'ordre de sortie » dans
  // l'écran Décision → on ouvre Distribution sur l'onglet « Ordres de sortie »,
  // où le formulaire se préremplit avec la demande. La cible est posée AVANT le
  // changement d'écran (handleSectionChange l'effacerait).
  const handleCreerOrdreSortie = (demande: DemandeRecord) => {
    setOrdreSortieDemande(demande)
    setActiveSection("distribution")
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="cm-shell flex h-screen w-full">
      {/* Mobile Overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="cm-overlay fixed inset-0 z-40 lg:hidden"
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
        cm-sidebar-w
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
        <header className="cm-topbar flex items-center justify-between gap-3 p-3 sm:p-4 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                if (isMobile) {
                  setMobileMenuOpen(!mobileMenuOpen)
                } else {
                  setSidebarOpen(!sidebarOpen)
                }
              }}
              className="cm-btn-ghost inline-flex items-center justify-center h-9 w-9 rounded-lg transition-colors"
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
                <img src={logo} alt="Logo AssetTrack" style={{ width: "2rem", height: "2rem" }} />
                <span className="cm-title text-base hidden sm:inline">AssetTrack</span>
              </div>
            )}
          </div>

          {/* System Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compliance Status - Hidden on small screens */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 cm-badge cm-badge-accent">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Conforme 94%</span>
            </div>

            {/* User Info - Hidden on mobile */}
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {roleConfig?.label || (user.role === 'admin' ? 'Administrateur' : user.department)}
              </span>
            </div>

            {/* Notifications : actions en attente du rôle + informations. Un clic sur une
                notification de réception ouvre la pièce dans Arrivée Matériel ; une
                notification de sortie acceptée (dépositaire) ouvre Distribution. */}
            <NotificationBell
              user={user}
              version={notificationVersion}
              onOpenEntree={handleOuvrirNotification}
              onOpenSortie={() => handleSectionChange("distribution")}
            />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Logout */}
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-background transition-colors hover:bg-destructive hover:text-destructive-foreground"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Se déconnecter</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto cm-scroll">
          <ErrorBoundary
            title="Impossible de charger la page."
            message="Le module demandé n'a pas pu s'afficher. Réessayez ou revenez au tableau de bord."
            onRetry={() => setActiveSection("dashboard")}
          >
            {renderContent()}
          </ErrorBoundary>
        </main>

        {/* Status Bar - Hidden on mobile */}
        <footer className="cm-statusbar px-4 sm:px-6 py-2 shrink-0 hidden sm:block">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="cm-dot cm-dot-live" aria-hidden />
                <span>Connecté</span>
              </div>
              <div className="hidden md:block">
                Dernière sync : {formatDelaiSync(derniereSync)}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden lg:block">Version 1.0.0</div>
              <div className="hidden xl:block">© 2025 AssetTrack</div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
