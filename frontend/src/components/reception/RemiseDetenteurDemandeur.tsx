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
import "./RemiseDetenteurDemandeur.css";

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
    <div className="rdd-page">
      {/* En-tête */}
      <div className="rdd-entete">
        <div>
          <h1 className="rdd-titre">Remise au détenteur</h1>
          <p className="rdd-sous-titre">
            Enregistrez le détenteur de chaque matériel après la réception physique complète.
          </p>
        </div>
        <div className="rdd-actions-en-tete">
          <Button
            onClick={handleRafraichir}
            disabled={isRefreshing || isLoadingRemises}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualisation…" : "Actualiser"}
          </Button>
        </div>
      </div>

      {/* Compteurs */}
      <div className="rdd-compteurs">
        <div className="rdd-compteur">
          <div className="rdd-compteur-valeur">{sortiesTriees.length}</div>
          <div className="rdd-compteur-libelle">Sorties réceptionnées complètement</div>
        </div>
        <div className="rdd-compteur">
          <div className="rdd-compteur-valeur">
            {sortiesTriees.filter((s) => getRemisePourSortie(s.id)).length}
          </div>
          <div className="rdd-compteur-libelle">Remises enregistrées</div>
        </div>
      </div>

      <Separator />

      {/* Liste des sorties éligibles */}
      <div className="rdd-contenu">
        {isLoadingRemises ? (
          <div className="rdd-etat">
            <RefreshCw className="w-10 h-10 text-muted-foreground mb-2 animate-spin" />
            <h3 className="font-medium text-foreground mb-1">Chargement des remises…</h3>
          </div>
        ) : sortiesTriees.length === 0 ? (
          <div className="rdd-etat">
            <PackageCheck className="w-10 h-10 text-muted-foreground mb-2" />
            <h3 className="font-medium text-foreground mb-1">
              Aucune sortie éligible à la remise
            </h3>
            <p className="text-sm text-muted-foreground">
              Les sorties doivent avoir une réception physique complète (reliquat = 0)
              et le statut « Sortie effectuée ».
            </p>
          </div>
        ) : (
          <div className="rdd-liste">
            {sortiesTriees.map((sortie) => {
              const remise = getRemisePourSortie(sortie.id);
              const statutReception = getStatutRéceptionSortie(sortie, receptionsServeur);
              const dejaRemis = !!remise;

              return (
                <Card key={sortie.id} className="rdd-carte border border-border">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {sortie.reference}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {sortie.materiel} • {sortie.categorie}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            dejaRemis
                              ? "bg-green-50 text-green-700 border-green-200 text-xs"
                              : STATUT_BADGE[statutReception] + " text-xs"
                          }
                        >
                          {dejaRemis ? "Remis au détenteur" : statutReception}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                      <div className="rdd-champ">
                        <span className="rdd-champ-cle">Quantité prévue</span>
                        <span className="rdd-champ-valeur font-medium">
                          {sortie.quantite} unité(s)
                        </span>
                      </div>
                      <div className="rdd-champ">
                        <span className="rdd-champ-cle">Direction</span>
                        <span className="rdd-champ-valeur text-sm">{sortie.direction}</span>
                      </div>
                      <div className="rdd-champ">
                        <span className="rdd-champ-cle">Bénéficiaire</span>
                        <span className="rdd-champ-valeur text-sm">{sortie.beneficiaire}</span>
                      </div>
                      <div className="rdd-champ">
                        <span className="rdd-champ-cle">Date de sortie</span>
                        <span className="rdd-champ-valeur text-sm">
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
                              <User className="w-3 h-3 inline mr-1" />
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

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {dejaRemis ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            Remise enregistrée
                          </>
                        ) : (
                          <>
                            <PackageCheck className="w-3 h-3 text-blue-600" />
                            Prêt pour remise au détenteur
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleOuvrirFormulaire(sortie)}
                          size="sm"
                          disabled={dejaRemis}
                          className={dejaRemis ? "opacity-50 cursor-not-allowed" : ""}
                          variant={dejaRemis ? "outline" : "default"}
                        >
                          <User className="w-3 h-3 mr-1" />
                          {dejaRemis ? "Déjà remis" : "Enregistrer la remise"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
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
      <DialogContent className="rdd-dialogue sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5" />
            Remise au détenteur — {sortie.reference}
          </DialogTitle>
          <DialogDescription>
            {sortie.materiel} • Quantité totale :{" "}
            <span className="font-medium">{sortie.quantite}</span>{" "}
            • Direction : {sortie.direction}
          </DialogDescription>
        </DialogHeader>
        <Separator className="my-3" />
        <div className="rdd-dialogue-corps space-y-4">
          <form onSubmit={handleSubmit} data-testid="rdd-form">
            {erreur && (
              <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm">
                {erreur}
              </div>
            )}

            {/* Date de remise */}
            <div className="space-y-1">
              <Label htmlFor="rdd-date-remise">Date de la remise</Label>
              <Input
                id="rdd-date-remise"
                type="date"
                value={dateRemise}
                max={aujourdhui}
                onChange={(e) => setDateRemise(e.target.value)}
                className="w-48"
                disabled={isSubmitting}
              />
            </div>

            <Separator />

            {/* Lignes de matériel avec détenteur */}
            <div className="space-y-3">
              <Label className="font-medium">
                Détenteur par matériel <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
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
                          className="text-xs text-muted-foreground block mb-1"
                        >
                          Matériel
                        </Label>
                        <Input
                          id={`rdd-detenteur-nom-${index}`}
                          value={`${ligne.designation} (Qté: ${ligne.quantitePrevue})`}
                          readOnly
                          className="bg-muted text-sm"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label
                          htmlFor={`rdd-detenteur-nom-input-${index}`}
                          className="text-xs block mb-1"
                        >
                          Nom du détenteur <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`rdd-detenteur-nom-input-${index}`}
                          value={ligne.detenteurNom}
                          onChange={(e) =>
                            handleLigneChange(index, "detenteurNom", e.target.value)
                          }
                          placeholder="Ex: Rakoto"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <Label
                          htmlFor={`rdd-detenteur-fonction-${index}`}
                          className="text-xs block mb-1"
                        >
                          Fonction <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`rdd-detenteur-fonction-${index}`}
                          value={ligne.detenteurFonction}
                          onChange={(e) =>
                            handleLigneChange(index, "detenteurFonction", e.target.value)
                          }
                          placeholder="Ex: Chef de service IT"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="sm:col-span-12">
                        <Label
                          htmlFor={`rdd-observation-${index}`}
                          className="text-xs block mb-1"
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
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {!validation.ok && validation.message && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validation.message}
                </p>
              )}
            </div>
          </form>
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {remiseExistante && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" />
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
                >
                  <X className="w-3 h-3 mr-1" /> Annuler
                </Button>
                <Button
                  onClick={() => handleSubmit(new Event("submit") as any)}
                  disabled={!validation.ok || isSubmitting}
                  size="sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3 mr-1" /> Confirmer la remise
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
              >
                <Save className="w-3 h-3 mr-1" /> Enregistrer la remise
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
                <AlertCircle className="w-3 h-3" />
                Les données seront persistées côté serveur via l'API.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setConfirmationOuverte(false)}
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  onClick={() => handleSubmit(new Event("submit") as any)}
                  disabled={!validation.ok || isSubmitting}
                  size="sm"
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