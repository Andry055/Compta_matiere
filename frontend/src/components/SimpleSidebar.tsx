import { useState, useEffect, useRef } from "react"
import { toast } from "sonner";
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
  Truck,
  PackageCheck
} from "lucide-react"
import logoMtefop from "../../assets/LogoMETFOP.png"
import logoAsset from "../../assets/logo.png"
import { User } from "../App"
import { ROLES_CONFIG, AppRole } from "../types/roles"
import { sortiesActionsStore } from "@/lib/sortiesActionsStore"
import {
  peutValiderTransfert,
  listerTransferts,
  fusionnerTransferts,
  clesAttendues,
  TransfertRecord,
} from "../lib/transferts"
import { fetchEntrees, fetchTransferts } from "../lib/api"
import { compterNotifications } from "../lib/notificationEtapes"

/** Rôles du circuit « Arrivée Matériel » : eux seuls reçoivent des pièces. */
const ROLES_ARRIVEE_MATERIEL: AppRole[] = [
  "magasinier",
  "logistique",
  "depositaire",
]
/** Libellé du rôle attendu, pour le pop-up. */
const ACTION_ARRIVEE: Record<string, string> = {
  magasinier: "à contrôler",
  logistique: "à signer (chef de service 2)",
  depositaire: "à valider (signature finale)",
}

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
    title: "Transferts",
    icon: ArrowLeftRight,
    key: "transferts",
    description: "Transferts entre services"
  },
  {
    title: "Sorties",
    icon: ArrowUpFromLine,
    key: "exits",
    description: "Suivi des sorties de matériels"
  },
