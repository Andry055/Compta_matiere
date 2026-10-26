import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import {
  SortieRecord,
  peutRecevoir,
  receptions,
  getQuantiteDejaRecue,
} from "@/lib/movements";
import {
  creerReceptionPhysique,
  getStrapiAuthUser,
  type ReceptionPhysiqueRecord,
} from "@/lib/api";
import {
  Truck,
  AlertCircle,
  CheckCircle2,
  Save,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface FormulaireRéceptionProps {
  sortie: SortieRecord;
  receptionsServeur?: ReceptionPhysiqueRecord[];
  onClose: () => void;
  /** Appelée après un enregistrement serveur réussi, afin que le parent
   *  rafraîchisse ses données (receptionsServeur / sortiesServeur) et que
   *  la liste « À réceptionner » se recalcule (disparition si reliquat nul). */
  onReceptionConfirmée?: () => void;
}

export function FormulaireRéception({ sortie, receptionsServeur, onClose, onReceptionConfirmée }: FormulaireRéceptionProps) {
  const [quantiteRecue, setQuantiteRecue] = useState("");
  const [declarationAnomalie, setDeclarationAnomalie] = useState(false);
  const [descriptionAnomalie, setDescriptionAnomalie] = useState("");
  const [typeAnomalie, setTypeAnomalie] = useState<
    "quantite" | "etat" | "conformite" | "autre"
  >("quantite");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const dejaRecue = getQuantiteDejaRecue(sortie.id, receptionsServeur);
  const reliquatActuel = Math.max(0, sortie.quantite - dejaRecue);

  const validation = peutRecevoir(
    sortie,
    quantiteRecue ? parseInt(quantiteRecue, 10) || 0 : 0,
    receptionsServeur
  );

  const peutValider =
    quantiteRecue.trim() !== "" &&
    parseInt(quantiteRecue, 10) > 0 &&
    validation.ok &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!peutValider) return;

    setIsSubmitting(true);
    setErreur(null);

    const quantite = parseInt(quantiteRecue, 10);
    const utilisateur = getStrapiAuthUser()?.username || "Utilisateur connecté";

    const typeAnomalieBackend = declarationAnomalie && descriptionAnomalie
      ? (() => {
          switch (typeAnomalie) {
            case "quantite": return "incorrect";
            case "etat": return "endommage";
            case "conformite": return "incorrect";
            case "autre": return undefined;
          }
        })()
      : undefined;

    try {
      await creerReceptionPhysique({
        sortieId: sortie.id,
        date_reception: new Date().toISOString(),
        statut: declarationAnomalie ? "anomalie" : "conforme",
        quantite_prevue: sortie.quantite,
        quantite_recue: quantite,
        utilisateur,
        ...(typeAnomalieBackend !== undefined && {
          type_anomalie: typeAnomalieBackend,
        }),
        ...(declarationAnomalie && descriptionAnomalie && {
          description_anomalie: descriptionAnomalie,
        }),
      });

      // Mise à jour du cache local uniquement après succès serveur,
      // pour ne jamais présenter des données non persistées comme enregistrées.
      const nouvelleReception = {
        id: `REC-${Date.now()}`,
        sortieId: sortie.id,
        reference: sortie.reference,
        dateRéception: new Date().toISOString(),
        depositaireId: utilisateur,
        depositaireNom: utilisateur,
        direction: sortie.direction,
        statut: validation.reliquat <= 0 ? "Complète" : "Partielle",
        lignes: [
          {
            ligneId: sortie.id,
            designation: sortie.materiel,
            quantitePrevue: sortie.quantite,
            quantiteDejaRecue: dejaRecue,
            quantiteRecue: quantite,
            reliquat: validation.reliquat,
          },
        ],
        anomalies: declarationAnomalie && descriptionAnomalie
          ? [
              {
                id: `ANOM-${Date.now()}`,
                sortieId: sortie.id,
                type: typeAnomalie,
                description: descriptionAnomalie,
                dateDeclaration: new Date().toISOString(),
                declarePar: utilisateur,
                statut: "Ouverte",
              },
            ]
          : [],
        stockDebite: false,
      };
      receptions.push(nouvelleReception);

      // Rafraîchir les données côté parent pour que la liste « À réceptionner »
      // se recalcule avec la nouvelle réception (disparition si reliquat nul).
      onReceptionConfirmée?.();

      setIsSubmitting(false);
      toast.success("Réception enregistrée", {
        description: `${quantite} unité(s) réceptionnée(s) pour ${sortie.reference}.`,
      });
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      let message = "Échec de l'enregistrement de la réception.";
      if (err && typeof err === "object" && "response" in err) {
        const axiosErr = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
        if (axiosErr.response?.status === 403) {
          message = "Accès refusé : vous n'êtes pas autorisé à enregistrer une réception.";
        } else if (axiosErr.response?.status === 400) {
          message = axiosErr.response?.data?.error?.message || "Données de réception invalides.";
        } else if (axiosErr.response?.status === 404) {
          message = "Sortie introuvable.";
        }
      }
      setErreur(message);
      toast.error("Échec de la réception", { description: message });
    }
  };

  const handleQuantiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setQuantiteRecue(value);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="msr-dialogue sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Réception — {sortie.reference}
          </DialogTitle>
          <DialogDescription>
            {sortie.materiel} • Quantité prévue :{" "}
            <span className="font-medium">{sortie.quantite}</span> • Déjà reçu :{" "}
            <span className="font-medium">{dejaRecue}</span> • Reliquat :{" "}
            <span className="font-medium">{reliquatActuel}</span>
          </DialogDescription>
        </DialogHeader>
        <Separator className="my-3" />
        <div className="msr-dialogue-corps space-y-4">
          <form onSubmit={handleSubmit}>
            {erreur && (
              <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm">
                {erreur}
              </div>
            )}
            {/* Quantité à recevoir */}
            <div className="space-y-1">
              <Label htmlFor="quantiteRecue">Quantité reçue</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="quantiteRecue"
                  type="text"
                  value={quantiteRecue}
                  onChange={handleQuantiteChange}
                  placeholder="0"
                  className="w-24"
                  disabled={isSubmitting}
                />
                <span className="text-xs text-muted-foreground">
                  unité(s) sur {reliquatActuel} disponible(s)
                </span>
              </div>
              {!validation.ok && validation.message && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {validation.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Déclaration d'anomalie */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={declarationAnomalie}
                  onChange={(e) => setDeclarationAnomalie(e.target.checked)}
                  className="w-4 h-4 text-primary"
                />
                Déclarer une anomalie sur cette réception
              </Label>
              {declarationAnomalie && (
                <div className="space-y-2">
                  <Label htmlFor="typeAnomalie">Type d'anomalie</Label>
                  <select
                    id="typeAnomalie"
                    value={typeAnomalie}
                    onChange={(e) =>
                      setTypeAnomalie(e.target.value as any)
                    }
                    className="msr-select w-full"
                  >
                    <option value="quantite">Écart de quantité</option>
                    <option value="etat">État du matériel</option>
                    <option value="conformite">Non-conformité</option>
                    <option value="autre">Autre</option>
                  </select>
                  <Label htmlFor="descriptionAnomalie">Description</Label>
                  <Textarea
                    id="descriptionAnomalie"
                    value={descriptionAnomalie}
                    onChange={(e) => setDescriptionAnomalie(e.target.value)}
                    placeholder="Décrivez l'anomalie constatée..."
                    className="msr-textarea"
                    rows={3}
                  />
                </div>
              )}
            </div>
          </form>
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {validation.reliquat <= 0 && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Réception complète — reliquat épuisé
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              disabled={isSubmitting}
            >
              <X className="w-3 h-3 mr-1" /> Annuler
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e as React.FormEvent);
              }}
              disabled={!peutValider || isSubmitting}
              size="sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-1" /> Confirmer la réception
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

