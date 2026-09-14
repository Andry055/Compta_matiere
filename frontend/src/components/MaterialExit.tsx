import { useState } from "react";
import {
  ArrowUp,
  Search,
  Save,
  Package,
  Calendar,
  User as UserIcon,
  Building,
  Hash,
  FileText,
  Euro,
} from "lucide-react";
import { User } from "../App";
import { JournalEntry, StatutMateriel } from "../types/accounting";
import { toast } from "sonner";

interface MaterialExitProps {
  user: User;
}

interface ExitFormData {
  numeroOrdre: string;
  pieceJustificative: string;
  dateSortie: string;
  designation: string;
  serialNumber: string;
  espece: string;
  numeroNomenclature: string;
  uniteNombre: number;
  valeurUnitaire: number;
  destination: string;
  destinataireName: string;
  destinataireDepartment: string;
  motifSortie: string;
  observations: string;
}

interface ExitBatch {
  reference: string;
  items: ExitFormData[];
  totalValue: number;
  processedBy: string;
  department: string;
  timestamp: string;
}

// Équipements disponibles (en réalité récupérés depuis le journal/stock)
const mockAvailableEquipment = [
  {
    id: "1",
    numeroOrdre: "2024-001",
    designation: "Ordinateur portable HP EliteBook",
    serialNumber: "HP240501A",
    espece: "Informatique",
    numeroNomenclature: "INFO-001",
    availableQuantity: 5,
    valeurUnitaire: 1200,
    pieceJustificativeOrigine: "BC-2024-015",
  },
  {
    id: "2",
    designation: "Clavier mécanique Logitech",
    numeroOrdre: "2024-002",
    serialNumber: "LG789456",
    espece: "Périphériques",
    numeroNomenclature: "PER-001",
    availableQuantity: 12,
    valeurUnitaire: 120,
    pieceJustificativeOrigine: "BC-2024-020",
  },
  {
    id: "3",
    numeroOrdre: "2024-003",
    designation: 'Écran Dell UltraSharp 24"',
    serialNumber: "DL987321",
    espece: "Affichage",
    numeroNomenclature: "AFF-001",
    availableQuantity: 8,
    valeurUnitaire: 320,
    pieceJustificativeOrigine: "BC-2024-017",
  },
  {
    id: "4",
    numeroOrdre: "2024-004",
    designation: "Souris sans fil Logitech",
    serialNumber: "MS123789",
    espece: "Périphériques",
    numeroNomenclature: "PER-002",
    availableQuantity: 15,
    valeurUnitaire: 45,
    pieceJustificativeOrigine: "BC-2024-020",
  },
  {
    id: "5",
    numeroOrdre: "2024-005",
    designation: "Téléphone IP Cisco",
    serialNumber: "CS789012",
    espece: "Communication",
    numeroNomenclature: "COM-001",
    availableQuantity: 3,
    valeurUnitaire: 180,
    pieceJustificativeOrigine: "BC-2024-050",
  },
];

const destinations = [
  "IT - Développement",
  "Finance - Comptabilité",
  "RH - Administration",
  "Marketing - Communication",
  "Logistique - Entrepôt",
  "Production - Atelier",
  "Service Client",
  "Direction Générale",
];

const motifsSortie = [
  "Attribution personnelle",
  "Équipement de service",
  "Prêt temporaire",
  "Transfert permanent",
  "Maintenance externe",
  "Formation",
  "Projet spécifique",
  "Remplacement",
];

