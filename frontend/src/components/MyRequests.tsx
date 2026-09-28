import { useEffect, useMemo, useState } from "react";
import {
  Clipboard,
  Plus,
  Search,
  SlidersHorizontal,
  Eye,
  X,
  Check,
  Clock,
  Package,
  ArrowRight,
  History,
  Inbox,
  Send,
  Save,
  RotateCcw,
} from "lucide-react";
import { User } from "../App";
import {
  DemandeRecord,
  DemandeLigne,
  PrioriteDemande,
  STATUTS_DEMANDE,
  PRIORITES_DEMANDE,
  getDemandesForUser,
  getAllDemandes,
  getStatsDemandes,
  getTimelineDemande,
  getSortieOfDemande,
  nextDemandeReference,
  persistDemande,
  fetchDemandes,
  statutDemandeBadge,
  prioriteDemandeBadge,
  formatDateCourt,
  materielsDemande,
  quantiteDemande,
  splitDepartementDemandeur,
} from "../lib/demandes";
import { mockEquipment } from "./Equipment";

interface MyRequestsProps {
  user?: User;
  /** Ouvre directement le détail (lien « Demande associée » venu de Sorties) */
  detailRequestId?: number;
  onDetailConsumed?: () => void;
}

type FormStep = "form" | "resume";

const EMPTY_LIGNE: DemandeLigne = {
  categorie: "",
  materiel: "",
  quantite: 1,
  motif: "",
};

function splitNomPrenom(name?: string): { nom: string; prenom: string } {
  const parts = (name || "").trim().split(/\s+/);
  if (parts.length <= 1) return { nom: parts[0] || "—", prenom: "—" };
  return { nom: parts[0], prenom: parts.slice(1).join(" ") };
}

