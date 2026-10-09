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

// Envoi automatique du jeton sur chaque requête Content API
api.interceptors.request.use((config) => {
  const jwt = getStrapiJwt();
  if (jwt) {
    config.headers.set("Authorization", `Bearer ${jwt}`);
  }
  return config;
});

/**
 * Connexion à l'API Strapi (POST /api/auth/local).
 * Retourne `null` si les identifiants sont invalides ou si le backend est
 * injoignable : l'appelant bascule alors sur les comptes de démonstration.
 */
export async function strapiLogin(
  identifier: string,
  password: string
): Promise<{ jwt: string; user: StrapiAuthUser } | null> {
  try {
    const { data } = await api.post(
      "/api/auth/local",
      { identifier, password },
      { timeout: 5000 }
    );
    if (data && data.jwt && data.user) {
      setStrapiSession(data.jwt, data.user);
      return { jwt: data.jwt, user: data.user };
    }
    return null;
  } catch {
    return null;
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
  responsable?: string | null;
  beneficiaire?: string | null;
  justificatif?: string | null;
  notes?: string | null;
  observations?: string | null;
  fournisseur?: { nom?: string | null } | null;
  direction?: { nom_direction?: string | null } | null;
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
    /** Champ media `photos` de entree-ligne, peuplé seulement si le client
     *  demande `populate[...][photos]` (ou `*`). */
    photos?: Array<{ url?: string | null; documentId?: string | null }> | null;
    materiel?: {
      /** documentId de la fiche rattachée à la ligne (relation posée à la
       *  saisie après confirmation du rapprochement). */
      documentId?: string | null;
      designation?: string | null;
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
    demandeId: row.demande?.id,
    demandeur,
    beneficiaire: row.beneficiaire || "—",
    responsable: row.responsable || "—",
    statut: STATUTS_SORTIE_API[row.statut || ""] || "Demandée",
    justificatif: row.justificatif || "—",
    documents: row.justificatif
      ? [{ nom: row.justificatif, type: "Justificatif de sortie" }]
      : [],
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
        directeur?: string;
      }) => ({
        documentId: row.documentId || String(row.id),
        nom: row.nom_direction || `Direction #${row.id}`,
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

/** Comme fetchMaterials mais propage l'erreur : l'appelant peut afficher un
 *  état d'erreur explicite au lieu d'une liste vide silencieuse. */
export async function fetchMaterialsOrThrow(): Promise<MaterialOption[]> {
  const { data } = await api.get("/api/materials", {
    params: {
      "pagination[pageSize]": 200,
      sort: "designation:asc",
      // `photos` : photo de référence de la fiche — sans ce populate la
      // vignette serait toujours vide après un simple rechargement.
      populate: ["categorie", "photos"],
    },
    timeout: 5000,
  });
  return (data?.data ?? []).map((row: StrapiLigneMateriel) => mapMateriel(row));
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
