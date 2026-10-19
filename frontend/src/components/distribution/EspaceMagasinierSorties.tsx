import { useMemo, useState } from "react";
import { PackageCheck, RefreshCw } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { useSortiesLive } from "@/lib/useSortiesLive";
import { estAPreparerPourMagasinier } from "@/lib/sortieControle";
import { CarteOrdrePreparation } from "./CarteOrdrePreparation";
import { PreparationOrdreSortie } from "./PreparationOrdreSortie";
import { toast } from "sonner";
import "./EspaceMagasinierSorties.css";

/**
 * Espace magasinier dans Distribution — préparation et SIGNATURE 1.
 *
 * Une seule colonne de cartes, deux compteurs, deux onglets. Aucune création
 * d'ordre, aucun accès à l'inventaire, aucun message d'accès refusé. Les
 * données viennent du sondage partagé existant (useSortiesLive) : AUCUN
 * nouveau sondage n'est créé ici.
 */
type Onglet = "a_preparer" | "traites";

export function EspaceMagasinierSorties() {
  const {
    sorties,
    isLoading,
    isInitialError,
    messageErreur,
    derniereSync,
    refresh,
  } = useSortiesLive();

  const [onglet, setOnglet] = useState<Onglet>("a_preparer");
  const [ordreOuvert, setOrdreOuvert] = useState<string | null>(null);

  // Onglet « À préparer » : en_preparation ET signature 1 absente (fonction
  // pure partagée) — jamais le statut « Demandée ».
  const aPreparer = useMemo(
    () => sorties.filter(estAPreparerPourMagasinier),
    [sorties]
  );

  // Onglet « Déjà traités » : ordres où la signature 1 est DÉJÀ posée.
  const traites = useMemo(
    () => sorties.filter((sortie) => sortie.magasinier_signed === true),
    [sorties]
  );

  const listeCourante = onglet === "a_preparer" ? aPreparer : traites;
  const premiereChargement = isLoading && sorties.length === 0;
  const premiereErreur = isInitialError && sorties.length === 0;

  const apresSignature = () => {
    setOrdreOuvert(null);
    void refresh();
  };

  const apresRejet = () => {
    setOrdreOuvert(null);
    void refresh();
  };

  return (
    <div className="msa-page">
      {/* En-tête magasinier */}
      <header>
        <h1 className="msa-titre">Préparation des sorties</h1>
        <p className="msa-sous-titre">
          Vérifiez le matériel demandé, constatez son état et signez.
        </p>
      </header>

      {/* Compteurs */}
      <div className="msa-compteurs">
        <div className="msa-compteur">
          <span className="msa-compteur-valeur">
            À préparer ({aPreparer.length})
          </span>
        </div>
        <div className="msa-compteur">
          <span className="msa-compteur-valeur">
            Signés par moi, en attente des autres ({traites.length})
          </span>
        </div>
      </div>

      {/* Onglets */}
      <div className="msa-onglets" role="tablist" aria-label="Ordres de sortie du magasinier">
        <button
          type="button"
          role="tab"
          id="msa-onglet-a-preparer"
          aria-selected={onglet === "a_preparer"}
          aria-controls="msa-panneau-a-preparer"
          className={`msa-onglet${onglet === "a_preparer" ? " msa-onglet--actif" : ""}`}
          onClick={() => setOnglet("a_preparer")}
        >
          À préparer ({aPreparer.length})
        </button>
        <button
          type="button"
          role="tab"
          id="msa-onglet-traites"
          aria-selected={onglet === "traites"}
          aria-controls="msa-panneau-traites"
          className={`msa-onglet${onglet === "traites" ? " msa-onglet--actif" : ""}`}
          onClick={() => setOnglet("traites")}
        >
          Déjà traités ({traites.length})
        </button>
      </div>

      {/* Panne réseau discret : les dernières données restent affichées. */}
      {isInitialError && sorties.length > 0 && (
        <p className="msa-alerte">
          {messageErreur ||
            "Connexion indisponible : affichage des dernières données connues."}
        </p>
      )}

      {premiereErreur && (
        <div className="msa-etat">
          <p>Impossible de charger les ordres de sortie.</p>
          <p className="msa-sous-titre">
            {messageErreur || "Le serveur est injoignable. Aucune donnée fictive n'est affichée."}
          </p>
          <button
            type="button"
            className="msa-bouton msa-bouton--fantome"
            onClick={() => void refresh()}
          >
            <RefreshCw style={{ width: 14, height: 14 }} aria-hidden="true" />
            Réessayer
          </button>
        </div>
      )}

      {premiereChargement && (
        <div className="msa-etat" role="status">
          <RefreshCw
            style={{ width: 18, height: 18, animation: "var(--animate-spin, linear 1s infinite)" }}
            aria-hidden="true"
          />
          <p>Chargement des ordres de sortie…</p>
        </div>
      )}

      {!premiereChargement && !premiereErreur && listeCourante.length === 0 && (
        <div className="msa-etat">
          <PackageCheck style={{ width: 22, height: 22, opacity: 0.6 }} aria-hidden="true" />
          <p>
            {onglet === "a_preparer"
              ? "Aucun ordre à préparer pour le moment"
              : "Aucun ordre signé pour le moment"}
          </p>
        </div>
      )}

      {!premiereChargement && !premiereErreur && listeCourante.length > 0 && (
        <ul
          className="msa-liste"
          role="tabpanel"
          id={onglet === "a_preparer" ? "msa-panneau-a-preparer" : "msa-panneau-traites"}
          aria-labelledby={onglet === "a_preparer" ? "msa-onglet-a-preparer" : "msa-onglet-traites"}
        >
          {listeCourante.map((sortie) => (
            <CarteOrdrePreparation
              key={sortie.id}
              sortie={sortie}
              lectureSeule={onglet === "traites"}
              onPreparer={(ouverte) => setOrdreOuvert(ouverte.id)}
              onRejetee={apresRejet}
              panneau={
                onglet === "a_preparer" && ordreOuvert === sortie.id ? (
                  <PreparationOrdreSortie
                    sortie={sortie}
                    onSuccess={apresSignature}
                    onError={(message) => toast.error(message)}
                  />
                ) : undefined
              }
            />
          ))}
        </ul>
      )}

      {derniereSync && (
        <p className="msa-sous-titre">
          Dernière mise à jour : {derniereSync.toLocaleTimeString("fr-FR")}
        </p>
      )}
    </div>
  );
}
