import axios from "axios";
import {
  EntreeRecord,
  SortieRecord,
  StatutEntree,
  StatutSortie,
  EntreeAdmin,
  EntreeLigne,
  ENTREE_ADMIN_VIDE,
  DocumentRef,
} from "./movements";

// URL du backend Strapi (définie dans .env : VITE_API_URL)
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:1337";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 8000,
});

/** URL AFFICHABLE d’un média renvoyé par Strapi (photos des lignes d’entrée,
 *  etc.). L’API renvoie des chemins RELATIFS (`/uploads/xxx.jpg`) ; rendus
 *  tels quels dans une page servie par le front (Vite : autre port, aucun
 *  proxy), le navigateur les demandait au FRONT, qui répondait par la
 *  SPA fallback (200 text/html) : les photos paraissaient perdues alors
 *  qu’elles étaient bien stockées. Les URL absolues, les Data URLs et les
 *  URL de signature sont laissées intactes. */
export function urlMediaAffichable(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

// ---------------------------------------------------------------------------
// Session Strapi (JWT) : connexion Content API
//
// Le jeton est stocké dans localStorage et envoyé automatiquement sur chaque
// requête : c'est lui qui permet au Demandeur de créer et de retrouver SES
// demandes persistées côté serveur.
// ---------------------------------------------------------------------------

const JWT_KEY = "strapi_jwt";
const AUTH_USER_KEY = "strapi_auth_user";

export interface StrapiRole {
  id?: number;
  type?: string;
  code?: string;
  name?: string;
}

export interface StrapiAuthUser {
  id: number;
  documentId?: string;
  username: string;
  email: string;
  department?: string | null;
  fonction?: string | null;
  role?: StrapiRole | null;
}

/**
 * Résultat distingué de strapiLogin : succès avec JWT, échec d'authentification,
 * ou erreur réseau. Permet à l'appelant de distinguer un refus serveur (403/401)
 * d'une panne réseau, afin de ne pas masquer un échec d'authentification par
 * un repli en mode démo.
 */
export interface StrapiLoginOk {
  ok: true;
  jwt: string;
  user: StrapiAuthUser;
}
export interface StrapiLoginAuthError {
  ok: false;
  code: 'auth_echec';
  status?: number;
}
export interface StrapiLoginNetworkError {
  ok: false;
  code: 'reseau';
}
export type StrapiLoginResult =
  | StrapiLoginOk
  | StrapiLoginAuthError
  | StrapiLoginNetworkError;

export function getStrapiJwt(): string | null {
  try {
    return localStorage.getItem(JWT_KEY);
  } catch {
    return null;
  }
}

/**
 * Rôle RÉEL de l'utilisateur connecté (GET /api/session/role).
 *
 * La réponse de `POST /api/auth/local` ne contient PAS la relation `role` :
 * le contrôleur `auth` du plugin users-permissions assainit l'utilisateur via
 * `strapi.contentAPI.sanitize.output`, qui retire toute relation vers
 * `plugin::users-permissions.user` (non lisible en Content API). Même constat
 * sur `GET /api/users/me`. Sans cette route, l'interface ne connaît pas le
 * rôle du compte authentifié et risque d'afficher une identité codée en dur
 * qui contredit le jeton (signature refusée en 403 par le serveur).
 *
 * Retourne `null` si l'API est injoignable ou le jeton refusé : l'appelant
 * décide alors de son repli.
 */
export async function fetchSessionRole(): Promise<StrapiAuthUser | null> {
  const jwt = getStrapiJwt();
  if (!jwt) return null;
  try {
    const { data } = await api.get("/api/session/role", { timeout: 5000 });
    const u = data?.data;
    if (!u || !u.role) return null;
    return {
      id: u.id,
      documentId: u.documentId,
      username: u.username,
      email: u.email,
      department: u.department ?? null,
      fonction: u.fonction ?? null,
      role: { id: u.role.id, type: u.role.type, name: u.role.name },
    };
  } catch {
    return null;
  }
}

export function setStrapiSession(jwt: string, user: StrapiAuthUser) {
  try {
    localStorage.setItem(JWT_KEY, jwt);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    /* mode privé : on ignore */
  }
}

export function clearStrapiSession() {
  try {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    /* ignore */
  }
}

export function getStrapiAuthUser(): StrapiAuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Session Strapi ABSENTE : la requête n'est pas envoyée.
 *
 * En mode DÉMONSTRATION local (LoginScreen, repli hors ligne) l'interface
 * n'a AUCUN jeton : interroger la Content API renvoyait alors 403 sur
 * `/api/sorties`, `/api/entrees` et `/api/entree-lignes` — un flot de 403
 * dans la console qui fait croire à une panne du serveur alors qu'il
 * répond parfaitement. La requête est désormais arrêtée ICI, avant le
 * réseau : aucun 403 n'est produit, et l'appelant bascule sur ses données
 * locales comme prévu.
 *
 * Seule la CONNEXION (`POST /api/auth/local`) est autorisée sans jeton.
 */
export class ErreurSessionAbsente extends Error {
  readonly code = "session_absente";
  constructor(message = "Session Strapi absente : requête non envoyée") {
    super(message);
    this.name = "ErreurSessionAbsente";
  }
}

/** Requêtes autorisées SANS jeton (la connexion, forcément). */
const REQUETES_SANS_JETON = ["/api/auth/local"];

// Envoi automatique du jeton sur chaque requête Content API.
// Les requêtes sans jeton (ex: /api/auth/local) n'en reçoivent JAMAIS :
// Strapi rejette une demande de connexion déjà porteuse d'un jeton (403).
// SANS jeton sur les autres routes, la requête ne PART PAS (ErreurSessionAbsente) : pas de 403.
api.interceptors.request.use((config) => {
  const url = config.url ?? "";
  if (REQUETES_SANS_JETON.some((prefixe) => url.startsWith(prefixe))) {
    return config;
  }
  const jwt = getStrapiJwt();
  if (jwt) {
    config.headers.set("Authorization", `Bearer ${jwt}`);
    return config;
  }
  throw new ErreurSessionAbsente();
  // NEUTRALISATION TEMPORAIRE (preuve RED) : return config;
});

/**
 * Connexion à l'API Strapi (POST /api/auth/local).
 * Retourne un résultat distingué : succès avec JWT, échec d'authentification
 * (403/401), ou erreur réseau. L'appelant peut ainsi distinguer un refus
 * serveur d'une panne réseau, et éviter de masquer un échec d'authentification
 * par un repli en mode démo.
 */
export async function strapiLogin(
  identifier: string,
  password: string
): Promise<StrapiLoginResult> {
  try {
    const { data } = await api.post(
      "/api/auth/local",
      { identifier, password },
      { timeout: 5000 }
    );
    if (data && data.jwt && data.user) {
      setStrapiSession(data.jwt, data.user);
      return { ok: true, jwt: data.jwt, user: data.user };
    }
    // Réponse HTTP 2xx mais absence de jeton : échec d'authentification.
    return { ok: false, code: 'auth_echec' };
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        return { ok: false, code: 'auth_echec', status: err.response.status };
      }
    }
    // Erreur réseau ou serveur injoignable : l'authentification n'a pas pu être évaluée.
    return { ok: false, code: 'reseau' };
  }
}

// ---------------------------------------------------------------------------
// Entrées / Sorties : lecture de l'API avec repli sur les données locales
// ---------------------------------------------------------------------------

const STATUTS_ENTREE_API: Record<string, StatutEntree> = {
  brouillon: "Brouillon",
  en_attente: "En attente",
  verifiee: "Vérifiée",
  validee: "Validée",
  rejetee: "Rejetée",
};

const STATUTS_SORTIE_API: Record<string, StatutSortie> = {
  demandee: "Demandée",
  en_preparation: "En préparation",
  validee: "Validée",
  sortie_effectuee: "Sortie effectuée",
  annulee: "Annulée",
};

