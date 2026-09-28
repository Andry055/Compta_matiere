import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Search,
  SlidersHorizontal,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Package,
  CalendarDays,
  RotateCcw,
  BadgeCheck,
} from "lucide-react";
import { User } from "../App";
import { entreeRecords, EntreeRecord } from "../lib/movements";
import { fetchEntrees } from "../lib/api";
import { getEntreesTransfert } from "../lib/transfers";
import {
  AffectationRecord,
  calculerStock,
  getStatistiquesAffectations,
  getStatutAffectationAffiche,
  getValidationCount,
  listerAffectations,
  statutAffectationBadge,
} from "../lib/affectations";
import { NewAffectationPage } from "./NewAffectationPage";
import { AffectationDetailModal } from "./AffectationDetailModal";

const PAGE_SIZE = 6;

const STATUTS_AFFICHAGE = ["En attente", "Validée"];

interface AffectationsPageProps {
  user?: User;
}

/**
 * Page « Affectations » — rubrique indépendante de la page Entrées.
 *
 * Une affectation réaffecte un matériel déjà enregistré entre deux services
 * d'une MÊME Direction : pas de sortie, pas de nouvelle entrée, seulement une
 * mise à jour du stock du service et une traçabilité complète (4 validations).
 */
export function AffectationsPage({ user }: AffectationsPageProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [directionFilter, setDirectionFilter] = useState("Toutes");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AffectationRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState("");

  // Données : affectations (local) + entrées (pour le stock consolidé)
  const [records, setRecords] = useState<AffectationRecord[]>(() =>
    listerAffectations()
  );
  const [entrees, setEntrees] = useState<EntreeRecord[]>([
    ...getEntreesTransfert(),
    ...entreeRecords,
  ]);

  const canCreate = !!user;

  const recharger = () => {
    setRecords(listerAffectations());
    fetchEntrees().then((data) => {
      setEntrees([
        ...getEntreesTransfert(),
        ...(data && data.length > 0 ? data : entreeRecords),
      ]);
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetchEntrees().then((data) => {
      if (cancelled) return;
      setEntrees([
        ...getEntreesTransfert(),
        ...(data && data.length > 0 ? data : entreeRecords),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stock = useMemo(
    () => calculerStock(entrees, records),
    [entrees, records]
  );

  const directions = useMemo(
    () => ["Toutes", ...Array.from(new Set(records.map((a) => a.direction)))],
    [records]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return records.filter((a) => {
      const matchesSearch =
        !term ||
        a.reference.toLowerCase().includes(term) ||
        a.materiel.toLowerCase().includes(term) ||
        a.serviceSource.toLowerCase().includes(term) ||
        a.serviceDestinataire.toLowerCase().includes(term) ||
        (a.materielReference || "").toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "Tous" ||
        getStatutAffectationAffiche(a) === statusFilter;
      const matchesDirection =
        directionFilter === "Toutes" || a.direction === directionFilter;
      const matchesDebut = !dateDebut || a.date >= dateDebut;
      const matchesFin = !dateFin || a.date <= dateFin;
      return (
        matchesSearch && matchesStatus && matchesDirection && matchesDebut && matchesFin
      );
    });
  }, [records, searchTerm, statusFilter, directionFilter, dateDebut, dateFin]);

  const stats = getStatistiquesAffectations(records);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  // ------------------------------------------------- formulaire dédié
  if (showNewForm) {
    return (
      <NewAffectationPage
        user={user}
        entrees={entrees}
        onClose={() => setShowNewForm(false)}
        onCreated={(ref) => {
          setShowNewForm(false);
          recharger();
          setFlash(
            `✓ Affectation ${ref} créée (0/4) — en attente des validations.`
          );
          window.setTimeout(() => setFlash(""), 6000);
        }}
      />
    );
  }

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("Tous");
    setDirectionFilter("Toutes");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  };

  const statCards = [
    {
      label: "Total des affectations",
      value: stats.total,
      icon: Package,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: `Affectations du mois (${stats.moisLabel})`,
      value: stats.duMois,
      icon: CalendarDays,
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
      label: "Affectations en attente",
      value: stats.enAttente,
      icon: Clock,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
      label: "Affectations validées",
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
            Affectations
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gestion des affectations de matériels entre services
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <button
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Nouvelle affectation
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
        </div>
      </div>

      {/* Rappel métier */}
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        <BadgeCheck className="h-4 w-4" />
        Affectation = réaffectation interne entre deux services d'une MÊME
        Direction : pas de sortie, pas de nouvelle entrée, seulement la mise à
        jour du stock et la traçabilité. Validation obligatoire en 4 étapes
        (0/4 → 4/4) ; une affectation validée n'est plus modifiable.
      </div>

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
              placeholder="Rechercher par référence, matériel, service, direction, référence de matériels…"
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
                {STATUTS_AFFICHAGE.map((s) => (
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
                onChange={(e) => {
                  setDirectionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
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
            Tableau des affectations ({filtered.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Direction → Service origine → Affectation → Service destinataire →
            Stock → Traçabilité
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Référence</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Direction</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Service d'origine</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Service destinataire</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Matériel</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Quantité</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Validation</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {records.length === 0
                        ? "Aucune affectation — créez la première avec « + Nouvelle affectation »."
                        : "Aucune affectation ne correspond aux critères."}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((a) => {
                    const count = getValidationCount(a);
                    const statut = getStatutAffectationAffiche(a);
                    return (
                      <tr
                        key={a.reference}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-sm font-mono text-card-foreground">
                          {a.reference}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground">
                          {a.direction}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[150px] truncate">
                          {a.serviceSource}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[150px] truncate">
                          {a.serviceDestinataire}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[200px] truncate">
                          {a.materiel}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground">
                          {a.quantite}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                          {new Date(`${a.date}T00:00:00`).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${statutAffectationBadge(
                              statut
                            )}`}
                          >
                            {statut}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            title={`${count}/4 validations`}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono ${
                              count >= 4
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : count >= 1
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            }`}
                          >
                            {count}/4
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              title="Voir"
                              onClick={() => {
                                setSelected(a);
                                setModalOpen(true);
                              }}
                              className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
                  )} sur ${filtered.length} affectations`}
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
      <AffectationDetailModal
        open={modalOpen}
        affectation={selected}
        stock={stock}
        user={user}
        onChanged={() => {
          recharger();
          setSelected((prev) =>
            prev
              ? listerAffectations().find((a) => a.reference === prev.reference) ||
                prev
              : prev
          );
        }}
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
