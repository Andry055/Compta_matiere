import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  SortieRecord,
  sortieRecords,
  receptions,
  receptionAnomalies,
  sortiesRéceptionnables,
  getStatutRéceptionSortie,
  getReliquat,
  peutRecevoir,
} from "@/lib/movements";
import { User } from "../App";
import { ListeSortiesARéceptionner } from "./ListeSortiesARéceptionner";
import { FormulaireRéception } from "./FormulaireRéception";
import { DéclarationAnomalie } from "./DéclarationAnomalie";
import { HistoriqueRéceptions } from "./HistoriqueRéceptions";
import {
  Truck,
  RefreshCw,
  AlertTriangle,
  History,
} from "lucide-react";
import { toast } from "sonner";
import "./EcranReception.css";

type Onglet = "recevoir" | "historique" | "anomalies";

const STATUT_BADGE: Record<StatutRéception, string> = {
  "En cours": "bg-blue-50 text-blue-700 border-blue-200",
  Partielle: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Complète: "bg-green-50 text-green-700 border-green-200",
  Annulée: "bg-red-50 text-red-700 border-red-200",
};

interface EcranReceptionProps {
  user: User;
  onNavigate?: (section: string) => void;
}

export function EcranReception({ user, onNavigate }: EcranReceptionProps) {
  const [onglet, setOnglet] = useState<Onglet>("recevoir");
  const [sortieOuverte, setSortieOuverte] = useState<SortieRecord | null>(null);
  const [anomalieOuverte, setAnomalieOuverte] = useState<SortieRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sorties réceptionnables pour ce dépositaire (3 signatures, statut "Sortie effectuée", même direction).
  const sorties = sortiesRéceptionnables(
    sortieRecords,
    { role: user.role, department: user.department }
  );

  const handleRecevoir = (sortie: SortieRecord) => {
    setSortieOuverte(sortie);
  };

  const handleAnomalie = (sortie: SortieRecord) => {
    setAnomalieOuverte(sortie);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsRefreshing(false);
    toast.success("Liste actualisée");
  };

  const countARéceptionner = sorties.length;
  const countAnomaliesOuvertes = receptionAnomalies.filter(
    (a) => a.statut === "Ouverte"
  ).length;

  return (
    <div className="msr-page">
      {/* En-tête */}
      <div className="msr-entete">
        <div>
          <h1 className="msr-titre">Réception physique du matériel</h1>
          <p className="msr-sous-titre">
            Réceptionnez les matériels sortis validés à trois signatures.{" "}
            {user.role === "depositaire"
              ? `Vous êtes dépositaire de la direction ${user.department}.`
              : "Accès réservé au Dépositaire comptable."}
          </p>
        </div>
        <div className="msr-actions-en-tete">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4" /> {isRefreshing ? "Actualisation..." : "Actualiser"}
          </Button>
        </div>
      </div>

      {/* Compteurs */}
      <div className="msr-compteurs">
        <div className="msr-compteur">
          <div className="msr-compteur-valeur">{countARéceptionner}</div>
          <div className="msr-compteur-libelle">Sorties à réceptionner</div>
        </div>
        <div className="msr-compteur">
          <div className="msr-compteur-valeur">{countAnomaliesOuvertes}</div>
          <div className="msr-compteur-libelle">Anomalies ouvertes</div>
        </div>
        <div className="msr-compteur">
          <div className="msr-compteur-valeur">{receptions.length}</div>
          <div className="msr-compteur-libelle">Réceptions enregistrées</div>
        </div>
      </div>

      <Separator />

      {/* Onglets */}
      <div className="msr-onglets">
        <button
          onClick={() => setOnglet("recevoir")}
          className={`msr-onglet ${
            onglet === "recevoir" ? "msr-onglet--actif" : ""
          }`}
        >
          <Truck className="w-4 h-4 mr-1" /> À réceptionner
        </button>
        <button
          onClick={() => setOnglet("historique")}
          className={`msr-onglet ${
            onglet === "historique" ? "msr-onglet--actif" : ""
          }`}
        >
          <History className="w-4 h-4 mr-1" /> Historique
        </button>
        <button
          onClick={() => setOnglet("anomalies")}
          className={`msr-onglet ${
            onglet === "anomalies" ? "msr-onglet--actif" : ""
          }`}
        >
          <AlertTriangle className="w-4 h-4 mr-1" /> Anomalies
          {countAnomaliesOuvertes > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {countAnomaliesOuvertes}
            </span>
          )}
        </button>
      </div>

      {/* Contenu selon l'onglet */}
      <div className="msr-contenu">
        {onglet === "recevoir" && (
          <ListeSortiesARéceptionner
            sorties={sorties}
            onRecevoir={handleRecevoir}
            onAnomalie={handleAnomalie}
          />
        )}
        {onglet === "historique" && (
          <HistoriqueRéceptions receptions={receptions} />
        )}
        {onglet === "anomalies" && (
          <div className="msr-liste">
            {receptionAnomalies.length === 0 ? (
              <div className="msr-etat">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mb-2" />
                <h3 className="font-medium text-foreground mb-1">
                  Aucune anomalie déclarée
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aucune anomalie n'a encore été déclarée sur les réceptions physiques.
                </p>
              </div>
            ) : (
              <Card className="msr-carte border border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Anomalies déclarées ({receptionAnomalies.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Liste des anomalies ouvertes et résolues sur les réceptions physiques.
                  </p>
                </CardHeader>
                <CardContent className="pt-3 space-y-3">
                  {receptionAnomalies
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.dateDeclaration).getTime() -
                        new Date(a.dateDeclaration).getTime()
                    )
                    .map((anomalie) => {
                      const sortie = sortieRecords.find(
                        (s) => s.id === anomalie.sortieId
                      );
                      return (
                        <div
                          key={anomalie.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border border-border/60 bg-muted/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-foreground">
                                {anomalie.type === "quantite"
                                  ? "Écart de quantité"
                                  : anomalie.type === "etat"
                                    ? "État du matériel"
                                    : anomalie.type === "conformite"
                                      ? "Non-conformité"
                                      : "Autre"}
                              </span>
                              <Badge
                                variant={
                                  anomalie.statut === "Ouverte"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px] shrink-0"
                              >
                                {anomalie.statut === "Ouverte"
                                  ? "Ouverte"
                                  : "Résolue"}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground">
                              {anomalie.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {sortie ? `Sortie ${sortie.reference}` : "—"} •{" "}
                              {anomalie.declarePar} •{" "}
                              {new Date(anomalie.dateDeclaration).toLocaleString(
                                "fr-FR"
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Formulaire de réception */}
      {sortieOuverte && (
        <FormulaireRéception
          sortie={sortieOuverte}
          onClose={() => setSortieOuverte(null)}
        />
      )}

      {/* Formulaire d'anomalie */}
      {anomalieOuverte && (
        <DéclarationAnomalie
          sortie={anomalieOuverte}
          onClose={() => setAnomalieOuverte(null)}
        />
      )}
    </div>
  );
}

export { STATUT_BADGE };
