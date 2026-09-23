import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
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
  Plus,
  Printer,
} from "lucide-react";
import { User } from "../App";
import {
  entreeRecords,
  EntreeRecord,
  getStatistiquesEntrees,
  getSignatureCount,
  getSignaturesEntree,
  getStatutEntreeAffiche,
} from "../lib/movements";
import { fetchEntrees } from "../lib/api";
import {
  MovementDetailModal,
  MouvementDetailTab,
} from "./MovementDetailModal";
import { NewEntryPage } from "./NewEntryPage";
import { ErrorBoundary } from "./ErrorBoundary";

const PAGE_SIZE = 6;

// Statuts affichés (règle des 3 signatures)
const STATUTS_AFFICHAGE_ENTREE = [
  "En attente",
  "Partiellement signée",
  "Validée",
  "Rejetée",
];

function getStatusColor(statut: string) {
  switch (statut) {
    case "Validée":
    case "Vérifiée":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Partiellement signée":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "En attente":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "Rejetée":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

interface EntriesPageProps {
  user?: User;
}

export function EntriesPage({ user }: EntriesPageProps) {
  // Mode « page » : le bouton « + Nouvelle entrée » bascule vers la page
  // dédiée (sections numérotées + résumé sticky + QR Code).
  const [showNewEntryPage, setShowNewEntryPage] = useState(false);
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
  const [selected, setSelected] = useState<EntreeRecord | null>(null);
  const [detailTab, setDetailTab] = useState<MouvementDetailTab>("details");
  const [modalOpen, setModalOpen] = useState(false);

  // Données : API Strapi si elle répond, sinon repli sur les données locales
  const [records, setRecords] = useState<EntreeRecord[]>(entreeRecords);
  const [dataOrigin, setDataOrigin] = useState<"chargement" | "api" | "local">(
    "chargement"
  );
  const [flash, setFlash] = useState("");

  // Le Demandeur peut enregistrer une entrée (démarre « En attente » 0/3) :
  // les signatures restent réservées aux responsables habilités.
  const canCreate = !!user;

  const charger = () => {
    fetchEntrees().then((data) => {
      if (data && data.length > 0) {
        setRecords(data);
        setDataOrigin("api");
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetchEntrees().then((data) => {
      if (cancelled) return;
      if (data && data.length > 0) {
        setRecords(data);
        setDataOrigin("api");
      } else {
        setRecords(entreeRecords);
        setDataOrigin("local");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Le Demandeur consulte sans pouvoir valider (validation réservée au responsable)
  const isDemandeur = user?.role === "demandeur";
  const canExport = !!user && (user.permissions?.includes("all") || user.role !== "demandeur");

  const categories = useMemo(
    () => ["Toutes", ...Array.from(new Set(records.map((e) => e.categorie)))],
    [records]
  );
  const directions = useMemo(
    () => ["Toutes", ...Array.from(new Set(records.map((e) => e.direction)))],
    [records]
  );
  const services = useMemo(
    () => ["Tous", ...Array.from(new Set(records.map((e) => e.service)))],
    [records]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return records.filter((entry) => {
      const matchesSearch =
        !term ||
        entry.reference.toLowerCase().includes(term) ||
        entry.materiel.toLowerCase().includes(term) ||
        entry.fournisseur.toLowerCase().includes(term) ||
        entry.responsable.toLowerCase().includes(term) ||
        entry.numeroFacture.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "Tous" ||
        getStatutEntreeAffiche(entry) === statusFilter;
      const matchesCategory = categoryFilter === "Toutes" || entry.categorie === categoryFilter;
      const matchesDirection = directionFilter === "Toutes" || entry.direction === directionFilter;
      const matchesService = serviceFilter === "Tous" || entry.service === serviceFilter;
      const matchesDebut = !dateDebut || entry.dateEntree >= dateDebut;
      const matchesFin = !dateFin || entry.dateEntree <= dateFin;
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
    records,
    searchTerm,
    statusFilter,
    categoryFilter,
    directionFilter,
    serviceFilter,
    dateDebut,
    dateFin,
  ]);

  const stats = getStatistiquesEntrees(records);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  // Page « Nouvelle entrée » dédiée
  if (showNewEntryPage) {
    return (
      <ErrorBoundary
        title="Impossible de charger la page."
        message="La page Nouvelle entrée n'a pas pu se rendre correctement."
        onRetry={() => setShowNewEntryPage(true)}
      >
        <NewEntryPage
          user={user}
          onClose={() => setShowNewEntryPage(false)}
          onCreated={(ref) => {
            setShowNewEntryPage(false);
            setFlash(
              ref === "brouillon"
                ? "Brouillon enregistré. L'entrée reste modifiable avant envoi."
                : `✓ Entrée ${ref} créée avec succès — statut « En attente » (0/3 signatures).`
            );
            charger();
            window.setTimeout(() => setFlash(""), 6000);
          }}
        />
      </ErrorBoundary>
    );
  }

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

  const openDetail = (entry: EntreeRecord, tab: MouvementDetailTab) => {
    setSelected(entry);
    setDetailTab(tab);
    setModalOpen(true);
  };

  const exportFiltered = () => {
    if (!canExport) return;
    const headers = [
      "Reference",
      "DateEntree",
      "Materiel",
      "Categorie",
      "Quantite",
      "Fournisseur",
      "Facture",
      "Direction",
      "Service",
      "Statut",
      "Responsable",
    ];
    const lines = filtered.map((e) =>
      [
        e.reference,
        e.dateEntree,
        `"${e.materiel}"`,
        e.categorie,
        e.quantite,
        `"${e.fournisseur}"`,
        e.numeroFacture,
        e.direction,
        `"${e.service}"`,
        e.statut,
        `"${e.responsable}"`,
      ].join(",")
    );
    const csv =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent([headers.join(","), ...lines].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csv);
    link.setAttribute("download", `entrees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statCards = [
    {
      label: "Total des entrées",
      value: stats.total,
      icon: Package,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: `Entrées du mois (${stats.moisLabel})`,
      value: stats.duMois,
      icon: ArrowDownToLine,
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
      label: "Entrées en attente",
      value: stats.enAttente,
      icon: Clock,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
      label: "Entrées validées",
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
            Entrées
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Suivi des entrées de matériels
          </p>
          <div className="mt-1 text-xs text-muted-foreground">
            {dataOrigin === "chargement" && "Connexion au serveur..."}
            {dataOrigin === "api" && "Source : API Strapi (backend en ligne)"}
            {dataOrigin === "local" &&
              "Source : données locales (backend hors ligne ou vide)"}
          </div>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={() => setShowNewEntryPage(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Nouvelle entrée
            </button>
          )}
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
          Vous pouvez enregistrer une nouvelle entrée : elle démarre « En
          attente » (0/3) et n'est VALIDÉE qu'après les 3 signatures
          obligatoires (Dépositaire, Chef de service 1, Chef de service 2).
          Vous ne pouvez jamais signer à la place d'un responsable.
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
              placeholder="Rechercher par référence, matériel, fournisseur, n° facture, responsable..."
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
                {STATUTS_AFFICHAGE_ENTREE.map((statut) => (
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
            Tableau des entrées ({filtered.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Fournisseur → Facture → Réception → Vérification → Enregistrement →
            Stock
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Référence</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Date d'entrée</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Matériel</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Catégorie</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Quantité</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Fournisseur</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">N° facture</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Direction / Service</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Signatures</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Responsable</th>
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
                      {isDemandeur && records.length === 0
                        ? "Aucune entrée disponible"
                        : "Aucune entrée ne correspond aux critères."}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-3 text-sm font-mono text-card-foreground">
                        {entry.reference}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                        {new Date(entry.dateEntree).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground max-w-[200px] truncate">
                        {entry.materiel}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {entry.categorie}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {entry.quantite}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground max-w-[160px] truncate">
                        {entry.fournisseur}
                      </td>
                      <td className="py-3 px-3 text-sm font-mono text-card-foreground">
                        {entry.numeroFacture}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground max-w-[180px] truncate">
                        {entry.direction} / {entry.service}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                            getStatutEntreeAffiche(entry)
                          )}`}
                        >
                          {getStatutEntreeAffiche(entry)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {(() => {
                          const count = getSignatureCount(entry);
                          const signatures = getSignaturesEntree(entry);
                          const title = signatures
                            .map((s) =>
                              s.signed
                                ? `${s.label} : signé (${new Date(
                                    s.date!
                                  ).toLocaleString("fr-FR")})`
                                : `${s.label} : en attente`
                            )
                            .join("\n");
                          return (
                            <span
                              title={title}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono ${
                                count >= 3
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : count >= 1
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                              }`}
                            >
                              {count}/3
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-3 text-sm text-card-foreground">
                        {entry.responsable}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="Voir détails"
                            onClick={() => openDetail(entry, "details")}
                            className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            title="Voir historique"
                            onClick={() => openDetail(entry, "historique")}
                            className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            title="Consulter les documents"
                            onClick={() => openDetail(entry, "documents")}
                            className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          {canExport && (
                            <button
                              title="Générer l'Ordre d'entrée (imprimable)"
                              onClick={() => openDetail(entry, "signatures")}
                              className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Printer className="h-4 w-4" />
                            </button>
                          )}
                          {canExport && (
                            <button
                              title="Exporter"
                              onClick={() => {
                                setSelected(entry);
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
                  )} sur ${filtered.length} entrées`}
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
        type="entree"
        entree={selected}
        initialTab={detailTab}
        canExport={canExport}
        user={user}
        onChanged={charger}
        onClose={() => setModalOpen(false)}
      />

      {/* Message flash */}
      {flash && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg shadow-lg text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          {flash}
        </div>
      )}
    </div>
  );
}
