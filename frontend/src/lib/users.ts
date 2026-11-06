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
  directionId?: number | null;
  directionName: string;
  serviceId?: number | null;
  serviceName: string;
  status: "Actif" | "Inactif" | "Suspendu";
  createdAt: string | null;
}

/** Charge utile de création/modification d'un compte (admin uniquement). */
export interface UserInput {
  username: string;
  email: string;
  password?: string;
  roleType: string;
  status: UserAccount["status"];
  directionId?: number | null;
  department?: string;
  fonction?: string;
  phone?: string;
}

export async function createUser(input: UserInput): Promise<void> {
  await api.post("/api/session/users", { data: input }, { timeout: 15000 });
}

export async function updateUser(
  id: number,
  input: Partial<UserInput>
): Promise<void> {
  await api.put(`/api/session/users/${id}`, { data: input }, { timeout: 15000 });
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/api/session/users/${id}`, { timeout: 15000 });
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
  direction?: { id?: number | null; name?: string | null } | null;
  service?: { id?: number | null; name?: string | null } | null;
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
      directionId: user.direction?.id ?? null,
      serviceId: user.service?.id ?? null,
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
