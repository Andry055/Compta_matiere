import { useState } from "react";
import {
  Users as UsersIcon,
  User,
  Plus,
  Edit,
  Trash2,
  Search,
  Shield,
  Key,
  Mail,
  Phone,
  Calendar,
  Building2,
  Briefcase,
} from "lucide-react";
import { UserModal } from "./UserModal";

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

export interface UserAccount {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: "Admin" | "Manager" | "Utilisateur" | "Lecture Seule";
  directionId: number;
  directionName: string;
  serviceId: number;
  serviceName: string;
  status: "Actif" | "Inactif" | "Suspendu";
  lastLogin?: string;
  createdDate?: string;
  permissions: string[];
  avatar?: string;
}

// Mock organizational structure
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
        employees: [],
      },
      {
        id: 102,
        name: "Service Approvisionnement",
        manager: "M. ANDRY Paul",
        managerEmail: "p.andry@ministere.gov.mg",
        description: "Gestion des achats et approvisionnements",
        location: "Bureau 202",
        employees: [],
      },
      {
        id: 103,
        name: "Service Maintenance",
        manager: "M. RABE Michel",
        managerEmail: "m.rabe@ministere.gov.mg",
        description: "Maintenance préventive et curative des équipements",
        location: "Bureau 203",
        employees: [],
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
        employees: [],
      },
      {
        id: 202,
        name: "Service Formation",
        manager: "M. RAJAONARISON Hery",
        managerEmail: "h.rajaonarison@ministere.gov.mg",
        description: "Formation et développement des compétences",
        location: "Bureau 102",
        employees: [],
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
        employees: [],
      },
      {
        id: 302,
        name: "Service Infrastructure",
        manager: "M. RALISON Thierry",
        managerEmail: "t.ralison@ministere.gov.mg",
        description: "Gestion infrastructure réseau et serveurs",
        location: "Bureau IT-02",
        employees: [],
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
        employees: [],
      },
      {
        id: 402,
        name: "Service Comptabilité",
        manager: "Mme RAKOTONIRINA Aina",
        managerEmail: "a.rakotonirina@ministere.gov.mg",
        description: "Comptabilité générale et analytique",
        location: "Bureau F-302",
        employees: [],
      },
    ],
  },
];

const mockUsers: UserAccount[] = [
  {
    id: 1,
    name: "Marie RAKOTO",
    email: "m.rakoto@ministere.gov.mg",
    phone: "+261 20 22 123 45",
    role: "Admin",
    directionId: 1,
    directionName: "Direction Logistique",
    serviceId: 101,
    serviceName: "Service Comptabilité Matière",
    status: "Actif",
    lastLogin: "2025-01-20 14:30",
    createdDate: "2022-01-15",
    permissions: [
      "Gestion complète",
      "Approbation",
      "Rapports",
      "Utilisateurs",
      "Configuration système",
    ],
  },
  {
    id: 2,
    name: "Jean RAMAROSON",
    email: "j.ramaroson@ministere.gov.mg",
    phone: "+261 20 22 123 46",
    role: "Manager",
    directionId: 1,
    directionName: "Direction Logistique",
    serviceId: 101,
    serviceName: "Service Comptabilité Matière",
    status: "Actif",
    lastLogin: "2025-01-20 09:15",
    createdDate: "2022-03-15",
    permissions: [
      "Gestion équipements",
      "Mouvements",
      "Rapports",
      "Validation demandes",
    ],
  },
  {
    id: 3,
    name: "Sophie RANDRIAMAMPIONONA",
    email: "s.randriamampionona@ministere.gov.mg",
    phone: "+261 20 22 123 47",
    role: "Utilisateur",
    directionId: 1,
    directionName: "Direction Logistique",
    serviceId: 101,
    serviceName: "Service Comptabilité Matière",
    status: "Actif",
    lastLogin: "2025-01-19 16:45",
    createdDate: "2023-01-10",
    permissions: ["Demandes", "Consultation", "Mouvements limités"],
  },
  {
    id: 4,
    name: "Voahangy RAZANADRA",
    email: "v.razanadra@ministere.gov.mg",
    phone: "+261 20 22 234 45",
    role: "Manager",
    directionId: 2,
    directionName: "Direction des Ressources Humaines",
    serviceId: 201,
    serviceName: "Service Gestion Personnel",
    status: "Actif",
    lastLogin: "2025-01-19 11:20",
    createdDate: "2023-06-20",
    permissions: [
      "Gestion équipements",
      "Mouvements",
      "Rapports",
      "Validation demandes",
    ],
  },
  {
    id: 5,
    name: "Lala RAZAFINDRAKOTO",
    email: "l.razafindrakoto@ministere.gov.mg",
    phone: "+261 20 22 345 45",
    role: "Manager",
    directionId: 3,
    directionName: "Direction Informatique",
    serviceId: 301,
    serviceName: "Service Développement",
    status: "Actif",
    lastLogin: "2025-01-15 08:30",
    createdDate: "2021-09-01",
    permissions: [
      "Gestion équipements",
      "Mouvements",
      "Rapports",
      "Validation demandes",
    ],
  },
  {
    id: 6,
    name: "Patrick RAZANATSEHENO",
    email: "p.razanatseheno@ministere.gov.mg",
    phone: "+261 20 22 456 45",
    role: "Lecture Seule",
    directionId: 4,
    directionName: "Direction Financière",
    serviceId: 401,
    serviceName: "Service Budget",
    status: "Actif",
    lastLogin: "2025-01-18 14:15",
    createdDate: "2023-02-15",
    permissions: ["Consultation"],
  },
];