export function MyRequests({
  user,
  detailRequestId,
  onDetailConsumed,
}: MyRequestsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [priorityFilter, setPriorityFilter] = useState("Toutes");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Données : API Strapi si elle répond, sinon repli sur les données locales
  const [apiDemandes, setApiDemandes] = useState<DemandeRecord[] | null>(null);
  const [localVersion, setLocalVersion] = useState(0);
  const [dataOrigin, setDataOrigin] = useState<"chargement" | "api" | "local">(
    "chargement"
  );

  // Formulaire nouvelle demande
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<FormStep>("form");
  const [lignes, setLignes] = useState<DemandeLigne[]>([{ ...EMPTY_LIGNE }]);
  const [priorite, setPriorite] = useState<PrioriteDemande>("Normal");
  const [observation, setObservation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Détail / timeline
  const [detailDemande, setDetailDemande] = useState<DemandeRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDemandes().then((rows) => {
      if (cancelled) return;
      if (rows && rows.length > 0) {
        setApiDemandes(rows);
        setDataOrigin("api");
      } else {
        setApiDemandes(null);
        setDataOrigin("local");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Demandes du profil connecté
  const demandes = useMemo(() => {
    const source = apiDemandes ?? getDemandesForUser(user);
    if (!user) return source;
    if (user.role !== "demandeur") return source;
    const { direction, service } = splitDepartementDemandeur(
      user.department || ""
    );
    const orgaMatch = (d: DemandeRecord) =>
      (user.name && d.demandeur === user.name) ||
      (direction &&
        d.direction.toLowerCase().includes(direction.toLowerCase())) ||
      (service && d.service.toLowerCase().includes(service.toLowerCase()));
    return source.filter(orgaMatch);
  }, [apiDemandes, user, localVersion]);

  // Ouverture automatique du détail (lien « Demande associée » depuis Sorties)
  useEffect(() => {
    if (!detailRequestId) return;
    const target = demandes.find((d) => d.id === detailRequestId);
    if (target) setDetailDemande(target);
    onDetailConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailRequestId]);

  const stats = getStatsDemandes(demandes);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return demandes.filter((d) => {
      const matchesSearch =
        !term ||
        d.reference.toLowerCase().includes(term) ||
        materielsDemande(d).toLowerCase().includes(term) ||
        d.demandeur.toLowerCase().includes(term) ||
        d.service.toLowerCase().includes(term) ||
        d.direction.toLowerCase().includes(term) ||
        (d.motif || "").toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "Tous" || d.statut === statusFilter;
      const matchesPriority =
        priorityFilter === "Toutes" || d.priorite === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [demandes, searchTerm, statusFilter, priorityFilter]);

  const categories = useMemo(
    () => Array.from(new Set(mockEquipment.map((e) => e.category))),
    []
  );
  const materiels = useMemo(
    () => mockEquipment.map((e) => e.name),
    []
  );

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("Tous");
    setPriorityFilter("Toutes");
  };

  const openForm = () => {
    setLignes([{ ...EMPTY_LIGNE }]);
    setPriorite("Normal");
    setObservation("");
    setFormError(null);
    setFormStep("form");
    setShowForm(true);
  };

  const addLigne = () => setLignes((prev) => [...prev, { ...EMPTY_LIGNE }]);

  const updateLigne = (index: number, patch: Partial<DemandeLigne>) =>
    setLignes((prev) =>
      prev.map((ligne, i) => (i === index ? { ...ligne, ...patch } : ligne))
    );

  const removeLigne = (index: number) =>
    setLignes((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );

  const validateForm = (): boolean => {
    const valides = lignes.filter(
      (l) => l.materiel.trim() && Number(l.quantite) > 0
    );
    if (valides.length === 0) {
      setFormError("Indiquez au moins un matériel avec une quantité valide.");
      return false;
    }
    setFormError(null);
    return true;
  };

  const goToResume = () => {
    if (validateForm()) setFormStep("resume");
  };

  /** Crée la demande (envoi ou brouillon) */
  const submitDemande = async (statut: "Brouillon" | "En attente") => {
    if (statut === "En attente" && !validateForm()) return;

    const all = getAllDemandes();
    const reference = nextDemandeReference(all);
    const orga = splitDepartementDemandeur(user?.department || "");
    const today = new Date().toISOString().slice(0, 10);
    const id = Math.max(0, ...all.map((d) => d.id)) + 1;
    const lignesValidées = lignes.filter(
      (l) => l.materiel.trim() && Number(l.quantite) > 0
    );

    const record: DemandeRecord = {
      id,
      reference,
      date: today,
      dateEnvoi: statut === "En attente" ? today : undefined,
      lignes: lignesValidées.map((l) => ({ ...l, quantite: Number(l.quantite) })),
      priorite,
      statut,
      observation: observation.trim() || undefined,
      direction: orga.direction,
      service: orga.service,
      demandeur: user?.name || "Demandeur",
      fonction: "Fonction non renseignée",
    };

    // Tentative d'enregistrement côté API (repli local si le backend est
    // hors ligne ou si l'authentification n'est pas encore branchée)
    try {
      const { api } = await import("../lib/api");
      for (const ligne of record.lignes) {
        await api.post("/api/demandes", {
          data: {
            reference:
              record.lignes.length > 1
                ? `${reference}-${record.lignes.indexOf(ligne) + 1}`
                : reference,
            groupe: reference,
            type: "sortie",
            designation_materiel: ligne.materiel,
            quantite: ligne.quantite,
            motif: ligne.motif || undefined,
            priorite:
              priorite === "Urgent"
                ? "urgent"
                : priorite === "Critique"
                ? "critique"
                : "normal",
            statut: statut === "Brouillon" ? "brouillon" : "en_attente",
            date_demande: today,
            date_envoi: statut === "En attente" ? today : undefined,
            fonction: record.fonction,
            observation: record.observation,
          },
        });
      }
      fetchDemandes().then((rows) => {
        if (rows && rows.length > 0) {
          setApiDemandes(rows);
          setDataOrigin("api");
        }
      });
    } catch {
      // repli local : la demande reste consultable dans l'application
    }

    persistDemande(record);
    setLocalVersion((v) => v + 1);

    setShowForm(false);
    setFormStep("form");
    setSuccessMessage(
      statut === "Brouillon"
        ? `Demande ${reference} enregistrée comme brouillon.`
        : `Demande ${reference} envoyée — statut « En attente » de validation.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const statCards = [
    {
      label: "Mes demandes",
      value: stats.total,
      icon: Clipboard,
      iconClass:
        "bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400",
    },
    {
      label: "En attente",
      value: stats.enAttente,
      icon: Clock,
      iconClass:
        "bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400",
    },
    {
      label: "Validées",
      value: stats.validees,
      icon: Check,
      iconClass:
        "bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400",
    },
    {
      label: "Refusées",
      value: stats.refusees,
      icon: X,
      iconClass:
        "bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400",
    },
  ];

  const { nom, prenom } = splitNomPrenom(user?.name);
  const orgaProfil = splitDepartementDemandeur(user?.department || "");

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Message de succès */}
      {successMessage && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">
            Mes demandes
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Créez et suivez vos demandes de matériels
          </p>
          <div className="mt-1 text-xs text-muted-foreground">
            {dataOrigin === "chargement" && "Connexion au serveur..."}
            {dataOrigin === "api" && "Source : API Strapi (backend en ligne)"}
            {dataOrigin === "local" &&
              "Source : données locales (backend hors ligne ou vide)"}
          </div>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          Nouvelle demande
        </button>
      </div>

      {/* Bandeau rôle */}
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
        <Inbox className="h-4 w-4" />
        Vous créez, modifiez (brouillon) et annulez vos demandes : la
        validation appartient aux responsables habilités.
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
              placeholder="Rechercher par référence, matériel, catégorie, service, direction, motif..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
            />
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              searchOpen
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-background hover:bg-accent hover:text-accent-foreground"
            }`}
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

          {filtersOpen && (
            <div className="grid gap-3 sm:grid-cols-3 flex-1">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Statut
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="Tous">Tous les statuts</option>
                  {STATUTS_DEMANDE.map((statut) => (
                    <option key={statut} value={statut}>
                      {statut}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Priorité
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
                >
                  <option value="Toutes">Toutes les priorités</option>
                  {PRIORITES_DEMANDE.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
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
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Liste de mes demandes ({filtered.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Demande → Validation → Préparation → Sortie → Traçabilité
          </p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Référence
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Matériel
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Quantité
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Direction
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Service
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Priorité
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Sortie associée
                  </th>
                  <th className="text-left py-3 px-3 text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <Clipboard className="h-10 w-10 opacity-50" />
                        <div>
                          <div className="text-card-foreground font-medium">
                            {demandes.length === 0
                              ? "Aucune demande pour le moment"
                              : "Aucune demande ne correspond aux critères"}
                          </div>
                          <div className="text-xs mt-1">
                            {demandes.length === 0
                              ? "Créez votre première demande de matériel."
                              : "Modifiez votre recherche ou vos filtres."}
                          </div>
                        </div>
                        {demandes.length === 0 && (
                          <button
                            onClick={openForm}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                          >
                            <Plus className="h-4 w-4" />
                            Nouvelle demande
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((demande) => {
                    const sortie = getSortieOfDemande(demande);
                    return (
                      <tr
                        key={demande.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-sm font-mono text-card-foreground">
                          {demande.reference}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground whitespace-nowrap">
                          {formatDateCourt(demande.date)}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[220px] truncate">
                          {materielsDemande(demande)}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground">
                          {quantiteDemande(demande)}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground">
                          {demande.direction}
                        </td>
                        <td className="py-3 px-3 text-sm text-card-foreground max-w-[160px] truncate">
                          {demande.service}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${prioriteDemandeBadge(
                              demande.priorite
                            )}`}
                          >
                            {demande.priorite}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${statutDemandeBadge(
                              demande.statut
                            )}`}
                          >
                            {demande.statut}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {sortie ? (
                            <span className="inline-flex items-center gap-1 font-mono text-card-foreground">
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              {sortie.reference !== "—"
                                ? sortie.reference
                                : sortie.id}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <button
                              title="Voir le suivi"
                              onClick={() => setDetailDemande(demande)}
                              className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              title="Voir l'historique"
                              onClick={() => setDetailDemande(demande)}
                              className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors"
                            >
                              <History className="h-4 w-4" />
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
        </div>
      </div>

      {/* --------------------------------------------------------------
          Formulaire « Nouvelle demande »
      -------------------------------------------------------------- */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
              <div>
                <h3 className="text-lg text-card-foreground flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  {formStep === "form"
                    ? "Nouvelle demande"
                    : "Résumé de la demande"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {formStep === "form"
                    ? "Renseignez les matériels demandés"
                    : "Vérifiez le récapitulatif avant envoi"}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {formError && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                  <X className="h-4 w-4" />
                  {formError}
                </div>
              )}

              {/* Informations du demandeur (profil connecté) */}
              <div>
                <h4 className="text-sm text-card-foreground mb-3">
                  Informations du demandeur
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Nom", value: nom },
                    { label: "Prénom", value: prenom },
                    { label: "Direction", value: orgaProfil.direction },
                    { label: "Service", value: orgaProfil.service },
                    { label: "Fonction", value: "Fonction non renseignée" },
                  ].map((field) => (
                    <div
                      key={field.label}
                      className="p-3 border border-border rounded-lg bg-muted/20"
                    >
                      <div className="text-xs text-muted-foreground">
                        {field.label}
                      </div>
                      <div className="text-sm text-card-foreground">
                        {field.value}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Récupérées automatiquement depuis votre profil connecté.
                </p>
              </div>

              {formStep === "form" ? (
                <>
                  {/* Matériel demandé */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm text-card-foreground">
                        Matériel demandé
                      </h4>
                      <button
                        onClick={addLigne}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Ajouter un matériel
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-border rounded-lg">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                              Catégorie
                            </th>
                            <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                              Matériel
                            </th>
                            <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                              Qté
                            </th>
                            <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                              Motif
                            </th>
                            <th className="w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {lignes.map((ligne, index) => (
                            <tr
                              key={index}
                              className="border-b border-border last:border-b-0"
                            >
                              <td className="py-2 px-2">
                                <select
                                  value={ligne.categorie}
                                  onChange={(e) =>
                                    updateLigne(index, {
                                      categorie: e.target.value,
                                    })
                                  }
                                  className="w-36 px-2 py-1.5 border border-border rounded bg-background text-sm"
                                >
                                  <option value="">Catégorie...</option>
                                  {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  list="materiels-demandes"
                                  value={ligne.materiel}
                                  onChange={(e) =>
                                    updateLigne(index, {
                                      materiel: e.target.value,
                                    })
                                  }
                                  placeholder="Ex. Ordinateur portable HP"
                                  className="w-full min-w-40 px-2 py-1.5 border border-border rounded bg-background text-sm"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={ligne.quantite}
                                  onChange={(e) =>
                                    updateLigne(index, {
                                      quantite: Number(e.target.value),
                                    })
                                  }
                                  className="w-20 px-2 py-1.5 border border-border rounded bg-background text-sm"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  value={ligne.motif}
                                  onChange={(e) =>
                                    updateLigne(index, {
                                      motif: e.target.value,
                                    })
                                  }
                                  placeholder="Ex. Nouveau, Service..."
                                  className="w-full min-w-32 px-2 py-1.5 border border-border rounded bg-background text-sm"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  onClick={() => removeLigne(index)}
                                  disabled={lignes.length === 1}
                                  title="Retirer la ligne"
                                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <datalist id="materiels-demandes">
                      {materiels.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>

                  {/* Priorité + observation */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">
                        Priorité
                      </label>
                      <select
                        value={priorite}
                        onChange={(e) =>
                          setPriorite(e.target.value as PrioriteDemande)
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
                      >
                        {PRIORITES_DEMANDE.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">
                        Observation
                      </label>
                      <textarea
                        rows={3}
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Remarques complémentaires..."
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm resize-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* ---------------- Résumé avant validation ---------------- */
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "Demandeur", value: `${nom} ${prenom}` },
                      {
                        label: "Direction / Service",
                        value: `${orgaProfil.direction} / ${orgaProfil.service}`,
                      },
                      { label: "Fonction", value: "Fonction non renseignée" },
                      { label: "Priorité", value: priorite },
                      {
                        label: "Nombre de matériels",
                        value: String(
                          lignes.filter((l) => l.materiel.trim()).length
                        ),
                      },
                      {
                        label: "Quantité totale",
                        value: String(
                          lignes.reduce(
                            (sum, l) => sum + (Number(l.quantite) || 0),
                            0
                          )
                        ),
                      },
                    ].map((field) => (
                      <div
                        key={field.label}
                        className="p-3 border border-border rounded-lg bg-muted/20"
                      >
                        <div className="text-xs text-muted-foreground">
                          {field.label}
                        </div>
                        <div className="text-sm text-card-foreground">
                          {field.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Catégorie
                          </th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Matériel
                          </th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Qté
                          </th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Motif
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lignes
                          .filter((l) => l.materiel.trim())
                          .map((ligne, index) => (
                            <tr
                              key={index}
                              className="border-b border-border last:border-b-0"
                            >
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {ligne.categorie || "—"}
                              </td>
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {ligne.materiel}
                              </td>
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {ligne.quantite}
                              </td>
                              <td className="py-2 px-3 text-sm text-card-foreground">
                                {ligne.motif || "—"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {observation.trim() && (
                    <div className="p-3 border border-border rounded-lg bg-muted/20">
                      <div className="text-xs text-muted-foreground mb-1">
                        Observation
                      </div>
                      <div className="text-sm text-card-foreground">
                        {observation}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-border sticky bottom-0 bg-card">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              {formStep === "resume" && (
                <button
                  onClick={() => setFormStep("form")}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Retour
                </button>
              )}
              <div className="flex-1" />
              {formStep === "form" ? (
                <>
                  <button
                    onClick={() => submitDemande("Brouillon")}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    Enregistrer comme brouillon
                  </button>
                  <button
                    onClick={goToResume}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Voir le résumé
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => submitDemande("En attente")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Envoyer la demande
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------
          Détail : timeline de suivi + sortie associée
      -------------------------------------------------------------- */}
      {detailDemande &&
        (() => {
          const timeline = getTimelineDemande(detailDemande);
          const sortie = getSortieOfDemande(detailDemande);
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-border">
                  <div>
                    <h3 className="text-lg text-card-foreground flex items-center gap-2">
                      <Clipboard className="h-5 w-5 text-primary" />
                      Demande <span className="font-mono">{detailDemande.reference}</span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${statutDemandeBadge(
                          detailDemande.statut
                        )}`}
                      >
                        {detailDemande.statut}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${prioriteDemandeBadge(
                          detailDemande.priorite
                        )}`}
                      >
                        {detailDemande.priorite}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {materielsDemande(detailDemande)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailDemande(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Timeline de suivi */}
                  <div>
                    <h4 className="text-sm text-card-foreground mb-4 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Suivi de la demande
                    </h4>
                    <ol className="space-y-0">
                      {timeline.map((step, index) => (
                        <li key={step.label} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                                step.ok
                                  ? "border-green-500 bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
                                  : "border-border bg-muted text-muted-foreground"
                              }`}
                            >
                              {step.ok ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-current" />
                              )}
                            </span>
                            {index < timeline.length - 1 && (
                              <span
                                className={`w-0.5 h-6 ${
                                  step.ok ? "bg-green-500/60" : "bg-border"
                                }`}
                              />
                            )}
                          </div>
                          <div className="pb-4">
                            <div className="text-sm text-card-foreground">
                              {step.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {step.date
                                ? `${formatDateCourt(step.date)}${
                                    step.date.includes("T")
                                      ? ` — ${new Date(
                                          step.date
                                        ).toLocaleTimeString("fr-FR", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}`
                                      : ""
                                  }`
                                : "—"}
                              {step.acteur ? ` — ${step.acteur}` : ""}
                            </div>
                            <div
                              className={`text-xs mt-0.5 ${
                                step.ok
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {step.statut}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Informations */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Référence
                      </div>
                      <div className="text-sm font-mono text-card-foreground">
                        {detailDemande.reference}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Date de demande
                      </div>
                      <div className="text-sm text-card-foreground">
                        {formatDateCourt(detailDemande.date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Demandeur
                      </div>
                      <div className="text-sm text-card-foreground">
                        {detailDemande.demandeur}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Direction
                      </div>
                      <div className="text-sm text-card-foreground">
                        {detailDemande.direction}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Service
                      </div>
                      <div className="text-sm text-card-foreground">
                        {detailDemande.service}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Validée par
                      </div>
                      <div className="text-sm text-card-foreground">
                        {detailDemande.validePar || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Lignes demandées */}
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Catégorie
                          </th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Matériel
                          </th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Qté
                          </th>
                          <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                            Motif
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailDemande.lignes.map((ligne, index) => (
                          <tr
                            key={index}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="py-2 px-3 text-sm text-card-foreground">
                              {ligne.categorie || "—"}
                            </td>
                            <td className="py-2 px-3 text-sm text-card-foreground">
                              {ligne.materiel}
                            </td>
                            <td className="py-2 px-3 text-sm text-card-foreground">
                              {ligne.quantite}
                            </td>
                            <td className="py-2 px-3 text-sm text-card-foreground">
                              {ligne.motif || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {detailDemande.observation && (
                    <div className="p-4 border border-border rounded-lg bg-muted/20">
                      <h4 className="text-sm text-card-foreground mb-1">
                        Observation
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {detailDemande.observation}
                      </p>
                    </div>
                  )}

                  {/* Sortie associée (lien demande -> sortie) */}
                  <div className="p-4 border border-border rounded-lg bg-muted/20">
                    <h4 className="text-sm text-card-foreground mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Sortie associée
                    </h4>
                    {sortie ? (
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Référence
                          </div>
                          <div className="text-sm font-mono text-card-foreground">
                            {sortie.reference !== "—"
                              ? sortie.reference
                              : sortie.id}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Statut
                          </div>
                          <div
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                              sortie.statut === "Sortie effectuée"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                            }`}
                          >
                            {sortie.statut}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Bénéficiaire
                          </div>
                          <div className="text-sm text-card-foreground">
                            {sortie.beneficiaire}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune sortie enregistrée pour le moment.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