interface StrapiEntity {
  id: number;
  documentId?: string;
  reference?: string | null;
  date_entree?: string | null;
  date_sortie?: string | null;
  numero_facture?: string | null;
  statut?: string | null;
  /** Circuit à 3 signatures d'une sortie. */
  magasinier_signed?: boolean | null;
  depositaire_signed?: boolean | null;
  logistique_signed?: boolean | null;
  signataire_magasinier?: string | null;
  signataire_depositaire?: string | null;
  signataire_logistique?: string | null;
  date_signature_magasinier?: string | null;
  date_signature_depositaire?: string | null;
  date_signature_logistique?: string | null;
  stock_impacte?: boolean | null;
  date_remise?: string | null;
  detenteur_nom?: string | null;
  detenteur_fonction?: string | null;
  /** Mandataire mandaté par le détenteur pour retirer le matériel (optionnel). */
  mandataire_nom?: string | null;
  responsable?: string | null;
  beneficiaire?: string | null;
  justificatif?: string | null;
  notes?: string | null;
  observations?: string | null;
  fournisseur?: { nom?: string | null } | null;
  direction?: { documentId?: string | null; nom_direction?: string | null } | null;
  service?: { nom_service?: string | null } | null;
  demande?: {
    id?: number;
    demandeur?: { nom?: string | null; prenom?: string | null } | null;
  } | null;
  lignes?: Array<{
    id: number;
    documentId?: string | null;
    numero_ordre?: number | null;
    reference?: string | null;
    designation?: string | null;
    espece?: string | null;
    unite?: string | null;
    quantite?: number | null;
    valeur_unitaire?: number | null;
    montant?: number | null;
    nomenclature?: string | null;
    piece_justificative?: string | null;
    observations?: string | null;
    /** État constaté par le magasinier (signature 1). */
    etat?: string | null;
    /** N° logistique saisi à la signature 3 (texte tel que saisi). */
    numero_logistique?: string | null;
    /** Champ media `photos` de entree-ligne, peuplé seulement si le client
     *  demande `populate[...][photos]` (ou `*`). */
    photos?: Array<{ url?: string | null; documentId?: string | null }> | null;
    materiel?: {
      /** documentId de la fiche rattachée à la ligne (relation posée à la
       *  saisie après confirmation du rapprochement). */
      documentId?: string | null;
      designation?: string | null;
      /** Nomenclature de la fiche matériel (champ scalaire de la relation). */
      nomenclature?: string | null;
      /** Stock courant de la fiche — affiché au magasinier avant signature. */
      quantiteStock?: number | null;
      /** Stock courant en snake_case (réponse REST Strapi standard). */
      quantite_stock?: number | null;
      categorie?: { nom?: string | null } | null;
    } | null;
  }> | null;
}

/** Champs administratifs + signatures d'une entrée Strapi */
interface StrapiEntreeChamps {
  total?: number | null;
  numero_chapitre?: string | null;
  libelle_chapitre?: string | null;
  subdivision_chapitre?: string | null;
  numero_ordre_journal?: string | null;
  budget_general?: string | null;
  soa?: string | null;
  type_operation?: string | null;
  adresse_fournisseur?: string | null;
  date_facture?: string | null;
  bon_livraison?: string | null;
  date_bon_livraison?: string | null;
  motif_entree?: string | null;
  observations?: string | null;
  reference_marche?: string | null;
  piece_justificative?: string | null;
  declaration_nom?: string | null;
  declaration_fonction?: string | null;
  declaration_date?: string | null;
  depositaire_signed?: boolean;
  chef_service_1_signed?: boolean;
  chef_service_2_signed?: boolean;
  date_signature_depositaire?: string | null;
  date_signature_chef_service_1?: string | null;
  date_signature_chef_service_2?: string | null;
  signataire_depositaire?: string | null;
  signataire_chef_service_1?: string | null;
  signataire_chef_service_2?: string | null;
  affectation_depositaire?: string | null;
  affectation_chef_service_1?: string | null;
  affectation_chef_service_2?: string | null;
  qr_token?: string | null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapEntree(row: StrapiEntity & StrapiEntreeChamps): EntreeRecord {
  const lignes = row.lignes ?? [];
  const materiels = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.designation || ligne.designation)
        .filter((value): value is string => !!value)
    )
  );
  const categories = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.categorie?.nom)
        .filter((value): value is string => !!value)
    )
  );

  const admin: EntreeAdmin = {
    ...ENTREE_ADMIN_VIDE,
    numeroChapitre: row.numero_chapitre || "",
    libelleChapitre: row.libelle_chapitre || "",
    subdivisionChapitre: row.subdivision_chapitre || "",
    numeroOrdreJournal: row.numero_ordre_journal || "",
    budgetGeneral: row.budget_general || "",
    soa: row.soa || "",
    typeOperation: (row.type_operation as EntreeAdmin["typeOperation"]) || "",
    adresseFournisseur: row.adresse_fournisseur || "",
    dateFacture: row.date_facture || "",
    bonLivraison: row.bon_livraison || "",
    dateBonLivraison: row.date_bon_livraison || "",
    motifEntree: row.motif_entree || "",
    observations: row.observations || row.notes || "",
    referenceMarche: row.reference_marche || "",
    pieceJustificative: row.piece_justificative || "",
    declarationNom: row.declaration_nom || "",
    declarationFonction: row.declaration_fonction || "",
    declarationDate: row.declaration_date || "",
  };

  const documents: DocumentRef[] = [];
  if (row.numero_facture)
    documents.push({ nom: row.numero_facture, type: "Facture / pièce justificative" });
  if (row.bon_livraison)
    documents.push({ nom: row.bon_livraison, type: "Bon de livraison" });
  if (row.reference_marche)
    documents.push({ nom: row.reference_marche, type: "Marché / convention" });
  if (row.piece_justificative)
    documents.push({ nom: row.piece_justificative, type: "Pièce justificative" });

  const lignesMappees: EntreeLigne[] = lignes.map((l, i) => ({
    numeroOrdre: l.numero_ordre ?? i + 1,
    // Cible des photos + pièces déjà persistées : sans le documentId, le
    // client ne peut pas rattacher une photo à SA ligne via /api/upload.
    documentId: l.documentId || String(l.id),
    // `refId` de POST /api/upload = id NUMÉRIQUE de la ligne (cf. EntreeLigne.id).
    id: Number(l.id) || undefined,
    // URL normalisée (absolue) : le chemin relatif renvoyé par Strapi ne
    // s’affiche pas depuis l’application servie par un autre port que l’API.
    photos: (l.photos ?? [])
      .map((p) => urlMediaAffichable(p?.url))
      .filter((u): u is string => !!u),
    reference: l.reference || "",
    designation: l.designation || l.materiel?.designation || "—",
    espece: l.espece || l.materiel?.categorie?.nom || "—",
    unite: l.unite || "unité",
    quantite: Number(l.quantite) || 0,
    prixUnitaire: Number(l.valeur_unitaire) || 0,
    montant: Number(l.montant) || 0,
    nomenclature: l.nomenclature || "",
    pieceJustificative: l.piece_justificative || "",
    observation: l.observations || "",
    // Étape 2 du flux « Arrivée matériel » : contrôle magasinier persisté.
    etat: (l.etat as EntreeLigne["etat"]) ?? null,
    conforme: l.conforme ?? null,
    // Fiche matériel rattachée à la ligne : reprise du lien après rechargement
    // (l'écran ne re-propose pas un rapprochement déjà tranché).
    materielId: l.materiel?.documentId || undefined,
    materielDesignation: l.materiel?.designation || undefined,
  }));

  return {
    id: row.documentId || String(row.id),
    reference: row.reference || `ENT-${row.id}`,
    dateEntree: row.date_entree || today(),
    materiel: materiels.join(", ") || row.notes || "—",
    categorie: categories.join(", ") || "—",
    quantite: lignes.reduce(
      (sum, ligne) => sum + (Number(ligne.quantite) || 0),
      0
    ),
    fournisseur: row.fournisseur?.nom || "—",
    numeroFacture: row.numero_facture || "—",
    direction: row.direction?.nom_direction || "—",
    service: row.service?.nom_service || "—",
    statut: STATUTS_ENTREE_API[row.statut || ""] || "En attente",
    responsable: row.responsable || "—",
    documents,
    signatures: {
      depositaire: row.depositaire_signed ? row.date_signature_depositaire || today() : undefined,
      chefService1: row.chef_service_1_signed
        ? row.date_signature_chef_service_1 || today()
        : undefined,
      chefService2: row.chef_service_2_signed
        ? row.date_signature_chef_service_2 || today()
        : undefined,
    },
    signataires: {
      depositaire: row.signataire_depositaire || undefined,
      chefService1: row.signataire_chef_service_1 || undefined,
      chefService2: row.signataire_chef_service_2 || undefined,
    },
    affectations: {
      depositaire: row.affectation_depositaire || undefined,
      chefService1: row.affectation_chef_service_1 || undefined,
      chefService2: row.affectation_chef_service_2 || undefined,
    },
    qrToken: row.qr_token || undefined,
    total: row.total ?? undefined,
    admin,
    lignes: lignesMappees,
    statutServeur: row.statut || undefined,
    rejetee: row.statut === "rejetee",
  };
}

