import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Phone,
  Shield,
  User,
  X,
} from "lucide-react";
import { fetchOrganisation, type OrgDirection } from "../lib/api";
import {
  createUser,
  updateUser,
  type UserAccount,
  type UserInput,
} from "../lib/users";

/** Rôles applicatifs proposés à l'administrateur. */
const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "demandeur", label: "Demandeur" },
  { value: "magasinier", label: "Magasinier" },
  { value: "depositaire", label: "Dépositaire par service" },
  { value: "logistique", label: "Chef logistique" },
  { value: "comptable", label: "Comptable" },
  { value: "admin", label: "Administrateur" },
];

/** Aperçu (lecture seule) des droits associés au rôle choisi. */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "Gestion complète",
    "Approbation",
    "Rapports",
    "Utilisateurs",
    "Configuration système",
  ],
  depositaire: [
    "Réception matériel",
    "Décision des demandes",
    "Signatures de sortie",
    "Stock",
    "Rapports",
  ],
  magasinier: [
    "Réception matériel",
    "Contrôle physique",
    "Préparation des sorties",
    "Stock",
  ],
  logistique: [
    "Autorisation des sorties",
    "Signature logistique",
    "Rapports",
  ],
  comptable: ["Journal comptable", "Audit", "Rapports"],
  demandeur: ["Demandes", "Consultation", "Suivi de mes demandes"],
};

interface UserAccountModalProps {
  open: boolean;
  mode: "create" | "edit";
  user?: UserAccount | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  username: string;
  email: string;
  phone: string;
  password: string;
  roleType: string;
  status: UserAccount["status"];
  fonction: string;
  directionId: number;
  serviceId: number;
}

const EMPTY_FORM: FormState = {
  username: "",
  email: "",
  phone: "",
  password: "",
  roleType: "demandeur",
  status: "Actif",
  fonction: "",
  directionId: 0,
  serviceId: 0,
};

function messageErreur(e: unknown): string {
  const axiosErr = e as {
    response?: { data?: { error?: { message?: string } } };
  };
  return (
    axiosErr.response?.data?.error?.message ||
    (e instanceof Error ? e.message : "") ||
    "Enregistrement impossible."
  );
}

