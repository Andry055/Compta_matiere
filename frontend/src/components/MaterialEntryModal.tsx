import { useState } from "react";
import {
  Plus,
  Save,
  ArrowDown,
  Package,
  Calendar,
  User as UserIcon,
  Building,
  X,
  Scan,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { User } from "../App";

interface MaterialEntryModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

interface EntryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitValue: number;
  supplier: string;
  serialNumbers: string[];
  notes: string;
}

const categories = [
  "Informatique",
  "Périphériques",
  "Affichage",
  "Impression",
  "Communication",
  "Mobilier",
  "Outillage",
  "Autre",
];

const suppliers = [
  "TechnoFournisseur SARL",
  "EquipementPro",
  "Distrib'IT France",
  "Matériel Express",
  "Supply Chain Plus",
  "Bureau Solutions",
];

export function MaterialEntryModal({
  user,
  isOpen,
  onClose,
}: MaterialEntryModalProps) {
  const [entryItems, setEntryItems] = useState<EntryItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<EntryItem>>({
    name: "",
    category: "",
    quantity: 1,
    unitValue: 0,
    supplier: "",
    serialNumbers: [],
    notes: "",
  });
  const [entryReference, setEntryReference] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [deliveryNote, setDeliveryNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [showNotification, setShowNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const generateReference = () => {
    const date = new Date();
    const ref = `ENT-${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(
      entryItems.length + 1
    ).padStart(3, "0")}`;
    setEntryReference(ref);
  };

  const addItem = async () => {
    // Validate required fields
    const errors: { [key: string]: string } = {};

    if (!currentItem.name?.trim()) {
      errors.name = "Le nom de l'équipement est obligatoire";
    }
    if (!currentItem.category) {
      errors.category = "La catégorie est obligatoire";
    }
    if (!currentItem.quantity || currentItem.quantity < 1) {
      errors.quantity = "La quantité doit être d'au moins 1";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setShowNotification({
        type: "error",
        message: "Veuillez corriger les erreurs dans le formulaire",
      });
      setTimeout(() => setShowNotification(null), 4000);
      return;
    }

    setFormErrors({});
    setIsAddingItem(true);

    // Simulate API call delay
    setTimeout(() => {
      const newItem: EntryItem = {
        id: Math.random().toString(36).substr(2, 9),
        name: currentItem.name!,
        category: currentItem.category!,
        quantity: currentItem.quantity!,
        unitValue: currentItem.unitValue || 0,
        supplier: currentItem.supplier || "",
        serialNumbers: currentItem.serialNumbers || [],
        notes: currentItem.notes || "",
      };

      setEntryItems([...entryItems, newItem]);
      setCurrentItem({
        name: "",
        category: "",
        quantity: 1,
        unitValue: 0,
        supplier: "",
        serialNumbers: [],
        notes: "",
      });

      if (!entryReference) {
        generateReference();
      }

      setIsAddingItem(false);
      setShowNotification({
        type: "success",
        message: "Élément ajouté avec succès!",
      });
      setTimeout(() => setShowNotification(null), 3000);
    }, 800);
  };

  const removeItem = (id: string) => {
    setEntryItems(entryItems.filter((item) => item.id !== id));
  };

  const saveEntry = async () => {
    if (entryItems.length === 0) {
      setShowNotification({
        type: "error",
        message: "Ajoutez au moins un élément avant de sauvegarder",
      });
      setTimeout(() => setShowNotification(null), 4000);
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate 95% success rate
          if (Math.random() > 0.05) {
            resolve(null);
          } else {
            reject(new Error("Erreur de connexion au serveur"));
          }
        }, 2000);
      });

      const entry = {
        reference: entryReference,
        items: entryItems,
        deliveryDate,
        deliveryNote,
        enteredBy: user.name,
        department: user.department,
        timestamp: new Date().toISOString(),
      };

      console.log("Saving entry:", entry);

      setShowNotification({
        type: "success",
        message: "Entrée sauvegardée avec succès!",
      });

      // Close modal after delay
      setTimeout(() => {
        resetForm();
        onClose();
        setShowNotification(null);
      }, 1500);
    } catch (error) {
      setShowNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de la sauvegarde",
      });
      setTimeout(() => setShowNotification(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEntryItems([]);
    setEntryReference("");
    setDeliveryNote("");
    setCurrentItem({
      name: "",
      category: "",
      quantity: 1,
      unitValue: 0,
      supplier: "",
      serialNumbers: [],
      notes: "",
    });
  };

  const handleClose = () => {
    if (entryItems.length > 0) {
      if (
        confirm(
          "Vous avez des éléments non sauvegardés. Voulez-vous vraiment fermer ?"
        )
      ) {
        resetForm();
        onClose();
      }
    } else {
      resetForm();
      onClose();
    }
  };

  const totalValue = entryItems.reduce(
    (sum, item) => sum + item.quantity * item.unitValue,
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      {/* Success/Error Notification */}
      {showNotification && (
        <div
          className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl text-white animate-in slide-in-from-right-full duration-300 ${
            showNotification.type === "success"
              ? "bg-gradient-to-r from-green-500 to-green-600"
              : "bg-gradient-to-r from-red-500 to-red-600"
          }`}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
            {showNotification.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">
              {showNotification.message}
            </div>
            <div className="text-xs opacity-90">
              {showNotification.type === "success"
                ? "Opération réussie"
                : "Une erreur est survenue"}
            </div>
          </div>
          <button
            onClick={() => setShowNotification(null)}
            className="ml-4 text-white/80 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-green-50 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center">
              <ArrowDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg text-card-foreground">
                Nouvelle Entrée de Matériel
              </h2>
              <p className="text-sm text-muted-foreground">
                Enregistrer l'arrivée de nouveaux équipements
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Entry Information */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h3 className="text-sm text-card-foreground mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Informations de l'Entrée
            </h3>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Référence d'entrée
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                    placeholder="Auto-généré"
                    className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                  <button
                    onClick={generateReference}
                    className="px-3 py-2 border border-border rounded-lg hover:bg-muted text-sm"
                  >
                    Auto
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Date de livraison
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Bon de livraison
                </label>
                <input
                  type="text"
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Numéro du bon de livraison"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
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

          {/* Add Item Form */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="text-sm text-card-foreground mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un Élément
            </h3>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <label className="block text-sm text-muted-foreground mb-2">
                  Nom de l'équipement *
                </label>
                <input
                  type="text"
                  value={currentItem.name}
                  onChange={(e) => {
                    setCurrentItem({ ...currentItem, name: e.target.value });
                    if (formErrors.name) {
                      setFormErrors({ ...formErrors, name: "" });
                    }
                  }}
                  placeholder="Ex: Ordinateur portable HP EliteBook"
                  className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                    formErrors.name
                      ? "border-red-500 focus:ring-red-500"
                      : "border-border"
                  }`}
                />
                {formErrors.name && (
                  <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.name}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Catégorie *
                </label>
                <select
                  value={currentItem.category}
                  onChange={(e) => {
                    setCurrentItem({
                      ...currentItem,
                      category: e.target.value,
                    });
                    if (formErrors.category) {
                      setFormErrors({ ...formErrors, category: "" });
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                    formErrors.category
                      ? "border-red-500 focus:ring-red-500"
                      : "border-border"
                  }`}
                >
                  <option value="">Sélectionner...</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {formErrors.category && (
                  <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.category}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Quantité *
                </label>
                <input
                  type="number"
                  min="1"
                  value={currentItem.quantity}
                  onChange={(e) => {
                    setCurrentItem({
                      ...currentItem,
                      quantity: parseInt(e.target.value) || 1,
                    });
                    if (formErrors.quantity) {
                      setFormErrors({ ...formErrors, quantity: "" });
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                    formErrors.quantity
                      ? "border-red-500 focus:ring-red-500"
                      : "border-border"
                  }`}
                />
                {formErrors.quantity && (
                  <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {formErrors.quantity}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Valeur unitaire (Ar)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.unitValue}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      unitValue: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Fournisseur
                </label>
                <select
                  value={currentItem.supplier}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, supplier: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
                >
                  <option value="">Sélectionner...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-muted-foreground mb-2">
                Notes
              </label>
              <textarea
                value={currentItem.notes}
                onChange={(e) =>
                  setCurrentItem({ ...currentItem, notes: e.target.value })
                }
                placeholder="Informations complémentaires..."
                rows={2}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={addItem}
                disabled={isAddingItem}
                className="group relative inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-sm font-medium disabled:cursor-not-allowed disabled:scale-100 disabled:opacity-90"
              >
                {/* Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Loading Overlay */}
                {isAddingItem && (
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-500/10 animate-pulse" />
                )}

                {/* Icon */}
                <div className="relative flex items-center justify-center w-4 h-4">
                  {isAddingItem ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 group-hover:rotate-90 group-hover:scale-110 transition-transform duration-300" />
                  )}
                </div>

                {/* Text */}
                <span className="relative">
                  {isAddingItem ? "Ajout..." : "Ajouter à l'Entrée"}
                </span>

                {/* Border Glow */}
                <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                {/* Shimmer Effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out" />
              </button>
            </div>
          </div>

          {/* Items List */}
          {entryItems.length > 0 && (
            <div className="border border-border rounded-lg">
              <div className="p-4 border-b border-border bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-sm text-card-foreground">
                    Éléments à Enregistrer ({entryItems.length})
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    Valeur totale:{" "}
                    <span className="text-foreground">
                      {totalValue.toLocaleString()}Ar
                    </span>
                  </div>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto">
                {entryItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-card-foreground truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.category} • Qté: {item.quantity} •{" "}
                        {item.unitValue}Ar
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-4 text-destructive hover:text-destructive/80 text-xs px-2 py-1 rounded hover:bg-destructive/10"
                    >
                      Supprimer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 sm:p-6 bg-muted/20">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-sm transition-colors"
            >
              Annuler
            </button>
            <ScannerButton
              onScan={(data) => {
                setShowNotification({
                  type: "success",
                  message: `Code scanné: ${data}`,
                });
                setTimeout(() => setShowNotification(null), 3000);
              }}
            />
            <button
              onClick={saveEntry}
              disabled={entryItems.length === 0 || isSubmitting}
              className={`group relative inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 transform-gpu overflow-hidden ${
                entryItems.length > 0 && !isSubmitting
                  ? "bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md shadow-green-600/25 hover:shadow-lg hover:shadow-green-600/40 hover:scale-105 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {/* Background Effects */}
              {entryItems.length > 0 && !isSubmitting && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out" />
                </>
              )}

              {/* Loading Overlay */}
              {isSubmitting && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-green-600/10 animate-pulse" />
              )}

              {/* Icon */}
              <div className="relative flex items-center justify-center w-4 h-4">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
                )}
              </div>

              {/* Text */}
              <span className="relative">
                {isSubmitting ? "Sauvegarde..." : "Sauvegarder Entrée"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Scanner Button Component
interface ScannerButtonProps {
  onScan: (data: string) => void;
}

function ScannerButton({ onScan }: ScannerButtonProps) {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);

    // Simulate scanning process
    setTimeout(() => {
      const mockScannedData = `EQP-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`;
      onScan(mockScannedData);
      setIsScanning(false);
    }, 2000);
  };

  return (
    <button
      onClick={handleScan}
      disabled={isScanning}
      className="group relative inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg transition-all duration-200 hover:bg-muted hover:border-primary/50 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg" />

      {/* Icon */}
      <div className="relative flex items-center justify-center w-4 h-4">
        {isScanning ? (
          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
        ) : (
          <Scan className="h-4 w-4 group-hover:text-purple-600 transition-colors duration-200" />
        )}
      </div>

      {/* Text */}
      <span className="relative group-hover:text-purple-600 transition-colors duration-200">
        {isScanning ? "Scan..." : "Scanner"}
      </span>

      {/* Scanning Animation */}
      {isScanning && (
        <div className="absolute inset-0 border-2 border-purple-500/30 rounded-lg animate-pulse" />
      )}

      {/* Hover Border */}
      <div className="absolute inset-0 border border-purple-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </button>
  );
}