function mapSortie(row: StrapiEntity): SortieRecord {
  const lignes = row.lignes ?? [];
  const materiels = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.designation)
        .filter((value): value is string => !!value)
    )
  );
  const categories = Array.from(
    new Set(
      lignes
        .map((ligne) => ligne.materiel?.categorie?.nom)
        .filter((value): value is string => !!value)
    )
  );
  const demandeur = row.demande?.demandeur
    ? [row.demande.demandeur.prenom, row.demande.demandeur.nom]
        .filter(Boolean)
        .join(" ")
    : undefined;

  return {
    id: row.documentId || String(row.id),
    reference: row.reference || "—",
    dateSortie: row.date_sortie || today(),
    materiel: materiels.join(", ") || row.observations || "—",
    categorie: categories.join(", ") || "—",
    quantite: lignes.reduce(
      (sum, ligne) => sum + (Number(ligne.quantite) || 0),
      0
    ),
    serviceDemandeur: row.service?.nom_service || "—",
    direction: row.direction?.nom_direction || "—",
    directionId: row.direction?.documentId || undefined,
    demandeId: row.demande?.id,
    demandeur,
    beneficiaire: row.beneficiaire || "—",
    responsable: row.responsable || "—",
    statut: STATUTS_SORTIE_API[row.statut || ""] || "Demandée",
    // Circuit à 3 signatures : ces drapeaux n'étaient jamais mappés, la carte
    // affichait donc toujours « ○ » (jamais de ✓) quel que soit l'état réel.
    magasinier_signed: row.magasinier_signed === true,
    depositaire_signed: row.depositaire_signed === true,
    logistique_signed: row.logistique_signed === true,
    // Signataires et dates posés SEULS par le serveur (affichage du panneau
    // d'autorisation et de l'onglet « Autorisées »).
    signataireMagasinier: row.signataire_magasinier || undefined,
    signataireDepositaire: row.signataire_depositaire || undefined,
    signataireLogistique: row.signataire_logistique || undefined,
    dateSignatureMagasinier: row.date_signature_magasinier || undefined,
    dateSignatureDepositaire: row.date_signature_depositaire || undefined,
    dateSignatureLogistique: row.date_signature_logistique || undefined,
    dateRemise: row.date_remise || undefined,
    detenteurNom: row.detenteur_nom || undefined,
    detenteurFonction: row.detenteur_fonction || undefined,
    mandataireNom: row.mandataire_nom || undefined,
    stockImpacte: row.stock_impacte === true,
    justificatif: row.justificatif || "—",
    documents: row.justificatif
      ? [{ nom: row.justificatif, type: "Justificatif de sortie" }]
      : [],
    // Lignes peuplées (fetchAllSortiesOrThrow) — nécessaires au panneau de
    // vérification du magasinier (désignation, quantité demandée, stock).
    // Les relevés légers ne peuplent pas : champ laissé absent.
    ...(lignes.length > 0
      ? {
          lignes: lignes.map((ligne) => ({
            documentId: ligne.documentId || String(ligne.id),
            designation:
              ligne.designation ||
              ligne.materiel?.designation ||
              `Ligne ${ligne.numero_ordre ?? ligne.id}`,
            quantite: Number(ligne.quantite) || 0,
            // Relevés de la signature 1 et valorisation (lecture seule).
            etat: ligne.etat ?? null,
            observations: ligne.observations ?? null,
            valeurUnitaire:
              ligne.valeur_unitaire != null
                ? Number(ligne.valeur_unitaire) || 0
                : undefined,
            montant:
              ligne.montant != null ? Number(ligne.montant) || 0 : undefined,
            numeroLogistique: ligne.numero_logistique ?? null,
            ...(ligne.materiel?.documentId || ligne.materiel?.designation
              ? {
                  materiel: {
                    documentId: ligne.materiel?.documentId || undefined,
                    designation: ligne.materiel?.designation || undefined,
                    // Strapi renvoie quantite_stock (snake_case) ; quantiteStock
                    // est conservé pour les réponses déjà camelCase.
                    quantiteStock:
                      (ligne.materiel as any)?.quantite_stock ??
                      ligne.materiel?.quantiteStock ??
                      undefined,
                    // Nomenclature de la fiche matériel (champ scalaire de la
                    // relation) : affichée dans le bon de sortie si elle existe.
                    nomenclature: ligne.materiel?.nomenclature ?? null,
                  },
                }
              : {}),
          })),
        }
      : {}),
  };
}

/** Nature de l'échec d'un appel authentifié. Distinguer les cas évite d'afficher
 *  un « serveur injoignable » faux : sur /api/entrees, une absence de jeton
 *  renvoie 403 (et non 401), exactement comme un rôle non habilité — seul un
 *  diagnostic explicite permet de dire lequel des deux est en cause. */
export type EchecApi =
  /** Backend arrêté, injoignable ou délai dépassé. */
  | "reseau"
  /** Aucun jeton Strapi dans le navigateur (connexion de secours hors ligne :
   *  le compte de démonstration local n'existe pas côté serveur). */
  | "session_absente"
  /** 401 : jeton invalide ou expiré → il faut se reconnecter. */
  | "session_expiree"
  /** 403 : jeton présent mais rôle sans la permission demandée. */
  | "acces_refuse";

/** Traduit une erreur axios en cause exploitable par l'appelant. */
export function classerEchecApi(err: unknown): EchecApi {
  // Requête arrêtée AVANT le réseau faute de jeton (intercepteur de
  // requête) : c'est une session absente, pas une panne ni un refus d'accès.
  if (err instanceof ErreurSessionAbsente) return "session_absente";
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) return "session_expiree";
    if (err.response?.status === 403) return "acces_refuse";
  }
  return "reseau";
}

/**
 * Charge les entrées depuis Strapi (/api/entrees) en distinguant les causes
 * d'échec. Les appelants qui ne discriminent pas utilisent `fetchEntrees`.
 */
export async function fetchEntreesDetail(): Promise<
  { ok: true; entrees: EntreeRecord[] } | { ok: false; echec: EchecApi }
> {
  try {
    const { data } = await api.get("/api/entrees", {
      timeout: 5000,
      params: {
        sort: "date_entree:desc",
        "pagination[pageSize]": 100,
        populate: {
          fournisseur: true,
          direction: true,
          service: true,
          lignes: {
            // `photos` : champ media des lignes — sans lui, les pièces jointes
            // par le magasinier disparaissent de l'écran après rechargement.
            populate: {
              materiel: { populate: ["categorie"] },
              photos: true,
            },
          },
        },
      },
    });

    const rows: StrapiEntity[] = data?.data ?? [];
    return { ok: true, entrees: rows.map(mapEntree) };
  } catch (e) {
    // 403 sans jeton : le serveur n'a reçu aucun credential — c'est la session
    // qui manque, pas un droit manquant. Jeton présent + 403 = rôle non
    // habilité (le demandeur, par exemple, ne lit pas les entrées).
    if (!getStrapiJwt() && classerEchecApi(e) === "acces_refuse") {
      return { ok: false, echec: "session_absente" };
    }
    return { ok: false, echec: classerEchecApi(e) };
  }
}

/**
 * Charge les entrées depuis Strapi (/api/entrees).
 * Retourne `null` si le backend est injoignable ou en erreur, et `[]` s'il
 * répond sans donnée : l'appelant retombe alors sur les données locales.
 */
export async function fetchEntrees(): Promise<EntreeRecord[] | null> {
  const resultat = await fetchEntreesDetail();
  return resultat.ok ? resultat.entrees : null;
}

// ---------------------------------------------------------------------------
// Entrées : création, signature, rejet (validation à 3 signatures)
// ---------------------------------------------------------------------------

