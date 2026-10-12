import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  BookOpen,
  Search,
  Filter,
  Eye,
  Edit,
  FileText,
  Package,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Euro,
  Hash,
  Building,
  Grid3X3,
  List,
  Printer,
} from "lucide-react";

import {
  creerRegistreComptable,
  filtrerLignesJournal,
  trierLignesJournal,
  statistiquesRegistre,
  type JournalLigne,
} from "../lib/journal-registre";
import {
  fetchEntrees,
  fetchSorties,
  fetchMaterialsOrThrow,
  type EchecApi,
} from "../lib/api";
import { MaterialPhoto } from "./MaterialPhoto";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Type interne du Journal : une ligne est soit une vraie écriture (JournalLigne),
// soit une entrée en cours (EntreeRecord non validée) pour l'onglet dédié.
// ---------------------------------------------------------------------------

/** Représente une entrée Strapi dans son état brut (pour l'onglet "Non
 *  comptabilisées"). On la conserve avec son type d'origine pour pouvoir
 *  afficher l'étape bloquante. */
type EntreeEnCour = {
  enregistrement: {
    id: string;
    reference: string;
    dateEntree: string;
    materiel: string;
    categorie: string;
    quantite: number;
    fournisseur: string;
    statutServeur: string;
    statutAffiche: string;
    signatureManquante?: string;
    documents?: Array<{ nom: string; type: string }>;
    signatures?: {
      depositaire?: string;
      chefService1?: string;
      chefService2?: string;
    };
  };
};

// État d'une ligne affichée dans le registre (écritures validées + sorties).
type LigneRegistre = JournalLigne & {
  /** Identifiant de l'écriture source dans Strapi (pour le détail). */
  sourceId: string;
};

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

type ViewMode = "table" | "grid";

/** Désignation normalisée (casse, espaces) pour comparer article à article. */
function cleDesignation(valeur?: string | null): string {
  return (valeur ?? "").trim().toLowerCase();
}

/** Erreur d'API affichée à l'utilisateur. */
function libellerEchec(echec: EchecApi): string {
  switch (echec) {
    case "reseau":
      return "Le serveur comptabilité est injoignable. Réessayez dans quelques instants.";
    case "session_absente":
      return "Votre session est expirée. Reconnectez-vous pour consulter le registre.";
    case "session_expiree":
      return "Votre session est expirée. Reconnectez-vous pour consulter le registre.";
    case "acces_refuse":
      return "Votre compte n'a pas accès au registre comptable. Contactez un responsable.";
    default:
      return "Impossible de charger le registre.";
  }
}

/** Étape bloquante pour une entrée non validée. */
function etapeBloquante(enregistrement: EntreeEnCour["enregistrement"]): string {
  const s = enregistrement.statutServeur;
  if (s === "brouillon") {
    return "Brouillon — non soumis au circuit de validation";
  }
  if (s === "en_attente") {
    if (!enregistrement.signatures?.depositaire) {
      return "En attente de signature du Dépositaire";
    }
    if (!enregistrement.signatures?.chefService1) {
      return "En attente de signature du Chef de service 1";
    }
    if (!enregistrement.signatures?.chefService2) {
      return "En attente de signature du Chef de service 2";
    }
    return "En attente de finalisation du circuit de validation";
  }
  if (s === "verifiee") {
    if (!enregistrement.signatures?.chefService1) {
      return "En attente de signature du Chef de service 1";
    }
    if (!enregistrement.signatures?.chefService2) {
      return "En attente de signature du Chef de service 2";
    }
    return "En attente de la dernière signature du circuit de validation";
  }
  if (s === "rejetee") {
    return "Entrée rejetée — non comptabilisée";
  }
  return `Statut non traité (${s})`;
}

/** Enumère les raisons pour lesquelles une entrée n'est pas encore comptabilisée. */
function enCour(entree: EntreeEnCour["enregistrement"]): boolean {
  return entree.statutServeur === "brouillon" ||
    entree.statutServeur === "en_attente" ||
    entree.statutServeur === "verifiee" ||
    entree.statutServeur === "rejetee";
}

/** Extrait les pièces justificatives d'une entrée en cours pour affichage. */
function piecesJustificatives(
  docs: Array<{ nom: string; type: string }> | undefined
): string[] {
  if (!docs || docs.length === 0) return [];
  return docs.map((d) => d.nom);
}

