import { useState } from "react";
import {
  Package,
  Search,
  Filter,
  Download,
  X,
  Eye,
  ChevronDown,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Calendar,
  DollarSign,
  Building,
  User,
  Activity,
  Printer,
  FileSpreadsheet,
  History,
  Copy,
  Share2,
  Archive,
} from "lucide-react";
import { EquipmentActions } from "./EquipmentActions";
import { User as UserType } from "../App";

interface EquipmentItem {
  [x: string]: any;
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
  },
  {
    id: 6,
    name: 'MacBook Pro 16" M2',
    serialNumber: "AP890123",
    category: "Informatique",
    status: "Attribué",
    department: "Marketing - Créatif",
    assignedTo: "Lucas Martin",
    purchaseDate: "2023-06-08",
    value: 2800,
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&h=80&fit=crop&crop=center",
    supplier: "Apple Store Pro",
    warranty: "1 an AppleCare+",
    specifications: "M2 Max, 32GB RAM, SSD 1TB",
    notes: "Station de travail créative",
  },
  {
    id: 7,
    name: "Webcam Logitech 4K Pro",
    serialNumber: "LG567890",
    category: "Périphériques",
    status: "Disponible",
    department: "Stock",
    purchaseDate: "2023-08-15",
    value: 250,
    image:
      "https://images.unsplash.com/photo-1588866692527-5ba7c2f2d786?w=80&h=80&fit=crop&crop=center",
    supplier: "Tech Vision",
    warranty: "2 ans",
    specifications: "4K Ultra HD, autofocus, micro intégré",
    notes: "Parfait pour visioconférences",
  },
  {
    id: 8,
    name: "NAS Synology DS220+",
    serialNumber: "SY123456",
    category: "Stockage",
    status: "Attribué",
    department: "IT - Infrastructure",
    assignedTo: "Thomas Dubois",
    purchaseDate: "2023-04-22",
    value: 680,
    image:
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=80&h=80&fit=crop&crop=center",
    supplier: "Network Solutions",
    warranty: "3 ans",
    specifications: "2 baies, Intel Celeron, 2GB RAM",
    notes: "Serveur de sauvegarde",
  },
];

type ViewMode = "table" | "grid";
type SortField = "name" | "category" | "status" | "value" | "purchaseDate";
type SortDirection = "asc" | "desc";

interface AllEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export function AllEquipmentModal({ isOpen, onClose }: AllEquipmentModalProps) {
  const [equipment, setEquipment] = useState<EquipmentItem[]>(mockEquipment);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [departmentFilter, setDepartmentFilter] = useState("Tous");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem[]>(
    []
  );
  const [showFilters, setShowFilters] = useState(false);
  const [viewingEquipment, setViewingEquipment] =
    useState<EquipmentItem | null>(null);

  if (!isOpen) return null;