export interface NouvelleEntreePayload {
  reference?: string;
  date_entree: string;
  numero_facture?: string;
  fournisseur_id?: string;
  direction_id?: string;
  service_id?: string;
  responsable?: string;
  notes?: string;
  /** true = enregistrement partiel (statut « Brouillon ») */
  brouillon?: boolean;
  /** false = le serveur dérive affectation_depositaire depuis l'utilisateur
   *  connecté et ne réclame pas les 3 affectations (flux « Arrivée matériel »).
   *  Absent/true = validation stricte des 3 affectations (flux historique). */
  exigerAffectations?: boolean;
  affectation_depositaire?: string;
  affectation_chef_service_1?: string;
  affectation_chef_service_2?: string;
  lignes: Array<{
    numero_ordre?: number;
    designation: string;
    reference?: string;
    espece?: string;
    unite?: string;
    quantite: number;
    valeur_unitaire: number;
    nomenclature?: string;
    piece_justificative?: string;
    observations?: string;
    materiel_id?: string;
  }>;
  numero_chapitre?: string;
  libelle_chapitre?: string;
  subdivision_chapitre?: string;
  numero_ordre_journal?: string;
  budget_general?: string;
  soa?: string;
  type_operation?: string;
  adresse_fournisseur?: string;
  date_facture?: string;
  bon_livraison?: string;
  date_bon_livraison?: string;
  motif_entree?: string;
  observations?: string;
  reference_marche?: string;
  piece_justificative?: string;
  declaration_nom?: string;
  declaration_fonction?: string;
  declaration_date?: string;
}


/** Création complète d'une entrée (entête administrative + lignes). */
export async function creerEntree(payload: NouvelleEntreePayload): Promise<EntreeRecord> {
  const { data } = await api.post("/api/entrees/create-complete", { data: payload });
  return mapEntree(data.data);
}

/** Payload de POST /api/sorties/create-complete (entête + lignes).
 *  Les valeurs vides sont écartées côté client par `construirePayloadSortie` ;
 *  le serveur reste l'autorité pour le prix et le montant final. */
export interface NouvelleSortiePayload {
  date_sortie: string;
  justificatif: string;
  /** Non envoyé en entête (spécification) — le champ est volontairement absent. */
  observations?: undefined;
  direction_id?: string;
  service_id?: string;
  beneficiaire?: string;
  demande_id?: string;
  lignes: Array<{
    /** documentId de la fiche matériel — nom exact attendu par le serveur
     *  (`materiel_id`) : le serveur ignore tout autre libellé et retomberait
     *  sur la résolution par texte, qui exige une désignation identique. */
    materiel_id?: string;
    designation?: string;
    quantite: number;
    observations?: string;
  }>;
}

/** Contrôle physique d'une ligne de sortie, groupé à la signature magasinier
 *  (voir lib/sortieControle.ts → construirePayloadSignatureSortie). */
export interface ControleSortieLignePayload {
  /** documentId de la ligne de sortie contrôlée. */
  ligne: string;
  etat: "neuf" | "bon" | "moyen" | "defaillant";
  observations?: string;
}

/** Création complète d'une sortie (entête + lignes). */
export async function creerSortie(payload: NouvelleSortiePayload): Promise<SortieRecord> {
  const { data } = await api.post("/api/sorties/create-complete", { data: payload });
  return mapSortie(data.data);
}

/** Signature d'une sortie (rôle contrôlé côté serveur).
 *  Étape 3 (logistique) : seuls le rôle et, si non vides, les N° logistiques
 *  par ligne sont envoyés — jamais de statut, date, signataire ni stock. */
export async function signerSortie(
  documentId: string,
  role: 'magasinier' | 'depositaire' | 'logistique',
  controles?: ControleSortieLignePayload[],
  numerosLogistiques?: Array<{ ligne: string; numero_logistique: string }>
): Promise<SortieRecord> {
  const data: Record<string, unknown> = { role };
  if (controles && controles.length > 0) data.controles = controles;
  if (numerosLogistiques && numerosLogistiques.length > 0) {
    data.numeros_logistiques = numerosLogistiques;
  }
  // Transaction serveur (validation + débit de stock) : délai généreux, la
  // valeur par défaut de l'instance (8 s) tronquerait la requête.
  const { data: reponse } = await api.post(
    `/api/sorties/${documentId}/sign`,
    { data },
    { timeout: 30000 }
  );
  return mapSortie(reponse.data);
}

/** Rejet d'une sortie par un responsable habilité. */
export async function rejeterSortie(documentId: string, motif: string): Promise<SortieRecord> {
  const { data } = await api.post(`/api/sorties/${documentId}/reject`, {
    data: { motif },
  });
  return mapSortie(data.data);
}

/**
 * Payload de la remise — QUATRE champs, jamais un statut, jamais le stock.
 * Le serveur refuse tout le reste de toute façon ; l'envoyer ne serait
 * qu'une occasion de dévier du contrat.
 */
export interface PayloadRemise {
  mandataire_nom?: string;
  date_remise: string;
}

/**
 * Enregistre la remise du matériel au détenteur.
 * POST /api/sorties/:documentId/remise — rôle magasinier ou dépositaire
 * comptable, sortie obligatoirement validée.
 *
 * Le stock n'est PAS touché ici : il a déjà été débité à la validation
 * logistique. La remise ne fait qu'enregistrer qui a reçu le matériel
 * (et, le cas échéant, le mandataire), et quand.
 */
export async function remettreSortie(
  documentId: string,
  payload: PayloadRemise
): Promise<SortieRecord> {
  // Transaction serveur : délai généreux, la valeur par défaut de
  // l'instance (8 s) tronquerait la requête.
  const { data: reponse } = await api.post(
    `/api/sorties/${documentId}/remise`,
    { data: payload },
    { timeout: 30000 }
  );
  return mapSortie(reponse.data);
}

/**
 * Recharge une sortie depuis le serveur : sert à conclure sur l'ÉTAT RÉEL
 * quand l'envoi d'une remise est INCERTAIN (délai dépassé, coupure).
 *
 * Aucune relance automatique de l'ENVOI : seule la LECTURE est rejouée.
 * Renvoie `null` si l'ordre est introuvable ; lève si le serveur est
 * injoignable (état alors toujours inconnu).
 */
/**
 * Une entrée outbox retournée par GET /api/notification-outbox/notifications.
 */
export interface NotificationOutbox {
  id: number;
  eventType?: string;
  recipientId?: number;
  recipientRole?: string;
  payload?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
}

/**
 * Récupère les notifications outbox de l'utilisateur connecté.
 * GET /api/notification-outbox/notifications — filtrées par recipientId.
 * Retourne la liste (tous statuts confondus, y compris celles manquées en
 * temps réel) ou `null` en cas d'échec/réseau ; ne lève jamais d'exception.
 */
export async function fetchNotificationsOutbox(): Promise<NotificationOutbox[] | null> {
  try {
    const { data } = await api.get("/api/notification-outbox/notifications", {
      timeout: 5000,
    });
    return data?.data ?? []
  } catch {
    return null
  }
}

export async function rechargerSortie(documentId: string): Promise<SortieRecord | null> {
  const sorties = await fetchAllSortiesOrThrow();
  return sorties.find((sortie) => sortie.id === documentId) ?? null;
}

/**
 * Signature dépositaire (étape 2/3 du circuit de sortie).
 * Appelait auparavant `/prepare` (route inexistante) — redirigé vers
 * `/sign` avec `role: 'depositaire'`. Le backend ignore `controles` pour
 * le dépositaire ; il n'est conservé en signature que pour compatibilité.
 */
export async function preparerSortie(documentId: string, _controles: ControleSortieLignePayload[]): Promise<SortieRecord> {
  const { data } = await api.post(`/api/sorties/${documentId}/sign`, {
    data: { role: 'depositaire' },
  });
  return mapSortie(data.data);
}

/** Détail du contrôle physique d'une ligne, envoyé groupé avec la signature
 *  chef_service_1 par le flux « Arrivée matériel » (MaterialEntry étape 2). */
export interface ControleLignePayload {
  /** Numéro d'ordre de la ligne dans l'entrée (1-based). */
  numero_ordre: number;
  etat: "neuf" | "bon" | "moyen" | "defaillant";
  conforme: boolean;
  /** Motif de réserve / remarque — repris dans observations de entree-ligne. */
  observations?: string;
}

/**
 * Pose une signature (rôle contrôlé côté serveur).
 * `controles` : optionnel — groupé à la signature chef_service_1 par le flux
 * « Arrivée matériel ». Sans ce paramètre, comportement historique inchangé
 * (MovementDetailModal / circuit EntriesPage-NewEntryPage).
 */
