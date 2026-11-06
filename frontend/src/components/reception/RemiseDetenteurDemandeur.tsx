import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import {
  SortieRecord,
  getReliquat,
  getStatutRéceptionSortie,
} from "@/lib/movements";
import { type ReceptionPhysiqueRecord } from "@/lib/api";
import {
  fetchRemisesDetenteurs,
  createRemiseDetenteur,
  type RemiseDetenteur,
  type CreateRemiseDetenteurPayload,
} from "@/lib/api";
import {
  PackageCheck,
  User,
  CheckCircle2,
  AlertCircle,
  Save,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const STATUT_BADGE: Record<string, string> = {
  "En cours": "bg-blue-50 text-blue-700 border-blue-200",
  Partielle: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Complète: "bg-green-50 text-green-700 border-green-200",
  Annulée: "bg-red-50 text-red-700 border-red-200",
};

/** Props du composant principal */
interface RemiseDetenteurDemandeurProps {
  /** Sorties avec réception physique complète (reliquat = 0) */
  sorties: SortieRecord[];
  /** Réceptions physiques serveur pour calcul du reliquat */
  receptionsServeur?: ReceptionPhysiqueRecord[];
  /** Utilisateur connecté (demandeur) */
  user: { id: string; name: string; role?: string; directionId?: string };
  /** Callback après confirmation */
  onRemiseConfirmee?: () => void;
}

/** Ligne de remise pour le formulaire */
interface LigneRemiseForm {
  ligneId: string;
  designation: string;
  quantitePrevue: number;
  detenteurNom: string;
  detenteurFonction: string;
  observation?: string;
}

/** Composant principal : liste des sorties éligibles + formulaire par sortie */
export function RemiseDetenteurDemandeur({
  sorties,
  receptionsServeur,
  user,
  onRemiseConfirmee,
}: RemiseDetenteurDemandeurProps) {
  const [remisesServeur, setRemisesServeur] = useState<RemiseDetenteur[]>([]);
  const [isLoadingRemises, setIsLoadingRemises] = useState(true);
  const [sortieOuverte, setSortieOuverte] = useState<SortieRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // L'administrateur consulte les remises : il n'en enregistre aucune.
  const estAdmin = user.role === "admin";

  // Charger les remises depuis l'API au montage
  useEffect(() => {
    const loadRemises = async () => {
      setIsLoadingRemises(true);
      try {
        const data = await fetchRemisesDetenteurs();
        setRemisesServeur(data ?? []);
      } catch {
        setRemisesServeur([]);
      } finally {
        setIsLoadingRemises(false);
      }
    };
    loadRemises();
  }, []);

  // Filtrer les sorties avec réception complète (reliquat = 0) et statut "Sortie effectuée"
  const sortiesEligibles = useMemo(() => {
    return sorties.filter((sortie) => {
      const reliquat = getReliquat(sortie, receptionsServeur);
      return reliquat <= 0 && sortie.statut === "Sortie effectuée";
    });
  }, [sorties, receptionsServeur]);

  // Trier : plus récentes d'abord
  const sortiesTriees = useMemo(
    () => [...sortiesEligibles].sort((a, b) => (a.dateSortie < b.dateSortie ? 1 : -1)),
    [sortiesEligibles]
  );

  // Vérifier si une sortie a déjà une remise côté serveur
  const getRemisePourSortie = useCallback(
    (sortieId: string): RemiseDetenteur | undefined => {
      return remisesServeur.find((r) => r.sortie.documentId === sortieId);
    },
    [remisesServeur]
  );

  const handleOuvrirFormulaire = (sortie: SortieRecord) => {
    setSortieOuverte(sortie);
  };

  const handleFermerFormulaire = () => {
    setSortieOuverte(null);
  };

  const handleRafraichir = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchRemisesDetenteurs();
      setRemisesServeur(data ?? []);
      toast.success("Liste des remises actualisée");
    } catch {
      toast.error("Échec de l'actualisation");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Callback appelé après création réussie d'une remise
  const handleRemiseCree = useCallback(() => {
    handleRafraichir();
    onRemiseConfirmee?.();
  }, [onRemiseConfirmee]);

  return (
    <div className="msc-page rdd-page">
      {/* En-tête */}
      <header className="msc-header rdd-entete">
        <div className="msc-header__content">
          <h1 className="msc-header__title rdd-titre">Remise au détenteur</h1>
          <p className="msc-header__subtitle rdd-sous-titre">
            Enregistrez le détenteur de chaque matériel après la réception physique complète.
          </p>
        </div>
        <div className="msc-header__actions rdd-actions-en-tete">
          <Button
            onClick={handleRafraichir}
            disabled={isRefreshing || isLoadingRemises}
            variant="outline"
            size="sm"
            className="msc-btn msc-btn--outline msc-btn--sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            {isRefreshing ? "Actualisation…" : "Actualiser"}
          </Button>
        </div>
      </header>

      {/* Compteurs */}
      <div className="msc-stats rdd-compteurs" role="region" aria-label="Statistiques de remise">
        <div className="msc-stat rdd-compteur">
          <div className="msc-stat__value rdd-compteur-valeur">{sortiesTriees.length}</div>
          <div className="msc-stat__label rdd-compteur-libelle">Sorties réceptionnées complètement</div>
        </div>
        <div className="msc-stat rdd-compteur">
          <div className="msc-stat__value rdd-compteur-valeur">
            {sortiesTriees.filter((s) => getRemisePourSortie(s.id)).length}
          </div>
          <div className="msc-stat__label rdd-compteur-libelle">Remises enregistrées</div>
        </div>
      </div>

      <div className="msc-divider" aria-hidden="true" />

      {/* Liste des sorties éligibles */}
      <div className="msc-content rdd-contenu">
        {isLoadingRemises ? (
          <div className="msc-empty rdd-etat">
            <RefreshCw className="msc-empty__icon animate-spin" aria-hidden="true" />
            <h3 className="msc-empty__title">Chargement des remises…</h3>
          </div>
        ) : sortiesTriees.length === 0 ? (
          <div className="msc-empty rdd-etat">
            <PackageCheck className="msc-empty__icon" aria-hidden="true" />
            <h3 className="msc-empty__title">Aucune sortie éligible à la remise</h3>
            <p className="msc-empty__description">
              Les sorties doivent avoir une réception physique complète (reliquat = 0)
              et le statut « Sortie effectuée ».
            </p>
          </div>
        ) : (
          <div className="msc-list rdd-liste" role="list" aria-label="Sorties éligibles à la remise">
            {sortiesTriees.map((sortie) => {
              const remise = getRemisePourSortie(sortie.id);
              const statutReception = getStatutRéceptionSortie(sortie, receptionsServeur);
              const dejaRemis = !!remise;

              return (
                <Card key={sortie.id} className="msc-card rdd-carte">
                  <div className="msc-card__header">
                    <div className="msc-card__title-row">
                      <h3 className="msc-card__reference">{sortie.reference}</h3>
                      <p className="msc-card__meta">
                        {sortie.materiel} • {sortie.categorie}
                      </p>
                    </div>
                    <div className="msc-card__badges">
                      <Badge
                        className={
                          dejaRemis
                            ? "msc-badge msc-badge--success"
                            : "msc-badge msc-badge--info"
                        }
                      >
                        {dejaRemis ? "Remis au détenteur" : statutReception}
                      </Badge>
                    </div>
                  </div>
                  <div className="msc-card__body">
                    <div className="msc-grid">
                      <div className="msc-field rdd-champ">
                        <span className="msc-field__label rdd-champ-cle">Quantité prévue</span>
                        <span className="msc-field__value rdd-champ-valeur font-medium">
                          {sortie.quantite} unité(s)
                        </span>
                      </div>
                      <div className="msc-field rdd-champ">
                        <span className="msc-field__label rdd-champ-cle">Direction</span>
                        <span className="msc-field__value msc-field__value--muted rdd-champ-valeur">{sortie.direction}</span>
                      </div>
                      <div className="msc-field rdd-champ">
                        <span className="msc-field__label rdd-champ-cle">Bénéficiaire</span>
                        <span className="msc-field__value msc-field__value--muted rdd-champ-valeur">{sortie.beneficiaire}</span>
                      </div>
                      <div className="msc-field rdd-champ">
                        <span className="msc-field__label rdd-champ-cle">Date de sortie</span>
                        <span className="msc-field__value msc-field__value--muted rdd-champ-valeur">
                          {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>

                    {/* Aperçu des lignes si déjà remis */}
                    {dejaRemis && remise && (
                      <div className="rdd-apercu mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Détenteurs enregistrés :
                        </p>
                        <ul className="rdd-apercu-lignes">
                          {remise.lignes.map((ligne, idx) => (
                            <li key={idx} className="rdd-apercu-ligne">
                              <User className="w-3 h-3 inline mr-1" aria-hidden="true" />
                              <span className="rdd-apercu-designation">
                                {ligne.sortie_ligne?.designation || "Matériel"}
                              </span>
                              <span className="rdd-apercu-detenteur">
                                → {ligne.detenteur_nom} ({ligne.detenteur_fonction})
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-green-600 mt-1">
                          Date de remise : {new Date(remise.date_remise).toLocaleDateString("fr-FR")}
                          {remise.attestation && " • Attestation signée"}
                        </p>
                      </div>
                    )}

                    <div className="msc-card__actions">
                      <div className={`msc-signatures ${dejaRemis ? "msc-signatures--complete" : "msc-signatures--info"}`}>
                        {dejaRemis ? (
                          <>
                            <CheckCircle2 className="msc-signatures__icon" aria-hidden="true" />
                            Remise enregistrée
                          </>
                        ) : (
                          <>
                            <PackageCheck className="msc-signatures__icon" aria-hidden="true" />
                            Prêt pour remise au détenteur
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                        <Button
                          onClick={() => handleOuvrirFormulaire(sortie)}
                          size="sm"
                          disabled={dejaRemis || estAdmin}
                          className={`msc-btn msc-btn--sm ${dejaRemis || estAdmin ? "msc-btn--outline opacity-50 cursor-not-allowed" : "msc-btn--primary"}`}
                        >
                          <User className="msc-btn__icon" aria-hidden="true" />
                          {dejaRemis
                            ? "Déjà remis"
                            : estAdmin
                            ? "Remise (dépositaire)"
                            : "Enregistrer la remise"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulaire de remise au détenteur */}
      {sortieOuverte && (
        <FormulaireRemiseDetenteur
          sortie={sortieOuverte}
          remiseExistante={getRemisePourSortie(sortieOuverte.id)}
          user={user}
          onClose={handleFermerFormulaire}
          onSuccess={handleRemiseCree}
        />
      )}
    </div>
  );
}

/** Formulaire pour enregistrer les détenteurs par ligne de matériel */
interface FormulaireRemiseDetenteurProps {
  sortie: SortieRecord;
  remiseExistante: RemiseDetenteur | undefined;
  user: { id: string; name: string; role?: string; directionId?: string };
  onClose: () => void;
  onSuccess?: () => void;
}

function FormulaireRemiseDetenteur({
  sortie,
  remiseExistante,
  user,
  onClose,
  onSuccess,
}: FormulaireRemiseDetenteurProps) {
  const [lignesDetenteurs, setLignesDetenteurs] = useState<LigneRemiseForm[]>(() => {
    // Initialiser avec la remise existante ou les lignes de la sortie
    if (remiseExistante) {
      return remiseExistante.lignes.map((ligne) => ({
        ligneId: ligne.sortie_ligne?.documentId || ligne.documentId,
        designation: ligne.sortie_ligne?.designation || "Matériel",
        quantitePrevue: ligne.sortie_ligne?.quantite || 1,
        detenteurNom: ligne.detenteur_nom,
        detenteurFonction: ligne.detenteur_fonction,
        observation: ligne.observation,
      }));
    }
    return (sortie.lignes ?? []).map((ligne) => ({
      ligneId: ligne.documentId || ligne.designation,
      designation: ligne.designation,
      quantitePrevue: ligne.quantite,
      detenteurNom: "",
      detenteurFonction: "",
      observation: "",
    }));
  });
  const [dateRemise, setDateRemise] = useState(() => {
    const aujourdhui = new Date();
    const annee = String(aujourdhui.getFullYear());
    const mois = String(aujourdhui.getMonth() + 1).padStart(2, "0");
    const jour = String(aujourdhui.getDate()).padStart(2, "0");
    return `${annee}-${mois}-${jour}`;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmationOuverte, setConfirmationOuverte] = useState(false);

  // Date du jour pour la validation max
  const aujourdhui = useMemo(() => {
    const d = new Date();
    const annee = String(d.getFullYear());
    const mois = String(d.getMonth() + 1).padStart(2, "0");
    const jour = String(d.getDate()).padStart(2, "0");
    return `${annee}-${mois}-${jour}`;
  }, []);

  // Validation : toutes les lignes doivent avoir un détenteur
  const validation = useMemo(() => {
    const lignesIncompletes = lignesDetenteurs.filter(
      (l) => !l.detenteurNom.trim() || !l.detenteurFonction.trim()
    );
    if (lignesIncompletes.length > 0) {
      return {
        ok: false,
        message: `${lignesIncompletes.length} ligne(s) sans détenteur défini.`,
      };
    }
    if (!dateRemise) {
      return { ok: false, message: "La date de remise est requise." };
    }
    if (dateRemise > aujourdhui) {
      return { ok: false, message: "La date de remise ne peut pas être future." };
    }
    return { ok: true, message: undefined };
  }, [lignesDetenteurs, dateRemise, aujourdhui]);

  const handleLigneChange = (
    index: number,
    field: "detenteurNom" | "detenteurFonction" | "observation",
    value: string
  ) => {
    setLignesDetenteurs((prev) =>
      prev.map((ligne, i) =>
        i === index ? { ...ligne, [field]: value } : ligne
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role === "admin") {
      setErreur("Consultation seule : le compte administrateur ne peut pas enregistrer de remise.");
      return;
    }
    if (!validation.ok || isSubmitting) return;

    setIsSubmitting(true);
    setErreur(null);

    try {
      // Construire le payload pour l'API
      const payload: CreateRemiseDetenteurPayload = {
        sortie: sortie.id,
        date_remise: dateRemise,
        materiels: lignesDetenteurs.map((ligne) => ({
          ligne: ligne.ligneId,
          detenteur_nom: ligne.detenteurNom,
          detenteur_fonction: ligne.detenteurFonction,
          observation: ligne.observation,
        })),
        attestation: true,
      };

      await createRemiseDetenteur(payload);

      setIsSubmitting(false);
      setConfirmationOuverte(false);
      toast.success("Remise au détenteur enregistrée", {
        description: `${lignesDetenteurs.length} matériel(s) affecté(s) pour ${sortie.reference}.`,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      const message = err?.response?.data?.error?.message || "Échec de l'enregistrement de la remise.";
      setErreur(message);
      toast.error("Échec", { description: message });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="msc-dialog msc-dialog__content sm:max-w-2xl max-h-[90vh]">
        <div className="msc-dialog__header">
          <h2 className="msc-dialog__title">
            <PackageCheck className="msc-dialog__title-icon" aria-hidden="true" />
            Remise au détenteur — {sortie.reference}
          </h2>
          <p className="msc-dialog__description">
            {sortie.materiel} • Quantité totale :{" "}
            <span className="font-medium">{sortie.quantite}</span>{" "}
            • Direction : {sortie.direction}
          </p>
        </div>
        <Separator className="my-3" />
        <div className="msc-dialog__body">
          <form onSubmit={handleSubmit} data-testid="rdd-form" className="msc-form">
            {erreur && (
              <div className="msc-alert msc-alert--error" role="alert">
                <AlertCircle className="msc-alert__icon" aria-hidden="true" />
                <div className="msc-alert__content">
                  <div className="msc-alert__title">Erreur</div>
                  <div className="msc-alert__description">{erreur}</div>
                </div>
              </div>
            )}

            {/* Date de remise */}
            <div className="msc-form__group">
              <Label htmlFor="rdd-date-remise" className="msc-form__label msc-form__label--required">
                Date de la remise
              </Label>
              <Input
                id="rdd-date-remise"
                type="date"
                value={dateRemise}
                max={aujourdhui}
                onChange={(e) => setDateRemise(e.target.value)}
                className="msc-form__input"
                style={{ width: '12rem' }}
                disabled={isSubmitting}
              />
            </div>

            <Separator />

            {/* Lignes de matériel avec détenteur */}
            <div className="msc-form__group">
              <Label className="msc-form__label msc-form__label--required">
                Détenteur par matériel
              </Label>
              <p className="msc-form__hint">
                Indiquez qui a reçu physiquement chaque matériel. Le détenteur n'a pas
                besoin de compte utilisateur.
              </p>

              <ScrollArea className="h-64 border border-border rounded-md p-2">
                <div className="space-y-3">
                  {lignesDetenteurs.map((ligne, index) => (
                    <div
                      key={ligne.ligneId}
                      className="rdd-ligne-formulaire grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-4">
                        <Label
                          htmlFor={`rdd-detenteur-nom-${index}`}
                          className="msc-field__label"
                        >
                          Matériel
                        </Label>
                        <Input
                          id={`rdd-detenteur-nom-${index}`}
                          value={`${ligne.designation} (Qté: ${ligne.quantitePrevue})`}
                          readOnly
                          className="msc-form__input bg-muted"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label
                          htmlFor={`rdd-detenteur-nom-input-${index}`}
                          className="msc-form__label msc-form__label--required"
                        >
                          Nom du détenteur
                        </Label>
                        <Input
                          id={`rdd-detenteur-nom-input-${index}`}
                          value={ligne.detenteurNom}
                          onChange={(e) =>
                            handleLigneChange(index, "detenteurNom", e.target.value)
                          }
                          placeholder="Ex: Rakoto"
                          disabled={isSubmitting}
                          className="msc-form__input"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label
                          htmlFor={`rdd-detenteur-fonction-${index}`}
                          className="msc-form__label msc-form__label--required"
                        >
                          Fonction
                        </Label>
                        <Input
                          id={`rdd-detenteur-fonction-${index}`}
                          value={ligne.detenteurFonction}
                          onChange={(e) =>
                            handleLigneChange(index, "detenteurFonction", e.target.value)
                          }
                          placeholder="Ex: Chef de service IT"
                          disabled={isSubmitting}
                          className="msc-form__input"
                        />
                      </div>
                      <div className="sm:col-span-12">
                        <Label
                          htmlFor={`rdd-observation-${index}`}
                          className="msc-form__label"
                        >
                          Observation (optionnel)
                        </Label>
                        <Input
                          id={`rdd-observation-${index}`}
                          value={ligne.observation || ""}
                          onChange={(e) =>
                            handleLigneChange(index, "observation", e.target.value)
                          }
                          placeholder="Remarque sur l'état ou la remise..."
                          disabled={isSubmitting}
                          className="msc-form__input"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {!validation.ok && validation.message && (
                <p className="msc-form__error" role="alert">
                  <AlertCircle className="msc-form__error-icon" aria-hidden="true" />
                  {validation.message}
                </p>
              )}
            </div>
          </form>
        </div>
        <Separator className="my-3" />
        <div className="msc-dialog__footer">
          <div className="text-xs text-muted-foreground" style={{ flex: 1 }}>
            {remiseExistante && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                Une remise existe déjà pour cette sortie — elle sera remplacée.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {confirmationOuverte ? (
              <>
                <Button
                  onClick={() => setConfirmationOuverte(false)}
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  className="msc-btn msc-btn--outline msc-btn--sm"
                >
                  <X className="w-3 h-3 mr-1" aria-hidden="true" /> Annuler
                </Button>
                <Button
                  onClick={() => handleSubmit(new Event("submit") as any)}
                  disabled={!validation.ok || isSubmitting}
                  size="sm"
                  className="msc-btn msc-btn--primary msc-btn--sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-2 animate-spin" aria-hidden="true" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3 mr-1" aria-hidden="true" /> Confirmer la remise
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setConfirmationOuverte(true)}
                variant="outline"
                size="sm"
                disabled={isSubmitting || !validation.ok}
                className="msc-btn msc-btn--outline msc-btn--sm"
              >
                <Save className="w-3 h-3 mr-1" aria-hidden="true" /> Enregistrer la remise
              </Button>
            )}
          </div>
        </div>

        {/* Modal de confirmation */}
        {confirmationOuverte && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setConfirmationOuverte(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rdd-confirm-title"
          >
            <div
              className="bg-background rounded-lg p-6 w-full max-w-md shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="rdd-confirm-title" className="text-lg font-semibold mb-2">
                Confirmer la remise au détenteur
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Cette action enregistre la remise de <strong>{lignesDetenteurs.length}</strong>
                matériel(s) pour la sortie <strong>{sortie.reference}</strong>.
              </p>
              <p className="text-xs text-amber-600 mb-4 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                Les données seront persistées côté serveur via l'API.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setConfirmationOuverte(false)}
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  className="msc-btn msc-btn--outline msc-btn--sm"
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => handleSubmit(new Event("submit") as any)}
                  disabled={!validation.ok || isSubmitting}
                  size="sm"
                  className="msc-btn msc-btn--primary msc-btn--sm"
                >
                  {isSubmitting ? "Enregistrement..." : "Confirmer"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { STATUT_BADGE };