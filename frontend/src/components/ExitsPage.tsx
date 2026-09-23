import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpFromLine,
  Search,
  SlidersHorizontal,
  Eye,
  History,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  Package,
  Clock,
  BadgeCheck,
  CheckCircle2,
  RotateCcw,
  ClipboardList,
} from "lucide-react";
import { User } from "../App";
import {
  sortieRecords,
  SortieRecord,
  STATUTS_SORTIE,
  getStatistiquesSorties,
  sortiesPerimetre,
} from "../lib/movements";
import { fetchSorties } from "../lib/api";
import { getAllDemandes } from "../lib/demandes";
import {
  MovementDetailModal,
  MouvementDetailTab,
} from "./MovementDetailModal";

const PAGE_SIZE = 6;

function getStatusColor(statut: string) {
  switch (statut) {
    case "Validée":
    case "Sortie effectuée":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Demandée":
    case "En préparation":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "Annulée":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

interface ExitsPageProps {
  user?: User;
  /** Ouvre la demande associée dans le module Demandes */
  onViewRequest?: (requestId: number) => void;
}

export function ExitsPage({ user, onViewRequest }: ExitsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [directionFilter, setDirectionFilter] = useState("Toutes");
  const [serviceFilter, setServiceFilter] = useState("Tous");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SortieRecord | null>(null);
  const [detailTab, setDetailTab] = useState<MouvementDetailTab>("details");
  const [modalOpen, setModalOpen] = useState(false);

  // Données : API Strapi si elle répond, sinon repli sur les données locales
  const [records, setRecords] = useState<SortieRecord[]>(sortieRecords);
  const [dataOrigin, setDataOrigin] = useState<"chargement" | "api" | "local">(
    "chargement"
  );

  useEffect(() => {
    let cancelled = false;
    fetchSorties().then((data) => {
      if (cancelled) return;
      if (data && data.length > 0) {
        setRecords(data);
        setDataOrigin("api");
      } else {
        setRecords(sortieRecords);
        setDataOrigin("local");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDemandeur = user?.role === "demandeur";
  const canExport = !!user && (user.permissions?.includes("all") || user.role !== "demandeur");

  // Périmètre : le Demandeur ne voit que les sorties de son service / direction
  const scopedRecords = useMemo(
    () => sortiesPerimetre(records, user),
    [records, user]
  );

  // Libellé de la demande associée (référence DEM-AAAA-NNN si connue)
  const demandeLabel = (id?: number) => {
    if (!id) return null;
    const dem = getAllDemandes().find((d) => d.id === id);
    return dem ? dem.reference : `Demande n° ${id}`;
  };

  const categories = useMemo(
    () => ["Toutes", ...Array.from(new Set(scopedRecords.map((s) => s.categorie)))],
    [scopedRecords]
  );
  const directions = useMemo(
    () => ["Toutes", ...Array.from(new Set(scopedRecords.map((s) => s.direction)))],
    [scopedRecords]
  );
  const services = useMemo(
    () => ["Tous", ...Array.from(new Set(scopedRecords.map((s) => s.serviceDemandeur)))],
    [scopedRecords]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return scopedRecords.filter((sortie) => {
      const matchesSearch =
        !term ||
        sortie.reference.toLowerCase().includes(term) ||
        sortie.materiel.toLowerCase().includes(term) ||
        sortie.beneficiaire.toLowerCase().includes(term) ||
        sortie.responsable.toLowerCase().includes(term) ||
        sortie.serviceDemandeur.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "Tous" || sortie.statut === statusFilter;
      const matchesCategory = categoryFilter === "Toutes" || sortie.categorie === categoryFilter;
      const matchesDirection = directionFilter === "Toutes" || sortie.direction === directionFilter;
      const matchesService =
        serviceFilter === "Tous" || sortie.serviceDemandeur === serviceFilter;
      const matchesDebut = !dateDebut || sortie.dateSortie >= dateDebut;
      const matchesFin = !dateFin || sortie.dateSortie <= dateFin;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesDirection &&
        matchesService &&
        matchesDebut &&
        matchesFin
      );
    });
  }, [
    scopedRecords,
    searchTerm,
    statusFilter,
    categoryFilter,
    directionFilter,
    serviceFilter,
    dateDebut,
    dateFin,
  ]);

  const stats = getStatistiquesSorties(scopedRecords);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("Tous");
    setCategoryFilter("Toutes");
    setDirectionFilter("Toutes");
    setServiceFilter("Tous");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  };

  const openDetail = (sortie: SortieRecord, tab: MouvementDetailTab) => {
    setSelected(sortie);
    setDetailTab(tab);
    setModalOpen(true);
  };

  const exportFiltered = () => {
    if (!canExport) return;
    const headers = [
      "ReferenceSortie",
      "DateSortie",
      "Materiel",
      "Categorie",
      "Quantite",
      "ServiceDemandeur",
      "Direction",
      "DemandeAssociee",
      "Beneficiaire",
      "Responsable",
      "Statut",
    ];
    const lines = filtered.map((s) =>
      [
        s.reference,
        s.dateSortie,
        `"${s.materiel}"`,
        s.categorie,
        s.quantite,
        `"${s.serviceDemandeur}"`,
        s.direction,
        s.demandeId ? `Demande ${s.demandeId}` : "",
        `"${s.beneficiaire}"`,
        `"${s.responsable}"`,
        s.statut,
      ].join(",")
    );
    const csv =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent([headers.join(","), ...lines].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csv);
    link.setAttribute("download", `sorties_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statCards = [
    {
      label: "Total des sorties",
      value: stats.total,
      icon: Package,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: `Sorties du mois (${stats.moisLabel})`,
      value: stats.duMois,
      icon: ArrowUpFromLine,
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
      label: "Sorties en attente",
      value: stats.enAttente,
      icon: Clock,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
      label: "Sorties validées",
      value: stats.validees,
      icon: CheckCircle2,
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">
            Sorties
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isDemandeur
              ? "Suivi des sorties de matériels liées à vos demandes"
              : "Suivi des sorties de matériels"}
          </p>
          <div className="mt-1 text-xs text-muted-foreground">
            {dataOrigin === "chargement" && "Connexion au serveur..."}
            {dataOrigin === "api" && "Source : API Strapi (backend en ligne)"}
            {dataOrigin === "local" &&
              "Source : données locales (backend hors ligne ou vide)"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm"
          >
            <Search className="h-4 w-4" />
            Recherche
          </button>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              filtersOpen
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
          </button>
          {canExport && (
            <button
              onClick={exportFiltered}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Download className="h-4 w-4" />
              Exporter
            </button>
          )}
        </div>
      </div>

      {isDemandeur && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
          <BadgeCheck className="h-4 w-4" />
          Périmètre : sorties concernant {user?.department || "votre service"} —
          la validation et la préparation relèvent du responsable habilité.
        </div>
      )}

      {/* Indicateurs */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
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
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    {card.label}
                  </div>
                  <div className="text-lg sm:text-xl text-card-foreground">
                    {card.value}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recherche */}
      {searchOpen && (
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par référence, matériel, bénéficiaire, responsable, service..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Filtres */}
      {filtersOpen && (
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Statut
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="Tous">Tous les statuts</option>
                {STATUTS_SORTIE.map((statut) => (
                  <option key={statut} value={statut}>
                    {statut}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Catégorie
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
              >
                {categories.map((categorie) => (
                  <option key={categorie} value={categorie}>
                    {categorie}
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
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
              >
                {directions.map((direction) => (
                  <option key={direction} value={direction}>
                    {direction}
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
                onChange={(e) => {
                  setServiceFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
              >
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Date du
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => {
                  setDateDebut(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Date au
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => {
                  setDateFin(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Tableau des sorties ({filtered.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Demande → Validation → Préparation → Sortie → Bénéficiaire →
            Historique
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Référence de sortie</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Date de sortie</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Matériel</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Catégorie</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Quantité</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Service demandeur</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Direction</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Demande associée</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Bénéficiaire</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Responsable</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {isDemandeur && scopedRecords.length === 0
                        ? "Aucune sortie enregistrée"
                        : "Aucune sortie ne correspond aux critères."}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((sortie) => (
                    <tr
                      key={sortie.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-sm font-mono text-card-foreground">
                        {sortie.reference}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                        {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground max-w-[200px] truncate">
                        {sortie.materiel}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {sortie.categorie}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {sortie.quantite}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground max-w-[160px] truncate">
                        {sortie.serviceDemandeur}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {sortie.direction}
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {sortie.demandeId && onViewRequest ? (
                          <button
                            onClick={() => onViewRequest(sortie.demandeId!)}
                            className="inline-flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                            title="Voir la demande associée"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            {demandeLabel(sortie.demandeId)}
                          </button>
                        ) : sortie.demandeId ? (
                          <span className="font-mono text-card-foreground">
                            {demandeLabel(sortie.demandeId)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {sortie.beneficiaire}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {sortie.responsable}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                            sortie.statut
                          )}`}
                        >
                          {sortie.statut}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="Voir détails"
                            onClick={() => openDetail(sortie, "details")}
                            className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {sortie.demandeId && onViewRequest && (
                            <button
                              title="Voir la demande associée"
                              onClick={() => onViewRequest(sortie.demandeId!)}
                              className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                            >
                              <ClipboardList className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            title="Voir historique"
                            onClick={() => openDetail(sortie, "historique")}
                            className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            title="Consulter le justificatif"
                            onClick={() => openDetail(sortie, "documents")}
                            className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {canExport && (
                            <button
                              title="Exporter"
                              onClick={() => {
                                setSelected(sortie);
                                setDetailTab("details");
                                setModalOpen(true);
                              }}
                              className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <div className="text-xs text-muted-foreground">
              {filtered.length === 0
                ? "0 résultat"
                : `${startIndex + 1}-${Math.min(
                    startIndex + PAGE_SIZE,
                    filtered.length
                  )} sur ${filtered.length} sorties`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal détail */}
      <MovementDetailModal
        open={modalOpen}
        type="sortie"
        sortie={selected}
        initialTab={detailTab}
        canExport={canExport}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
