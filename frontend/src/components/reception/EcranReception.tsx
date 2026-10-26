import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  SortieRecord,
  sortiesRéceptionnables,
  getStatutRéceptionSortie,
  getReliquat,
} from "@/lib/movements";
import { fetchSorties, listerReceptionsPhysiques, fetchDirections, type ReceptionPhysiqueRecord } from "@/lib/api";
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

const STATUT_BADGE: Record<string, string> = {
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

  // Sorties chargées depuis le backend (remplace le mock local sortieRecords).
  const [sortiesServeur, setSortiesServeur] = useState<SortieRecord[]>([]);
  const [chargementSorties, setChargementSorties] = useState(true);
  const [erreurSorties, setErreurSorties] = useState<string | null>(null);

  // Réceptions physiques enregistrées côté serveur (pour calcul du reliquat réel).
  const [receptionsServeur, setReceptionsServeur] = useState<ReceptionPhysiqueRecord[]>([]);
  const [chargementReceptions, setChargementReceptions] = useState(true);
  const [erreurReceptions, setErreurReceptions] = useState<string | null>(null);

  // Identifiant stable de direction du dépositaire (résolu depuis le libellé du département).
  const [directionId, setDirectionId] = useState<string | undefined>(undefined);

  const chargerDonnées = useCallback(async () => {
    setChargementSorties(true);
    setChargementReceptions(true);
    setErreurSorties(null);
    setErreurReceptions(null);

    // Charger les sorties depuis le serveur.
    try {
      const result = await fetchSorties();
      setSortiesServeur(result ?? []);
    } catch {
      setErreurSorties("Impossible de charger la liste des sorties depuis le serveur.");
      setSortiesServeur([]);
    } finally {
      setChargementSorties(false);
    }

    // Charger les réceptions physiques depuis le serveur (calcul du reliquat réel).
    try {
      const result = await listerReceptionsPhysiques();
      setReceptionsServeur(result ?? []);
    } catch {
      setErreurReceptions("Impossible de charger les réceptions physiques depuis le serveur.");
      setReceptionsServeur([]);
    } finally {
      setChargementReceptions(false);
    }
  }, []);

  useEffect(() => {
    chargerDonnées();
  }, [chargerDonnées]);

  // Résout l'identifiant de direction du dépositaire à partir de son département,
  // à l'image du contrôleur backend (`getDirectionIds` sur nom_direction).
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const directions = await fetchDirections();
        const departement = user.department || "";
        const abbr = departement.split(" - ")[0].trim();
        const correspondance = directions.find(
          (d) =>
            (d.abbreviation && d.abbreviation.toLowerCase() === abbr.toLowerCase()) ||
            (d.nom && d.nom.toLowerCase() === abbr.toLowerCase())
        );
        if (mounted) setDirectionId(correspondance?.documentId);
      } catch {
        if (mounted) setDirectionId(undefined);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user.department]);

  // Sorties réceptionnables pour ce dépositaire (3 signatures, statut "Sortie effectuée", même direction).
  const sorties = sortiesRéceptionnables(
    sortiesServeur,
    { role: user.role, department: user.department, directionId },
    receptionsServeur
  );

  const handleRecevoir = (sortie: SortieRecord) => {
    setSortieOuverte(sortie);
  };

  const handleAnomalie = (sortie: SortieRecord) => {
    setAnomalieOuverte(sortie);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await chargerDonnées();
    setIsRefreshing(false);
    toast.success("Liste actualisée");
  };

  const countARéceptionner = sorties.length;
  const countAnomaliesOuvertes = 0; // Les anomalies proviennent désormais de l'API backend (non connectée en Phase 1)

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
              : user.role === "demandeur"
                ? `Vous consultez les sorties à réceptionner de votre direction (${user.department}).`
                : "Accès réservé au Dépositaire comptable."}
          </p>
        </div>
        <div className="msr-actions-en-tete">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || chargementSorties}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4" />
            {isRefreshing || chargementSorties ? "Actualisation…" : "Actualiser"}
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
          <div className="msr-compteur-valeur">{sortiesServeur.length}</div>
          <div className="msr-compteur-libelle">Sorties chargées (serveur)</div>
        </div>
        <div className="msr-compteur">
          <div className="msr-compteur-valeur">{receptionsServeur.length}</div>
          <div className="msr-compteur-libelle">Réceptions enregistrées (serveur)</div>
        </div>
      </div>

      {erreurSorties && (
        <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm mb-3">
          {erreurSorties}
        </div>
      )}
      {erreurReceptions && (
        <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm mb-3">
          {erreurReceptions}
        </div>
      )}

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
            user={user}
            receptionsServeur={receptionsServeur}
            onRecevoir={handleRecevoir}
            onAnomalie={handleAnomalie}
          />
        )}
        {onglet === "historique" && (
          <HistoriqueRéceptions receptionsServeur={receptionsServeur} />
        )}
        {onglet === "anomalies" && (
          <div className="msr-liste">
            <div className="msr-etat">
              <AlertTriangle className="w-10 h-10 text-muted-foreground mb-2" />
              <h3 className="font-medium text-foreground mb-1">
                Anomalies non disponibles (Phase 1)
              </h3>
              <p className="text-sm text-muted-foreground">
                Aucune API d'anomalie n'existe sur le backend de cette branche.
                Les déclarations d'anomalie restent locales et ne sont pas persistées.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Formulaire de réception */}
      {sortieOuverte && (
        <FormulaireRéception
          sortie={sortieOuverte}
          receptionsServeur={receptionsServeur}
          onClose={() => setSortieOuverte(null)}
          onReceptionConfirmée={chargerDonnées}
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
