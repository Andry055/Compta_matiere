import React, { useState } from "react";
import {
  BarChart3,
  Users,
  Building2,
  Briefcase,
  TrendingUp,
  Download,
  Filter,
  Calendar,
  PieChart,
  Activity,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";

interface Employee {
  id: number;
  name: string;
  im: string;
  fonction: string;
  email: string;
  phone: string;
  CIN: string;
  status: "Actif" | "Inactif" | "Congé";
}

interface Service {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
  employees: Employee[];
  location: string;
}

interface Direction {
  id: number;
  name: string;
  director: string;
  directorEmail: string;
  description: string;
  services: Service[];
  location: string;
  isCurrentAdminDirection?: boolean;
}

interface OrganizationalReportsProps {
  directions: Direction[];
}

export function OrganizationalReports({
  directions,
}: OrganizationalReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [selectedDirection, setSelectedDirection] = useState<number | null>(
    null
  );

  // Calculate statistics
  const totalEmployees = directions.reduce(
    (sum, direction) =>
      sum +
      direction.services.reduce(
        (serviceSum, service) => serviceSum + service.employees.length,
        0
      ),
    0
  );

  const activeEmployees = directions.reduce(
    (sum, direction) =>
      sum +
      direction.services.reduce(
        (serviceSum, service) =>
          serviceSum +
          service.employees.filter((emp) => emp.status === "Actif").length,
        0
      ),
    0
  );

  const inactiveEmployees = directions.reduce(
    (sum, direction) =>
      sum +
      direction.services.reduce(
        (serviceSum, service) =>
          serviceSum +
          service.employees.filter((emp) => emp.status === "Inactif").length,
        0
      ),
    0
  );

  const onLeaveEmployees = directions.reduce(
    (sum, direction) =>
      sum +
      direction.services.reduce(
        (serviceSum, service) =>
          serviceSum +
          service.employees.filter((emp) => emp.status === "Congé").length,
        0
      ),
    0
  );

  const totalServices = directions.reduce(
    (sum, direction) => sum + direction.services.length,
    0
  );

  // Direction-wise breakdown
  const directionBreakdown = directions.map((direction) => ({
    id: direction.id,
    name: direction.name,
    totalEmployees: direction.services.reduce(
      (sum, service) => sum + service.employees.length,
      0
    ),
    activeEmployees: direction.services.reduce(
      (sum, service) =>
        sum + service.employees.filter((emp) => emp.status === "Actif").length,
      0
    ),
    services: direction.services.length,
    averageServiceSize:
      direction.services.length > 0
        ? Math.round(
            direction.services.reduce(
              (sum, service) => sum + service.employees.length,
              0
            ) / direction.services.length
          )
        : 0,
  }));

  // Service size distribution
  const serviceSizes = directions.flatMap((direction) =>
    direction.services.map((service) => service.employees.length)
  );
  const avgServiceSize =
    serviceSizes.length > 0
      ? Math.round(
          serviceSizes.reduce((sum, size) => sum + size, 0) /
            serviceSizes.length
        )
      : 0;

  const largestService = Math.max(...serviceSizes, 0);
  const smallestService = Math.min(...serviceSizes, 0);

  // Function distribution analysis
  const functionCount = directions
    .flatMap((direction) =>
      direction.services.flatMap((service) =>
        service.employees.map((emp) => emp.fonction)
      )
    )
    .reduce((acc, fonction) => {
      acc[fonction] = (acc[fonction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const topFunctions = Object.entries(functionCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const handleExportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        onLeaveEmployees,
        totalDirections: directions.length,
        totalServices,
        avgServiceSize,
      },
      directions: directionBreakdown,
      topFunctions,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-organisationnel-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Rapports Organisationnels
          </h1>
          <p className="text-muted-foreground">
            Analyses et statistiques de la structure organisationnelle
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            >
              <option value="current">État Actuel</option>
              <option value="month">Ce Mois</option>
              <option value="quarter">Ce Trimestre</option>
              <option value="year">Cette Année</option>
            </select>
          </div>
          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="h-4 w-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-card-foreground">
                {totalEmployees}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Employés
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-card-foreground">
                {activeEmployees}
              </div>
              <div className="text-sm text-muted-foreground">
                Employés Actifs
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {totalEmployees > 0
                  ? Math.round((activeEmployees / totalEmployees) * 100)
                  : 0}
                % du total
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-card-foreground">
                {onLeaveEmployees}
              </div>
              <div className="text-sm text-muted-foreground">En Congé</div>
              <div className="text-xs text-orange-600 dark:text-orange-400">
                {totalEmployees > 0
                  ? Math.round((onLeaveEmployees / totalEmployees) * 100)
                  : 0}
                % du total
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-card-foreground">
                {avgServiceSize}
              </div>
              <div className="text-sm text-muted-foreground">
                Taille Moy. Service
              </div>
              <div className="text-xs text-muted-foreground">
                Min: {smallestService} | Max: {largestService}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direction Analysis */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Breakdown by Direction */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Répartition par Direction
            </h3>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            {directionBreakdown.map((direction) => (
              <div key={direction.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-card-foreground">
                    {direction.name}
                  </h4>
                  <span className="text-sm text-muted-foreground">
                    {direction.totalEmployees} employés
                  </span>
                </div>

                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all duration-300"
                    style={{
                      width:
                        totalEmployees > 0
                          ? `${
                              (direction.totalEmployees / totalEmployees) * 100
                            }%`
                          : "0%",
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>Services: {direction.services}</div>
                  <div>Actifs: {direction.activeEmployees}</div>
                  <div>Moy/Service: {direction.averageServiceSize}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Functions */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Fonctions les Plus Répandues
            </h3>
            <PieChart className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="space-y-4">
            {topFunctions.map(([fonction, count], index) => (
              <div key={fonction} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-primary/10 rounded-full text-xs font-medium text-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-card-foreground">
                      {fonction}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {count} {count === 1 ? "personne" : "personnes"}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-primary rounded-full h-1.5 transition-all duration-300"
                      style={{
                        width:
                          totalEmployees > 0
                            ? `${(count / totalEmployees) * 100}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Distribution des Statuts d'Employés
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {activeEmployees}
            </div>
            <div className="text-sm text-green-700 dark:text-green-300">
              Actifs
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {totalEmployees > 0
                ? Math.round((activeEmployees / totalEmployees) * 100)
                : 0}
              %
            </div>
          </div>

          <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {onLeaveEmployees}
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">
              En Congé
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              {totalEmployees > 0
                ? Math.round((onLeaveEmployees / totalEmployees) * 100)
                : 0}
              %
            </div>
          </div>

          <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {inactiveEmployees}
            </div>
            <div className="text-sm text-red-700 dark:text-red-300">
              Inactifs
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              {totalEmployees > 0
                ? Math.round((inactiveEmployees / totalEmployees) * 100)
                : 0}
              %
            </div>
          </div>
        </div>
      </div>

      {/* Service Analysis */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Analyse des Services
          </h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-card-foreground">
              {totalServices}
            </div>
            <div className="text-sm text-muted-foreground">Total Services</div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-card-foreground">
              {avgServiceSize}
            </div>
            <div className="text-sm text-muted-foreground">Taille Moyenne</div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-card-foreground">
              {largestService}
            </div>
            <div className="text-sm text-muted-foreground">
              Plus Grand Service
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-card-foreground">
              {smallestService}
            </div>
            <div className="text-sm text-muted-foreground">
              Plus Petit Service
            </div>
          </div>
        </div>
      </div>

      {/* Export Information */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Informations sur le Rapport
          </span>
        </div>
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p>
            Généré le: {new Date().toLocaleDateString("fr-FR")} à{" "}
            {new Date().toLocaleTimeString("fr-FR")}
          </p>
          <p>
            Période:{" "}
            {selectedPeriod === "current" ? "État actuel" : selectedPeriod}
          </p>
          <p>
            Données incluent: {directions.length} directions, {totalServices}{" "}
            services, {totalEmployees} employés
          </p>
        </div>
      </div>
    </div>
  );
}
