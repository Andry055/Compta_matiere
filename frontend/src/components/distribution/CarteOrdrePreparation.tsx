import React from "react";
import { FileText, PenLine } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { RejeterOrdreDialog } from "./RejeterOrdreDialog";
import { PreparationOrdreSortie } from "./PreparationOrdreSortie";
import "./EspaceMagasinierSorties.css";

interface CarteOrdrePreparationProps {
  sortie: SortieRecord;
  /** Appelé après un rejet enregistré : l'ordre quitte « À préparer ». */
  onRejetee?: (sortie: SortieRecord) => void;
  /** Appelé après la signature 1 (magasinier) enregistrée. */
  onSuccess?: (sortie: SortieRecord) => void;
  /** Appelé quand la signature n'a pas pu être enregistrée. */
  onError?: (error: string) => void;
  /** Lecture seule (onglet « Déjà traités ») : aucune action proposée. */
  lectureSeule?: boolean;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("fr-FR");
}

/** Destination lisible : direction · service · bénéficiaire (sans « — » parasite). */
function destinationDe(sortie: SortieRecord): string {
  return (
    [sortie.direction, sortie.serviceDemandeur, sortie.beneficiaire]
      .filter((partie) => Boolean(partie) && partie !== "—")
      .join(" · ") || "—"
  );
}

export function CarteOrdrePreparation({
  sortie,
  onRejetee,
  onSuccess,
  onError,
  lectureSeule = false,
}: CarteOrdrePreparationProps) {
  const lignes = sortie.lignes ?? [];
  const nbLignes = lignes.length;
  const totalQuantites = nbLignes
    ? lignes.reduce((total, ligne) => total + (Number(ligne.quantite) || 0), 0)
    : sortie.quantite;

  return (
    <li className="msa-carte">
      <div className="msa-carte-entete">
        <h3 className="msa-ref">{sortie.reference}</h3>
        {lectureSeule ? (
          <span className="msa-badge">{sortie.statut}</span>
        ) : (
          <span className="msa-badge msa-badge--attente">En attente — signature 1</span>
        )}
      </div>

      <div className="msa-champs">
        <div className="msa-champ">
          <p className="msa-champ-cle">Date :</p>
          <p className="msa-champ-valeur">{formatDate(sortie.dateSortie)}</p>
        </div>
        <div className="msa-champ">
          <p className="msa-champ-cle">Destination :</p>
          <p className="msa-champ-valeur">{destinationDe(sortie)}</p>
        </div>
        <div className="msa-champ">
          <p className="msa-champ-cle">Pièce justificative :</p>
          <p className="msa-champ-valeur">
            <FileText
              style={{ width: 13, height: 13, display: "inline", verticalAlign: "-2px" }}
              aria-hidden="true"
            />{" "}
            {sortie.justificatif && sortie.justificatif !== "—" ? sortie.justificatif : "—"}
          </p>
        </div>
        <div className="msa-champ">
          <p className="msa-champ-cle">Lignes :</p>
          <p className="msa-champ-valeur">
            {nbLignes > 0 ? nbLignes : "—"} · {totalQuantites} unité(s) au total
          </p>
        </div>
      </div>

      {!lectureSeule && (
        <div className="msa-actions">
          {/* Le déclencheur « Préparer et signer » ouvre la fenêtre modale de signature 1. */}
          <PreparationOrdreSortie
            sortie={sortie}
            onSuccess={onSuccess}
            onError={onError}
            lectureSeule={lectureSeule}
          />
          <RejeterOrdreDialog
            sortie={sortie}
            onSortieRejectee={(rejetee) => onRejetee?.(rejetee)}
            onClose={() => undefined}
          />
        </div>
      )}

      {lectureSeule && (
        <div className="msa-champs">
          <div className="msa-champ">
            <p className="msa-champ-cle">Progression des signatures :</p>
          </div>
          <div className="msa-champ">
            <p className="msa-champ-valeur">
              Magasinier : {sortie.magasinier_signed ? "✓" : "○"} · Dépositaire :{" "}
              {sortie.depositaire_signed ? "✓" : "○"} · Logistique :{" "}
              {sortie.logistique_signed ? "✓" : "○"}
            </p>
          </div>
        </div>
      )}
    </li>
  );
}
