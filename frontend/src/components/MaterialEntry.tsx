import { useState } from "react";
import {
  Plus,
  Save,
  ArrowDown,
  Package,
  Calendar,
  User as UserIcon,
  Building,
  Hash,
  FileText,
  Euro,
  Calculator,
  CheckCircle,
} from "lucide-react";
import { User } from "../App";
import { JournalEntry, QualiteMateriel } from "../types/accounting";
import { toast } from "sonner";

interface MaterialEntryProps {
  user: User;
}

interface EntryFormData {
  numeroOrdre: string;
  pieceJustificative: string;
  dateEntree: string;
  designation: string;
  espece: string;
  numeroNomenclature: string;
  uniteNombre: number;
  prixUnitaire: number;
  observations: string;
  serialNumber: string;
  brand: string;
  model: string;
  warranty: string;
  specifications: string;
}

interface OrigineMateriel {
  type: "stock_admin" | "autre_service";
  source: string; // Nom du service ou "Stock Admin"
  reference: string; // Référence ordre de sortie admin ou référence du service
  contact?: string; // Contact du service (optionnel)
}

interface EntryBatch {
  reference: string;
  items: EntryFormData[];
  origine: OrigineMateriel;
  qualite: QualiteMateriel;
  totalValue: number;
  enteredBy: string;
  department: string;
  timestamp: string;
}

const categories = [
  "Informatique",
  "Périphériques",
  "Affichage",
  "Impression",
  "Communication",
  "Mobilier",
  "Outillage",
  "Bureautique",
  "Audiovisuel",
  "Véhicule",
  "Autre",
];

const suppliers = [
  "TechnoFournisseur SARL",
  "EquipementPro",
  "Distrib'IT France",
  "Matériel Express",
  "Supply Chain Plus",
  "Bureau Solutions",
  "Digital Store",
  "Tech Partners",
  "Office Equipment Co.",
];

