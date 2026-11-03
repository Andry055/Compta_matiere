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
import { SortieRecord, fetchSortiesAvecOptions, signerSortie } from "@/lib/api";
import {
  ordresAAutoriser,
  stockApres,
  lignesInsuffisantes,
  calculerTotal,
  construirePayloadSignatureLogistique
} from "@/lib/sortieControle";
import { useMaterialsLive } from "@/lib/useMaterialsLive";
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
  /** Message du SERVEUR affiché tel quel (400/403/409) — jamais deviné. */
  const [erreur, setErreur] = useState<string | null>(null);
  /** Signature envoyée mais résultat inconnu : on VÉRIFIE l'état réel. */
  const [verificationEnCours, setVerificationEnCours] = useState<boolean>(false);
  /** Écran « Sortie validée » : données du SERVEUR + stock avant → après. */
  const [resultat, setResultat] = useState<{
    sortie: SortieRecord;
    stockAvant: Record<string, number>;
  } | null>(null);

  // Get current stock levels from useMaterialsLive hook
  const {
    materials: materialsLive,
    isLoading: isLoadingMaterials,
    refresh: refreshStock,
  } = useMaterialsLive();

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

  /**
   * Fin normale : la sortie est VALIDÉE côté serveur (données SERVEUR, jamais
   * devinées). L'événement « stock-mis-a-jour » est émis pour que TOUT le
   * monde (useMaterialsLive : inventaire, écrans de contrôle) recharge son
   * stock immédiatement, puis le résultat est affiché (stock avant → après).
   */
  const confirmerValidation = async (
    sortieServeur: SortieRecord,
    stockAvant: Record<string, number>
  ) => {
    // Événement global : rechargement immédiat du stock par tous les écrans.
    window.dispatchEvent(new CustomEvent("stock-mis-a-jour"));
    await refreshStock();

    setIsLoading(false);
    setVerificationEnCours(false);
    onLoadingChange?.(false);

    const lignes = sortieServeur.lignes ?? [];
    const resume = lignes
      .map((ligne) => {
        const materielId = ligne.materiel?.documentId || "";
        const avant = stockAvant[materielId];
        const apres = stocksActuels[materielId];
        if (avant === undefined || apres === undefined) return null;
        return `${ligne.materiel?.designation || ligne.designation} : ${avant} → ${apres}`;
      })
      .filter(Boolean)
      .join(" ; ");

    setResultat({ sortie: sortieServeur, stockAvant });
    onSuccess(sortieServeur);
    toast.success("Sortie autorisée", {
      description: resume
        ? `Référence : ${sortieServeur.reference} — Stock débité (${resume})`
        : `Référence : ${sortieServeur.reference} — Stock débité`,
    });
  };

  /**
   * Résultat INCONNU (timeout / panne réseau / signature déjà posée) :
   * on VÉRIFIE l'état RÉEL côté serveur au lieu de conclure à un échec.
   * Aucun renvoi automatique de la signature.
   */
  const verifierEtatReel = async (motifIncertitude: string) => {
    setVerificationEnCours(true);
    try {
      const liste = await fetchSortiesAvecOptions({});
      const reel = (liste ?? []).find((s) => s.id === sortie.id);
      if (reel && reel.logistique_signed === true) {
        // La signature a bien été enregistrée : résultat normal (serveur).
        await confirmerValidation(reel, {});
        return;
      }
      // Vérification conclut : rien n'a été enregistré.
      setIsLoading(false);
      setVerificationEnCours(false);
      onLoadingChange?.(false);
      const message = `Signature non enregistrée : ${motifIncertitude}`;
      setErreur(message);
      onError(message);
    } catch {
      setIsLoading(false);
      setVerificationEnCours(false);
      onLoadingChange?.(false);
      const message = `Signature non enregistrée : ${motifIncertitude}`;
      setErreur(message);
      onError(message);
    }
  };

  // Handle signer action
  const handleSigner = async () => {
    // Règle « double clic » : une SEULE requête, jamais deux.
    if (isLoading || verificationEnCours) return;

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
    setErreur(null);

    // Stock AVANT capturé à la confirmation (pour afficher « 10 → 8 »).
    const stockAvant: Record<string, number> = { ...stocksActuels };

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

      // Success — données du SERVEUR, stock rechargé, événement émis.
      await confirmerValidation(signedSortie, stockAvant);
    } catch (err: any) {
      const status = err.response?.status;
      const messageServeur: string =
        err.response?.data?.error?.message || err.message || "Erreur inconnue";

      // 409 « déjà enregistrée » : la sortie est peut-être VALIDÉE (un autre
      // onglet, une reprise) — on vérifie l'état réel au lieu de deviner.
      if (status === 409 && messageServeur.includes("déjà")) {
        await verifierEtatReel(messageServeur);
        return;
      }

      // Timeout / panne réseau : le serveur a pu valider — on VÉRIFIE l'état
      // réel (aucun renvoi automatique).
      if (err.code === "ECONNABORTED" || err.message === "Network Error") {
        await verifierEtatReel(
          err.code === "ECONNABORTED"
            ? "délai de vérification dépassé, résultat inconnu"
            : "connexion interrompue, résultat inconnu"
        );
        return;
      }

      // Erreurs 400/403/409 : le message FRANÇAIS du serveur est affiché tel
      // quel (jamais remplacé par une formule générique devinée).
      setIsLoading(false);
      onLoadingChange?.(false);
      setErreur(messageServeur);
      onError(messageServeur);
      toast.error("Erreur d'autorisation", {
        description: messageServeur,
      });
    }
  };

  // ── Écran « Sortie validée » : données du SERVEUR + stock avant → après ──
  if (resultat) {
    const s = resultat.sortie;
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Sortie validée #{s.reference}
          </CardTitle>
          <CardDescription>
            Validation enregistrée par le serveur — le stock a été débité une
            seule fois.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="font-medium">Statut : </span>
              <span>Validée</span>
            </div>
            <div>
              <span className="font-medium">Validée le : </span>
              <span>
                {s.dateSignatureLogistique
                  ? new Date(s.dateSignatureLogistique).toLocaleString("fr-FR")
                  : "—"}
              </span>
            </div>
            <div>
              <span className="font-medium">Signataire : </span>
              <span>{s.signataireLogistique || "—"}</span>
            </div>
            <div>
              <span className="font-medium">Stock : </span>
              <span aria-label="Stock avant puis après validation">
                {(s.lignes ?? []).map((ligne, i) => {
                  const materielId = ligne.materiel?.documentId || "";
                  const avant = resultat.stockAvant[materielId];
                  const apres = stocksActuels[materielId];
                  if (avant === undefined || apres === undefined) return null;
                  return (
                    <span key={ligne.documentId || i} className="mr-3">
                      {ligne.materiel?.designation || ligne.designation} :{" "}
                      {avant} → {apres}
                    </span>
                  );
                })}
              </span>
            </div>
          </div>

          {(s.lignes ?? []).some((l) => l.numeroLogistique) && (
            <div className="text-sm">
              <span className="font-medium">Numéro(s) logistique(s) : </span>
              {(s.lignes ?? [])
                .filter((l) => l.numeroLogistique)
                .map((l, i) => (
                  <span key={l.documentId || i} className="mr-3">
                    {l.numeroLogistique}
                  </span>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Résultat inconnu : on vérifie l'état RÉEL côté serveur ────────────────
  if (verificationEnCours) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Autorisation de la sortie #{sortie.reference}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
          <p>Vérification en cours…</p>
          <p className="text-sm text-muted-foreground text-center">
            Résultat de la signature inconnu (délai dépassé ou connexion
            interrompue) : l'état réel de la sortie est vérifié côté serveur.
            Aucune signature n'est renvoyée.
          </p>
        </CardContent>
      </Card>
    );
  }

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
                  {sortie.direction || ""} {sortie.serviceDemandeur || ""} {sortie.beneficiaire || ""}
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

          {/* Erreur serveur / client affichée telle quelle (jamais devinée) */}
          {erreur && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded p-3">
              <p className="font-medium">{erreur}</p>
              <p className="mt-2">Rien n'a été modifié</p>
            </div>
          )}
          {!erreur && error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
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

          {/* Action buttons — le rejet réel vit sur la carte (RejeterOrdreDialog) :
              pas de bouton « Rejeter » factice ici (il affichait un simple toast). */}
          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => setIsConfirmationOpen(true)}
              disabled={!checkedSignatures1et2 || !checkedAutorise || (hasDefectueuxLines && !checkedDefaillant) || !estAssezDeStock || isConfirmationOpen}
              size="sm"
            >
              Autoriser la sortie (3/3)
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
                  disabled={isLoading}
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