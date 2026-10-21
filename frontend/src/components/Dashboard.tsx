import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Building,
  Clipboard,
  Shield,
  Calendar,
  Users,
  Eye,
  Check,
  X,
  Clock,
  FileText,
  ChevronRight,
  BookOpen,
  Euro,
  BarChart3,
  Hash,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Inbox,
  Hourglass,
  ClipboardCheck,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { User } from "../App";
import { AllEquipmentModal } from "./AllEquipmentModal";
import { mockRequests } from "../lib/requests";
import {
  entreeRecords,
  sortieRecords,
  getRecentActivity,
  getStatistiquesSorties,
  sortiesPerimetre,
  getStatutEntreeAffiche,
  ActivityItem,
} from "../lib/movements";
import { Message } from "./ui/message";
import {
  getDemandesForUser,
  getStatsDemandes,
  getActiviteDemandeur,
  getRepartitionDemandes,
} from "../lib/demandes";
import { MaterialOption } from "../lib/api";
import {
  useMaterialsLive,
  UseMaterialsLiveResult,
} from "../lib/useMaterialsLive";
import { formatDelaiSyncExact } from "../lib/lastSync";
import { Button } from "./ui/button";

interface JournalMovement {
  id: number;
  numeroOrdre: string;
  designation: string;
  pieceJustificative: string;
  origine: string;
  valeurTotale: number;
  statut: "en_stock" | "distribue" | "maintenance" | "reforme";
  dateEntree: string;
  espece: string;
  nomenclature: string;
}

const mockJournalMovements: JournalMovement[] = [
  {
    id: 1,
    numeroOrdre: "2024-001",
    designation: "Ordinateur portable professionnel",
    pieceJustificative: "BC-2024-015",
    origine: "TechnoFournisseur SARL",
    valeurTotale: 6000,
    statut: "en_stock",
    dateEntree: "2024-01-15",
    espece: "Informatique",
    nomenclature: "INFO-001",
  },
  {
    id: 2,
    numeroOrdre: "2024-002",
    designation: "Imprimante laser couleur",
    pieceJustificative: "BC-2024-016",
    origine: "Bureau Solutions",
    valeurTotale: 900,
    statut: "distribue",
    dateEntree: "2024-01-16",
    espece: "Bureautique",
    nomenclature: "BUR-002",
  },
  {
    id: 3,
    numeroOrdre: "2024-003",
    designation: "Téléphones IP Cisco",
    pieceJustificative: "DON-2024-001",
    origine: "Donation Entreprise Partenaire",
    valeurTotale: 1800,
    statut: "en_stock",
    dateEntree: "2024-01-17",
    espece: "Communication",
    nomenclature: "COMM-001",
  },
  {
    id: 4,
    numeroOrdre: "2024-004",
    designation: "Écrans Dell UltraSharp 24 pouces",
    pieceJustificative: "BC-2024-017",
    origine: "Digital Store",
    valeurTotale: 2560,
    statut: "en_stock",
    dateEntree: "2024-01-18",
    espece: "Informatique",
    nomenclature: "INFO-003",
  },
];

function getActivityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "demande":
      return Clipboard;
    case "validation":
      return ClipboardCheck;
    case "preparation":
      return Inbox;
    case "sortie":
      return ArrowUpFromLine;
    case "entree":
    default:
      return ArrowDownToLine;
  }
}

