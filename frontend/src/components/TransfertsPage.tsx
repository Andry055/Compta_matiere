import { useEffect, useMemo, useState } from "react";import {
  ArrowRightLeft,
  Search,
  SlidersHorizontal,
  Plus,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Package,
  CalendarDays,
  RotateCcw,
  BadgeCheck,
  Truck,
} from "lucide-react";
import { User } from "../App";
import { entreeRecords, EntreeRecord } from "../lib/movements";
import { getEntreesTransfert } from "../lib/transfers";
import {
  TransfertRecord,
  getStatistiquesTransferts,
  getStatutTransfertAffiche,
  getSignatureSortieCount,
  getSignatureReceptionCount,
  listerTransferts,
  statutTransfertBadge,
  STATUTS_TRANSFERT,
} from "../lib/transferts";
import { NewTransfertPage } from "./NewTransfertPage";
import { TransfertDetailModal } from "./TransfertDetailModal";

const PAGE_SIZE = 6;

interface TransfertsPageProps {
  user?: User;
}

/**
 * Page « Transferts entre Directions » — rubrique indépendante.
 *
 * Un transfert déplace un matériel d'une Direction vers une AUTRE Direction :
 * SORTIE du stock d'origine (3 signatures) → EN TRANSFERT → ENTRÉE dans le
 * stock destinataire (3 signatures de réception). À la différence de
 * l'affectation interne (même Direction, pas de mouvement de stock).
 */
