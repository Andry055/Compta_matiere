import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { SortieRecord } from "@/lib/api";
import {
  ordresAAutoriser,
  stockApres,
  lignesInsuffisantes,
  calculerTotal,
  construirePayloadSignatureLogistique
} from "@/lib/sortieControle";
import { signerSortie } from "@/lib/api";
import { useMaterialsLive, MaterialOption } from "@/lib/useMaterialsLive";
import { toast } from "sonner";

interface AutorisationOrdreSortieProps {
  sortie: SortieRecord;
  onSuccess: (sortie: SortieRecord) => void;
  onError: (error: string) => void;
}

export function AutorisationOrdreSortie({
  sortie,
  onSuccess,
  onError
}: AutorisationOrdreSortieProps) {
  const [numerosLogistiques, setNumerosLogistiques] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [confirmed, setConfirmed] = useState<boolean>(false);

  // Get current stock levels from useMaterialsLive hook
  const { materials: materialsLive, isLoading: isLoadingMaterials } = useMaterialsLive();

  // Create a map of current stock levels by material documentId for quick lookup
  const stocksActuels: Record<string, number> = {};
  materialsLive.forEach(materiel => {
    if (materiel.documentId && materiel.quantiteStock !== null && materiel.quantiteStock !== undefined) {
      stocksActuels[materiel.documentId] = materiel.quantiteStock;
    }
  });

  // Calculate stock after sortie for each line
  const stocksApresSortie: Record<string, number> = {};
  sortie.lignes?.forEach(ligne => {
    const materielId = ligne.materiel?.documentId || "";
    if (materielId) {
      stocksApresSortie[materielId] = stockApres(ligne, stocksActuels[materielId] || 0);
    }
  });

  // Check for insufficient stock
  const insuffisances = lignesInsuffisantes(sortie, stocksActuels);
  const estAssezDeStock = insuffisances.length === 0;

  // Calculate total
  const total = calculerTotal(sortie);

  // Handle confirmation checkbox change
  const handleConfirmChange = (checked: boolean) => {
    setConfirmed(checked);
  };

  // Handle numero logistique change for a specific line
  const handleNumeroChange = (ligneId: string, valeur: string) => {
    setNumerosLogistiques(prev => ({
      ...prev,
      [ligneId]: valeur
    }));
  };

  // Handle signer action
  const handleSigner = async () => {
    // Check if confirmed
    if (!confirmed) {
      setError("Vous devez cocher la case de confirmation avant de signer.");
      return;
    }

    // Check if there's enough stock
    if (!estAssezDeStock) {
      setError("Stock insuffisant pour certaines lignes. Veuillez vérifier les quantités.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build the payload
      const payload = construirePayloadSignatureLogistique(sortie, numerosLogistiques);

      // Appel direct avec numeros_logistiques inclus dans le body.
      // signerSortie ne supporte pas ce champ supplémentaire ; on appelle
      // l'instance api directement (déjà importée via @/lib/api).
      const { data: rep } = await (await import("@/lib/api")).api.post(
        `/api/sorties/${sortie.documentId}/sign`,
        { data: { role: 'logistique', numeros_logistiques: payload.numeros_logistiques } }
      );
      const signedSortie = rep.data as SortieRecord;

      // Success
      setIsLoading(false);
      onSuccess(signedSortie);
      toast.success("Sortie autorisée", {
        description: `Référence : ${signedSortie.reference} - Stock débité`
      });
    } catch (err: any) {
      setIsLoading(false);
      // Handle API error
      if (err.response?.status === 403) {
        setError("Vous n'avez pas la permission d'autoriser cette sortie");
      } else if (err.response?.status === 409) {
        if (err.response?.data?.error?.message?.includes("Stock insuffisant")) {
          // Extract the insufficient stock message from the server
          const message = err.response.data.error.message;
          setError(message);
        } else if (err.response?.data?.error?.message?.includes("déjà été validée")) {
          setError("Cette sortie a déjà été validée");
        } else {
          setError("Erreur lors de l'autorisation de la sortie");
        }
      } else {
        setError("Erreur lors de l'autorisation de la sortie");
      }
      const msgErreur =
        err.response?.data?.error?.message ||
        err.message ||
        "Erreur inconnue";
      toast.error("Erreur d'autorisation", {
        description: msgErreur
      });
    }
  };

  // Handle reject action (reuse existing reject component logic)
  const handleReject = async (motif: string) => {
    // In a real implementation, this would call the reject API
    // For now, we'll just show a toast
    toast.info("Sortie rejetée", {
      description: `Motif : ${motif}`
    });
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Autorisation de la sortie</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[200px] items-center justify-center">
          <button className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            <span className="text-sm">Autorisation en cours...</span>
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Autorisation de la sortie #{sortie.reference}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium">{sortie.reference}</h3>
              <p className="text-xs text-muted-foreground">
                Créé le {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
              </p>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded">
                En préparation
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Destination :</span>
              <span className="text-muted-foreground">
                {sortie.direction || ""} {sortie.service || ""} {sortie.beneficiaire || ""}
              </span>
            </div>
            <div>
              <span className="font-medium">Pièce justificative :</span>
              <span className="text-muted-foreground">
                {sortie.justificatif || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Sections for each line */}
        <div className="space-y-4">
          {sortie.lignes?.map((ligne, index) => (
            <div key={ligne.documentId || index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Ligne {index + 1}</h3>
                <span className="text-xs text-muted-foreground">
                  ID: {ligne.documentId || "—"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Désignation:</label>
                  <span>{ligne.designation || "—"}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quantité:</label>
                  <span className="font-mono">{ligne.quantite}</span> unités
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valeur unitaire:</label>
                  <span className="font-mono">
                    {(ligne.materiel?.valeurUnitaire || 0).toLocaleString()} FCFA
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Montant:</label>
                  <span className="font-mono font-bold">
                    {(ligne.quantite * (ligne.materiel?.valeurUnitaire || 0)).toLocaleString()} FCFA
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stock actuel:</label>
                  <span className="font-mono">
                    {(stocksActuels[ligne.materiel?.documentId || ""] || 0).toLocaleString()} unités
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stock après sortie:</label>
                  <span className="font-mono">
                    {(stocksApresSortie[ligne.materiel?.documentId || ""] || 0).toLocaleString()} unités
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° logistique (facultatif):</label>
                  <Input
                    value={numerosLogistiques[ligne.documentId || ""] || ""}
                    onChange={(e) => handleNumeroChange(ligne.documentId || "", e.target.value)}
                    placeholder="Ex: 01/Log/108/DRHE/13 (max 100 caractères)"
                    maxLength={100}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total section */}
        {sortie.lignes && sortie.lignes.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Total</span>
              <span className="font-bold">{total.toLocaleString()} FCFA</span>
            </div>
          </div>
        )}

        {/* Insufficient stock warning */}
        {!estAssezDeStock && insuffisances.length > 0 && (
          <div className="bg-destructive/10 text-destructive rounded p-3 mb-4">
            <p className="font-medium">Stock insuffisant pour autorisation :</p>
            <ul className="list-disc list-inside mt-2">
              {insuffisances.map((insuffisance, index) => (
                <li key={index}>
                  {insuffisance.materiel} : demandé {insuffisance.demande}, disponible {insuffisance.disponible}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirmation section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => handleConfirmChange(e.target.checked)}
            />
            <label className="text-sm font-medium">
              J’ai vérifié que les signatures 1 et 2 sont présentes et que j’autorise la sortie de ce matériel ;
              le stock sera débité de manière irréversible.
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Cette autorisation valide la sortie et débite le stock. Elle ne peut pas être annulée dans l’application.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handleReject}
            size="sm"
          >
            Rejeter
          </Button>
          <Button
            onClick={handleSigner}
            isLoading={isLoading}
            disabled={!confirmed || !estAssezDeStock}
            size="sm"
          >
            {isLoading ? "Autorisation en cours..." : "Autoriser la sortie (3/3)"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}