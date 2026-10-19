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
  /** Called when loading state changes (true when starting, false when finished) */
  onLoadingChange?: (isLoading: boolean) => void;
}

export function AutorisationOrdreSortie({
  sortie,
  onSuccess,
  onError,
  onLoadingChange,
}: AutorisationOrdreSortieProps) {
  const [numerosLogistiques, setNumerosLogistiques] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedSignatures1et2, setCheckedSignatures1et2] = useState<boolean>(false);
  const [checkedAutorise, setCheckedAutorise] = useState<boolean>(false);
  const [checkedDefaillant, setCheckedDefaillant] = useState<boolean>(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);

  // Get current stock levels from useMaterialsLive hook
  const { materials: materialsLive, isLoading: isLoadingMaterials } = useMaterialsLive();

  // Create a map of current stock levels by material documentId for quick lookup
  const stocksActuels: Record<string, number> = {};
  materialsLive.forEach(materiel => {
    if (materiel.documentId && materiel.quantiteStock !== null && materiel.quantiteStock !== undefined) {
      stocksActuels[materiel.documentId] = materiel.quantiteStock;
    }
  });
  // Check for insufficient stock
  const hasStockInsuffisance = sortie.lignes?.some(
    (ligne) => {
      const stockActuel = stocksActuels[ligne.materiel?.documentId ?? ""] ?? 0;
      return stockActuel < (ligne.quantite || 0);
    }
  ) ?? false;

  // Check for defective lines
  const hasDefectueuxLines = sortie.lignes?.some(
    (ligne) => ligne.etat === "defaillant"
  ) ?? false;

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

  // Handle numero logistique change for a specific line
  const handleNumeroChange = (ligneId: string, valeur: string) => {
    setNumerosLogistiques(prev => {
      return {
        ...prev,
        [ligneId]: valeur
      };
    });
  };

  // Handle signer action
  const handleSigner = async () => {
    // Check if all required checkboxes are checked
    if (!checkedSignatures1et2 || !checkedAutorise || (hasDefectueuxLines && !checkedDefaillant)) {
      setError("Vous devez cocher toutes les cases requises avant de signer.");
      return;
    }

    // Check if there's enough stock
    if (!estAssezDeStock) {
      setError("Stock insuffisant pour certaines lignes. Veuillez vérifier les quantités.");
      return;
    }

    // Start loading
    setIsLoading(true);
    onLoadingChange?.(true);
    setError(null);

    try {
      // Build the payload
      const payload = construirePayloadSignatureLogistique(sortie, numerosLogistiques);

      // signerSortie poste vers /api/sorties/:documentId/sign avec
      // { role: 'logistique', numeros_logistiques } et un délai de 30 s
      // (transaction serveur : validation + débit de stock).
      // ATTENTION : l'identifiant de la sortie est sortie.id (mapSortie y range
      // le documentId Strapi) — SortieRecord n'a AUCUN champ documentId ; avec
      // sortie.documentId l'URL était « /api/sorties/undefined/sign » (404
      // « Sortie introuvable »).
      const signedSortie = await signerSortie(
        sortie.id,
        "logistique",
        undefined,
        payload.numeros_logistiques
      );

      // Success
      setIsLoading(false);
      onLoadingChange?.(false);
      onSuccess(signedSortie);
      toast.success("Sortie autorisée", {
        description: `Référence : ${signedSortie.reference} - Stock débité`
      });
    } catch (err: any) {
      setIsLoading(false);
      onLoadingChange?.(false);
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
      // Keep error state so user can see what went wrong
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
    <>
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
              <div className="flex items-center justify-between space-x-4">
                <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded">
                  En préparation
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
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
              <div>
                <span className="font-medium">Signature 1 — magasinier :</span>
                <span className="text-muted-foreground">
                  {sortie.signataireMagasinier || "—"} {sortie.dateSignatureMagasinier ? (
                    <span> ({new Date(sortie.dateSignatureMagasinier).toLocaleString("fr-FR")})</span>
                  ) : null}
                </span>
              </div>
              <div>
                <span className="font-medium">Signature 2 — dépositaire :</span>
                <span className="text-muted-foreground">
                  {sortie.signataireDepositaire || "—"} {sortie.dateSignatureDepositaire ? (
                    <span> ({new Date(sortie.dateSignatureDepositaire).toLocaleString("fr-FR")})</span>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          {/* Sections for each line */}
          <div className="space-y-4">
            {sortie.lignes?.map((ligne, index) => (
              <div key={ligne.documentId || index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">
                    Ligne {index + 1} — {ligne.designation || "—"}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    ID: {ligne.documentId || "—"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">État constaté :</label>
                    <span>
                      {ligne.etat === "bon" ? "Bon" : ligne.etat === "defaillant" ? "Défaillant" : ligne.etat.charAt(0).toUpperCase() + ligne.etat.slice(1)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Remarque :</label>
                    <span>{ligne.observations || "—"}</span>
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
                    <label className="block text-sm font-medium mb-1">Stock actuel :</label>
                    <span className="font-mono">
                      {(stocksActuels[ligne.materiel?.documentId || ""] || 0).toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">unités</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stock après sortie :</label>
                    <span className="font-mono">
                      {(stocksApresSortie[ligne.materiel?.documentId || ""] || 0).toLocaleString()}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">unités</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">N° logistique (facultatif):</label>
                    <Input
                      value={numerosLogistiques[ligne.documentId || ""] || ""}
                      onChange={(e) => handleNumeroChange(ligne.documentId || "", e.target.value)}
                      placeholder="01/Log/108/DRHE/13"
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
            <div role="alert" className="bg-destructive/10 text-destructive rounded p-3 mb-4">
              <p className="font-medium">Stock insuffisant pour autorisation :</p>
              <ul className="list-disc list-inside mt-2">
                {insuffisances.map((insuffisance, index) => (
                  <li key={index}>
                    « {insuffisance.materiel} » — demandé {insuffisance.demande}, disponible {insuffisance.disponible}
                  </li>
                ))}
              </ul>
              <p className="mt-2">Rien n'a été modifié</p>
            </div>
          )}

          {/* Vérifications obligatoires avant autorisation */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-medium">Vérifications avant autorisation</h3>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={checkedSignatures1et2}
                onChange={(e) => setCheckedSignatures1et2(e.target.checked)}
                className="mt-0.5"
              />
              <span>Les signatures 1 et 2 sont vérifiées</span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={checkedAutorise}
                onChange={(e) => setCheckedAutorise(e.target.checked)}
                className="mt-0.5"
              />
              <span>J'autorise la sortie de ce matériel ; le stock sera débité</span>
            </label>
            {hasDefectueuxLines && (
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkedDefaillant}
                  onChange={(e) => setCheckedDefaillant(e.target.checked)}
                  className="mt-0.5"
                />
                <span>J'ai noté que du matériel défaillant sort</span>
              </label>
            )}
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
              onClick={() => setIsConfirmationOpen(true)}
              isLoading={isLoading}
              disabled={!checkedSignatures1et2 || !checkedAutorise || (hasDefectueuxLines && !checkedDefaillant) || !estAssezDeStock || isConfirmationOpen}
              size="sm"
            >
              {isLoading ? "Autorisation en cours..." : "Autoriser la sortie (3/3)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation modal */}
      {isConfirmationOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsConfirmationOpen(false)}>
          <div className="relative bg-white rounded-lg p-6 w-96 max-w-md shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-center">Confirmer l'autorisation</h3>
              <p className="text-center text-muted-foreground">
                Êtes-vous sûr de vouloir autoriser cette sortie ?
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmationOpen(false)}
                  size="sm"
                >
                  Annuler
                </Button>
                <Button
                  onClick={async () => {
                    await handleSigner();
                    setIsConfirmationOpen(false);
                  }}
                  isLoading={isLoading}
                  size="sm"
                >
                  Confirmer et autoriser
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}