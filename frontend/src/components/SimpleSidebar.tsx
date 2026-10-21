import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ArrowDown,
  ArrowUpDown,
  Package,
  Building,
  Clipboard,
  BarChart3,
  User as UserIcon,
  Settings,
  X,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Truck
} from "lucide-react"
import { User } from "../App"
import { ROLES_CONFIG, AppRole } from "../types/roles"
import { sortiesActionsStore } from "@/lib/sortiesActionsStore"

const navItems = [
  {
    title: "Tableau de Bord",
    icon: LayoutDashboard,
    key: "dashboard",
    description: "Vue d'ensemble"
  },
  {
    title: "Arrivée Matériel",
    icon: ArrowDown,
    key: "arrivee",
    description: "Réception en 4 étapes"
  },
  {
    title: "Journal Comptable",
    icon: BookOpen,
    key: "journal",
    description: "Registre officiel"
  },
  {
    title: "Mini-journal Direction",
    icon: BookOpen,
    key: "journalDirection",
    description: "Sorties remises de ma direction"
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
    title: "Affectations",
    icon: ArrowLeftRight,
    key: "affectations",
    description: "Affectations entre services"
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

  // Badge « Distribution » : total SERVEUR filtré (en_preparation +
  // signature 1 absente), lu dans le store partagé — le SEUL sondage de
  // l'app. Aucun intervalle local, aucun chargement du détail des ordres :
  // le menu tourne donc aussi quand l'onglet Distribution est fermé.
  const [sortiesCount, setSortiesCount] = useState(0)
  const [isLoadingCount, setIsLoadingCount] = useState(false)
  // Badge « Distribution » du CHEF LOGISTIQUE : total SERVEUR filtré
  // (signatures 1 et 2 posées, 3 absente) — requête dédiée du sondage partagé,
  // déclenchée uniquement quand ce rôle est monté.
  const [countAAutoriser, setCountAAutoriser] = useState<number | null>(null)
  const estLogistique = userRole === "logistique"

  useEffect(() => {
    if (!user) {
      setSortiesCount(0)
      setIsLoadingCount(false)
      setCountAAutoriser(null)
      return
    }
    const unsubscribe = sortiesActionsStore.subscribe((state) => {
      setSortiesCount(state.totalEnPreparation ?? 0)
      setIsLoadingCount(state.totalEnPreparation === null && !state.error)
      setCountAAutoriser(state.totalAAutoriser)
    })
    const libererSon = sortiesActionsStore.acquire({ autorisation: estLogistique })
    return () => {
      unsubscribe()
      libererSon()
    }
  }, [user, estLogistique])

  return (
    <div className={`cm-sidebar ${isMobile ? 'w-80' : 'w-72'} flex flex-col h-full`}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="cm-brand-mark">
              <Package className="h-5 w-5" />
            </span>
            <span className="cm-title text-base text-sidebar-foreground">ComptaMatière</span>
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
          Gestion d'Équipements
        </p>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto cm-scroll">
        <nav className="space-y-1">
          <p className="cm-eyebrow mb-3 px-3 text-sidebar-foreground/50">
            Navigation
          </p>
          {visibleItems.map((item) => {
            const IconComponent = item.icon
            const isActive = activeSection === item.key
            // Libellé propre au magasinier et au demandeur.
            const titreAffiche =
              item.key === "distribution" && userRole === "magasinier"
                ? "Préparation sorties"
                : item.key === "distribution" && userRole === "logistique"
                  ? "Autorisation sorties"
                  : item.key === "entries" && userRole === "demandeur"
                    ? "Réceptions"
                    : item.title
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
                  <div className="truncate font-medium">{titreAffiche}</div>
                  {item.description && (
                    <div className="text-xs text-sidebar-foreground/50 mt-0.5 truncate hidden sm:block">
                      {item.key === "requests" && user?.role === "demandeur"
                        ? "Gestion de mes demandes"
                        : item.key === "entries" && user?.role === "demandeur"
                          ? "Réceptions de votre direction"
                          : item.description}
                    </div>
                  )}
                  {/* Badge for Distribution menu item */}
                  {item.key === "distribution" && (
                    <span className="flex-shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white ms-2">
                      {estLogistique ? (
                        countAAutoriser !== null && countAAutoriser > 0 ? (
                          countAAutoriser
                        ) : null
                      ) : isLoadingCount ? (
                        <span className="animate-pulse">…</span>
                      ) : sortiesCount > 0 ? (
                        sortiesCount
                      ) : null}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* User Info */}
      <div className="p-3 sm:p-4 border-t border-sidebar-border">
        <div className="cm-panel-flat flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center flex-shrink-0">
            <UserIcon className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">
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