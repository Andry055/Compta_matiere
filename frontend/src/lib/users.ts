import { api } from "./api";

export interface UserAccount {
  id: number;
  username: string;
  email: string;
  roleType: string;
  roleName: string;
  department: string;
  fonction: string;
  phone: string;
  directionName: string;
  serviceName: string;
  status: "Actif" | "Inactif" | "Suspendu";
  createdAt: string | null;
}

interface ApiUser {
  id: number;
  username?: string | null;
  email?: string | null;
  role?: { name?: string | null; type?: string | null } | null;
  department?: string | null;
  fonction?: string | null;
  phone?: string | null;
  confirmed?: boolean;
  blocked?: boolean;
  createdAt?: string | null;
  direction?: { name?: string | null } | null;
  service?: { name?: string | null } | null;
}

export async function fetchUsers(): Promise<UserAccount[]> {
  const { data } = await api.get("/api/session/users", { timeout: 10000 });
  if (!Array.isArray(data?.data)) {
    throw new Error("La réponse du serveur pour la liste des utilisateurs est invalide.");
  }

  return (data.data as ApiUser[]).map((user) => {
    const departmentParts = (user.department || "")
      .split(" - ")
      .map((part) => part.trim())
      .filter(Boolean);
    const roleType = user.role?.type || "inconnu";

    return {
      id: user.id,
      username: user.username || "Utilisateur sans nom",
      email: user.email || "",
      roleType,
      roleName: user.role?.name || roleType,
      department: user.department || "",
      fonction: user.fonction || "",
      phone: user.phone || "",
      directionName:
        user.direction?.name || departmentParts[0] || "Non renseignée",
      serviceName:
        user.service?.name || departmentParts.slice(1).join(" - ") || "—",
      status: user.blocked
        ? "Suspendu"
        : user.confirmed
          ? "Actif"
          : "Inactif",
      createdAt: user.createdAt || null,
    };
  });
}
