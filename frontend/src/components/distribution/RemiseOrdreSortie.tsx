import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, Send } from "lucide-react";
import { toast } from "sonner";
import {
  fetchDirections,
  fetchServices,
  rechargerSortie as rechargerSortieParDefaut,
  remettreSortie,
} from "@/lib/api";
import type { SortieRecord } from "@/lib/movements";
import {
  codeHttp,
  construirePayloadRemise,
  dateDuJourLocal,
  dateEstDansLeFutur,
  estRemise,
  estResultatIncertain,
  messageServeur,
  personnesDepuisReferentiel,
  proposerDetenteur,
} from "@/lib/remiseSortie";
import { genererPdfBonSortie, modeleBonSortie } from "@/lib/bonSortieDocument";
import "./RemiseOrdreSortie.css";

/**
 * Remise de matériel au détenteur.
 * ---------------------------------------------------------------------------
 * Quand le matériel sort du magasin, on enregistre la remise (qui a reçu le
 * matériel, éventuellement par mandataire, et quand) et on imprime le bon de
 * sortie / garde-réception que le détenteur signe.
 *
 * Trois règles structurent ce composant :
 *
 *  1. UN SEUL envoi. La remise est irréversible dans l'application : le
 *     double-clic est neutralisé par un verrou synchrone (ref) et le bouton
 *     est désactivé pendant la requête. Aucune relance automatique.
 *
 *  2. Un résultat INCERTAIN (délai dépassé, coupure) n'est JAMAIS affiché
 *     comme un « échec » : le serveur a pu enregistrer la remise avant que
 *     la connexion ne tombe. On recharge l'ordre et on conclut sur son état
 *     RÉEL.
 *
 *  3. Le STOCK n'est jamais touché ici : il a été débité à la validation
 *     logistique. Le payload ne contient que quatre champs — jamais un
 *     statut, jamais le stock.
 */

export interface RemiseOrdreSortieProps {
  /** Sortie validée, prête à être remise. */
  sortie: SortieRecord;
  /** Appelée quand la remise est enregistrée : l'ordre quitte « À remettre ». */
  onSuccess: (sortie: SortieRecord) => void;
  /** Appelée quand la remise n'a PAS pu être enregistrée. */
  onError: (message: string) => void;
  /**
   * Recharge l'ordre depuis le serveur pour conclure sur son état RÉEL.
   * Par défaut : lecture via l'API. Injectable pour les tests.
   */
  rechargerSortie?: (documentId: string) => Promise<SortieRecord | null>;
}