,
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
  const [transfertsEnAttente, setTransfertsEnAttente] = useState(0)
  // Pièces « Arrivée Matériel » qui attendent UNE ACTION de ce rôle (contrôle
  // magasinier, signature logistique, validation dépositaire). Indicateur
  // d'ÉTAT dérivé du serveur, comme le compteur de transferts : il ne se
  // marque pas « lu », il se solde en traitant la pièce.
  const [arriveesEnAttente, setArriveesEnAttente] = useState(0)
  // Dernier compte connu, pour ne déclencher le pop-up que sur une NOUVELLE
  // pièce (le compteur augmente), jamais à chaque rafraîchissement.
  const dernierCompteArrivees = useRef<number | null>(null)

  // Fonctionnalité : filtrer les rubriques selon le rôle métier
  const userRole = (user?.role || 'depositaire') as AppRole
  const allowedPages = user?.role === 'admin'
    ? navItems.map((item) => item.key)
    : (ROLES_CONFIG[userRole]?.pages || navItems.map((item) => item.key))
  // La rubrique Distribution est retirée du menu de tous les rôles.
  const visibleItems = navItems.filter(
    (item) =>
      allowedPages.includes(item.key) &&
      item.key !== 'distribution'
  )

  const roleLabel =
    ROLES_CONFIG[userRole]?.label ||
    (user?.role === 'admin' ? 'Administrateur Système — données en consultation' : 'Personnel')

  useEffect(() => {
    const role = user?.role
    if (!user || (role !== "depositaire" && role !== "logistique")) {
      setTransfertsEnAttente(0)
      return
    }
    const cle = role === "depositaire" ? "depositaire" : "logistique"
    // On ne compte que les transferts réellement actionnables par ce rôle :
    // les validations précédentes du circuit doivent déjà être signées.
    const calculer = (serveur: TransfertRecord[]) => {
      const transferts = fusionnerTransferts(listerTransferts(), serveur)
      setTransfertsEnAttente(
        transferts.filter((a) => {
          if (!peutValiderTransfert(user, a, cle)) return false
          const ordre = clesAttendues(a)
          const rang = ordre.indexOf(cle)
          return (
            rang <= 0 || ordre.slice(0, rang).every((k) => a.validations[k])
          )
        }).length
      )
    }
    const recharger = () => {
      calculer([])
      fetchTransferts()
        .then((serveur) => calculer(serveur || []))
        .catch(() => calculer([]))
    }
    recharger()
    // Une signature posée dans un autre onglet rafraîchit le compteur.
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "appNotifications") recharger()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [user, activeSection])

  // Badge « Arrivée Matériel » : nombre de pièces que CE rôle doit traiter.
  //
  // Le compteur est DÉRIVÉ des entrées serveur (mêmes règles de routage que le
  // contrôleur : magasinier = pas encore contrôlée, logistique = contrôlée mais
  // pas signée, dépositaire = les deux signatures posées mais pas la sienne).
  // Il se met à jour à la navigation, au retour sur la fenêtre et par sondage :
  // les signatures des autres rôles n'émettent pas d'événement SSE.
  useEffect(() => {
    const role = user?.role as AppRole | undefined
    if (!user || !role || !ROLES_ARRIVEE_MATERIEL.includes(role)) {
      setArriveesEnAttente(0)
      dernierCompteArrivees.current = null
      return
    }
    let annule = false

    const recharger = async () => {
      const entrees = await fetchEntrees()
      // Backend injoignable : on garde le dernier compte connu plutôt que
      // d'afficher « 0 », qui serait un faux rassurant.
      if (annule || !entrees) return
      const nombre = compterNotifications(role, entrees)
      const precedent = dernierCompteArrivees.current
      if (precedent !== null && nombre > precedent) {
        toast.info(
          `${nombre} pièce(s) ${ACTION_ARRIVEE[role]} — Arrivée Matériel`,
          {
            id: "arrivee-materiel",
            description:
              "Une nouvelle pièce vient d'entrer dans votre file de traitement.",
          }
        )
      }
      dernierCompteArrivees.current = nombre
      setArriveesEnAttente(nombre)
    }

    recharger()
    const minuteur = window.setInterval(recharger, 30000)
    window.addEventListener("focus", recharger)
    return () => {
      annule = true
      window.clearInterval(minuteur)
      window.removeEventListener("focus", recharger)
    }
  }, [user?.id, user?.role, activeSection])

  return (
    <div className="cm-sidebar w-full flex flex-col h-full">
      {/* En-tête de marque : logo MTEFoP | icône AssetTrack + titre */}
      <div className="cm-brand-header">
        <a
          className="cm-brand"
          href="#dashboard"
          onClick={(event) => {
            // SPA sans routeur : renvoie à l'accueil sans recharger la page.
            event.preventDefault()
            onSectionChange("dashboard")
          }}
        >
          <img className="cm-brand-logo" src={logoMtefop} alt="Logo MTEFoP" />
          <span className="cm-brand-sep" aria-hidden="true" />
          <img className="cm-brand-icon" src={logoAsset} alt="Icône AssetTrack" />
          <span className="cm-brand-text">
            <span className="cm-brand-title">
              Asset<span className="cm-brand-title-accent">Track</span>
            </span>
            <span className="cm-brand-sub">
              Système de Gestion et de Traçabilité des Matériels
            </span>
          </span>
        </a>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-sidebar-accent text-sidebar-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
                  <div className="flex items-center gap-2">
                    <div className="truncate font-medium">{titreAffiche}</div>
                    {/* Badge « Transferts » : nombre en attente de MA validation */}
                    {item.key === "transferts" && transfertsEnAttente > 0 && (
                      <span className="flex-shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                        {transfertsEnAttente}
                      </span>
                    )}
                    {/* Badge « Arrivée Matériel » : pièces qui attendent MON action
                        (contrôle magasinier, signature logistique, validation dépositaire). */}
                    {item.key === "arrivee" && arriveesEnAttente > 0 && (
                      <span className="flex-shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                        {arriveesEnAttente}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <div className="text-xs text-sidebar-foreground/50 mt-0.5 truncate hidden sm:block">
                      {item.key === "requests" && user?.role === "demandeur"
                        ? "Gestion de mes demandes"
                        : item.key === "entries" && user?.role === "demandeur"
                          ? "Réceptions de votre direction"
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