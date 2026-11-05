import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { RemiseDetenteurDemandeur } from "./RemiseDetenteurDemandeur";
import {
  Truck,
  RefreshCw,
  AlertTriangle,
  History,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import "./EcranReception.css";

type Onglet = "recevoir" | "historique" | "anomalies" | "remise-detenteur";

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

  // Compter les sorties éligibles pour la remise au détenteur (reliquat = 0, statut Sortie effectuée)
  const countRemiseDetenteur = useMemo(() => {
    return sortiesServeur.filter((sortie) => {
      const reliquat = getReliquat(sortie, receptionsServeur);
      return sortie.statut === "Sortie effectuée" && reliquat <= 0;
    }).length;
  }, [sortiesServeur, receptionsServeur]);

  return (
    <div className="msc-page">
      {/* En-tête */}
      <header className="msc-header">
        <div className="msc-header__content">
          <h1 className="msc-header__title">Réception physique du matériel</h1>
          <p className="msc-header__subtitle">
            Réceptionnez les matériels sortis validés à trois signatures.{" "}
            {user.role === "depositaire"
              ? `Vous êtes dépositaire de la direction ${user.department}.`
              : user.role === "demandeur"
                ? `Vous consultez les sorties à réceptionner de votre direction (${user.department}).`
                : "Accès réservé au Dépositaire comptable."}
          </p>
        </div>
        <div className="msc-header__actions">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing || chargementSorties}
            variant="outline"
            size="sm"
            className="msc-btn msc-btn--outline msc-btn--sm"
          >
            <RefreshCw className="w-4 h-4" />
            {isRefreshing || chargementSorties ? "Actualisation…" : "Actualiser"}
          </Button>
        </div>
      </header>

      {/* Statistiques / Compteurs */}
      <div className="msc-stats" role="region" aria-label="Statistiques de réception">
        <div className="msc-stat msc-stat--primary">
          <div className="msc-stat__value">{countARéceptionner}</div>
          <div className="msc-stat__label">À réceptionner</div>
        </div>
        <div className="msc-stat">
          <div className="msc-stat__value">{countAnomaliesOuvertes}</div>
          <div className="msc-stat__label">Anomalies ouvertes</div>
        </div>
        <div className="msc-stat">
          <div className="msc-stat__value">{countRemiseDetenteur}</div>
          <div className="msc-stat__label">Éligibles remise détenteur</div>
        </div>
        <div className="msc-stat">
          <div className="msc-stat__value">{sortiesServeur.length}</div>
          <div className="msc-stat__label">Sorties chargées</div>
        </div>
        <div className="msc-stat">
          <div className="msc-stat__value">{receptionsServeur.length}</div>
          <div className="msc-stat__label">Réceptions enregistrées</div>
        </div>
      </div>

      {/* Alertes d'erreur */}
      {erreurSorties && (
        <div className="msc-alert msc-alert--error" role="alert">
          <AlertTriangle className="msc-alert__icon" />
          <div className="msc-alert__content">
            <div className="msc-alert__title">Erreur de chargement</div>
            <div className="msc-alert__description">{erreurSorties}</div>
          </div>
        </div>
      )}
      {erreurReceptions && (
        <div className="msc-alert msc-alert--error" role="alert">
          <AlertTriangle className="msc-alert__icon" />
          <div className="msc-alert__content">
            <div className="msc-alert__title">Erreur de chargement</div>
            <div className="msc-alert__description">{erreurReceptions}</div>
          </div>
        </div>
      )}

      <div className="msc-divider" aria-hidden="true" />

      {/* Navigation par onglets */}
      <nav className="msc-tabs" role="tablist" aria-label="Sections de réception">
        <button
          role="tab"
          aria-selected={onglet === "recevoir"}
          aria-controls="panel-recevoir"
          id="tab-recevoir"
          onClick={() => setOnglet("recevoir")}
          className={`msc-tab ${onglet === "recevoir" ? "msc-tab--active" : ""}`}
        >
          <Truck className="msc-tab__icon" aria-hidden="true" />
          À réceptionner
          {countARéceptionner > 0 && (
            <span className="msc-tab__badge">{countARéceptionner}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={onglet === "historique"}
          aria-controls="panel-historique"
          id="tab-historique"
          onClick={() => setOnglet("historique")}
          className={`msc-tab ${onglet === "historique" ? "msc-tab--active" : ""}`}
        >
          <History className="msc-tab__icon" aria-hidden="true" />
          Historique
        </button>
        <button
          role="tab"
          aria-selected={onglet === "anomalies"}
          aria-controls="panel-anomalies"
          id="tab-anomalies"
          onClick={() => setOnglet("anomalies")}
          className={`msc-tab ${onglet === "anomalies" ? "msc-tab--active" : ""}`}
        >
          <AlertTriangle className="msc-tab__icon" aria-hidden="true" />
          Anomalies
          {countAnomaliesOuvertes > 0 && (
            <span className="msc-tab__badge msc-badge--destructive">{countAnomaliesOuvertes}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={onglet === "remise-detenteur"}
          aria-controls="panel-remise-detenteur"
          id="tab-remise-detenteur"
          onClick={() => setOnglet("remise-detenteur")}
          className={`msc-tab ${onglet === "remise-detenteur" ? "msc-tab--active" : ""}`}
        >
          <PackageCheck className="msc-tab__icon" aria-hidden="true" />
          Remise détenteur
          {countRemiseDetenteur > 0 && (
            <span className="msc-tab__badge">{countRemiseDetenteur}</span>
          )}
        </button>
      </nav>

      {/* Contenu selon l'onglet */}
      <div className="msc-content" role="tabpanel" id="panel-recevoir" aria-labelledby="tab-recevoir" hidden={onglet !== "recevoir"}>
        {onglet === "recevoir" && (
          <ListeSortiesARéceptionner
            sorties={sorties}
            user={user}
            receptionsServeur={receptionsServeur}
            onRecevoir={handleRecevoir}
            onAnomalie={handleAnomalie}
          />
        )}
      </div>
      <div className="msc-content" role="tabpanel" id="panel-historique" aria-labelledby="tab-historique" hidden={onglet !== "historique"}>
        {onglet === "historique" && (
          <HistoriqueRéceptions receptionsServeur={receptionsServeur} />
        )}
      </div>
      <div className="msc-content" role="tabpanel" id="panel-anomalies" aria-labelledby="tab-anomalies" hidden={onglet !== "anomalies"}>
        {onglet === "anomalies" && (
          <div className="msc-empty">
            <AlertTriangle className="msc-empty__icon" aria-hidden="true" />
            <h3 className="msc-empty__title">Anomalies non disponibles (Phase 1)</h3>
            <p className="msc-empty__description">
              Aucune API d'anomalie n'existe sur le backend de cette branche.
              Les déclarations d'anomalie restent locales et ne sont pas persistées.
            </p>
          </div>
        )}
      </div>
      <div className="msc-content" role="tabpanel" id="panel-remise-detenteur" aria-labelledby="tab-remise-detenteur" hidden={onglet !== "remise-detenteur"}>
        {onglet === "remise-detenteur" && (
          <RemiseDetenteurDemandeur
            sorties={sortiesServeur}
            receptionsServeur={receptionsServeur}
            user={{ ...user, directionId }}
            onRemiseConfirmee={chargerDonnées}
          />
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