// ---------------------------------------------------------------------------
// Espace Demandeur : vue d'ensemble de SES demandes, équipements et mouvements
// ---------------------------------------------------------------------------
function DemandeurDashboard({
  user,
  live,
}: {
  user?: User;
  /** Stock réel lu par le hook partagé useMaterialsLive (UN SEUL appel par écran). */
  live: UseMaterialsLiveResult;
}) {
  const demandes = getDemandesForUser(user);
  const stats = getStatsDemandes(demandes);
  const mesSorties = sortiesPerimetre(sortieRecords, user);
  const statsSorties = getStatistiquesSorties(mesSorties);

  // Stock RÉEL alimenté en quasi temps réel par le hook partagé useMaterialsLive
  const {
    materials: materiels,
    isInitialError,
    isRefreshing,
    messageErreur,
    derniereSync,
    refresh,
  } = live;

  // Matériels reçus (sorties effectuées dans mon périmètre)
  const materielsRecus = mesSorties
    .filter((s) => s.statut === "Sortie effectuée")
    .reduce((sum, s) => sum + (s.quantite || 0), 0);

  // Équipements disponibles dans le stock : total des quantités des matériels
  // réellement en stock
  const equipementsDisponibles = materiels
    .filter((m) => (m.statut ?? "en_stock") === "en_stock")
    .reduce((somme, m) => somme + (m.quantiteStock ?? 0), 0);

  // Entrées récentes consultables (signées / en cours de signature)
  const entreesRecentes = entreeRecords.filter((e) => {
    const statut = getStatutEntreeAffiche(e);
    return statut === "Validée" || statut === "Partiellement signée";
  }).length;

  // Alertes : demandes en attente + entrées rejetées
  const alertes =
    stats.enAttente +
    entreeRecords.filter((e) => getStatutEntreeAffiche(e) === "Rejetée")
      .length;

  const activites = getActiviteDemandeur(demandes, mesSorties);
  const repartition = getRepartitionDemandes(demandes);

  const cards = [
    {
      label: "Mes demandes",
      value: stats.total,
      icon: Clipboard,
      kpiAccent: "oklch(0.62 0.19 258)",
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
      foot: "Demandes de mon périmètre",
    },
    {
      label: "Demandes en attente",
      value: stats.enAttente,
      icon: Hourglass,
      kpiAccent: "oklch(0.7 0.19 45)",
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
      foot: "En attente de validation",
    },
    {
      label: "Demandes validées",
      value: stats.validees,
      icon: Check,
      kpiAccent: "oklch(0.68 0.17 150)",
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
      foot: "Validées par le responsable",
    },
    {
      label: "Matériels reçus",
      value: materielsRecus,
      icon: Inbox,
      kpiAccent: "oklch(0.6 0.22 300)",
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
      foot: "Unités reçues par mon service",
    },
    {
      label: "Sorties du mois",
      value: statsSorties.duMois,
      icon: ArrowUpFromLine,
      kpiAccent: "oklch(0.55 0.21 272)",
      iconClass:
        "bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400",
      foot: statsSorties.moisLabel,
    },
    {
      label: "Équipements disponibles",
      value: equipementsDisponibles,
      icon: Package,
      kpiAccent: "oklch(0.66 0.15 210)",
      iconClass:
        "bg-cyan-100 text-cyan-600 rounded-lg dark:bg-cyan-900/30 dark:text-cyan-400",
      foot: "Disponibles à la demande",
    },
    {
      label: "Entrées récentes",
      value: entreesRecentes,
      icon: ArrowDownToLine,
      kpiAccent: "oklch(0.65 0.13 185)",
      iconClass:
        "bg-teal-100 text-teal-600 rounded-lg dark:bg-teal-900/30 dark:text-teal-400",
      foot: "Entrées consultables",
    },
    {
      label: "Alertes",
      value: alertes,
      icon: AlertTriangle,
      kpiAccent: "oklch(0.62 0.21 25)",
      iconClass:
        "bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400",
      foot: "À traiter en priorité",
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {(messageErreur || isInitialError) && (
        <Message variant="warning">
          {messageErreur ||
            "Stock momentanément indisponible (serveur injoignable) — l'indicateur « Équipements disponibles » est incomplet."}
        </Message>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="cm-eyebrow cm-eyebrow-accent mb-1.5">Pilotage</p>
          <h1 className="cm-title text-2xl sm:text-3xl mb-2">
            Tableau de Bord
          </h1>
          <p className="cm-subtitle text-sm sm:text-base">
            Vue d'ensemble de vos demandes, équipements et mouvements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {derniereSync
              ? formatDelaiSyncExact(derniereSync)
              : "Non synchronisé"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="cm-kpi"
              style={
                { ["--cm-kpi-accent" as string]: card.kpiAccent } as CSSProperties
              }
            >
              <div className="flex items-start gap-3">
                <span className="cm-kpi-icon">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="cm-kpi-body">
                  <span className="cm-metric-label truncate">{card.label}</span>
                  <span className="cm-kpi-value">{card.value}</span>
                  <span className="cm-kpi-foot text-xs text-muted-foreground truncate hidden sm:block">
                    {card.foot}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activités récentes + état des demandes */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Mes activités récentes */}
        <div className="lg:col-span-2 cm-panel cm-panel-solid rounded-lg">
          <div className="p-4 sm:p-6 border-b border-border">
            <h3 className="cm-title text-base sm:text-lg">
              Mes activités récentes
            </h3>
            <p className="cm-subtitle mt-1">
              Dernières demandes, validations et sorties de mon périmètre
            </p>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {activites.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucune activité récente.
              </div>
            ) : (
              activites.map((item, index) => {
                const Icon = getActivityIcon(item.type);
                return (
                  <div key={index} className="flex items-start gap-3">
                    <Icon className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-card-foreground">
                          {item.label}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.detail}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* État de mes demandes */}
        <div className="cm-panel cm-panel-solid rounded-lg">
          <div className="p-4 sm:p-6 border-b border-border">
            <h3 className="cm-title text-base sm:text-lg">
              État de mes demandes
            </h3>
            <p className="cm-subtitle mt-1">
              Répartition par statut
            </p>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {repartition.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Aucune demande pour le moment.
              </div>
            ) : (
              repartition.map((row) => (
                <div key={row.statut}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-card-foreground">{row.statut}</span>
                    <span className="text-muted-foreground">
                      {row.count} ({row.percent}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all`}
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ user }: { user?: User }) {
  const [showAllEquipmentModal, setShowAllEquipmentModal] = useState(false);

  // Stock RÉEL : UN SEUL hook partagé, appelé SANS CONDITION — un retour
  // anticipé placé avant un hook violerait la règle des hooks React (l'arbre
  // casserait si le rôle de l'utilisateur changeait entre deux rendus).
  const live = useMaterialsLive();
  const {
    materials: materiels,
    isInitialError,
    isRefreshing,
    messageErreur,
    derniereSync,
    refresh,
  } = live;

  // Fonctionnalité : espace dédié au profil Demandeur
  const isDemandeur = user?.role === "demandeur";
  if (isDemandeur) {
    return <DemandeurDashboard user={user} live={live} />;
  }

  // Matériels en stock recalculés sur les mêmes données réelles que Equipment.tsx
  const materielsEnStock = materiels
    .filter((m) => (m.statut ?? "en_stock") === "en_stock")
    .reduce((somme, m) => somme + (m.quantiteStock ?? 0), 0);

  // Valeur totale inventaire calculée sur les matériels réels
  const valeurInventaire = materiels.reduce(
    (somme, m) => somme + (m.valeurUnitaire ?? 0) * (m.quantiteStock ?? 1),
    0
  );

  const mesDemandes =
    isDemandeur && user?.department
      ? mockRequests.filter((request) => request.department === user.department)
      : mockRequests;
  const mesSorties = isDemandeur
    ? sortieRecords.filter(
        (sortie) =>
          sortie.dansMonPerimetre || sortie.demandeur === user?.name
      )
    : sortieRecords;
  const entreesDisponibles = entreeRecords.filter(
    (entry) => entry.statut === "Validée" || entry.statut === "Vérifiée"
  );
  const recentActivity = getRecentActivity(mockRequests);

  // Indicateurs de pilotage : chaque carte porte son propre accent coloré,
  // appliqué par variable CSS (--cm-kpi-accent) — jamais un aplat saturé.
  const indicateurs = [
    {
      label: "Entrées Journal",
      value: "1,247",
      icon: BookOpen,
      kpiAccent: "oklch(0.62 0.19 258)",
      foot: "+12% ce mois | Conformité 98%",
    },
    {
      label: "Valeur Inventaire",
      value: `${valeurInventaire.toLocaleString()} Ar`,
      icon: Euro,
      kpiAccent: "oklch(0.66 0.15 210)",
      foot: "Valorisation complète",
    },
    {
      label: "Matériels en Stock",
      value: String(materielsEnStock),
      icon: Package,
      kpiAccent: "oklch(0.68 0.17 150)",
      foot: "Disponibles distribution",
    },
    {
      label: "Score Conformité",
      value: "96%",
      icon: Shield,
      kpiAccent: "oklch(0.7 0.19 45)",
      foot: "Audit & Traçabilité",
    },
  ];

  // Indicateurs secondaires : même grammaire, densité réduite.
  const indicateursSecondaires = [
    {
      label: "Entrées Mois",
      value: "124",
      icon: TrendingUp,
      kpiAccent: "oklch(0.68 0.17 150)",
    },
    {
      label: "Fournisseurs",
      value: "47",
      icon: Building,
      kpiAccent: "oklch(0.62 0.19 258)",
    },
    {
      label: "Nomenclatures",
      value: "89",
      icon: Hash,
      kpiAccent: "oklch(0.6 0.22 300)",
    },
    {
      label: "Alertes",
      value: "3",
      icon: AlertTriangle,
      kpiAccent: "oklch(0.7 0.19 45)",
    },
  ];

  const demandeurCards = [
    {
      label: "Mes demandes",
      value: mesDemandes.length,
      icon: Clipboard,
      kpiAccent: "oklch(0.62 0.19 258)",
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
      foot: "Demandes de mon périmètre",
    },
    {
      label: "Demandes en attente",
      value: mesDemandes.filter((r) => r.status === "En attente").length,
      icon: Hourglass,
      kpiAccent: "oklch(0.7 0.19 45)",
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
      foot: "En attente de validation",
    },
    {
      label: "Demandes validées",
      value: mesDemandes.filter((r) => r.status === "Approuvé").length,
      icon: Check,
      kpiAccent: "oklch(0.68 0.17 150)",
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
      foot: "Validées par le responsable",
    },
    {
      label: "Mes dernières sorties",
      value: mesSorties.length,
      icon: ArrowUpFromLine,
      kpiAccent: "oklch(0.6 0.22 300)",
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
      foot: "Sorties de mon service / direction",
    },
    {
      label: "Dernières entrées disponibles",
      value: entreesDisponibles.length,
      icon: ArrowDownToLine,
      kpiAccent: "oklch(0.66 0.15 210)",
      iconClass:
        "bg-cyan-100 text-cyan-600 rounded-lg dark:bg-cyan-900/30 dark:text-cyan-400",
      foot: "Entrées vérifiées / validées",
    },
    {
      label: "Alertes importantes",
      value: 3,
      icon: AlertTriangle,
      kpiAccent: "oklch(0.62 0.21 25)",
      iconClass:
        "bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400",
      foot: "À traiter en priorité",
    },
  ];

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case "en_stock":
        return "text-green-600 dark:text-green-400";
      case "distribue":
        return "text-blue-600 dark:text-blue-400";
      case "maintenance":
        return "text-orange-600 dark:text-orange-400";
      case "reforme":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getStatutIcon = (statut: string) => {
    switch (statut) {
      case "en_stock":
        return <Package className="h-3 w-3 text-green-600" />;
      case "distribue":
        return <TrendingUp className="h-3 w-3 text-blue-600" />;
      case "maintenance":
        return <AlertTriangle className="h-3 w-3 text-orange-600" />;
      case "reforme":
        return <X className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-gray-600" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="cm-eyebrow cm-eyebrow-accent mb-1.5">Pilotage</p>
          <h1 className="cm-title text-2xl sm:text-3xl mb-2">
            Tableau de Bord - ComptaMatière
          </h1>
          <p className="cm-subtitle">
            Vue d'ensemble du système de comptabilité matière avec traçabilité
            complète
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground hidden lg:inline whitespace-nowrap">
            {derniereSync
              ? formatDelaiSyncExact(derniereSync)
              : "Non synchronisé"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Rafraîchir
          </Button>
        </div>
      </div>

      {(messageErreur || isInitialError) && (
        <Message variant="warning">
          {messageErreur ||
            "Stock momentanément indisponible (serveur injoignable) — indicateurs de stock incomplets."}
        </Message>
      )}

      {/* Key Metrics Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {indicateurs.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="cm-kpi"
              style={
                { ["--cm-kpi-accent" as string]: card.kpiAccent } as CSSProperties
              }
            >
              <div className="flex items-start gap-3">
                <span className="cm-kpi-icon">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="cm-kpi-body">
                  <span className="cm-metric-label truncate">{card.label}</span>
                  <span className="cm-kpi-value">{card.value}</span>
                  <span className="cm-kpi-foot text-xs text-muted-foreground truncate hidden sm:block">
                    {card.foot}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {indicateursSecondaires.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="cm-kpi cm-kpi-compact"
              style={
                { ["--cm-kpi-accent" as string]: card.kpiAccent } as CSSProperties
              }
            >
              <div className="flex items-center gap-3">
                <span className="cm-kpi-icon">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="cm-kpi-body">
                  <span className="cm-metric-label truncate">{card.label}</span>
                  <span className="cm-kpi-value text-xl">{card.value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Espace Demandeur */}
      {isDemandeur && (
        <div>
          <div className="mb-3">
            <h3 className="text-lg text-card-foreground">Mon espace Demandeur</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Le suivi de mes demandes, sorties et alertes
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {demandeurCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="cm-kpi"
                  style={
                    { ["--cm-kpi-accent" as string]: card.kpiAccent } as CSSProperties
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="cm-kpi-icon">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="cm-kpi-body">
                      <span className="cm-metric-label truncate">{card.label}</span>
                      <span className="cm-kpi-value">{card.value}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {card.foot}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activité récente */}
      <div className="cm-panel cm-panel-solid rounded-lg">
        <div className="p-6 border-b border-border">
          <h3 className="cm-title text-lg">Activité récente</h3>
          <p className="cm-subtitle mt-1">
            Demandes créées et validées, matériels préparés, sorties
            effectuées et dernières entrées enregistrées
          </p>
        </div>
        <div className="p-6 space-y-4">
          {recentActivity.map((item, index) => {
            const Icon = getActivityIcon(item.type);
            return (
              <div key={index} className="flex items-start gap-3">
                <Icon className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-card-foreground">
                      {item.label}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.detail}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Journal Entries with Enhanced Traceability */}
      <div className="cm-panel cm-panel-solid rounded-lg">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg text-card-foreground">
                Dernières Entrées Journal
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Mouvements récents avec pièces justificatives et traçabilité
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllEquipmentModal(true)}
                className="group relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-sm"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <BookOpen className="h-4 w-4 group-hover:rotate-12 transition-transform duration-200" />
                <span className="relative font-medium">Journal Complet</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                <div className="absolute inset-0 border border-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    N° Ordre
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Désignation
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    P.J.
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Origine
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Espèce
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Valeur
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {mockJournalMovements.map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-card-foreground font-mono">
                      {movement.numeroOrdre}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[200px] truncate">
                      {movement.designation}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground font-mono">
                      {movement.pieceJustificative}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[150px] truncate">
                      {movement.origine}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {movement.espece}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground font-semibold">
                      {movement.valeurTotale.toLocaleString()}Ar
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {getStatutIcon(movement.statut)}
                        <span
                          className={`text-xs capitalize ${getStatutColor(
                            movement.statut
                          )}`}
                        >
                          {movement.statut.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {new Date(movement.dateEntree).toLocaleDateString(
                        "fr-FR"
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors">
                        <BarChart3 className="h-3 w-3" />
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* All Equipment Modal */}
      <AllEquipmentModal
        isOpen={showAllEquipmentModal}
        onClose={() => setShowAllEquipmentModal(false)}
      />
    </div>
  );
}
