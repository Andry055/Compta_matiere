import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  FileOutput,
  Inbox,
  Loader2,
  Package,
  X,
} from "lucide-react";
import { User } from "../App";
import {
  DemandeRecord,
  LigneDecision,
  approuverDemande,
  creerOrdreSortie,
  fetchDemandesDetail,
  formatDateCourt,
  prioriteDemandeBadge,
  rejeterDemande,
  statutDemandeBadge,
} from "../lib/demandes";
import { Message } from "./ui/message";

interface DecisionRequestsProps {
  user?: User;
  /**
   * ÉTAPE 3 « ouverte » : au lieu de créer l'ordre d'un seul clic (le
   * serveur préremplirait tout en base), le bouton transmet la demande au
   * parent qui ouvre la page Distribution, onglet « Ordres de sortie », avec
   * le formulaire PRÉREMPLI à partir de la demande. Le dépositaire vérifie
   * puis confirme : la création n'a lieu qu'à cette confirmation.
   *
   * Fourni UNIQUEMENT pour le dépositaire (le formulaire de Distribution est
   * réservé à ce rôle) : sans cette prop, le comportement historique serveur
   * est conservé.
   */
  onCreerOrdreSortie?: (demande: DemandeRecord) => void;
}

/**
 * ÉTAPE 2 « Décision » + ÉTAPE 3 « Ordre de sortie » — écran du DÉPOSITAIRE
 * comptable.
 *
 * L'écran liste les demandes EN ATTENTE lues dans la BASE (jamais une liste
 * de démonstration) et permet de :
 *  - AJUSTER la quantité de chaque ligne puis APPROUVER la demande ;
 *  - REJETER la demande en saisissant un MOTIF (obligatoire) ;
 *  - transformer une demande DÉJÀ APPROUVÉE en ORDRE DE SORTIE (étape 3) :
 *    un seul bouton, le serveur préremplit TOUT depuis la demande (direction,
 *    lignes, pièce justificative = référence de la demande) et refuse un
 *    second ordre pour la même demande.
 *
 * Le serveur reste seul juge : il re-vérifie le stock, refuse une seconde
 * validation, refuse un second ordre et renvoie un message d'erreur qui est
 * AFFICHÉ tel quel (jamais de fausse réussite).
 */
