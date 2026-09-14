import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { 
  Package, 
  Truck, 
  Building, 
  ArrowRight, 
  Search, 
  Filter, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ClipboardList, 
  User, 
  Users, 
  Phone, 
  Mail,
  Grid3X3,
  List,
  Eye,
  Calendar,
  MapPin,
  Wrench
} from "lucide-react"
import { toast } from "sonner"
import { DistributionRequests } from "./DistributionRequests"

// Types pour la distribution
interface Employee {
  id: string;
  name: string;
  im: string,
  email: string;
  phone?: string;
  fonction: string;
  departmentId: string;
  isActive: boolean;
  avatar?: string;
}

interface EquipmentStock {
  id: string
  name: string
  category: string
  serialNumber: string
  brand: string
  model: string
  entryDate: string
  status: 'en_stock' | 'distribue' | 'maintenance'
  assignedTo?: string
  assignedToId?: string
  assignedToEmail?: string
  assignedDepartment?: string
  assignedDepartmentId?: string
  distributionDate?: string
  assignmentNotes?: string
  image?: string
}

interface Department {
  id: string
  name: string
  code: string
  manager: string
  managerId: string
  location: string
  employeeCount: number
}

type ViewMode = 'table' | 'grid'

// Données fictives des employés
const employees: Employee[] = [
  {
    id: "EMP001",
    name: "Jean Dupont",
    im: "342.123",
    email: "jean.dupont@company.com",
    phone: "+33 1 23 45 67 89",
    fonction: "Chef Comptable",
    departmentId: "DEPT001",
    isActive: true,
  },
  {
    id: "EMP002",
    name: "Marie Dubois",
    im: "342.123",
    email: "marie.dubois@company.com",
    phone: "+33 1 23 45 67 90",
    fonction: "Comptable Senior",
    departmentId: "DEPT001",
    isActive: true,
  },
  {
    id: "EMP003",
    name: "Sophie Martin",
    im: "321.001",
    email: "sophie.martin@company.com",
    phone: "+33 1 23 45 67 91",
    fonction: "Responsable RH",
    departmentId: "DEPT002",
    isActive: true,
  },
  {
    id: "EMP004",
    name: "Claire Rousseau",
    im: "311.031",
    email: "claire.rousseau@company.com",
    phone: "+33 1 23 45 67 92",
    fonction: "Assistante RH",
    departmentId: "DEPT002",
    isActive: true,
  },
  {
    id: "EMP005",
    name: "Pierre Durand",
    im: "311.126",
    email: "pierre.durand@company.com",
    phone: "+33 1 23 45 67 93",
    fonction: "Responsable IT",
    departmentId: "DEPT003",
    isActive: true,
  },
  {
    id: "EMP006",
    name: "Marc Leroy",
    im: "331.001",
    email: "marc.leroy@company.com",
    phone: "+33 1 23 45 67 94",
    fonction: "Développeur Senior",
    departmentId: "DEPT003",
    isActive: true,
  },
  {
    id: "EMP007",
    name: "Julie Moreau",
    im: "104.222",
    email: "julie.moreau@company.com",
    phone: "+33 1 23 45 67 95",
    fonction: "Responsable Marketing",
    departmentId: "DEPT004",
    isActive: true,
  },
  {
    id: "EMP008",
    name: "Antoine Blanc",
    im: "221.334",
    email: "antoine.blanc@company.com",
    phone: "+33 1 23 45 67 96",
    fonction: "Marketing Specialist",
    departmentId: "DEPT004",
    isActive: true,
  },
  {
    id: "EMP009",
    name: "Michel Bernard",
    im: "210.233",
    email: "michel.bernard@company.com",
    phone: "+33 1 23 45 67 97",
    fonction: "Chef de Production",
    departmentId: "DEPT005",
    isActive: true,
  },
  {
    id: "EMP010",
    name: "Vincent Thomas",
    im: "543.001",
    email: "vincent.thomas@company.com",
    phone: "+33 1 23 45 67 98",
    fonction: "Opérateur Production",
    departmentId: "DEPT005",
    isActive: true,
  },
];

