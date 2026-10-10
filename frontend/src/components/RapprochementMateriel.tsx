import { useMemo, type ReactNode } from "react";
import { AlertTriangle, Link2, PackagePlus, Search } from "lucide-react";
import type { MaterialOption } from "../lib/api";
import { trouverRapprochements } from "../lib/rapprochement";
import { MaterialPhoto } from "./MaterialPhoto";

/**
 * Écran de SUGGESTION de rapprochement à la saisie d'une ligne d'entrée.
 *
 * Quand une désignation est tapée, on cherche les matériels existants par
 * ressemblance APPROXIMATIVE (casse, espaces, variations proches — cf.
 * lib/rapprochement.ts) et on PROPOSE un choix explicite. L'outil ne fait que
 * suggérer : l'utilisateur tranche toujours, rien n'est lié automatiquement.
 *
 *   • « Oui, c'est le même article »  → la ligne est rattachée à la fiche
 *     existante DÈS la saisie (entree_ligne.materiel), pas à la 3ᵉ signature.
 *   • « Non, c'est un nouvel article » → une fiche material est créée
 *     immédiatement avec la nomenclature choisie : plus de ligne orpheline.
 *
 * Présentation (design) : panneau autonome, pleine largeur de la cellule, avec
 *   1. un bandeau d'en-tête (pastille + titre + description),
 *   2. le contenu (candidats / état vide),
 *   3. l'action principale pleine largeur et l'éventuel rappel de prérequis.   * Les textes, identifiants de test et callbacks sont INCHANGÉS : seule la
   * mise en forme CSS évolue (encadrement plus serré, polices + espacement
   * réduits).
 */

/* ─────────────────────────── Fragments partagés ─────────────────────────── */

