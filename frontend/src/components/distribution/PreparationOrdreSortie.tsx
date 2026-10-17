import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Button
} from "@/components/ui/button";
import {
  Select
} from "@/components/ui/select";
import {
  Textarea
} from "@/components/ui/textarea";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { SortieRecord } from "@/lib/api";
import { ControleSortieLignePayload } from "@/lib/sortieControle";
import { preparerSortie } from "@/lib/api";

interface PreparationOrdreSortieProps {
  sortie: SortieRecord;
  onSuccess: (sortie: SortieRecord) => void;
  onError: (error: string) => void;
}

export function PreparationOrdreSortie({
  sortie,
  onSuccess,
  onError
}: PreparationOrdreSortieProps) {
  const [controles, setControles] = useState<ControleSortieLignePayload[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize contrôles based on sortie lines
  useEffect(() => {
    if (sortie.lignes?.length) {
      const initialControles = sortie.lignes.map((ligne, index) => ({
        ligne: ligne.documentId || String(index + 1),
        etat: "neuf", // default value
        observations: "",
      }));
      setControles(initialControles);
    }
  }, [sortie]);

  // Handle etat change for a specific line
  const handleEtatChange = (ligneId: string, etat: string) => {
    setControles(prevControles =>
      prevControles.map(controle =>
        controle.ligne === ligneId
          ? { ...controle, etat }
          : controle
      )
    );
  };

  // Handle observations change for a specific line
  const handleObservationsChange = (ligneId: string, observations: string) => {
    setControles(prevControles =>
      prevControles.map(controle =>
        controle.ligne === ligneId
          ? { ...controle, observations }
          : controle
      )
    );
  };

  // Handle préparer action
  const handlePreparer = async () => {
    // Vérifier que toutes les lignes ont un état défini
    const allLinesHaveEtat = controles.every(controle => controle.etat && controle.etat.trim() !== "");

    if (!allLinesHaveEtat) {
      setError("Veuillez spécifier l'état pour toutes les lignes avant de préparer la sortie");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Call the preparerSortie API to save the contrôles
      const preparedSortie = await preparerSortie(sortie.documentId, controles);
      setIsLoading(false);
      onSuccess(preparedSortie);
      toast.success("Sortie préparée", {
        description: `Référence : ${preparedSortie.reference}`
      });
    } catch (err: any) {
      setIsLoading(false);
      // Handle API error
      if (err.response?.status === 403) {
        setError("Vous n'avez pas la permission de préparer cette sortie");
      } else if (err.response?.status === 409) {
        setError("Cette sortie ne peut pas être préparée");
      } else {
        setError("Erreur lors de la préparation de la sortie");
      }
      toast.error("Erreur", {
        description: err.response?.data?.error?.message || err.message || "Erreur inconnue"
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Préparation de la sortie</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[200px] items-center justify-center">
          <button className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            <span className="text-sm">Préparation en cours...</span>
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Préparation de la sortie #{sortie.reference}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {controles.map((controle, index) => (
            <div key={controle.ligne} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Ligne {index + 1}</h3>
                <span className="text-xs text-muted-foreground">
                  ID: {controle.ligne}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">État:</label>
                  <Select
                    value={controle.etat}
                    onValueChange={(value) => handleEtatChange(controle.ligne, value)}
                  >
                    <SelectTrigger>
                      <SelectValue>{controle.etat || "Sélectionner un état"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neuf">Neuf</SelectItem>
                      <SelectItem value="bon">Bon</SelectItem>
                      <SelectItem value="moyen">Moyen</SelectItem>
                      <SelectItem value="defaillant">Défaillant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Observations:</label>
                  <Textarea
                    value={controle.observations || ""}
                    onChange={(e) => handleObservationsChange(controle.ligne, e.target.value)}
                    placeholder="Observations sur l'état du matériel..."
                    className="h-20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handlePreparer}
            size="sm"
            isLoading={isLoading}
          >
            {isLoading ? "Préparation en cours..." : "Préparer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}