// Données fictives des équipements (mis à jour avec images)
const stockEquipments: EquipmentStock[] = [
  {
    id: "EQ001",
    name: "Ordinateur Portable Dell",
    category: "Informatique",
    serialNumber: "DL2024001",
    brand: "Dell",
    model: "Latitude 5520",
    entryDate: "2024-01-15",
    status: "en_stock",
    image: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ002",
    name: "Imprimante Laser HP",
    category: "Bureautique",
    serialNumber: "HP2024002",
    brand: "HP",
    model: "LaserJet Pro 400",
    entryDate: "2024-01-16",
    status: "en_stock",
    image: "https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ003",
    name: "Téléphone IP Cisco",
    category: "Télécommunications",
    serialNumber: "CS2024003",
    brand: "Cisco",
    model: "7841",
    entryDate: "2024-01-17",
    status: "distribue",
    assignedTo: "Marie Dubois",
    assignedToId: "EMP002",
    assignedToEmail: "marie.dubois@company.com",
    assignedDepartment: "Comptabilité",
    assignedDepartmentId: "DEPT001",
    distributionDate: "2024-01-18",
    assignmentNotes: "Téléphone principal bureau comptabilité",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ004",
    name: "Projecteur Epson",
    category: "Audiovisuel",
    serialNumber: "EP2024004",
    brand: "Epson",
    model: "EB-X41",
    entryDate: "2024-01-18",
    status: "distribue",
    assignedTo: "Pierre Durand",
    assignedToId: "EMP005",
    assignedToEmail: "pierre.durand@company.com",
    assignedDepartment: "Informatique",
    assignedDepartmentId: "DEPT003",
    distributionDate: "2024-01-20",
    assignmentNotes: "Pour les présentations techniques",
    image: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ005",
    name: "Scanner Canon",
    category: "Bureautique",
    serialNumber: "CN2024005",
    brand: "Canon",
    model: "CanoScan LiDE 400",
    entryDate: "2024-01-19",
    status: "maintenance",
    image: "https://images.unsplash.com/photo-1588866692527-5ba7c2f2d786?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ006",
    name: "Laptop MacBook Pro",
    category: "Informatique",
    serialNumber: "MB2024006",
    brand: "Apple",
    model: "MacBook Pro 14\"",
    entryDate: "2024-01-21",
    status: "en_stock",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ007",
    name: "Écran Dell UltraSharp",
    category: "Informatique",
    serialNumber: "DL2024007",
    brand: "Dell",
    model: "U2722DE",
    entryDate: "2024-01-22",
    status: "en_stock",
    image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=80&h=80&fit=crop&crop=center"
  },
  {
    id: "EQ008",
    name: "Clavier Mécanique",
    category: "Périphériques",
    serialNumber: "LG2024008",
    brand: "Logitech",
    model: "MX Mechanical",
    entryDate: "2024-01-23",
    status: "distribue",
    assignedTo: "Marc Leroy",
    assignedToId: "EMP006",
    assignedToEmail: "marc.leroy@company.com",
    assignedDepartment: "Informatique",
    assignedDepartmentId: "DEPT003",
    distributionDate: "2024-01-24",
    assignmentNotes: "Clavier de développement",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=80&h=80&fit=crop&crop=center"
  }
]

const departments: Department[] = [
  { 
    id: "DEPT001", 
    name: "Comptabilité", 
    code: "COMPTA", 
    manager: "Jean Dupont", 
    managerId: "EMP001",
    location: "Bâtiment A - 1er étage",
    employeeCount: 2
  },
  { 
    id: "DEPT002", 
    name: "Ressources Humaines", 
    code: "RH", 
    manager: "Sophie Martin", 
    managerId: "EMP003",
    location: "Bâtiment A - 2ème étage",
    employeeCount: 2
  },
  { 
    id: "DEPT003", 
    name: "Informatique", 
    code: "IT", 
    manager: "Pierre Durand", 
    managerId: "EMP005",
    location: "Bâtiment B - Rez-de-chaussée",
    employeeCount: 2
  },
  { 
    id: "DEPT004", 
    name: "Marketing", 
    code: "MKT", 
    manager: "Julie Moreau", 
    managerId: "EMP007",
    location: "Bâtiment A - 3ème étage",
    employeeCount: 2
  },
  { 
    id: "DEPT005", 
    name: "Production", 
    code: "PROD", 
    manager: "Michel Bernard", 
    managerId: "EMP009",
    location: "Bâtiment C - Tous étages",
    employeeCount: 2
  }
]