export function TransfertsPage({ user }: TransfertsPageProps) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [directionOrigineFilter, setDirectionOrigineFilter] = useState("Toutes");
  const [directionDestFilter, setDirectionDestFilter] = useState("Toutes");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TransfertRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [flash, setFlash] = useState("");

  // Données : transferts (local) + entrées (pour les listes de matériels)
  const [records, setRecords] = useState<TransfertRecord[]>(() =>
    listerTransferts()
  );
  const [entrees, setEntrees] = useState<EntreeRecord[]>([
    ...getEntreesTransfert(),
    ...entreeRecords,
  ]);

  const recharger = () => {
    setRecords(listerTransferts());
  };

  useEffect(() => {
    let cancelled = false;
    import("../lib/api").then(({ fetchEntrees }) => {
      fetchEntrees().then((data) => {
        if (cancelled) return;
        setEntrees([
          ...getEntreesTransfert(),
          ...(data && data.length > 0 ? data : entreeRecords),
        ]);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Directions connues (pour les filtres)
  const directions = useMemo(
    () =>
      Array.from(
        new Set([
          ...records.map((t) => t.directionOrigine),
          ...records.map((t) => t.directionDestination),
        ])
      ),
    [records]
  );

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return records.filter((t) => {
      const matchesSearch =
        !term ||
        t.reference.toLowerCase().includes(term) ||
        t.materiel.toLowerCase().includes(term) ||
        t.serviceOrigine.toLowerCase().includes(term) ||
        t.serviceDestination.toLowerCase().includes(term) ||
        t.directionOrigine.toLowerCase().includes(term) ||
        t.directionDestination.toLowerCase().includes(term);
      const statutAffiche = getStatutTransfertAffiche(t);
      const matchesStatus = statusFilter === "Tous" || statutAffiche === statusFilter;
      const matchesOrigine =
        directionOrigineFilter === "Toutes" ||
        t.directionOrigine === directionOrigineFilter;
      const matchesDest =
        directionDestFilter === "Toutes" ||
        t.directionDestination === directionDestFilter;
      const matchesDebut = !dateDebut || t.date >= dateDebut;
      const matchesFin = !dateFin || t.date <= dateFin;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesOrigine &&
        matchesDest &&
        matchesDebut &&
        matchesFin
      );
    });
  }, [
    records,
    searchTerm,
    statusFilter,
    directionOrigineFilter,
    directionDestFilter,
    dateDebut,
    dateFin,
  ]);

  const stats = getStatistiquesTransferts(records);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  // ------------------------------------------------- formulaire dédié
  if (showNewForm) {
    return (
      <NewTransfertPage
        user={user}
        entrees={entrees}
        onClose={() => setShowNewForm(false)}
        onCreated={(ref) => {
          setShowNewForm(false);
          recharger();
          setFlash(`✓ Transfert ${ref} créé — en attente de validation de la sortie (0/3).`);
          window.setTimeout(() => setFlash(""), 6000);
        }}
      />
    );
  }

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("Tous");
    setDirectionOrigineFilter("Toutes");
    setDirectionDestFilter("Toutes");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  };

  const statCards = [
    {
      label: "Total des transferts",
      value: stats.total,
      icon: Package,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: `Transferts du mois (${stats.moisLabel})`,
      value: stats.duMois,
      icon: CalendarDays,
      iconClass:
        "bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400",
    },
    {
      label: "En cours / En transfert",
      value: stats.enCours,
      icon: Truck,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
      label: "Transferts terminés",
      value: stats.termines,
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
            Transferts entre Directions
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gestion des mouvements de matériels entre Directions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user && (
            <button
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              Nouveau transfert
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
        <BadgeCheck className="h-4 w-4 shrink-0" />
        Transfert = déplacement RÉEL d'un matériel d'une Direction vers une
        AUTRE : SORTIE du stock d'origine (3 signatures) → EN TRANSFERT →
        ENTRÉE dans le stock destinataire (3 signatures). Même Direction =
        affectation interne (rubrique Affectations).
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
              placeholder="Rechercher par référence TRF, matériel, service, direction…"
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                {STATUTS_TRANSFERT.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Direction d'origine
              </label>
              <select
                value={directionOrigineFilter}
                onChange={(e) => {
                  setDirectionOrigineFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="Toutes">Toutes</option>
                {directions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Direction destinataire
              </label>
              <select
                value={directionDestFilter}
                onChange={(e) => {
                  setDirectionDestFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="Toutes">Toutes</option>
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
            Tableau des transferts ({filtered.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Direction origine → SORTIE → TRANSFERT → Direction destinataire →
            ENTRÉE → Traçabilité
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Référence</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Dir. origine</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Service origine</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Dir. destinataire</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Service destinataire</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Matériel</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Qté</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Progression</th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {records.length === 0
                        ? "Aucun transfert — créez le premier avec « + Nouveau transfert »."
                        : "Aucun transfert ne correspond aux critères."}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((t) => {
                    const nbSortie = getSignatureSortieCount(t);
                    const nbReception = getSignatureReceptionCount(t);
                    const statut = getStatutTransfertAffiche(t);
                    return (
                      <tr
                        key={t.reference}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-sm font-mono text-card-foreground">
                          {t.reference}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[130px] truncate">
                          {t.directionOrigine}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[140px] truncate">
                          {t.serviceOrigine}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[130px] truncate">
                          {t.directionDestination}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[140px] truncate">
                          {t.serviceDestination}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[180px] truncate">
                          {t.materiel}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground">
                          {t.quantite}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                          {new Date(`${t.date}T00:00:00`).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs whitespace-nowrap ${statutTransfertBadge(
                              statut
                            )}`}
                          >
                            {statut}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            title={`Sortie ${nbSortie}/3 — Réception ${nbReception}/3`}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono whitespace-nowrap ${
                              nbReception >= 3
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : nbSortie >= 3 || nbReception >= 1
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            }`}
                          >
                            {nbSortie}/3 · {nbReception}/3
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              title="Voir"
                              onClick={() => {
                                setSelected(t);
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
                  )} sur ${filtered.length} transferts`}
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
      <TransfertDetailModal
        open={modalOpen}
        transfert={selected}
        user={user}
        onChanged={() => {
          recharger();
          setSelected((prev) =>
            prev
              ? listerTransferts().find((t) => t.reference === prev.reference) ||
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
