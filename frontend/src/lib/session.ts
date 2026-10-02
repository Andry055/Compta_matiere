import type { User } from "../App";
import { AppRole } from "../types/roles";
import type { StrapiAuthUser } from "./api";

// Rôles métier reconnus par l'application (rôle Strapi -> rôle applicatif)
export const KNOWN_APP_ROLES: AppRole[] = [
  "depositaire",
  "magasinier",
  "logistique",
  "comptable",
  "demandeur",
];

/**
 * Transforme un utilisateur Strapi (JWT) en profil applicatif, ou `null` si
 * son rôle n'est pas un rôle métier connu (l'interface ne doit alors surtout
 * pas deviner : un rôle deviné diverge du jeton, et le serveur refuse les
 * actions correspondantes — signature 403 sur « chef service 1 »).
 *
 * Utilisé à la CONNEXION (LoginScreen) et à la REPRISE de session (App), pour
 * que l'identité affichée découle toujours de la même source.
 */
export function mapStrapiUser(
  user: StrapiAuthUser | null | undefined
): User | null {
  if (!user) return null;
  const role = (user.role?.type || user.role?.code || "").toLowerCase();
  const isKnown =
    role === "admin" || (KNOWN_APP_ROLES as string[]).includes(role);
  if (!isKnown) return null;

  return {
    id: user.documentId || String(user.id),
    name: user.username,
    email: user.email,
    role: role as User["role"],
    department: user.department || "",
    permissions: ["equipment.view"],
    ...(role === "demandeur" ? { demandeurLevel: "service" as const } : {}),
  };
}
