import React from "react";
import { FileText, Truck, CheckCircle } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { RejeterOrdreDialog } from "./RejeterOrdreDialog";
import { totalValorise } from "@/lib/sortieControle";
import "./EspaceLogistiqueSorties.css";

interface CarteOrdreAutorisationProps {
  sortie: SortieRecord;
  /** Ouvre le panneau d'autorisation sous la carte (onglet « À autoriser »). */
  onAutoriser?: (sortie: SortieRecord) => void;
  /** Appelé après un rejet enregistré : l'ordre quitte « À autoriser ». */
  onRejeter?: (sortie: SortieRecord) => void;
  /** Panneau d'autorisation à afficher sous la carte. */
  panneau?: React.ReactNode;
  /** Lecture seule (onglets « En amont » et « Autorisées ») : aucune action proposée. */
  lectureSeule?: boolean;
  /** Lorsque true, désactive le bouton « Contrôler et autoriser » pour empêcher l'ouverture d'un autre panneau pendant qu'une boîte de diálogo est ouverte. */
  desactive?: boolean;
}

/** Destination lisible : direction · service · bénéficiaire (sans « — » parasite). */
function destinationDe(sortie: SortieRecord): string {
  return (
    [sortie.direction, sortie.serviceDemandeur, sortie.beneficiaire]
      .filter((partie) => Boolean(partie) && partie !== "—")
      .join(" · ") || "—"
  );
}

/** Date lisible au format fr-FR. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("fr-FR");
}

export function CarteOrdreAutorisation({
  sortie,
  onAutoriser,
  onRejeter,
  panneau,
  lectureSeule = false,
  desactive = false,
}: CarteOrdreAutorisationProps) {
  const lignes = sortie.lignes ?? [];
  const nbLignes = lignes.length;
  const totalQuantites = nbLignes
    ? lignes.reduce((total, ligne) => total + (Number(ligne.quantite) || 0), 0)
    : sortie.quantite;
  const totalFinancier = totalValorise(sortie);

  return (
    <li className="msa-carte">
      <div className="msa-carte-entete">
        <h3 className="msa-ref">{sortie.reference}</h3>
        {lectureSeule ? (
          <>
            {sortie.statut === "Validée" && (
              <span className="msa-badge msa-badge--attente">
                <span>Validée</span> — <span>en attente de remise</span>
              </span>
            )}
            {sortie.statut === "Sortie effectuée" && (
              <span className="msa-badge msa-badge--success">Sortie effectuée</span>
            )}
          </>
        ) : (
          <span className="msa-badge msa-badge--attente">Signatures 1 et 2 posées</span>
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
        <div className="msa-champ">
          <p className="msa-champ-cle">Valeur totale :</p>
          <p className="msa-champ-valeur">
            {totalFinancier.toLocaleString()} FCFA
          </p>
        </div>
        <div className="msa-champ">
          <p className="msa-champ-cle">Signataire magasinier :</p>
          <p className="msa-champ-valeur">
            {sortie.signataireMagasinier || "—"}
          </p>
        </div>
        <div className="msa-champ">
          <p className="msa-champ-cle">Signataire dépositaire :</p>
          <p className="msa-champ-valeur">
            {sortie.signataireDepositaire || "—"}
          </p>
        </div>
      </div>

      {!lectureSeule && (
        <div className="msa-actions">
          <button
            type="button"
            className="msa-bouton msa-bouton--primaire"
            onClick={() => onAutoriser?.(sortie)}
            aria-expanded={Boolean(panneau)}
            disabled={desactive}
          >
            Contrôler et autoriser
          </button>
          <RejeterOrdreDialog
            sortie={sortie}
            onSortieRejectee={(rejetee) => onRejeter?.(rejetee)}
            onClose={() => undefined}
          />
        </div>
      )}

      {lectureSeule && (
        <div className="msa-champs">
          {sortie.statut === "Validée" && (
            <div className="msa-champ">
              <p className="msa-champ-cle">Validée le :</p>
              <p className="msa-champ-valeur">
                {sortie.dateSignatureLogistique
                  ? formatDate(sortie.dateSignatureLogistique)
                  : "—"}
              </p>
            </div>
          )}
          {sortie.statut === "En préparation" && (
            <div className="msa-champ">
              <p className="msa-champ-cle">Étape en attente :</p>
              <p className="msa-champ-valeur">
                {!sortie.magasinier_signed
                  ? "Signature 1 : magasinier"
                  : !sortie.depositaire_signed
                  ? "Signature 2 : dépositaire"
                  : "Signature 3 : chef logistique"}
              </p>
            </div>
          )}
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

      {panneau}
    </li>
  );
}