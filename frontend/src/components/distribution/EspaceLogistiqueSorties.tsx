import { useMemo, useState } from "react";
import { PackageCheck, RefreshCw } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { useSortiesLive } from "@/lib/useSortiesLive";
import { ordresAAutoriser } from "@/lib/sortieControle";
import { CarteOrdreAutorisation } from "./CarteOrdreAutorisation";
import { AutorisationOrdreSortie } from "./AutorisationOrdreSortie";
import { toast } from "sonner";
import "./EspaceLogistiqueSorties.css";

/**
 * Espace logistique dans Distribution — autorisation et SIGNATURE 3.
 *
 * Trois onglets : « À autoriser », « En préparation chez les autres »,
 * « Autorisées ».
 * Aucune création d'ordre, aucun accès à l'inventaire, aucun message d'accès refusé.
 * Les données viennent du sondage partagé existant (useSortiesLive) : AUCUN
 * nouveau sondage n'est créé ici.
 */
type Onglet = "a_autoriser" | "en_amont" | "autorisees";

export function EspaceLogistiqueSorties() {
  const {
    sorties,
    isLoading,
    isInitialError,
    messageErreur,
    derniereSync,
    refresh,
  } = useSortiesLive();

  const [onglet, setOnglet] = useState<Onglet>("a_autoriser");
  const [ordreOuvert, setOrdreOuvert] = useState<string | null>(null);
  const [loadingSortieId, setLoadingSortieId] = useState<string | null>(null);

  // Onglet « À autoriser » : en_preparation avec signatures 1 et 2 posées, 3 absente.
  const aAutoriser = useMemo(
    () => sorties.filter((sortie) => ordresAAutoriser([sortie]).length === 1),
    [sorties]
  );

  // Onglet « En préparation chez les autres » : en_preparation avec au moins
  // une des signatures 1 ou 2 absente.
  const enAmont = useMemo(
    () =>
      sorties.filter(
        (sortie) =>
          sortie.statut === "En préparation" &&
          !(sortie.magasinier_signed === true && sortie.depositaire_signed === true)
      ),
    [sorties]
  );

  // Onglet « Autorisées » : validee et sortie_effectuee.
  const autorisees = useMemo(
    () =>
      sorties.filter(
        (sortie) =>
          sortie.statut === "Validée" || sortie.statut === "Sortie effectuée"
      ),
    [sorties]
  );

  const listeCourante =
    onglet === "a_autoriser"
      ? aAutoriser
      : onglet === "en_amont"
      ? enAmont
      : autorisees;

  const premiereChargement = isLoading && sorties.length === 0;
  const premiereErreur = isInitialError && sorties.length === 0;

  const apresAutorisation = () => {
    setOrdreOuvert(null);
    void refresh();
  };

  const apresRejet = () => {
    setOrdreOuvert(null);
    void refresh();
  };

  return (
    <div className="msa-page">
      {/* En-tête logistique */}
      <header>
        <h1 className="msa-titre">Autorisation des sorties</h1>
        <p className="msa-sous-titre">
          Contrôlez les signatures et le stock, puis autorisez la sortie.
        </p>
      </header>

      {/* Compteurs */}
      <div className="msa-compteurs">
        <div className="msa-compteur">
          <span className="msa-compteur-valeur">
            À autoriser ({aAutoriser.length})
          </span>
        </div>
        <div className="msa-compteur">
          <span className="msa-compteur-valeur">
            En préparation chez les autres ({enAmont.length})
          </span>
        </div>
        <div className="msa-compteur">
          <span className="msa-compteur-valeur">
            Autorisées ({autorisees.length})
          </span>
        </div>
      </div>

      {/* Onglets */}
      <div className="msa-onglets" role="tablist" aria-label="Ordres de sortie du logistique">
        <button
          type="button"
          role="tab"
          id="msa-onglet-a-autoriser"
          aria-selected={onglet === "a_autoriser"}
          aria-controls="msa-panneau-a-autoriser"
          className={`msa-onglet${onglet === "a_autoriser" ? " msa-onglet--actif" : ""}`}
          onClick={() => setOnglet("a_autoriser")}
        >
          À autoriser ({aAutoriser.length})
        </button>
        <button
          type="button"
          role="tab"
          id="msa-onglet-en-amont"
          aria-selected={onglet === "en_amont"}
          aria-controls="msa-panneau-en-amont"
          className={`msa-onglet${onglet === "en_amont" ? " msa-onglet--actif" : ""}`}
          onClick={() => setOnglet("en_amont")}
        >
          En préparation chez les autres ({enAmont.length})
        </button>
        <button
          type="button"
          role="tab"
          id="msa-onglet-autorisees"
          aria-selected={onglet === "autorisees"}
          aria-controls="msa-panneau-autorisees"
          className={`msa-onglet${onglet === "autorisees" ? " msa-onglet--actif" : ""}`}
          onClick={() => setOnglet("autorisees")}
        >
          Autorisées ({autorisees.length})
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
            {onglet === "a_autoriser"
              ? "Aucun ordre à autoriser pour le moment"
              : onglet === "en_amont"
              ? "Aucun ordre en préparation chez les autres pour le moment"
              : "Aucune sortie autorisée pour le moment"}
          </p>
        </div>
      )}

      {!premiereChargement && !premiereErreur && listeCourante.length > 0 && (
        <ul
          className="msa-liste"
          role="tabpanel"
          id={
            onglet === "a_autoriser"
              ? "msa-panneau-a-autoriser"
              : onglet === "en_amont"
              ? "msa-panneau-en-amont"
              : "msa-panneau-autorisees"
          }
          aria-labelledby={
            onglet === "a_autoriser"
              ? "msa-onglet-a-autoriser"
              : onglet === "en_amont"
              ? "msa-onglet-en-amont"
              : "msa-onglet-autorisees"
          }
        >
          {listeCourante.map((sortie) => (
            <CarteOrdreAutorisation
              key={sortie.id}
              sortie={sortie}
              lectureSeule={onglet !== "a_autoriser"}
              onAutoriser={(ouverte) => {
                // Ne change ordreOuvert que si aucun chargement n'est en cours
                if (loadingSortieId === null) {
                  setOrdreOuvert(ouverte.id);
                }
              }}
              onRejeter={apresRejet}
              panneau={
                onglet === "a_autoriser" && ordreOuvert === sortie.id ? (
                  <AutorisationOrdreSortie
                    sortie={sortie}
                    onSuccess={apresAutorisation}
                    onError={(message) => toast.error(message)}
                    onLoadingChange={(isLoading) => {
                      if (isLoading) {
                        setLoadingSortieId(sortie.id);
                      } else {
                        setLoadingSortieId(null);
                      }
                    }}
                  />
                ) : undefined
              }
              // Désactiver le bouton « Contrôler et autoriser » lorsqu'un autre ordre est en chargement
              desactive={loadingSortieId !== null && loadingSortieId !== sortie.id}
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