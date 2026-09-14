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
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  BarChart3,
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
  JournalEntry,
  StatutMateriel,
  FiltresJournal,
  OptionsAffichage,
} from "../types/accounting";
import { toast } from "sonner";

// Données fictives pour le journal comptable
const mockJournalEntries: JournalEntry[] = [
  {
    id: "JE001",
    numeroOrdre: "2024-001",
    pieceJustificative: "BC-2024-015",
    dateEntree: "2024-01-15",
    origine: {
      type: "fournisseur",
      nom: "TechnoFournisseur SARL",
      reference: "TF-240115-HP",
      adresse: "123 Rue de la Tech, 75001 Paris",
      contact: "contact@technofournisseur.com",
    },
    numeroNomenclature: "INFO-001",
    designation: "Ordinateur portable professionnel",
    espece: "Informatique",
    uniteNombre: 5,
    prixUnitaire: 1200,
    valeurTotale: 6000,
    qualite: {
      etat: "neuf",
      dateControle: "2024-01-15",
      controlePar: "Service IT",
    },
    statut: "en_stock",
    observations: "Livraison conforme, emballage intact",
    createdBy: "admin@comptamatiere.com",
    updatedAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "JE002",
    numeroOrdre: "2024-002",
    pieceJustificative: "BC-2024-016",
    dateEntree: "2024-01-16",
    origine: {
      type: "fournisseur",
      nom: "Bureau Solutions",
      reference: "BS-HP-400",
      adresse: "456 Avenue du Bureau, 69000 Lyon",
      contact: "commandes@bureausolutions.fr",
    },
    numeroNomenclature: "BUR-002",
    designation: "Imprimante laser couleur",
    espece: "Bureautique",
    uniteNombre: 2,
    prixUnitaire: 450,
    valeurTotale: 900,
    qualite: {
      etat: "neuf",
      dateControle: "2024-01-16",
      controlePar: "Service Achats",
    },
    statut: "distribue",
    observations: "Installée au service comptabilité",
    createdBy: "admin@comptamatiere.com",
    updatedAt: "2024-01-18T14:20:00Z",
  },
  {
    id: "JE003",
    numeroOrdre: "2024-003",
    pieceJustificative: "DON-2024-001",
    dateEntree: "2024-01-17",
    origine: {
      type: "donation",
      nom: "Donation Entreprise Partenaire",
      reference: "DON-PART-001",
    },
    numeroNomenclature: "COMM-001",
    designation: "Téléphones IP Cisco",
    espece: "Communication",
    uniteNombre: 10,
    prixUnitaire: 180,
    valeurTotale: 1800,
    qualite: {
      etat: "bon",
      notes: "Matériel d'occasion en bon état de fonctionnement",
      dateControle: "2024-01-17",
      controlePar: "Service IT",
    },
    statut: "en_stock",
    observations:
      "Donation d'entreprise partenaire suite à renouvellement parc",
    createdBy: "admin@comptamatiere.com",
    updatedAt: "2024-01-17T16:45:00Z",
  },
  {
    id: "JE004",
    numeroOrdre: "2024-004",
    pieceJustificative: "BC-2024-017",
    dateEntree: "2024-01-18",
    origine: {
      type: "fournisseur",
      nom: "Digital Store",
      reference: "DS-DELL-24",
      adresse: "789 Boulevard Digital, 13000 Marseille",
      contact: "vente@digitalstore.fr",
    },
    numeroNomenclature: "INFO-003",
    designation: "Écrans Dell UltraSharp 24 pouces",
    espece: "Informatique",
    uniteNombre: 8,
    prixUnitaire: 320,
    valeurTotale: 2560,
    qualite: {
      etat: "neuf",
      dateControle: "2024-01-18",
      controlePar: "Service IT",
    },
    statut: "en_stock",
    observations: "Écrans haute résolution pour postes de travail",
    createdBy: "admin@comptamatiere.com",
    updatedAt: "2024-01-18T11:15:00Z",
  },
  {
    id: "JE005",
    numeroOrdre: "2024-005",
    pieceJustificative: "RET-2024-001",
    dateEntree: "2024-01-19",
    origine: {
      type: "retour",
      nom: "Retour maintenance",
      reference: "MAINT-001",
    },
    numeroNomenclature: "BUR-001",
    designation: "Scanner Canon",
    espece: "Bureautique",
    uniteNombre: 1,
    prixUnitaire: 250,
    valeurTotale: 250,
    qualite: {
      etat: "bon",
      notes: "Réparation effectuée, test de fonctionnement OK",
      dateControle: "2024-01-19",
      controlePar: "Service Maintenance",
    },
    statut: "en_stock",
    observations: "Retour de maintenance après réparation du mécanisme",
    createdBy: "admin@comptamatiere.com",
    updatedAt: "2024-01-19T09:30:00Z",
  },
];

