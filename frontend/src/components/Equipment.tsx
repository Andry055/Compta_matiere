import { useState } from "react";
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Filter,
  Check,
  X,
  Grid3X3,
  BarChart3,
} from "lucide-react";
import { AddEquipmentModal } from "./AddEquipmentModal";
import { AllEquipmentModal } from "./AllEquipmentModal";
import { EquipmentActions } from "./EquipmentActions";
import { User as UserType } from "../App";
import { JournalEntry } from "../types/accounting";
import { toast } from "sonner";

interface EquipmentItem {
  id: number;
  name: string;
  serialNumber: string;
  category: string;
  status: "Disponible" | "Attribué" | "Maintenance" | "Retiré";
  department: string;
  assignedTo?: string;
  purchaseDate: string;
  value: number;
  image: string;
  supplier?: string;
  warranty?: string;
  specifications?: string;
  notes?: string;
  // Nouvelles propriétés du journal comptable
  numeroOrdre?: string;
  pieceJustificative?: string;
  numeroNomenclature?: string;
  brand?: string;
  model?: string;
}

// Mock current user - in real app this would come from props
const mockCurrentUser: UserType = {
  id: "1",
  name: "Admin User",
  email: "admin@comptamatiere.com",
  role: "admin",
  department: "IT",
  permissions: [
    "equipment.view",
    "equipment.edit",
    "equipment.delete",
    "equipment.create",
  ],
};

interface NewEquipmentData {
  name: string;
  serialNumber: string;
  category: string;
  status: "Disponible" | "Attribué" | "Maintenance" | "Retiré";
  department: string;
  assignedTo?: string;
  purchaseDate: string;
  value: number;
  supplier: string;
  warranty: string;
  specifications: string;
  notes: string;
  image?: string;
}

const mockEquipment: EquipmentItem[] = [
  {
    id: 1,
    name: "Ordinateur portable HP EliteBook",
    serialNumber: "HP240501A",
    category: "Informatique",
    status: "Attribué",
    department: "IT - Développement",
    assignedTo: "Marie Dubois",
    purchaseDate: "2023-01-15",
    value: 1200,
    image:
      "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center",
    supplier: "TechnoFournisseur SARL",
    warranty: "3 ans jusqu'au 2026-01-15",
    specifications: "Intel Core i7, 16GB RAM, SSD 512GB",
    notes: "Configuration développement",
    numeroOrdre: "2023-001",
    pieceJustificative: "BC-2023-015",
    numeroNomenclature: "INFO-001",
    brand: "HP",
    model: "EliteBook 840",
  },
  {
    id: 2,
    name: "Clavier mécanique Logitech",
    serialNumber: "LG789456",
    category: "Périphériques",
    status: "Disponible",
    department: "Stock",
    purchaseDate: "2023-03-20",
    value: 120,
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=80&h=80&fit=crop&crop=center",
    supplier: "Bureau Solutions",
    warranty: "2 ans",
    specifications: "Switches Cherry MX Blue, rétroéclairage RGB",
    notes: "Excellent état",
    numeroOrdre: "2023-002",
    pieceJustificative: "BC-2023-020",
    numeroNomenclature: "PER-001",
    brand: "Logitech",
    model: "MX Mechanical",
  },
  {
    id: 3,
    name: 'Écran Dell UltraSharp 24"',
    serialNumber: "DL987321",
    category: "Affichage",
    status: "Maintenance",
    department: "IT - Support",
    purchaseDate: "2022-11-10",
    value: 320,
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=80&h=80&fit=crop&crop=center",
    supplier: "Digital Store",
    warranty: "Expirée",
    specifications: "24'' IPS, 1920x1080, USB-C",
    notes: "Pixels morts détectés",
    numeroOrdre: "2022-045",
    pieceJustificative: "BC-2022-110",
    numeroNomenclature: "AFF-001",
    brand: "Dell",
    model: "UltraSharp U2422H",
  },
  {
    id: 4,
    name: "Imprimante laser Canon",
    serialNumber: "CN445678",
    category: "Impression",
    status: "Attribué",
    department: "Finance - Comptabilité",
    assignedTo: "Sophie Bernard",
    purchaseDate: "2023-02-05",
    value: 450,
    image:
      "https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=80&h=80&fit=crop&crop=center",
    supplier: "Office Equipment Co.",
    warranty: "1 an",
    specifications: "Laser couleur, Wifi, Recto-verso",
    notes: "Usage intensif",
    numeroOrdre: "2023-015",
    pieceJustificative: "BC-2023-025",
    numeroNomenclature: "IMP-001",
    brand: "Canon",
    model: "i-SENSYS LBP623Cdw",
  },
  {
    id: 5,
    name: "Téléphone IP Cisco",
    serialNumber: "CS789012",
    category: "Communication",
    status: "Disponible",
    department: "Stock",
    purchaseDate: "2023-04-12",
    value: 180,
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop&crop=center",
    supplier: "Tech Partners",
    warranty: "5 ans",
    specifications: "VoIP, écran couleur, PoE",
    notes: "Neuf dans l'emballage",
    numeroOrdre: "2023-035",
    pieceJustificative: "BC-2023-050",
    numeroNomenclature: "COM-001",
    brand: "Cisco",
    model: "IP Phone 7841",
  },
];

