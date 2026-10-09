import { useMemo } from "react";
import { Link2, PackagePlus, Search } from "lucide-react";
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
 */
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
        className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Lié au matériel existant «{" "}
          <span className="font-semibold">{materielDesignationLiee}</span> »
          {materielLie ? ` (${materielLie.quantiteStock ?? 0} unités en stock)` : ""}
        </span>
        {peutModifier && onAnnulerLien && (
          <button
            type="button"
            onClick={onAnnulerLien}
            className="ml-auto underline hover:no-underline"
          >
            Changer de matériel
          </button>
        )}
      </div>
    );
  }

  if (decisionValide && materielLien === "nouveau") {
    return (
      <div
        data-testid={`rapprochement-nouveau-${articleId}`}
        className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-[11px] text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
      >
        <PackagePlus className="h-3.5 w-3.5 shrink-0" />
        <span>
          Nouvel article créé : «{" "}
          <span className="font-semibold">{materielDesignationLiee}</span> »
          {nomenclature ? ` — nomenclature ${nomenclature}` : ""}
        </span>
      </div>
    );
  }

  if (!peutModifier) return null;
  const texte = designation.trim();
  if (texte.length < 3) return null;

  const nomenclatureManquante = !nomenclature;

  return (
    <div className="mt-1.5 space-y-1.5">
      {candidats.length > 0 && (
        <div
          role="status"
          data-testid={`suggestion-rapprochement-${articleId}`}
          className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-2 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            <Search className="h-3.5 w-3.5 shrink-0" />
            {candidats.length > 1
              ? `${candidats.length} matériels proches trouvés en stock — choisissez :`
              : "Correspondance proche trouvée en stock :"}
          </p>
          <ul className="space-y-2">
            {candidats.map(({ materiel }) => (
              <li
                key={materiel.documentId}
                className="flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-white/60 p-2 dark:border-amber-900 dark:bg-black/20"
              >
                <MaterialPhoto
                  photo={materiel.photos?.[0]}
                  designation={materiel.designation}
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
                <p className="flex-1 min-w-[180px] text-[11px] text-foreground">
                  Ce matériel ressemble à{" "}
                  <span className="font-semibold">{materiel.designation}</span>{" "}
                  déjà en stock ({materiel.quantiteStock ?? 0} unités) —
                  s'agit-il du même article ?
                </p>
                <button
                  type="button"
                  onClick={() => onConfirmerExistant(materiel)}
                  className="rounded bg-green-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-green-700"
                >
                  Oui, c'est le même article
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onNouvelArticle}
            disabled={creationEnCours || nomenclatureManquante}
            className="rounded border border-amber-400 px-2.5 py-1.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-200"
          >
            Non, c'est un nouvel article
          </button>
          {nomenclatureManquante && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Sélectionnez d'abord la nomenclature (03 / 05 / 10) de cet article
              pour créer sa fiche.
            </p>
          )}
        </div>
      )}

      {candidats.length === 0 && (
        <div
          data-testid={`rapprochement-aucun-${articleId}`}
          className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-[11px] text-muted-foreground"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span>
            Aucun matériel proche en stock pour cette désignation. La ligne sera
            rattachée à une nouvelle fiche matériel.
          </span>
          <button
            type="button"
            onClick={onNouvelArticle}
            disabled={creationEnCours || nomenclatureManquante}
            className="ml-auto rounded border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PackagePlus className="mr-1 inline h-3 w-3 align-[-2px]" />
            Créer la fiche matériel (nouvel article)
          </button>
          {nomenclatureManquante && (
            <span className="w-full">
              Nomenclature requise (03 / 05 / 10) pour créer la fiche.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