/** Pastille carrée d'icône — rythme visuel commun à tous les états. */
function Pastille({
  ton = "neutre",
  children,
}: {
  ton?: "neutre" | "ambre" | "vert" | "bleu";
  children: ReactNode;
}) {
  const tons = {
    neutre:
      "border-border bg-background text-muted-foreground shadow-sm",
    ambre:
      "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    vert: "border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950/60 dark:text-green-300",
    bleu: "border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  } as const;
  return (
    <span
      aria-hidden="true"
      className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${tons[ton]}`}
    >
      {children}
    </span>
  );
}

/** Rappel de prérequis (nomenclature) — ton attention, jamais bloquant visuel. */
function NotePrerequis({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Action secondaire standardisée (focus visible, hover doux, disabled clair). */
const CLASSES_BOUTON =
  "inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50";

export function RapprochementMateriel({
  articleId,
  designation,
  materiels,
  nomenclature,
  materielId,
  materielLien,
  materielDesignationLiee,
  peutModifier = true,
  creationEnCours = false,
  onConfirmerExistant,
  onNouvelArticle,
  onAnnulerLien,
}: {
  articleId: string;
  designation: string;
  materiels: MaterialOption[];
  /** Code de nomenclature (03/05/10) saisi sur la ligne — requis pour créer. */
  nomenclature?: string;
  materielId?: string;
  materielLien?: "existant" | "nouveau";
  materielDesignationLiee?: string;
  peutModifier?: boolean;
  creationEnCours?: boolean;
  onConfirmerExistant: (materiel: MaterialOption) => void;
  onNouvelArticle: () => void;
  onAnnulerLien?: () => void;
}) {
  // La proposition n'est recalculée que si le texte n'a PAS changé depuis la
  // décision : sinon on rouvrirait la question sur une ligne déjà tranchée.
  const decisionValide =
    !!materielId &&
    !!materielLien &&
    (materielDesignationLiee ?? "") === designation;

  const candidats = useMemo(
    () => (decisionValide ? [] : trouverRapprochements(designation, materiels)),
    [designation, materiels, decisionValide]
  );

  const materielLie = materiels.find((m) => m.documentId === materielId);

  // ── Décision déjà prise : retour visuel + lien explicite ────────────────
  if (decisionValide && materielLien === "existant") {
    return (
      <div
        data-testid={`rapprochement-lie-${articleId}`}
        className="mt-1 w-full rounded-lg border border-green-300/70 bg-green-50/80 p-2.5 dark:border-green-900 dark:bg-green-950/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pastille ton="vert">
            <Link2 className="h-3 w-3" />
          </Pastille>
          <span className="min-w-0 flex-1 text-[11px] leading-snug text-green-800 dark:text-green-300">
            Lié au matériel existant «{" "}
            <span className="font-semibold">{materielDesignationLiee}</span> »
            {materielLie
              ? ` (${materielLie.quantiteStock ?? 0} unités en stock)`
              : ""}
          </span>
          {peutModifier && onAnnulerLien && (
            <button
              type="button"
              onClick={onAnnulerLien}
              className={`${CLASSES_BOUTON} border-green-300 bg-background/70 text-green-800 hover:bg-background dark:border-green-800 dark:text-green-300`}
            >
              Changer de matériel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (decisionValide && materielLien === "nouveau") {
    return (
      <div
        data-testid={`rapprochement-nouveau-${articleId}`}
        className="mt-1 w-full rounded-lg border border-blue-300/70 bg-blue-50/80 p-2.5 dark:border-blue-900 dark:bg-blue-950/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Pastille ton="bleu">
            <PackagePlus className="h-3 w-3" />
          </Pastille>
          <span className="min-w-0 flex-1 text-[11px] leading-snug text-blue-800 dark:text-blue-300">
            Nouvel article créé : «{" "}
            <span className="font-semibold">{materielDesignationLiee}</span> »
            {nomenclature ? ` — nomenclature ${nomenclature}` : ""}
          </span>
        </div>
      </div>
    );
  }

  if (!peutModifier) return null;
  const texte = designation.trim();
  if (texte.length < 3) return null;

  const nomenclatureManquante = !nomenclature;

  return (
    <div className="mt-1 w-full space-y-1.5">
      {candidats.length > 0 && (
        <div
          role="status"
          data-testid={`suggestion-rapprochement-${articleId}`}
          className="w-full space-y-2 rounded-lg border border-amber-300/70 bg-amber-50/70 p-2.5 shadow-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          {/* En-tête : pastille + intitulé de la situation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Pastille ton="ambre">
                <Search className="h-3 w-3" />
              </Pastille>
              <p className="min-w-0 text-[11px] font-semibold leading-snug text-amber-900 dark:text-amber-200">
                {candidats.length > 1
                  ? `${candidats.length} matériels proches trouvés en stock — choisissez :`
                  : "Correspondance proche trouvée en stock :"}
              </p>
            </div>
            {nomenclatureManquante && (
              <NotePrerequis>
                Sélectionnez d'abord la nomenclature (03 / 05 / 10) de cet article
                pour créer sa fiche.
              </NotePrerequis>
            )}
          </div>

          <ul className="space-y-1.5">
            {candidats.map(({ materiel }) => (
              <li
                key={materiel.documentId}
                className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2.5 rounded-md border border-amber-200/80 bg-background/80 p-2 dark:border-amber-900 dark:bg-black/25"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MaterialPhoto
                    photo={materiel.photos?.[0]}
                    designation={materiel.designation}
                    className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-border"
                  />
                  <p className="min-w-[170px] flex-1 text-[11px] leading-snug text-foreground">
                    Ce matériel ressemble à{" "}
                    <span className="font-semibold">{materiel.designation}</span>{" "}
                    déjà en stock ({materiel.quantiteStock ?? 0} unités) —
                    s'agit-il du même article ?
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onConfirmerExistant(materiel)}
                    className={`${CLASSES_BOUTON} border-green-600 bg-green-600 text-white hover:border-green-700 hover:bg-green-700`}
                  >
                    Oui, c'est le même article
                  </button>
                  <button
                    type="button"
                    onClick={onNouvelArticle}
                    disabled={creationEnCours || nomenclatureManquante}
                    className={`${CLASSES_BOUTON} border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5`}
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    Non, c'est un nouvel article
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidats.length === 0 && (
        <div
          data-testid={`rapprochement-aucun-${articleId}`}
          className="w-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-2.5"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
            {/* En-tête : situation expliquée en un coup d'œil */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <Search className="h-3 w-3" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-semibold leading-tight text-foreground">
                  Aucun matériel proche en stock
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Aucun article existant ne ressemble à cette désignation : la
                  ligne sera rattachée à une{" "}
                  <span className="font-medium text-foreground">
                    nouvelle fiche matériel
                  </span>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {nomenclatureManquante && (
                <div className="flex items-center gap-1.5 rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1 text-[11px] leading-snug text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>Nomenclature requise (03 / 05 / 10) pour créer la fiche.</span>
                </div>
              )}
              <button
                type="button"
                onClick={onNouvelArticle}
                disabled={creationEnCours || nomenclatureManquante}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Créer la fiche matériel (nouvel article)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
