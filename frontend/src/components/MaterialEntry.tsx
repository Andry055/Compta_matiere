import { useEffect, useRef, useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookCheck,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Info,
  Loader2,
  Lock,
  Package,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { User } from "../App";
import { useCallback } from "react";
import {
  creerEntree,
  fetchEntreesDetail,
  signerEntree,
  EchecApi,
  NouvelleEntreePayload,
} from "../lib/api";
import {
  formatDelaiSync,
  marquerSync,
  useDerniereSync,
} from "../lib/lastSync";
import {
  BonLivraisonArticle,
  ControleArticle,
  EtatConstate,
  ReceptionData,
} from "../types/accounting";
import { AppRole, ROLES_CONFIG } from "../types/roles";
import {
  DENIED_ACTION_MESSAGE,
  STEP_ROLE_REQUIREMENTS,
  canPerformStepAction,
  getSessionUserName,
  guardReceptionUpdate,
  resolveActiveRole,
} from "../lib/role-access";
// Notifications « étapes » : indicateur DÉRIVÉ recalculé depuis fetchEntrees()
// (aucun stockage). lib/notifications.ts et lib/journal-store.ts ne sont plus
// référencés par ce fichier — ils restent en place pour leurs autres
// consommateurs (Journal.tsx, hors périmètre de la fusion).
import {
  NotificationEtape,
  notificationsPourRole,
} from "../lib/notificationEtapes";
import type { EntreeRecord } from "../lib/movements";

// ──────────────────────────────────────────────
// Helpers « ancrage écran ↔ entrée serveur »
// ──────────────────────────────────────────────

/** Statuts terminaux : une entrée dans cet état ne peut plus être « l'entrée
 *  en cours » de personne. */
function entreeEstTerminee(e: EntreeRecord): boolean {
  return (
    e.statutServeur === "validee" || e.statutServeur === "rejetee"
  );
}

/** L'entrée appartient-elle au dépositaire connecté ? L'affectation est fixée
 *  à la création (dérivée de la session) : username/email côté serveur, nom
 *  affiché côté écran. */
function entreeEstAuDepositaire(e: EntreeRecord, nomUtilisateur: string): boolean {
  const aff = (e.affectations?.depositaire || "").trim().toLowerCase();
  const moi = nomUtilisateur.trim().toLowerCase();
  return !!aff && !!moi && aff === moi;
}

/** Entrées en attente du rôle donné (mêmes règles que notificationEtapes.ts,
 *  hors brouillons du dépositaire qui sont traités à part). */
function entreesEnAttentePourRole(
  entrees: EntreeRecord[],
  role: AppRole
): EntreeRecord[] {
  return entrees.filter((e) => {
    if (entreeEstTerminee(e)) return false;
    if (role === "magasinier") return !e.signatures?.chefService1;
    if (role === "logistique")
      return !!e.signatures?.chefService1 && !e.signatures?.chefService2;
    if (role === "depositaire")
      return (
        !!e.signatures?.chefService1 &&
        !!e.signatures?.chefService2 &&
        !e.signatures?.depositaire
      );
    return false;
  });
}

/** Clé de signature serveur correspondant au rôle métier. */
const CLE_SIGNATURE: Partial<Record<AppRole, "chefService1" | "chefService2" | "depositaire">> = {
  magasinier: "chefService1",
  logistique: "chefService2",
  depositaire: "depositaire",
};

/** L'entrée attend-elle encore une action du rôle connecté ?
 *  Non dès que le rôle a apposé SA signature : la pièce quitte alors son onglet
 *  de traitement (elle reste consultable en lecture seule). Non plus si elle est
 *  terminée/rejetée, ou si elle est à une autre étape du circuit. */
function entreeResteATraiter(e: EntreeRecord, role: AppRole): boolean {
  if (entreeEstTerminee(e)) return false;
  const s = e.signatures ?? {};
  // Un brouillon n'existe que pour son dépositaire (saisie de l'étape 1).
  if (e.statutServeur === "brouillon") return role === "depositaire";
  switch (role) {
    case "magasinier":
      return !s.chefService1;
    case "logistique":
      return !!s.chefService1 && !s.chefService2;
    case "depositaire":
      return !!s.chefService1 && !!s.chefService2 && !s.depositaire;
    default:
      return false;
  }
}

/** Le rôle connecté a-t-il DÉJÀ traité cette entrée (signature posée) ?
 *  → elle alimente la page « Articles traités » (lecture seule), pas l'onglet
 *  de traitement. */
function entreeTraiteeParRole(e: EntreeRecord, role: AppRole): boolean {
  const cle = CLE_SIGNATURE[role];
  if (!cle) return false;
  return !!e.signatures?.[cle];
}

/** Rôle qui doit encore intervenir pour terminer une entrée en circulation —
 *  sert à expliquer POURQUOI une pièce en attente n'apparaît pas dans la file
 *  du rôle connecté (« en attente du magasinier »). */
function etapeEnAttenteDe(e: EntreeRecord): string {
  if (e.statutServeur === "brouillon") return "transmission au magasin";
  if (!e.signatures?.chefService1) return "contrôle magasinier";
  if (!e.signatures?.chefService2) return "validation logistique";
  return "validation finale du dépositaire";
}

// shadcn/ui components
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "./ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";

// ──────────────────────────────────────────────
// Types locaux
// ──────────────────────────────────────────────

interface MaterialEntryProps {
  user: User;
  /** Navigation programmatique fournie par DashboardLayout (ex. ouvrir le journal). */
  onNavigate?: (section: string) => void;
}

/** Badge du bandeau « plusieurs entrées attendent votre rôle » : couleur selon
 *  le rôle actif (les autres rôles ne passent jamais par ce bandeau). */
function bandeauRoleClasse(role: AppRole): string {
  switch (role) {
    case "magasinier":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300";
    case "logistique":
      return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300";
    default:
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  }
}

const STEP_LABELS = [
  "Bon de livraison",
  "Contrôle magasinier",
  "Validation logistique",
  "PV de réception & mise en stock",
] as const;

// Données pré-remplies pour test immédiat
const INITIAL_ARTICLES: BonLivraisonArticle[] = [
  {
    id: "art-1",
    designation: "Ordinateur portable HP ProBook 450",
    referenceNomenclature: "NOM-INFO-001",
    quantiteCommandee: 5,
    quantiteLivree: 5,
    prixUnitaire: 1_200_000,
  },
  {
    id: "art-2",
    designation: "Imprimante laser Canon LBP223dw",
    referenceNomenclature: "NOM-IMPR-002",
    quantiteCommandee: 3,
    quantiteLivree: 3,
    prixUnitaire: 850_000,
  },
  {
    id: "art-3",
    designation: "Chaise de bureau ergonomique",
    referenceNomenclature: "NOM-MOB-003",
    quantiteCommandee: 10,
    quantiteLivree: 9,
    prixUnitaire: 280_000,
  },
];

export interface ReceptionDataExtra {
  /** Vrai quand l'entrée affichée est un brouillon du dépositaire connecté
   *  (hydratation « continuez votre saisie »). */
  estBrouillon: boolean;
  /** Par ligne (clé = articleId) : l'état n'a PAS encore été constaté par le
   *  magasinier. Distinct d'un vrai constat « Neuf » — les écrans Step2 et PV
   *  affichent « Non contrôlé » au lieu du libellé par défaut. */
  etatsNonControles: Record<string, boolean>;
}

function createInitialData(withDemoArticles: boolean): ReceptionData {
  const articles = withDemoArticles ? INITIAL_ARTICLES : [];
  return {
    fournisseur: withDemoArticles ? "Établissements Rakoto & Fils" : "",
    numeroBL: withDemoArticles ? "BL-2026-0147" : "",
    dateBL: new Date().toISOString().split("T")[0],
    articles,
    observationsBL: "",
    controles: articles.map((a) => ({
      articleId: a.id,
      etat: "neuf" as EtatConstate,
      conforme: false,
      remarque: "",
    })),
    // Drapeaux de l'ancien flux local : conservés pour la compatibilité des
    // vues (les étapes réelles sont les signatures serveur), initialisés hors
    // du chemin actif. journalEntryId porte la référence serveur quand une
    // entrée est hydratée.
    magasinierCertifie: false,
    depositaireCertifie: false,
    journalEntryId: "",
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function generateArticleId() {
  return `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatAriary(value: number) {
  return value.toLocaleString("fr-MG") + " Ar";
}

const ETAT_LABELS: Record<EtatConstate, string> = {
  neuf: "Neuf",
  bon: "Bon état",
  moyen: "État moyen",
  defaillant: "Défaillant",
};

/** État non encore renseigné par le magasinier : visuellement distinct d'un
 *  vrai constat « Neuf » (risque de faux enregistrement comptable). */
const LIBELLE_NON_CONTROLE = "Non contrôlé";
const CLASSE_NON_CONTROLE =
  "bg-slate-100 text-slate-600 border border-dashed border-slate-300 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-600";

/** Messages de l'écran bloqué — un par CAUSE d'échec de lecture des entrées.
 *  (L'API renvoie 403 aussi bien quand aucun jeton n'est envoyé que quand le
 *  rôle connecté n'a pas la permission : confondre les deux en « réseau coupé »
 *  envoie l'utilisateur vers la mauvaise action.) */
const ECHECH_ENTREES_TITRE: Record<EchecApi, string> = {
  reseau: "Serveur injoignable",
  session_absente: "Session serveur absente",
  session_expiree: "Session expirée",
  acces_refuse: "Lecture des entrées refusée",
};

const ECHECH_ENTREES_DETAIL: Record<EchecApi, string> = {
  reseau:
    "Le serveur Strapi ne répond pas (réseau coupé ou service arrêté). Les données affichées ne peuvent pas être garanties à jour — réessayez.",
  session_absente:
    "Votre session n'est rattachée à aucun compte serveur : aucune demande n'atteint la base, et aucune entrée ne peut donc vous être attribuée.",
  session_expiree:
    "Votre jeton de session n'est plus valable. Reconnectez-vous pour reprendre le circuit de réception.",
  acces_refuse:
    "Votre rôle serveur n'a pas le droit de lire les entrées de réception. Utilisez un compte habilité (magasinier, chef logistique ou dépositaire).",
};

/** Libellé d'état pour la ligne donnée : « Non contrôlé » tant que le
 *  magasinier n'a rien constaté (etatAbsent), sinon le libellé réel. */
function libelleEtatLigne(
  controle: ControleArticle | undefined,
  etatAbsent: boolean
): string {
  if (etatAbsent || !controle) return LIBELLE_NON_CONTROLE;
  return ETAT_LABELS[controle.etat];
}

const ETAT_COLORS: Record<EtatConstate, string> = {
  neuf: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  bon: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  moyen:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  defaillant: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ──────────────────────────────────────────────
// StepIndicator
// ──────────────────────────────────────────────

function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: readonly string[];
}) {
  return (
    <div className="print-hidden flex items-center justify-between mb-8">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = currentStep > stepNum;
        const isCurrent = currentStep === stepNum;
        return (
          <div key={index} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? "bg-green-600 text-white shadow-md"
                    : isCurrent
                    ? "bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`mt-2 text-xs text-center max-w-[110px] hidden sm:block ${
                  isCurrent
                    ? "text-primary font-semibold"
                    : isCompleted
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-colors duration-300 ${
                  currentStep > stepNum
                    ? "bg-green-600"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// Suivi de la répartition des rôles — « chacun joue son rôle »
// ──────────────────────────────────────────────

function step1Complete(d: ReceptionData): boolean {
  return (
    d.fournisseur.trim().length > 0 &&
    d.numeroBL.trim().length > 0 &&
    d.dateBL.length > 0 &&
    d.articles.length > 0 &&
    d.articles.every(
      (a) =>
        a.designation.trim().length > 0 &&
        a.quantiteLivree > 0 &&
        a.prixUnitaire > 0
    )
  );
}

interface StepStatusRow {
  step: number;
  label: string;
  ownerRole: AppRole | null;
  state: "a_faire_vous" | "a_faire_autre" | "verrouillee" | "terminee" | "disponible";
  detail: string;
}

function getStepStatusRows(
  data: ReceptionData,
  activeRole: AppRole
): StepStatusRow[] {
  const s1 = step1Complete(data);
  const s2 = s1 && data.magasinierCertifie;
  const s3 = s2 && data.depositaireCertifie;

  const mine = (role: AppRole | null) => role !== null && role === activeRole;

  return [
    {
      step: 1,
      label: STEP_LABELS[0],
      ownerRole: "depositaire",
      state: s1 ? "terminee" : mine("depositaire") ? "a_faire_vous" : "a_faire_autre",
      detail: s1 ? `BL ${data.numeroBL} saisi` : "Saisie du BL et des articles",
    },
    {
      step: 2,
      label: STEP_LABELS[1],
      ownerRole: "magasinier",
      state: !s1
        ? "verrouillee"
        : data.magasinierCertifie
        ? "terminee"
        : mine("magasinier")
        ? "a_faire_vous"
        : "a_faire_autre",
      detail: !s1
        ? "En attente du BL"
        : data.magasinierCertifie
        ? "Réception physique certifiée"
        : "Vérification de l'état du matériel",
    },
    {
      step: 3,
      label: STEP_LABELS[2],
      ownerRole: "logistique",
      state: !s2
        ? "verrouillee"
        : data.depositaireCertifie
        ? "terminee"
        : mine("logistique")
        ? "a_faire_vous"
        : "a_faire_autre",
      detail: !s2
        ? "En attente du contrôle magasinier"
        : "Validation du circuit et visa logistique",
    },
    {
      step: 4,
      label: STEP_LABELS[3],
      ownerRole: "depositaire",
      state: !s3
        ? "verrouillee"
        : mine("depositaire")
        ? "a_faire_vous"
        : "disponible",
      detail: "Signature finale et mise en stock",
    },
  ];
}

function RoleWorkflowStatus({
  data,
  activeRole,
  currentStep,
  onGoToStep,
}: {
  data: ReceptionData;
  activeRole: AppRole;
  currentStep: number;
  onGoToStep: (step: number) => void;
}) {
  const rows = getStepStatusRows(data, activeRole);
  const activeRoleLabel = ROLES_CONFIG[activeRole].label;
  const hasAction = rows.some((r) => r.state === "a_faire_vous");
  const mine = (role: AppRole | null) => role !== null && role === activeRole;

  return (
    <Card className="print-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Circuit de réception — qui fait quoi
        </CardTitle>
        <CardDescription>
          Rôle actif : <strong>{activeRoleLabel}</strong>.{" "}
          {hasAction
            ? "Votre étape est indiquée ci-dessous."
            : "Aucune action ne vous est réservée pour le moment — consultation possible."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {rows.map((row) => {
            const isCurrent = row.step === currentStep;
            const ownerLabel = row.ownerRole
              ? ROLES_CONFIG[row.ownerRole].label
              : "Généré automatiquement";
            return (
              <button
                key={row.step}
                type="button"
                onClick={() => onGoToStep(row.step)}
                className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    row.state === "terminee"
                      ? "bg-green-600 text-white"
                      : row.state === "a_faire_vous"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {row.state === "terminee" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    row.step
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.ownerRole && (
                      <Badge
                        variant="outline"
                        className={
                          mine(row.ownerRole)
                            ? "border-primary/40 text-primary"
                            : ""
                        }
                      >
                        {ownerLabel}
                        {mine(row.ownerRole) ? " · vous" : ""}
                      </Badge>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.detail}
                  </span>
                </span>
                {row.state === "a_faire_vous" && (
                  <Badge className="bg-primary text-primary-foreground shrink-0">
                    À faire
                  </Badge>
                )}
                {row.state === "a_faire_autre" && (
                  <Badge variant="secondary" className="shrink-0">
                    En attente
                  </Badge>
                )}
                {row.state === "verrouillee" && (
                  <Badge variant="outline" className="shrink-0">
                    Verrouillée
                  </Badge>
                )}
                {row.state === "terminee" && (
                  <Badge className="bg-green-600 text-white shrink-0">
                    Terminée
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          La consultation des étapes est libre pour tous ; seules les actions
          (saisie, certifications) sont réservées au rôle propriétaire.
        </p>
      </CardContent>
    </Card>
  );
}

/** Étape d'accueil d'un rôle : la première étape sur laquelle ce rôle a une
 *  action à réaliser (ou la dernière terminée à consulter). Permet à chacun
 *  d'atterrir directement sur SON étape. */
function getRoleHomeStep(role: AppRole, data: ReceptionData): number {
  const s1 = step1Complete(data);
  switch (role) {
    case "depositaire":
      if (!s1) return 1;
      if (!data.magasinierCertifie) return 2; // attend le magasinier (lecture seule)
      return 4; // validation finale
    case "magasinier":
      if (!s1) return 1; // en attente du dépositaire (lecture seule)
      return 2;
    case "logistique":
      return 3;
    default:
      return 1;
  }
}

// ──────────────────────────────────────────────
// Bandeau « Lecture seule — en attente du rôle X »
// ──────────────────────────────────────────────

function ReadOnlyNotice({ requiredRoleLabel }: { requiredRoleLabel: string }) {
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
      <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-sm text-amber-700 dark:text-amber-300">
        Lecture seule — en attente du {requiredRoleLabel}.
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────
// Vue simplifiée MAGASINIER — il ne voit que SON onglet
// ──────────────────────────────────────────────

/** Cloche de notifications (version compacte du panneau). Étape 5 : la liste
 *  est DÉRIVÉE des entrées serveur (actions en attente pour le rôle), plus
 *  aucune lecture d'un stock « lu/non lu ». « Tout marquer lu » disparaît —
 *  un indicateur d'état se solde en AGISSANT, pas en cochant. */
function NotificationsBell({
  role,
  entrees,
  onSelectEntree,
}: {
  role: AppRole;
  entrees: EntreeRecord[] | null;
  onSelectEntree?: (entree: EntreeRecord) => void;
}) {
  const notifications = notificationsPourRole(role, entrees ?? []);
  const unread = notifications.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="print-hidden gap-2 w-fit"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          Mes notifications
          {unread > 0 && (
            <Badge className="bg-red-500 text-white px-1.5 min-w-5 h-5">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">
            En attente — {ROLES_CONFIG[role].label}
          </span>
        </div>
        <div className="max-h-72 overflow-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Aucune action en attente pour le moment.
            </div>
          ) : (
            notifications.map((n: NotificationEtape) => {
              const e = entrees?.find((ent) => ent.id === n.entreeId);
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (e && onSelectEntree) onSelectEntree(e);
                  }}
                  className={`px-3 py-2.5 border-b border-border/60 last:border-0 ${
                    onSelectEntree && e ? "hover:bg-muted/60 cursor-pointer transition-colors" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {n.type === "ecart" ? (
                      <Lock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    ) : n.type === "reception_confirmee" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.date).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Badge d'état de l'onglet du magasinier (en-tête de la vue simplifiée). */
function Step2Badge({ certified }: { certified: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        certified
          ? "border-green-500 text-green-600 dark:text-green-400"
          : "border-primary/50 text-primary"
      }
    >
      {certified ? "Certifié" : "À contrôler"}
    </Badge>
  );
}

/** Écran d'attente : aucun BL saisi par le dépositaire → rien à contrôler. */
function MagasinierLockedNotice({
  depositaireName,
}: {
  depositaireName: string;
}) {
  return (
    <Card className="print-hidden border-dashed">
      <CardContent className="py-10 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            Aucun matériel à contrôler pour le moment
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Dès que {depositaireName} saisira un bon de livraison, il
            apparaîtra ici pour votre contrôle physique à l'arrivée.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Écran de fin : contrôle certifié → l'étape 3 passe au dépositaire. */
function MagasinierDoneCard({
  numeroBL,
  onOpenJournal,
  onOpenPV,
}: {
  numeroBL: string;
  onOpenJournal: () => void;
  onOpenPV: () => void;
}) {
  return (
    <Card className="print-hidden border-green-500 bg-green-50/50 dark:bg-green-950/20">
      <CardContent className="py-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
          <PackageCheck className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            Réception certifiée — BL {numeroBL}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Vous avez contrôlé et certifié l'arrivée de ce matériel. Le
            dépositaire comptable a été notifié pour l'enregistrement au
            journal. Plus rien ne vous est réservé sur ce dossier.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button variant="outline" className="gap-2" onClick={onOpenJournal}>
            <BookCheck className="h-4 w-4" />
            Voir l'écriture au journal
          </Button>
          <Button className="gap-2" onClick={onOpenPV}>
            <FileText className="h-4 w-4" />
            PV de réception
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// ÉTAPE 1 — Bon de livraison (Dépositaire)
// ──────────────────────────────────────────────

function Step1BonLivraison({
  data,
  onChange,
  canEdit,
  requiredRoleLabel,
}: {
  data: ReceptionData;
  onChange: (d: Partial<ReceptionData>) => void;
  canEdit: boolean;
  requiredRoleLabel: string;
}) {
  const addArticle = () => {
    const newArticle: BonLivraisonArticle = {
      id: generateArticleId(),
      designation: "",
      referenceNomenclature: "",
      quantiteCommandee: 1,
      quantiteLivree: 1,
      prixUnitaire: 0,
    };
    onChange({ articles: [...data.articles, newArticle] });
  };

  const removeArticle = (id: string) => {
    onChange({ articles: data.articles.filter((a) => a.id !== id) });
  };

  const updateArticle = (
    id: string,
    field: keyof BonLivraisonArticle,
    value: string | number
  ) => {
    onChange({
      articles: data.articles.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    });
  };

  const totalBL = data.articles.reduce(
    (sum, a) => sum + a.quantiteLivree * a.prixUnitaire,
    0
  );

  const ecartsQte = data.articles.filter(
    (a) => a.quantiteCommandee > 0 && a.quantiteLivree !== a.quantiteCommandee
  );

  return (
    <div className="space-y-6">
      {!canEdit && <ReadOnlyNotice requiredRoleLabel={requiredRoleLabel} />}

      {/* Bon de livraison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Informations du Bon de Livraison
          </CardTitle>
          <CardDescription>
            Saisissez les informations du bon de livraison reçu du fournisseur
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fournisseur">Fournisseur *</Label>
              <Input
                id="fournisseur"
                value={data.fournisseur}
                onChange={(e) => onChange({ fournisseur: e.target.value })}
                placeholder="Nom du fournisseur"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numeroBL">N° Bon de livraison *</Label>
              <Input
                id="numeroBL"
                value={data.numeroBL}
                onChange={(e) => onChange({ numeroBL: e.target.value })}
                placeholder="BL-2026-001"
                className="font-mono"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateBL">Date du BL *</Label>
              <Input
                id="dateBL"
                type="date"
                value={data.dateBL}
                onChange={(e) => onChange({ dateBL: e.target.value })}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="observationsBL">Observations générales</Label>
            <Textarea
              id="observationsBL"
              value={data.observationsBL}
              onChange={(e) => onChange({ observationsBL: e.target.value })}
              placeholder="Remarques sur la livraison..."
              rows={2}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tableau d'articles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Articles livrés
              </CardTitle>
              <CardDescription>
                {data.articles.length} article(s) — Valeur totale :{" "}
                <span className="font-semibold text-primary">
                  {formatAriary(totalBL)}
                </span>
              </CardDescription>
            </div>
            {canEdit && (
              <Button onClick={addArticle} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Ajouter
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ecartsQte.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {ecartsQte.length} écart(s) de quantité détecté(s) (commandé ≠ livré)
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  La quantité livrée diffère de la quantité initialement commandée. Ces écarts seront tracés dans les observations comptables et les mouvements de stock.
                </p>
              </div>
            </div>
          )}

          {data.articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun article. Cliquez sur « Ajouter » pour commencer.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%]">Désignation</TableHead>
                      <TableHead>Réf. Nomenclature</TableHead>
                      <TableHead className="text-right">Qté cmd.</TableHead>
                      <TableHead className="text-right">Qté livrée</TableHead>
                      <TableHead className="text-right">Prix unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.articles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell>
                          <Input
                            value={article.designation}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "designation",
                                e.target.value
                              )
                            }
                            placeholder="Désignation"
                            className="h-8 text-sm"
                            disabled={!canEdit}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={article.referenceNomenclature}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "referenceNomenclature",
                                e.target.value
                              )
                            }
                            placeholder="NOM-XXX-000"
                            className="h-8 text-sm font-mono"
                            disabled={!canEdit}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={article.quantiteCommandee}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "quantiteCommandee",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm text-right w-20"
                            disabled={!canEdit}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="number"
                            min={0}
                            value={article.quantiteLivree}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "quantiteLivree",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm text-right w-20"
                            disabled={!canEdit}
                          />
                          {article.quantiteCommandee > 0 &&
                            article.quantiteLivree !== article.quantiteCommandee && (
                              <span
                                className={`block text-[11px] text-right font-medium mt-1 ${
                                  article.quantiteLivree < article.quantiteCommandee
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {article.quantiteLivree < article.quantiteCommandee
                                  ? `Manque ${article.quantiteCommandee - article.quantiteLivree}`
                                  : `Surplus +${article.quantiteLivree - article.quantiteCommandee}`}
                              </span>
                            )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={article.prixUnitaire}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "prixUnitaire",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm text-right w-28"
                            disabled={!canEdit}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatAriary(
                            article.quantiteLivree * article.prixUnitaire
                          )}
                        </TableCell>
                        <TableCell>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeArticle(article.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatAriary(totalBL)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {data.articles.map((article, index) => (
                  <Card key={article.id} className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Article {index + 1}
                      </span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArticle(article.id)}
                          className="h-6 w-6 text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={article.designation}
                        onChange={(e) =>
                          updateArticle(article.id, "designation", e.target.value)
                        }
                        placeholder="Désignation"
                        className="h-8 text-sm"
                        disabled={!canEdit}
                      />
                      <Input
                        value={article.referenceNomenclature}
                        onChange={(e) =>
                          updateArticle(
                            article.id,
                            "referenceNomenclature",
                            e.target.value
                          )
                        }
                        placeholder="Réf. nomenclature"
                        className="h-8 text-sm font-mono"
                        disabled={!canEdit}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Qté cmd.</Label>
                          <Input
                            type="number"
                            value={article.quantiteCommandee}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "quantiteCommandee",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm"
                            disabled={!canEdit}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Qté livrée</Label>
                          <Input
                            type="number"
                            value={article.quantiteLivree}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "quantiteLivree",
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm"
                            disabled={!canEdit}
                          />
                          {article.quantiteCommandee > 0 &&
                            article.quantiteLivree !== article.quantiteCommandee && (
                              <span
                                className={`block text-[10px] font-medium mt-0.5 ${
                                  article.quantiteLivree < article.quantiteCommandee
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-blue-600 dark:text-blue-400"
                                }`}
                              >
                                {article.quantiteLivree < article.quantiteCommandee
                                  ? `Manque ${article.quantiteCommandee - article.quantiteLivree}`
                                  : `Surplus +${article.quantiteLivree - article.quantiteCommandee}`}
                              </span>
                            )}
                        </div>
                        <div>
                          <Label className="text-xs">Prix unit.</Label>
                          <Input
                            type="number"
                            value={article.prixUnitaire}
                            onChange={(e) =>
                              updateArticle(
                                article.id,
                                "prixUnitaire",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 text-sm"
                            disabled={!canEdit}
                          />
                        </div>
                      </div>
                      <div className="text-right text-sm font-medium text-primary">
                        {formatAriary(
                          article.quantiteLivree * article.prixUnitaire
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// Capture photo du matériel (contrôle magasinier)
// ──────────────────────────────────────────────

/** Redimensionne/comprime une image (Data URL) avant stockage : max 800px,
 *  qualité JPEG 0.7 — les Data URLs restent légères pour le localStorage. */
function compressImageFile(file: File, maxDim = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas non disponible"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Fichier illisible"));
    reader.readAsDataURL(file);
  });
}

/** Capture/attachement de photos par article lors du contrôle physique.
 *  Caméra arrière sur mobile (capture="environment"), sinon fichier. */
function PhotoCapture({
  photos,
  onAdd,
  onRemove,
  disabled,
}: {
  photos?: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await compressImageFile(file);
        onAdd(dataUrl);
        await new Promise((r) => setTimeout(r, 50));
      }
    } catch {
      toast.error("Impossible de traiter la photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 h-8"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-4 w-4" />
          {busy ? "Traitement..." : "Prendre une photo"}
        </Button>
        {photos && photos.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {photos.length} photo(s)
          </Badge>
        )}
      </div>
      {photos && photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative group">
              <img
                src={p}
                alt={`Photo ${i + 1}`}
                className="h-16 w-16 object-cover rounded-md border"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Supprimer la photo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Step2ControleMagasinier({
  data,
  extra,
  onChange,
  canEdit,
  requiredRoleLabel,
  depositaireName,
  articlesIncomplets,
  certifying,
}: {
  data: ReceptionData;
  extra: ReceptionDataExtra;
  onChange: (d: Partial<ReceptionData>) => void;
  canEdit: boolean;
  requiredRoleLabel: string;
  depositaireName: string;
  /** Articles dont l'état n'a pas été renseigné — mis en évidence. */
  articlesIncomplets?: Set<string>;
  /** Signature serveur en cours (le bouton est déjà désactivé côté appelant). */
  certifying?: boolean;
}) {
  // Seuls les contrôles (état/conformité) sont éditables ici — le bon de
  // livraison et les articles restent en lecture seule (saisis par le
  // dépositaire). Toute écriture est refusée par le garde logique si le rôle
  // actif n'est pas Magasinier.
  const updateControle = (
    articleId: string,
    field: "etat" | "conforme",
    value: EtatConstate | boolean
  ) => {
    onChange({
      controles: data.controles.map((c) =>
        c.articleId === articleId ? { ...c, [field]: value } : c
      ),
    });
  };

  const reservesCount = data.controles.filter(
    (c) => !c.conforme || c.etat === "defaillant"
  ).length;

  const missingRemarks = data.controles.filter(
    (c) => (!c.conforme || c.etat === "defaillant") && !c.remarque.trim()
  ).length;

  return (
    <div className="space-y-6">
      {!canEdit && <ReadOnlyNotice requiredRoleLabel={requiredRoleLabel} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Contrôle physique des articles
          </CardTitle>
          <CardDescription>
            Bon de livraison saisi par {depositaireName} —{" "}
            <span className="font-mono">{data.numeroBL}</span> (
            {data.fournisseur}). Vérifiez l'état et la conformité de chaque article livré.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.articles.map((article, index) => {
            const controle = data.controles.find(
              (c) => c.articleId === article.id
            );
            if (!controle) return null;
            const hasIssue = !controle.conforme || controle.etat === "defaillant";

            const isControleManquant = articlesIncomplets?.has(article.id) ?? false;
            return (
              <div key={article.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div
                  className={`space-y-3 rounded-lg p-2 -m-2 transition-colors ${
                    isControleManquant
                      ? "ring-2 ring-destructive/60 bg-destructive/5"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {article.designation}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        {article.referenceNomenclature} — Qté livrée :{" "}
                        <span className="font-semibold text-foreground">
                          {article.quantiteLivree}
                        </span>
                        {article.quantiteCommandee > 0 &&
                          article.quantiteLivree !== article.quantiteCommandee && (
                            <span className="ml-2 font-sans font-medium text-amber-600 dark:text-amber-400">
                              (Cmd : {article.quantiteCommandee} —{" "}
                              {article.quantiteLivree < article.quantiteCommandee
                                ? `Manque ${article.quantiteCommandee - article.quantiteLivree}`
                                : `Surplus +${article.quantiteLivree - article.quantiteCommandee}`}
                              )
                            </span>
                          )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isControleManquant && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          État requis
                        </Badge>
                      )}
                      {hasIssue && (
                        <Badge variant="destructive" className="gap-1 text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Réserve
                        </Badge>
                      )}
                      <Badge
                        className={
                          controle.conforme
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {controle.conforme ? "Conforme" : "Non conforme"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>État constaté</Label>
                      <Select
                        value={
                          extra.etatsNonControles[article.id]
                            ? ""
                            : controle.etat
                        }
                        onValueChange={(val) =>
                          updateControle(
                            article.id,
                            "etat",
                            val as EtatConstate
                          )
                        }
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-9">
                          {/* Vide tant que rien n'a été constaté : distinct
                              d'un vrai choix « Neuf ». */}
                          <SelectValue placeholder={LIBELLE_NON_CONTROLE} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="neuf">Neuf</SelectItem>
                          <SelectItem value="bon">Bon état</SelectItem>
                          <SelectItem value="moyen">État moyen</SelectItem>
                          <SelectItem value="defaillant">Défaillant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Remarque</Label>
                        {hasIssue && (
                          <span className="text-[11px] font-medium text-destructive">
                            * Motif requis
                          </span>
                        )}
                      </div>
                      <Input
                        value={controle.remarque}
                        onChange={(e) =>
                          onChange({
                            controles: data.controles.map((c) =>
                              c.articleId === article.id
                                ? { ...c, remarque: e.target.value }
                                : c
                            ),
                          })
                        }
                        placeholder={
                          hasIssue
                            ? "Préciser impérativement la réserve..."
                            : "Optionnel..."
                        }
                        className={`h-9 ${
                          hasIssue && !controle.remarque.trim()
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }`}
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`conforme-${article.id}`}
                          checked={controle.conforme}
                          onCheckedChange={(checked) =>
                            updateControle(
                              article.id,
                              "conforme",
                              checked === true
                            )
                          }
                          disabled={!canEdit}
                        />
                        <Label
                          htmlFor={`conforme-${article.id}`}
                          className="text-sm cursor-pointer"
                        >
                          Conforme
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Preuves photographiques de l'article (magasinier) */}
                  <div className="pt-1 border-t border-border/60">
                    <Label className="text-xs text-muted-foreground">
                      Photos du matériel (preuves à l'arrivée)
                    </Label>
                    <PhotoCapture
                      photos={controle.photos}
                      onAdd={(dataUrl) =>
                        onChange({
                          controles: data.controles.map((c) =>
                            c.articleId === article.id
                              ? { ...c, photos: [...(c.photos ?? []), dataUrl] }
                              : c
                          ),
                        })
                      }
                      onRemove={(idx) =>
                        onChange({
                          controles: data.controles.map((c) =>
                            c.articleId === article.id
                              ? {
                                  ...c,
                                  photos: (c.photos ?? []).filter(
                                    (_, i) => i !== idx
                                  ),
                                }
                              : c
                          ),
                        })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Alerte sur les réserves constatées */}
      {reservesCount > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-amber-800 dark:text-amber-300 space-y-1">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {reservesCount} article(s) signalé(s) avec réserve ou non conforme(s)
            </span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {missingRemarks > 0
              ? `⚠️ Une remarque explicative est obligatoire pour les ${missingRemarks} article(s) concerné(s) avant de pouvoir certifier la réception.`
              : "Tous les motifs de réserves ont été renseignés. Vous pouvez certifier la réception physique avec réserves."}
          </p>
        </div>
      )}

      {/* Certification du magasinier */}
      <Card
        className={`transition-all duration-300 ${
          data.magasinierCertifie
            ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
            : "border-orange-300 dark:border-orange-700"
        }`}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="certification-magasinier"
              checked={data.magasinierCertifie}
              onCheckedChange={(checked) =>
                onChange({ magasinierCertifie: checked === true })
              }
              disabled={!canEdit || missingRemarks > 0}
              className="mt-0.5"
            />
            <div>
              <Label
                htmlFor="certification-magasinier"
                className="text-sm font-semibold cursor-pointer"
              >
                Le magasinier certifie la réception physique
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                En cochant cette case, je certifie avoir vérifié physiquement
                l'état et la quantité de chaque article livré, à partir du bon
                de livraison saisi par {depositaireName}.
              </p>
              {missingRemarks > 0 && (
                <p className="text-xs text-destructive mt-1 font-medium">
                  Remplissez le motif pour chaque article en réserve pour activer la certification.
                </p>
              )}
              {!canEdit && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Étape réservée au {requiredRoleLabel}.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Case de certification du dépositaire (« Le dépositaire certifie
 *  l'enregistrement »).
 *
 *  Extraite de Step3EnregistrementDepositaire — composant qui n'est plus rendu
 *  nulle part depuis que l'étape 3 est devenue la signature logistique — pour
 *  être affichée à l'étape 4, SEUL endroit où elle est atteignable : c'est la
 *  case que `canProceed` (étape 4) exige avant d'autoriser le bouton
 *  « Signer la validation finale ». Sans elle, `depositaireCertifie` ne pouvait
 *  jamais passer à true et la signature finale restait bloquée à jamais.
 *  L'écriture de l'état passe toujours par `onChange({ depositaireCertifie })`
 *  (guardé par role-access : champ protégé à l'étape 4, donc dépositaire seul). */
function CertificationDepositaireCard({
  certifie,
  onCertifie,
  canEdit,
  requiredRoleLabel,
  className = "",
}: {
  certifie: boolean;
  onCertifie: (v: boolean) => void;
  canEdit: boolean;
  requiredRoleLabel: string;
  className?: string;
}) {
  return (
    <Card
      className={`transition-all duration-300 ${className} ${
        certifie
          ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          : "border-orange-300 dark:border-orange-700"
      }`}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <Checkbox
            id="certification-depositaire"
            checked={certifie}
            onCheckedChange={(checked) => onCertifie(checked === true)}
            disabled={!canEdit}
            className="mt-0.5"
          />
          <div>
            <Label
              htmlFor="certification-depositaire"
              className="text-sm font-semibold cursor-pointer"
            >
              Le dépositaire certifie l&apos;enregistrement
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              En cochant cette case, je certifie que l&apos;écriture du PV
              ci-dessus est conforme au bon de livraison et peut être
              enregistrée au journal de comptabilité matière.
            </p>
            {!canEdit && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Étape réservée au {requiredRoleLabel}.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────
// ÉTAPE 3 — Enregistrement dépositaire (composant
// non rendu — conservé pour la trace de l'ancien
// circuit ; la case de certification vit désormais
// dans CertificationDepositaireCard, affichée à
// l'étape 4).
// ──────────────────────────────────────────────

function Step3EnregistrementDepositaire({
  data,
  onChange,
  canEdit,
  requiredRoleLabel,
}: {
  data: ReceptionData;
  onChange: (d: Partial<ReceptionData>) => void;
  canEdit: boolean;
  requiredRoleLabel: string;
}) {
  const totalValeur = data.articles.reduce(
    (sum, a) => sum + a.quantiteLivree * a.prixUnitaire,
    0
  );

  const conformesCount = data.controles.filter(
    (c) => c.conforme && c.etat !== "defaillant"
  ).length;

  // Strictement les articles ayant une réserve réelle (non conforme ou défaillant)
  const articlesAvecReserves = data.controles.filter(
    (c) => !c.conforme || c.etat === "defaillant"
  );

  // Remarques informatives sur articles conformes (ex: "c'est bon", "emballage intact")
  const observationsArticlesConformes = data.controles.filter(
    (c) => c.conforme && c.etat !== "defaillant" && c.remarque.trim().length > 0
  );

  const ecartsQte = data.articles.filter(
    (a) => a.quantiteCommandee > 0 && a.quantiteLivree !== a.quantiteCommandee
  );

  return (
    <div className="space-y-6">
      {!canEdit && <ReadOnlyNotice requiredRoleLabel={requiredRoleLabel} />}

      {/* Synthèse du contrôle physique effectué par le magasinier */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base">
                Synthèse du contrôle physique (Magasinier)
              </CardTitle>
            </div>
            <Badge
              className={
                data.magasinierCertifie
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              }
            >
              {data.magasinierCertifie
                ? "Certifié par le magasinier"
                : "En attente de certification"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="p-2.5 rounded bg-muted/60">
              <span className="text-xs text-muted-foreground block">
                Articles conformes
              </span>
              <span className="text-base font-semibold text-green-600 dark:text-green-400">
                {conformesCount} / {data.articles.length}
              </span>
            </div>
            <div className="p-2.5 rounded bg-muted/60">
              <span className="text-xs text-muted-foreground block">
                Articles avec réserve(s)
              </span>
              <span
                className={`text-base font-semibold ${
                  articlesAvecReserves.length > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {articlesAvecReserves.length}
              </span>
            </div>
            <div className="p-2.5 rounded bg-muted/60">
              <span className="text-xs text-muted-foreground block">
                Écarts de quantité
              </span>
              <span
                className={`text-base font-semibold ${
                  ecartsQte.length > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                }`}
              >
                {ecartsQte.length}
              </span>
            </div>
          </div>

          {/* Réserves réelles (anomalies ou défauts) */}
          {articlesAvecReserves.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Réserves émises par le magasinier ({articlesAvecReserves.length}) :
              </p>
              <div className="space-y-1.5">
                {articlesAvecReserves.map((c) => {
                  const art = data.articles.find((a) => a.id === c.articleId);
                  return (
                    <div
                      key={c.articleId}
                      className="text-xs p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div>
                        <span className="font-semibold text-destructive">
                          {art?.designation || "Article"} :
                        </span>{" "}
                        <span>{c.remarque || "(Aucun motif saisi)"}</span>
                      </div>
                      <Badge
                        variant="destructive"
                        className="text-[10px] shrink-0 self-start sm:self-auto"
                      >
                        État : {ETAT_LABELS[c.etat]} — Non conforme
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observations sur articles conformes (notes informatives) */}
          {observationsArticlesConformes.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                Remarques du magasinier sur les articles conformes :
              </p>
              <div className="space-y-1.5">
                {observationsArticlesConformes.map((c) => {
                  const art = data.articles.find((a) => a.id === c.articleId);
                  return (
                    <div
                      key={c.articleId}
                      className="text-xs p-2.5 rounded-lg bg-muted/60 border border-border text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div>
                        <span className="font-semibold text-foreground">
                          {art?.designation || "Article"} :
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {c.remarque}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 self-start sm:self-auto text-muted-foreground border-border"
                      >
                        État : {ETAT_LABELS[c.etat]} — Conforme
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
            <PackageCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              La validation de cette étape créera automatiquement les entrées correspondantes dans le grand livre des mouvements de stock.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Écriture au journal comptable
          </CardTitle>
          <CardDescription>
            Aperçu en lecture seule de l'écriture qui sera générée dans le
            journal de comptabilité matière
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Metadata */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                N° d'écriture
              </Label>
              <div className="text-sm font-mono font-semibold text-primary bg-primary/5 px-3 py-2 rounded-md border">
                {data.journalEntryId}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Pièce justificative
              </Label>
              <div className="text-sm font-mono px-3 py-2 rounded-md border bg-muted">
                {data.numeroBL || "—"}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <div className="text-sm px-3 py-2 rounded-md border bg-muted">
                {data.dateBL || "—"}
              </div>
            </div>
          </div>

          <Separator />

          {/* Détails des articles */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead>Réf. Nomenclature</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead className="text-right">Prix unit.</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell className="font-medium">
                    {article.designation}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {article.referenceNomenclature}
                  </TableCell>
                  <TableCell className="text-right">
                    {article.quantiteLivree}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAriary(article.prixUnitaire)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatAriary(
                      article.quantiteLivree * article.prixUnitaire
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">
                  Valeur totale de l'écriture
                </TableCell>
                <TableCell className="text-right font-bold text-primary text-base">
                  {formatAriary(totalValeur)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>

          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <strong>Origine :</strong> Fournisseur — {data.fournisseur || "—"}
          </div>
        </CardContent>
      </Card>

      {/* Certification du dépositaire */}
      <CertificationDepositaireCard
        certifie={data.depositaireCertifie}
        onCertifie={(v) => onChange({ depositaireCertifie: v })}
        canEdit={canEdit}
        requiredRoleLabel={requiredRoleLabel}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// ÉTAPE 4 — PV de réception
// ──────────────────────────────────────────────

function Step4PVReception({
  data,
  extra,
  entreeServeur,
  magasinierName,
  depositaireName,
  logistiqueName,
  onOpenJournal,
  onChange,
  canEditCertification,
  requiredRoleLabel,
}: {
  data: ReceptionData;
  extra: ReceptionDataExtra;
  entreeServeur: EntreeRecord | null;
  magasinierName: string;
  depositaireName: string;
  logistiqueName: string;
  onOpenJournal: () => void;
  onChange: (d: Partial<ReceptionData>) => void;
  canEditCertification: boolean;
  requiredRoleLabel: string;
}) {
  const totalValeur = data.articles.reduce(
    (sum, a) => sum + a.quantiteLivree * a.prixUnitaire,
    0
  );

  // État RÉEL de la signature finale du dépositaire (source : l'entrée serveur,
  // pas l'horloge d'affichage). Tant qu'elle n'est pas posée, le PV affiche un
  // statut « en attente » — il annonçait « Enregistrement certifié » en vert
  // AVANT toute signature, incohérent avec le bouton de signature qui restait
  // juste en dessous.
  const signatureDepositaire = entreeServeur?.signatures?.depositaire;

  /** Carte de signature du PV : statut ET date issus de la seule source de
   *  vérité (l'entrée serveur). Aucune carte n'affiche plus « certifié » ni une
   *  date inventée tant que la signature n'est pas réellement posée. */
  const CarteSignature = ({
    titre,
    signataire,
    date,
    libelleSigne,
  }: {
    titre: string;
    signataire: string;
    date?: string;
    libelleSigne: string;
  }) => {
    const signe = Boolean(date);
    return (
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-center">{titre}</h4>
        <div
          className={`flex items-center justify-center gap-2 ${
            signe
              ? "text-green-600 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {signe ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <Clock className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">
            {signe ? libelleSigne : "En attente de signature"}
          </span>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {signataire}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          {signe && date ? formatDateTime(date) : "—"}
        </div>
      </div>
    );
  };
  // L'entrée serveur liée (passée par le parent) remplace les recherches dans
  // les stores locaux (journal/mouvements) — supprimés à l'Étape 6.
  const entreeLiee = entreeServeur;
  const now = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print button — hidden when printing */}
      <div className="print-hidden flex justify-end">
        <Button onClick={handlePrint} size="lg" className="gap-2">
          <Printer className="h-4 w-4" />
          Imprimer le PV
        </Button>
      </div>

      {/* PV Document */}
      <div id="pv-reception-document" className="print-area">
        <Card className="print:shadow-none print:border-black">
          <CardHeader className="text-center pb-2">
            <div className="text-xs text-muted-foreground mb-2 print:text-black">
              RÉPUBLIQUE DE MADAGASCAR
            </div>
            <CardTitle className="text-xl">
              PROCÈS-VERBAL DE RÉCEPTION
            </CardTitle>
            <CardDescription className="text-base font-medium mt-2 print:text-black">
              Réception de matériel — Comptabilité matière
            </CardDescription>
            <Separator className="mt-4" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Infos BL */}
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <span className="text-muted-foreground print:text-gray-600">
                  Fournisseur :
                </span>
                <div className="font-semibold">{data.fournisseur}</div>
              </div>
              <div>
                <span className="text-muted-foreground print:text-gray-600">
                  N° Bon de livraison :
                </span>
                <div className="font-semibold font-mono">{data.numeroBL}</div>
              </div>
              <div>
                <span className="text-muted-foreground print:text-gray-600">
                  Date du BL :
                </span>
                <div className="font-semibold">{data.dateBL}</div>
              </div>
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground print:text-gray-600">
                N° d'écriture journal :
              </span>{" "}
              <span className="font-semibold font-mono">
                {data.journalEntryId}
              </span>
            </div>

            <Separator />

            {/* Tableau des articles avec état */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Réf.</TableHead>
                  <TableHead className="text-right">Qté cmd.</TableHead>
                  <TableHead className="text-right">Qté livrée</TableHead>
                  <TableHead className="text-right">P.U.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>État constaté</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.articles.map((article, index) => {
                  const controle = data.controles.find(
                    (c) => c.articleId === article.id
                  );
                  return (
                    <TableRow key={article.id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {article.designation}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {article.referenceNomenclature}
                      </TableCell>
                      <TableCell className="text-right">
                        {article.quantiteCommandee}
                      </TableCell>
                      <TableCell className="text-right">
                        {article.quantiteLivree}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAriary(article.prixUnitaire)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatAriary(
                          article.quantiteLivree * article.prixUnitaire
                        )}
                      </TableCell>
                      <TableCell>
                        {controle &&
                          (extra.etatsNonControles[article.id] ? (
                            <Badge
                              variant="secondary"
                              className={CLASSE_NON_CONTROLE}
                            >
                              {LIBELLE_NON_CONTROLE}
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className={ETAT_COLORS[controle.etat]}
                            >
                              {ETAT_LABELS[controle.etat]}
                            </Badge>
                          ))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-right font-semibold"
                  >
                    TOTAL GÉNÉRAL
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary text-base">
                    {formatAriary(totalValeur)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>

            {data.observationsBL && (
              <div className="text-sm p-3 bg-muted/50 rounded-lg print:bg-gray-50 print:border">
                <strong>Observations :</strong> {data.observationsBL}
              </div>
            )}

            {/* Preuves photographiques du contrôle magasinier */}
            {(() => {
              const articlesWithPhotos = data.articles
                .map((a) => ({
                  article: a,
                  photos: data.controles.find((c) => c.articleId === a.id)?.photos ?? [],
                }))
                .filter((x) => x.photos.length > 0);
              if (articlesWithPhotos.length === 0) return null;
              return (
                <div className="space-y-2">
                  <Separator />
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    Preuves photographiques — contrôle magasinier
                  </h4>
                  {articlesWithPhotos.map(({ article, photos }) => (
                    <div key={article.id} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {article.designation} ({photos.length} photo(s))
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {photos.map((p, i) => (
                          <img
                            key={i}
                            src={p}
                            alt={`${article.designation} — photo ${i + 1}`}
                            className="h-20 w-20 object-cover rounded border print:h-24 print:w-24"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <Separator />

            {/* Signatures — les 3 signatures du circuit serveur, dans l'ordre
                réel (magasinier → logistique → dépositaire). La carte
                « Logistique » manquait : la 2ᵉ signature obligatoire n'était
                visible nulle part dans le PV. */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
              <CarteSignature
                titre="Le Magasinier"
                signataire={
                  entreeServeur?.signataires?.chefService1 || magasinierName
                }
                date={entreeServeur?.signatures?.chefService1}
                libelleSigne="Réception certifiée"
              />
              <CarteSignature
                titre="La Logistique"
                signataire={
                  entreeServeur?.signataires?.chefService2 || logistiqueName
                }
                date={entreeServeur?.signatures?.chefService2}
                libelleSigne="Circuit validé"
              />
              <CarteSignature
                titre="Le Dépositaire Comptable"
                signataire={
                  entreeServeur?.signataires?.depositaire || depositaireName
                }
                date={signatureDepositaire}
                libelleSigne="Enregistrement certifié"
              />
            </div>
          </CardContent>
          <CardFooter className="text-center text-xs text-muted-foreground print:text-gray-500">
            <div className="w-full text-center">
              Document généré le {now} — ComptaMatière © {new Date().getFullYear()}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Lien vers l'entrée en base (l'écriture locale au journal et les
          mouvements locaux ne sont plus générés par ce flux — la vérité est
          l'entrée serveur, cf. bandeau en haut d'écran). */}
      {entreeLiee && (
        <Card className="print-hidden border-primary/30 bg-primary/5">
          <CardContent className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span>
                Entrée{" "}
                <span className="font-mono font-semibold">
                  {entreeLiee.reference}
                </span>{" "}
                suivie dans le circuit serveur (3 signatures).
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenJournal}>
              Voir dans le journal
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stock impacté (Étape 4) : vérité serveur — l'entrée validée a
          déclenché l'incrémentation côté backend, sans recalcul écran. */}
      {entreeLiee?.statutServeur === "validee" && (
        <Card className="print-hidden border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-emerald-900 dark:text-emerald-300">
              <PackageCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Stock mis à jour</strong> par le serveur à la validation
                de l'entrée{" "}
                <span className="font-mono font-semibold">{entreeLiee.reference}</span>.
              </span>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 self-start sm:self-auto">
              Stock incrémenté
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Certification du dépositaire — ACTION de l'étape 4, hors du document
          imprimé : c'est la case que l'écran exige avant d'activer le bouton
          « Signer la validation finale » (canProceed, étape 4). Placée après le
          PV et juste avant ce bouton. */}
      <CertificationDepositaireCard
        className="print-hidden"
        certifie={data.depositaireCertifie}
        onCertifie={(v) => onChange({ depositaireCertifie: v })}
        canEdit={canEditCertification}
        requiredRoleLabel={requiredRoleLabel}
      />

      {/* Print-specific CSS */}
      <style>{`
        @media print {
          /* Hide everything except the PV */
          body * {
            visibility: hidden;
          }
          #pv-reception-document,
          #pv-reception-document * {
            visibility: visible;
          }
          #pv-reception-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          /* Hide non-print elements */
          .print-hidden {
            display: none !important;
          }
          /* Reset card styles for print */
          .print\\\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\\\:border-black {
            border-color: black !important;
          }
          /* Ensure dark mode doesn't affect print */
          * {
            color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: 1.5cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}

/** Badge d'état de l'onglet du dépositaire (en-tête de la vue simplifiée). */
function DepositaireBadge({ currentStep }: { currentStep: number }) {
  const config =
    currentStep === 1
      ? { label: "À saisir", className: "border-primary/50 text-primary" }
      : currentStep === 2
      ? {
          label: "En attente magasinier",
          className:
            "border-amber-500 text-amber-600 dark:text-amber-400",
        }
      : currentStep === 3
      ? { label: "À enregistrer", className: "border-primary/50 text-primary" }
 : {
          label: "Terminé",
          className:
            "border-green-500 text-green-600 dark:text-green-400",
        };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

/** Écran d'attente du dépositaire : BL transmis, le magasinier doit certifier
 *  la réception physique avant l'enregistrement au journal. */
function DepositaireWaitingCard({
  numeroBL,
  magasinierName,
  onEditBL,
}: {
  numeroBL: string;
  magasinierName: string;
  onEditBL: () => void;
}) {
  return (
    <Card className="print-hidden">
      <CardContent className="py-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <ClipboardCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            BL {numeroBL} transmis — en attente du magasinier
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {magasinierName} doit contrôler l'état du matériel et certifier la
            réception physique. Vous serez notifié dès que ce sera fait, pour
            procéder à l'enregistrement au journal.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onEditBL}>
          Modifier le BL
        </Button>
      </CardContent>
    </Card>
  );
}

/** Étape 3 — carte d'attente pour les rôles non logistique (ex. dépositaire) :
 *  aucun bouton actif, simple état « en attente de la logistique ». La
 *  signature serveur posée à cette étape est chef_service_2 ; le libellé
 *  affiché de l'étape reste inchangé (dette UX notée, hors périmètre). */
function Step3WaitingLogistique({
  numeroBL,
  logistiqueName,
}: {
  numeroBL: string;
  logistiqueName: string;
}) {
  return (
    <Card className="print-hidden border-dashed">
      <CardContent className="py-10 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-medium text-foreground">
            BL {numeroBL} — en attente de la logistique
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {logistiqueName} doit apposer la 2ᵉ signature (chef de service 2) avant la validation finale. Aucune action ne vous est réservée sur cette étape.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Étape 3 — Vue dédiée du logistique (chef de service 2).
 *  Affiche la synthèse du contrôle magasinier et une case de validation
 *  propre au logistique. NE PAS confondre avec Step3EnregistrementDepositaire
 *  qui contient la case "Le dépositaire certifie l'enregistrement" — cette
 *  case ne doit jamais être accessible au logistique. */
function Step3SignatureLogistique({
  data,
  logistiqueCertifie,
  onCertifier,
  certifying,
}: {
  data: ReceptionData;
  logistiqueCertifie: boolean;
  onCertifier: (v: boolean) => void;
  certifying?: boolean;
}) {
  // Le badge reflète l'ÉTAT RÉEL de la signature magasinier : il était écrit en
  // dur (« Certifié par le magasinier ») et s'affichait même sans certification.
  const magasinierCertifie = data.magasinierCertifie;
  const conformesCount = data.controles.filter(
    (c) => c.conforme && c.etat !== "defaillant"
  ).length;
  const articlesAvecReserves = data.controles.filter(
    (c) => !c.conforme || c.etat === "defaillant"
  );
  const ecartsQte = data.articles.filter(
    (a) => a.quantiteCommandee > 0 && a.quantiteLivree !== a.quantiteCommandee
  );
  const totalValeur = data.articles.reduce(
    (sum, a) => sum + a.quantiteLivree * a.prixUnitaire,
    0
  );

  return (
    <div className="space-y-6">
      {/* En-tête logistique */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20">
        <ClipboardCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
        <span className="text-sm text-cyan-700 dark:text-cyan-300">
          <strong>Étape logistique</strong> — Vérifiez que le circuit a été respecté et apposez votre signature (2ᵉ sur 3).
        </span>
      </div>

      {/* Synthèse du contrôle magasinier */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base">
                Synthèse du contrôle physique (Magasinier)
              </CardTitle>
            </div>
            <Badge
              className={
                magasinierCertifie
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              }
            >
              {magasinierCertifie
                ? "Certifié par le magasinier"
                : "En attente du magasinier"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="p-2.5 rounded bg-muted/60">
              <span className="text-xs text-muted-foreground block">Articles conformes</span>
              <span className="text-base font-semibold text-green-600 dark:text-green-400">
                {conformesCount} / {data.articles.length}
              </span>
            </div>
            <div className="p-2.5 rounded bg-muted/60">
              <span className="text-xs text-muted-foreground block">Articles avec réserve(s)</span>
              <span className={`text-base font-semibold ${articlesAvecReserves.length > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {articlesAvecReserves.length}
              </span>
            </div>
            <div className="p-2.5 rounded bg-muted/60">
              <span className="text-xs text-muted-foreground block">Écarts de quantité</span>
              <span className={`text-base font-semibold ${ecartsQte.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {ecartsQte.length}
              </span>
            </div>
          </div>

          {articlesAvecReserves.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Réserves émises par le magasinier ({articlesAvecReserves.length}) :
              </p>
              <div className="space-y-1.5">
                {articlesAvecReserves.map((c) => {
                  const art = data.articles.find((a) => a.id === c.articleId);
                  return (
                    <div
                      key={c.articleId}
                      className="text-xs p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div>
                        <span className="font-semibold text-destructive">{art?.designation || "Article"} :</span>{" "}
                        <span>{c.remarque || "(Aucun motif saisi)"}</span>
                      </div>
                      <Badge variant="destructive" className="text-[10px] shrink-0 self-start sm:self-auto">
                        État : {ETAT_LABELS[c.etat]} — Non conforme
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-sm">
            <span className="text-muted-foreground">Valeur totale de l'entrée :</span>
            <span className="font-semibold text-primary">{formatAriary(totalValeur)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Case de certification logistique — propre à ce rôle */}
      <Card className={`transition-all duration-300 ${
        logistiqueCertifie
          ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
          : "border-cyan-300 dark:border-cyan-700"
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="certification-logistique"
              checked={logistiqueCertifie}
              onCheckedChange={(checked) => onCertifier(checked === true)}
              disabled={certifying}
              className="mt-0.5"
            />
            <div>
              <Label
                htmlFor="certification-logistique"
                className="text-sm font-semibold cursor-pointer"
              >
                Le chef logistique certifie la conformité du circuit
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                En cochant cette case, je certifie que le circuit de réception a
                été respecté (contrôle magasinier effectué, bon de livraison
                conforme) et j'appose ma signature obligatoire (2ᵉ sur 3) avant
                la validation finale du dépositaire.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Reconstruit l'état de l'écran (ReceptionData) depuis une entrée serveur.
 *  Source unique de vérité : la base — le localStorage n'est plus lu.
 *  Limitation documentée : le serveur ne stocke pas la quantité COMMANDÉE
 *  (uniquement la quantité livrée par ligne) — la valeur est reprise telle
 *  quelle, les écarts de saisie ne se reproduisent donc pas après rechargement. */
function receptionDepuisEntree(entree: EntreeRecord): {
  data: ReceptionData;
  extra: ReceptionDataExtra;
} {
  const articles: BonLivraisonArticle[] = (entree.lignes ?? []).map((l) => ({
    id: `ligne-${l.numeroOrdre}`,
    designation: l.designation,
    referenceNomenclature: l.nomenclature || l.reference || "",
    quantiteCommandee: l.quantite,
    quantiteLivree: l.quantite,
    prixUnitaire: l.prixUnitaire,
  }));
  // État non renseigné = on le note dans etatsNonControles ; la valeur locale
  // du champ reste neutre ("neuf") mais n'est JAMAIS affichée comme un vrai
  // constat tant que le magasinier n'a rien validé.
  const etatsNonControles: Record<string, boolean> = {};
  const controles: ControleArticle[] = (entree.lignes ?? []).map((l) => {
    const nonControle = l.etat == null;
    if (nonControle) etatsNonControles[`ligne-${l.numeroOrdre}`] = true;
    return {
      articleId: `ligne-${l.numeroOrdre}`,
      etat: (l.etat ?? "neuf") as EtatConstate,
      conforme: l.conforme ?? false,
      remarque: l.observation ?? "",
    };
  });
  return {
    data: {
      fournisseur: entree.fournisseur === "—" ? "" : entree.fournisseur,
      numeroBL: entree.admin?.bonLivraison ?? "",
      dateBL: entree.admin?.dateBonLivraison || entree.dateEntree,
      articles,
      observationsBL: entree.admin?.observations ?? "",
      controles,
      // L'étape 2 de l'écran correspond à la signature serveur chef_service_1,
      // l'étape 3 à chef_service_2 (le nom du champ local est historique).
      // `depositaireCertifie` est la CONFIRMATION du dépositaire à l'étape 4 :
      // elle ne vaut VRAI que si la signature serveur « depositaire » est déjà
      // posée. Elle était dérivée de chef_service_2 (mapping de l'ancienne étape
      // 3, aujourd'hui la logistique) : la case réapparaissait donc cochée au
      // chargement et la confirmation finale pouvait être contournée sans aucun
      // clic du dépositaire.
      magasinierCertifie: !!entree.signatures?.chefService1,
      depositaireCertifie: !!entree.signatures?.depositaire,
      journalEntryId: entree.reference,
      dateEnregistrement:
        entree.signatures?.chefService2 ?? entree.signatures?.chefService1,
    },
    extra: {
      estBrouillon: entree.statutServeur === "brouillon",
      etatsNonControles,
    },
  };
}

/** Déduit l'étape courante de l'écran depuis les flags serveur :
 *  étape 2 = contrôle magasinier, 3 = signature logistique (chef_service_2),
 *  4 = PV + signature finale du dépositaire (validee/rejetee inclus). */
function stepDepuisEntree(entree: EntreeRecord): number {
  if (
    entree.signatures?.chefService2 ||
    entree.statutServeur === "validee" ||
    entree.statutServeur === "rejetee"
  ) {
    return 4;
  }
  if (entree.signatures?.chefService1) return 3;
  return 2;
}

// ─────────────────────────────────────────────
// Bandeau récapitulatif des 3 signatures (étape 7)
// ─────────────────────────────────────────────

/** Puce « rôle : signé par X / en attente » — les données viennent du serveur
 *  (fetchEntrees) : flag de signature + nom (signataire posé à la signature,
 *  sinon affectation fixée à la création, sinon libellé du rôle). */
function SignataireChip({
  label,
  signe,
  date,
  nom,
}: {
  label: string;
  signe: boolean;
  date?: string;
  nom?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {signe ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="font-medium">{label} :</span>
      {signe ? (
        <span className="text-green-700 dark:text-green-400">
          signé par {nom || "—"}
          {date && (
            <span className="text-muted-foreground">
              {" "}· {new Date(date).toLocaleDateString("fr-FR")}
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">en attente</span>
      )}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Séparation traitement / consultation : « À traiter » vs « Articles traités »
//
// Un rôle ne voit dans SON onglet que les pièces qui attendent encore SA
// signature. Dès qu'il l'a apposée, la pièce sort de l'écran de traitement et
// reste consultable en LECTURE SEULE — plus aucune action possible.
// ──────────────────────────────────────────────────────────────────

/** Bascule entre l'écran de traitement et la consultation des pièces traitées. */
function OngletsTraitement({
  vue,
  onChange,
  nbATraiter,
  nbTraitees,
}: {
  vue: "traitement" | "traites";
  onChange: (v: "traitement" | "traites") => void;
  nbATraiter: number;
  nbTraitees: number;
}) {
  const onglet = (actif: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
      actif
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <div className="print-hidden inline-flex gap-1 p-1 rounded-lg bg-muted/60 w-fit">
      <button
        type="button"
        onClick={() => onChange("traitement")}
        className={onglet(vue === "traitement")}
      >
        À traiter
        {nbATraiter > 0 && (
          <Badge className="bg-primary text-primary-foreground px-1.5 min-w-5 h-5">
            {nbATraiter}
          </Badge>
        )}
      </button>
      <button
        type="button"
        onClick={() => onChange("traites")}
        className={onglet(vue === "traites")}
      >
        Articles traités
        {nbTraitees > 0 && (
          <Badge variant="secondary" className="px-1.5 min-w-5 h-5">
            {nbTraitees}
          </Badge>
        )}
      </button>
    </div>
  );
}

/** Liste en lecture seule des entrées dont le rôle connecté a posé la signature. */
function ListeEntreesTraitees({
  entrees,
  role,
  onOuvrir,
}: {
  entrees: EntreeRecord[];
  role: AppRole;
  onOuvrir: (e: EntreeRecord) => void;
}) {
  if (entrees.length === 0) {
    return (
      <Card className="print-hidden">
        <CardContent className="py-12 text-center space-y-2">
          <ClipboardCheck className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Aucun article traité par votre rôle</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Les entrées dont vous aurez apposé la signature apparaîtront ici en
            consultation seule. Tant que ce n'est pas le cas, utilisez l'onglet
            « À traiter ».
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="print-hidden">
      <CardHeader className="py-4">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Articles traités — {ROLES_CONFIG[role].label}
        </CardTitle>
        <CardDescription>
          Consultation seule : aucune action n'est possible sur ces entrées.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Référence</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Bon de livraison</TableHead>
              <TableHead className="text-right">Lignes</TableHead>
              <TableHead className="text-right">Réserves</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entrees.map((e) => {
              const lignes = e.lignes ?? [];
              const reserves = lignes.filter(
                (l) => l.conforme === false || l.etat === "defaillant"
              ).length;
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.reference}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(e.dateEntree).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {e.fournisseur || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.admin?.bonLivraison || "—"}
                  </TableCell>
                  <TableCell className="text-right">{lignes.length}</TableCell>
                  <TableCell className="text-right">
                    {reserves > 0 ? (
                      <span className="text-destructive font-semibold">
                        {reserves}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        e.statut === "Validée"
                          ? "border-green-600 text-green-700 dark:text-green-400"
                          : e.statut === "Rejetée"
                          ? "border-destructive text-destructive"
                          : ""
                      }
                    >
                      {e.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8"
                      onClick={() => onOuvrir(e)}
                    >
                      Consulter
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Détail d'une entrée déjà traitée : lignes constatées + chaîne de
 *  signatures. Strictement informatif (aucun bouton d'action). */
function DetailEntreeTraitee({
  entree,
  onRetour,
}: {
  entree: EntreeRecord;
  onRetour: () => void;
}) {
  const lignes = entree.lignes ?? [];
  const total = lignes.reduce((s, l) => s + l.quantite, 0);
  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={onRetour} className="gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour à la liste
      </Button>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {entree.reference}
          </CardTitle>
          <CardDescription>
            Bon de livraison {entree.admin?.bonLivraison || "—"} —{" "}
            {entree.fournisseur || "fournisseur non précisé"} —{" "}
            {new Date(entree.dateEntree).toLocaleDateString("fr-FR")} —{" "}
            {lignes.length} ligne(s), {total} unité(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Désignation</TableHead>
                <TableHead className="text-right">Quantité</TableHead>
                <TableHead>État constaté</TableHead>
                <TableHead>Conformité</TableHead>
                <TableHead>Observation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l) => (
                <TableRow key={l.numeroOrdre}>
                  <TableCell className="font-medium">
                    {l.designation}
                  </TableCell>
                  <TableCell className="text-right">{l.quantite}</TableCell>
                  <TableCell>
                    {l.etat ? (
                      <Badge
                        variant="secondary"
                        className={ETAT_COLORS[l.etat]}
                      >
                        {ETAT_LABELS[l.etat]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Non renseigné
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {l.conforme === false ? (
                      <Badge variant="destructive" className="text-xs">
                        Réserve
                      </Badge>
                    ) : l.conforme === true ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                        Conforme
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.observation || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">Circuit de signatures</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <SignataireChip
            label="Magasinier"
            signe={!!entree.signatures?.chefService1}
            date={entree.signatures?.chefService1}
            nom={entree.signataires?.chefService1}
          />
          <SignataireChip
            label="Chef logistique"
            signe={!!entree.signatures?.chefService2}
            date={entree.signatures?.chefService2}
            nom={entree.signataires?.chefService2}
          />
          <SignataireChip
            label="Dépositaire"
            signe={!!entree.signatures?.depositaire}
            date={entree.signatures?.depositaire}
            nom={entree.signataires?.depositaire}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function MaterialEntry({ user, onNavigate }: MaterialEntryProps) {
  // Session simulée : sélecteur « Connecté en tant que ».
  // Initialisé sur le rôle de l'utilisateur réellement connecté (session App).
  // Simplification : le magasinier connecté ne peut PAS changer de rôle —
  // il ne voit que SON onglet (contrôle à l'arrivée).
  const isFixedMagasinier = user?.role === "magasinier";
  const isFixedDepositaire = user?.role === "depositaire";
  const isFixedLogistique = user?.role === "logistique";
  const [activeRole, setActiveRole] = useState<AppRole>(() =>
    resolveActiveRole(user?.role)
  );
  const isMagasinierSession = isFixedMagasinier && activeRole === "magasinier";
  const [logistiqueCertifie, setLogistiqueCertifie] = useState(false);

  // Réception en cours : état initial vide en attendant l'hydratation depuis
  // l'API (fetchEntrees dans chargerEtatServeur, Étape 4) — plus AUCUNE
  // lecture du localStorage (nettoyage Étape 6).
  const [receptionData, setReceptionData] = useState<ReceptionData>(() =>
    // Démarrage propre : aucun article de démo pré-rempli.
    // Si le serveur renvoie une entrée active au montage, elle sera hydratée
    // dans chargerEtatServeur. Les données de démo ne s'affichent JAMAIS dans
    // une vraie session de saisie.
    createInitialData(false)
  );

  // Étape 1 branchée sur l'API réelle : l'entrée créée côté serveur (avec sa
  // référence ENT-AAAA-NNN) et l'état de soumission (anti double-clic). Les
  // étapes 2 à 4 restent pour l'instant sur la persistance locale.
  const [entreeServeur, setEntreeServeur] = useState<EntreeRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Articles dont le contrôle est incomplet (état non renseigné) — mis en
  // évidence à l'étape 2 (bordure destructive) jusqu'à correction.
  const [articlesIncomplets, setArticlesIncomplets] = useState<Set<string>>(new Set());
  // Informations complémentaires de l'entrée hydratée (brouillon ? états non
  // contrôlés par ligne ?) — recalculées à chaque hydratation uniquement.
  const [extra, setExtra] = useState<ReceptionDataExtra>({
    estBrouillon: false,
    etatsNonControles: {},
  });
  // Miroir REF de entreeServeur : lu par chargerEtatServeur (callback à
  // dépendances stables) pour ré-ancrer l'écran sur la MÊME entrée après un
  // rafraîchissement, au lieu d'en substituer une autre.
  const entreeServeurRef = useRef<EntreeRecord | null>(null);
  // Vrai dès qu'une SAISIE LOCALE non enregistrée existe (champs du bon de
  // livraison, constats du magasinier, case logistique). Une relecture de fond
  // s'abstient alors : elle ne doit jamais écraser la saisie en cours. Remis à
  // false après chaque application de l'état serveur (y compris explicite).
  const modifieLocalementRef = useRef(false);
  // Verrou anti-concurrence : une seule relecture serveur à la fois.
  const chargementEnCoursRef = useRef(false);
  // Dernière relecture RÉUSSIE du serveur (pilote le libellé « dernière sync »).
  const derniereSync = useDerniereSync();

  // ─── Hydratation depuis l'API (Étape 4) ───
  // L'état de l'écran est reconstruit depuis fetchEntrees() : statut, flags
  // de signature, lignes (etat/conforme). Aucun repli silencieux sur le
  // localStorage : en cas d'indisponibilité, l'écran affiche une erreur et
  // un bouton Réessayer. Choix de routage (documenté) : l'écran cible la
  // DERNIÈRE entrée active du serveur — c'est le flux mono-réception en
  // cours depuis l'Étape 1 ; la navigation multi-réceptions n'existe pas
  // encore à l'écran.
  const [hydratation, setHydratation] = useState<
    | { etat: "chargement" }
    | { etat: "pret" }
    | { etat: "erreur"; echec: EchecApi }
  >({ etat: "chargement" });

  const chargerEtatServeur = useCallback(
    async (options?: { silencieux?: boolean }) => {
      const silencieux = options?.silencieux === true;
      // Un seul appel à la fois : deux rafraîchissements concurrents
      // (focus + clic) se marcheraient dessus — le 2ᵉ est ignoré.
      if (chargementEnCoursRef.current) return;
      chargementEnCoursRef.current = true;
      if (!silencieux) setHydratation({ etat: "chargement" });
      try {
        const resultat = await fetchEntreesDetail();
        // Échec = ERREUR explicite (jamais de repli silencieux sur d'anciennes
        // données locales), mais la CAUSE est conservée : sans jeton Strapi
        // l'API renvoie 403 au même titre qu'un rôle non habilité, et le
        // message doit dire quoi faire (reconnexion) plutôt que « réseau coupé ».
        // Une relecture silencieuse (retour sur l'onglet) ne masque jamais l'écran
        // déjà affiché : elle se contente de recharger les listes.
        if (!resultat.ok) {
          if (!silencieux) setHydratation({ etat: "erreur", echec: resultat.echec });
          return;
        }
        const entrees = resultat.entrees;
        setEntreesChargees(entrees);
        marquerSync();          // ─── Garde-fou saisie en cours ───
          // Une relecture de fond ne doit JAMAIS écraser un bon de livraison en
          // cours de frappe ni les constats du magasinier : on met à jour les
          // listes (cloche, compteurs) et on s'arrête. Le rechargement complet
          // reste accessible via le bouton « Rafraîchir », lui explicite.
          if (silencieux && modifieLocalementRef.current) {
            return;
          }
          modifieLocalementRef.current = false;

        // ─── 1) Ré-ancrage : une entrée est déjà affichée à l'écran ───
        // Elle n'y reste que tant qu'elle attend une action du rôle connecté.
        // Dès que le rôle a apposé SA signature, la pièce est DÉTACHÉE : elle
        // ne doit plus figurer dans son onglet de traitement (constaté : après
        // sa signature, le magasinier restait affiché à l'étape 2 sur la pièce
        // qu'il venait de traiter) ; elle bascule dans la page « Articles
        // traités », en lecture seule.
        const enCours = entreeServeurRef.current;
        if (enCours && entreeResteATraiter(enCours, activeRole)) {
          const rechargee = entrees.find((e) => e.id === enCours.id);
          if (rechargee) {
            setEntreeServeur(rechargee);
            entreeServeurRef.current = rechargee;
            const h = receptionDepuisEntree(rechargee);
            setReceptionData(h.data);
            setExtra(h.extra);
            setLogistiqueCertifie(!!rechargee.signatures?.chefService2);
            setMultiAttente(null);
            setPiecesEnAttente([]);
            setHydratation({ etat: "pret" });
          return;
        }
        // Absente de la réponse : on repart d'une sélection propre (infra).
      }  
        // ─── 2) Sélection au premier chargement ───
        // Dépositaire : uniquement SES pièces (affectation fixée à la création).
        const estDepositaire = isFixedDepositaire || activeRole === "depositaire";
        if (estDepositaire) {
          const nomMoi = user?.name || "";
          const lesMiennes = entrees.filter(
            (e) =>
              !entreeEstTerminee(e) && entreeEstAuDepositaire(e, nomMoi)
          );
          const enCoursDeSaisie = lesMiennes.find(
            (e) => e.statutServeur === "brouillon"
          );
          const attenteFinale = lesMiennes.find(
            (e) =>
              !!e.signatures?.chefService1 &&
              !!e.signatures?.chefService2 &&
              !e.signatures?.depositaire
          );
          const cible = enCoursDeSaisie || attenteFinale;
          if (cible) {
            setEntreeServeur(cible);
            entreeServeurRef.current = cible;
            const h = receptionDepuisEntree(cible);
            setReceptionData(h.data);
            setExtra(h.extra);
            setLogistiqueCertifie(!!cible.signatures?.chefService2);
            setMultiAttente(null);
            setPiecesEnAttente([]);
            setHydratation({ etat: "pret" });
            return;
          }
          setEntreeServeur(null);
          entreeServeurRef.current = null;
          setReceptionData(createInitialData(false));
          setLogistiqueCertifie(false);
          setMultiAttente(null);
          setPiecesEnAttente([]);
          setHydratation({ etat: "pret" });
          return;
        }
  
        // Magasinier / logistique : les pièces en attente de LEUR rôle.
        const attente = entreesEnAttentePourRole(entrees, activeRole);
        if (attente.length === 1) {
          // Une seule : on peut l'ouvrir sans ambiguïté (comportement historique,
          // inchangé quand un seul BL est en circulation).
          setEntreeServeur(attente[0]);
          entreeServeurRef.current = attente[0];
          const h = receptionDepuisEntree(attente[0]);
          setReceptionData(h.data);
          setExtra(h.extra);
          setLogistiqueCertifie(!!attente[0].signatures?.chefService2);
          setMultiAttente(null);
          setPiecesEnAttente([]);
          setHydratation({ etat: "pret" });
          return;
        }
        if (attente.length > 1) {
          // Plusieurs : PAS de choix automatique — l'utilisateur choisit dans la
          // cloche « Mes notifications » (liste dérivée, déjà à jour).
          setEntreeServeur(null);
          entreeServeurRef.current = null;
          setReceptionData(createInitialData(false));
          setLogistiqueCertifie(false);
          setMultiAttente({ references: attente.map((e) => e.reference) });
          setPiecesEnAttente([]);
          setHydratation({ etat: "pret" });
          return;
        }
  
        // ─── 3) Rien d'actionnable pour ce rôle ───
        // Écran vierge + information : les pièces EN CIRCULATION sont listées
        // avec l'étape qui les bloque. Sans cela le chef logistique atterrissait
        // sur une étape 3 « 0 / 0 » sans comprendre pourquoi (constaté) — il ne
        // peut rien poser tant que le magasinier n'a pas signé.
        const enCirculation = entrees.filter((e) => !entreeEstTerminee(e));
        setEntreeServeur(null);
        entreeServeurRef.current = null;
        setReceptionData(createInitialData(false));
        setLogistiqueCertifie(false);
        setMultiAttente(null);
        setPiecesEnAttente(
          enCirculation.map((e) => ({
            id: e.id,
            reference: e.reference,
            bloqueePar: etapeEnAttenteDe(e),
          }))
        );
        setHydratation({ etat: "pret" });
      } catch {
        if (!silencieux) setHydratation({ etat: "erreur", echec: "reseau" });
      } finally {
        chargementEnCoursRef.current = false;
      }
    },
    [activeRole, isFixedDepositaire, isFixedLogistique, user?.name]
  );

  // Recharge l'état au montage (les actions mettent ensuite à jour
  // entreeServeur localement avec la réponse du serveur).
  useEffect(() => {
    chargerEtatServeur();
  }, [chargerEtatServeur]);

  // ─── Synchronisation entre postes ───
  // Sans ça, le magasinier qui signe sur SON poste laisse l'écran du chef
  // logistique figé jusqu'au rechargement manuel de la page. Deux mécanismes :
  //   1) relecture au retour sur l'onglet / à la reprise de focus ;
  //   2) périodiquement (toutes les 20 s) — indispensable entre deux MACHINES
  //      différentes, où aucun événement de fenêtre ne se déclenche.
  // Les deux passent en mode SILENCIEUX : l'écran affiché n'est jamais masqué
  // et la saisie en cours n'est jamais écrasée (garde-fou dans
  // chargerEtatServeur).
  useEffect(() => {
    const relire = () => {
      if (document.visibilityState !== "visible") return;
      void chargerEtatServeur({ silencieux: true });
    };
    const minuteur = setInterval(relire, 20000);
    window.addEventListener("focus", relire);
    document.addEventListener("visibilitychange", relire);
    return () => {
      clearInterval(minuteur);
      window.removeEventListener("focus", relire);
      document.removeEventListener("visibilitychange", relire);
    };
  }, [chargerEtatServeur]);

  // ─── Notifications dérivées (Étape 5) ───
  // La liste des entrées chargées sert aux DEUX usages : hydratation de
  // l'entrée active et calcul des notifications (actions en attente par
  // rôle). Un refreshNotifications() après chaque signature recharge tout.
  const [entreesChargees, setEntreesChargees] = useState<EntreeRecord[] | null>(null);
  // Plusieurs entrées attendent le rôle en même temps : on ne choisit PAS à
  // la place de l'utilisateur (risque d'action sur la mauvaise pièce).
  const [multiAttente, setMultiAttente] = useState<{
    references: string[];
  } | null>(null);
  // Pièces en circulation qui n'attendent PAS le rôle connecté : sans cette
  // information, un rôle sans pièce à traiter atterrissait sur son étape (vide,
  // « 0 / 0 ») sans comprendre que le circuit était bloqué plus tôt.
  const [piecesEnAttente, setPiecesEnAttente] = useState<
    { id: string; reference: string; bloqueePar: string }[]
  >([]);
  // ─── Séparation traitement / lecture seule ───
  // Onglet « À traiter » : les seules pièces qui attendent la signature du rôle
  // connecté. Onglet « Articles traités » : celles dont CE rôle a déjà posé la
  // signature (consultation seule). Dérivés de la dernière lecture serveur —
  // aucune liste séparée à resynchroniser.
  const [vue, setVue] = useState<"traitement" | "traites">("traitement");
  const [entreeTraiteeOuverte, setEntreeTraiteeOuverte] = useState<EntreeRecord | null>(null);
  const entreesATraiter = useMemo(
    () => (entreesChargees ?? []).filter((e) => entreeResteATraiter(e, activeRole)),
    [entreesChargees, activeRole]
  );
  const entreesTraitees = useMemo(
    () =>
      (entreesChargees ?? []).filter(
        (e) => entreeTraiteeParRole(e, activeRole) && !entreeResteATraiter(e, activeRole)
      ),
    [entreesChargees, activeRole]
  );

  // ─── currentStep dérivé du serveur (Étape 4) ───
  // L'étape d'accueil de chaque rôle est reconstruite depuis les FLAGS
  // SERVEUR (signatures/statut), pas depuis l'état local. Tant que
  // l'hydratation est en cours, l'étape 1 s'affiche par défaut (écran de
  // chargement masquant le reste) — l'état réel est appliqué dès réception.
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Recalcul de l'étape d'accueil une fois l'état serveur reçu (et à chaque
  // changement de rôle pour l'admin, comme avant).
  const roleHomeStepMemo = useMemo(() => {
    return getRoleHomeStep(activeRole, receptionData);
  }, [activeRole, receptionData]);

  useEffect(() => {
    if (hydratation.etat !== "pret") return;
    if (entreeServeur) {
      // Une entrée active existe : tout le monde atterrit sur l'étape que
      // déduit le serveur (contrôle magasinier / logistique / PV).
      setCurrentStep(stepDepuisEntree(entreeServeur));
    } else if (multiAttente) {
      // Plusieurs pièces attendent ce rôle : pas de sélection automatique.
      setCurrentStep(2);
    } else if (isFixedMagasinier) {
      setCurrentStep(2);
    } else {
      setCurrentStep(getRoleHomeStep(activeRole, receptionData));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydratation.etat, entreeServeur?.id, activeRole, multiAttente]);

  const sessionName = getSessionUserName(activeRole, user ?? null);
  const magasinierName = getSessionUserName("magasinier", user ?? null);
  const depositaireName = getSessionUserName("depositaire", user ?? null);
  const logistiqueName = getSessionUserName("logistique", user ?? null);

  // Étape 3 : la signature serveur posée est chef_service_2 (logistique).
  // isFixedLogistique : l'utilisateur connecté EST un logisticien — il voit
  // une vue simplifiée (SON étape uniquement), comme le magasinier et le
  // dépositaire. isFixedDepositaire reste propriétaire des étapes 1 et 4.

  // ─── Notifications dérivées du rôle actif (Étape 5) ───
  // Pur calcul depuis les entrées serveur chargées : pas de stockage, pas de
  // « lu/non lu ». Le badge est le nombre d'actions en attente du rôle.
  const notifications = useMemo(
    () => notificationsPourRole(activeRole, entreesChargees ?? []),
    [activeRole, entreesChargees]
  );
  const unreadCount = notifications.length;
  // Rafraîchissement = recharger les entrées depuis le serveur.
  const refreshNotifications = () => chargerEtatServeur();

  useEffect(() => {
    // Chacun joue son rôle : au changement de rôle (autres que magasinier), on
    // repositionne sur son étape d'accueil. Le magasinier reste sur son
    // onglet unique (étape 2).
    if (!isFixedMagasinier && !isFixedDepositaire && entreeServeur) {
      setCurrentStep(stepDepuisEntree(entreeServeur));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole]);

  // When articles change, sync the controles list
  const handleDataChange = (partial: Partial<ReceptionData>) => {
    // Toute écriture locale « sale » l'écran : la relecture de fond doit
    // s'abstenir tant que l'utilisateur n'a pas enregistré sa pièce.
    modifieLocalementRef.current = true;
    // Verrou logique : refuse toute écriture sur un champ appartenant à une
    // étape réservée à un autre rôle (bloque aussi les tentatives via DevTools).
    const guard = guardReceptionUpdate(partial, activeRole);
    if (!guard.allowed) {
      toast.error(DENIED_ACTION_MESSAGE, {
        description: `Étape réservée à : ${
          ROLES_CONFIG[guard.requiredRole ?? "magasinier"]?.label ?? "—"
        }.`,
      });
      return;
    }
    setReceptionData((prev) => {
      const next = { ...prev, ...partial };

      // Le magasinier vient de constater un état : la ligne quitte la liste
      // des états « non contrôlés » (l'affichage reflète désormais un vrai
      // constat, plus un état par défaut non saisi).
      if (partial.controles) {
        const nettoyes = { ...extra.etatsNonControles };
        let modifie = false;
        for (const c of partial.controles) {
          if (c.etat && nettoyes[c.articleId]) {
            delete nettoyes[c.articleId];
            modifie = true;
          }
        }
        if (modifie) setExtra((x) => ({ ...x, etatsNonControles: nettoyes }));
      }

      // Sync controles when articles change
      if (partial.articles) {
        const existingControles = prev.controles;
        next.controles = partial.articles.map((article) => {
          const existing = existingControles.find(
            (c) => c.articleId === article.id
          );
          return (
            existing || {
              articleId: article.id,
              etat: "neuf" as EtatConstate,
              conforme: false,
              remarque: "",
            }
          );
        });
      }

      return next;
    });
  };

  const handleSelectionnerEntree = (e: EntreeRecord) => {
    modifieLocalementRef.current = false;
    setEntreeServeur(e);
    entreeServeurRef.current = e;
    const h = receptionDepuisEntree(e);
    setReceptionData(h.data);
    setExtra(h.extra);
    setMultiAttente(null);
    setPiecesEnAttente([]);
    setLogistiqueCertifie(!!e.signatures?.chefService2);
    setCurrentStep(stepDepuisEntree(e));
  };

  // Case de certification logistique : la cocher est une saisie locale (la
  // signature n'est posée qu'au clic « Certifier ») — elle protège donc aussi
  // l'écran d'une relecture de fond.
  const handleCertifierLogistique = (v: boolean) => {
    modifieLocalementRef.current = true;
    setLogistiqueCertifie(v);
  };

  // Validation per step
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1: {
        const hasSupplier = receptionData.fournisseur.trim().length > 0;
        const hasBL = receptionData.numeroBL.trim().length > 0;
        const hasDate = receptionData.dateBL.length > 0;
        const hasArticles = receptionData.articles.length > 0;
        const allArticlesValid = receptionData.articles.every(
          (a) =>
            a.designation.trim().length > 0 &&
            a.quantiteLivree > 0 &&
            a.prixUnitaire > 0
        );
        return hasSupplier && hasBL && hasDate && hasArticles && allArticlesValid;
      }
      case 2: {
        const hasUnjustifiedAnomalies = receptionData.controles.some(
          (c) => (!c.conforme || c.etat === "defaillant") && !c.remarque.trim()
        );
        // Chaque article doit avoir son état renseigné (le serveur refuse
        // sinon la signature : « contrôle incomplet »).
        const etatsComplets = receptionData.controles.every((c) => !!c.etat);
        return receptionData.magasinierCertifie && etatsComplets && !hasUnjustifiedAnomalies;
      }
      case 3:
        return activeRole === "logistique"
          ? logistiqueCertifie
          : (receptionData.depositaireCertifie || logistiqueCertifie);
      case 4:
        // Signature finale du dépositaire : requiert OBLIGATOIREMENT la case de
        // certification (depositaireCertifie) cochée par le dépositaire.
        // Le court-circuit précédent (|| chefService2 !== undefined) ignorait la
        // case — le dépositaire pouvait signer sans avoir confirmé l'écriture.
        // Corrigé : seule la case cochée autorise la signature finale.
        return receptionData.depositaireCertifie === true;
      default:
        return false;
    }
  }, [currentStep, receptionData, isSubmitting, activeRole, logistiqueCertifie]);

  const goNext = async () => {
    // L'étape 4 est TERMINALE mais PORTE UNE ACTION : la signature finale du
    // dépositaire (branche `currentStep === 4` plus bas). Le retour précédent
    // (`>= 4`) rendait cette branche INATTEIGNABLE : le bouton « Signer la
    // validation finale » partait sans appel, sans toast et sans erreur — le
    // depositaire ne pouvait donc jamais valider, quelle que soit la case de
    // certification. On borne donc au-delà de la DERNIÈRE étape.
    if (currentStep > STEP_LABELS.length) return;

    // Verrou logique sur la navigation aussi : un rôle ne peut pas valider
    // une étape qui n'est pas la sienne, même si les données le permettraient.
    if (!canPerformStepAction(activeRole, currentStep)) {
      // Rôle requis lu depuis STEP_ROLE_REQUIREMENTS (lib/role-access.ts) :
      // source unique de vérité alignée sur le contrôle d'accès réel
      // (étape 2 = magasinier, étape 3 = logistique, étape 4 = dépositaire).
      const required = STEP_ROLE_REQUIREMENTS[currentStep];
      toast.error(DENIED_ACTION_MESSAGE, {
        description: `Étape réservée à : ${
          (required && ROLES_CONFIG[required]?.label) || "—"
        }.`,
      });
      return;
    }

    if (!canProceed) return;

    if (currentStep === 1) {
      // Étape 1 branchée sur l'API réelle : création de l'entrée côté serveur
      // (POST /api/entrees/create-complete). Le fournisseur est envoyé en
      // texte brut : le contrôleur fait le find-or-create silencieux. Les
      // affectations chef_service_1/chef_service_2 restent vides jusqu'à la
      // première signature de chaque rôle (décision 1).
      setIsSubmitting(true);
      try {
        const payload: NouvelleEntreePayload = {
          date_entree: receptionData.dateBL || new Date().toISOString().split("T")[0],
          bon_livraison: receptionData.numeroBL,
          date_bon_livraison: receptionData.dateBL || undefined,
          fournisseur: receptionData.fournisseur.trim(),
          responsable: depositaireName,
          notes: receptionData.observationsBL || undefined,
          // Flux « Arrivée matériel » : aucune affectation saisie à cet écran.
          // On lève l'exigence serveur des 3 affectations ; le contrôleur
          // dérive alors affectation_depositaire depuis l'utilisateur connecté
          // et laisse chef_service_1/2 à null jusqu'aux signatures.
          exigerAffectations: false,
          lignes: receptionData.articles.map((article, index) => ({
            numero_ordre: index + 1,
            designation: article.designation,
            reference: article.referenceNomenclature || undefined,
            quantite: article.quantiteLivree,
            valeur_unitaire: article.prixUnitaire,
            nomenclature: article.referenceNomenclature || undefined,
          })),
        };
        const entree = await creerEntree(payload);
        setEntreeServeur(entree);
        // Ré-ancrage : ce documentId devient LA pièce affichée — le
        // rafraîchissement qui suit ne remplacera jamais cette entrée par une
        // autre trouvée dans la base (risque de faux enregistrement).
        entreeServeurRef.current = entree;
        // Transmission au magasinier : la référence affichée à partir d'ici
        // est celle générée par le serveur (ENT-AAAA-NNN). La notification
        // « à contrôler » est désormais DÉRIVÉE (visible dans la cloche du
        // magasinier, calculée depuis les entrées serveur).
        refreshNotifications();
        toast.success(`Entrée ${entree.reference} créée`, {
          description: `${entree.lignes.length} ligne(s) enregistrée(s) en base.`,
        });
      } catch (err) {
        // Erreur serveur/validation : message clair, la saisie reste intacte
        // (aucun setReceptionData ici) et l'utilisateur peut corriger et
        // resoumettre.
        const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
        const serverMessage =
          axiosErr?.response?.data?.error?.message ||
          (err instanceof Error ? err.message : "Erreur inconnue");
        toast.error("Création de l'entrée impossible", {
          description: serverMessage,
        });
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    if (currentStep === 2) {
      // Étape 2 branchée sur l'API réelle : signature chef_service_1 groupée
      // avec le détail du contrôle par article (etat/conforme/observations)
      // en UN SEUL appel (POST /api/entrees/:documentId/sign). En cas de
      // contrôle incomplet le serveur refuse AVANT de poser la signature :
      // on reste à l'étape 2 avec les articles concernés mis en évidence.
      if (!entreeServeur?.id) {
        toast.error("Entrée introuvable", {
          description:
            "Aucune entrée serveur liée à cette réception. Reprenez depuis l'étape 1.",
        });
        return;
      }
      // Garde-fou intégrité : toute ligne doit avoir un état VRAIMENT
      // constaté — y compris celles encore marquées « Non contrôlé » après
      // hydratation (sans cela, la valeur par défaut silencieuse serait
      // soumise comme « neuf » sans constat réel).
      const controleIncomplet = receptionData.controles.find(
        (c) =>
          !c.etat || extra.etatsNonControles[c.articleId]
      );
      if (controleIncomplet) {
        const art = receptionData.articles.find(
          (a) => a.id === controleIncomplet.articleId
        );
        toast.error("Contrôle incomplet", {
          description: `Renseignez l'état de « ${art?.designation ?? "article"} » avant de certifier.`,
        });
        setArticlesIncomplets(new Set([controleIncomplet.articleId]));
        return;
      }
      setIsSubmitting(true);
      try {
        const controles = receptionData.controles.map((c) => {
          const art = receptionData.articles.find((a) => a.id === c.articleId);
          return {
            numero_ordre: receptionData.articles.indexOf(art!) + 1,
            etat: c.etat,
            conforme: c.conforme,
            observations: c.remarque.trim() || undefined,
          };
        });
        const updated = await signerEntree(entreeServeur.id, "chef_service_1", controles);
        setEntreeServeur(updated);
        setArticlesIncomplets(new Set());
        // La notification « réception certifiée » du dépositaire est désormais
        // DÉRIVÉE (l'entrée apparaît dans la cloche logistique puis
        // dépositaire selon l'avancement).
        refreshNotifications();
        toast.success(`Signature chef_service_1 posée — entrée ${updated.reference}`, {
          description: `Statut serveur : ${updated.statut}.`,
        });
      } catch (err) {
        const axiosErr = err as {
          response?: { status?: number; data?: { error?: { message?: string } } };
        };
        const serverMessage =
          axiosErr?.response?.data?.error?.message ||
          (err instanceof Error ? err.message : "Erreur inconnue");
        if (axiosErr?.response?.status === 409) {
          // Double signature : déjà certifiée par un autre magasinier.
          toast.error("Entrée déjà certifiée", {
            description:
              "Cette entrée a déjà été certifiée par un autre magasinier. Votre contrôle n'a pas été enregistré.",
          });
        } else if (
          axiosErr?.response?.status === 400 &&
          serverMessage.toLowerCase().includes("contrôle incomplet")
        ) {
          // Contrôle incomplet : on reste à l'étape 2, articles ciblés surlignés.
          const manquants = receptionData.controles.filter((c) => !c.etat);
          const ids = new Set(manquants.map((c) => c.articleId));
          setArticlesIncomplets(ids);
          toast.error("Contrôle incomplet", {
            description: serverMessage,
          });
        } else {
          toast.error("Certification impossible", {
            description: serverMessage,
          });
        }
        setIsSubmitting(false);
        return; // on reste à l'étape 2, saisie du contrôle intacte
      }
      setIsSubmitting(false);
    }

    if (currentStep === 3) {
      // Étape 3 branchée sur l'API réelle : signature chef_service_2
      // (logistique), 2ᵉ sur 3 — conformément à l'ordre serveur magasinier →
      // logistique → dépositaire.
      if (!entreeServeur?.id) {
        toast.error("Entrée introuvable", {
          description:
            "Aucune entrée serveur liée à cette réception. Reprenez depuis l'étape 1.",
        });
        return;
      }
      setIsSubmitting(true);
      try {
        const updated = await signerEntree(entreeServeur.id, "chef_service_2");
        setEntreeServeur(updated);
        // Horodatage local aligné sur le serveur (date de signature
        // chef_service_2).
        const withDate: ReceptionData = {
          ...receptionData,
          dateEnregistrement:
            updated.signatures.chefService2 ?? new Date().toISOString(),
        };
        setReceptionData(withDate);
        refreshNotifications();
        toast.success(`Signature logistique posée — entrée ${updated.reference}`, {
          description: `Statut serveur : ${updated.statut} (2/3 signatures).`,
        });
        setLogistiqueCertifie(true);
        setCurrentStep(4);
      } catch (err) {
        const axiosErr = err as {
          response?: { status?: number; data?: { error?: { message?: string } } };
        };
        const serverMessage =
          axiosErr?.response?.data?.error?.message ||
          (err instanceof Error ? err.message : "Erreur inconnue");
        if (axiosErr?.response?.status === 409) {
          // Double signature : déjà posée par un autre logisticien.
          toast.error("Signature déjà posée", {
            description:
              "La signature logistique a déjà été enregistrée par un autre utilisateur pour cette entrée.",
          });
        } else if (
          axiosErr?.response?.status === 400 &&
          /workflow/i.test(serverMessage)
        ) {
          // Ordre non respecté (accès direct étape 3 sans signature magasinier,
          // rechargement dans un état inattendu) : message serveur affiché.
          toast.error("Étape précédente non complétée", {
            description: serverMessage,
          });
        } else {
          toast.error("Validation impossible", {
            description: serverMessage,
          });
        }
        setIsSubmitting(false);
        return; // on reste à l'étape 3
      }
      setIsSubmitting(false);
    }

    if (currentStep === 4) {
      // Étape 4 branchée sur l'API réelle : signature FINALE du dépositaire
      // (chef_service_1 → chef_service_2 déjà posées). C'est le serveur qui
      // déclenche la validation (statut validee), l'impact stock unique
      // (appliquerImpactStock) et la trace (tracerMouvement) — l'écran ne
      // recalcule rien. Seul le dépositaire peut cliquer (affectation fixée
      // à la création, Étape 1).
      if (!entreeServeur?.id) {
        toast.error("Entrée introuvable", {
          description:
            "Aucune entrée serveur liée à cette réception. Reprenez depuis l'étape 1.",
        });
        return;
      }
      setIsSubmitting(true);
      try {
        const updated = await signerEntree(entreeServeur.id, "depositaire");
        setEntreeServeur(updated);
        entreeServeurRef.current = updated;
        const withDate: ReceptionData = {
          ...receptionData,
          dateEnregistrement: updated.signatures.depositaire ?? new Date().toISOString(),
        };
        setReceptionData(withDate);
        refreshNotifications();
        // Notifier Equipment.tsx et Dashboard.tsx que le stock a été mis à jour
        // (custom event DOM : évite le couplage direct entre composants).
        // Ces composants rechargent fetchMaterialsOrThrow() à la réception.
        window.dispatchEvent(new CustomEvent("stock-mis-a-jour"));
        toast.success(`Entrée ${updated.reference} validée`, {
          description:
            "Les 3 signatures sont réunies. Le stock a été mis à jour par le serveur.",
        });
      } catch (err) {
        const axiosErr = err as {
          response?: { status?: number; data?: { error?: { message?: string } } };
        };
        const serverMessage =
          axiosErr?.response?.data?.error?.message ||
          (err instanceof Error ? err.message : "Erreur inconnue");
        if (axiosErr?.response?.status === 409) {
          // Déjà signée : l'entrée est déjà validée (pas de double impact stock).
          toast.error("Entrée déjà validée", {
            description:
              "La signature finale a déjà été enregistrée pour cette entrée. Le stock n'est impacté qu'une seule fois.",
          });
        } else if (
          axiosErr?.response?.status === 400 &&
          /workflow/i.test(serverMessage)
        ) {
          // Signatures précédentes absentes (accès direct, état inattendu).
          toast.error("Signatures précédentes manquantes", {
            description: serverMessage,
          });
        } else {
          toast.error("Validation finale impossible", {
            description: serverMessage,
          });
        }
        setIsSubmitting(false);
        return; // on reste à l'étape 4
      }
      setIsSubmitting(false);
    }

    setCurrentStep((s) => Math.min(s + 1, 4));
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleNewReception = () => {
    const fresh = createInitialData(false);
    setReceptionData(fresh);
    modifieLocalementRef.current = false;
    setEntreeServeur(null); // détache l'écran de l'entrée serveur précédente
    entreeServeurRef.current = null; // idem pour le garde-fou de rechargement
    setExtra({ estBrouillon: false, etatsNonControles: {} });
    setArticlesIncomplets(new Set());
    setMultiAttente(null);
    setCurrentStep(1);
  };

  // ─── Écran bloqué pendant l'hydratation depuis l'API ───
  // Pas de repli silencieux sur d'anciennes données locales : tant que
  // l'API n'a pas répondu, on affiche un chargement ; en cas d'échec, un
  // message FIEL à la cause réelle (le serveur ne répond pas ≠ la session
  // n'est pas reliée au serveur ≠ le rôle n'a pas le droit de lire).
  if (hydratation.etat !== "pret") {
    const echec: EchecApi | null =
      hydratation.etat === "erreur" ? hydratation.echec : null;
    return (
      <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto">
        <Card className="print-hidden">
          <CardContent className="py-14 text-center space-y-4">
            {hydratation.etat === "chargement" ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <div>
                  <p className="font-medium">Chargement de l'état de la réception…</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    L'état est relu depuis le serveur pour garantir la vérité partagée entre les postes.
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
                <div>
                  <p className="font-medium">{ECHECH_ENTREES_TITRE[echec ?? "reseau"]}</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {ECHECH_ENTREES_DETAIL[echec ?? "reseau"]}
                  </p>
                </div>
                {echec === "session_absente" || echec === "session_expiree" ? (
                  <>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Déconnectez-vous, puis reconnectez-vous avec un compte
                      serveur habilité (par exemple{" "}
                      <span className="font-mono">
                        fara.andriam@mtefop.gov.mg / magasinier123
                      </span>
                      ). Les comptes de démonstration affichés à la connexion
                      (« admin@comptamatiere.com »…) n'existent que dans
                      l'application : ils n'ouvrent aucune session serveur.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => void chargerEtatServeur()}
                      className="gap-2"
                    >
                      Vérifier à nouveau
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void chargerEtatServeur()}
                    className="gap-2"
                  >
                    Réessayer
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // File de traitement VIDE pour ce rôle (magasinier / logistique) : on
  // n'affiche plus une étape de travail sans pièce — les entrées déjà traitées
  // sont dans l'onglet dédié. Le dépositaire garde toujours son étape 1 : c'est
  // là qu'il saisit la nouvelle entrée.
  const fileDeTraitementVide =
    (isFixedMagasinier || isFixedLogistique) &&
    !entreeServeur &&
    !multiAttente &&
    entreesATraiter.length === 0 &&
    !receptionData.magasinierCertifie;

  // Onglet « Articles traités » : consultation seule, écran distinct. Aucune
  // étape de traitement n'est atteignable depuis cette vue.
  if (vue === "traites") {
    return (
      <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="print-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              Articles traités
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              {ROLES_CONFIG[activeRole].label} — entrées dont votre signature est
              déjà apposée (consultation seule).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {derniereSync
                ? `Synchronisé ${formatDelaiSync(derniereSync)}`
                : "Non synchronisé"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void chargerEtatServeur()}
              disabled={hydratation.etat === "chargement"}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  hydratation.etat === "chargement" ? "animate-spin" : ""
                }`}
              />
              Rafraîchir
            </Button>
          </div>
        </div>

        <OngletsTraitement
          vue={vue}
          onChange={setVue}
          nbATraiter={entreesATraiter.length}
          nbTraitees={entreesTraitees.length}
        />

        {entreeTraiteeOuverte ? (
          <DetailEntreeTraitee
            entree={entreeTraiteeOuverte}
            onRetour={() => setEntreeTraiteeOuverte(null)}
          />
        ) : (
          <ListeEntreesTraitees
            entrees={entreesTraitees}
            role={activeRole}
            onOuvrir={setEntreeTraiteeOuverte}
          />
        )}
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header — hidden on print */}
      <div className="print-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <ArrowDown className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            Réception de Matériel
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {isMagasinierSession
              ? "Contrôle du matériel à l'arrivée au magasin"
              : isFixedDepositaire
              ? "Saisie du bon de livraison, puis enregistrement au journal"
              : `Enregistrement d'une arrivée de matériel en ${STEP_LABELS.length} étapes`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isMagasinierSession && (
            <Step2Badge certified={receptionData.magasinierCertifie} />
          )}
          {isFixedDepositaire && <DepositaireBadge currentStep={currentStep} />}
          {/* Synchronisation multi-postes : relecture explicite du serveur,
              horodatée (le pied de page affiche le même repère). */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {derniereSync
                ? `Synchronisé ${formatDelaiSync(derniereSync)}`
                : "Non synchronisé"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void chargerEtatServeur()}
              disabled={hydratation.etat === "chargement"}
              className="gap-1.5"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  hydratation.etat === "chargement" ? "animate-spin" : ""
                }`}
              />
              Rafraîchir
            </Button>
          </div>
          {currentStep === 4 && (
            <Button variant="outline" onClick={handleNewReception} className="print-hidden">
              Nouvelle réception
            </Button>
          )}
        </div>
      </div>

      {/* Aucune pièce n'attend la signature de ce rôle : on explique où le
          circuit est bloqué au lieu d'afficher une étape vide « 0 / 0 ». */}
      {piecesEnAttente.length > 0 && (
        <div className="print-hidden p-3 rounded-lg border border-border bg-muted/40 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Aucune entrée n'attend votre signature
              </p>
              <ul className="text-sm text-muted-foreground space-y-0.5">
                {piecesEnAttente.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs">{p.reference}</span>
                    <span>— en attente : {p.bloqueePar}</span>
                  </li>
                ))}
                {piecesEnAttente.length > 5 && (
                  <li className="text-xs">
                    … et {piecesEnAttente.length - 5} autre(s) entrée(s).
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground">
                L'écran se remettra à jour automatiquement dès qu'une signature
                sera apposée sur un autre poste (au retour sur cet onglet).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Séparation « à traiter » / « articles traités » : une pièce traitée
          par ce rôle quitte son écran de traitement et passe en lecture seule. */}
      <OngletsTraitement
        vue={vue}
        onChange={setVue}
        nbATraiter={entreesATraiter.length}
        nbTraitees={entreesTraitees.length}
      />

      {/* Notifications du rôle connecté (vue simplifiée : SON onglet uniquement) */}
      {(isMagasinierSession || isFixedDepositaire || isFixedLogistique) && (
        <NotificationsBell
          role={activeRole}
          entrees={entreesChargees}
          onSelectEntree={handleSelectionnerEntree}
        />
      )}

      {/* Plusieurs pièces attendent ce rôle : aucune n'est ouverte
          automatiquement — l'utilisateur choisit dans la cloche ci-dessus
          ou via les boutons d'accès rapide ci-dessous. */}
      {multiAttente && multiAttente.references.length > 1 && (
        <div
          className={`print-hidden flex flex-col gap-2 p-3 rounded-lg border border-border ${bandeauRoleClasse(
            activeRole
          )}`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm">
              <strong>{multiAttente.references.length} entrées</strong> attendent
              votre intervention. Choisissez celle à traiter :
            </span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {multiAttente.references.map((ref) => {
              const e = entreesChargees?.find((ent) => ent.reference === ref);
              return (
                <Button
                  key={ref}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (e) handleSelectionnerEntree(e);
                  }}
                  className="gap-1.5 h-8 bg-background/80 hover:bg-background"
                >
                  <span>Ouvrir {ref}</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Étape 1 branchée sur l'API : la référence ENT-AAAA-NNN retournée par
          le serveur est affichée à la place de l'identifiant local — c'est la
          seule valeur à considérer comme « vraie » pour cette étape.
          Bandeau récapitulatif : état des 3 signatures (magasinier →
          logistique → dépositaire), reconstructible après F5 comme après une
          action (données 100 % serveur). */}
      {entreeServeur && (
        <Card className="print-hidden border-primary/30 bg-primary/5">
          <CardContent className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span>
                Entrée en base :{" "}
                <span className="font-mono font-semibold">
                  {entreeServeur.reference}
                </span>{" "}
                — statut serveur :{" "}
                <span className="font-semibold">{entreeServeur.statut}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <SignataireChip
                label="Magasinier"
                signe={!!entreeServeur.signatures?.chefService1}
                date={entreeServeur.signatures?.chefService1}
                nom={
                  entreeServeur.signataires?.chefService1 ||
                  entreeServeur.affectations?.chefService1 ||
                  ROLES_CONFIG.magasinier.label
                }
              />
              <SignataireChip
                label="Logistique"
                signe={!!entreeServeur.signatures?.chefService2}
                date={entreeServeur.signatures?.chefService2}
                nom={
                  entreeServeur.signataires?.chefService2 ||
                  entreeServeur.affectations?.chefService2 ||
                  ROLES_CONFIG.logistique.label
                }
              />
              <SignataireChip
                label="Dépositaire"
                signe={!!entreeServeur.signatures?.depositaire}
                date={entreeServeur.signatures?.depositaire}
                nom={
                  entreeServeur.signataires?.depositaire ||
                  entreeServeur.affectations?.depositaire ||
                  ROLES_CONFIG.depositaire.label
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulateur de session — masqué pour les rôles métier connectés
          (magasinier, dépositaire, logistique) : chacun voit uniquement SES
          actions. */}
      {!isMagasinierSession && !isFixedDepositaire && !isFixedLogistique && (
      <Card className="print-hidden border-primary/30">
        <CardContent className="px-4 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium shrink-0">
              <UserCheck className="h-4 w-4 text-primary" />
              Connecté en tant que
            </div>
            <Select
              value={activeRole}
              onValueChange={(value) => setActiveRole(value as AppRole)}
              disabled={isFixedMagasinier}
            >
              <SelectTrigger className="w-full lg:w-[340px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLES_CONFIG) as AppRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLES_CONFIG[role].label} —{" "}
                    {ROLES_CONFIG[role].defaultEmployeeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="w-fit shrink-0">
              Session : {sessionName}
            </Badge>

            {/* Notifications dérivées du rôle actif (Étape 5) : indicateur
                d'état recalculé, sans « lu/non lu » stocké */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-background hover:bg-accent transition-colors ml-auto lg:ml-4"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 bg-red-500 text-white rounded-full text-[10px] font-semibold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-semibold">
                    En attente — {ROLES_CONFIG[activeRole].label}
                  </span>
                </div>
                <div className="max-h-72 overflow-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Aucune action en attente pour ce rôle.
                    </div>
                  ) : (
                    notifications.map((n: NotificationEtape) => {
                      const e = entreesChargees?.find((ent) => ent.id === n.entreeId);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (e) handleSelectionnerEntree(e);
                          }}
                          className="px-3 py-2.5 border-b border-border/60 last:border-0 hover:bg-muted/60 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            {n.type === "ecart" ? (
                              <Lock className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            ) : n.type === "reception_confirmee" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                            ) : (
                              <ClipboardCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug">
                                {n.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {n.body}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(n.date).toLocaleString("fr-FR")}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <p className="text-xs text-muted-foreground hidden xl:block">
              Étape 1 & 3 : Dépositaire · Étape 2 : Magasinier.
            </p>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Circuit complet et indicateur 4 étapes : réservés à l'admin — les
          rôles métier connectés ne voient que LEURS onglets. */}
      {!isMagasinierSession && !isFixedDepositaire && !isFixedLogistique && (
        <>
          {/* Suivi de la répartition des rôles */}
          <RoleWorkflowStatus
            data={receptionData}
            activeRole={activeRole}
            currentStep={currentStep}
            onGoToStep={(step) => setCurrentStep(step)}
          />

          {/* Step indicator */}
          <StepIndicator currentStep={currentStep} steps={STEP_LABELS} />
        </>
      )}

      {/* File de traitement vide : pas d'étape de travail sans pièce à traiter. */}
      {fileDeTraitementVide ? (
        <Card className="print-hidden">
          <CardContent className="py-12 text-center space-y-3">
            <PackageCheck className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Aucune entrée à traiter</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {piecesEnAttente.length > 0
                ? "Toutes les entrées en circulation sont à une autre étape du circuit. Vous serez prévenu dès qu'une pièce arrivera à votre tour."
                : "Toutes les entrées dont vous avez la charge sont traitées. L'écran se mettra à jour automatiquement dès qu'une nouvelle pièce vous sera confiée."}
            </p>
            <Button
              variant="outline"
              onClick={() => setVue("traites")}
              className="gap-1.5"
            >
              <ClipboardCheck className="h-4 w-4" />
              Consulter mes articles traités
            </Button>
          </CardContent>
        </Card>
      ) : (
      <>
      {/* Vue simplifiée du magasinier : SON onglet uniquement */}
      {isMagasinierSession && !step1Complete(receptionData) && (
        <MagasinierLockedNotice depositaireName={depositaireName} />
      )}
      {isMagasinierSession &&
        step1Complete(receptionData) &&
        !receptionData.magasinierCertifie && (
          <Step2ControleMagasinier
            data={receptionData}
            extra={extra}
            onChange={handleDataChange}
            canEdit={canPerformStepAction(activeRole, 2)}
            requiredRoleLabel={ROLES_CONFIG.magasinier.label}
            depositaireName={depositaireName}
            articlesIncomplets={articlesIncomplets}
            certifying={isSubmitting}
          />
        )}
      {isMagasinierSession &&
        step1Complete(receptionData) &&
        receptionData.magasinierCertifie && (
          <MagasinierDoneCard
            numeroBL={receptionData.numeroBL}
            onOpenJournal={() => onNavigate?.("journal")}
            onOpenPV={() => setCurrentStep(4)}
          />
        )}
      {!isMagasinierSession && currentStep === 1 && (
        <Step1BonLivraison
          data={receptionData}
          onChange={handleDataChange}
          canEdit={canPerformStepAction(activeRole, 1)}
          requiredRoleLabel={ROLES_CONFIG.depositaire.label}
        />
      )}
      {/* Dépositaire connecté : à l'étape 2 il n'a rien à faire — écran
          d'attente dédié au lieu du formulaire de contrôle du magasinier. */}
      {!isMagasinierSession && isFixedDepositaire && currentStep === 2 && (
        <DepositaireWaitingCard
          numeroBL={receptionData.numeroBL}
          magasinierName={magasinierName}
          onEditBL={() => setCurrentStep(1)}
        />
      )}
      {!isMagasinierSession && !isFixedDepositaire && currentStep === 2 && (
        <Step2ControleMagasinier
          data={receptionData}
          extra={extra}
          onChange={handleDataChange}
          canEdit={canPerformStepAction(activeRole, 2)}
          requiredRoleLabel={ROLES_CONFIG.magasinier.label}
          depositaireName={depositaireName}
          articlesIncomplets={articlesIncomplets}
          certifying={isSubmitting}
        />
      )}
      {!isMagasinierSession && currentStep === 3 && (
        canPerformStepAction(activeRole, 3) ? (
          <Step3SignatureLogistique
            data={receptionData}
            logistiqueCertifie={logistiqueCertifie}
            onCertifier={handleCertifierLogistique}
            certifying={isSubmitting}
          />
        ) : (
          <Step3WaitingLogistique
            numeroBL={receptionData.numeroBL}
            logistiqueName={logistiqueName}
          />
        )
      )}
      {!isMagasinierSession && currentStep === 4 && (
        <Step4PVReception
          data={receptionData}
          extra={extra}
          entreeServeur={entreeServeur}
          magasinierName={magasinierName}
          depositaireName={depositaireName}
          logistiqueName={logistiqueName}
          onOpenJournal={() => onNavigate?.("journal")}
          onChange={handleDataChange}
          canEditCertification={canPerformStepAction(activeRole, 4)}
          requiredRoleLabel={ROLES_CONFIG.depositaire.label}
        />
      )}

      {/* Dépositaire connecté : une seule action contextuelle à la fois
          (transmission du BL à l'étape 1 ; signature FINALE à l'étape 4 si les
          2 précédentes sont posées — le serveur valide à 3/3 et impacte le
          stock une seule fois). */}
      {isFixedDepositaire && (currentStep === 1 || currentStep === 4) && (
        <div className="print-hidden flex justify-end pt-4 border-t border-border">
          <Button
            onClick={goNext}
            disabled={!canProceed || isSubmitting}
            className="gap-2"
          >
            {currentStep === 1
              ? isSubmitting
                ? "Création de l'entrée..."
                : "Transmettre au magasin"
              : isSubmitting
              ? "Validation finale..."
              : "Signer la validation finale"}
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Magasinier connecté : la case « Le magasinier certifie la réception
          physique » ne pose qu'un état LOCAL (onChange). Sans ce bouton,
          goNext() restait INATTEIGNABLE en session magasinier — les trois
          autres boutons sont réservés au dépositaire, à la logistique et à
          l'admin — donc la signature chef_service_1 n'était jamais envoyée :
          le serveur gardait chef_service_1_signed = false et le chef
          logistique voyait la pièce « bloquée par : contrôle magasinier ».
          Le bouton n'apparaît qu'une fois la case cochée. */}
      {isMagasinierSession && currentStep === 2 && receptionData.magasinierCertifie && (
        <div className="print-hidden flex justify-end pt-4 border-t border-border">
          <Button
            onClick={goNext}
            disabled={!canProceed || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <span>Certification en cours...</span>
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              <>
                <span>Certifier la réception physique (1/3)</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}

      {/* Chef logistique connecté : action contextuelle de validation à l'étape 3 */}
      {isFixedLogistique && currentStep === 3 && (
        <div className="print-hidden flex justify-end pt-4 border-t border-border">
          <Button
            onClick={goNext}
            disabled={!canProceed || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <span>Validation logistique...</span>
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              <>
                <span>Certifier le circuit et signer (2/3)</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
      </>
      )}

      {/* Navigation complète — réservée à l'admin (les rôles métier n'ont pas
          de Précédent/Suivant entre les étapes des autres) */}
      {!isMagasinierSession && !isFixedDepositaire && !isFixedLogistique && (
      <div className="print-hidden flex items-center justify-between pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Précédent
        </Button>

        <div className="text-sm text-muted-foreground">
          Étape {currentStep} / {STEP_LABELS.length}
        </div>

        {currentStep < 4 ? (
          <Button
            onClick={goNext}
            disabled={!canProceed || isSubmitting}
            className="gap-2"
          >
            {currentStep === 3 ? "Valider l'enregistrement" : "Suivant"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={handleNewReception}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle réception
          </Button>
        )}
      </div>
      )}
    </div>
  );
}
