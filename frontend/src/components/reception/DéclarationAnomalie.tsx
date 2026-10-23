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
      <DialogContent className="msr-dialogue sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Déclarer une anomalie — {sortie.reference}
          </DialogTitle>
          <DialogDescription>
            {sortie.materiel} • Reliquat disponible :{" "}
            <span className="font-medium">{reliquat}</span> unité(s)
          </DialogDescription>
        </DialogHeader>
        <Separator className="my-3" />
        <div className="msr-dialogue-corps space-y-4">
          <form onSubmit={handleSubmit}>
            {/* Type d'anomalie */}
            <div className="space-y-1">
              <Label htmlFor="typeAnomalie">Type d'anomalie</Label>
              <select
                id="typeAnomalie"
                value={typeAnomalie}
                onChange={(e) =>
                  setTypeAnomalie(e.target.value as any)
                }
                className="msr-select w-full"
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
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez l'anomalie constatée..."
                className="msr-textarea"
                rows={4}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Décrivez précisément ce qui a été observé.
              </p>
            </div>

            <Separator />

            {/* Quantité concernée (uniquement pour type quantité) */}
            {typeAnomalie === "quantite" && (
              <div className="space-y-1">
                <Label htmlFor="quantiteConcernée">
                  Quantité concernée
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="quantiteConcernée"
                    type="text"
                    value={quantiteConcernée}
                    onChange={handleQuantiteChange}
                    placeholder="0"
                    className="w-24"
                    disabled={isSubmitting}
                  />
                  <span className="text-xs text-muted-foreground">
                    unité(s) sur {reliquat} maximum
                  </span>
                </div>
                {quantiteConcernée.trim() !== "" &&
                  parseInt(quantiteConcernée, 10) > reliquat && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    La quantité concernée ne peut dépasser le reliquat ({reliquat}).
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Le statut de l'anomalie est indépendant de celui de la réception.{" "}
              Elle reste ouverte jusqu'à sa résolution explicite.
            </p>
          </form>
        </div>
        <Separator className="my-3" />
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Une réception complète peut conserver une anomalie ouverte.
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
              disabled={!validation || isSubmitting}
              size="sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-1" /> Déclarer l'anomalie
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
