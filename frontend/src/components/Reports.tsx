import { useState } from "react"
import { BarChart3, Download, FileText, Calendar, Filter, Search, TrendingUp, Package, ArrowUpDown, Users } from "lucide-react"

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

export function Reports() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("Tous")
  const [dateRange, setDateRange] = useState("30")
  const [selectedReport, setSelectedReport] = useState<string | null>(null)

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