export function Distribution() {
  const [equipment, setEquipment] = useState<EquipmentStock[]>(stockEquipments)
  const [filteredEquipment, setFilteredEquipment] = useState<EquipmentStock[]>(stockEquipments)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentStock | null>(null)
  const [distributionDialogOpen, setDistributionDialogOpen] = useState(false)
  const [isDistributing, setIsDistributing] = useState(false)
  const [viewingEquipment, setViewingEquipment] = useState<EquipmentStock | null>(null)

  // Filtrage et recherche
  useEffect(() => {
    let filtered = equipment

    if (searchTerm) {
      filtered = filtered.filter(eq => 
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.assignedTo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.assignedDepartment?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(eq => eq.status === statusFilter)
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(eq => eq.category === categoryFilter)
    }

    setFilteredEquipment(filtered)
  }, [equipment, searchTerm, statusFilter, categoryFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_stock':
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">En Stock</Badge>
      case 'distribue':
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">Distribué</Badge>
      case 'maintenance':
        return <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">Maintenance</Badge>
      default:
        return <Badge variant="outline">Inconnu</Badge>
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'informatique':
        return <Package className="h-4 w-4" />
      case 'bureautique':
        return <FileText className="h-4 w-4" />
      case 'télécommunications':
        return <Phone className="h-4 w-4" />
      case 'audiovisuel':
        return <Eye className="h-4 w-4" />
      case 'périphériques':
        return <User className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const handleDistribute = async (equipmentId: string, departmentId: string, employeeId: string, notes: string) => {
    setIsDistributing(true)
    
    try {
      // Simulation API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const department = departments.find(d => d.id === departmentId)
      const employee = employees.find(e => e.id === employeeId)
      
      setEquipment(prev => prev.map(eq => 
        eq.id === equipmentId 
          ? {
              ...eq,
              status: 'distribue' as const,
              assignedTo: employee?.name,
              assignedToId: employee?.id,
              assignedToEmail: employee?.email,
              assignedDepartment: department?.name,
              assignedDepartmentId: department?.id,
              distributionDate: new Date().toISOString().split('T')[0],
              assignmentNotes: notes
            }
          : eq
      ))
      
      toast.success("Équipement distribué avec succès", {
        description: `L'équipement a été assigné à ${employee?.name} (${department?.name})`
      })
      
      setDistributionDialogOpen(false)
      setSelectedEquipment(null)
    } catch (error) {
      toast.error("Erreur lors de la distribution", {
        description: "Une erreur s'est produite lors de la distribution de l'équipement"
      })
    } finally {
      setIsDistributing(false)
    }
  }

  const handleViewEquipment = (equipment: EquipmentStock) => {
    setViewingEquipment(equipment)
  }

  const getStockStats = () => {
    const total = equipment.length
    const enStock = equipment.filter(eq => eq.status === 'en_stock').length
    const distribue = equipment.filter(eq => eq.status === 'distribue').length
    const maintenance = equipment.filter(eq => eq.status === 'maintenance').length
    
    return { total, enStock, distribue, maintenance }
  }

  const stats = getStockStats()
  const categories = [...new Set(equipment.map(eq => eq.category))]

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 space-y-6 p-4 sm:p-6 overflow-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl">Distribution d'Équipements</h1>
          <p className="text-muted-foreground">
            Gérez la distribution des équipements vers les directions avec
            traçabilité complète
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventaire Stock
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Demandes de Distribution
            </TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Équipements</CardTitle>
                  <Package className="h-6 w-6 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    Inventaire complet
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">En Stock</CardTitle>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-green-600">{stats.enStock}</div>
                  <p className="text-xs text-muted-foreground">
                    Disponibles pour distribution
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Distribués</CardTitle>
                  <Truck className="h-6 w-6 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-blue-600">
                    {stats.distribue}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    En service actif
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Maintenance</CardTitle>
                  <AlertCircle className="h-6 w-6 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-orange-600">
                    {stats.maintenance}
                  </div>
                  <p className="text-xs text-muted-foreground">En réparation</p>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Filtres et Recherche
                  </CardTitle>
                  <div className="flex items-center border border-border rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`p-2 rounded transition-colors ${
                        viewMode === "table"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                      title="Vue tableau"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded transition-colors ${
                        viewMode === "grid"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                      title="Vue grille"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Rechercher par nom, série, marque, modèle, assigné..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les statuts</SelectItem>
                          <SelectItem value="en_stock">En stock</SelectItem>
                          <SelectItem value="distribue">Distribué</SelectItem>
                          <SelectItem value="maintenance">
                            Maintenance
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={categoryFilter}
                        onValueChange={setCategoryFilter}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes catégories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {filteredEquipment.length} équipement(s) affiché(s) sur{" "}
                      {equipment.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Filter className="h-3 w-3" />
                      Mode {viewMode === "table" ? "Tableau" : "Grille"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Equipment List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Inventaire des Équipements
                </CardTitle>
                <CardDescription>
                  Liste complète des équipements avec leurs statuts de
                  distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredEquipment.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun équipement trouvé</p>
                    <p className="text-sm">Ajustez vos critères de recherche</p>
                  </div>
                ) : viewMode === "table" ? (
                  /* Table View */
                  <div className="space-y-4">
                    {filteredEquipment.map((eq) => (
                      <div
                        key={eq.id}
                        className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 border rounded-lg gap-4 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <img
                            src={
                              eq.image ||
                              `https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center&sig=${eq.id}`
                            }
                            alt={eq.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <h3 className="text-base font-medium">
                                {eq.name}
                              </h3>
                              {getStatusBadge(eq.status)}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Série:</span>
                                <span className="font-mono text-xs">
                                  {eq.serialNumber}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Marque:</span>{" "}
                                {eq.brand}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Modèle:</span>{" "}
                                {eq.model}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  {new Date(eq.entryDate).toLocaleDateString(
                                    "fr-FR"
                                  )}
                                </span>
                              </div>
                            </div>
                            {eq.status === "distribue" &&
                              eq.assignedDepartment && (
                                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                                  <Building className="h-4 w-4" />
                                  <span className="font-medium">
                                    Assigné à:
                                  </span>
                                  <span>{eq.assignedTo}</span>
                                  <span className="text-muted-foreground">
                                    ({eq.assignedDepartment})
                                  </span>
                                  {eq.distributionDate && (
                                    <span className="text-muted-foreground">
                                      •{" "}
                                      {new Date(
                                        eq.distributionDate
                                      ).toLocaleDateString("fr-FR")}
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                          {eq.status === "en_stock" && (
                            <Button
                              onClick={() => {
                                setSelectedEquipment(eq);
                                setDistributionDialogOpen(true);
                              }}
                              className="flex-1 lg:flex-none"
                              size="sm"
                            >
                              <Truck className="h-4 w-4 mr-2" />
                              Distribuer
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="flex-1 lg:flex-none"
                            size="sm"
                            onClick={() => handleViewEquipment(eq)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Détails
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Grid View */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredEquipment.map((eq) => (
                      <Card
                        key={eq.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(eq.category)}
                              <span className="text-sm text-muted-foreground">
                                {eq.category}
                              </span>
                            </div>
                            {getStatusBadge(eq.status)}
                          </div>

                          <div className="flex items-center gap-3">
                            <img
                              src={
                                eq.image ||
                                `https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center&sig=${eq.id}`
                              }
                              alt={eq.name}
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">
                                {eq.name}
                              </h3>
                              <p className="text-xs text-muted-foreground font-mono">
                                {eq.serialNumber}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Marque:
                              </span>
                              <span className="font-medium">{eq.brand}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Modèle:
                              </span>
                              <span className="truncate ml-2">{eq.model}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Entrée:
                              </span>
                              <span>
                                {new Date(eq.entryDate).toLocaleDateString(
                                  "fr-FR"
                                )}
                              </span>
                            </div>
                          </div>

                          {eq.status === "distribue" &&
                            eq.assignedDepartment && (
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                                  <User className="h-3 w-3" />
                                  <span className="font-medium">
                                    Assigné à:
                                  </span>
                                </div>
                                <div className="text-xs">
                                  <div className="font-medium">
                                    {eq.assignedTo}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {eq.assignedDepartment}
                                  </div>
                                  {eq.distributionDate && (
                                    <div className="text-muted-foreground">
                                      {new Date(
                                        eq.distributionDate
                                      ).toLocaleDateString("fr-FR")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                          {eq.status === "maintenance" && (
                            <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-xs text-orange-600 dark:text-orange-400">
                              <Wrench className="h-3 w-3" />
                              <span>En cours de réparation</span>
                            </div>
                          )}

                          <div className="flex gap-2 pt-2 border-t border-border">
                            {eq.status === "en_stock" && (
                              <Button
                                onClick={() => {
                                  setSelectedEquipment(eq);
                                  setDistributionDialogOpen(true);
                                }}
                                className="flex-1"
                                size="sm"
                              >
                                <Truck className="h-3 w-3 mr-1" />
                                Distribuer
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              className={
                                eq.status === "en_stock" ? "px-3" : "flex-1"
                              }
                              size="sm"
                              onClick={() => handleViewEquipment(eq)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            <DistributionRequests />
          </TabsContent>
        </Tabs>

        {/* Distribution Dialog */}
        <Dialog
          open={distributionDialogOpen}
          onOpenChange={setDistributionDialogOpen}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Distribuer un Équipement</DialogTitle>
              <DialogDescription>
                Sélectionnez le direction de destination pour cet équipement
              </DialogDescription>
            </DialogHeader>

            {selectedEquipment && (
              <DistributionForm
                equipment={selectedEquipment}
                departments={departments}
                onDistribute={handleDistribute}
                isLoading={isDistributing}
                onCancel={() => {
                  setDistributionDialogOpen(false);
                  setSelectedEquipment(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Equipment Detail Modal */}
        {viewingEquipment && (
          <Dialog
            open={!!viewingEquipment}
            onOpenChange={() => setViewingEquipment(null)}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Détails de l'équipement</DialogTitle>
                <DialogDescription>
                  Informations complètes sur l'équipement sélectionné
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      viewingEquipment.image ||
                      `https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center&sig=${viewingEquipment.id}`
                    }
                    alt={viewingEquipment.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div>
                    <h3 className="font-medium">{viewingEquipment.name}</h3>
                    <p className="text-sm text-muted-foreground font-mono">
                      {viewingEquipment.serialNumber}
                    </p>
                    {getStatusBadge(viewingEquipment.status)}
                  </div>
                </div>
                <div className="grid gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Catégorie
                    </div>
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(viewingEquipment.category)}
                      <span>{viewingEquipment.category}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Marque et Modèle
                    </div>
                    <div>
                      {viewingEquipment.brand} {viewingEquipment.model}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Date d'entrée
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(
                          viewingEquipment.entryDate
                        ).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  {viewingEquipment.status === "distribue" && (
                    <>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Assigné à
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{viewingEquipment.assignedTo}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Direction
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <span>{viewingEquipment.assignedDepartment}</span>
                        </div>
                      </div>
                      {viewingEquipment.distributionDate && (
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Date de distribution
                          </div>
                          <div>
                            {new Date(
                              viewingEquipment.distributionDate
                            ).toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                      )}
                      {viewingEquipment.assignmentNotes && (
                        <div>
                          <div className="text-sm text-muted-foreground">
                            Notes d'attribution
                          </div>
                          <div className="text-sm bg-muted/20 p-2 rounded">
                            {viewingEquipment.assignmentNotes}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

// Composant formulaire de distribution
interface DistributionFormProps {
  equipment: EquipmentStock
  departments: Department[]
  onDistribute: (equipmentId: string, departmentId: string, employeeId: string, notes: string) => void
  isLoading: boolean
  onCancel: () => void
}

function DistributionForm({ equipment, departments, onDistribute, isLoading, onCancel }: DistributionFormProps) {
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [notes, setNotes] = useState("");

  // Filtrer les employés par Direction sélectionné
  const availableEmployees = selectedDepartment
    ? employees.filter(
        (emp) => emp.departmentId === selectedDepartment && emp.isActive
      )
    : [];

  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartment(departmentId);
    setSelectedEmployee(""); // Reset employee selection when department changes
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDepartment && selectedEmployee) {
      onDistribute(equipment.id, selectedDepartment, selectedEmployee, notes);
    }
  };

  const selectedEmployeeDetails = employees.find(
    (emp) => emp.id === selectedEmployee
  );
  const selectedDepartmentDetails = departments.find(
    (dept) => dept.id === selectedDepartment
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Equipment Info */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-center gap-3">
          <img
            src={
              equipment.image ||
              `https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center&sig=${equipment.id}`
            }
            alt={equipment.name}
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div>
            <h4 className="text-base font-medium">{equipment.name}</h4>
            <p className="text-sm text-muted-foreground font-mono">
              {equipment.serialNumber}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Marque:</span> {equipment.brand}
          </div>
          <div>
            <span className="font-medium">Modèle:</span> {equipment.model}
          </div>
        </div>
      </div>

      {/* Department Selection */}
      <div className="space-y-2">
        <Label htmlFor="department">Direction de destination</Label>
        <Select
          value={selectedDepartment}
          onValueChange={handleDepartmentChange}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un direction" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <Building className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {dept.name} ({dept.code})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 inline mr-1" />
                      {dept.location} • {dept.employeeCount} employé
                      {dept.employeeCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Employee Selection */}
      {selectedDepartment && (
        <div className="space-y-2">
          <Label htmlFor="employee">Employé destinataire</Label>
          <Select
            value={selectedEmployee}
            onValueChange={setSelectedEmployee}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un employé" />
            </SelectTrigger>
            <SelectContent>
              {availableEmployees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {employee.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{employee.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{employee.fonction}</span>
                        {employee.email && (
                          <>
                            <span>•</span>
                            <span>{employee.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {availableEmployees.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun employé disponible dans ce direction
            </p>
          )}
        </div>
      )}

      {/* Selected Assignment Summary */}
      {selectedEmployee &&
        selectedEmployeeDetails &&
        selectedDepartmentDetails && (
          <div className="p-4 border border-border rounded-lg bg-accent/5">
            <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Résumé de l'attribution
            </h5>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {selectedEmployeeDetails.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="font-medium">
                    {selectedEmployeeDetails.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedEmployeeDetails.fonction}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {selectedEmployeeDetails.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{selectedEmployeeDetails.email}</span>
                      </div>
                    )}
                    {selectedEmployeeDetails.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        <span>{selectedEmployeeDetails.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>{selectedDepartmentDetails.name}</span>
                <span>•</span>
                <MapPin className="h-3 w-3" />
                <span>{selectedDepartmentDetails.location}</span>
              </div>
            </div>
          </div>
        )}

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes d'attribution (optionnel)</Label>
        <Textarea
          id="notes"
          placeholder="Ajoutez des notes concernant cette attribution..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={!selectedDepartment || !selectedEmployee || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Distribution...
            </>
          ) : (
            <>
              <Truck className="h-4 w-4 mr-2" />
              Distribuer
            </>
          )}
        </Button>
      </div>
    </form>
  );
}