export function DecisionRequests({ user, onCreerOrdreSortie }: DecisionRequestsProps) {
  const [demandes, setDemandes] = useState<DemandeRecord[] | null>(null);
  const [origineDetail, setOrigineDetail] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    texte: string;
    variante: "success" | "danger";
  } | null>(null);
  /** Quantités en cours d'ajustement, par demande et par index de ligne. */
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  /** Demande en cours de rejet (motif saisi). */
  const [rejetEnCours, setRejetEnCours] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  /** Demande dont l'ordre de sortie est en cours de création (étape 3). */
  const [ordreEnCours, setOrdreEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const resultat = await fetchDemandesDetail();
    if (resultat.ok) {
      setDemandes(resultat.demandes);
      setOrigineDetail(null);
    } else {
      setDemandes(null);
      setOrigineDetail(
        {
          session_absente:
            "Aucune session serveur : reconnectez-vous pour traiter les demandes.",
          session_expiree:
            "Session expirée : reconnectez-vous pour traiter les demandes.",
          acces_refuse:
            "Votre rôle ne permet pas de traiter les demandes.",
          reseau: "Backend injoignable : les demandes de la base ne sont pas lisibles.",
        }[resultat.echec] ?? null
      );
    }
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Seules les demandes EN ATTENTE sont à traiter (une seule validation). */
  const aTraiter = useMemo(
    () => (demandes || []).filter((d) => d.statut === "En attente"),
    [demandes]
  );

  /**
   * Demandes DÉJÀ APPROUVÉES : elles peuvent devenir un ordre de sortie
   * (étape 3). La demande « Sortie effectuée » n'est plus concernée : son
   * ordre existe déjà et la sortie a eu lieu.
   */
  const approuvees = useMemo(
    () => (demandes || []).filter((d) => d.statut === "Validée"),
    [demandes]
  );

  const quantiteDe = (demande: DemandeRecord, index: number, demandee: number) => {
    const cle = `${demande.documentId || demande.id}-${index}`;
    const valeur = quantites[cle];
    return typeof valeur === "number" ? valeur : demandee;
  };

  const ajuster = (demande: DemandeRecord, index: number, valeur: number) => {
    const cle = `${demande.documentId || demande.id}-${index}`;
    setQuantites((precedent) => ({ ...precedent, [cle]: valeur }));
  };

  const lignesDe = (demande: DemandeRecord): LigneDecision[] =>
    demande.lignes
      .filter((ligne) => !!ligne.materielDocumentId)
      .map((ligne, index) => ({
        materiel: ligne.materielDocumentId as string,
        quantite: quantiteDe(demande, index, ligne.quantite),
      }));

  const approuver = async (demande: DemandeRecord) => {
    if (!demande.documentId) {
      setMessage({
        texte: "Cette demande n'a pas d'identifiant serveur : elle ne peut pas être approuvée.",
        variante: "danger",
      });
      return;
    }
    setEnCours(demande.documentId);
    setMessage(null);
    const resultat = await approuverDemande(
      demande.documentId,
      lignesDe(demande)
    );
    setEnCours(null);
    if (!resultat.ok) {
      setMessage({ texte: resultat.message, variante: "danger" });
      return;
    }
    setMessage({
      texte: `Demande ${demande.reference} approuvée.`,
      variante: "success",
    });
    charger();
  };

  const rejeter = async (demande: DemandeRecord) => {
    if (!demande.documentId) {
      setMessage({
        texte: "Cette demande n'a pas d'identifiant serveur : elle ne peut pas être rejetée.",
        variante: "danger",
      });
      return;
    }
    if (!motif.trim()) {
      setMessage({
        texte: "Le motif du rejet est obligatoire.",
        variante: "danger",
      });
      return;
    }
    setEnCours(demande.documentId);
    setMessage(null);
    const resultat = await rejeterDemande(demande.documentId, motif);
    setEnCours(null);
    if (!resultat.ok) {
      setMessage({ texte: resultat.message, variante: "danger" });
      return;
    }
    setMessage({
      texte: `Demande ${demande.reference} rejetée.`,
      variante: "success",
    });
    setRejetEnCours(null);
    setMotif("");
    charger();
  };

  /**
   * ÉTAPE 3 — crée l'ORDRE DE SORTIE de la demande (un clic).
   *
   * L'écran n'envoie que l'identifiant de la demande : le serveur préremplit
   * la direction, le service, les lignes (quantités approuvées) et la pièce
   * justificative (= référence de la demande), puis refuse un second ordre.
   */
  const creerOrdre = async (demande: DemandeRecord) => {
    if (!demande.documentId) {
      setMessage({
        texte:
          "Cette demande n'a pas d'identifiant serveur : elle ne peut pas être transformée en ordre.",
        variante: "danger",
      });
      return;
    }

    // ÉTAPE 3 « ouverte » : on n'écrit RIEN côté serveur ici. La demande est
    // transmise au parent, qui ouvre l'onglet « Ordres de sortie » avec le
    // formulaire prérempli ; le serveur reste seul juge à la confirmation
    // (stock, valeur unitaire, « une demande, un ordre »).
    if (onCreerOrdreSortie) {
      setMessage({
        texte: `Demande ${demande.reference} : le formulaire de l'onglet « Ordres de sortie » est prérempli — vérifiez puis confirmez la création.`,
        variante: "success",
      });
      onCreerOrdreSortie(demande);
      return;
    }

    setOrdreEnCours(demande.documentId);
    setMessage(null);
    const resultat = await creerOrdreSortie(demande.documentId);
    setOrdreEnCours(null);
    if (!resultat.ok) {
      setMessage({ texte: resultat.message, variante: "danger" });
      return;
    }
    setMessage({
      texte: `Ordre de sortie ${resultat.reference || ""} créé pour la demande ${demande.reference}.`,
      variante: "success",
    });
    charger();
  };

  return (
    <div className="space-y-4">
      {origineDetail && (
        <Message variant="warning" title="Lecture impossible">
          {origineDetail}
        </Message>
      )}

      {message && (
        <Message
          variant={message.variante === "success" ? "success" : "danger"}
        >
          {message.texte}
        </Message>
      )}

      {chargement && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des demandes…
        </div>
      )}

      <section aria-label="Demandes à traiter" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Demandes à traiter
            </h2>
            <p className="text-sm text-muted-foreground">
              Décision du Dépositaire comptable sur les demandes en attente.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
            {chargement ? "…" : `${aTraiter.length} à traiter`}
          </span>
        </div>

        {!chargement && aTraiter.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border cm-panel cm-panel-solid p-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucune demande en attente de décision.
            </p>
          </div>
        )}

        {aTraiter.map((demande) => {
        const occupée = enCours === demande.documentId;
        return (
          <article
            key={demande.documentId || demande.id}
            className="rounded-lg border border-border cm-panel cm-panel-solid p-4"
          >
            <header className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {demande.reference}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${statutDemandeBadge(
                  demande.statut
                )}`}
              >
                {demande.statut}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${prioriteDemandeBadge(
                  demande.priorite
                )}`}
              >
                {demande.priorite}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDateCourt(demande.date)}
              </span>
              <span className="text-xs text-muted-foreground">
                {demande.direction} — {demande.service}
              </span>
            </header>

            <ul className="mb-3 space-y-2">
              {demande.lignes.map((ligne, index) => {
                const cle = `${demande.documentId || demande.id}-${index}`;
                const ajustee = quantiteDe(demande, index, ligne.quantite);
                const demandee =
                  ligne.quantiteDemandee ?? ligne.quantite;
                return (
                  <li
                    key={cle}
                    className="flex flex-wrap items-center gap-3 rounded border border-border p-2"
                  >
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">
                      {ligne.materiel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ligne.motif}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      Quantité
                      <input
                        type="number"
                        min={1}
                        aria-label={`Quantité pour ${ligne.materiel}`}
                        className="w-20 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                        value={ajustee}
                        onChange={(e) =>
                          ajuster(demande, index, Number(e.target.value) || 0)
                        }
                      />
                    </span>
                    {ajustee !== demandee && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        demandée : {demandee}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={occupée}
                onClick={() => approuver(demande)}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
              >
                {occupée ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approuver
              </button>
              <button
                type="button"
                disabled={occupée}
                onClick={() => {
                  setRejetEnCours(
                    rejetEnCours === demande.documentId
                      ? null
                      : demande.documentId
                  );
                  setMessage(null);
                }}
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                Rejeter
              </button>
            </div>

            {rejetEnCours === demande.documentId && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  aria-label="Motif du rejet"
                  placeholder="Motif du rejet (ex. non disponible)"
                  className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                />
                <button
                  type="button"
                  disabled={occupée}
                  onClick={() => rejeter(demande)}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-60"
                >
                  Confirmer le rejet
                </button>
              </div>
            )}
          </article>
        );
        })}
      </section>

      {/* ═══════ ÉTAPE 3 « Ordre de sortie » ═══════ */}
      <section aria-label="Demandes approuvées" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Demandes approuvées
            </h2>
            <p className="text-sm text-muted-foreground">
              {onCreerOrdreSortie
                ? "Un bouton ouvre le formulaire de l'onglet « Ordres de sortie » prérempli avec la demande : direction, lignes et pièce justificative sont repris de la demande."
                : "Un bouton crée l'ordre de sortie : direction, lignes et pièce justificative sont repris de la demande par le serveur."}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
            {chargement ? "…" : `${approuvees.length} approuvée(s)`}
          </span>
        </div>

        {!chargement && approuvees.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border cm-panel cm-panel-solid p-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucune demande approuvée à transformer en ordre de sortie.
            </p>
          </div>
        )}

        {approuvees.map((demande) => {
          const occupe = ordreEnCours === demande.documentId;
          const dejaOrdonnee = !!demande.sortieReference;
          return (
            <article
              key={`ordre-${demande.documentId || demande.id}`}
              className="rounded-lg border border-border cm-panel cm-panel-solid p-4"
            >
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">
                  {demande.reference}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${statutDemandeBadge(
                    demande.statut
                  )}`}
                >
                  {demande.statut}
                </span>
                <span className="text-xs text-muted-foreground">
                  {demande.direction} — {demande.service}
                </span>
              </header>

              <ul className="mb-3 space-y-1">
                {demande.lignes.map((ligne, index) => (
                  <li
                    key={`${demande.documentId || demande.id}-${index}`}
                    className="flex flex-wrap items-center gap-3 text-sm text-foreground"
                  >
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{ligne.materiel}</span>
                    <span className="text-xs text-muted-foreground">
                      quantité approuvée : {ligne.quantite}
                    </span>
                  </li>
                ))}
              </ul>

              {dejaOrdonnee ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileOutput className="h-4 w-4" />
                  Ordre de sortie {demande.sortieReference} déjà créé (une
                  demande, un ordre).
                </p>
              ) : (
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => creerOrdre(demande)}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
                >
                  {occupe ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileOutput className="h-4 w-4" />
                  )}
                  Créer l'ordre de sortie
                </button>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
