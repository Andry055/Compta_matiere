import React, { useState } from "react";
import {
  Building,
  Users,
  UserPlus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  Loader2,
  Building2,
  Briefcase,
  ArrowRightLeft,
} from "lucide-react";
import { DirectionsStructure } from "./DirectionsStructure";
import { DirectionModal } from "./DirectionModal";
import { EmployeeModal } from "./EmployeeModal";
import { TransferEmployeeModal } from "./TransferEmployeeModal";

interface Employee {
  id: number;
  name: string;
  im: string;
  fonction: string;
  email: string;
  phone: string;
  CIN: string;
  status: "Actif" | "Inactif" | "Congé";
}

interface Service {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
  employees: Employee[];
  location: string;
}

interface Direction {
  id: number;
  name: string;
  director: string;
  directorEmail: string;
  description: string;
  services: Service[];
  location: string;
  isCurrentAdminDirection?: boolean;
}

const mockDirections: Direction[] = [
  {
    id: 1,
    name: "Direction Logistique",
    director: "Dr. RAZAFY Jean Pierre",
    directorEmail: "jp.razafy@ministere.gov.mg",
    description:
      "Direction en charge de la gestion des équipements et de la comptabilité matière",
    location: "Bâtiment Principal - 2ème étage",
    isCurrentAdminDirection: true,
    services: [
      {
        id: 101,
        name: "Service Comptabilité Matière",
        manager: "Mme RAKOTO Marie (Admin Système)",
        managerEmail: "m.rakoto@ministere.gov.mg",
        description: "Gestion des entrées, sorties et inventaires",
        location: "Bureau 201",
        employees: [
          {
            id: 1,
            name: "Marie RAKOTO",
            im: "MIN.001",
            fonction: "Responsable Comptabilité Matière (Admin)",
            email: "m.rakoto@ministere.gov.mg",
            phone: "+261 20 22 123 45",
            CIN: "101234567890",
            status: "Actif",
          },
          {
            id: 2,
            name: "Jean RAMAROSON",
            im: "MIN.002",
            fonction: "Gestionnaire Matériel",
            email: "j.ramaroson@ministere.gov.mg",
            phone: "+261 20 22 123 46",
            CIN: "101234567891",
            status: "Actif",
          },
          {
            id: 3,
            name: "Sophie RANDRIAMAMPIONONA",
            im: "MIN.003",
            fonction: "Agent Comptable",
            email: "s.randriamampionona@ministere.gov.mg",
            phone: "+261 20 22 123 47",
            CIN: "101234567892",
            status: "Actif",
          },
        ],
      },
      {
        id: 102,
        name: "Service Approvisionnement",
        manager: "M. ANDRY Paul",
        managerEmail: "p.andry@ministere.gov.mg",
        description: "Gestion des achats et approvisionnements",
        location: "Bureau 202",
        employees: [
          {
            id: 4,
            name: "Paul ANDRY",
            im: "MIN.004",
            fonction: "Chef Service Approvisionnement",
            email: "p.andry@ministere.gov.mg",
            phone: "+261 20 22 123 48",
            CIN: "101234567893",
            status: "Actif",
          },
          {
            id: 5,
            name: "Hery RATSIMBAZAFY",
            im: "MIN.005",
            fonction: "Agent Approvisionnement",
            email: "h.ratsimbazafy@ministere.gov.mg",
            phone: "+261 20 22 123 49",
            CIN: "101234567894",
            status: "Actif",
          },
        ],
      },
      {
        id: 103,
        name: "Service Maintenance",
        manager: "M. RABE Michel",
        managerEmail: "m.rabe@ministere.gov.mg",
        description: "Maintenance préventive et curative des équipements",
        location: "Bureau 203",
        employees: [
          {
            id: 6,
            name: "Michel RABE",
            im: "MIN.006",
            fonction: "Responsable Maintenance",
            email: "m.rabe@ministere.gov.mg",
            phone: "+261 20 22 123 50",
            CIN: "101234567895",
            status: "Actif",
          },
          {
            id: 7,
            name: "Lova RAKOTONIRINA",
            im: "MIN.007",
            fonction: "Technicien Maintenance",
            email: "l.rakotonirina@ministere.gov.mg",
            phone: "+261 20 22 123 51",
            CIN: "101234567896",
            status: "Actif",
          },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "Direction des Ressources Humaines",
    director: "Dr. RANAIVO Claudine",
    directorEmail: "c.ranaivo@ministere.gov.mg",
    description:
      "Direction en charge de la gestion du personnel et des carrières",
    location: "Bâtiment RH - 1er étage",
    services: [
      {
        id: 201,
        name: "Service Gestion Personnel",
        manager: "Mme RAZANADRA Voahangy",
        managerEmail: "v.razanadra@ministere.gov.mg",
        description: "Gestion administrative du personnel",
        location: "Bureau 101",
        employees: [
          {
            id: 8,
            name: "Voahangy RAZANADRA",
            im: "MIN.008",
            fonction: "Chef Service Personnel",
            email: "v.razanadra@ministere.gov.mg",
            phone: "+261 20 22 234 45",
            CIN: "201234567890",
            status: "Actif",
          },
          {
            id: 9,
            name: "Fidy RASOLOFONIAINA",
            im: "MIN.009",
            fonction: "Gestionnaire RH",
            email: "f.rasolofoniaina@ministere.gov.mg",
            phone: "+261 20 22 234 46",
            CIN: "201234567891",
            status: "Actif",
          },
        ],
      },
      {
        id: 202,
        name: "Service Formation",
        manager: "M. RAJAONARISON Hery",
        managerEmail: "h.rajaonarison@ministere.gov.mg",
        description: "Formation et développement des compétences",
        location: "Bureau 102",
        employees: [
          {
            id: 10,
            name: "Hery RAJAONARISON",
            im: "MIN.010",
            fonction: "Responsable Formation",
            email: "h.rajaonarison@ministere.gov.mg",
            phone: "+261 20 22 234 47",
            CIN: "201234567892",
            status: "Actif",
          },
        ],
      },
    ],
  },
  {
    id: 3,
    name: "Direction Informatique",
    director: "Ing. RAKOTOMANGA Andry",
    directorEmail: "a.rakotomanga@ministere.gov.mg",
    description:
      "Direction en charge des systèmes informatiques et technologies",
    location: "Bâtiment IT - Rez-de-chaussée",
    services: [
      {
        id: 301,
        name: "Service Développement",
        manager: "M. RAZAFINDRAKOTO Lala",
        managerEmail: "l.razafindrakoto@ministere.gov.mg",
        description: "Développement d'applications métier",
        location: "Bureau IT-01",
        employees: [
          {
            id: 11,
            name: "Lala RAZAFINDRAKOTO",
            im: "MIN.011",
            fonction: "Chef Service Développement",
            email: "l.razafindrakoto@ministere.gov.mg",
            phone: "+261 20 22 345 45",
            CIN: "301234567890",
            status: "Actif",
          },
          {
            id: 12,
            name: "Mino RANDRIANARISON",
            im: "MIN.012",
            fonction: "Développeur Senior",
            email: "m.randrianarison@ministere.gov.mg",
            phone: "+261 20 22 345 46",
            CIN: "301234567891",
            status: "Actif",
          },
        ],
      },
      {
        id: 302,
        name: "Service Infrastructure",
        manager: "M. RALISON Thierry",
        managerEmail: "t.ralison@ministere.gov.mg",
        description: "Gestion infrastructure réseau et serveurs",
        location: "Bureau IT-02",
        employees: [
          {
            id: 13,
            name: "Thierry RALISON",
            im: "MIN.013",
            fonction: "Administrateur Système",
            email: "t.ralison@ministere.gov.mg",
            phone: "+261 20 22 345 47",
            CIN: "301234567892",
            status: "Actif",
          },
        ],
      },
      {
        id: 303,
        name: "Service Support Utilisateur",
        manager: "Mme RAHARISOA Noro",
        managerEmail: "n.raharisoa@ministere.gov.mg",
        description: "Support technique aux utilisateurs",
        location: "Bureau IT-03",
        employees: [
          {
            id: 14,
            name: "Noro RAHARISOA",
            im: "MIN.014",
            fonction: "Responsable Support",
            email: "n.raharisoa@ministere.gov.mg",
            phone: "+261 20 22 345 48",
            CIN: "301234567893",
            status: "Actif",
          },
          {
            id: 15,
            name: "Ravo RAZANAMPARANY",
            im: "MIN.015",
            fonction: "Technicien Support",
            email: "r.razanamparany@ministere.gov.mg",
            phone: "+261 20 22 345 49",
            CIN: "301234567894",
            status: "Actif",
          },
        ],
      },
    ],
  },
  {
    id: 4,
    name: "Direction Financière",
    director: "Dr. RANDRIAMALALA Miangaly",
    directorEmail: "m.randriamalala@ministere.gov.mg",
    description: "Direction en charge de la gestion financière et budgétaire",
    location: "Bâtiment Finance - 3ème étage",
    services: [
      {
        id: 401,
        name: "Service Budget",
        manager: "M. RAZANATSEHENO Patrick",
        managerEmail: "p.razanatseheno@ministere.gov.mg",
        description: "Élaboration et suivi budgétaire",
        location: "Bureau F-301",
        employees: [
          {
            id: 16,
            name: "Patrick RAZANATSEHENO",
            im: "MIN.016",
            fonction: "Chef Service Budget",
            email: "p.razanatseheno@ministere.gov.mg",
            phone: "+261 20 22 456 45",
            CIN: "401234567890",
            status: "Actif",
          },
          {
            id: 17,
            name: "Fara RASOANAIVO",
            im: "MIN.017",
            fonction: "Analyste Budget",
            email: "f.rasoanaivo@ministere.gov.mg",
            phone: "+261 20 22 456 46",
            CIN: "401234567891",
            status: "Actif",
          },
        ],
      },
      {
        id: 402,
        name: "Service Comptabilité",
        manager: "Mme RAKOTONIRINA Aina",
        managerEmail: "a.rakotonirina@ministere.gov.mg",
        description: "Comptabilité générale et analytique",
        location: "Bureau F-302",
        employees: [
          {
            id: 18,
            name: "Aina RAKOTONIRINA",
            im: "MIN.018",
            fonction: "Chef Comptable",
            email: "a.rakotonirina@ministere.gov.mg",
            phone: "+261 20 22 456 47",
            CIN: "401234567892",
            status: "Actif",
          },
          {
            id: 19,
            name: "Hasina ANDRIANTSOA",
            im: "MIN.019",
            fonction: "Comptable Adjoint",
            email: "h.andriantsoa@ministere.gov.mg",
            phone: "+261 20 22 456 48",
            CIN: "401234567893",
            status: "Actif",
          },
        ],
      },
    ],
  },
];

export function Departments() {
  const [expandedDirection, setExpandedDirection] = useState<number | null>(
    null
  );
  const [expandedService, setExpandedService] = useState<number | null>(null);

  // Direction Modal States
  const [showDirectionModal, setShowDirectionModal] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(
    null
  );
  const [directionModalMode, setDirectionModalMode] = useState<
    "create" | "edit"
  >("create");
  const [isCreatingDirection, setIsCreatingDirection] = useState(false);

  // Employee Modal States
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [employeeModalMode, setEmployeeModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [currentServiceId, setCurrentServiceId] = useState<number | null>(null);

  // Transfer Modal States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferEmployee, setTransferEmployee] = useState<Employee | null>(
    null
  );
  const [transferCurrentService, setTransferCurrentService] =
    useState<Service | null>(null);
  const [transferCurrentDirection, setTransferCurrentDirection] =
    useState<Direction | null>(null);

  // Notification States
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showEmployeeSuccessMessage, setShowEmployeeSuccessMessage] =
    useState(false);
  const [showTransferSuccessMessage, setShowTransferSuccessMessage] =
    useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Loading States
  const [buttonClicked, setButtonClicked] = useState(false);
  const [addingEmployees, setAddingEmployees] = useState<{
    [key: number]: boolean;
  }>({});

  // Mock data state (in real app this would come from API)
  const [directions, setDirections] = useState(mockDirections);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Actif":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Inactif":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "Congé":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const totalEmployees = directions.reduce(
    (sum, direction) =>
      sum +
      direction.services.reduce(
        (serviceSum, service) => serviceSum + service.employees.length,
        0
      ),
    0
  );
  const totalServices = directions.reduce(
    (sum, direction) => sum + direction.services.length,
    0
  );
  const activeEmployees = directions.reduce(
    (sum, direction) =>
      sum +
      direction.services.reduce(
        (serviceSum, service) =>
          serviceSum +
          service.employees.filter((emp) => emp.status === "Actif").length,
        0
      ),
    0
  );

  // Direction handlers
  const handleCreateDirection = () => {
    setSelectedDirection(null);
    setDirectionModalMode("create");
    setShowDirectionModal(true);
  };

  const handleEditDirection = (direction: Direction) => {
    setSelectedDirection(direction);
    setDirectionModalMode("edit");
    setShowDirectionModal(true);
  };

  const handleSaveDirection = (directionData: Partial<Direction>) => {
    if (directionModalMode === "create") {
      const newDirection: Direction = {
        ...directionData,
        id: Date.now(),
        services: directionData.services || [],
      } as Direction;
      setDirections([...directions, newDirection]);
      showNotification("Direction créée avec succès!", "success");
    } else if (selectedDirection) {
      setDirections(
        directions.map((d) =>
          d.id === selectedDirection.id ? { ...d, ...directionData } : d
        )
      );
      showNotification("Direction modifiée avec succès!", "success");
    }
  };

  // Employee handlers
  const handleAddEmployee = (serviceId: number) => {
    setCurrentServiceId(serviceId);
    setSelectedEmployee(null);
    setEmployeeModalMode("create");
    setShowEmployeeModal(true);
  };

  const handleEditEmployee = (employee: Employee, serviceId: number) => {
    setCurrentServiceId(serviceId);
    setSelectedEmployee(employee);
    setEmployeeModalMode("edit");
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = (employeeData: Partial<Employee>) => {
    if (!currentServiceId) return;

    const updatedDirections = directions.map((direction) => ({
      ...direction,
      services: direction.services.map((service) => {
        if (service.id === currentServiceId) {
          if (employeeModalMode === "create") {
            const newEmployee: Employee = {
              ...employeeData,
              id: Date.now(),
            } as Employee;
            return {
              ...service,
              employees: [...service.employees, newEmployee],
            };
          } else if (selectedEmployee) {
            return {
              ...service,
              employees: service.employees.map((emp) =>
                emp.id === selectedEmployee.id
                  ? { ...emp, ...employeeData }
                  : emp
              ),
            };
          }
        }
        return service;
      }),
    }));

    setDirections(updatedDirections);
    showNotification(
      employeeModalMode === "create"
        ? "Employé ajouté avec succès!"
        : "Employé modifié avec succès!",
      "employee"
    );
  };

  // Transfer handlers
  const handleTransferEmployee = (employee: Employee) => {
    // Find current service and direction
    let currentService: Service | null = null;
    let currentDirection: Direction | null = null;

    for (const direction of directions) {
      for (const service of direction.services) {
        if (service.employees.some((emp) => emp.id === employee.id)) {
          currentService = service;
          currentDirection = direction;
          break;
        }
      }
      if (currentService) break;
    }

    if (currentService && currentDirection) {
      setTransferEmployee(employee);
      setTransferCurrentService(currentService);
      setTransferCurrentDirection(currentDirection);
      setShowTransferModal(true);
    }
  };

  const handleConfirmTransfer = (transferData: any) => {
    // Remove employee from current service
    let updatedDirections = directions.map((direction) => ({
      ...direction,
      services: direction.services.map((service) => {
        if (service.id === transferData.fromServiceId) {
          return {
            ...service,
            employees: service.employees.filter(
              (emp) => emp.id !== transferData.employeeId
            ),
          };
        }
        return service;
      }),
    }));

    // Add employee to new service with updated function
    updatedDirections = updatedDirections.map((direction) => ({
      ...direction,
      services: direction.services.map((service) => {
        if (service.id === transferData.toServiceId && transferEmployee) {
          const updatedEmployee = {
            ...transferEmployee,
            fonction: transferData.newFonction,
          };
          return {
            ...service,
            employees: [...service.employees, updatedEmployee],
          };
        }
        return service;
      }),
    }));

    setDirections(updatedDirections);
    showNotification("Transfert effectué avec succès!", "transfer");
  };

  // Utility functions
  const showNotification = (
    message: string,
    type: "success" | "employee" | "transfer"
  ) => {
    setSuccessMessage(message);
    if (type === "success") {
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 4000);
    } else if (type === "employee") {
      setShowEmployeeSuccessMessage(true);
      setTimeout(() => setShowEmployeeSuccessMessage(false), 4000);
    } else if (type === "transfer") {
      setShowTransferSuccessMessage(true);
      setTimeout(() => setShowTransferSuccessMessage(false), 4000);
    }
  };

  const getCurrentService = () => {
    if (!currentServiceId) return null;
    for (const direction of directions) {
      for (const service of direction.services) {
        if (service.id === currentServiceId) {
          return service;
        }
      }
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Success Notifications */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg shadow-xl text-green-800 dark:from-green-900/30 dark:to-green-800/30 dark:border-green-800 dark:text-green-400 animate-in slide-in-from-right-full duration-300">
          <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full dark:bg-green-900/50">
            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="font-semibold text-sm">{successMessage}</div>
            <div className="text-xs text-green-700 dark:text-green-300">
              L'opération a été effectuée avec succès.
            </div>
          </div>
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="ml-4 text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Employee Success Notification */}
      {showEmployeeSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg shadow-xl text-blue-800 dark:from-blue-900/30 dark:to-blue-800/30 dark:border-blue-800 dark:text-blue-400 animate-in slide-in-from-right-full duration-300">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full dark:bg-blue-900/50">
            <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="font-semibold text-sm">{successMessage}</div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              L'employé a été traité avec succès.
            </div>
          </div>
          <button
            onClick={() => setShowEmployeeSuccessMessage(false)}
            className="ml-4 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Transfer Success Notification */}
      {showTransferSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-lg shadow-xl text-purple-800 dark:from-purple-900/30 dark:to-purple-800/30 dark:border-purple-800 dark:text-purple-400 animate-in slide-in-from-right-full duration-300">
          <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full dark:bg-purple-900/50">
            <ArrowRightLeft className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="font-semibold text-sm">{successMessage}</div>
            <div className="text-xs text-purple-700 dark:text-purple-300">
              L'employé a été transféré vers son nouveau service.
            </div>
          </div>
          <button
            onClick={() => setShowTransferSuccessMessage(false)}
            className="ml-4 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Organigramme de l'Entreprise
          </h1>
          <p className="text-muted-foreground">
            Structure organisationnelle : Directions et Services
          </p>
          <div className="mt-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg inline-block">
            <span className="text-xs text-blue-700 dark:text-blue-300">
              📍 Vous êtes dans la Direction Logistique (Comptabilité Matière)
            </span>
          </div>
        </div>
        <button
          onClick={handleCreateDirection}
          className="group relative inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg shadow-lg shadow-primary/25 transition-all duration-300 transform-gpu overflow-hidden font-medium min-w-[200px] justify-center hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Building2 className="h-5 w-5 group-hover:rotate-12 transition-transform duration-300" />
          <span>Nouvelle Direction</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Directions</div>
              <div className="text-xl text-card-foreground">
                {directions.length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Briefcase className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Services
              </div>
              <div className="text-xl text-card-foreground">
                {totalServices}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Employés
              </div>
              <div className="text-xl text-card-foreground">
                {totalEmployees}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center text-xs">
              ✓
            </div>
            <div>
              <div className="text-sm text-muted-foreground">
                Employés Actifs
              </div>
              <div className="text-xl text-card-foreground">
                {activeEmployees}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Directions List */}
      <DirectionsStructure
        directions={directions}
        expandedDirection={expandedDirection}
        expandedService={expandedService}
        onDirectionToggle={(directionId) =>
          setExpandedDirection(
            expandedDirection === directionId ? null : directionId
          )
        }
        onServiceToggle={(serviceId) =>
          setExpandedService(expandedService === serviceId ? null : serviceId)
        }
        onAddEmployee={handleAddEmployee}
        onEditEmployee={handleEditEmployee}
        onTransferEmployee={handleTransferEmployee}
        onEditDirection={handleEditDirection}
        addingEmployees={addingEmployees}
        getStatusColor={getStatusColor}
      />

      {/* Modals */}
      <DirectionModal
        isOpen={showDirectionModal}
        onClose={() => setShowDirectionModal(false)}
        onSave={handleSaveDirection}
        direction={selectedDirection}
        mode={directionModalMode}
      />

      {currentServiceId && (
        <EmployeeModal
          isOpen={showEmployeeModal}
          onClose={() => setShowEmployeeModal(false)}
          onSave={handleSaveEmployee}
          employee={selectedEmployee}
          service={getCurrentService()!}
          mode={employeeModalMode}
        />
      )}

      {transferEmployee &&
        transferCurrentService &&
        transferCurrentDirection && (
          <TransferEmployeeModal
            isOpen={showTransferModal}
            onClose={() => setShowTransferModal(false)}
            onTransfer={handleConfirmTransfer}
            employee={transferEmployee}
            currentService={transferCurrentService}
            currentDirection={transferCurrentDirection}
            allDirections={directions}
          />
        )}
    </div>
  );
}
