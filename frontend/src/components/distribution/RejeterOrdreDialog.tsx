import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Button
} from "@/components/ui/button";
import {
  Textarea
} from "@/components/ui/textarea";
import { SortieRecord } from "@/lib/api";
import { rejeterSortie } from "@/lib/api";
import { toast } from "sonner";

interface RejeterOrdreDialogProps {
  sortie: SortieRecord;
  onSortieRejectee: (sortie: SortieRecord) => void;
  onClose: () => void;
}

export function RejeterOrdreDialog({
  sortie,
  onSortieRejectee,
  onClose
}: RejeterOrdreDialogProps) {
  const [motif, setMotif] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motif.trim()) {
      setError("Le motif est requis");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const rejeteeSortie = await rejeterSortie(sortie.documentId, motif);
      onSortieRejectee(rejeteeSortie);
      onClose();
      toast.success("Sortie rejetée", {
        description: `Référence : ${rejeteeSortie.reference}`
      });
    } catch (err: any) {
      setIsLoading(false);
      if (err.response?.status === 403) {
        setError("Vous n'avez pas la permission de rejeter cette sortie");
      } else if (err.response?.status === 409) {
        setError("Cette sortie ne peut pas être rejetée (déjà traitée)");
      } else {
        setError("Erreur lors du rejet de la sortie");
      }
      toast.error("Erreur", {
        description: setError || "Erreur inconnue"
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <p className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" /> Rejeter
          </p>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[400px]">
        <DialogHeader>
          <DialogTitle>Rejeter la sortie #{sortie.reference}</DialogTitle>
          <DialogDescription>
            Veuillez fournir un motif pour le rejet de cette sortie de stock.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Motif du rejet :</label>
              <Textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Exemple : Matériel non conforme, adresse incorrecte..."
                className="min-h-[80px]"
                disabled={isLoading}
              />
              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
                size="sm"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                isLoading={isLoading}
                size="sm"
              >
                {isLoading ? "Rejet en cours..." : "Rejeter la sortie"}
              </Button>
            </div>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}