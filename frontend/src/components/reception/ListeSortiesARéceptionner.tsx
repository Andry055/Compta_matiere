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
} from "lucide-react";
import { toast } from "sonner";

interface ListeSortiesARéceptionnerProps {
  sorties: SortieRecord[];
  user?: { role?: string };
  receptionsServeur?: ReceptionPhysiqueRecord[];
  onRecevoir: (sortie: SortieRecord) => void;
  onAnomalie: (sortie: SortieRecord) => void;
}

const STATUT_SORTIE_BADGE: Record<string, string> = {
  "Sortie effectuée": "bg-green-50 text-green-700 border-green-200",
  Validée: "bg-blue-50 text-blue-700 border-blue-200",
  Demandée: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Annulée: "bg-red-50 text-red-700 border-red-200",
};

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
      <div className="msr-etat">
        <Package className="w-10 h-10 text-muted-foreground mb-2" />
        <h3 className="font-medium text-foreground mb-1">Aucune sortie à réceptionner</h3>
        <p className="text-sm text-muted-foreground">
          Aucune sortie effectuée avec trois signatures pour votre direction n'attend de réception.
        </p>
      </div>
    );
  }

  return (
    <div className="msr-liste">
      {sortiesTriees.map((sortie) => {
        const reliquat = getReliquat(sortie, receptionsServeur);
        const statutRéception = getStatutRéceptionSortie(sortie, receptionsServeur);
        const troisSignatures =
          sortie.magasinier_signed && sortie.depositaire_signed && sortie.logistique_signed;

        return (
          <Card
            key={sortie.id}
            className="msr-carte border border-border"
          >
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {sortie.reference}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {sortie.materiel} • {sortie.categorie}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      troisSignatures ? "default" : "secondary"
                    }
                    className={troisSignatures
                      ? "bg-green-50 text-green-700 border-green-200 text-xs"
                      : "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"}
                  >
                    {troisSignatures ? "3 signatures OK" : "Signatures manquantes"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div className="msr-champ">
                  <span className="msr-champ-cle">Quantité prévue</span>
                  <span className="msr-champ-valeur font-medium">
                    {sortie.quantite} unité(s)
                  </span>
                </div>
                <div className="msr-champ">
                  <span className="msr-champ-cle">Reliquat</span>
                  <span className="msr-champ-valeur font-medium text-primary">
                    {reliquat} unité(s)
                  </span>
                </div>
                <div className="msr-champ">
                  <span className="msr-champ-cle">Direction</span>
                  <span className="msr-champ-valeur text-sm">{sortie.direction}</span>
                </div>
                <div className="msr-champ">
                  <span className="msr-champ-cle">Bénéficiaire</span>
                  <span className="msr-champ-valeur text-sm">{sortie.beneficiaire}</span>
                </div>
                <div className="msr-champ">
                  <span className="msr-champ-cle">Date de sortie</span>
                  <span className="msr-champ-valeur text-sm">
                    {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <div className="msr-champ">
                  <span className="msr-champ-cle">Responsable</span>
                  <span className="msr-champ-valeur text-sm">{sortie.responsable}</span>
                </div>
                <div className="msr-champ">
                  <span className="msr-champ-cle">Statut réception</span>
                  <span className={`msr-champ-valeur text-sm font-medium ${STATUT_BADGE_COLOR[statutRéception]}`}>
                    {statutRéception}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {troisSignatures ? (
                    <>
                      <span className="text-green-600">✓</span>
                      Magasinier • Dépositaire • Logistique signés
                    </>
                  ) : (
                    <>
                      <span className="text-yellow-600">⚠</span>
                      Signatures incomplètes
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!troisSignatures || reliquat <= 0 ? (
                    <Button
                      disabled
                      variant="outline"
                      size="sm"
                      className="opacity-50 cursor-not-allowed"
                    >
                      {!troisSignatures ? "Signatures requises" : "Tout réceptionné"}
                    </Button>
                  ) : (
                    <>
                      {user?.role === "depositaire" || user?.role === "demandeur" ? (
                        <Button
                          onClick={() => onRecevoir(sortie)}
                          size="sm"
                          className="flex-1"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Recevoir
                        </Button>
                      ) : (
                        <Button
                          disabled
                          variant="outline"
                          size="sm"
                          className="opacity-50 cursor-not-allowed flex-1"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Recevoir (dépositaire)
                        </Button>
                      )}
                      <Button
                        onClick={() => onAnomalie(sortie)}
                        variant="outline"
                        size="sm"
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" /> Anomalie
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