export function RemiseOrdreSortie({
  sortie,
  onSuccess,
  onError,
  rechargerSortie,
}: RemiseOrdreSortieProps) {
  const [detenteurNom, setDetenteurNom] = useState("");
  const [detenteurFonction, setDetenteurFonction] = useState("");
  const [mandataireNom, setMandataireNom] = useState("");
  // Date du jour en HEURE LOCALE (jamais UTC) : la date de remise est une
  // date civile, elle ne doit pas basculer la veille au soir.
  const [dateRemise, setDateRemise] = useState(() => dateDuJourLocal());
  const [materielConfirme, setMaterielConfirme] = useState(false);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  /** Sortie telle que renvoyée par le serveur après la remise. */
  const [sortieRemise, setSortieRemise] = useState<SortieRecord | null>(null);

  // Verrou synchrone : deux clics dans la même frame ne déclenchent qu'un
  // seul envoi (le state `envoi` ne serait re-rendu qu'au tour suivant).
  const envoiEnCours = useRef(false);

  /** Aujourd'hui, recalculé à chaque rendu (bascule de minuit comprise). */
  const aujourdhui = dateDuJourLocal();

  /** Sortie courante : après une remise réussie, celle renvoyée par le serveur. */
  const sortieCourante = sortieRemise ?? sortie;

  // ── Pré-remplissage du détenteur ────────────────────────────────────────
  // Best-effort : le référentiel ne relie pas un compte à une direction de
  // façon exploitable. Si rien ne correspond, les champs restent VIDES et
  // l'utilisateur saisit le détenteur (aide « Saisissez le détenteur »).
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const [services, directions] = await Promise.all([
          fetchServices(),
          fetchDirections(),
        ]);
        if (annule) return;
        const proposition = proposerDetenteur(
          sortie,
          personnesDepuisReferentiel(services, directions)
        );
        if (proposition) {
          setDetenteurNom(proposition.nom);
          setDetenteurFonction(proposition.fonction);
        }
      } catch {
        // Référentiel indisponible : on laisse la saisie à l'utilisateur.
      }
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortie.id]);

  // ── Impression du bon de sortie ─────────────────────────────────────────
  const imprimerBon = useCallback(
    async (action: "download" | "preview") => {
      try {
        await genererPdfBonSortie(modeleBonSortie(sortieCourante), action);
      } catch {
        setErreur("Impossible de générer le bon de sortie.");
      }
    },
    [sortieCourante]
  );

  // ── Rechargement de l'ordre (état réel) ─────────────────────────────────
  const recharger = useCallback(async (): Promise<SortieRecord | null> => {
    try {
      return await (rechargerSortie ?? rechargerSortieParDefaut)(sortie.id);
    } catch {
      return null;
    }
  }, [rechargerSortie, sortie.id]);

  // ── Conclusion sur l'état réel (résultat incertain) ──────────────────────
  const conclureSurEtatRecharge = useCallback(async () => {
    const recharge = await recharger();

    if (recharge && estRemise(recharge)) {
      // La remise a BIEN abouti : on le confirme, sans « échec » ni reprise.
      setSortieRemise(recharge);
      setConfirmationOuverte(false);
      onSuccess(recharge);
      toast.success("Remise enregistrée", {
        description: `Référence : ${recharge.reference}`,
      });
      return;
    }

    if (recharge) {
      // État réel connu : la remise n'est PAS enregistrée → échec CONFIRMÉ.
      const message =
        "La remise n'a pas été enregistrée. L'ordre reste en attente de remise.";
      setErreur(message);
      onError(message);
      return;
    }

    // État INCONNU : ni « échec », ni « succès » — on le dit explicitement.
    const message =
      "Remise de statut inconnu : rechargez la liste pour vérifier l'état de l'ordre.";
    setErreur(message);
    onError(message);
  }, [onError, onSuccess, recharger]);

  // ── Traitement d'un envoi en échec ───────────────────────────────────────
  const gererEchec = useCallback(
    async (erreurRenvoy: unknown) => {
      const statut = codeHttp(erreurRenvoy);

      // 409 : le serveur est formel — la remise est DÉJÀ enregistrée. On
      // recharge l'ordre (données à jour) et on le confirme.
      if (statut === 409) {
        const recharge = await recharger();
        const sortieFinale = recharge ?? sortie;
        setSortieRemise(sortieFinale);
        setConfirmationOuverte(false);
        onSuccess(sortieFinale);
        toast.success("Remise déjà enregistrée", {
          description: `Référence : ${sortieFinale.reference}`,
        });
        return;
      }

      // 400 : le serveur a refusé (date invalide, champ manquant…) : on
      // affiche SON message et on conserve la saisie.
      if (statut === 400) {
        const message = messageServeur(
          erreurRenvoy,
          "La remise a été refusée par le serveur."
        );
        setErreur(message);
        onError(message);
        return;
      }

      if (statut === 403) {
        const message = "Vous n'avez pas la permission d'enregistrer cette remise.";
        setErreur(message);
        onError(message);
        return;
      }

      // Aucune réponse du serveur : résultat INCERTAIN.
      if (estResultatIncertain(erreurRenvoy)) {
        await conclureSurEtatRecharge();
        return;
      }

      const message = messageServeur(
        erreurRenvoy,
        "La remise n'a pas pu être enregistrée."
      );
      setErreur(message);
      onError(message);
    },
    [conclureSurEtatRecharge, onError, onSuccess, recharger, sortie]
  );

  // ── Règles de saisie ────────────────────────────────────────────────────
  const erreurDeSaisie = useMemo(() => {
    if (!detenteurNom.trim()) return "Le nom du détenteur est requis.";
    if (!detenteurFonction.trim()) return "La fonction du détenteur est requise.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRemise)) return "La date de remise est invalide.";
    if (dateEstDansLeFutur(dateRemise, aujourdhui)) {
      return "La date de remise ne peut pas être postérieure à aujourd'hui.";
    }
    if (!materielConfirme) {
      return "Confirmez que le matériel remis correspond à la liste.";
    }
    return null;
  }, [aujourdhui, dateRemise, detenteurFonction, detenteurNom, materielConfirme]);

  // ── Envoi ───────────────────────────────────────────────────────────────
  const envoyer = useCallback(async () => {
    // UNE SEULE remise : le double-clic est sans effet.
    if (envoiEnCours.current) return;

    if (erreurDeSaisie) {
      setErreur(erreurDeSaisie);
      return;
    }

    envoiEnCours.current = true;
    setEnvoi(true);
    setErreur(null);

    // Quatre champs, et rien d'autre : ni statut, ni stock.
    const payload = construirePayloadRemise({
      detenteurNom,
      detenteurFonction,
      mandataireNom,
      dateRemise,
    });

    try {
      const remise = await remettreSortie(sortie.id, payload);
      setSortieRemise(remise);
      setConfirmationOuverte(false);
      onSuccess(remise);
      toast.success("Remise enregistrée", {
        description: `Référence : ${remise.reference}`,
      });
    } catch (erreurRenvoy) {
      await gererEchec(erreurRenvoy);
    } finally {
      envoiEnCours.current = false;
      setEnvoi(false);
    }
  }, [detenteurFonction, detenteurNom, erreurDeSaisie, gererEchec, mandataireNom, dateRemise, onSuccess, sortie.id]);

  // ── Rendu ───────────────────────────────────────────────────────────────
  // Remise déjà enregistrée : on n'affiche plus le formulaire.
  if (estRemise(sortieCourante)) {
    return (
      <section className="rms-panneau" aria-label={`Remise du matériel — ${sortie.reference}`}>
        <div className="rms-entete">
          <h4 className="rms-ref">{sortie.reference}</h4>
          <span className="rms-badge--success">Remise enregistrée</span>
        </div>
        <RecapitulatifRemise sortie={sortieCourante} />
        <div className="rms-actions">
          <button
            type="button"
            className="rms-bouton rms-bouton--fantome"
            onClick={() => void imprimerBon("preview")}
          >
            <Printer size={16} aria-hidden="true" />
            Imprimer le bon de sortie signé
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rms-panneau" aria-label={`Remise du matériel — ${sortie.reference}`}>
      <div className="rms-entete">
        <h4 className="rms-ref">{sortie.reference}</h4>
        <span className="rms-badge">À remettre</span>
      </div>

      {/* ── Résumé du matériel à remettre ─────────────────────────────────── */}
      <div className="rms-resume">
        <p className="rms-resume-ligne">
          <span>Direction destinataire :</span> {sortie.direction}
        </p>
        <p className="rms-resume-ligne">
          <span>Service demandeur :</span> {sortie.serviceDemandeur}
        </p>
        <ul className="rms-lignes">
          {(sortie.lignes ?? []).map((ligne, index) => (
            <li key={ligne.documentId || index} className="rms-ligne">
              <span className="rms-ligne-designation">{ligne.designation}</span>
              <span className="rms-ligne-detail">Qté : {ligne.quantite}</span>
              <span className="rms-ligne-detail">État : {ligne.etat || "—"}</span>
              <span className="rms-ligne-detail">
                N° logistique : {ligne.numeroLogistique || "—"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rms-actions">
        <button
          type="button"
          className="rms-bouton rms-bouton--fantome"
          onClick={() => void imprimerBon("preview")}
          disabled={envoi}
        >
          <Printer size={16} aria-hidden="true" />
          Imprimer le bon de sortie
        </button>
      </div>

      {/* ── Saisie de la remise ──────────────────────────────────────────── */}
      <div className="rms-champs">
        <div className="rms-champ">
          <label className="rms-libelle" htmlFor={`rms-nom-${sortie.id}`}>
            Nom du détenteur :
          </label>
          <input
            id={`rms-nom-${sortie.id}`}
            className="rms-input"
            value={detenteurNom}
            onChange={(e) => setDetenteurNom(e.target.value)}
            disabled={envoi}
            placeholder="Nom du détenteur"
          />
          {!detenteurNom.trim() && (
            <p className="rms-aide">Saisissez le détenteur</p>
          )}
        </div>

        <div className="rms-champ">
          <label className="rms-libelle" htmlFor={`rms-fonction-${sortie.id}`}>
            Fonction du détenteur :
          </label>
          <input
            id={`rms-fonction-${sortie.id}`}
            className="rms-input"
            value={detenteurFonction}
            onChange={(e) => setDetenteurFonction(e.target.value)}
            disabled={envoi}
            placeholder="Fonction du détenteur"
          />
        </div>

        <div className="rms-champ">
          <label className="rms-libelle" htmlFor={`rms-mandataire-${sortie.id}`}>
            Retiré par (mandataire), si différent du détenteur :
          </label>
          <input
            id={`rms-mandataire-${sortie.id}`}
            className="rms-input"
            value={mandataireNom}
            onChange={(e) => setMandataireNom(e.target.value)}
            disabled={envoi}
            placeholder="Facultatif"
          />
          <p className="rms-aide">
            Le détenteur reste responsable du matériel même s'il mandate quelqu'un.
          </p>
        </div>

        <div className="rms-champ">
          <label className="rms-libelle" htmlFor={`rms-date-${sortie.id}`}>
            Date de la remise :
          </label>
          <input
            id={`rms-date-${sortie.id}`}
            className="rms-input"
            type="date"
            value={dateRemise}
            max={aujourdhui}
            onChange={(e) => setDateRemise(e.target.value)}
            disabled={envoi}
          />
        </div>
      </div>

      <label className="rms-case">
        <input
          type="checkbox"
          checked={materielConfirme}
          onChange={(e) => setMaterielConfirme(e.target.checked)}
          disabled={envoi}
        />
        <span>Le matériel remis correspond à la liste</span>
      </label>

      {erreur && <p className="rms-erreur">{erreur}</p>}

      {confirmationOuverte && (
        <>
          <div className="rms-overlay" onClick={() => setConfirmationOuverte(false)} />
          <div
            className="rms-confirmation"
            role="group"
            aria-label="Confirmation de la remise"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="rms-confirmation-texte">
              La remise ne peut pas être annulée dans l'application
            </p>
            <div className="rms-actions">
              <button
                type="button"
                className="rms-bouton rms-bouton--fantome"
                onClick={() => setConfirmationOuverte(false)}
                disabled={envoi}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rms-bouton rms-bouton--primaire"
                onClick={() => void envoyer()}
                disabled={envoi}
              >
                <Send size={16} aria-hidden="true" />
                {envoi ? "Remise en cours…" : "Confirmer la remise"}
              </button>
            </div>
          </div>
        </>
      )}

      {!confirmationOuverte && (
        <div className="rms-actions">
          <button
            type="button"
            className="rms-bouton rms-bouton--primaire"
            onClick={() => setConfirmationOuverte(true)}
            disabled={envoi || Boolean(erreurDeSaisie)}
          >
            <Send size={16} aria-hidden="true" />
            Enregistrer la remise
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Récapitulatif d'une remise déjà effectuée (lecture seule) : détenteur,
 * fonction, mandataire éventuel et date.
 */
export function RecapitulatifRemise({ sortie }: { sortie: SortieRecord }) {
  return (
    <div className="rms-recap">
      <p className="rms-recap-ligne">
        <span>Détenteur :</span> {sortie.detenteurNom || "—"}
      </p>
      <p className="rms-recap-ligne">
        <span>Fonction :</span> {sortie.detenteurFonction || "—"}
      </p>
      {sortie.mandataireNom && (
        <p className="rms-recap-ligne">
          <span>Retiré par (mandataire) :</span> {sortie.mandataireNom}
        </p>
      )}
      <p className="rms-recap-ligne">
        <span>Date de remise :</span> {sortie.dateRemise || "—"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Carte d'un ordre à remettre / déjà remis                            */
/* ------------------------------------------------------------------ */

interface CarteOrdreRemiseProps {
  sortie: SortieRecord;
  /** Ouvre le panneau de remise sous la carte (onglet « À remettre »). */
  onRemettre?: (sortie: SortieRecord) => void;
  /** Panneau de remise à afficher sous la carte. */
  panneau?: React.ReactNode;
  /** true = la remise est déjà effectuée : lecture seule. */
  lectureSeule?: boolean;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("fr-FR");
}

/** Destination lisible : direction · service · bénéficiaire (sans « — » parasite). */
function destinationDe(sortie: SortieRecord): string {
  return (
    [sortie.direction, sortie.serviceDemandeur, sortie.beneficiaire]
      .filter((partie) => Boolean(partie) && partie !== "—")
      .join(" · ") || "—"
  );
}

/**
 * Carte d'un ordre dans le circuit de remise. Réutilise la charte visuelle
 * des autres cartes (`msa-`) et n'ajoute que ce qui est propre à la remise
 * (`rms-`).
 */
export function CarteOrdreRemise({
  sortie,
  onRemettre,
  panneau,
  lectureSeule = false,
}: CarteOrdreRemiseProps) {
  const lignes = sortie.lignes ?? [];
  const totalQuantites = lignes.length
    ? lignes.reduce((total, ligne) => total + (Number(ligne.quantite) || 0), 0)
    : sortie.quantite;

  return (
    <li className="msa-carte">
      <div className="msa-carte-entete">
        <h3 className="msa-ref">{sortie.reference}</h3>
        {lectureSeule ? (
          <span className="rms-badge--success">Remise effectuée</span>
        ) : (
          <span className="msa-badge msa-badge--attente">À remettre</span>
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
          <p className="msa-champ-valeur">{sortie.justificatif || "—"}</p>
        </div>
        <div className="msa-champ">
          <p className="msa-champ-cle">Lignes :</p>
          <p className="msa-champ-valeur">
            {lignes.length > 0 ? lignes.length : "—"} · {totalQuantites} unité(s) au total
          </p>
        </div>
      </div>

      {lignes.length > 0 && (
        <ul className="rms-lignes">
          {lignes.map((ligne, index) => (
            <li key={ligne.documentId || index} className="rms-ligne">
              <span className="rms-ligne-designation">{ligne.designation}</span>
              <span className="rms-ligne-detail">Qté : {ligne.quantite}</span>
              <span className="rms-ligne-detail">État : {ligne.etat || "—"}</span>
              <span className="rms-ligne-detail">
                N° logistique : {ligne.numeroLogistique || "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {lectureSeule ? (
        <>
          <RecapitulatifRemise sortie={sortie} />
          <div className="rms-actions">
            <BoutonImprimerBon sortie={sortie} />
          </div>
        </>
      ) : (
        <div className="rms-actions">
          <button
            type="button"
            className="msa-bouton msa-bouton--primaire"
            onClick={() => onRemettre?.(sortie)}
            aria-expanded={Boolean(panneau)}
          >
            <Send size={15} aria-hidden="true" />
            Remettre
          </button>
        </div>
      )}

      {panneau}
    </li>
  );
}

/** Bouton « Imprimer le bon de sortie signé » d'une remise déjà effectuée. */
function BoutonImprimerBon({ sortie }: { sortie: SortieRecord }) {
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="rms-bouton rms-bouton--fantome"
        onClick={async () => {
          try {
            await genererPdfBonSortie(modeleBonSortie(sortie), "preview");
          } catch {
            setErreur("Impossible de générer le bon de sortie.");
          }
        }}
      >
        <Printer size={16} aria-hidden="true" />
        Imprimer le bon de sortie signé
      </button>
      {erreur && <p className="rms-erreur">{erreur}</p>}
    </>
  );
}