export async function signerEntree(
  documentId: string,
  role: "depositaire" | "chef_service_1" | "chef_service_2",
  controles?: ControleLignePayload[]
): Promise<EntreeRecord> {
  const { data } = await api.post(`/api/entrees/${documentId}/sign`, {
    data: { role, ...(controles ? { controles } : {}) },
  });
  return mapEntree(data.data);
}

/**
 * Photos d'une ligne d'entrée — envoi via le plugin d'upload NATIF de Strapi
 * (POST /api/upload), jamais via un endpoint maison : le mécanisme de
 * rattachement d'un média à un champ `ref/refId/field` est celui de Strapi.
 *
 * Les fichiers arrivent déjà compressés côté client (PhotoCapture,
 * compressImageFile) : ils sont renvoyés tels quels, sans recompression.
 */
export const LIGNE_ENTREE_UID = "api::entree-ligne.entree-ligne";

/** UID du content-type « fiche matériel » : cible du champ media `photos`
 *  ajouté sur `material` (photo de référence, même mécanisme que les photos
 *  de contrôle des lignes d'entrée). */
export const MATERIAL_UID = "api::material.material";

/** Convertit une Data URL (JPEG déjà compressé) en File, pour l'envoi
 *  multipart. Les Data URLs ne sont jamais stockées côté serveur. */
export function dataUrlVersFile(dataUrl: string, nomFichier: string): File | null {
  const virgule = dataUrl.indexOf(",");
  if (virgule < 0) return null;
  const entete = dataUrl.slice(0, virgule);
  const base64 = dataUrl.slice(virgule + 1);
  if (!entete.startsWith("data:")) return null;
  const type = entete.slice(5).split(";")[0] || "image/jpeg";
  try {
    const binaire = atob(base64);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
    return new File([octets], nomFichier, { type });
  } catch {
    return null;
  }
}

/**
 * Envoi générique de photos vers le plugin d'upload NATIF de Strapi.
 *
 * Un seul mécanisme pour toutes les photos de l'application : lignes d'entrée
 * (`api::entree-ligne.entree-ligne`) et fiches matériel
 * (`api::material.material`) passent par POST /api/upload avec
 * `ref` / `refId` / `field` — AUCUNE logique d'upload n'est recodée.
 *
 * `refId` doit être l'id NUMÉRIQUE de l'enregistrement : le plugin rattache le
 * fichier via la table morph `files_related_mph.related_id`, comparée à la
 * clé primaire. Un documentId y est stocké sans jamais être relu (populate vide).
 */
async function envoyerPhotosVers(
  uid: string,
  champ: string,
  refId: string | number,
  dataUrls: string[],
  nomBase: string
): Promise<string[]> {
  const fichiers = dataUrls
    .map((dataUrl, i) => dataUrlVersFile(dataUrl, `${nomBase}-${i + 1}.jpg`))
    .filter((f): f is File => f !== null);
  if (fichiers.length === 0) return [];

  const forme = new FormData();
  for (const fichier of fichiers) forme.append("files", fichier);
  forme.append("ref", uid);
  forme.append("refId", String(refId));
  forme.append("field", champ);

  // multipart : ne PAS fixer Content-Type (axios ajoute la boundary).
  const { data } = await api.post("/api/upload", forme, {
    timeout: 20000,
  });
  const fichiersRetournes: Array<{ url?: string }> = Array.isArray(data)
    ? data
    : Array.isArray(data?.files)
    ? data.files
    : [];
  return fichiersRetournes
    .map((f) => f?.url)
    .filter((u): u is string => !!u);
}

/**
 * Envoie les photos d UNE ligne d'entrée et renvoie les URL persistées.
 * Le serveur rattache chaque fichier au champ media `photos` de la ligne visée.
 *
 * `ligneRefId` = `refId` attendu par le plugin upload : l'id NUMÉRIQUE de la
 * ligne (`EntreeLigne.id`). Passer le documentId écrit bien le fichier sur le
 * disque mais ne le rattache jamais à la ligne (populate `photos` vide).
 */
export async function uploadPhotosLigne(
  ligneRefId: string | number,
  dataUrls: string[]
): Promise<string[]> {
  return envoyerPhotosVers(
    LIGNE_ENTREE_UID,
    "photos",
    ligneRefId,
    dataUrls,
    `ligne-${ligneRefId}`
  );
}

/**
 * Photo de RÉFÉRENCE d'une fiche matériel (champ media `photos` de `material`).
 * Même endpoint, même forme multipart que les photos de contrôle — seul le
 * `ref` change. `materielRefId` est l'id NUMÉRIQUE de la fiche.
 */
export async function uploadPhotosMateriel(
  materielRefId: string | number,
  dataUrls: string[]
): Promise<string[]> {
  return envoyerPhotosVers(
    MATERIAL_UID,
    "photos",
    materielRefId,
    dataUrls,
    `materiel-${materielRefId}`
  );
}

/**
 * Création d'une fiche matériel depuis la saisie d'une entrée.
 *
 * Appelé UNIQUEMENT quand l'utilisateur a déclaré « c'est un nouvel article »
 * (aucune création silencieuse) : la ligne d'entrée est alors rattachée à la
 * fiche créée au lieu de rester en désignation libre.
 */
export async function creerMateriel(payload: {
  designation: string;
  nomenclature?: string;
  numero_serie?: string;
  valeur_unitaire?: number;
}): Promise<MaterialOption> {
  const { data } = await api.post("/api/materials", { data: payload });
  return mapMateriel(data?.data ?? {});
}

/** Rejet d'une entrée par un responsable habilité. */
export async function rejeterEntree(documentId: string): Promise<EntreeRecord> {
  const { data } = await api.post(`/api/entrees/${documentId}/reject`);
  return mapEntree(data.data);
}

export interface RefOption {
  documentId: string;
  nom: string;
  /** Abréviation de la direction (ex. « DAF ») — pour le rapprochement stable avec le département utilisateur. */
  abbreviation?: string;
  /** Direction de rattachement (services uniquement) — pour le filtrage Direction → Service */
  directionId?: string;
  /** Responsables du service (déchargés automatiquement à la sélection) */
  responsable?: string;
  depositaire?: string;
  chefService1?: string;
  chefService2?: string;
  /** Directeur de la direction (responsable de repli) */
  directeur?: string;
}

export interface MaterialOption {
  /** Id NUMÉRIQUE Strapi — c'est la valeur attendue dans `refId` de
   *  POST /api/upload pour rattacher une photo à la fiche. */
  id?: number;
  documentId: string;
  designation: string;
  categorie?: string;
  quantiteStock?: number;
  valeurUnitaire?: number;
  /** Champs complémentaires (écran Équipements / tableau de bord). */
  numeroSerie?: string;
  nomenclature?: string;
  /** Statut serveur : en_stock / distribue / maintenance / reforme / sortie. */
  statut?: string;
  dateCreation?: string;
  /** Photo de RÉFÉRENCE de la fiche (champ media `photos` de material).
   *  URL absolue déjà normalisée — la première sert de vignette. Optionnel :
   *  un matériel sans photo s'affiche normalement. */
  photos?: string[];
  /** Vignette de REPLI : photo de la LIGNE d'entrée rattachée à la fiche
   *  (relation `materiel` posée au rapprochement), URL absolue. Présente
   *  seulement si la fiche n'a pas encore de photo de référence. */
  photoDeLigne?: string;
}

/** Liste des fournisseurs (pour le formulaire « Nouvelle entrée »). */
export async function fetchFournisseurs(): Promise<RefOption[]> {
  try {
    const { data } = await api.get("/api/fournisseurs", {
      params: { "pagination[pageSize]": 100, sort: "nom:asc" },
      timeout: 5000,
    });
    return (data?.data ?? []).map((row: { documentId?: string; id: number; nom?: string }) => ({
      documentId: row.documentId || String(row.id),
      nom: row.nom || `Fournisseur #${row.id}`,
    }));
  } catch {
    return [];
  }
}

/** Liste des directions (pour le formulaire « Nouvelle entrée »). */
export async function fetchDirections(): Promise<RefOption[]> {
  try {
    const { data } = await api.get("/api/directions", {
      params: { "pagination[pageSize]": 100, sort: "nom_direction:asc" },
      timeout: 5000,
    });
    return (data?.data ?? []).map(
      (row: {
        documentId?: string;
        id: number;
        nom_direction?: string;
        abreviation?: string;
        directeur?: string;
      }) => ({
        documentId: row.documentId || String(row.id),
        nom: row.nom_direction || `Direction #${row.id}`,
        abbreviation: row.abreviation || undefined,
        directeur: row.directeur || undefined,
      })
    );
  } catch {
    return [];
  }
}

