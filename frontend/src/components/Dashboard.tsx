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
} from "lucide-react";
import { useState } from "react";
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
import {
  getDemandesForUser,
  getStatsDemandes,
  getActiviteDemandeur,
  getRepartitionDemandes,
} from "../lib/demandes";
import { mockEquipment } from "./Equipment";

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
function DemandeurDashboard({ user }: { user?: User }) {
  const demandes = getDemandesForUser(user);
  const stats = getStatsDemandes(demandes);
  const mesSorties = sortiesPerimetre(sortieRecords, user);
  const statsSorties = getStatistiquesSorties(mesSorties);

  // Matériels reçus (sorties effectuées dans mon périmètre)
  const materielsRecus = mesSorties
    .filter((s) => s.statut === "Sortie effectuée")
    .reduce((sum, s) => sum + (s.quantite || 0), 0);

  // Équipements disponibles dans le stock
  const equipementsDisponibles = mockEquipment.filter(
    (item) => item.status === "Disponible"
  ).length;

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
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
      foot: "Demandes de mon périmètre",
    },
    {
      label: "Demandes en attente",
      value: stats.enAttente,
      icon: Hourglass,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
      foot: "En attente de validation",
    },
    {
      label: "Demandes validées",
      value: stats.validees,
      icon: Check,
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
      foot: "Validées par le responsable",
    },
    {
      label: "Matériels reçus",
      value: materielsRecus,
      icon: Inbox,
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
      foot: "Unités reçues par mon service",
    },
    {
      label: "Sorties du mois",
      value: statsSorties.duMois,
      icon: ArrowUpFromLine,
      iconClass:
        "bg-indigo-100 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400",
      foot: statsSorties.moisLabel,
    },
    {
      label: "Équipements disponibles",
      value: equipementsDisponibles,
      icon: Package,
      iconClass:
        "bg-cyan-100 text-cyan-600 rounded-lg dark:bg-cyan-900/30 dark:text-cyan-400",
      foot: "Disponibles à la demande",
    },
    {
      label: "Entrées récentes",
      value: entreesRecentes,
      icon: ArrowDownToLine,
      iconClass:
        "bg-teal-100 text-teal-600 rounded-lg dark:bg-teal-900/30 dark:text-teal-400",
      foot: "Entrées consultables",
    },
    {
      label: "Alertes",
      value: alertes,
      icon: AlertTriangle,
      iconClass:
        "bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400",
      foot: "À traiter en priorité",
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">
          Tableau de Bord
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Vue d'ensemble de vos demandes, équipements et mouvements
        </p>
      </div>

      {/* Indicateurs */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-8 w-8 p-2 ${card.iconClass} flex-shrink-0`} />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    {card.label}
                  </div>
                  <div className="text-lg sm:text-xl text-card-foreground">
                    {card.value}
                  </div>
                  <div className="text-xs text-muted-foreground truncate hidden sm:block">
                    {card.foot}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activités récentes + état des demandes */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Mes activités récentes */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 sm:p-6 border-b border-border">
            <h3 className="text-base sm:text-lg text-card-foreground">
              Mes activités récentes
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
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
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 sm:p-6 border-b border-border">
            <h3 className="text-base sm:text-lg text-card-foreground">
              État de mes demandes
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
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

  // Fonctionnalité : espace dédié au profil Demandeur
  const isDemandeur = user?.role === "demandeur";
  if (isDemandeur) {
    return <DemandeurDashboard user={user} />;
  }
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

  const demandeurCards = [
    {
      label: "Mes demandes",
      value: mesDemandes.length,
      icon: Clipboard,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
      foot: "Demandes de mon périmètre",
    },
    {
      label: "Demandes en attente",
      value: mesDemandes.filter((r) => r.status === "En attente").length,
      icon: Hourglass,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
      foot: "En attente de validation",
    },
    {
      label: "Demandes validées",
      value: mesDemandes.filter((r) => r.status === "Approuvé").length,
      icon: Check,
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
      foot: "Validées par le responsable",
    },
    {
      label: "Mes dernières sorties",
      value: mesSorties.length,
      icon: ArrowUpFromLine,
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
      foot: "Sorties de mon service / direction",
    },
    {
      label: "Dernières entrées disponibles",
      value: entreesDisponibles.length,
      icon: ArrowDownToLine,
      iconClass:
        "bg-cyan-100 text-cyan-600 rounded-lg dark:bg-cyan-900/30 dark:text-cyan-400",
      foot: "Entrées vérifiées / validées",
    },
    {
      label: "Alertes importantes",
      value: 3,
      icon: AlertTriangle,
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
      <div>
        <h1 className="text-3xl tracking-tight mb-2 text-foreground">
          Tableau de Bord - ComptaMatière
        </h1>
        <p className="text-muted-foreground">
          Vue d'ensemble du système de comptabilité matière avec traçabilité
          complète
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Journal Entries */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">Entrées Journal</h3>
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-2xl text-card-foreground mb-2">1,247</div>
          <p className="text-xs text-muted-foreground">
            +12% ce mois | Conformité 98%
          </p>
        </div>

        {/* Total Value */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">Valeur Inventaire</h3>
            <Euro className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-2xl text-card-foreground mb-2">485.2K Ar</div>
          <p className="text-xs text-muted-foreground">Valorisation complète</p>
        </div>

        {/* In Stock */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">
              Matériels en Stock
            </h3>
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-2xl text-card-foreground mb-2">856</div>
          <p className="text-xs text-muted-foreground">
            Disponibles distribution
          </p>
        </div>

        {/* Compliance Score */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-muted-foreground">Score Conformité</h3>
            <Shield className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-2xl text-card-foreground mb-2">96%</div>
          <p className="text-xs text-muted-foreground">
            Audit &amp; Traçabilité
          </p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">Entrées Mois</div>
              <div className="text-xl text-card-foreground">124</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Fournisseurs</div>
              <div className="text-xl text-card-foreground">47</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Hash className="h-8 w-8 p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">Nomenclatures</div>
              <div className="text-xl text-card-foreground">89</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-sm text-muted-foreground">Alertes</div>
              <div className="text-xl text-card-foreground">3</div>
            </div>
          </div>
        </div>
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
                  className="bg-card border border-border rounded-lg p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-8 w-8 p-2 ${card.iconClass}`} />
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {card.label}
                      </div>
                      <div className="text-xl text-card-foreground">
                        {card.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {card.foot}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activité récente */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">Activité récente</h3>
          <p className="text-sm text-muted-foreground mt-1">
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
      <div className="bg-card border border-border rounded-lg shadow-sm">
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