export async function photoPourEntreeJournal(
  ligne: JournalLigne
): Promise<string | null> {
  try {
    const entrees = await fetchEntrees();
    if (!entrees) return null;
    const entree = entrees.find((e) => e.id === ligne.sourceId);
    if (!entree) return null;
    const lignes = entree.lignes ?? [];
    const ligneMat =
      lignes.find(
        (l) =>
          cleDesignation(l.designation) === cleDesignation(ligne.designation)
      ) ?? lignes[0];
    const photoLigne = (ligneMat?.photos ?? []).find(Boolean);
    if (photoLigne) return photoLigne;
  } catch {
    // API indisponible : on tente la fiche matériel ci-dessous.
  }
  try {
    const materiaux = await fetchMaterialsOrThrow();
    const materiel = materiaux.find(
      (m) =>
        cleDesignation(m.designation) === cleDesignation(ligne.designation)
    );
    const photoFiche = (materiel?.photos ?? []).find(Boolean);
    if (photoFiche) return photoFiche;
  } catch {
    // Aucune source disponible : pas de photo, sans erreur affichée.
  }
  return null;
}

export function Journal() {
  // ---- État de chargement et d'erreur ----
  const [chargement, setChargement] = useState(true);
  const [erreurApi, setErreurApi] = useState<EchecApi | null>(null);

  // ---- Données réelles ----
  const [entrees, setEntrees] = useState<ReturnType<typeof fetchEntrees>>(null);
  const [sorties, setSorties] = useState<ReturnType<typeof fetchSorties>>(null);

  // ---- Entrées en cours (non validées) ----
  const [entreesEnCour, setEntreesEnCour] = useState<EntreeEnCour[]>([]);

  // ---- Registre calculé ----
  const [registre, setRegistre] = useState<LigneRegistre[]>([]);

  // ---- Interface de recherche / filtrage ----
  const [searchTerm, setSearchTerm] = useState("");
  // ---- Filtres (jamais de filtre sur le statut matériel : les écritures
  //      validées n'ont plus de statut en_stock / distribue / maintenance).
  //      On filtre par date, origine, sens (Entrée/Sortie) et terme de recherche.) ----
  const [filtres, setFiltres] = useState<{
    dateDebut?: string;
    dateFin?: string;
    origine?: string;
    sens?: "Entrée" | "Sortie" | "tout";
  }>({});
  const [showFilters, setShowFilters] = useState(false);

  // ---- Options d'affichage ----
  const [options, setOptions] = useState<{
    trierPar: "date" | "numeroOrdre" | "valeur" | "designation";
    ordreTri: "asc" | "desc";
  }>({
    trierPar: "date",
    ordreTri: "desc",
  });

  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // ---- Détail d'une écriture ----
  const [selectedLine, setSelectedLine] = useState<JournalLigne | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [photoDetail, setPhotoDetail] = useState<string | null>(null);
  const [photoChargement, setPhotoChargement] = useState(false);

  // ---- Onglet actif ----
  const [activeTab, setActiveTab] = useState<"registre" | "enoncomptees">(
    "registre"
  );

  // ---------------------------------------------------------------------------
  // Chargement initial des données réelles
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      setChargement(true);
      setErreurApi(null);

      let entreesResult: ReturnType<typeof fetchEntrees> = null;
      let sortiesResult: ReturnType<typeof fetchSorties> = null;
      try {
        [entreesResult, sortiesResult] = await Promise.all([
          fetchEntrees(),
          fetchSorties(),
        ]);
      } catch (e) {
        if (!actif) return;
        setErreurApi("reseau");
        setEntrees([]);
        setSorties([]);
        setChargement(false);
        return;
      }

      if (!actif) return;

      if (entreesResult === null || sortiesResult === null) {
        // Une des deux requêtes a échoué : on affiche le message d'erreur
        // sans jamais replier sur des données fictives.
        try {
          setErreurApi(
            entreesResult === null
              ? (await fetchEntreesDetail())?.echec ?? "reseau"
              : "reseau"
          );
        } catch {
          setErreurApi("reseau");
        }
        setEntrees(entreesResult ?? []);
        setSorties(sortiesResult ?? []);
        setChargement(false);
        return;
      }

      setEntrees(entreesResult);
      setSorties(sortiesResult);

      // Déduire les entrées en cours (non validées) pour l'onglet dédié.
      const entreesEnCoursCalculees: EntreeEnCour[] = entreesResult
        .filter((e) => enCour(e))
        .map((e) => ({
          enregistrement: {
            id: e.id,
            reference: e.reference,
            dateEntree: e.dateEntree,
            materiel: e.materiel,
            categorie: e.categorie,
            quantite: e.quantite,
            fournisseur: e.fournisseur,
            statutServeur: e.statutServeur ?? "",
            statutAffiche: e.statut,
            signatureManquante:
              e.signatures?.depositaire
                ? e.signatures?.chefService1
                  ? e.signatures?.chefService2
                    ? undefined
                    : "chefService2"
                  : "chefService1"
                : "depositaire",
            documents: e.documents,
            signatures: e.signatures,
          },
        }));

      setEntreesEnCour(entreesEnCoursCalculees);

      // Construire le registre à partir des entrées validées + sorties effectuées.
      const lignes = creerRegistreComptable(entreesResult, sortiesResult);

      if (!actif) return;

      setRegistre(lignes);
      setChargement(false);
    };

    charger();

    return () => {
      actif = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Détail photo (lancement différé à l'ouverture du modal)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!showDetailsModal || !selectedLine) {
      setPhotoDetail(null);
      setPhotoChargement(false);
      return;
    }

    let actif = true;
    setPhotoDetail(null);
    setPhotoChargement(true);

    photoPourEntreeJournal(selectedLine)
      .then((photo) => {
        if (actif) setPhotoDetail(photo);
      })
      .finally(() => {
        if (actif) setPhotoChargement(false);
      });

    return () => {
      actif = false;
    };
  }, [showDetailsModal, selectedLine]);

  // ---------------------------------------------------------------------------
  // Filtrage et tri du registre (Calculé à chaque changement de critères)
  // ---------------------------------------------------------------------------

  const lignesFiltrées = filtrerLignesJournal(registre, {
    searchTerm: searchTerm || undefined,
    dateDebut: filtres.dateDebut,
    dateFin: filtres.dateFin,
    origine: filtres.origine,
    sens: filtres.sens || "tout",
  });

  const lignesTriees = trierLignesJournal(lignesFiltrées, {
    trierPar: options.trierPar,
    ordreTri: options.ordreTri,
  });

  const stats = statistiquesRegistre(lignesTriees);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleViewDetails = (ligne: JournalLigne) => {
    setSelectedLine(ligne);
    setShowDetailsModal(true);
  };

  // ---------------------------------------------------------------------------
  // Affichage des statistiques (uniquement sur les données réelles)
  // ---------------------------------------------------------------------------

  const nombreEntrees =
    entrees?.filter((e) => e.statut === "Validée").length ?? 0;
  const nombreSorties =
    sorties?.filter((s) => s.statut === "Sortie effectuée").length ?? 0;

  // ---------------------------------------------------------------------------
  // Export : désactivé, message "bientôt disponible"
  // ---------------------------------------------------------------------------

  const exportPDF = () => {
    toast.info("Export PDF bientôt disponible", {
      description: "Le registre est actuellement affiché en lecture seule.",
    });
  };

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Journal de Comptabilité Matière
          </h1>
          <p className="text-muted-foreground">
            Registre officiel des mouvements de matériel avec traçabilité
            comptable complète
          </p>
        </div>
        <div className="flex gap-2">
          {/* Bouton d'export : désactivé, message "bientôt disponible" */}
          <Button
            variant="outline"
            onClick={exportPDF}
            disabled
            title="Bientôt disponible"
          >
            <Printer className="h-4 w-4 mr-2" />
            Export PDF
            <Badge
              variant="secondary"
              className="ml-2 font-normal text-xs"
              style={{ background: "transparent", border: "none" }}
            >
              bientôt disponible
            </Badge>
          </Button>
        </div>
      </div>

      {/* État de chargement */}
      {chargement && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
          <BookOpen className="h-10 w-10 animate-pulse opacity-50" />
          <p className="text-sm">Chargement du registre…</p>
        </div>
      )}

      {/* État d'erreur */}
      {!chargement && erreurApi && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  Impossible de charger le registre
                </p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                  {libellerEchec(erreurApi)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Aucune donnée fictive n'est affichée. Recommencez l'action ou
                  contactez un responsable si le problème persiste.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistiques : uniquement données réelles */}
      {!chargement && !erreurApi && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total Entrées</CardTitle>
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{nombreEntrees}</div>
              <p className="text-xs text-muted-foreground">
                Écritures validées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total Sorties</CardTitle>
              <Euro className="h-6 w-6 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{nombreSorties}</div>
              <p className="text-xs text-muted-foreground">Sorties effectuées</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Valeur Totales</CardTitle>
              <Package className="h-6 w-6 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">
                {stats.totalValeurEntrees.toLocaleString()} Ar
              </div>
              <p className="text-xs text-muted-foreground">
                Total des entrées validées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Nombre Total</CardTitle>
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">
                {stats.nombreEntrees + stats.nombreSorties}
              </div>
              <p className="text-xs text-muted-foreground">
                Total des mouvements
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Écritures en cours</CardTitle>
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{entreesEnCour.length}</div>
              <p className="text-xs text-muted-foreground">
                Non comptabilisées
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglets : Registre / Non comptabilisées */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="registre">Registre officiel</TabsTrigger>
          <TabsTrigger value="enoncomptees">
            Non comptabilisées ({entreesEnCour.length})
          </TabsTrigger>
        </TabsList>

        {/* ---- Onglet Registre officiel ---- */}
        <TabsContent value="registre" className="mt-4">
          {/* Contrôles de recherche et filtres */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Recherche et Filtres</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className={showFilters ? "bg-primary text-primary-foreground" : ""}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtres
                  </Button>
                  <div className="flex items-center border border-border rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`p-2 rounded transition-colors ${
                        viewMode === "table"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded transition-colors ${
                        viewMode === "grid"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par numéro d'ordre, désignation, pièce justificative…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Date début
                      </label>
                      <Input
                        type="date"
                        value={filtres.dateDebut || ""}
                        onChange={(e) =>
                          setFiltres((prev) => ({
                            ...prev,
                            dateDebut: e.target.value || undefined,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Date fin
                      </label>
                      <Input
                        type="date"
                        value={filtres.dateFin || ""}
                        onChange={(e) =>
                          setFiltres((prev) => ({
                            ...prev,
                            dateFin: e.target.value || undefined,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Origine
                      </label>
                      <Select
                        value={filtres.origine || ""}
                        onValueChange={(value) =>
                          setFiltres((prev) => ({
                            ...prev,
                            origine: value || undefined,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Toutes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Toutes</SelectItem>
                          <SelectItem value="fournisseur">Fournisseur</SelectItem>
                          <SelectItem value="donation">Donation</SelectItem>
                          <SelectItem value="retour">Retour</SelectItem>
                          <SelectItem value="transfert">Transfert</SelectItem>
                          <SelectItem value="entreprise">Entreprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Sens
                      </label>
                      <Select
                        value={filtres.sens || "tout"}
                        onValueChange={(value) =>
                          setFiltres((prev) => ({
                            ...prev,
                            sens: value as "Entrée" | "Sortie" | "tout",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tous" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tout">Toutes</SelectItem>
                          <SelectItem value="Entrée">Entrées</SelectItem>
                          <SelectItem value="Sortie">Sorties</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}                    <div className="text-sm text-muted-foreground">
                  {lignesTriees.length} ligne(s) affichée(s) sur {registre.length} — Valeur filtrée : {lignesTriees.reduce((s, l) => s + l.montant, 0).toLocaleString()} Ar
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contenu du registre */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Registre officiel
              </CardTitle>
              <CardDescription>
                Écritures validées et sorties effectuées, triées par date de
                validation (la plus récente en premier).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lignesTriees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {registre.length === 0
                      ? "Aucune écriture validée"
                      : "Aucune écriture ne correspond aux critères sélectionnés"}
                  </p>
                  <p className="text-sm">
                    {registre.length === 0
                      ? "Les écritures apparaissent dans le registre dès qu'elles sont validées par les 3 signatures."
                      : "Ajustez vos critères de recherche."}
                  </p>
                </div>
              ) : viewMode === "table" ? (
                <div className="space-y-4">
                  {lignesTriees.map((ligne) => (
                    <LigneRegistreTable
                      key={ligne.id}
                      ligne={ligne}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lignesTriees.map((ligne) => (
                    <LigneRegistreGrid
                      key={ligne.id}
                      ligne={ligne}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Onglet Non comptabilisées ---- */}
        <TabsContent value="enoncomptees" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Non comptabilisées
              </CardTitle>
              <CardDescription>
                Entrées en cours de validation (brouillon, en attente, vérifiée ou
                rejetée). Elles ne comptent pas dans les statistiques ni les
                totaux du registre.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {entreesEnCour.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune écriture en cours</p>
                  <p className="text-sm">
                    Toutes les entrées ont été comptabilisées ou n'existent pas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {entreesEnCour.map(({ enregistrement }) => (
                    <div
                      key={enregistrement.id}
                      className="border rounded-lg p-4 bg-amber-50/30 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                              {enregistrement.reference}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                            >
                              {enregistrement.statutAffiche}
                            </Badge>
                          </div>
                          <h3 className="font-medium">
                            {enregistrement.materiel}
                          </h3>
                          <div className="text-sm text-muted-foreground mt-1">
                            <p>
                              Fournisseur : {enregistrement.fournisseur}
                            </p>
                            <p>
                              Quantité : {enregistrement.quantite} unité(s)
                            </p>
                            {piecesJustificatives(enregistrement.documents).length > 0 && (
                              <p>
                                Pièce(s) :{" "}
                                {piecesJustificatives(
                                  enregistrement.documents
                                ).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Blocage :{" "}
                          </span>
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {etapeBloquante(enregistrement)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Détails d'une ligne */}
      {selectedLine && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détails de l'écriture</DialogTitle>
              <DialogDescription>
                {selectedLine.sens} n° {selectedLine.numeroOrdre} —{" "}
                {selectedLine.designation}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Photo */}
              <div className="flex items-start gap-4">
                <MaterialPhoto
                  photo={photoDetail}
                  designation={selectedLine.designation}
                  alt={`Photo — ${selectedLine.designation}`}
                  className="h-24 w-24 rounded-lg object-cover border border-border flex-shrink-0"
                />
                <div className="text-sm">
                  <p className="font-medium mb-1">Photo</p>
                  {photoChargement ? (
                    <p className="text-muted-foreground">
                      Chargement de la photo…
                    </p>
                  ) : photoDetail ? (
                    <p className="text-muted-foreground">
                      Photo de contrôle du magasinier ou photo de référence de
                      la fiche matériel.
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Aucune photo enregistrée pour cet article.
                    </p>
                  )}
                </div>
              </div>

              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Numéro d'ordre
                  </label>
                  <p className="font-mono">{selectedLine.numeroOrdre}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Référence
                  </label>
                  <p className="font-mono">{selectedLine.reference}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Date de validation
                  </label>
                  <p>
                    {new Date(selectedLine.dateValidation).toLocaleDateString(
                      "fr-FR"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Sens
                  </label>
                  <p>{selectedLine.sens}</p>
                </div>
              </div>

              {/* Fournisseur / Origine */}
              <div>
                <h4 className="font-medium mb-3">Origine</h4>
                <div className="bg-muted/20 p-4 rounded-lg space-y-2">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Fournisseur / Émetteur :
                    </span>
                    <p>{selectedLine.fournisseur}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Origine :
                    </span>
                    <Badge variant="secondary">{selectedLine.origine}</Badge>
                  </div>
                </div>
              </div>

              {/* Nomenclature et classification */}
              <div>
                <h4 className="font-medium mb-3">Classification</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Numéro nomenclature
                    </label>
                    <p className="font-mono">
                      {selectedLine.numeroNomenclature || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Espèce
                    </label>
                    <p>{selectedLine.espece || "—"}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Désignation
                  </label>
                  <p>{selectedLine.designation}</p>
                </div>
              </div>

              {/* Quantité et valeur */}
              <div>
                <h4 className="font-medium mb-3">Valorisation</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Quantité
                    </label>
                    <p className="text-lg font-semibold">
                      {selectedLine.quantite} unité(s)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Prix unitaire
                    </label>
                    <p className="text-lg font-semibold">
                      {selectedLine.prixUnitaire.toLocaleString()} Ar
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Montant
                    </label>
                    <p className="text-lg font-bold text-primary">
                      {selectedLine.montant.toLocaleString()} Ar
                    </p>
                  </div>
                </div>
              </div>

              {/* Pièce justificative */}
              <div>
                <h4 className="font-medium mb-3">Pièce justificative</h4>
                {selectedLine.pieceJustificative ? (
                  <p>{selectedLine.pieceJustificative}</p>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  >
                    Sans pièce justificative
                  </Badge>
                )}
              </div>

              {/* Observations */}
              {selectedLine.observations && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Observations
                  </label>
                  <p className="mt-1 text-sm bg-muted/20 p-3 rounded">
                    {selectedLine.observations}
                  </p>
                </div>
              )}

              {/* Métadonnées */}
              <div className="border-t pt-4">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Écriture source : {selectedLine.sourceId}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants d'affichage (table / grid)
// ---------------------------------------------------------------------------

function LigneRegistreTable({
  ligne,
  onViewDetails,
}: {
  ligne: JournalLigne;
  onViewDetails: (ligne: JournalLigne) => void;
}) {
  return (
    <div className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* En-tête */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono">
                {ligne.numeroOrdre}
              </Badge>
              <h3 className="font-medium">{ligne.designation}</h3>
            </div>
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className={
                  ligne.sens === "Entrée"
                    ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                }
              >
                {ligne.sens}
              </Badge>
              <Badge variant="secondary">{ligne.origine}</Badge>
            </div>
          </div>

          {/* Détails comptables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nomenclature :</span>
              <span className="font-mono">
                {ligne.numeroNomenclature || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">P.J. :</span>
              <span className="font-mono">
                {ligne.pieceJustificative ?? (
                  <span className="text-slate-400">(sans)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Validation :</span>
              <span>
                {new Date(ligne.dateValidation).toLocaleDateString("fr-FR")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Fournisseur :</span>
              <span className="truncate">{ligne.fournisseur}</span>
            </div>
          </div>

          {/* Quantité / Valeur */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-muted/20 p-3 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Quantité :</span>
                <span className="ml-2 font-medium">
                  {ligne.quantite} unité(s)
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">P.U. :</span>
                <span className="ml-2 font-medium">
                  {ligne.prixUnitaire.toLocaleString()} Ar
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Montant :</span>
                <span className="ml-2 font-semibold text-primary">
                  {ligne.montant.toLocaleString()} Ar
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions : Détails uniquement (pas de Modifier) */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(ligne)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Détails
          </Button>
          {/* Bouton Modifier masqué : les écritures validées ne se modifient pas */}
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Cette écriture est figée ; elle ne peut pas être modifiée"
            className="opacity-50 cursor-not-allowed"
          >
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>
      </div>
    </div>
  );
}

function LigneRegistreGrid({
  ligne,
  onViewDetails,
}: {
  ligne: JournalLigne;
  onViewDetails: (ligne: JournalLigne) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono">
              {ligne.numeroOrdre}
            </Badge>
            <Badge
              variant="secondary"
              className={
                ligne.sens === "Entrée"
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                  : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
              }
            >
              {ligne.sens}
            </Badge>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2 line-clamp-2">
            {ligne.designation}
          </h3>
          <div className="text-sm text-muted-foreground">
            <p>Nomenclature : {ligne.numeroNomenclature || "—"}</p>
            <p>Espèce : {ligne.espece || "—"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fournisseur :</span>
            <span className="truncate ml-2">{ligne.fournisseur}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Validation :</span>
            <span>
              {new Date(ligne.dateValidation).toLocaleDateString("fr-FR")}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quantité :</span>
            <span className="font-medium">
              {ligne.quantite} unité(s)
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Montant :</span>
            <span className="font-semibold text-primary">
              {ligne.montant.toLocaleString()} Ar
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(ligne)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {/* Bouton Modifier masqué */}
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Cette écriture est figée ; elle ne peut pas être modifiée"
            className="opacity-50 cursor-not-allowed"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