export function Equipment() {
  const [equipment, setEquipment] = useState<EquipmentItem[]>(mockEquipment);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentItem | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showAllEquipmentModal, setShowAllEquipmentModal] = useState(false);

  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "Tous" || item.status === statusFilter;
    const matchesCategory =
      categoryFilter === "Toutes" || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Disponible":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Attribué":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Maintenance":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "Retiré":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const handleAddEquipment = (journalEntry: Omit<JournalEntry, "id">) => {
    // Convertir l'entrée journal en format d'équipement pour l'affichage
    const newEquipment: EquipmentItem = {
      id: equipment.length + 1,
      name: journalEntry.designation,
      serialNumber: journalEntry.numeroOrdre || `SN-${Date.now()}`, // Utiliser numeroOrdre comme fallback
      category: journalEntry.espece,
      status:
        journalEntry.statut === "en_stock"
          ? "Disponible"
          : journalEntry.statut === "distribue"
          ? "Attribué"
          : journalEntry.statut === "maintenance"
          ? "Maintenance"
          : "Retiré",
      department: "Stock", // Valeur par défaut - à adapter selon vos besoins
      purchaseDate: journalEntry.dateEntree,
      value: journalEntry.valeurTotale,
      image: `https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center&sig=${journalEntry.numeroOrdre}`,
      supplier: journalEntry.origine?.nom || "",
      warranty: "", // Valeur par défaut
      specifications: "", // Valeur par défaut
      notes: journalEntry.observations || "",
      // Nouvelles propriétés du journal comptable
      numeroOrdre: journalEntry.numeroOrdre,
      pieceJustificative: journalEntry.pieceJustificative,
      numeroNomenclature: journalEntry.numeroNomenclature,
      brand: "", // Valeur par défaut
      model: "", // Valeur par défaut
    };

    setEquipment((prev) => [...prev, newEquipment]);
    setShowSuccessMessage(true);

    // Hide success message after 3 seconds
    setTimeout(() => setShowSuccessMessage(false), 3000);

    // Log l'entrée dans le journal comptable (en production, cela serait sauvé dans la DB)
    console.log("Nouvelle entrée journal:", journalEntry);

    toast.success("Équipement ajouté au registre", {
      description: `${journalEntry.designation} enregistré avec traçabilité comptable complète`,
    });
  };

  const handleDeleteEquipment = (id: number) => {
    setEquipment((prev) => prev.filter((item) => item.id !== id));
  };

  // Equipment Actions Handlers
  const handleViewEquipment = (equipment: EquipmentItem) => {
    setSelectedItem(equipment);
  };

  const handleEditEquipment = (equipment: EquipmentItem) => {
    console.log("Édition de l'équipement:", equipment);
    alert(`Édition de ${equipment.name} - ${equipment.serialNumber}`);
  };

  const handleDuplicateEquipment = (equipment: EquipmentItem) => {
    const newEquipment = {
      ...equipment,
      id: Math.max(...mockEquipment.map((e) => e.id)) + 1, // ✅ Correction
      name: `${equipment.name} (Copie)`,
      serialNumber: `${equipment.serialNumber}-COPY`,
      status: "Disponible" as const,
      assignedTo: undefined,
    };
    setEquipment((prev) => [...prev, newEquipment]);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleExportEquipment = (equipment: EquipmentItem) => {
    console.log("Export individuel:", equipment);
    alert(`Export des données de ${equipment.name}`);
  };

  const handleShareEquipment = (equipment: EquipmentItem) => {
    console.log("Partage équipement:", equipment);
    alert(`Partage des informations de ${equipment.name}`);
  };

  const handleArchiveEquipment = (equipment: EquipmentItem) => {
    setEquipment((prev) =>
      prev.map((item) =>
        item.id === equipment.id
          ? { ...item, status: "Retiré" as const, assignedTo: undefined }
          : item
      )
    );
  };

  const handleViewHistory = (equipment: EquipmentItem) => {
    console.log("Historique équipement:", equipment);
    alert(`Historique des mouvements de ${equipment.name}`);
  };

  const totalValue = filteredEquipment.reduce(
    (sum, item) => sum + item.value,
    0
  );
  const statusCounts = equipment.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-green-100 border border-green-200 rounded-lg shadow-lg text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span className="text-sm">
            Équipement enregistré dans le journal comptable!
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">
            Registre des Équipements
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Inventaire complet avec traçabilité comptable et pièces
            justificatives
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAllEquipmentModal(true)}
            className="group relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 text-sm"
          >
            <BarChart3 className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
            <span className="relative font-medium hidden sm:inline">
              Vue Complète
            </span>
            <span className="relative font-medium sm:hidden">Complet</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="group relative inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden text-sm sm:text-base"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 group-hover:rotate-90 transition-transform duration-200" />
            <span className="relative font-medium hidden sm:inline">
              Ajouter Équipement
            </span>
            <span className="relative font-medium sm:hidden">Ajouter</span>
            <div className="absolute inset-0 border border-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <Package className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Total Équipements
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {equipment.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center text-xs">
              {statusCounts["Disponible"] || 0}
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Disponibles
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {statusCounts["Disponible"] || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center text-xs">
              {statusCounts["Maintenance"] || 0}
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                En Maintenance
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {statusCounts["Maintenance"] || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-6 w-6 sm:h-8 sm:w-8 p-1 sm:p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center text-xs">
              Ar
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Valeur Totale
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {totalValue.toLocaleString()}Ar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom ou numéro de série..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="Tous">Tous les statuts</option>
              <option value="Disponible">Disponible</option>
              <option value="Attribué">Attribué</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Retiré">Retiré</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
            >
              <option value="Toutes">Toutes catégories</option>
              <option value="Informatique">Informatique</option>
              <option value="Périphériques">Périphériques</option>
              <option value="Affichage">Affichage</option>
              <option value="Impression">Impression</option>
              <option value="Communication">Communication</option>
            </select>
          </div>
        </div>
      </div>

      {/* Equipment List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg text-card-foreground">
              Liste des Équipements ({filteredEquipment.length})
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              {filteredEquipment.length !== equipment.length && (
                <span>Filtré sur {equipment.length} équipements</span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden p-4 space-y-4">
          {filteredEquipment.map((item) => (
            <div
              key={item.id}
              className="border border-border rounded-lg p-4 space-y-3 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-card-foreground truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.serialNumber}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Catégorie:</span>
                  <div className="text-card-foreground">{item.category}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Valeur:</span>
                  <div className="text-card-foreground">{item.value}Ar</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Direction:</span>
                  <div className="text-card-foreground truncate">
                    {item.department}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigné à:</span>
                  <div className="text-card-foreground truncate">
                    {item.assignedTo || "-"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                    item.status
                  )}`}
                >
                  {item.status}
                </span>
                <EquipmentActions
                  equipment={item}
                  currentUser={mockCurrentUser}
                  onView={handleViewEquipment}
                  onEdit={handleEditEquipment}
                  onDelete={handleDeleteEquipment}
                  onDuplicate={handleDuplicateEquipment}
                  onExport={handleExportEquipment}
                  onShare={handleShareEquipment}
                  onArchive={handleArchiveEquipment}
                  onViewHistory={handleViewHistory}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Équipement
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    N° Série
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Catégorie
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Direction
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Assigné à
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Valeur
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                        <div>
                          <div className="text-sm text-card-foreground max-w-[200px] truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Acheté le {item.purchaseDate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground font-mono">
                      {item.serialNumber}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {item.category}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {item.department}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {item.assignedTo || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {item.value}Ar
                    </td>
                    <td className="py-3 px-4">
                      <EquipmentActions
                        equipment={item}
                        currentUser={mockCurrentUser}
                        onView={handleViewEquipment}
                        onEdit={handleEditEquipment}
                        onDelete={handleDeleteEquipment}
                        onDuplicate={handleDuplicateEquipment}
                        onExport={handleExportEquipment}
                        onShare={handleShareEquipment}
                        onArchive={handleArchiveEquipment}
                        onViewHistory={handleViewHistory}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredEquipment.length === 0 && (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-sm text-muted-foreground mb-2">
              Aucun équipement trouvé
            </h4>
            <p className="text-xs text-muted-foreground">
              {searchTerm ||
              statusFilter !== "Tous" ||
              categoryFilter !== "Toutes"
                ? "Aucun équipement ne correspond aux critères de recherche"
                : "Commencez par ajouter un équipement"}
            </p>
          </div>
        )}
      </div>

      {/* Equipment Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-card-foreground">
                Détails de l'équipement
              </h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="w-16 h-16 rounded-md object-cover"
                />
                <div>
                  <div className="text-card-foreground">
                    {selectedItem.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedItem.serialNumber}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Catégorie</div>
                  <div className="text-card-foreground">
                    {selectedItem.category}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Statut</div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                      selectedItem.status
                    )}`}
                  >
                    {selectedItem.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Direction</div>
                  <div className="text-card-foreground">
                    {selectedItem.department}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Assigné à</div>
                  <div className="text-card-foreground">
                    {selectedItem.assignedTo || "Non assigné"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Date d'achat
                  </div>
                  <div className="text-card-foreground">
                    {selectedItem.purchaseDate}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Valeur</div>
                  <div className="text-card-foreground">
                    {selectedItem.value}Ar
                  </div>
                </div>
                {selectedItem.supplier && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Fournisseur
                    </div>
                    <div className="text-card-foreground">
                      {selectedItem.supplier}
                    </div>
                  </div>
                )}
                {selectedItem.warranty && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Garantie
                    </div>
                    <div className="text-card-foreground">
                      {selectedItem.warranty}
                    </div>
                  </div>
                )}
                {selectedItem.specifications && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Spécifications
                    </div>
                    <div className="text-card-foreground text-xs whitespace-pre-line">
                      {selectedItem.specifications}
                    </div>
                  </div>
                )}
                {selectedItem.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground">Notes</div>
                    <div className="text-card-foreground text-xs">
                      {selectedItem.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      <AddEquipmentModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddEquipment}
      />

      {/* All Equipment Modal */}
      <AllEquipmentModal
        isOpen={showAllEquipmentModal}
        onClose={() => setShowAllEquipmentModal(false)}
      />
    </div>
  );
}