/** Liste des services (pour le formulaire « Nouvelle entrée »).
 *  Chaque service porte sa direction de rattachement et ses responsables
 *  (dépositaire, chef de service 1, chef de service 2) : le formulaire
 *  filtre automatiquement les services de la direction sélectionnée. */
export async function fetchServices(): Promise<RefOption[]> {
  try {
    const { data } = await api.get("/api/services", {
      params: {
        "pagination[pageSize]": 100,
        sort: "nom_service:asc",
        populate: "direction",
      },
      timeout: 5000,
    });
    return (data?.data ?? []).map(
      (row: {
        documentId?: string;
        id: number;
        nom_service?: string;
        responsable?: string;
        depositaire?: string;
        chef_service_1?: string;
        chef_service_2?: string;
        direction?: {
          documentId?: string;
          id: number;
          nom_direction?: string;
        } | null;
      }) => ({
        documentId: row.documentId || String(row.id),
        nom: row.nom_service || `Service #${row.id}`,
        directionId: row.direction?.documentId || undefined,
        responsable: row.responsable || undefined,
        depositaire: row.depositaire || undefined,
        chefService1: row.chef_service_1 || undefined,
        chefService2: row.chef_service_2 || undefined,
      })
    );
  } catch {
    return [];
  }
}

/** Liste des matériaux existants (pré-remplissage du formulaire + écran
 *  Équipements / indicateurs de stock du tableau de bord).
 *  Important : un retour [] peut être une VRAIE liste vide — distinguer
 *  l'échec réseau via fetchMaterialsOrThrow(). */
export async function fetchMaterials(): Promise<MaterialOption[]> {
  try {
    return await fetchMaterialsOrThrow();
  } catch {
    return [];
  }
}

interface StrapiLigneMateriel {
  documentId?: string;
  id: number;
  designation?: string;
  numero_serie?: string | null;
  nomenclature?: string | null;
  statut?: string | null;
  quantite_stock?: number | null;
  valeur_unitaire?: number | null;
  categorie?: { nom?: string } | null;
  createdAt?: string;
  /** Champ media `photos` (photo de référence de la fiche) : peuplé seulement
   *  si le client le demande — URL Strapi, normalisée en URL absolue. */
  photos?: Array<{ url?: string | null }> | null;
}

/** Mapping ligne `material` → MaterialOption. Source partagée par la lecture
 *  (GET /api/materials) et la création (POST /api/materials). */
function mapMateriel(row: StrapiLigneMateriel): MaterialOption {
  return {
    // `id` NUMÉRIQUE : valeur attendue dans `refId` de POST /api/upload pour
    // rattacher une photo à la fiche (clé primaire, jamais le documentId).
    id: row.id,
    documentId: row.documentId || String(row.id),
    designation: row.designation || `Matériel #${row.id}`,
    categorie: row.categorie?.nom || undefined,
    quantiteStock: row.quantite_stock ?? undefined,
    valeurUnitaire: row.valeur_unitaire ?? undefined,
    numeroSerie: row.numero_serie || undefined,
    nomenclature: row.nomenclature || undefined,
    statut: row.statut || undefined,
    dateCreation: row.createdAt || undefined,
    // Photos de référence : la PREMIÈRE sert de vignette (pas de galerie).
    // Aucune photo = tableau vide, jamais une erreur d'affichage.
    photos: (row.photos ?? [])
      .map((p) => urlMediaAffichable(p?.url))
      .filter((u): u is string => !!u),
  };
}

/**
 * Photos des LIGNES d'entrée rattachées à une fiche matériel, indexées par
 * `documentId` de la fiche (relation `materiel` posée après le rapprochement).
 *
 * Repli d'AFFICHAGE (écran Équipements) : certaines fiches n'ont pas encore de
 * photo de référence alors que leur ligne d'entrée, elle, en a une. Seule la
 * relation compte : aucune correspondance par désignation approximative.
 *
 * Échec de l'appel = aucune vignette de repli, jamais de blocage : les
 * matériels déjà lus restent affichés.
 */
async function fetchPhotosLignesParFiche(): Promise<Map<string, string>> {
  const parFiche = new Map<string, string>();
  let page = 1;
  let pageCount = 1;
  try {
    do {
      const { data } = await api.get("/api/entree-lignes", {
        params: {
          "pagination[page]": page,
          "pagination[pageSize]": 200,
          populate: ["materiel", "photos"],
        },
        timeout: 5000,
      });

      const rows: Array<{
        materiel?: { documentId?: string } | null;
        photos?: Array<{ url?: string | null }> | null;
      }> = data?.data ?? [];
      for (const row of rows) {
        const fiche = row.materiel?.documentId;
        const url = urlMediaAffichable(row.photos?.[0]?.url);
        if (fiche && url && !parFiche.has(fiche)) {
          parFiche.set(fiche, url);
        }
      }

      const pagination = data?.meta?.pagination;
      pageCount =
        pagination && typeof pagination.pageCount === "number"
          ? pagination.pageCount
          : 1;
      page++;
    } while (page <= pageCount);
  } catch {
    /* Repli optionnel : on retourne la carte partielle (souvent vide). */
  }
  return parFiche;
}

/** Comme fetchMaterials mais propage l'erreur : l'appelant peut afficher un
 *  état d'erreur explicite au lieu d'une liste vide silencieuse.
 *  Parcourt toutes les pages (meta.pagination) pour ne jamais tronquer silencieusement. */
export async function fetchMaterialsOrThrow(): Promise<MaterialOption[]> {
  const pageSize = 200;
  let page = 1;
  let pageCount = 1;
  const tousLesMateriels: MaterialOption[] = [];

  do {
    const { data } = await api.get("/api/materials", {
      params: {
        "pagination[page]": page,
        "pagination[pageSize]": pageSize,
        sort: "designation:asc",
        // `photos` : photo de référence de la fiche — sans ce populate la
        // vignette serait toujours vide après un simple rechargement.
        populate: ["categorie", "photos"],
      },
      timeout: 5000,
    });

    const rows = (data?.data ?? []).map((row: StrapiLigneMateriel) =>
      mapMateriel(row)
    );
    tousLesMateriels.push(...rows);

    const pagination = data?.meta?.pagination;
    if (pagination && typeof pagination.pageCount === "number") {
      pageCount = pagination.pageCount;
    } else if (
      pagination &&
      typeof pagination.total === "number" &&
      typeof pagination.pageSize === "number" &&
      pagination.pageSize > 0
    ) {
      pageCount = Math.ceil(pagination.total / pagination.pageSize);
    } else {
      pageCount = 1;
    }

    page++;
  } while (page <= pageCount);

  // Vignette de repli : photo de la LIGNE d'entrée rattachée à la fiche.
  // Une seule requête supplémentaire, et seulement s'il reste une fiche sans
  // photo de référence (sinon rien à replier).
  if (tousLesMateriels.some((m) => !m.photos?.[0])) {
    const photoParFiche = await fetchPhotosLignesParFiche();
    for (const materiel of tousLesMateriels) {
      if (materiel.photos?.[0]) continue;
      const url = photoParFiche.get(materiel.documentId);
      if (url) materiel.photoDeLigne = url;
    }
  }

  return tousLesMateriels;
}

/**
 * Charge les sorties depuis Strapi (/api/sorties).
 * Retourne `null` en cas d'indisponibilité, `[]` s'il répond sans donnée :
 * repli sur les données locales.
 */
export async function fetchSorties(): Promise<SortieRecord[] | null> {
  try {
    const { data } = await api.get("/api/sorties", {
      timeout: 5000,
      params: {
        sort: "date_sortie:desc",
        "pagination[pageSize]": 100,
        populate: {
          direction: true,
          service: true,
          demande: { populate: ["demandeur"] },
          lignes: {
            populate: { materiel: { populate: ["categorie"] } },
          },
        },
      },
    });

    const rows: StrapiEntity[] = data?.data ?? [];
    return rows.map(mapSortie);
  } catch {
    return null;
  }
}
export async function fetchSortiesAvecOptions(options: {
  pageSize?: number;
  sort?: string;
  populate?: any;
} = {}): Promise<SortieRecord[] | null> {
  try {
    const { data } = await api.get("/api/sorties", {
      timeout: 5000,
      params: {
        sort: options.sort ?? "date_sortie:desc",
        "pagination[pageSize]": options.pageSize ?? 100,
        populate: options.populate ?? {
          direction: true,
          service: true,
          demande: { populate: ["demandeur"] },
          lignes: {
            populate: { materiel: { populate: ["categorie"] } },
          },
        },
      },
    });

    const rows: StrapiEntity[] = data?.data ?? [];
    return rows.map(mapSortie);
  } catch {
    return null;
  }
}
/**
 * Récupère les sorties qui attendent la préparation du magasinier.
 * Utilise une pagination correcte pour récupérer toutes les données correspondantes,
 * même quand Strapi limite la taille de page.
 * @returns Les sorties en attente de préparation, ou null en cas d'erreur
 */
