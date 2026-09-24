import { useEffect, useState, useMemo } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Lock,
  Package,
  Plus,
  Printer,
  Save,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { User } from "../App";
import {
  BonLivraisonArticle,
  ControleArticle,
  EtatConstate,
  ReceptionData,
} from "../types/accounting";
import { AppRole, ROLES_CONFIG } from "../types/roles";
import {
  DENIED_ACTION_MESSAGE,
  canPerformStepAction,
  getSessionUserName,
  guardReceptionUpdate,
  loadPersistedReception,
  persistReception,
  resolveActiveRole,
} from "../lib/role-access";
import { appendJournalEntryFromReception, journalEntryExists } from "../lib/journal-store";
import {
  AppNotification,
  countUnread,
  getNotificationsForRole,
  markAllRead,
  pushNotification,
} from "../lib/notifications";

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

const STEP_LABELS = [
  "Bon de livraison",
  "Contrôle magasinier",
  "Enregistrement dépositaire",
  "PV de réception",
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
    magasinierCertifie: false,
    depositaireCertifie: false,
    journalEntryId: generateJournalEntryId(),
  };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function generateArticleId() {
  return `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateJournalEntryId() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 900 + 100); // 3-digit random for demo
  return `JE-${year}-${String(seq).padStart(4, "0")}`;
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
      ownerRole: "depositaire",
      state: !s2
        ? "verrouillee"
        : data.depositaireCertifie
        ? "terminee"
        : mine("depositaire")
        ? "a_faire_vous"
        : "a_faire_autre",
      detail: !s2
        ? "En attente de la certification magasinier"
        : data.depositaireCertifie
        ? `Écriture ${data.journalEntryId} générée`
        : "Enregistrement au journal à valider",
    },
    {
      step: 4,
      label: STEP_LABELS[3],
      ownerRole: null,
      state: s3 ? "disponible" : "verrouillee",
      detail: s3 ? "PV consultable et imprimable" : "Généré après l'étape 3",
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
      if (!data.depositaireCertifie) return 3;
      return 4;
    case "magasinier":
      if (!s1) return 1; // en attente du dépositaire (lecture seule)
      return 2;
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
        <CardContent>
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
                        <TableCell>
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
// ÉTAPE 2 — Contrôle magasinier (BL et articles en lecture seule ;
// l'état et la conformité sont vérifiés par le magasinier)
// ──────────────────────────────────────────────

function Step2ControleMagasinier({
  data,
  onChange,
  canEdit,
  requiredRoleLabel,
  depositaireName,
}: {
  data: ReceptionData;
  onChange: (d: Partial<ReceptionData>) => void;
  canEdit: boolean;
  requiredRoleLabel: string;
  depositaireName: string;
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
            {data.fournisseur}). Vérifiez l'état de chaque article livré.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.articles.map((article, index) => {
            const controle = data.controles.find(
              (c) => c.articleId === article.id
            );
            if (!controle) return null;
            return (
              <div key={article.id}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {article.designation}
                      </h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        {article.referenceNomenclature} — Qté livrée :{" "}
                        {article.quantiteLivree}
                      </p>
                    </div>
                    <Badge
                      className={
                        controle.conforme
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {controle.conforme ? "Conforme" : "Non vérifié"}
                    </Badge>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>État constaté</Label>
                      <Select
                        value={controle.etat}
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
                          <SelectValue />
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
                      <Label>Remarque</Label>
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
                        placeholder="Optionnel..."
                        className="h-9"
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
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

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
              disabled={!canEdit}
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

// ──────────────────────────────────────────────
// ÉTAPE 3 — Enregistrement dépositaire
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

  return (
    <div className="space-y-6">
      {!canEdit && <ReadOnlyNotice requiredRoleLabel={requiredRoleLabel} />}

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
      <Card
        className={`transition-all duration-300 ${
          data.depositaireCertifie
            ? "border-green-500 bg-green-50/50 dark:bg-green-950/20"
            : "border-orange-300 dark:border-orange-700"
        }`}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="certification-depositaire"
              checked={data.depositaireCertifie}
              onCheckedChange={(checked) =>
                onChange({ depositaireCertifie: checked === true })
              }
              disabled={!canEdit}
              className="mt-0.5"
            />
            <div>
              <Label
                htmlFor="certification-depositaire"
                className="text-sm font-semibold cursor-pointer"
              >
                Le dépositaire certifie l'enregistrement
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                En cochant cette case, je certifie que l'écriture ci-dessus est
                conforme au bon de livraison et peut être enregistrée au journal
                de comptabilité matière.
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
    </div>
  );
}

// ──────────────────────────────────────────────
// ÉTAPE 4 — PV de réception
// ──────────────────────────────────────────────

function Step4PVReception({
  data,
  magasinierName,
  depositaireName,
  onOpenJournal,
}: {
  data: ReceptionData;
  magasinierName: string;
  depositaireName: string;
  onOpenJournal: () => void;
}) {
  const totalValeur = data.articles.reduce(
    (sum, a) => sum + a.quantiteLivree * a.prixUnitaire,
    0
  );
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
                        {controle && (
                          <Badge
                            variant="secondary"
                            className={ETAT_COLORS[controle.etat]}
                          >
                            {ETAT_LABELS[controle.etat]}
                          </Badge>
                        )}
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

            <Separator />

            {/* Signatures */}
            <div className="grid sm:grid-cols-2 gap-6 pt-2">
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-center">
                  Le Magasinier
                </h4>
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Réception certifiée
                  </span>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {magasinierName}
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  {now}
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-center">
                  Le Dépositaire Comptable
                </h4>
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Enregistrement certifié
                  </span>
                </div>
                <div className="text-center text-sm text-muted-foreground">
                  {depositaireName}
                </div>
                <div className="text-center text-xs text-muted-foreground">
                  {data.dateEnregistrement
                    ? formatDateTime(data.dateEnregistrement)
                    : now}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="text-center text-xs text-muted-foreground print:text-gray-500">
            <div className="w-full text-center">
              Document généré le {now} — ComptaMatière © {new Date().getFullYear()}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Lien vers l'écriture réelle enregistrée au journal (étape 3) */}
      {journalEntryExists(data.journalEntryId) && (
        <Card className="print-hidden border-primary/30 bg-primary/5">
          <CardContent className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <span>
                Écriture{" "}
                <span className="font-mono font-semibold">
                  {data.journalEntryId}
                </span>{" "}
                enregistrée au journal de comptabilité matière.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenJournal}>
              Voir dans le journal
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

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

// ══════════════════════════════════════════════
// Composant principal — Orchestrateur
// ══════════════════════════════════════════════

export function MaterialEntry({ user, onNavigate }: MaterialEntryProps) {
  // Session simulée : sélecteur « Connecté en tant que ».
  // Initialisé sur le rôle de l'utilisateur réellement connecté (session App).
  const [activeRole, setActiveRole] = useState<AppRole>(() =>
    resolveActiveRole(user?.role)
  );

  // Réception en cours : reprend celle persistée si elle existe
  // (transmission simulée entre les deux postes), sinon état pré-rempli.
  const [receptionData, setReceptionData] = useState<ReceptionData>(() => {
    const persisted = loadPersistedReception();
    return persisted ?? createInitialData(true);
  });

// Chacun atterrit directement sur SON étape : le dépositaire sur la saisie du
  // BL (ou l'enregistrement si le magasinier a déjà certifié), le magasinier
  // sur le contrôle de l'état (ou l'étape 1 en lecture seule si le BL n'est
  // pas encore saisi).
  const [currentStep, setCurrentStep] = useState<number>(() =>
    getRoleHomeStep(resolveActiveRole(user?.role), loadPersistedReception() ?? createInitialData(true))
  );

  const sessionName = getSessionUserName(activeRole, user ?? null);
  const magasinierName = getSessionUserName("magasinier", user ?? null);
  const depositaireName = getSessionUserName("depositaire", user ?? null);

  // ─── Notifications du rôle actif ───
  // Un rôle ne voit que ses propres notifications (magasinier ≠ dépositaire).
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const refreshNotifications = (role: AppRole = activeRole) => {
    setNotifications(getNotificationsForRole(role));
  };

  useEffect(() => {
    refreshNotifications(activeRole);
    setNotifOpen(false);
    // Chacun joue son rôle : au changement de rôle, on repositionne sur son
    // étape d'accueil.
    setCurrentStep(getRoleHomeStep(activeRole, receptionData));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole]);

  const unreadCount = countUnread(activeRole);

  // When articles change, sync the controles list
  const handleDataChange = (partial: Partial<ReceptionData>) => {
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
      case 2:
        return receptionData.magasinierCertifie;
      case 3:
        return receptionData.depositaireCertifie;
      case 4:
        return true;
      default:
        return false;
    }
  }, [currentStep, receptionData]);

  const goNext = () => {
    if (currentStep >= 4) return;

    // Verrou logique sur la navigation aussi : un rôle ne peut pas valider
    // une étape qui n'est pas la sienne, même si les données le permettraient.
    if (!canPerformStepAction(activeRole, currentStep)) {
      const required =
        currentStep === 1 || currentStep === 3 ? "depositaire" : "magasinier";
      toast.error(DENIED_ACTION_MESSAGE, {
        description: `Étape réservée à : ${ROLES_CONFIG[required]?.label ?? "—"}.`,
      });
      return;
    }

    if (!canProceed) return;

    if (currentStep === 1) {
      // Transmission simulée : le magasinier retrouvera la liste à l'étape 2.
      persistReception(receptionData);
      pushNotification(
        "magasinier",
        "enregistrement",
        "Nouveau bon de livraison à contrôler",
        `${depositaireName} a saisi le BL ${receptionData.numeroBL} (${receptionData.articles.length} article(s)). Vérifiez l'état du matériel en magasin.`,
        receptionData.numeroBL
      );
      refreshNotifications();
    }

    if (currentStep === 2) {
      persistReception(receptionData);
      pushNotification(
        "depositaire",
        "reception_confirmee",
        "Réception physique certifiée",
        `${magasinierName} a contrôlé et certifié la réception du BL ${receptionData.numeroBL}. L'enregistrement au journal est en attente.`,
        receptionData.numeroBL
      );
      refreshNotifications();
    }

    if (currentStep === 3) {
      // Enregistrement : horodatage + écriture au journal + persistance +
      // notification au magasinier.
      const withDate: ReceptionData = {
        ...receptionData,
        dateEnregistrement: new Date().toISOString(),
      };
      setReceptionData(withDate);
      persistReception(withDate);

      // Écriture RÉELLE au journal comptable (une ligne par article) —
      // visible dans Journal.tsx pour tous les rôles. Idempotent.
      const journalLines = appendJournalEntryFromReception(withDate, {
        createdBy: depositaireName,
        controlePar: magasinierName,
      });

      pushNotification(
        "magasinier",
        "enregistrement",
        "Écriture générée au journal",
        `L'écriture ${withDate.journalEntryId} (BL ${withDate.numeroBL}) a été enregistrée par ${depositaireName}. Le PV de réception est disponible.`,
        withDate.numeroBL
      );
      refreshNotifications();
      toast.success("Enregistrement validé", {
        description: journalLines
          ? `Écriture ${withDate.journalEntryId} enregistrée au journal (${journalLines.length} ligne(s)).`
          : `Écriture ${withDate.journalEntryId} générée au journal.`,
      });
    }

    setCurrentStep((s) => s + 1);
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleNewReception = () => {
    const fresh = createInitialData(false);
    setReceptionData(fresh);
    setCurrentStep(getRoleHomeStep(activeRole, fresh));
  };

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
            Enregistrement d'une arrivée de matériel en {STEP_LABELS.length}{" "}
            étapes
          </p>
        </div>
        {currentStep === 4 && (
          <Button variant="outline" onClick={handleNewReception} className="print-hidden">
            Nouvelle réception
          </Button>
        )}
      </div>

      {/* Simulateur de session — Connecté en tant que */}
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

            {/* Notifications du rôle actif */}
            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
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
                    Notifications — {ROLES_CONFIG[activeRole].label}
                  </span>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        markAllRead(activeRole);
                        refreshNotifications();
                      }}
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Aucune notification pour ce rôle.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-3 py-2.5 border-b border-border/60 last:border-0 ${
                          !n.read ? "bg-primary/5" : ""
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
                          <div className="min-w-0">
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
                    ))
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

      {/* Suivi de la répartition des rôles */}
      <RoleWorkflowStatus
        data={receptionData}
        activeRole={activeRole}
        currentStep={currentStep}
        onGoToStep={(step) => setCurrentStep(step)}
      />

      {/* Step indicator */}
      <StepIndicator currentStep={currentStep} steps={STEP_LABELS} />

      {/* Step content */}
      {currentStep === 1 && (
        <Step1BonLivraison
          data={receptionData}
          onChange={handleDataChange}
          canEdit={canPerformStepAction(activeRole, 1)}
          requiredRoleLabel={ROLES_CONFIG.depositaire.label}
        />
      )}
      {currentStep === 2 && (
        <Step2ControleMagasinier
          data={receptionData}
          onChange={handleDataChange}
          canEdit={canPerformStepAction(activeRole, 2)}
          requiredRoleLabel={ROLES_CONFIG.magasinier.label}
          depositaireName={depositaireName}
        />
      )}
      {currentStep === 3 && (
        <Step3EnregistrementDepositaire
          data={receptionData}
          onChange={handleDataChange}
          canEdit={canPerformStepAction(activeRole, 3)}
          requiredRoleLabel={ROLES_CONFIG.depositaire.label}
        />
      )}
      {currentStep === 4 && (
        <Step4PVReception
          data={receptionData}
          magasinierName={magasinierName}
          depositaireName={depositaireName}
          onOpenJournal={() => onNavigate?.("journal")}
        />
      )}

      {/* Navigation — hidden on print */}
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
            disabled={!canProceed}
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
    </div>
  );
}
