import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Button
} from "@/components/ui/button";
import {
  Input
} from "@/components/ui/input";
import {
  Textarea
} from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SortieRecord } from "@/lib/api";
import { validerControleSortie, ControleSortieLignePayload } from "@/lib/sortieControle";
import { signerSortie } from "@/lib/api";

interface SignatureControleSortieProps {
  sortie: SortieRecord;
  onSuccess: (sortie: SortieRecord) => void;
  onError: (error: string) => void;
}

export function SignatureControleSortie({
  sortie,
  onSuccess,
  onError
}: SignatureControleSortieProps) {
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

  // Handle change for a specific controle
  const handleControleChange = (
    index: number,
    field: keyof ControleSortieLignePayload,
    value: string
  ) => {
    setControles(prev => {
      const newControles = [...prev];
      newControles[index] = {
        ...newControles[index],
        [field]: value
      };
      return newControles;
    });
  };

  // Handle etat change (select)
  const handleEtatChange = (index: number, etat: "neuf" | "bon" | "moyen" | "defaillant") => {
    handleControleChange(index, "etat", etat);
  };

  // Handle observations change (textarea)
  const handleObservationsChange = (index: number, observations: string) => {
    handleControleChange(index, "observations", observations);
  };

  // Handle signer action
  const handleSigner = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const validation = validerControleSortie(controles);
      if (!validation.isValid) {
        setError(validation.error || "Erreur de validation");
        setIsLoading(false);
        return;
      }

      // We need to know the role of the current user to sign
      // For now, we assume the role is 'magasinier' (since this is the magasinier screen)
      // In a real app, we would get the role from context or props
      const role: 'magasinier' | 'depositaire' | 'logistique' = 'magasinier';

      const signedSortie = await signerSortie(sortie.id, role, controles);
      setIsLoading(false);
      onSuccess(signedSortie);
      toast.success("Sortie signée", {
        description: `Référence : ${signedSortie.reference}`
      });
    } catch (err: any) {
      setIsLoading(false);
      // Handle API error
      if (err.response?.status === 403) {
        setError("Vous n'avez pas la permission de signer cette sortie");
      } else if (err.response?.status === 409) {
        setError("Cette sortie a déjà été signée ou le stock est insuffisant");
      } else {
        setError("Erreur lors de la signature de la sortie");
      }
      const msgErreur =
        err.response?.data?.error?.message ||
        err.message ||
        "Erreur inconnue";
      toast.error("Erreur de signature", {
        description: msgErreur
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Signature de la sortie</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[200px] items-center justify-center">
          <button className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            <span className="text-sm">Signature en cours...</span>
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Signature de la sortie #{sortie.reference}</CardTitle>
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
                    value={controle.etat || "neuf"}
                    onValueChange={(value) => handleEtatChange(index, value as "neuf" | "bon" | "moyen" | "defaillant")}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="État" />
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
                    onChange={(e) => handleObservationsChange(index, e.target.value)}
                    placeholder="Observations sur l'état du matériel"
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              // Reset to initial state
              if (sortie.lignes?.length) {
                const initialControles = sortie.lignes.map((ligne, index) => ({
                  ligne: ligne.documentId || String(index + 1),
                  etat: "neuf",
                  observations: "",
                }));
                setControles(initialControles);
              }
            }}
            size="sm"
          >
            Réinitialiser
          </Button>
          <Button
            onClick={handleSigner}
            isLoading={isLoading}
            size="sm"
          >
            Signer la sortie
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}