export function Users() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("Tous");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [users, setUsers] = useState(mockUsers);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUserForDetail, setSelectedUserForDetail] =
    useState<UserAccount | null>(null);

  const handleCreateUser = () => {
    setSelectedUser(null);
    setModalMode("create");
    setShowUserModal(true);
  };

  const handleEditUser = (user: UserAccount) => {
    setSelectedUser(user);
    setModalMode("edit");
    setShowUserModal(true);
  };

  const handleSaveUser = (userData: UserAccount) => {
    if (modalMode === "create") {
      const newUser = {
        ...userData,
        id: Date.now(),
        lastLogin: "Jamais connecté",
        createdDate: new Date().toLocaleDateString("fr-FR"),
      };
      setUsers([...users, newUser]);
    } else {
      setUsers(users.map((u) => (u.id === userData.id ? userData : u)));
    }
    setShowUserModal(false);
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
      setUsers(users.filter((u) => u.id !== userId));
    }
  };

  const handleViewUserDetails = (user: UserAccount) => {
    setSelectedUserForDetail(user);
    setShowDetailModal(true);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.directionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.serviceName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "Tous" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "Tous" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Actif":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Inactif":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      case "Suspendu":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "Manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Utilisateur":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Lecture Seule":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "Actif").length;
  const adminUsers = users.filter((u) => u.role === "Admin").length;
  const recentLogins = users.filter((u) => {
    if (!u.lastLogin) return false;
    const lastLogin = new Date(u.lastLogin);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastLogin.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Gestion des Utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Administration des comptes utilisateurs et permissions
          </p>
        </div>
        <button
          onClick={handleCreateUser}
          className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-200 transform-gpu overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
          <span className="relative font-medium">Nouvel Utilisateur</span>
          <div className="absolute inset-0 border border-white/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Utilisateurs
              </div>
              <div className="text-xl text-card-foreground">{totalUsers}</div>
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
                Utilisateurs Actifs
              </div>
              <div className="text-xl text-card-foreground">{activeUsers}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Administrateurs
              </div>
              <div className="text-xl text-card-foreground">{adminUsers}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Connexions Aujourd'hui
              </div>
              <div className="text-xl text-card-foreground">{recentLogins}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom, email ou direction..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous les rôles</option>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Utilisateur">Utilisateur</option>
              <option value="Lecture Seule">Lecture Seule</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
              <option value="Suspendu">Suspendu</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Liste des Utilisateurs ({filteredUsers.length})
          </h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Utilisateur
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Contact
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Rôle
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Direction
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Dernière Connexion
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <div className="text-sm text-card-foreground">
                            {user.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {user.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-card-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getRoleColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-card-foreground">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {user.directionName}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          {user.serviceName}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                          user.status
                        )}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {user.lastLogin}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                          title="Modifier l'utilisateur"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-orange-600"
                          title="Réinitialiser le mot de passe"
                        >
                          <Key className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-red-600"
                          title="Supprimer l'utilisateur"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Modal */}
      <UserModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        onSave={handleSaveUser}
        user={selectedUser}
        mode={modalMode}
        directions={mockDirections}
      />

      {/* User Details Modal */}
      {selectedUserForDetail && showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg text-card-foreground">
                Détails de l'utilisateur
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Nom complet
                </div>
                <div className="text-card-foreground">
                  {selectedUserForDetail.name}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Email</div>
                <div className="text-card-foreground">
                  {selectedUserForDetail.email}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Téléphone
                </div>
                <div className="text-card-foreground">
                  {selectedUserForDetail.phone}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Rôle</div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getRoleColor(
                    selectedUserForDetail.role
                  )}`}
                >
                  {selectedUserForDetail.role}
                </span>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Direction
                </div>
                <div className="text-card-foreground">
                  {selectedUserForDetail.directionName}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Service
                </div>
                <div className="text-card-foreground">
                  {selectedUserForDetail.serviceName}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm text-muted-foreground mb-2">
                  Permissions
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUserForDetail.permissions.map(
                    (permission, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        {permission}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
