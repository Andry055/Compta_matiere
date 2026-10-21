import { useMemo, useState } from "react";
import { PackageCheck, RefreshCw } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { useSortiesLive } from "@/lib/useSortiesLive";
import { estAPreparerPourMagasinier } from "@/lib/sortieControle";
import { estARemettre, estRemise } from "@/lib/remiseSortie";
import { CarteOrdrePreparation } from "./CarteOrdrePreparation";
import { CarteOrdreRemise, RemiseOrdreSortie } from "./RemiseOrdreSortie";
import { toast } from "sonner";
import "./EspaceMagasinierSorties.css";

/**
 * Espace magasinier dans Distribution — préparation, SIGNATURE 1 et REMISE.
 *
 * Une seule colonne de cartes, des compteurs et quatre onglets. Aucune
 * création d'ordre, aucun accès à l'inventaire, aucun message d'accès refusé.
 * Les données viennent du sondage partagé existant (useSortiesLive) : AUCUN
 * nouveau sondage n'est créé ici.
 */
type Onglet = "a_preparer" | "traites" | "a_remettre" | "remises";

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

  // Onglet « À remettre » : sorties VALIDÉES, prêtes à quitter le magasin.
  // Le stock a déjà été débité à la validation logistique : la remise ne fait
  // qu'enregistrer qui a reçu le matériel.
  const aRemettre = useMemo(() => sorties.filter(estARemettre), [sorties]);

  // Onglet « Remises » : sorties déjà remises (lecture seule).
  const remises = useMemo(() => sorties.filter(estRemise), [sorties]);

  // Ordre dont la remise vient d'être enregistrée : il quitte l'onglet
  // « À remettre » au rafraîchissement, mais sa carte reste affichée le temps
  // que l'utilisateur imprime le bon signé.
  const [remiseRecemmentEnregistree, setRemiseRecemmentEnregistree] =
    useState<SortieRecord | null>(null);
  const [remiseOuverte, setRemiseOuverte] = useState<string | null>(null);

  const listeCourante =
    onglet === "a_preparer"
      ? aPreparer
      : onglet === "traites"
        ? traites
        : onglet === "a_remettre"
          ? aRemettre
          : remises;
  const premiereChargement = isLoading && sorties.length === 0;
  const premiereErreur = isInitialError && sorties.length === 0;

  const apresSignature = () => {
    void refresh();
  };

  const apresRejet = () => {
    void refresh();
  };

  /** Remise enregistrée : on rafraîchit la liste et on garde la carte en
   *  tête de l'onglet pour permettre l'impression du bon signé. */
  const apresRemise = (remise: SortieRecord) => {
    setRemiseOuverte(null);
    setRemiseRecemmentEnregistree(remise);
    void refresh();
  };

  // Carte épinglée : l'ordre vient d'être remis, il a quitté « À remettre »
  // au rafraîchissement — on le garde affiché pour imprimer le bon signé.
  const cartePincee =
    onglet === "a_remettre" &&
    remiseRecemmentEnregistree &&
    !aRemettre.some((sortie) => sortie.id === remiseRecemmentEnregistree.id)
      ? remiseRecemmentEnregistree
      : null;

  const messageOngletVide =
    onglet === "a_preparer"
      ? "Aucun ordre à préparer pour le moment"
      : onglet === "traites"
        ? "Aucun ordre signé pour le moment"
        : onglet === "a_remettre"
          ? "Aucun ordre à remettre pour le moment"
          : "Aucune remise enregistrée pour le moment";

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
        <div className="msa-compteur">
          <span className="msa-compteur-valeur">À remettre ({aRemettre.length})</span>
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
        <button
          type="button"
          role="tab"
          id="msa-onglet-a-remettre"
          aria-selected={onglet === "a_remettre"}
          aria-controls="msa-panneau-a-remettre"
          className={`msa-onglet${onglet === "a_remettre" ? " msa-onglet--actif" : ""}`}
          onClick={() => {
            setRemiseOuverte(null);
            setOnglet("a_remettre");
          }}
        >
          À remettre ({aRemettre.length})
        </button>
        <button
          type="button"
          role="tab"
          id="msa-onglet-remises"
          aria-selected={onglet === "remises"}
          aria-controls="msa-panneau-remises"
          className={`msa-onglet${onglet === "remises" ? " msa-onglet--actif" : ""}`}
          onClick={() => {
            setRemiseOuverte(null);
            setOnglet("remises");
          }}
        >
          Remises ({remises.length})
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

      {!premiereChargement && !premiereErreur && listeCourante.length === 0 && !cartePincee && (
        <div className="msa-etat">
          <PackageCheck style={{ width: 22, height: 22, opacity: 0.6 }} aria-hidden="true" />
          <p>{messageOngletVide}</p>
        </div>
      )}

      {/* Préparation / signatures (onglets historiques) */}
      {!premiereChargement &&
        !premiereErreur &&
        (onglet === "a_preparer" || onglet === "traites") &&
        listeCourante.length > 0 && (
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
                onSuccess={apresSignature}
                onRejetee={apresRejet}
                onError={(message) => toast.error(message)}
              />
            ))}
          </ul>
        )}

      {/* À remettre : sortie validée, bon de sortie à faire signer. */}
      {!premiereChargement &&
        !premiereErreur &&
        onglet === "a_remettre" &&
        (aRemettre.length > 0 || Boolean(cartePincee)) && (
          <ul
            className="msa-liste"
            role="tabpanel"
            id="msa-panneau-a-remettre"
            aria-labelledby="msa-onglet-a-remettre"
          >
            {cartePincee && (
              <CarteOrdreRemise key={cartePincee.id} sortie={cartePincee} lectureSeule />
            )}
            {aRemettre.map((sortie) => (
              <CarteOrdreRemise
                key={sortie.id}
                sortie={sortie}
                onRemettre={(ouverte) => setRemiseOuverte(ouverte.id)}
                panneau={
                  remiseOuverte === sortie.id ? (
                    <RemiseOrdreSortie
                      sortie={sortie}
                      onSuccess={apresRemise}
                      onError={(message) => toast.error(message)}
                    />
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}

      {/* Remises : lecture seule (détenteur, mandataire, date). */}
      {!premiereChargement &&
        !premiereErreur &&
        onglet === "remises" &&
        remises.length > 0 && (
          <ul
            className="msa-liste"
            role="tabpanel"
            id="msa-panneau-remises"
            aria-labelledby="msa-onglet-remises"
          >
            {remises.map((sortie) => (
              <CarteOrdreRemise key={sortie.id} sortie={sortie} lectureSeule />
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
