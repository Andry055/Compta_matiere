import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  Clock,
  FileOutput,
  Inbox,
  Loader2,
  MessageCircle,
  Package,
  ShieldCheck,
  Truck,
  User,
  X,
} from "lucide-react";
import type { User } from "../App";
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
   * documentId de la demande visée par une notification « nouvelle demande »
   * (clic dans la cloche). La carte correspondante est mise en évidence et
   * défile jusqu'à elle : le clic ouvre bien LA demande concernée.
   */
  demandeCibleId?: string;
  /** Notifie le parent que la demande visée a été prise en compte. */
  onDemandeCibleConsumed?: () => void;
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
export function DecisionRequests({
  user,
  demandeCibleId,
  onDemandeCibleConsumed,
  onCreerOrdreSortie,
}: DecisionRequestsProps) {
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
  /** Demande mise en évidence (cible d'une notification « nouvelle demande »). */
  const [demandeMiseEnEvidence, setDemandeMiseEnEvidence] = useState<string | null>(
    null
  );
  /** Carte de la demande cible, pour la faire défiler jusqu'à elle. */
  const refDemandeCible = useRef<HTMLElement | null>(null);

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

  /**
   * Clic sur une notification « nouvelle demande » → la demande visée est
   * mise en évidence et défile jusqu'à elle.
   *
   * L'effet attend le chargement de la liste (`demandes`) : sans les données
   * réelles, la cible est introuvable. La cible est ensuite « consommée »
   * auprès du parent : elle ne serait sinon réappliquée à chaque rechargement
   * de la liste.
   */
  useEffect(() => {
    if (!demandeCibleId || !demandes) return;

    const cible = demandes.find((d) => d.documentId === demandeCibleId);
    if (cible) {
      setDemandeMiseEnEvidence(demandeCibleId);
      // Le défilement attend le rendu de la carte mise en évidence.
      window.requestAnimationFrame(() => {
        refDemandeCible.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    }
    onDemandeCibleConsumed?.();
  }, [demandes, demandeCibleId, onDemandeCibleConsumed]);

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

  // ═════════════════════════════════════════════════════════════════════════
  // Composant de ligne de matériel enrichie (réutilisé par les deux sections)
  // ═════════════════════════════════════════════════════════════════════════

  const LigneMateriel = ({
    ligne,
    index,
    demande,
    ajustable = false,
  }: {
    ligne: DemandeRecord["lignes"][number];
    index: number;
    demande: DemandeRecord;
    ajustable?: boolean;
  }) => {
    const cle = `${demande.documentId || demande.id}-${index}`;
    const ajustee = quantiteDe(demande, index, ligne.quantite);
    const demandee = ligne.quantiteDemandee ?? ligne.quantite;

    return (
      <div
        key={cle}
        className="flex items-start gap-2.5 rounded border border-border bg-background p-2.5"
      >
        <div className="flex-shrink-0 h-7 w-7 rounded bg-muted/20 flex items-center justify-center">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-card-foreground">{ligne.materiel}</div>
          {ligne.categorie && ligne.categorie !== "—" && (
            <div className="text-xs text-muted-foreground">
              {ligne.categorie}
            </div>
          )}
          <div className="mt-1.5 text-xs text-muted-foreground">
            Quantité :
            <span className="text-card-foreground font-mono ml-0.5">
              {ajustee}
            </span>
            {demandee !== ajustee && (
              <span className="text-amber-600 dark:text-amber-400 ml-1.5">
                demandé : {demandee}
              </span>
            )}
          </div>
        </div>
        {ajustable && (
          <div className="flex-shrink-0 w-20">
            <input
              type="number"
              min={1}
              aria-label={`Quantité pour ${ligne.materiel}`}
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              value={ajustee}
              onChange={(e) =>
                ajuster(demande, index, Number(e.target.value) || 0)
              }
            />
          </div>
        )}
        <div className="hidden sm:flex flex-col items-end gap-0.5">
          <div className="text-xs text-muted-foreground">
            Détenteur
          </div>
          <div className="text-sm text-card-foreground break-words">
            {ligne.detenteur || "—"}
          </div>
        </div>
        {!ajustable && (
          <div className="hidden sm:flex flex-col items-end gap-0.5">
            <div className="text-xs text-muted-foreground">Motif</div>
            <div className="text-sm text-card-foreground break-words">
              {ligne.motif || "—"}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Carte de demande : section « Demandes à traiter »
  // ═════════════════════════════════════════════════════════════════════════

  const CarteDemandeATraiter = ({ demande }: { demande: DemandeRecord }) => {
    const occupée = enCours === demande.documentId;
    const miseEnEvidence = demandeMiseEnEvidence === demande.documentId;
    const rejetOuvert = rejetEnCours === demande.documentId;
    const cleQuantite = (index: number) =>
      `${demande.documentId || demande.id}-${index}`;
    const quantiteAjustee = (index: number) =>
      quantiteDe(demande, index, demande.lignes[index]?.quantite ?? 1);
    const quantiteDemandee = (index: number) =>
      demande.lignes[index]?.quantiteDemandee ?? demande.lignes[index]?.quantite ?? 1;

    return (
      <article
        key={demande.documentId || demande.id}
        ref={miseEnEvidence ? refDemandeCible : undefined}
        data-demande-cible={miseEnEvidence ? "true" : undefined}
        className={`rounded-lg border cm-panel cm-panel-solid p-4 ${
          miseEnEvidence
            ? "border-primary ring-2 ring-primary/40"
            : "border-border"
        }`}
      >
        {/* En-tête : référence, statut, priorité, date */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDateCourt(demande.date)}
          </div>
        </header>

        {/* Demandeur et périmètre */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-card-foreground">{demande.demandeur}</span>
            {demande.fonction && (
              <span className="text-xs text-muted-foreground">
                — {demande.fonction}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>{demande.direction}</span>
            <span className="mx-0.5">—</span>
            <span>{demande.service}</span>
          </div>
        </div>

        {/* Lignes de matériel avec quantité ajustable */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
              Matériels demandés
            </h4>
            <span className="ml-auto text-xs text-muted-foreground">
              {demande.lignes.length} ligne{demande.lignes.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1.5">
            {demande.lignes.map((ligne, index) => (
              <LigneMateriel
                key={cleQuantite(index)}
                ligne={ligne}
                index={index}
                demande={demande}
                ajustable
              />
            ))}
          </div>
          {demande.lignes.some(
            (l, i) =>
              quantiteAjustee(i) !== quantiteDemandee(i)
          ) && (
            <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
              Une ou plusieurs quantités ont été ajustées par rapport à la
              demande initiale.
            </div>
          )}
        </div>

        {/* Détails : motif, observation, dates */}
        <div className="mb-3 space-y-2">
          {demande.motif && (
            <div className="flex items-start gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  Motif de la demande
                </div>
                <div className="text-sm text-card-foreground break-words">
                  {demande.motif}
                </div>
              </div>
            </div>
          )}
          {demande.observation && (
            <div className="flex items-start gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  Observation
                </div>
                <div className="text-sm text-card-foreground break-words">
                  {demande.observation}
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Créé : {formatDateCourt(demande.date)}
              </span>
            </div>
            {demande.dateEnvoi && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 opacity-50" />
                <span>Envoyé : {formatDateCourt(demande.dateEnvoi)}</span>
              </div>
            )}
            {demande.dateValidation && (
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validé : {formatDateCourt(demande.dateValidation)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions : Approuver / Rejeter */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
          <button
            type="button"
            disabled={occupée}
            onClick={() => approuver(demande)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {occupée ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Approuver
          </button>
          <button
            type="button"
            disabled={occupée}
            onClick={() => {
              setRejetEnCours(
                rejetEnCours === demande.documentId ? null : demande.documentId
              );
              setMessage(null);
            }}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Rejeter
          </button>
        </div>

        {rejetOuvert && (
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
              disabled={occupée || !motif.trim()}
              onClick={() => rejeter(demande)}
              className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-60"
            >
              Confirmer le rejet
            </button>
          </div>
        )}
      </article>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // Carte de demande : section « Demandes approuvées »
  // ═════════════════════════════════════════════════════════════════════════

  const CarteDemandeApprouvee = ({ demande }: { demande: DemandeRecord }) => {
    const occupe = ordreEnCours === demande.documentId;
    const miseEnEvidence = demandeMiseEnEvidence === demande.documentId;
    const dejaOrdonnee = !!demande.sortieReference;

    return (
      <article
        key={`ordre-${demande.documentId || demande.id}`}
        ref={miseEnEvidence ? refDemandeCible : undefined}
        data-demande-cible={miseEnEvidence ? "true" : undefined}
        className={`rounded-lg border cm-panel cm-panel-solid p-4 ${
          miseEnEvidence
            ? "border-primary ring-2 ring-primary/40"
            : "border-border"
        }`}
      >
        {/* En-tête : référence, statut, date */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDateCourt(demande.date)}
          </div>
        </header>

        {/* Demandeur et périmètre */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-card-foreground">{demande.demandeur}</span>
            {demande.fonction && (
              <span className="text-xs text-muted-foreground">
                — {demande.fonction}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>{demande.direction}</span>
            <span className="mx-0.5">—</span>
            <span>{demande.service}</span>
          </div>
        </div>

        {/* Lignes avec quantités approuvées */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
              Matériels approuvés
            </h4>
          </div>
          <div className="space-y-1.5">
            {demande.lignes.map((ligne, index) => (
              <LigneMateriel
                key={`${demande.documentId || demande.id}-${index}`}
                ligne={ligne}
                index={index}
                demande={demande}
                ajustable={false}
              />
            ))}
          </div>
        </div>

        {/* Détails : motif, observation, dates */}
        <div className="mb-3 space-y-2">
          {demande.motif && (
            <div className="flex items-start gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  Motif de la demande
                </div>
                <div className="text-sm text-card-foreground break-words">
                  {demande.motif}
                </div>
              </div>
            </div>
          )}
          {demande.observation && (
            <div className="flex items-start gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  Observation
                </div>
                <div className="text-sm text-card-foreground break-words">
                  {demande.observation}
                </div>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Créé : {formatDateCourt(demande.date)}
              </span>
            </div>
            {demande.dateValidation && (
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Validé : {formatDateCourt(demande.dateValidation)}</span>
              </div>
            )}
            {demande.validePar && (
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 opacity-50" />
                <span>par {demande.validePar}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sortie associée ou bouton de création */}
        {dejaOrdonnee ? (
          <div className="p-3 rounded bg-muted/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
                Ordre de sortie
              </h4>
            </div>
            <div className="text-sm font-mono text-card-foreground">
              {demande.sortieReference}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Une demande, un ordre : cet ordre existe déjà.
            </p>
          </div>
        ) : (
          <button
            type="button"
            disabled={occupe}
            onClick={() => creerOrdre(demande)}
            className="flex w-full items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {occupe ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileOutput className="h-3.5 w-3.5" />
            )}
            Créer l'ordre de sortie
          </button>
        )}
      </article>
    );
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

      {/* ══════════════════════════════════════════════════════════════════════
         SECTION : Demandes à traiter
         ════════════════════════════════════════════════════════════════════ */}
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

        {aTraiter.map((demande) => (
          <CarteDemandeATraiter key={demande.documentId || demande.id} demande={demande} />
        ))}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
         SECTION : Demandes approuvées (ÉTAPE 3 — Ordre de sortie)
         ════════════════════════════════════════════════════════════════════ */}
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

        {approuvees.map((demande) => (
          <CarteDemandeApprouvee
            key={demande.documentId || demande.id}
            demande={demande}
          />
        ))}
      </section>
    </div>
  );
}