export function UserAccountModal({
  open,
  mode,
  user,
  onClose,
  onSaved,
}: UserAccountModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [directions, setDirections] = useState<OrgDirection[]>([]);
  const [chargementDirections, setChargementDirections] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErreur("");
    setShowPassword(false);
    setForm(
      mode === "edit" && user
        ? {
            username: user.username,
            email: user.email,
            phone: user.phone,
            password: "",
            roleType: user.roleType,
            status: user.status,
            fonction: user.fonction,
            directionId: 0,
            serviceId: 0,
          }
        : { ...EMPTY_FORM }
    );

    let actif = true;
    setChargementDirections(true);
    fetchOrganisation()
      .then((liste) => {
        if (actif) setDirections(liste);
      })
      .catch(() => {
        if (actif) {
          setDirections([]);
          setErreur(
            "Organigramme indisponible : les directions ne peuvent pas être choisies."
          );
        }
      })
      .finally(() => {
        if (actif) setChargementDirections(false);
      });
    return () => {
      actif = false;
    };
  }, [open, mode, user]);

  // Pré-remplit la direction/service à partir du compte édité, une fois
  // l'organigramme chargé (par identifiant si connu, sinon par libellé).
  useEffect(() => {
    if (!open || mode !== "edit" || !user || directions.length === 0) return;
    const direction = directions.find(
      (d) =>
        (user.directionId != null && d.id === user.directionId) ||
        d.name === user.directionName
    );
    if (!direction) return;
    const service = direction.services.find(
      (s) =>
        (user.serviceId != null && s.id === user.serviceId) ||
        s.name === user.serviceName
    );
    setForm((prev) => ({
      ...prev,
      directionId: direction.id,
      serviceId: service ? service.id : 0,
    }));
  }, [open, mode, user, directions]);

  const directionChoisie = useMemo(
    () => directions.find((d) => d.id === form.directionId) || null,
    [directions, form.directionId]
  );

  const changer = <K extends keyof FormState>(cle: K, valeur: FormState[K]) => {
    setForm((prev) => ({ ...prev, [cle]: valeur }));
  };

  const soumettre = async (event: FormEvent) => {
    event.preventDefault();
    setErreur("");

    const username = form.username.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const fonction = form.fonction.trim();
    const motDePasse = form.password;

    if (username.length < 3) {
      setErreur("Le nom d'utilisateur doit comporter au moins 3 caractères.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErreur("Adresse email invalide.");
      return;
    }
    if (mode === "create" && motDePasse.length < 6) {
      setErreur("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (mode === "edit" && motDePasse.length > 0 && motDePasse.length < 6) {
      setErreur("Le nouveau mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (!directionChoisie) {
      setErreur("Veuillez sélectionner une direction.");
      return;
    }

    const service = directionChoisie.services.find(
      (s) => s.id === form.serviceId
    );
    const department = service
      ? `${directionChoisie.name} - ${service.name}`
      : directionChoisie.name;

    const payload: UserInput = {
      username,
      email,
      phone,
      roleType: form.roleType,
      status: form.status,
      directionId: directionChoisie.id,
      department,
      fonction,
      ...(motDePasse ? { password: motDePasse } : {}),
    };

    setEnregistrement(true);
    try {
      if (mode === "create") {
        await createUser(payload);
      } else if (user) {
        await updateUser(user.id, payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnregistrement(false);
    }
  };

  if (!open) return null;

  const permissions = ROLE_PERMISSIONS[form.roleType] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card shadow-xl max-h-[90vh]">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-xl text-card-foreground">
            {mode === "create" ? "Nouvel Utilisateur" : "Modifier l'Utilisateur"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={soumettre} className="space-y-6 p-6">
          {erreur && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {erreur}
            </div>
          )}

          {/* Informations personnelles */}
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">
              Informations Personnelles
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Nom complet *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => changer("username", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring"
                    placeholder="Ex : Jean Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => changer("email", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring"
                    placeholder="Ex : jean.dupont@ministere.gov.mg"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => changer("phone", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring"
                    placeholder="Ex : +261 20 22 123 45"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Statut
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    changer("status", e.target.value as FormState["status"])
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:ring-2 focus:ring-ring"
                >
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="Suspendu">Suspendu</option>
                </select>
              </div>
            </div>
          </div>

          {/* Affectation organisationnelle */}
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">
              Affectation Organisationnelle
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="user-direction-select"
                  className="mb-2 block text-sm text-muted-foreground"
                >
                  Direction *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    id="user-direction-select"
                    value={form.directionId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        directionId: Number(e.target.value),
                        serviceId: 0,
                      }))
                    }
                    disabled={
                      chargementDirections || directions.length === 0
                    }
                    className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring disabled:opacity-50"
                  >
                    <option value={0}>
                      {chargementDirections
                        ? "Chargement des directions..."
                        : directions.length === 0
                          ? "Aucune direction disponible"
                          : "Sélectionner une direction..."}
                    </option>
                    {directions.map((direction) => (
                      <option key={direction.id} value={direction.id}>
                        {direction.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Service
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.serviceId}
                    onChange={(e) =>
                      changer("serviceId", Number(e.target.value))
                    }
                    disabled={!directionChoisie}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:border-transparent focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value={0}>Direction seule (sans service)</option>
                    {(directionChoisie?.services || []).map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-muted-foreground">
                  Fonction
                </label>
                <input
                  type="text"
                  value={form.fonction}
                  onChange={(e) => changer("fonction", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-ring"
                  placeholder="Ex : Chef de service"
                />
              </div>
            </div>
          </div>

          {/* Rôle et sécurité */}
          <div className="space-y-4">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">
              Rôle et Sécurité
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Rôle d'accès
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.roleType}
                    onChange={(e) => changer("roleType", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 focus:ring-2 focus:ring-ring"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  Mot de passe {mode === "create" && "*"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => changer("password", e.target.value)}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-12 focus:border-transparent focus:ring-2 focus:ring-ring"
                    placeholder={
                      mode === "edit"
                        ? "Laisser vide pour ne pas modifier"
                        : "Au moins 6 caractères"
                    }
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Permissions (aperçu) */}
          <div className="space-y-3">
            <h3 className="text-sm uppercase tracking-wider text-muted-foreground">
              Permissions
            </h3>
            <div className="flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <span
                  key={permission}
                  className="inline-flex items-center rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={enregistrement}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={enregistrement}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {enregistrement && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create"
                ? "Créer l'utilisateur"
                : "Modifier l'utilisateur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