export function MaterialExit({ user }: MaterialExitProps) {
  const [exitItems, setExitItems] = useState<ExitFormData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<
    (typeof mockAvailableEquipment)[0] | null
  >(null);
  const [batchReference, setBatchReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentExit, setCurrentExit] = useState({
    quantity: 1,
    destination: "",
    destinataireName: "",
    destinataireDepartment: "",
    motifSortie: "",
    observations: "",
    pieceJustificative: "",
    dateSortie: new Date().toISOString().split("T")[0],
  });

  // Génération des références
  const generateBatchReference = () => {
    const date = new Date();
    const ref = `EXT-${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(
      exitItems.length + 1
    ).padStart(3, "0")}`;
    setBatchReference(ref);
  };

  const generateNumeroOrdre = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `${year}-S${timestamp}`; // S pour Sortie
  };

  const filteredEquipment = mockAvailableEquipment.filter(
    (item) =>
      item.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.espece.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.numeroOrdre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addExitItem = () => {
    if (
      !selectedEquipment ||
      !currentExit.destination ||
      !currentExit.destinataireName ||
      !currentExit.motifSortie
    ) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (!currentExit.pieceJustificative) {
      toast.error("Veuillez renseigner la pièce justificative de sortie");
      return;
    }

    if (currentExit.quantity > selectedEquipment.availableQuantity) {
      toast.error(
        `Quantité non disponible. Maximum disponible: ${selectedEquipment.availableQuantity}`
      );
      return;
    }

    const newExitItem: ExitFormData = {
      numeroOrdre: generateNumeroOrdre(),
      pieceJustificative: currentExit.pieceJustificative,
      dateSortie: currentExit.dateSortie,
      designation: selectedEquipment.designation,
      serialNumber: selectedEquipment.serialNumber,
      espece: selectedEquipment.espece,
      numeroNomenclature: selectedEquipment.numeroNomenclature,
      uniteNombre: currentExit.quantity,
      valeurUnitaire: selectedEquipment.valeurUnitaire,
      destination: currentExit.destination,
      destinataireName: currentExit.destinataireName,
      destinataireDepartment: currentExit.destinataireDepartment,
      motifSortie: currentExit.motifSortie,
      observations: currentExit.observations,
    };

    setExitItems([...exitItems, newExitItem]);
    setSelectedEquipment(null);
    setCurrentExit({
      quantity: 1,
      destination: "",
      destinataireName: "",
      destinataireDepartment: "",
      motifSortie: "",
      observations: "",
      pieceJustificative: currentExit.pieceJustificative, // Conserver pour le lot
      dateSortie: currentExit.dateSortie, // Conserver pour le lot
    });
    setSearchTerm("");

    if (!batchReference) {
      generateBatchReference();
    }

    toast.success("Article ajouté à la sortie", {
      description: `${newExitItem.designation} - ${newExitItem.uniteNombre} unité(s)`,
    });
  };

  const removeExitItem = (index: number) => {
    const removedItem = exitItems[index];
    setExitItems(exitItems.filter((_, i) => i !== index));
    toast.info("Article retiré", {
      description: `${removedItem.designation} supprimé de la sortie`,
    });
  };

  const saveBatchExit = async () => {
    if (exitItems.length === 0) {
      toast.error("Ajoutez au moins un article avant de sauvegarder");
      return;
    }

    setIsSubmitting(true);

    try {
      const totalValue = exitItems.reduce(
        (sum, item) => sum + item.uniteNombre * item.valeurUnitaire,
        0
      );

      const batch: ExitBatch = {
        reference: batchReference,
        items: exitItems,
        totalValue,
        processedBy: user.name,
        department: user.department,
        timestamp: new Date().toISOString(),
      };

      // Simulation sauvegarde
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Batch de sorties sauvegardé:", batch);

      toast.success("Sortie de matériel enregistrée", {
        description: `${exitItems.length} article(s) sortie(s) du stock avec traçabilité complète`,
      });

      // Reset complet du formulaire
      setExitItems([]);
      setBatchReference("");
      setSelectedEquipment(null);
      setCurrentExit({
        quantity: 1,
        destination: "",
        destinataireName: "",
        destinataireDepartment: "",
        motifSortie: "",
        observations: "",
        pieceJustificative: "",
        dateSortie: new Date().toISOString().split("T")[0],
      });
      setSearchTerm("");
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement", {
        description: "Une erreur s'est produite lors de la sauvegarde",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalBatchValue = exitItems.reduce(
    (sum, item) => sum + item.uniteNombre * item.valeurUnitaire,
    0
  );

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <ArrowUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Sortie de Matériel - Journal Comptable
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Enregistrer la sortie d'équipements avec traçabilité comptable
            complète
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveBatchExit}
            disabled={exitItems.length === 0 || isSubmitting}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
              exitItems.length > 0 && !isSubmitting
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enregistrer au Journal
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch Information */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Informations du Lot de Sortie
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Référence du lot
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={batchReference}
                onChange={(e) => setBatchReference(e.target.value)}
                placeholder="Auto-généré"
                className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
              />
              <button
                onClick={generateBatchReference}
                className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"
              >
                <Hash className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Date de sortie
            </label>
            <input
              type="date"
              value={currentExit.dateSortie}
              onChange={(e) =>
                setCurrentExit((prev) => ({
                  ...prev,
                  dateSortie: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="h-4 w-4" />
            <span>Traité par: {user.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>Direction: {user.department}</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm text-muted-foreground mb-2">
            Pièce justificative de sortie *
          </label>
          <input
            type="text"
            value={currentExit.pieceJustificative}
            onChange={(e) =>
              setCurrentExit((prev) => ({
                ...prev,
                pieceJustificative: e.target.value,
              }))
            }
            placeholder="BS-2024-001, DEM-001, MAINT-001..."
            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
          />
        </div>
      </div>

      {/* Equipment Selection */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
          <Package className="h-5 w-5" />
          Sélectionner un Équipement en Stock
        </h3>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par désignation, n° série, n° ordre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
          />
        </div>

        {/* Available Equipment */}
        <div className="grid gap-2 max-h-60 overflow-y-auto">
          {filteredEquipment.map((equipment) => (
            <button
              key={equipment.id}
              onClick={() => setSelectedEquipment(equipment)}
              className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                selectedEquipment?.id === equipment.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm text-card-foreground font-medium">
                    {equipment.designation}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {equipment.numeroOrdre}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {equipment.serialNumber} • {equipment.espece} •{" "}
                  {equipment.numeroNomenclature}
                </div>
                <div className="text-xs text-muted-foreground">
                  P.J. origine: {equipment.pieceJustificativeOrigine}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-muted-foreground">
                  Dispo: {equipment.availableQuantity}
                </div>
                <div className="font-medium">
                  {equipment.valeurUnitaire.toLocaleString()}Ar/u
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedEquipment && (
          <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30">
            <h4 className="text-sm text-card-foreground mb-3 flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              Configuration de la sortie - {selectedEquipment.designation}
            </h4>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Quantité à sortir *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedEquipment.availableQuantity}
                  value={currentExit.quantity}
                  onChange={(e) =>
                    setCurrentExit({
                      ...currentExit,
                      quantity: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Maximum disponible: {selectedEquipment.availableQuantity}
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Motif de sortie *
                </label>
                <select
                  value={currentExit.motifSortie}
                  onChange={(e) =>
                    setCurrentExit({
                      ...currentExit,
                      motifSortie: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="">Sélectionner...</option>
                  {motifsSortie.map((motif) => (
                    <option key={motif} value={motif}>
                      {motif}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Destination *
                </label>
                <select
                  value={currentExit.destination}
                  onChange={(e) =>
                    setCurrentExit({
                      ...currentExit,
                      destination: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="">Sélectionner...</option>
                  {destinations.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Nom du destinataire *
                </label>
                <input
                  type="text"
                  value={currentExit.destinataireName}
                  onChange={(e) =>
                    setCurrentExit({
                      ...currentExit,
                      destinataireName: e.target.value,
                    })
                  }
                  placeholder="Nom du bénéficiaire"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Service destinataire
                </label>
                <input
                  type="text"
                  value={currentExit.destinataireDepartment}
                  onChange={(e) =>
                    setCurrentExit({
                      ...currentExit,
                      destinataireDepartment: e.target.value,
                    })
                  }
                  placeholder="Service ou équipe spécifique"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Valeur de sortie
                </label>
                <div className="flex items-center h-10 px-3 border border-border rounded-lg bg-muted">
                  <Euro className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-semibold text-primary">
                    {(
                      currentExit.quantity * selectedEquipment.valeurUnitaire
                    ).toLocaleString()}
                    Ar
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-muted-foreground mb-2">
                Observations
              </label>
              <textarea
                value={currentExit.observations}
                onChange={(e) =>
                  setCurrentExit({
                    ...currentExit,
                    observations: e.target.value,
                  })
                }
                placeholder="Conditions particulières, état de sortie, instructions..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={addExitItem}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
              >
                <ArrowUp className="h-4 w-4" />
                Ajouter à la Sortie
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exit Items List */}
      {exitItems.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 sm:p-6 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg text-card-foreground">
                Articles en Sortie ({exitItems.length})
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-muted-foreground">Valeur totale:</div>
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Euro className="h-4 w-4" />
                  {totalBatchValue.toLocaleString()}Ar
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="block lg:hidden p-4 space-y-3">
            {exitItems.map((item, index) => (
              <div
                key={index}
                className="border border-border rounded-lg p-3 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-card-foreground">
                      {item.designation}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {item.numeroOrdre}
                    </div>
                  </div>
                  <button
                    onClick={() => removeExitItem(index)}
                    className="text-destructive hover:text-destructive/80 text-xs px-2 py-1 rounded"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Quantité:</span>
                    <div className="text-card-foreground">
                      {item.uniteNombre}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valeur:</span>
                    <div className="text-card-foreground">
                      {(
                        item.uniteNombre * item.valeurUnitaire
                      ).toLocaleString()}
                      Ar
                    </div>
                  </div>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">Destinataire:</span>
                  <div className="text-card-foreground">
                    {item.destinataireName} ({item.destination})
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      N° Ordre
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Désignation
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      P.J.
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Quantité
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Valeur Unit.
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Total
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Destinataire
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Motif
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exitItems.map((item, index) => (
                    <tr
                      key={index}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-card-foreground font-mono">
                        {item.numeroOrdre}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground max-w-[200px] truncate">
                        {item.designation}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                        {item.pieceJustificative}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.uniteNombre}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.valeurUnitaire.toLocaleString()}Ar
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground font-semibold">
                        {(
                          item.uniteNombre * item.valeurUnitaire
                        ).toLocaleString()}
                        Ar
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground max-w-[150px] truncate">
                        {item.destinataireName}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground max-w-[120px] truncate">
                        {item.motifSortie}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => removeExitItem(index)}
                          className="text-destructive hover:text-destructive/80 text-sm px-2 py-1 rounded hover:bg-destructive/10"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
