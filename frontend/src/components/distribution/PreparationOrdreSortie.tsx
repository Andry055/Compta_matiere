import React, { useState, useEffect } from "react";
import { RefreshCw, PenLine } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { ControleSortieLignePayload } from "@/lib/sortieControle";
import { signerSortie } from "@/lib/api";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Textarea
} from "@/components/ui/textarea";
import "./EspaceMagasinierSorties.css";

/**
 * Signature 1/3 (rôle magasinier) — contrôles des lignes et état constaté.
 *
 * Rend désormais une fenêtre modale (popup) professionnelle au lieu d'un
 * panneau inline. Le bouton d'ouverture « Préparer et signer » est le
 * déclencheur du dialogue ; le contenu est portailé au-dessus de la page.
 */
interface PreparationOrdreSortieProps {
  sortie: SortieRecord;
  onSuccess: (sortie: SortieRecord) => void;
  onError: (error: string) => void;
  /** Masque le déclencheur d'ouverture (lecture seule, onglet « Déjà traités »). */
  lectureSeule?: boolean;
}

export function PreparationOrdreSortie({
  sortie,
  onSuccess,
  onError,
  lectureSeule = false,
}: PreparationOrdreSortieProps) {
  const [controles, setControles] = useState<ControleSortieLignePayload[]>([]);
  // Aide à l'écran UNIQUEMENT (jamais envoyée au serveur) : chaque ligne doit
  // être explicitement confirmée présente avant de signer.
  const [verifiees, setVerifiees] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState(false);

  // Initialise les contrôles à partir des lignes de la sortie.
  useEffect(() => {
    if (sortie.lignes?.length) {
      const initialControles = sortie.lignes.map((ligne, index) => ({
        ligne: ligne.documentId || String(index + 1),
        // Aucun état imposé : le magasinier doit CONSTATER l'état réel.
        etat: "",
        observations: "",
      }));
      setControles(initialControles);
      setVerifiees({});
    }
  }, [sortie]);

  const handleEtatChange = (ligneId: string, etat: string) => {
    setControles(prevControles =>
      prevControles.map(controle =>
        controle.ligne === ligneId
          ? { ...controle, etat }
          : controle
      )
    );
  };

  const handleObservationsChange = (ligneId: string, observations: string) => {
    setControles(prevControles =>
      prevControles.map(controle =>
        controle.ligne === ligneId
          ? { ...controle, observations }
          : controle
      )
    );
  };

  // Case de vérification (écran seul, hors payload).
  const handleVerificationChange = (ligneId: string, cochee: boolean) => {
    setVerifiees(prev => ({ ...prev, [ligneId]: cochee }));
  };

  // Toutes les lignes ont un état, sont confirmées, et un défaut est motivé ?
  const controleComplet = controles.length > 0 && controles.every(controle => {
    const etatRenseigne = !!controle.etat && controle.etat.trim() !== "";
    const cochee = verifiees[controle.ligne] === true;
    const remarqueSiDefaillant =
      controle.etat !== "defaillant" ||
      (controle.observations ?? "").trim() !== "";
    return etatRenseigne && cochee && remarqueSiDefaillant;
  });

  // Signature 1/3 : rôle magasinier + contrôles des lignes.
  const handlePreparer = async () => {
    const allLinesHaveEtat = controles.every(controle => controle.etat && controle.etat.trim() !== "");
    if (!allLinesHaveEtat) {
      setError("Veuillez spécifier l'état pour toutes les lignes avant de signer");
      return;
    }
    if (!controles.every(controle => verifiees[controle.ligne] === true)) {
      setError("Confirmez que le matériel est présent et la quantité vérifiée pour chaque ligne");
      return;
    }
    const lignesDefaillantes = controles.filter(
      controle => controle.etat === "defaillant" && !(controle.observations ?? "").trim()
    );
    if (lignesDefaillantes.length > 0) {
      setError("Une ligne déclarée « Défaillant » exige une remarque");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // La case de vérification reste hors payload (aide d'écran uniquement).
      // SortieRecord.id EST le documentId servi par mapSortie.
      const preparedSortie = await signerSortie(sortie.id, "magasinier", controles);
      setIsLoading(false);
      setOuverte(false);
      onSuccess(preparedSortie);
    } catch (err: any) {
      setIsLoading(false);
      if (err.response?.status === 403) {
        setError("Vous n'avez pas la permission de préparer cette sortie");
      } else if (err.response?.status === 409) {
        setError("Cette sortie ne peut pas être préparée");
      } else {
        setError("Erreur lors de la préparation de la sortie");
      }
    }
  };

  return (
    <Dialog open={ouverte} onOpenChange={setOuverte}>
      {!lectureSeule && (
        <DialogTrigger asChild>
          <button type="button" className="msa-bouton msa-bouton--primaire msa-bouton--compact">
            <PenLine style={{ width: 15, height: 15 }} aria-hidden="true" />
            Préparer et signer
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="msa-dialogue">
        <DialogHeader>
          <DialogTitle className="msa-dialogue-titre">
            Signature de la sortie #{sortie.reference}
          </DialogTitle>
          <DialogDescription className="msa-dialogue-texte">
            Si le matériel ou la quantité ne correspond pas, rejetez l'ordre en
            indiquant le motif.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="msa-dialogue-corps" style={{ alignItems: "center", padding: "1rem 0" }}>
            <button className="flex items-center gap-2" disabled>
              <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" aria-hidden="true" />
              <span className="text-sm">Préparation en cours…</span>
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {controles.map((controle, index) => {
                const ligne = sortie.lignes?.[index];
                const cochee = verifiees[controle.ligne] === true;
                const manqueRemarque =
                  controle.etat === "defaillant" && !(controle.observations ?? "").trim();
                return (
                  <div key={controle.ligne} className="msa-panneau-ligne">
                    <div className="msa-carte-entete">
                      <h3 className="msa-ref">Ligne {index + 1}</h3>
                      {ligne?.designation && (
                        <span className="msa-badge">{ligne.designation}</span>
                      )}
                    </div>

                    <div className="msa-champs">
                      <div className="msa-champ">
                        <p className="msa-champ-cle">Quantité demandée :</p>
                        <p className="msa-champ-valeur">
                          {ligne?.quantite ?? sortie.quantite}
                        </p>
                      </div>
                      <div className="msa-champ">
                        <p className="msa-champ-cle">Stock actuel :</p>
                        <p className="msa-champ-valeur">
                          {ligne?.materiel?.quantiteStock ?? "—"}
                        </p>
                      </div>
                    </div>

                    <div className="msa-panneau-champ">
                      <label className="msa-panneau-libelle" htmlFor={`etat-${controle.ligne}`}>
                        État à constater :
                      </label>
                      <select
                        id={`etat-${controle.ligne}`}
                        className="msa-select"
                        value={controle.etat}
                        onChange={(e) => handleEtatChange(controle.ligne, e.target.value)}
                        disabled={isLoading}
                      >
                        <option value="">Sélectionner un état</option>
                        <option value="neuf">Neuf</option>
                        <option value="bon">Bon</option>
                        <option value="moyen">Moyen</option>
                        <option value="defaillant">Défaillant</option>
                      </select>
                    </div>

                    <div className="msa-panneau-champ">
                      <label className="msa-panneau-libelle" htmlFor={`obs-${controle.ligne}`}>
                        Remarque :
                      </label>
                      <Textarea
                        id={`obs-${controle.ligne}`}
                        value={controle.observations || ""}
                        onChange={(e) => handleObservationsChange(controle.ligne, e.target.value)}
                        placeholder={
                          controle.etat === "defaillant"
                            ? "Remarque obligatoire (ligne défaillante)…"
                            : "Remarque éventuelle…"
                        }
                        className="msa-textarea h-20"
                      />
                      {manqueRemarque && (
                        <p className="msa-erreur">Une ligne « Défaillant » exige une remarque.</p>
                      )}
                    </div>

                    <label className="msa-case">
                      <input
                        type="checkbox"
                        checked={cochee}
                        onChange={(e) => handleVerificationChange(controle.ligne, e.target.checked)}
                      />
                      <span>Matériel présent et quantité vérifiée</span>
                    </label>
                  </div>
                );
              })}
            </div>
            {error && <p className="msa-erreur">{error}</p>}
            <div className="msa-actions">
              <button
                type="button"
                className="msa-bouton msa-bouton--primaire msa-bouton--compact"
                onClick={handlePreparer}
                disabled={isLoading || !controleComplet}
              >
                {isLoading ? "Signature en cours…" : "Signer (1/3)"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
