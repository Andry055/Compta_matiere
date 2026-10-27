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
import { AlertTriangle } from "lucide-react";

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
      // SortieRecord.id EST le documentId servi par mapSortie.
      const rejeteeSortie = await rejeterSortie(sortie.id, motif);
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
        description:
          err.response?.data?.error?.message || err.message || "Erreur inconnue"
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="msa-bouton msa-bouton--danger msa-bouton--compact">
          <AlertTriangle style={{ width: 14, height: 14 }} aria-hidden="true" /> Rejeter
        </button>
      </DialogTrigger>
      {/* Classe préfixée : centrage + défilement interne (voir EspaceMagasinierSorties.css). */}
      <DialogContent className="msa-dialogue">
        <DialogHeader>
          <DialogTitle className="msa-dialogue-titre">Rejeter la sortie #{sortie.reference}</DialogTitle>
          <DialogDescription className="msa-dialogue-texte">
            Veuillez fournir un motif pour le rejet de cette sortie de stock.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <form onSubmit={handleSubmit} className="msa-dialogue-corps">
            <div className="msa-panneau-champ">
              <label className="msa-panneau-libelle" htmlFor={`motif-${sortie.id}`}>
                Motif du rejet :
              </label>
              <Textarea
                id={`motif-${sortie.id}`}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Exemple : Matériel non conforme, adresse incorrecte..."
                className="msa-textarea"
                disabled={isLoading}
              />
              {error && (
                <p className="msa-erreur">{error}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button
                variant="outline"
                onClick={onClose}
                size="sm"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
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