export async function fetchSortiesEnAttente(): Promise<SortieRecord[] | null> {
  try {
    const pageSize = 100; // Utiliser la taille maximale autorisée par Strapi
    let page = 1;
    let pageCount = 1;
    const sortiesEnAttente: SortieRecord[] = [];

    do {
      const { data } = await api.get("/api/sorties", {
        timeout: 5000,
        params: {
          // ⚠️ Valeur de l'ÉNUM SERVEUR (`en_preparation`), jamais le libellé
          // affiché « En préparation » : le second ne matche AUCUNE ligne.
          "filters[statut][$eq]": "en_preparation",
          "filters[magasinier_signed][$eq]": false,
          "sort": "date_sortie:desc",
          "pagination[page]": page,
          "pagination[pageSize]": pageSize,
          populate: {
            direction: true,
            service: true,
            demande: { populate: ["demandeur"] },
            lignes: {
              populate: { materiel: { populate: ["categorie"] } },
            },
          },
        },
      });

      const rows = (data?.data ?? []).map((row: StrapiEntity) =>
        mapSortie(row)
      );
      sortiesEnAttente.push(...rows);

      const pagination = data?.meta?.pagination;
      if (pagination && typeof pagination.pageCount === "number") {
        pageCount = pagination.pageCount;
      } else if (
        pagination &&
        typeof pagination.total === "number" &&
        typeof pagination.pageSize === "number" &&
        pagination.pageSize > 0
      ) {
        pageCount = Math.ceil(pagination.total / pagination.pageSize);
      } else {
        pageCount = 1;
      }

      page++;
    } while (page <= pageCount);

    return sortiesEnAttente;
  } catch {
    return null;
  }
}

/**
 * Récupère toutes les sorties en gérant correctement la pagination.
 * Similaire à fetchMaterialsOrThrow, cette fonction boucle sur toutes les pages
 * en utilisant meta.pagination.pageCount pour récupérer toutes les données,
 * même quand Strapi limite la taille de page.
 * @returns Toutes les sorties, ou null en cas d'erreur
 */
/**
 * Liste LÉGÈRE des ordres en attente de signature magasinier (statut
 * `en_preparation`, signature 1 absente), servie à la cloche et au badge.
 *
 * Contrairement à fetchAllSortiesOrThrow, AUCUN `populate` : la requête ne
 * charge jamais le détail (lignes, matériel, direction) — celui-ci n'est
 * demandé que par l'onglet Distribution. Les colonnes lues sont limitées à
 * celles dont la cloche a besoin.
 */
export async function fetchOrdresPourAlertes(): Promise<SortieRecord[] | null> {
  const pageSize = 100;
  let page = 1;
  let pageCount = 1;
  const ordres: SortieRecord[] = [];

  try {
    do {
      const { data } = await api.get("/api/sorties", {
        timeout: 5000,
        params: {
          "filters[statut][$eq]": "en_preparation",
          "filters[magasinier_signed][$eq]": false,
          "sort": "date_sortie:desc",
          "pagination[page]": page,
          "pagination[pageSize]": pageSize,
          fields: ["documentId", "reference", "date_sortie", "statut", "magasinier_signed"],
        },
      });

      const rows: StrapiEntity[] = data?.data ?? [];
      ordres.push(...rows.map(mapSortie));

      const pagination = data?.meta?.pagination;
      pageCount =
        pagination && typeof pagination.pageCount === "number"
          ? pagination.pageCount
          : 1;
      page++;
    } while (page <= pageCount);

    return ordres;
  } catch {
    return null;
  }
}

export async function fetchAllSortiesOrThrow(): Promise<SortieRecord[]> {
  const pageSize = 100; // Utiliser la taille maximale autorisée par Strapi
  let page = 1;
  let pageCount = 1;
  const toutesLesSorties: SortieRecord[] = [];

  do {
    const { data } = await api.get("/api/sorties", {
      timeout: 5000,
      params: {
        sort: "date_sortie:desc",
        "pagination[page]": page,
        "pagination[pageSize]": pageSize,
        populate: {
          direction: true,
          service: true,
          demande: { populate: ["demandeur"] },
          lignes: {
            populate: { materiel: { populate: ["categorie"] } },
          },
        },
      },
    });

    const rows = (data?.data ?? []).map((row: StrapiEntity) =>
      mapSortie(row)
    );
    toutesLesSorties.push(...rows);

    const pagination = data?.meta?.pagination;
    if (pagination && typeof pagination.pageCount === "number") {
      pageCount = pagination.pageCount;
    } else if (
      pagination &&
      typeof pagination.total === "number" &&
      typeof pagination.pageSize === "number" &&
      pagination.pageSize > 0
    ) {
      pageCount = Math.ceil(pagination.total / pagination.pageSize);
    } else {
      pageCount = 1;
    }

    page++;
  } while (page <= pageCount);

  return toutesLesSorties;
}

/**
 * Compte les sorties qui attendent la signature du magasinier.
 * Utilise les filtres serveur et pagination avec compte pour récupérer uniquement le total.
 * @returns Le nombre de sorties en attente de préparation, ou null en cas d'erreur
 */
export async function countSortiesPourPreparation(): Promise<number | null> {
  try {
    const { data } = await api.get("/api/sorties", {
      timeout: 5000,
      params: {
        // Filtre côté serveur sur l'ÉNUM brute — « En préparation » ne
        // correspond à aucune valeur stockée (schéma : demandee,
        // en_preparation, validee, sortie_effectuee, annulee) et retournait
        // toujours 0.
        "filters[statut][$eq]": "en_preparation",
        "filters[magasinier_signed][$eq]": false,
        // pageSize=1 : on ne veut QUE le total, jamais le détail.
        "pagination[pageSize]": 1,
        "pagination[withCount]": true,
      },
    });

    // Avec pagination[withCount]=true, la réponse contient un objet meta.pagination
    // avec le compte total
    return data?.meta?.pagination?.total ?? 0;
  } catch {
    return null;
  }
}

/**
 * Compte les ordres à AUTORISER par le chef logistique : statut en_preparation,
 * signatures 1 et 2 posées, signature 3 absente. Filtre SERVEUR + pageSize=1 :
 * on ne veut QUE le total (badge du menu), jamais le détail.
 */
export async function countSortiesAAutoriser(): Promise<number | null> {
  try {
    const { data } = await api.get("/api/sorties", {
      timeout: 5000,
      params: {
        "filters[statut][$eq]": "en_preparation",
        "filters[magasinier_signed][$eq]": true,
        "filters[depositaire_signed][$eq]": true,
        "filters[logistique_signed][$eq]": false,
        // pageSize=1 : seul le total compte.
        "pagination[pageSize]": 1,
        "pagination[withCount]": true,
      },
    });
    return data?.meta?.pagination?.total ?? 0;
  } catch {
    return null;
  }
}

/**
 * Liste LÉGÈRE des ordres à autoriser (mêmes filtres serveur, AUCUN populate) :
 * alimente l'alerte « Nouvel ordre à autoriser » sans jamais charger le détail.
 */
export async function fetchOrdresAAutoriser(): Promise<SortieRecord[] | null> {
  const pageSize = 100;
  let page = 1;
  let pageCount = 1;
  const ordres: SortieRecord[] = [];

  try {
    do {
      const { data } = await api.get("/api/sorties", {
        timeout: 5000,
        params: {
          "filters[statut][$eq]": "en_preparation",
          "filters[magasinier_signed][$eq]": true,
          "filters[depositaire_signed][$eq]": true,
          "filters[logistique_signed][$eq]": false,
          "sort": "date_sortie:desc",
          "pagination[page]": page,
          "pagination[pageSize]": pageSize,
          fields: [
            "documentId",
            "reference",
            "date_sortie",
            "statut",
            "magasinier_signed",
            "depositaire_signed",
            "logistique_signed",
          ],
        },
      });

      const rows: StrapiEntity[] = data?.data ?? [];
      ordres.push(...rows.map(mapSortie));

      const pagination = data?.meta?.pagination;
      pageCount =
        pagination && typeof pagination.pageCount === "number"
          ? pagination.pageCount
          : 1;
      page++;
    } while (page <= pageCount);

    return ordres;
  } catch {
    return null;
  }
}

