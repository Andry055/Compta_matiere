import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  Users as UsersIcon,
} from "lucide-react";
import {
  deleteUser,
  fetchUsers,
  updateUser,
  type UserAccount,
} from "../lib/users";
import { UserAccountModal } from "./UserAccountModal";
import type { User as AppUser } from "../App";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
}

function statusColor(status: UserAccount["status"]): string {
  switch (status) {
    case "Actif":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Inactif":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    case "Suspendu":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
}

function roleColor(roleType: string): string {
  switch (roleType) {
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "depositaire":
    case "logistique":
    case "magasinier":
    case "comptable":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "demandeur":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

export function Users({ user }: { user: AppUser }) {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("Tous");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);

  const messageErreurAction = (e: unknown): string => {
    const axiosErr = e as {
      response?: { data?: { error?: { message?: string } } };
    };
    return (
      axiosErr.response?.data?.error?.message ||
      (e instanceof Error ? e.message : "") ||
      "Action impossible."
    );
  };

  const estMonCompte = (compte: UserAccount) =>
    user.strapiId != null && user.strapiId === compte.id;

  const basculerSecurite = async (compte: UserAccount) => {
    const suspendre = compte.status !== "Suspendu";
    const question = suspendre
      ? `Suspendre le compte de ${compte.username} ? Il ne pourra plus se connecter tant qu'il n'est pas réactivé.`
      : `Réactiver le compte de ${compte.username} ?`;
    if (!window.confirm(question)) return;

    setActionEnCours(compte.id);
    try {
      await updateUser(compte.id, {
        status: suspendre ? "Suspendu" : "Actif",
      });
      await loadUsers();
    } catch (e) {
      window.alert(messageErreurAction(e));
    } finally {
      setActionEnCours(null);
    }
  };

  const supprimerCompte = async (compte: UserAccount) => {
    if (
      !window.confirm(
        `Supprimer définitivement le compte de ${compte.username} ? Cette action est irréversible.`
      )
    ) {
      return;
    }

    setActionEnCours(compte.id);
    try {
      await deleteUser(compte.id);
      await loadUsers();
    } catch (e) {
      window.alert(messageErreurAction(e));
    } finally {
      setActionEnCours(null);
    }
  };

  const ouvrirCreation = () => {
    setSelectedUser(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const ouvrirModification = (compte: UserAccount) => {
    setSelectedUser(compte);
    setModalMode("edit");
    setModalOpen(true);
  };

  const loadUsers = useCallback(async () => {
    if (user.role !== "admin") return;
    setIsLoading(true);
    setError(null);
    try {
      setUsers(await fetchUsers());
    } catch (loadError) {
      console.error("[utilisateurs] Impossible de charger les comptes :", loadError);
      setUsers([]);
      setError(
        "Impossible de charger les utilisateurs depuis le serveur. Vérifiez la connexion et vos droits administrateur."
      );
    } finally {
      setIsLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    if (user.role === "admin") void loadUsers();
  }, [loadUsers]);

  const roleOptions = Array.from(
    new Map(users.map((user) => [user.roleType, user.roleName])).entries()
  );

  if (user.role !== "admin") {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-lg border border-border bg-card p-6 text-sm text-card-foreground"
        >
          La consultation des utilisateurs est réservée au compte
          Administrateur. Déconnectez-vous puis connectez-vous avec un compte
          administrateur pour accéder à cette page.
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      user.username.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.directionName.toLowerCase().includes(term) ||
      user.serviceName.toLowerCase().includes(term);
    const matchesRole = roleFilter === "Tous" || user.roleType === roleFilter;
    const matchesStatus = statusFilter === "Tous" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Actif").length;
  const adminUsers = users.filter((user) => user.roleType === "admin").length;
  const suspendedUsers = users.filter((user) => user.status === "Suspendu").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Gestion des Utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Comptes enregistrés dans la base de données — création et
            modification réservées à l'administrateur
          </p>
        </div>
        <button
          type="button"
          onClick={ouvrirCreation}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-1.5 text-foreground hover:bg-muted sm:self-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <UsersIcon className="h-8 w-8 rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Total Utilisateurs</div>
              <div className="text-xl text-card-foreground">
                {isLoading ? "…" : totalUsers}
              </div>
            </div>
          </div>
        </div>
        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 rounded-lg bg-green-100 p-2 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">Comptes actifs</div>
              <div className="text-xl text-card-foreground">
                {isLoading ? "…" : activeUsers}
              </div>
            </div>
          </div>
        </div>
        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
            <div>
              <div className="text-sm text-muted-foreground">Administrateurs</div>
              <div className="text-xl text-card-foreground">
                {isLoading ? "…" : adminUsers}
              </div>
            </div>
          </div>
        </div>
        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">Comptes suspendus</div>
              <div className="text-xl text-card-foreground">
                {isLoading ? "…" : suspendedUsers}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="cm-panel cm-panel-solid rounded-lg p-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom, email ou direction..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2"
              aria-label="Filtrer par rôle"
            >
              <option value="Tous">Tous les rôles</option>
              {roleOptions.map(([type, name]) => (
                <option key={type} value={type}>{name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2"
              aria-label="Filtrer par statut"
            >
              <option value="Tous">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
              <option value="Suspendu">Suspendu</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cm-panel cm-panel-solid rounded-lg">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-lg text-card-foreground">
            Liste des Utilisateurs ({filteredUsers.length})
          </h2>
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm text-muted-foreground">Utilisateur</th>
                <th className="px-4 py-3 text-left text-sm text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-left text-sm text-muted-foreground">Rôle</th>
                <th className="px-4 py-3 text-left text-sm text-muted-foreground">Direction / Service</th>
                <th className="px-4 py-3 text-left text-sm text-muted-foreground">Statut</th>
                <th className="px-4 py-3 text-left text-sm text-muted-foreground">Créé le</th>
                <th className="px-4 py-3 text-right text-sm text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Chargement des comptes depuis la base…
                    </span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    {error ? "Liste indisponible." : "Aucun utilisateur trouvé."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div>
                          <div className="text-sm text-card-foreground">{user.username}</div>
                          <div className="text-xs text-muted-foreground">ID : {user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-card-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email || "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {user.phone || "—"}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${roleColor(user.roleType)}`}>
                        {user.roleName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-card-foreground">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {user.directionName}
                        </div>
                        <div className="mt-1 text-muted-foreground">{user.serviceName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs ${statusColor(user.status)}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-card-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => ouvrirModification(user)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Modifier cet utilisateur"
                          aria-label="Modifier cet utilisateur"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void basculerSecurite(user)}
                          disabled={
                            actionEnCours === user.id || estMonCompte(user)
                          }
                          className={`rounded p-1.5 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${
                            user.status === "Suspendu"
                              ? "hover:text-green-600"
                              : "hover:text-orange-600"
                          }`}
                          title={
                            estMonCompte(user)
                              ? "Action impossible sur votre propre compte"
                              : user.status === "Suspendu"
                                ? "Réactiver le compte"
                                : "Suspendre le compte"
                          }
                          aria-label={
                            user.status === "Suspendu"
                              ? "Réactiver le compte"
                              : "Suspendre le compte"
                          }
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void supprimerCompte(user)}
                          disabled={
                            actionEnCours === user.id || estMonCompte(user)
                          }
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          title={
                            estMonCompte(user)
                              ? "Action impossible sur votre propre compte"
                              : "Supprimer cet utilisateur"
                          }
                          aria-label="Supprimer cet utilisateur"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserAccountModal
        open={modalOpen}
        mode={modalMode}
        user={selectedUser}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadUsers()}
      />
    </div>
  );
}