type ViewMode = "table" | "grid";

export function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>(mockJournalEntries);
  const [filteredEntries, setFilteredEntries] =
    useState<JournalEntry[]>(mockJournalEntries);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // États pour les filtres
  const [filtres, setFiltres] = useState<FiltresJournal>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Options d'affichage
  const [options, setOptions] = useState<OptionsAffichage>({
    grouperPar: "date",
    trierPar: "numeroOrdre",
    ordreTri: "desc",
    afficherValeurs: true,
    afficherDetails: true,
  });

  // Effet pour filtrer les entrées
  useEffect(() => {
    let filtered = entries;

    // Recherche textuelle
    if (searchTerm) {
      filtered = filtered.filter(
        (entry) =>
          entry.numeroOrdre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.pieceJustificative
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          entry.origine.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.numeroNomenclature
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Filtres spécifiques
    if (filtres.dateDebut) {
      filtered = filtered.filter(
        (entry) => entry.dateEntree >= filtres.dateDebut!
      );
    }
    if (filtres.dateFin) {
      filtered = filtered.filter(
        (entry) => entry.dateEntree <= filtres.dateFin!
      );
    }
    if (filtres.statut) {
      filtered = filtered.filter((entry) => entry.statut === filtres.statut);
    }
    if (filtres.origine) {
      filtered = filtered.filter(
        (entry) => entry.origine.type === filtres.origine
      );
    }

    // Tri
    filtered.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (options.trierPar) {
        case "date":
          valueA = new Date(a.dateEntree);
          valueB = new Date(b.dateEntree);
          break;
        case "numeroOrdre":
          valueA = a.numeroOrdre;
          valueB = b.numeroOrdre;
          break;
        case "valeur":
          valueA = a.valeurTotale;
          valueB = b.valeurTotale;
          break;
        case "designation":
          valueA = a.designation.toLowerCase();
          valueB = b.designation.toLowerCase();
          break;
        default:
          valueA = a.numeroOrdre;
          valueB = b.numeroOrdre;
      }

      if (options.ordreTri === "asc") {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    setFilteredEntries(filtered);
  }, [entries, searchTerm, filtres, options]);

  const getStatutBadge = (statut: StatutMateriel) => {
    switch (statut) {
      case "en_stock":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
          >
            En Stock
          </Badge>
        );
      case "distribue":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
          >
            Distribué
          </Badge>
        );
      case "maintenance":
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800"
          >
            Maintenance
          </Badge>
        );
      case "reforme":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          >
            Réformé
          </Badge>
        );
      case "sortie":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800"
          >
            Sortie
          </Badge>
        );
      default:
        return <Badge variant="outline">Inconnu</Badge>;
    }
  };

  const getOrigineBadge = (origine: string) => {
    switch (origine) {
      case "fournisseur":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            Fournisseur
          </Badge>
        );
      case "entreprise":
        return (
          <Badge
            variant="secondary"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Entreprise
          </Badge>
        );
      case "donation":
        return (
          <Badge
            variant="secondary"
            className="bg-purple-50 text-purple-700 border-purple-200"
          >
            Donation
          </Badge>
        );
      case "retour":
        return (
          <Badge
            variant="secondary"
            className="bg-orange-50 text-orange-700 border-orange-200"
          >
            Retour
          </Badge>
        );
      case "transfert":
        return (
          <Badge
            variant="secondary"
            className="bg-gray-50 text-gray-700 border-gray-200"
          >
            Transfert
          </Badge>
        );
      default:
        return <Badge variant="secondary">Autre</Badge>;
    }
  };

  const getQualiteBadge = (qualite: string) => {
    switch (qualite) {
      case "neuf":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
            Neuf
          </Badge>
        );
      case "bon":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Bon
          </Badge>
        );
      case "moyen":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            Moyen
          </Badge>
        );
      case "defaillant":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
            Défaillant
          </Badge>
        );
      case "hs":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            Hors d'usage
          </Badge>
        );
      default:
        return <Badge variant="outline">Non défini</Badge>;
    }
  };

  // Statistiques du journal
  const stats = {
    totalEntries: entries.length,
    totalValue: entries.reduce((sum, entry) => sum + entry.valeurTotale, 0),
    enStock: entries.filter((e) => e.statut === "en_stock").length,
    distribue: entries.filter((e) => e.statut === "distribue").length,
    maintenance: entries.filter((e) => e.statut === "maintenance").length,
  };

  const handleViewDetails = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setShowDetailsModal(true);
  };

  const exportJournal = (format: "csv" | "pdf") => {
    toast.success(`Export du journal en ${format.toUpperCase()} initié`, {
      description: `${filteredEntries.length} entrées seront exportées`,
    });
  };

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
          {/* <Button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle Entrée
          </Button> */}
          <Button variant="outline" onClick={() => exportJournal("pdf")}>
            <Printer className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total Entrées</CardTitle>
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{stats.totalEntries}</div>
            <p className="text-xs text-muted-foreground">
              Enregistrements journal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Valeur Totale</CardTitle>
            <Euro className="h-6 w-6 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">
              {stats.totalValue.toLocaleString()}Ar
            </div>
            <p className="text-xs text-muted-foreground">Inventaire valorisé</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">En Stock</CardTitle>
            <Package className="h-6 w-6 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">{stats.enStock}</div>
            <p className="text-xs text-muted-foreground">
              Matériels disponibles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Distribués</CardTitle>
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600">{stats.distribue}</div>
            <p className="text-xs text-muted-foreground">En service actif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Maintenance</CardTitle>
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{stats.maintenance}</div>
            <p className="text-xs text-muted-foreground">En cours réparation</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recherche et Filtres</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={
                  showFilters ? "bg-primary text-primary-foreground" : ""
                }
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
                placeholder="Rechercher par numéro d'ordre, désignation, pièce justificative..."
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
                        dateDebut: e.target.value,
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
                        dateFin: e.target.value,
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
                      <SelectItem value="">Toutes les origines</SelectItem>
                      <SelectItem value="fournisseur">Fournisseur</SelectItem>
                      <SelectItem value="entreprise">Entreprise</SelectItem>
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="retour">Retour</SelectItem>
                      <SelectItem value="transfert">Transfert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Statut
                  </label>
                  <Select
                    value={filtres.statut || ""}
                    onValueChange={(value) =>
                      setFiltres((prev) => ({
                        ...prev,
                        statut: (value as StatutMateriel) || undefined,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tous les statuts</SelectItem>
                      <SelectItem value="en_stock">En Stock</SelectItem>
                      <SelectItem value="distribue">Distribué</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="reforme">Réformé</SelectItem>
                      <SelectItem value="sortie">Sortie</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              {filteredEntries.length} entrée(s) affichée(s) sur{" "}
              {entries.length} • Valeur filtrée:{" "}
              {filteredEntries
                .reduce((sum, entry) => sum + entry.valeurTotale, 0)
                .toLocaleString()}
              Ar
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Entrées du Journal
          </CardTitle>
          <CardDescription>
            Registre chronologique des mouvements de matériel avec pièces
            justificatives
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune entrée trouvée</p>
              <p className="text-sm">Ajustez vos critères de recherche</p>
            </div>
          ) : viewMode === "table" ? (
            /* Table View */
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* En-tête de l'entrée */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {entry.numeroOrdre}
                          </Badge>
                          <h3 className="font-medium">{entry.designation}</h3>
                        </div>
                        <div className="flex gap-2">
                          {getStatutBadge(entry.statut)}
                          {getOrigineBadge(entry.origine.type)}
                        </div>
                      </div>

                      {/* Détails comptables */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Nomenclature:
                          </span>
                          <span className="font-mono">
                            {entry.numeroNomenclature}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">P.J.:</span>
                          <span className="font-mono">
                            {entry.pieceJustificative}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Date:</span>
                          <span>
                            {new Date(entry.dateEntree).toLocaleDateString(
                              "fr-FR"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Origine:
                          </span>
                          <span className="truncate">{entry.origine.nom}</span>
                        </div>
                      </div>

                      {/* Informations quantité/valeur */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-muted/20 p-3 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Quantité:
                            </span>
                            <span className="ml-2 font-medium">
                              {entry.uniteNombre} unité(s)
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Prix unitaire:
                            </span>
                            <span className="ml-2 font-medium">
                              {entry.prixUnitaire.toLocaleString()}Ar
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">
                              Valeur totale:
                            </span>
                            <span className="ml-2 font-semibold text-primary">
                              {entry.valeurTotale.toLocaleString()}Ar
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Qualité:
                          </span>
                          {getQualiteBadge(entry.qualite.etat)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(entry)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Détails
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntries.map((entry) => (
                <Card
                  key={entry.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono">
                        {entry.numeroOrdre}
                      </Badge>
                      {getStatutBadge(entry.statut)}
                    </div>

                    <div>
                      <h3 className="font-medium mb-2 line-clamp-2">
                        {entry.designation}
                      </h3>
                      <div className="text-sm text-muted-foreground">
                        <p>Nomenclature: {entry.numeroNomenclature}</p>
                        <p>Espèce: {entry.espece}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Origine:</span>
                        <span className="truncate ml-2">
                          {entry.origine.nom}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Date:</span>
                        <span>
                          {new Date(entry.dateEntree).toLocaleDateString(
                            "fr-FR"
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quantité:</span>
                        <span className="font-medium">
                          {entry.uniteNombre} unité(s)
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valeur:</span>
                        <span className="font-semibold text-primary">
                          {entry.valeurTotale.toLocaleString()}Ar
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      {getQualiteBadge(entry.qualite.etat)}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {selectedEntry && (
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détails de l'entrée journal</DialogTitle>
              <DialogDescription>
                Entrée n° {selectedEntry.numeroOrdre} -{" "}
                {selectedEntry.designation}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Informations générales */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Numéro d'ordre
                  </label>
                  <p className="font-mono">{selectedEntry.numeroOrdre}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Pièce justificative
                  </label>
                  <p className="font-mono">
                    {selectedEntry.pieceJustificative}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Date d'entrée
                  </label>
                  <p>
                    {new Date(selectedEntry.dateEntree).toLocaleDateString(
                      "fr-FR"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Statut
                  </label>
                  <div className="mt-1">
                    {getStatutBadge(selectedEntry.statut)}
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
                      {selectedEntry.numeroNomenclature}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Espèce
                    </label>
                    <p>{selectedEntry.espece}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Désignation
                  </label>
                  <p>{selectedEntry.designation}</p>
                </div>
              </div>

              {/* Origine */}
              <div>
                <h4 className="font-medium mb-3">Origine</h4>
                <div className="bg-muted/20 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span>Type:</span>
                    {getOrigineBadge(selectedEntry.origine.type)}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">
                      Nom:
                    </span>
                    <p>{selectedEntry.origine.nom}</p>
                  </div>
                  {selectedEntry.origine.reference && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Référence:
                      </span>
                      <p className="font-mono">
                        {selectedEntry.origine.reference}
                      </p>
                    </div>
                  )}
                  {selectedEntry.origine.adresse && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Adresse:
                      </span>
                      <p>{selectedEntry.origine.adresse}</p>
                    </div>
                  )}
                  {selectedEntry.origine.contact && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Contact:
                      </span>
                      <p>{selectedEntry.origine.contact}</p>
                    </div>
                  )}
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
                      {selectedEntry.uniteNombre} unité(s)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Prix unitaire
                    </label>
                    <p className="text-lg font-semibold">
                      {selectedEntry.prixUnitaire.toLocaleString()}Ar
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Valeur totale
                    </label>
                    <p className="text-lg font-bold text-primary">
                      {selectedEntry.valeurTotale.toLocaleString()}Ar
                    </p>
                  </div>
                </div>
              </div>

              {/* Qualité */}
              <div>
                <h4 className="font-medium mb-3">Contrôle qualité</h4>
                <div className="bg-muted/20 p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <span>État:</span>
                    {getQualiteBadge(selectedEntry.qualite.etat)}
                  </div>
                  {selectedEntry.qualite.dateControle && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Date de contrôle:
                      </span>
                      <p>
                        {new Date(
                          selectedEntry.qualite.dateControle
                        ).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                  )}
                  {selectedEntry.qualite.controlePar && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Contrôlé par:
                      </span>
                      <p>{selectedEntry.qualite.controlePar}</p>
                    </div>
                  )}
                  {selectedEntry.qualite.notes && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Notes qualité:
                      </span>
                      <p>{selectedEntry.qualite.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Observations */}
              {selectedEntry.observations && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Observations
                  </label>
                  <p className="mt-1 text-sm bg-muted/20 p-3 rounded">
                    {selectedEntry.observations}
                  </p>
                </div>
              )}

              {/* Métadonnées */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span>Créé par:</span>
                    <p>{selectedEntry.createdBy}</p>
                  </div>
                  <div>
                    <span>Dernière mise à jour:</span>
                    <p>
                      {new Date(selectedEntry.updatedAt).toLocaleString(
                        "fr-FR"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
