import { useMemo, useState } from "react"
import { BarChart3, Download, FileText, Calendar, Filter, Search, TrendingUp, Package, ArrowUpDown, Users, Clipboard, Eye, Printer, Inbox, ArrowDownToLine, X } from "lucide-react"
import { User } from "../App"
import {
  getDemandesForUser,
  STATUTS_DEMANDE,
  materielsDemande,
  quantiteDemande,
  formatDateCourt,
  splitDepartementDemandeur,
} from "../lib/demandes"
import {
  entreeRecords,
  sortieRecords,
  sortiesPerimetre,
  getStatutEntreeAffiche,
  getReferenceDate,
} from "../lib/movements"

interface ReportData {
  id: string;
  name: string;
  type: "Mouvements" | "Équipements" | "Utilisateurs" | "Directions";
  description: string;
  lastGenerated: string;
  records: number;
  format: string[];
}

const availableReports: ReportData[] = [
  {
    id: "movements",
    name: "Rapport des Mouvements",
    type: "Mouvements",
    description: "Liste complète des entrées et sorties d'équipements",
    lastGenerated: "2025-01-20 14:30",
    records: 156,
    format: ["PDF", "Excel", "CSV"],
  },
  {
    id: "equipment",
    name: "Inventaire des Équipements",
    type: "Équipements",
    description: "Registre complet de tous les équipements avec statut",
    lastGenerated: "2025-01-20 09:15",
    records: 4156,
    format: ["PDF", "Excel", "CSV"],
  },
  {
    id: "users",
    name: "Rapport Utilisateurs",
    type: "Utilisateurs",
    description: "Liste des utilisateurs actifs et leurs permissions",
    lastGenerated: "2025-01-19 16:45",
    records: 156,
    format: ["PDF", "Excel"],
  },
  {
    id: "departments",
    name: "Structure Organisationnelle",
    type: "Directions",
    description: "Organisation des directions et affectations",
    lastGenerated: "2025-01-18 11:20",
    records: 12,
    format: ["PDF", "Excel"],
  },
  {
    id: "movements-monthly",
    name: "Mouvements Mensuels",
    type: "Mouvements",
    description: "Synthèse des mouvements par mois",
    lastGenerated: "2025-01-01 08:00",
    records: 847,
    format: ["PDF", "Excel", "CSV"],
  },
  {
    id: "equipment-value",
    name: "Valorisation des Équipements",
    type: "Équipements",
    description: "Rapport de valorisation et amortissement",
    lastGenerated: "2025-01-15 14:20",
    records: 4156,
    format: ["PDF", "Excel"],
  },
];