/**
 * Liste LÉGÈRE des ordres ACCEPTÉS par le chef logistique (3ᵉ signature,
 * statut serveur `validee`) et pas encore remis : c'est ce déclenchement qui
 * alimente la notification du dépositaire (« le chef log a accepté la sortie »)
 * et l'écriture au journal comptable. Filtre SERVEUR, aucun populate.
 */
export async function fetchOrdresValidesPourDepositaire(): Promise<
  SortieRecord[] | null
> {
  const pageSize = 100;
  let page = 1;
  let pageCount = 1;
  const ordres: SortieRecord[] = [];

  try {
    do {
      const { data } = await api.get("/api/sorties", {
        timeout: 5000,
        params: {
          // ⚠️ Valeur de l'ÉNUM SERVEUR (`validee`), jamais le libellé affiché.
          "filters[statut][$eq]": "validee",
          "filters[logistique_signed][$eq]": true,
          "sort": "date_sortie:desc",
          "pagination[page]": page,
          "pagination[pageSize]": pageSize,
          fields: [
            "documentId",
            "reference",
            "date_sortie",
            "statut",
            "magasinier_signed",
            "depositaire_signed",
            "logistique_signed",
            "date_signature_logistique",
          ],
        },
      });

      const rows: StrapiEntity[] = data?.data ?? [];
      ordres.push(...rows.map(mapSortie));

      const pagination = data?.meta?.pagination;
      pageCount =
        pagination && typeof pagination.pageCount === "number"
          ? pagination.pageCount
          : 1;
      page++;
    } while (page <= pageCount);

    return ordres;
  } catch {
    return null;
  }
}
// ---------------------------------------------------------------------------
// Réceptions physiques : persistance via l'API backend /api/receptions-physiques
// ---------------------------------------------------------------------------

export type StatutReceptionPhysique = "conforme" | "anomalie";

export type TypeAnomalieReception = "manquant" | "endommage" | "incorrect";

export interface ReceptionPhysiqueCreatePayload {
  sortieId: string;
  date_reception?: string;
  statut?: StatutReceptionPhysique;
  type_anomalie?: TypeAnomalieReception;
  description_anomalie?: string;
  quantite_prevue: number;
  quantite_recue: number;
  utilisateur: string;
}

export interface ReceptionPhysiqueRecord {
  id: string;
  documentId?: string;
  sortieId?: string;
  date_reception: string;
  statut: StatutReceptionPhysique;
  type_anomalie?: TypeAnomalieReception;
  description_anomalie?: string;
  quantite_prevue: number;
  quantite_recue: number;
  utilisateur: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Mappe un type d'anomalie frontend vers l'énumération backend.
 *  "autre" n'a pas d'équivalent côté serveur → retourne undefined (champ omis). */
function mapTypeAnomalieBackend(
  type: "quantite" | "etat" | "conformite" | "autre"
): TypeAnomalieReception | undefined {
  switch (type) {
    case "quantite":
      return "incorrect";
    case "etat":
      return "endommage";
    case "conformite":
      return "incorrect";
    case "autre":
      return undefined;
  }
}

/** Crée une réception physique côté serveur.
 *  POST /api/receptions-physiques — rôle demandeur requis, sortie en statut
 *  `sortie_effectuee` appartenant à la direction du demandeur.
 *  Aucun débit de stock n'est effectué par cette route (le stock a déjà été
 *  débité à la signature logistique).
 */
export async function creerReceptionPhysique(
  payload: ReceptionPhysiqueCreatePayload
): Promise<ReceptionPhysiqueRecord> {
  const { data } = await api.post("/api/receptions-physiques", { data: payload });
  return data?.data ?? data;
}

/** Liste les réceptions physiques (filtrées par direction côté serveur si demandeur).
 *  La relation `sortie` est peuplée pour accéder à la référence et à la direction.
 */
export async function listerReceptionsPhysiques(): Promise<
  ReceptionPhysiqueRecord[] | null
> {
  try {
    const { data } = await api.get("/api/receptions-physiques", {
      timeout: 5000,
      params: {
        populate: {
          sortie: {
            populate: { direction: true },
          },
        },
      },
    });
    const rows: Array<ReceptionPhysiqueRecord> = (data?.data ?? []).map((row: any) => ({
      ...row,
      // Strapi 5 retourne la relation `sortie` comme un objet peuplé
      // ({ documentId, id, ... }), jamais comme un champ plat `sortieId`.
      // On extrait le documentId de la sortie pour que le calcul du reliquat
      // (getQuantiteDejaRecue / getReliquat / sortiesRéceptionnables) puisse
      // faire correspondre chaque réception à sa sortie.
      sortieId: row.sortie?.documentId || row.sortieId || undefined,
    }));
    return rows;
  } catch {
    return null;
  }
}

/** Récupère une réception physique par son documentId. */
export async function getReceptionPhysique(
  documentId: string
): Promise<ReceptionPhysiqueRecord | null> {
  try {
    const { data } = await api.get(`/api/receptions-physiques/${documentId}`, {
      timeout: 5000,
    });
    return data?.data ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Types exposés au frontend (structure attendue par les composants)
// ---------------------------------------------------------------------------
export interface OrgEmployee {
  id: number;
  name: string;
  im: string;
  fonction: string;
  email: string;
  phone: string;
  CIN: string;
  status: "Actif" | "Inactif" | "Congé";
}

export interface OrgService {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
  location: string;
  employees: OrgEmployee[];
}

export interface OrgDirection {
  id: number;
  name: string;
  director: string;
  directorEmail: string;
  description: string;
  location: string;
  services: OrgService[];
}

// ---------------------------------------------------------------------------
// Types renvoyés par l'API Strapi 5
// ---------------------------------------------------------------------------
interface StrapiEmployee {
  id: number;
  documentId: string;
  im?: string;
  CIN?: string;
  nom?: string;
  prenom?: string;
  fonction?: string;
  email?: string;
  phone?: string;
  statut?: "actif" | "inactif" | "congé";
}

interface StrapiService {
  id: number;
  documentId: string;
  nom_service?: string;
  description?: string;
  responsable?: string;
  responsable_email?: string;
  localisation?: string;
  employees?: StrapiEmployee[];
}

interface StrapiDirection {
  id: number;
  documentId: string;
  nom_direction?: string;
  abreviation?: string;
  description?: string;
  directeur?: string;
  directeur_email?: string;
  localisation?: string;
  services?: StrapiService[];
}

function mapStatut(statut?: string): OrgEmployee["status"] {
  switch (statut) {
    case "inactif":
      return "Inactif";
    case "congé":
      return "Congé";
    default:
      return "Actif";
  }
}

/**
 * Récupère l'organigramme complet (directions -> services -> employés)
 * depuis le backend Strapi.
 */
export async function fetchOrganisation(): Promise<OrgDirection[]> {
  const { data } = await api.get("/api/directions", {
    params: {
      "populate[services][populate][0]": "employees",
      "sort[0]": "nom_direction:asc",
    },
  });

  const rows: StrapiDirection[] = data?.data ?? [];

  return rows.map((direction) => ({
    id: direction.id,
    name: direction.nom_direction ?? "",
    director: direction.directeur ?? "",
    directorEmail: direction.directeur_email ?? "",
    description: direction.description ?? "",
    location: direction.localisation ?? "",
    services: (direction.services ?? []).map((service) => ({
      id: service.id,
      name: service.nom_service ?? "",
      manager: service.responsable ?? "",
      managerEmail: service.responsable_email ?? "",
      description: service.description ?? "",
      location: service.localisation ?? "",
      employees: (service.employees ?? []).map((employee) => ({
        id: employee.id,
        name: [employee.prenom, employee.nom].filter(Boolean).join(" "),
        im: employee.im ?? "",
        fonction: employee.fonction ?? "",
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        CIN: employee.CIN ?? "",
        status: mapStatut(employee.statut),
      })),
    })),
  }));
}