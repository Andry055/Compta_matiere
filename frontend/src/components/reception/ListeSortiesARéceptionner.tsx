import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { SortieRecord } from "@/lib/movements";
import { getReliquat, getStatutRéceptionSortie } from "@/lib/movements";
import { type ReceptionPhysiqueRecord } from "@/lib/api";
import {
  Package,
  Clock,
  User as UserIcon,
  Calendar,
  AlertTriangle,
  Plus,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

interface ListeSortiesARéceptionnerProps {
  sorties: SortieRecord[];
  user?: { role?: string };
  receptionsServeur?: ReceptionPhysiqueRecord[];
  onRecevoir: (sortie: SortieRecord) => void;
  onAnomalie: (sortie: SortieRecord) => void;
}

const STATUT_BADGE_COLOR: Record<string, string> = {
  "En cours": "text-blue-700",
  Partielle: "text-yellow-700",
  Complète: "text-green-700",
  Annulée: "text-red-700",
};

export function ListeSortiesARéceptionner({
  sorties,
  user,
  receptionsServeur,
  onRecevoir,
  onAnomalie,
}: ListeSortiesARéceptionnerProps) {
  const sortiesTriees = useMemo(
    () => [...sorties].sort((a, b) => (a.dateSortie < b.dateSortie ? 1 : -1)),
    [sorties]
  );

  if (sortiesTriees.length === 0) {
    return (
      <div className="msc-empty">
        <Package className="msc-empty__icon" aria-hidden="true" />
        <h3 className="msc-empty__title">Aucune sortie à réceptionner</h3>
        <p className="msc-empty__description">
          Aucune sortie effectuée avec trois signatures pour votre direction n'attend de réception.
        </p>
      </div>
    );
  }

  return (
    <div className="msc-list" role="list" aria-label="Sorties à réceptionner">
      {sortiesTriees.map((sortie) => {
        const reliquat = getReliquat(sortie, receptionsServeur);
        const statutRéception = getStatutRéceptionSortie(sortie, receptionsServeur);
        const troisSignatures =
          sortie.magasinier_signed && sortie.depositaire_signed && sortie.logistique_signed;

        return (
          <Card
            key={sortie.id}
            className="msc-card"
          >
            <div className="msc-card__header">
              <div className="msc-card__title-row">
                <h3 className="msc-card__reference">{sortie.reference}</h3>
                <p className="msc-card__meta">
                  {sortie.materiel} • {sortie.categorie}
                </p>
              </div>
              <div className="msc-card__badges">
                <span className={`msc-badge ${troisSignatures ? "msc-badge--success" : "msc-badge--warning"}`}>
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  {troisSignatures ? "3 signatures OK" : "Signatures manquantes"}
                </span>
              </div>
            </div>
            <div className="msc-card__body">
              <div className="msc-grid">
                <div className="msc-field">
                  <span className="msc-field__label">Quantité prévue</span>
                  <span className="msc-field__value">
                    {sortie.quantite} unité(s)
                  </span>
                </div>
                <div className="msc-field">
                  <span className="msc-field__label">Reliquat</span>
                  <span className="msc-field__value msc-field__value--primary">
                    {reliquat} unité(s)
                  </span>
                </div>
                <div className="msc-field">
                  <span className="msc-field__label">Direction</span>
                  <span className="msc-field__value msc-field__value--muted">{sortie.direction}</span>
                </div>
                <div className="msc-field">
                  <span className="msc-field__label">Bénéficiaire</span>
                  <span className="msc-field__value msc-field__value--muted">{sortie.beneficiaire}</span>
                </div>
                <div className="msc-field">
                  <span className="msc-field__label">Date de sortie</span>
                  <span className="msc-field__value msc-field__value--muted">
                    {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="msc-field">
                  <span className="msc-field__label">Responsable</span>
                  <span className="msc-field__value msc-field__value--muted">{sortie.responsable}</span>
                </div>
                {sortie.lignes && sortie.lignes.length > 0 && sortie.lignes.some((l) => l.detenteur) && (() => {
                  const detenteurs = sortie.lignes.filter((l) => l.detenteur).map((l) => l.detenteur);
                  return (
                    <div className="msc-field">
                      <span className="msc-field__label">Détenteur(s)</span>
                      <span className="msc-field__value msc-field__value--muted">
                        {detenteurs.join("; ")}
                      </span>
                    </div>
                  );
                })()}
                <div className="msc-field">
                  <span className="msc-field__label">Statut réception</span>
                  <span className={`msc-field__value msc-field__value--muted ${STATUT_BADGE_COLOR[statutRéception]}`}>
                    {statutRéception}
                  </span>
                </div>
              </div>

              <div className="msc-card__actions">
                <div className={`msc-signatures ${troisSignatures ? "msc-signatures--complete" : "msc-signatures--incomplete"}`}>
                  {troisSignatures ? (
                    <>
                      <CheckCircle2 className="msc-signatures__icon" aria-hidden="true" />
                      Magasinier • Dépositaire • Logistique signés
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="msc-signatures__icon" aria-hidden="true" />
                      Signatures incomplètes
                    </>
                  )}
                </div>

                <div className="msc-card__actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                  {!troisSignatures || reliquat <= 0 ? (
                    <Button
                      disabled
                      variant="outline"
                      size="sm"
                      className="msc-btn msc-btn--outline msc-btn--sm opacity-50 cursor-not-allowed"
                    >
                      {!troisSignatures ? "Signatures requises" : "Tout réceptionné"}
                    </Button>
                  ) : (
                    <>
                      {user?.role === "depositaire" || user?.role === "demandeur" ? (
                        <Button
                          onClick={() => onRecevoir(sortie)}
                          size="sm"
                          className="msc-btn msc-btn--primary msc-btn--sm"
                        >
                          <Plus className="msc-btn__icon" aria-hidden="true" /> Recevoir
                        </Button>
                      ) : (
                        <Button
                          disabled
                          variant="outline"
                          size="sm"
                          className="msc-btn msc-btn--outline msc-btn--sm opacity-50 cursor-not-allowed"
                        >
                          <Plus className="msc-btn__icon" aria-hidden="true" /> Recevoir (dépositaire)
                        </Button>
                      )}
                      <Button
                        onClick={() => onAnomalie(sortie)}
                        variant="outline"
                        size="sm"
                        className="msc-btn msc-btn--outline msc-btn--sm"
                      >
                        <AlertTriangle className="msc-btn__icon" aria-hidden="true" /> Anomalie
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