export function Reports({ user }: { user?: User }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("Tous")
  const [dateRange, setDateRange] = useState("30")
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

  // Espace Demandeur : rapports autorisés par le rôle
  if (user?.role === "demandeur") {
    return <DemandeurReports user={user} />
  }

  const filteredReports = availableReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "Tous" || report.type === typeFilter
    return matchesSearch && matchesType
  })

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Mouvements":
        return ArrowUpDown;
      case "Équipements":
        return Package;
      case "Utilisateurs":
        return Users;
      case "Directions":
        return BarChart3;
      default:
        return FileText;
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Mouvements":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Équipements":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Utilisateurs":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "Directions":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  }

  const handleExport = (reportId: string, format: string) => {
    // Simulation d'export
    console.log(`Exporting ${reportId} in ${format} format`)
    alert(`Export du rapport en ${format} démarré...`)
  }

  const totalReports = availableReports.length
  const recentReports = availableReports.filter(r => {
    const lastGen = new Date(r.lastGenerated)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - lastGen.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 7
  }).length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Rapports et Exports
          </h1>
          <p className="text-muted-foreground">
            Génération et export des rapports système
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <FileText className="h-4 w-4" />
          Rapport Personnalisé
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Rapports Disponibles
              </div>
              <div className="text-xl text-card-foreground">{totalReports}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Générés cette semaine
              </div>
              <div className="text-xl text-card-foreground">
                {recentReports}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Enregistrements
              </div>
              <div className="text-xl text-card-foreground">
                {availableReports
                  .reduce((sum, report) => sum + report.records, 0)
                  .toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Download className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Exports ce mois
              </div>
              <div className="text-xl text-card-foreground">47</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4">Actions Rapides</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => handleExport("movements", "PDF")}
            className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <ArrowUpDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="text-left">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                Mouvements Aujourd'hui
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                Export PDF
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport("equipment", "Excel")}
            className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div className="text-left">
              <div className="text-sm text-green-900 dark:text-green-100">
                Inventaire Complet
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Export Excel
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport("users", "PDF")}
            className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
          >
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div className="text-left">
              <div className="text-sm text-purple-900 dark:text-purple-100">
                Liste Utilisateurs
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">
                Export PDF
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport("departments", "Excel")}
            className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
          >
            <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div className="text-left">
              <div className="text-sm text-orange-900 dark:text-orange-100">
                Organigramme
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-400">
                Export Excel
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un rapport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous les types</option>
              <option value="Mouvements">Mouvements</option>
              <option value="Équipements">Équipements</option>
              <option value="Utilisateurs">Utilisateurs</option>
              <option value="Directions">Directions</option>
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">Cette année</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Rapports Disponibles ({filteredReports.length})
          </h3>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReports.map((report) => {
              const IconComponent = getTypeIcon(report.type);
              return (
                <div
                  key={report.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <IconComponent className="h-5 w-5 mt-1 text-primary" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm text-card-foreground truncate">
                        {report.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getTypeColor(
                        report.type
                      )}`}
                    >
                      {report.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {report.records.toLocaleString()} enregistrements
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground mb-3">
                    Dernière génération: {report.lastGenerated}
                  </div>

                  <div className="flex items-center gap-2">
                    {report.format.map((format) => (
                      <button
                        key={format}
                        onClick={() => handleExport(report.id, format)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Espace Demandeur : rapports auxquels le rôle donne accès
// ---------------------------------------------------------------------------

interface DemandeurReportDef {
  id: string;
  name: string;
  description: string;
  type: "Demandes" | "Sorties" | "Mouvements" | "Statistiques";
}

const DEMANDEUR_REPORTS: DemandeurReportDef[] = [
  {
    id: "mes-demandes",
    name: "Historique de mes demandes",
    description: "Toutes mes demandes de matériel avec statut et priorité",
    type: "Demandes",
  },
  {
    id: "mes-sorties",
    name: "Historique de mes sorties",
    description: "Sorties liées à mes demandes et à mon service",
    type: "Sorties",
  },
  {
    id: "materiels-recus",
    name: "Matériels reçus",
    description: "Matériel effectivement remis à mon service",
    type: "Sorties",
  },
  {
    id: "mouvements-service",
    name: "Mouvements de mon service",
    description: "Entrées accessibles et sorties de mon périmètre",
    type: "Mouvements",
  },
  {
    id: "statistiques",
    name: "Statistiques de mon service",
    description: "Synthèse des indicateurs de mon périmètre",
    type: "Statistiques",
  },
];

interface DemandeurReportRow {
  reference: string;
  type?: string;
  date: string;
  materiel: string;
  categorie: string;
  quantite: number;
  direction: string;
  service: string;
  beneficiaire?: string;
  priorite?: string;
  statut: string;
}

/** Lignes brutes d'un rapport (données réelles de l'application) */
function buildBaseRows(
  reportId: string | null,
  demandes: ReturnType<typeof getDemandesForUser>,
  sorties: ReturnType<typeof sortiesPerimetre>
): DemandeurReportRow[] {
  switch (reportId) {
    case "mes-demandes":
      return demandes.map((d) => ({
        reference: d.reference,
        date: d.date,
        materiel: materielsDemande(d),
        categorie: d.lignes[0]?.categorie || "—",
        quantite: quantiteDemande(d),
        direction: d.direction,
        service: d.service,
        priorite: d.priorite,
        statut: d.statut,
      }));
    case "mes-sorties":
      return sorties.map((s) => ({
        reference: s.reference,
        date: s.dateSortie,
        materiel: s.materiel,
        categorie: s.categorie,
        quantite: s.quantite,
        direction: s.direction,
        service: s.serviceDemandeur,
        beneficiaire: s.beneficiaire,
        statut: s.statut,
      }));
    case "materiels-recus":
      return sorties
        .filter((s) => s.statut === "Sortie effectuée")
        .map((s) => ({
          reference: s.reference,
          date: s.dateSortie,
          materiel: s.materiel,
          categorie: s.categorie,
          quantite: s.quantite,
          direction: s.direction,
          service: s.serviceDemandeur,
          beneficiaire: s.beneficiaire,
          statut: s.statut,
        }));
    case "mouvements-service":
      return [
        ...entreeRecords.map((e) => ({
          reference: e.reference,
          type: "Entrée",
          date: e.dateEntree,
          materiel: e.materiel,
          categorie: e.categorie,
          quantite: e.quantite,
          direction: e.direction,
          service: e.service,
          statut: getStatutEntreeAffiche(e),
        })),
        ...sorties.map((s) => ({
          reference: s.reference,
          type: "Sortie",
          date: s.dateSortie,
          materiel: s.materiel,
          categorie: s.categorie,
          quantite: s.quantite,
          direction: s.direction,
          service: s.serviceDemandeur,
          beneficiaire: s.beneficiaire,
          statut: s.statut,
        })),
      ];
    default:
      return [];
  }
}

interface ReportFilterOptions {
  term: string;
  categorie: string;
  statut: string;
  direction: string;
  service: string;
  dateRange: string;
}

/** Applique les filtres (période, catégorie, statut, direction, service) */
function applyReportFilters(
  baseRows: DemandeurReportRow[],
  options: ReportFilterOptions
): DemandeurReportRow[] {
  const term = options.term.trim().toLowerCase();
  const reference = getReferenceDate();
  const days = parseInt(options.dateRange, 10) || 365;
  const cutoff = new Date(reference);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  return baseRows.filter((row) => {
    const matchesSearch =
      !term ||
      row.reference.toLowerCase().includes(term) ||
      row.materiel.toLowerCase().includes(term);
    const matchesCategorie =
      options.categorie === "Toutes" || row.categorie === options.categorie;
    const matchesStatut =
      options.statut === "Tous" || row.statut === options.statut;
    const matchesDirection =
      options.direction === "Toutes" || row.direction === options.direction;
    const matchesService =
      options.service === "Tous" || row.service === options.service;
    const matchesPeriode = !row.date || row.date >= cutoffIso;
    return (
      matchesSearch &&
      matchesCategorie &&
      matchesStatut &&
      matchesDirection &&
      matchesService &&
      matchesPeriode
    );
  });
}

function DemandeurReports({ user }: { user?: User }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [dateRange, setDateRange] = useState("365");
  const [categorieFilter, setCategorieFilter] = useState("Toutes");
  const [statutFilter, setStatutFilter] = useState("Tous");
  const [directionFilter, setDirectionFilter] = useState("Toutes");
  const [serviceFilter, setServiceFilter] = useState("Tous");
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const demandes = getDemandesForUser(user);
  const sorties = sortiesPerimetre(sortieRecords, user);
  const orga = splitDepartementDemandeur(user?.department || "");

  /** Lignes du rapport sélectionné (données réelles de l'application) */
  const baseRows = useMemo(
    () => buildBaseRows(activeReport, demandes, sorties),
    [activeReport, demandes, sorties]
  );

  const filterOptions: ReportFilterOptions = {
    term: searchTerm,
    categorie: categorieFilter,
    statut: statutFilter,
    direction: directionFilter,
    service: serviceFilter,
    dateRange,
  };

  /** Filtres (période, catégorie, statut, direction, service, recherche) */
  const rows = useMemo(
    () => applyReportFilters(baseRows, filterOptions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      baseRows,
      searchTerm,
      categorieFilter,
      statutFilter,
      directionFilter,
      serviceFilter,
      dateRange,
    ]
  );

  const categories = useMemo(
    ["Toutes", ...Array.from(new Set(baseRows.map((r) => r.categorie)))],
    [baseRows]
  );
  const statuts = useMemo(
    ["Tous", ...Array.from(new Set(baseRows.map((r) => r.statut)))],
    [baseRows]
  );
  const directions = useMemo(
    ["Toutes", ...Array.from(new Set(baseRows.map((r) => r.direction)))],
    [baseRows]
  );
  const services = useMemo(
    ["Tous", ...Array.from(new Set(baseRows.map((r) => r.service)))],
    [baseRows]
  );

  const filteredReports = DEMANDEUR_REPORTS.filter((report) => {
    const matchesSearch =
      !searchTerm.trim() ||
      report.name.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      report.description.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesType = typeFilter === "Tous" || report.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Demandes":
        return Clipboard;
      case "Sorties":
        return Inbox;
      case "Mouvements":
        return ArrowUpDown;
      default:
        return BarChart3;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "Demandes":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Sorties":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Mouvements":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    }
  };

  const activeReportDef = DEMANDEUR_REPORTS.find((r) => r.id === activeReport);

  const exportCsv = (reportId?: string) => {
    const id = reportId || activeReport;
    if (!id) return;
    const target = DEMANDEUR_REPORTS.find((r) => r.id === id);
    const rowsToExport = reportId
      ? applyReportFilters(
          buildBaseRows(reportId, demandes, sorties),
          filterOptions
        )
      : rows;
    if (!target) return;
    const headers = [
      "Reference",
      "Date",
      "Materiel",
      "Categorie",
      "Quantite",
      "Direction",
      "Service",
      "Beneficiaire",
      "Priorite",
      "Statut",
    ];
    const lines = rowsToExport.map((row) =>
      [
        row.reference,
        row.date,
        `"${row.materiel}"`,
        row.categorie,
        row.quantite,
        row.direction,
        `"${row.service}"`,
        `"${row.beneficiaire || ""}"`,
        row.priorite || "",
        row.statut,
      ].join(",")
    );
    const csv =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent([headers.join(","), ...lines].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csv);
    link.setAttribute(
      "download",
      `${target.id}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setCategorieFilter("Toutes");
    setStatutFilter("Tous");
    setDirectionFilter("Toutes");
    setServiceFilter("Tous");
    setDateRange("365");
  };

  const statCards = [
    {
      label: "Rapports disponibles",
      value: DEMANDEUR_REPORTS.length,
      icon: FileText,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: "Mes demandes",
      value: demandes.length,
      icon: Clipboard,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
      label: "Entrées accessibles",
      value: entreeRecords.length,
      icon: ArrowDownToLine,
      iconClass:
        "bg-cyan-100 text-cyan-600 rounded-lg dark:bg-cyan-900/30 dark:text-cyan-400",
    },
    {
      label: "Sorties de mon service",
      value: sorties.length,
      icon: ArrowUpDown,
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">
          Rapports
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Consultez les rapports auxquels votre rôle vous donne accès
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Périmètre : {orga.direction} / {orga.service}
        </p>
      </div>

      {/* Indicateurs */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
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
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un rapport, une référence, un matériel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous les types</option>
              <option value="Demandes">Demandes</option>
              <option value="Sorties">Sorties</option>
              <option value="Mouvements">Mouvements</option>
              <option value="Statistiques">Statistiques</option>
            </select>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">Cette année</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Catégorie
            </label>
            <select
              value={categorieFilter}
              onChange={(e) => setCategorieFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Statut
            </label>
            <select
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            >
              {statuts.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Direction
            </label>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            >
              {directions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Service
            </label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
            >
              {services.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Filter className="h-4 w-4" />
            Réinitialiser les filtres
          </button>
        </div>
      </div>

      {/* Liste des rapports */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-base sm:text-lg text-card-foreground">
            Rapports disponibles ({filteredReports.length})
          </h3>
        </div>
        <div className="p-4 sm:p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => {
            const Icon = getTypeIcon(report.type);
            return (
              <div
                key={report.id}
                className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <Icon className="h-5 w-5 mt-1 text-primary" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-card-foreground">
                      {report.name}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {report.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getTypeColor(
                      report.type
                    )}`}
                  >
                    {report.type}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveReport(report.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Consulter
                  </button>
                  <button
                    onClick={() => {
                      setActiveReport(report.id);
                      setTimeout(() => window.print(), 300);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                    title="Exporter en PDF (impression)"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => exportCsv(report.id)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                    title="Exporter en Excel (CSV)"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Excel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Aperçu du rapport sélectionné */}
      {activeReport && activeReportDef && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between p-6 border-b border-border">
              <div>
                <h3 className="text-lg text-card-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {activeReportDef.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeReportDef.description} — {rows.length} ligne(s)
                </p>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {activeReport === "statistiques" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Mes demandes", value: demandes.length },
                    {
                      label: "Demandes en attente",
                      value: demandes.filter((d) => d.statut === "En attente")
                        .length,
                    },
                    {
                      label: "Demandes validées",
                      value: demandes.filter(
                        (d) =>
                          d.statut === "Validée" ||
                          d.statut === "Sortie effectuée"
                      ).length,
                    },
                    {
                      label: "Sorties de mon service",
                      value: sorties.length,
                    },
                    {
                      label: "Sorties effectuées",
                      value: sorties.filter(
                        (s) => s.statut === "Sortie effectuée"
                      ).length,
                    },
                    { label: "Entrées accessibles", value: entreeRecords.length },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20"
                    >
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="text-lg text-card-foreground">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  Aucune donnée ne correspond aux filtres sélectionnés.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full" data-report-export>
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                          Référence
                        </th>
                        {activeReport === "mouvements-service" && (
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Type
                          </th>
                        )}
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                          Date
                        </th>
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                          Matériel
                        </th>
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                          Qté
                        </th>
                        <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr
                          key={`${row.reference}-${index}`}
                          className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2 px-3 text-sm font-mono text-card-foreground">
                            {row.reference}
                          </td>
                          {activeReport === "mouvements-service" && (
                            <td className="py-2 px-3 text-sm text-card-foreground">
                              {row.type}
                            </td>
                          )}
                          <td className="py-2 px-3 text-sm text-card-foreground whitespace-nowrap">
                            {formatDateCourt(row.date)}
                          </td>
                          <td className="py-2 px-3 text-sm text-card-foreground max-w-[220px] truncate">
                            {row.materiel}
                          </td>
                          <td className="py-2 px-3 text-sm text-card-foreground">
                            {row.quantite}
                          </td>
                          <td className="py-2 px-3 text-sm text-card-foreground">
                            {row.statut}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 p-6 border-t border-border">
              <button
                onClick={() => setActiveReport(null)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Fermer
              </button>
              <div className="flex-1" />
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <Printer className="h-4 w-4" />
                Exporter PDF
              </button>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Exporter Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}