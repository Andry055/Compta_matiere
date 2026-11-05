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
import { SortieRecord, receptionAnomalies, getReliquat } from "@/lib/movements";
import {
  AlertTriangle,
  Save,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface DéclarationAnomalieProps {
  sortie: SortieRecord;
  onClose: () => void;
}

export function DéclarationAnomalie({ sortie, onClose }: DéclarationAnomalieProps) {
  const [typeAnomalie, setTypeAnomalie] = useState<
    "quantite" | "etat" | "conformite" | "autre"
  >("quantite");
  const [description, setDescription] = useState("");
  const [quantiteConcernée, setQuantiteConcernée] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reliquat = getReliquat(sortie);

  const validation =
    description.trim() !== "" &&
    (typeAnomalie !== "quantite" ||
      (quantiteConcernée.trim() !== "" &&
        parseInt(quantiteConcernée, 10) > 0 &&
        parseInt(quantiteConcernée, 10) <= reliquat));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation || isSubmitting) return;

    setIsSubmitting(true);

    const nouvelleAnomalie = {
      id: `ANOM-${Date.now()}`,
      sortieId: sortie.id,
      ligneId: sortie.id,
      type: typeAnomalie,
      description,
      dateDeclaration: new Date().toISOString(),
      declarePar: "Dépositaire connecté",
      statut: "Ouverte" as const,
    };

    // Ajout local uniquement — l'API n'est pas encore connectée.
    receptionAnomalies.push(nouvelleAnomalie);

    setIsSubmitting(false);
    toast.success("Anomalie déclarée", {
      description: `Anomalie de type "${typeAnomalie}" enregistrée pour ${sortie.reference}.`,
    });
    onClose();
  };

  const handleQuantiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setQuantiteConcernée(value);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="msc-dialog msc-dialog__content sm:max-w-lg">
        <div className="msc-dialog__header">
          <h2 className="msc-dialog__title">
            <AlertTriangle className="msc-dialog__title-icon" aria-hidden="true" />
            Déclarer une anomalie — {sortie.reference}
          </h2>
          <p className="msc-dialog__description">
            {sortie.materiel} • Reliquat disponible :{" "}
            <span className="font-medium">{reliquat}</span> unité(s)
          </p>
        </div>
        <Separator className="my-3" />
        <div className="msc-dialog__body">
          <form onSubmit={handleSubmit} className="msc-form">
            {/* Type d'anomalie */}
            <div className="msc-form__group">
              <Label htmlFor="typeAnomalie" className="msc-form__label msc-form__label--required">
                Type d'anomalie
              </Label>
              <select
                id="typeAnomalie"
                value={typeAnomalie}
                onChange={(e) =>
                  setTypeAnomalie(e.target.value as any)
                }
                className="msc-form__input msc-form__select"
                disabled={isSubmitting}
              >
                <option value="quantite">Écart de quantité</option>
                <option value="etat">État du matériel</option>
                <option value="conformite">Non-conformité</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <Separator />

            {/* Description */}
            <div className="msc-form__group">
              <Label htmlFor="description" className="msc-form__label msc-form__label--required">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'anomalie constatée..."
                className="msc-form__textarea"
                rows={4}
                disabled={isSubmitting}
              />
              <p className="msc-form__hint">
                Décrivez précisément ce qui a été observé.
              </p>
            </div>

            <Separator />

            {/* Quantité concernée (uniquement pour type quantité) */}
            {typeAnomalie === "quantite" && (
              <div className="msc-form__group">
                <Label htmlFor="quantiteConcernée" className="msc-form__label msc-form__label--required">
                  Quantité concernée
                </Label>
                <div className="msc-quantity">
                  <Input
                    id="quantiteConcernée"
                    type="text"
                    value={quantiteConcernée}
                    onChange={handleQuantiteChange}
                    placeholder="0"
                    className="msc-form__input msc-quantity__input"
                    style={{ width: '6rem' }}
                    disabled={isSubmitting}
                  />
                  <span className="msc-quantity__unit">
                    unité(s) sur {reliquat} maximum
                  </span>
                </div>
                {quantiteConcernée.trim() !== "" &&
                  parseInt(quantiteConcernée, 10) > reliquat && (
                  <p className="msc-form__error" role="alert">
                    <AlertCircle className="msc-form__error-icon" aria-hidden="true" />
                    La quantité concernée ne peut dépasser le reliquat ({reliquat}).
                  </p>
                )}
              </div>
            )}

            <p className="msc-form__hint">
              Le statut de l'anomalie est indépendant de celui de la réception.{" "}
              Elle reste ouverte jusqu'à sa résolution explicite.
            </p>
          </form>
        </div>
        <Separator className="my-3" />
        <div className="msc-dialog__footer">
          <div className="text-xs text-muted-foreground" style={{ flex: 1 }}>
            Une réception complète peut conserver une anomalie ouverte.
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              className="msc-btn msc-btn--outline msc-btn--sm"
            >
              <X className="w-3 h-3 mr-1" aria-hidden="true" /> Annuler
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e as React.FormEvent);
              }}
              disabled={!validation || isSubmitting}
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
                  <Save className="w-3 h-3 mr-1" aria-hidden="true" /> Déclarer l'anomalie
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