  const filteredEquipment = equipment.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.assignedTo?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false);
    const matchesStatus =
      statusFilter === "Tous" || item.status === statusFilter;
    const matchesCategory =
      categoryFilter === "Toutes" || item.category === categoryFilter;
    const matchesDepartment =
      departmentFilter === "Tous" || item.department.includes(departmentFilter);
    return (
      matchesSearch && matchesStatus && matchesCategory && matchesDepartment
    );
  });

  const sortedEquipment = [...filteredEquipment].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === "value") {
      aValue = Number(aValue);
      bValue = Number(bValue);
    } else if (sortField === "purchaseDate") {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (sortDirection === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
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

  const totalValue = sortedEquipment.reduce((sum, item) => sum + item.value, 0);
  const statusCounts = equipment.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categories = [...new Set(equipment.map((item) => item.category))];
  const departments = [
    ...new Set(equipment.map((item) => item.department.split(" - ")[0])),
  ];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectEquipment = (equipment: EquipmentItem) => {
    if (selectedEquipment.find((item) => item.id === equipment.id)) {
      setSelectedEquipment((prev) =>
        prev.filter((item) => item.id !== equipment.id)
      );
    } else {
      setSelectedEquipment((prev) => [...prev, equipment]);
    }
  };

  const exportData = (format: "csv" | "pdf") => {
    console.log(
      `Exportation des données en ${format.toUpperCase()}`,
      sortedEquipment
    );
    alert(
      `Exportation des ${
        sortedEquipment.length
      } équipements en ${format.toUpperCase()} démarrée`
    );
  };

  // Equipment Actions Handlers
  const handleViewEquipment = (equipment: EquipmentItem) => {
    setViewingEquipment(equipment);
  };

  const handleEditEquipment = (equipment: EquipmentItem) => {
    console.log("Édition de l'équipement:", equipment);
    alert(`Édition de ${equipment.name} - ${equipment.serialNumber}`);
  };

  const handleDeleteEquipment = (equipmentId: number) => {
    setEquipment((prev) => prev.filter((item) => item.id !== equipmentId));
    console.log("Équipement supprimé:", equipmentId);
  };

  const handleDuplicateEquipment = (equipment: EquipmentItem) => {
    const newEquipment = {
      ...equipment,
      id: Math.max(...equipment.map((e) => e.id)) + 1,
      name: `${equipment.name} (Copie)`,
      serialNumber: `${equipment.serialNumber}-COPY`,
      status: "Disponible" as const,
      assignedTo: undefined,
    };
    setEquipment((prev) => [...prev, newEquipment]);
    console.log("Équipement dupliqué:", newEquipment);
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
    console.log("Équipement archivé:", equipment);
  };

  const handleViewHistory = (equipment: EquipmentItem) => {
    console.log("Historique équipement:", equipment);
    alert(`Historique des mouvements de ${equipment.name}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl text-card-foreground">
              Inventaire Complet des Équipements
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Vue d'ensemble de tous les équipements avec gestion avancée
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-xl text-card-foreground">
                {equipment.length}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">Disponibles</div>
              <div className="text-xl text-card-foreground">
                {statusCounts["Disponible"] || 0}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">Attribués</div>
              <div className="text-xl text-card-foreground">
                {statusCounts["Attribué"] || 0}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-sm text-muted-foreground">Valeur Totale</div>
              <div className="text-xl text-card-foreground">
                {totalValue.toLocaleString()}Ar
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-border space-y-4">
          {/* Search and View Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher par nom, numéro série, direction ou utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  showFilters
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:bg-muted"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filtres
                {(statusFilter !== "Tous" ||
                  categoryFilter !== "Toutes" ||
                  departmentFilter !== "Tous") && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                )}
              </button>
              <div className="flex items-center border border-border rounded-lg p-1">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1 rounded transition-colors ${
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1 rounded transition-colors ${
                    viewMode === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => exportData("csv")}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors dark:bg-green-900/30 dark:text-green-400"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </button>
                <button
                  onClick={() => exportData("pdf")}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400"
                >
                  <Printer className="h-4 w-4" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/20 rounded-lg border border-border">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
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
                className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="Toutes">Toutes catégories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="Tous">Tous Directions</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="px-6 py-3 border-b border-border bg-muted/10">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Affichage de {sortedEquipment.length} sur {equipment.length}{" "}
              équipements
              {filteredEquipment.length !== equipment.length && " (filtré)"}
            </p>
            {selectedEquipment.length > 0 && (
              <p className="text-sm text-primary">
                {selectedEquipment.length} équipement(s) sélectionné(s)
              </p>
            )}
          </div>
        </div>

        {/* Equipment List */}
        <div className="flex-1 overflow-auto">
          {viewMode === "table" ? (
            <div className="p-6">
              <table className="w-full">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-4">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEquipment([...sortedEquipment]);
                          } else {
                            setSelectedEquipment([]);
                          }
                        }}
                        checked={
                          selectedEquipment.length === sortedEquipment.length &&
                          sortedEquipment.length > 0
                        }
                        className="rounded border-border"
                      />
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Équipement
                        {sortField === "name" &&
                          (sortDirection === "asc" ? (
                            <SortAsc className="h-3 w-3" />
                          ) : (
                            <SortDesc className="h-3 w-3" />
                          ))}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort("category")}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Catégorie
                        {sortField === "category" &&
                          (sortDirection === "asc" ? (
                            <SortAsc className="h-3 w-3" />
                          ) : (
                            <SortDesc className="h-3 w-3" />
                          ))}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Statut
                        {sortField === "status" &&
                          (sortDirection === "asc" ? (
                            <SortAsc className="h-3 w-3" />
                          ) : (
                            <SortDesc className="h-3 w-3" />
                          ))}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Directions
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Assigné à
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort("value")}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Valeur
                        {sortField === "value" &&
                          (sortDirection === "asc" ? (
                            <SortAsc className="h-3 w-3" />
                          ) : (
                            <SortDesc className="h-3 w-3" />
                          ))}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <button
                        onClick={() => handleSort("purchaseDate")}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Date d'achat
                        {sortField === "purchaseDate" &&
                          (sortDirection === "asc" ? (
                            <SortAsc className="h-3 w-3" />
                          ) : (
                            <SortDesc className="h-3 w-3" />
                          ))}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEquipment.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedEquipment.some(
                            (eq) => eq.id === item.id
                          )}
                          onChange={() => handleSelectEquipment(item)}
                          className="rounded border-border"
                        />
                      </td>
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
                            <div className="text-xs text-muted-foreground font-mono">
                              {item.serialNumber}
                            </div>
                          </div>
                        </div>
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
                      <td className="py-3 px-4 text-sm text-card-foreground max-w-[150px] truncate">
                        {item.department}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.assignedTo || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.value.toLocaleString()}Ar
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {item.purchaseDate}
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
          ) : (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedEquipment.map((item) => (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow bg-card"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="checkbox"
                      checked={selectedEquipment.some(
                        (eq) => eq.id === item.id
                      )}
                      onChange={() => handleSelectEquipment(item)}
                      className="rounded border-border"
                    />
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getStatusColor(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
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
                      <div className="text-xs text-muted-foreground font-mono">
                        {item.serialNumber}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Catégorie:</span>
                      <span className="text-card-foreground">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur:</span>
                      <span className="text-card-foreground">
                        {item.value.toLocaleString()}Ar
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Direction:</span>
                      <span className="text-card-foreground truncate">
                        {item.department}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigné à:</span>
                      <span className="text-card-foreground truncate">
                        {item.assignedTo || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground">
                      {item.purchaseDate}
                    </div>
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
          )}

          {sortedEquipment.length === 0 && (
            <div className="p-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="text-sm text-muted-foreground mb-2">
                Aucun équipement trouvé
              </h4>
              <p className="text-xs text-muted-foreground">
                Aucun équipement ne correspond aux critères de recherche
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Equipment Detail Modal */}
      {viewingEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-card-foreground">
                Détails de l'équipement
              </h3>
              <button
                onClick={() => setViewingEquipment(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={viewingEquipment.image}
                  alt={viewingEquipment.name}
                  className="w-16 h-16 rounded-md object-cover"
                />
                <div>
                  <div className="text-card-foreground">
                    {viewingEquipment.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {viewingEquipment.serialNumber}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">Catégorie</div>
                  <div className="text-card-foreground">
                    {viewingEquipment.category}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Statut</div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                      viewingEquipment.status
                    )}`}
                  >
                    {viewingEquipment.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Direction</div>
                  <div className="text-card-foreground">
                    {viewingEquipment.department}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Assigné à</div>
                  <div className="text-card-foreground">
                    {viewingEquipment.assignedTo || "Non assigné"}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">
                    Date d'achat
                  </div>
                  <div className="text-card-foreground">
                    {viewingEquipment.purchaseDate}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Valeur</div>
                  <div className="text-card-foreground">
                    {viewingEquipment.value.toLocaleString()}Ar
                  </div>
                </div>
                {viewingEquipment.supplier && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Fournisseur
                    </div>
                    <div className="text-card-foreground">
                      {viewingEquipment.supplier}
                    </div>
                  </div>
                )}
                {viewingEquipment.warranty && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Garantie
                    </div>
                    <div className="text-card-foreground">
                      {viewingEquipment.warranty}
                    </div>
                  </div>
                )}
                {viewingEquipment.specifications && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Spécifications
                    </div>
                    <div className="text-card-foreground text-xs whitespace-pre-line">
                      {viewingEquipment.specifications}
                    </div>
                  </div>
                )}
                {viewingEquipment.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground">Notes</div>
                    <div className="text-card-foreground text-xs">
                      {viewingEquipment.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