export function MaterialEntry({ user }: MaterialEntryProps) {
  const [entryItems, setEntryItems] = useState<EntryFormData[]>([]);
  const [batchReference, setBatchReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État du formulaire pour un nouvel item
  const [currentItem, setCurrentItem] = useState<EntryFormData>({
    numeroOrdre: "",
    pieceJustificative: "",
    dateEntree: new Date().toISOString().split("T")[0],
    designation: "",
    espece: "",
    numeroNomenclature: "",
    uniteNombre: 1,
    prixUnitaire: 0,
    observations: "",
    serialNumber: "",
    brand: "",
    model: "",
    warranty: "",
    specifications: "",
  });

  const [origine, setOrigine] = useState<OrigineMateriel>({
    type: "stock_admin",
    source: "Stock Admin",
    reference: "",
    contact: "",
  });

  const [qualite, setQualite] = useState<QualiteMateriel>({
    etat: "neuf",
    notes: "",
    dateControle: new Date().toISOString().split("T")[0],
    controlePar: user.name,
  });

  // Génération automatique des références
  const generateBatchReference = () => {
    const date = new Date();
    const ref = `ENT-${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(
      entryItems.length + 1
    ).padStart(3, "0")}`;
    setBatchReference(ref);
  };

  const generateNumeroOrdre = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `${year}-${timestamp}`;
  };

  const generateNomenclature = () => {
    const prefix = currentItem.espece.substring(0, 3).toUpperCase() || "MAT";
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${prefix}-${random}`;
  };

  const generateSerialNumber = () => {
    const prefix = currentItem.espece.substring(0, 2).toUpperCase() || "EQ";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `${prefix}${year}${month}${random}`;
  };

  // Calcul de la valeur totale
  const totalItemValue = currentItem.uniteNombre * currentItem.prixUnitaire;
  const totalBatchValue = entryItems.reduce(
    (sum, item) => sum + item.uniteNombre * item.prixUnitaire,
    0
  );

  const addItem = () => {
    if (
      !currentItem.designation ||
      !currentItem.espece ||
      !currentItem.pieceJustificative
    ) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (currentItem.uniteNombre <= 0) {
      toast.error("La quantité doit être supérieure à 0");
      return;
    }

    if (currentItem.prixUnitaire < 0) {
      toast.error("Le prix unitaire ne peut pas être négatif");
      return;
    }

    const newItem: EntryFormData = {
      ...currentItem,
      numeroOrdre: currentItem.numeroOrdre || generateNumeroOrdre(),
      numeroNomenclature:
        currentItem.numeroNomenclature || generateNomenclature(),
      serialNumber: currentItem.serialNumber || generateSerialNumber(),
    };

    setEntryItems([...entryItems, newItem]);

    // Reset form for next item
    setCurrentItem({
      numeroOrdre: "",
      pieceJustificative: currentItem.pieceJustificative, // Keep same justification for batch
      dateEntree: currentItem.dateEntree, // Keep same date for batch
      designation: "",
      espece: "",
      numeroNomenclature: "",
      uniteNombre: 1,
      prixUnitaire: 0,
      observations: "",
      serialNumber: "",
      brand: "",
      model: "",
      warranty: "",
      specifications: "",
    });

    if (!batchReference) {
      generateBatchReference();
    }

    toast.success("Article ajouté à l'entrée", {
      description: `${newItem.designation} - ${newItem.uniteNombre} unité(s)`,
    });
  };

  const removeItem = (index: number) => {
    const removedItem = entryItems[index];
    setEntryItems(entryItems.filter((_, i) => i !== index));
    toast.info("Article retiré", {
      description: `${removedItem.designation} supprimé de l'entrée`,
    });
  };

  const saveBatchEntry = async () => {
    if (entryItems.length === 0) {
      toast.error("Ajoutez au moins un article avant de sauvegarder");
      return;
    }

    if (!origine.source || !origine.reference) {
      toast.error(
        "Veuillez renseigner la source et la référence des matériels"
      );
      return;
    }

    if (!qualite.controlePar) {
      toast.error("Veuillez renseigner qui a effectué le contrôle qualité");
      return;
    }

    setIsSubmitting(true);

    try {
      const batch: EntryBatch = {
        reference: batchReference,
        items: entryItems,
        origine,
        qualite,
        totalValue: totalBatchValue,
        enteredBy: user.name,
        department: user.department,
        timestamp: new Date().toISOString(),
      };

      // Simulation sauvegarde
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Batch d'entrées sauvegardé:", batch);

      toast.success("Entrée de matériel enregistrée", {
        description: `${entryItems.length} article(s) enregistré(s) dans le journal comptable`,
      });

      // Reset complet du formulaire
      setEntryItems([]);
      setBatchReference("");
      setCurrentItem({
        numeroOrdre: "",
        pieceJustificative: "",
        dateEntree: new Date().toISOString().split("T")[0],
        designation: "",
        espece: "",
        numeroNomenclature: "",
        uniteNombre: 1,
        prixUnitaire: 0,
        observations: "",
        serialNumber: "",
        brand: "",
        model: "",
        warranty: "",
        specifications: "",
      });
      setOrigine({
        type: "stock_admin",
        source: "Stock Admin",
        reference: "",
        contact: "",
      });
      setQualite({
        etat: "neuf",
        notes: "",
        dateControle: new Date().toISOString().split("T")[0],
        controlePar: user.name,
      });
    } catch (error) {
      toast.error("Erreur lors de l'enregistrement", {
        description: "Une erreur s'est produite lors de la sauvegarde",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <ArrowDown className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            Entrée de Matériel - Journal Comptable
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Enregistrer l'arrivée de nouveaux équipements avec traçabilité
            comptable complète
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={saveBatchEntry}
            disabled={entryItems.length === 0 || isSubmitting}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
              entryItems.length > 0 && !isSubmitting
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
          Informations du Lot d'Entrée
        </h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="h-4 w-4" />
            <span>Saisi par: {user.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>Direction: {user.department}</span>
          </div>
        </div>
      </div>

      {/* Origine Information */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
          <Building className="h-5 w-5" />
          Source des Matériels
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Provenance *
            </label>
            <select
              value={origine.type}
              onChange={(e) => {
                const newType = e.target.value as
                  | "stock_admin"
                  | "autre_service";
                setOrigine((prev) => ({
                  ...prev,
                  type: newType,
                  source: newType === "stock_admin" ? "Stock Admin" : "",
                  reference: "",
                  contact: "",
                }));
              }}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="stock_admin">Stock Admin (Ordre de sortie)</option>
              <option value="autre_service">Autre Service/Direction</option>
            </select>
          </div>

          {origine.type === "stock_admin" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Source
                </label>
                <input
                  type="text"
                  value="Stock Admin"
                  disabled
                  className="w-full px-3 py-2 border border-border rounded-lg bg-muted text-muted-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  N° Ordre de sortie admin *
                </label>
                <input
                  type="text"
                  value={origine.reference}
                  onChange={(e) =>
                    setOrigine((prev) => ({
                      ...prev,
                      reference: e.target.value,
                    }))
                  }
                  placeholder="EXT-2025-001, OS-2025-015..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Nom du service/direction *
                </label>
                <input
                  type="text"
                  value={origine.source}
                  onChange={(e) =>
                    setOrigine((prev) => ({ ...prev, source: e.target.value }))
                  }
                  placeholder="Direction Marketing, Service IT..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Référence/N° transfert *
                </label>
                <input
                  type="text"
                  value={origine.reference}
                  onChange={(e) =>
                    setOrigine((prev) => ({
                      ...prev,
                      reference: e.target.value,
                    }))
                  }
                  placeholder="TRANS-2025-001, REF-MKT-015..."
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-muted-foreground mb-2">
                  Contact du service
                </label>
                <input
                  type="text"
                  value={origine.contact || ""}
                  onChange={(e) =>
                    setOrigine((prev) => ({ ...prev, contact: e.target.value }))
                  }
                  placeholder="Email ou téléphone du responsable"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>
          )}

          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-start gap-2 text-sm">
              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
              </div>
              <div className="text-muted-foreground">
                <p className="mb-1">
                  <strong>Stock Admin :</strong> Matériel provenant du stock
                  géré par l'administrateur via un ordre de sortie officiel.
                </p>
                <p>
                  <strong>Autre Service :</strong> Matériel transféré depuis un
                  autre Direction ou direction de l'entreprise.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Control */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Contrôle Qualité
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              État général *
            </label>
            <select
              value={qualite.etat}
              onChange={(e) =>
                setQualite((prev) => ({ ...prev, etat: e.target.value as any }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="neuf">Neuf</option>
              <option value="bon">Bon état</option>
              <option value="moyen">État moyen</option>
              <option value="defaillant">Défaillant</option>
              <option value="hs">Hors d'usage</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Date de contrôle *
            </label>
            <input
              type="date"
              value={qualite.dateControle}
              onChange={(e) =>
                setQualite((prev) => ({
                  ...prev,
                  dateControle: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Contrôlé par *
            </label>
            <input
              type="text"
              value={qualite.controlePar}
              onChange={(e) =>
                setQualite((prev) => ({ ...prev, controlePar: e.target.value }))
              }
              placeholder="Nom du contrôleur"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Notes qualité
            </label>
            <input
              type="text"
              value={qualite.notes || ""}
              onChange={(e) =>
                setQualite((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Observations sur la qualité"
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Ajouter un Article
        </h3>

        <div className="space-y-4">
          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Numéro d'ordre
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentItem.numeroOrdre}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      numeroOrdre: e.target.value,
                    }))
                  }
                  placeholder="Auto-généré"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
                />
                <button
                  onClick={() =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      numeroOrdre: generateNumeroOrdre(),
                    }))
                  }
                  className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"
                >
                  <Hash className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Pièce justificative *
              </label>
              <input
                type="text"
                value={currentItem.pieceJustificative}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    pieceJustificative: e.target.value,
                  }))
                }
                placeholder="BC-2024-001, FAC-001..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Date d'entrée *
              </label>
              <input
                type="date"
                value={currentItem.dateEntree}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    dateEntree: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <label className="block text-sm text-muted-foreground mb-2">
                Désignation *
              </label>
              <input
                type="text"
                value={currentItem.designation}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    designation: e.target.value,
                  }))
                }
                placeholder="Ex: Ordinateur portable HP EliteBook 840"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Espèce/Catégorie *
              </label>
              <select
                value={currentItem.espece}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    espece: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="">Sélectionner...</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Technical Details */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Marque
              </label>
              <input
                type="text"
                value={currentItem.brand}
                onChange={(e) =>
                  setCurrentItem((prev) => ({ ...prev, brand: e.target.value }))
                }
                placeholder="HP, Dell, Canon..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Modèle
              </label>
              <input
                type="text"
                value={currentItem.model}
                onChange={(e) =>
                  setCurrentItem((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder="EliteBook 840, Latitude 5520..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                N° de série
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentItem.serialNumber}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      serialNumber: e.target.value,
                    }))
                  }
                  placeholder="Auto-généré"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
                />
                <button
                  onClick={() =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      serialNumber: generateSerialNumber(),
                    }))
                  }
                  className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"
                >
                  Gen
                </button>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Quantité *
              </label>
              <input
                type="number"
                min="1"
                value={currentItem.uniteNombre}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    uniteNombre: parseInt(e.target.value) || 1,
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Prix unitaire (Ar) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentItem.prixUnitaire}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    prixUnitaire: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Valeur totale
              </label>
              <div className="flex items-center h-10 px-3 border border-border rounded-lg bg-muted">
                <Calculator className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-semibold text-primary">
                  {totalItemValue.toLocaleString()}Ar
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                N° nomenclature
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentItem.numeroNomenclature}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      numeroNomenclature: e.target.value,
                    }))
                  }
                  placeholder="Auto-généré"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm font-mono"
                />
                <button
                  onClick={() =>
                    setCurrentItem((prev) => ({
                      ...prev,
                      numeroNomenclature: generateNomenclature(),
                    }))
                  }
                  className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"
                >
                  <Hash className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Garantie
              </label>
              <input
                type="text"
                value={currentItem.warranty}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    warranty: e.target.value,
                  }))
                }
                placeholder="3 ans, jusqu'au 2027-01-01"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Spécifications
              </label>
              <input
                type="text"
                value={currentItem.specifications}
                onChange={(e) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    specifications: e.target.value,
                  }))
                }
                placeholder="Caractéristiques techniques principales"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Observations
            </label>
            <textarea
              value={currentItem.observations}
              onChange={(e) =>
                setCurrentItem((prev) => ({
                  ...prev,
                  observations: e.target.value,
                }))
              }
              placeholder="Notes concernant cet article..."
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={addItem}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm"
            >
              <Plus className="h-4 w-4" />
              Ajouter à l'Entrée
            </button>
          </div>
        </div>
      </div>

      {/* Items List */}
      {entryItems.length > 0 && (
        <div className="bg-card border border-border rounded-lg shadow-sm">
          <div className="p-4 sm:p-6 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg text-card-foreground">
                Articles à Enregistrer ({entryItems.length})
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-muted-foreground">
                  Valeur totale du lot:
                </div>
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Euro className="h-4 w-4" />
                  {totalBatchValue.toLocaleString()}Ar
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="block lg:hidden p-4 space-y-3">
            {entryItems.map((item, index) => (
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
                    onClick={() => removeItem(index)}
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
                      {(item.uniteNombre * item.prixUnitaire).toLocaleString()}
                      Ar
                    </div>
                  </div>
                </div>
                <div className="text-xs">
                  <span className="text-muted-foreground">P.J.:</span>
                  <div className="text-card-foreground font-mono">
                    {item.pieceJustificative}
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
                      Espèce
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Quantité
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Prix Unit.
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Total
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entryItems.map((item, index) => (
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
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {item.espece}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.uniteNombre}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.prixUnitaire.toLocaleString()}Ar
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground font-semibold">
                        {(
                          item.uniteNombre * item.prixUnitaire
                        ).toLocaleString()}
                        Ar
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => removeItem(index)}
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
