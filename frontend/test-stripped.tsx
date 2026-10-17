import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
// Les composants d'onglets vivent dans ui/tabs : importés depuis ui/card (qui
// ne les exporte PAS), ils étaient `undefined` et faisaient planter l'onglet
// « Ordres de sortie » (« type is invalid » au rendu).
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import {
  Button
} from "@/components/ui/button";
import {
  CheckCircle,
  RefreshCw,
  Truck,
  User
} from "lucide-react";
import { useSortiesLive } from "@/lib/useSortiesLive";
import { fetchSessionRole, preparerSortie, signerSortie } from "@/lib/api";
import { mapStrapiUser } from "@/lib/session";
import type { SortieRecord, ControleSortieLignePayload } from "@/lib/api";
import { validerControleSortie } from "@/lib/sortieControle";
import { AutorisationOrdreSortie } from "./AutorisationOrdreSortie";
import { PreparationOrdreSortie } from "./PreparationOrdreSortie";
import { SignatureControleSortie } from "./SignatureControleSortie";
import { toast } from "sonner";

interface ListeOrdresSortieProps {
  /** Fonction appelée lorsqu'une sortie est sélectionnée (optionnel) */
  onSortieSelect?: (reference: string) => void;
}

export function ListeOrdresSortie({
  onSortieSelect
}: ListeOrdresSortieProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("demandees"); // Pour le magasinier: uniquement les demandes
  const [showPreparationDialog, setShowPreparationDialog] = useState<boolean>(false);
  const [sortieAPreparer, setSortieAPreparer] = useState<SortieRecord | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState<boolean>(false);
  const [sortieASigner, setSortieASigner] = useState<SortieRecord | null>(null);
  // État pour suivre les vérifications en cours par le magasinier
  const [verificationsEnCours, setVerificationsEnCours] = useState<Record<string, ControleSortieLignePayload[]>>({});
  const [isVerifying, setIsVerifying] = useState<Record<string, boolean>>({});
  const [verificationError, setVerificationError] = useState<Record<string, string>>({});

  // Fetch user role to check permissions
  useEffect(() => {
    const loadUserRole = async () => {
      setIsLoadingRole(true);
      try {
        // Le CODE métier (« depositaire ») et non le libellé affiché
        // (« Dépositaire par service ») : voir mapStrapiUser, source canonique.
        setUserRole(mapStrapiUser(await fetchSessionRole())?.role ?? null);
      } catch (error) {
        console.error("Failed to fetch user role:", error);
        setUserRole(null);
      } finally {
        setIsLoadingRole(false);
      }
    };

    loadUserRole();
  }, []);

  // Use live sorties hook
  const {
    sorties: sortiesLive,
    isLoading,
    isInitialError,
    isRefreshing,
    messageErreur,
    refresh: refreshSortiesLive
  } = useSortiesLive();

  // Filter sorties based on tab and user role
  const sortiesFiltrees = sortiesLive.filter(sortie => {
    // Pour le magasinier: ne voir que les demandes (statut "Demandée")
    if (userRole === "magasinier") {
      return sortie.statut === "Demandée";
    }

    // Pour les autres rôles, garder la logique existante
    if (activeTab === "toutes") return true;
    if (activeTab === "demandees" && sortie.statut === "Demandée") return true;
    if (activeTab === "en_preparation" && sortie.statut === "En préparation") return true;
    if (activeTab === "validees" && sortie.statut === "Validée") return true;
    if (activeTab === "a_autoriser" && userRole === "logistique" && ordresAAutoriser([sortie]).length > 0) return true;
    if (activeTab === "en_preparation_chez_autres" && userRole === "logistique" && sortie.statut === "En préparation") return true;
    return false;
  });

  // Handle préparation dialog
  const handlePreparerSortie = (sortie: SortieRecord) => {
    setSortieAPreparer(sortie);
    setShowPreparationDialog(true);
  };

  const handlePreparationSuccess = (sortie: SortieRecord) => {
    setShowPreparationDialog(false);
    setSortieAPreparer(null);
    toast.success("Sortie préparée", {
      description: `Référence : ${sortie.reference}`
    });
  };

  const handlePreparationError = (error: string) => {
    toast.error("Erreur de préparation", {
      description: error
    });
  };

  // Handle signature dialog
  const handleSignerSortie = (sortie: SortieRecord) => {
    setSortieASigner(sortie);
    setShowSignatureDialog(true);
  };

  const handleSignatureSuccess = (sortie: SortieRecord) => {
    setShowSignatureDialog(false);
    setSortieASigner(null);
    toast.success("Sortie signée", {
      description: `Référence : ${sortie.reference}`
    });
  };

  const handleSignatureError = (error: string) => {
    toast.error("Erreur de signature", {
      description: error
    });
  };

  // Handle autorisation dialog
  const handleAutoriserSortie = (sortie: SortieRecord) => {
    setSortieASigner(sortie);
    setShowSignatureDialog(true);
  };

  const handleAutorisationSuccess = (sortie: SortieRecord) => {
    setShowSignatureDialog(false);
    setSortieASigner(null);
    toast.success("Sortie autorisée", {
      description: `Référence : ${sortie.reference} - Stock débité`
    });
  };

  const handleAutorisationError = (error: string) => {
    toast.error("Erreur d'autorisation", {
      description: error
    });
  };

  // Fonction pour afficher l'interface de vérification pour le magasinier
  function affichageVerificationMagasinier() {
    // Vérifier s'il y a des commandes en attente
    if (sortiesFiltrees.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Aucune commande en attente de vérification</p>
        </div>
      );
    }

    return (
      <>
        {/* En-tête avec compteur */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-center">
            {sortiesFiltrees.length} commande(s) en attente de vérification
          </h2>
        </div>

        {/* Liste des commandes à vérifier */}
        <div className="space-y-6">
          {sortiesFiltrees.map((sortie) => (
            <Card
              key={sortie.id}
              className="border border-border hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                {/* En-tête de la commande */}
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{sortie.reference}</h3>
                      <p className="text-sm text-muted-foreground">
                        Créé le {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded">
                      En attente de vérification
                    </span>
                  </div>
                </div>

                {/* Détails de la commande */}
                <div className="mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Destination :</span>
                      <span className="text-muted-foreground">
                        {[sortie.direction, sortie.serviceDemandeur, sortie.beneficiaire]
                          .filter((v): v is string => !!v && v !== "—")
                          .join(" ")}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Justificatif :</span>
                      <span className="text-muted-foreground">
                        {sortie.justificatif || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lignes de la commande avec contrôles de vérification */}
                {sortie.lignes && sortie.lignes.length > 0 && (
                  <div className="space-y-4">
                    <div className="mb-3">
                      <p className="font-medium">Articles à vérifier :</p>
                    </div>
                    {sortie.lignes.map((ligne, index) => (
                      <div key={ligne.documentId || index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">Article {index + 1}</h3>
                          <span className="text-xs text-muted-foreground">
                            ID: {ligne.documentId || "—"}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Désignation:</label>
                            <span className="text-muted-foreground">
                              {ligne.designation || "—"}
                            </span>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Quantité:</label>
                            <span className="font-mono">{ligne.quantite}</span> unités
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">État:</label>
                            {/* Récupérer l'état actuel de la vérification pour cette ligne */}
                            <Select
                              value={
                                verificationsEnCours[sortie.documentId]?.[index]?.etat ||
                                "neuf"
                              }
                              onValueChange={(value) => {
                                setVerificationsEnCours((prev) => ({
                                  ...prev,
                                  [sortie.documentId]: [
                                    ...(prev[sortie.documentId] || []).slice(0, index),
                                    {
                                      ...(prev[sortie.documentId]?.[index] || {
                                        ligne: ligne.documentId || String(index + 1),
                                        etat: "neuf",
                                        observations: "",
                                      }),
                                      etat: value,
                                    },
                                    ...(prev[sortie.documentId] || []).slice(index + 1),
                                  ],
                                }));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {verificationsEnCours[sortie.documentId]?.[index]?.etat ||
                                    "Sélectionner un état"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="neuf">Neuf</SelectItem>
                                <SelectItem value="bon">Bon</SelectItem>
                                <SelectItem value="usable">Usable</SelectItem>
                                <SelectItem value="defaillant">Défaillant</SelectItem>
                                <SelectItem value="hors_service">Hors service</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Observations:</label>
                            <Textarea
                              value={
                                verificationsEnCours[sortie.documentId]?.[index]?.observations ||
                                ""
                              }
                              onValueChange={(value) => {
                                setVerificationsEnCours((prev) => ({
                                  ...prev,
                                  [sortie.documentId]: [
                                    ...(prev[sortie.documentId] || []).slice(0, index),
                                    {
                                      ...(prev[sortie.documentId]?.[index] || {
                                        ligne: ligne.documentId || String(index + 1),
                                        etat:
                                          verificationsEnCours[sortie.documentId]?.[index]?.etat ||
                                          "neuf",
                                        observations: "",
                                      }),
                                      observations: value,
                                    },
                                    ...(prev[sortie.documentId] || []).slice(index + 1),
                                  ],
                                }));
                              }}
                              placeholder="Observations sur l'état du matériel..."
                              className="h-20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bouton de préparation/validation */}
                <div className="mt-6">
                  <Button
                    onClick={() => {
                      // Vérifier que toutes les lignes ont un état défini
                      const toutesLesLignesVerifiees = sortie.lignes?.every(
                        (ligne, index) =>
                          verificationsEnCours[sortie.documentId]?.[index]?.etat &&
                          verificationsEnCours[sortie.documentId]?.[index]?.etat.trim() !== ""
                      );

                      if (!toutesLesLignesVerifiees) {
                        toast.error(
                          "Veuillez spécifier l'état pour toutes les lignes avant de préparer la sortie"
                        );
                        return;
                      }

                      // Préparer la sortie avec les contrôles de vérification
                      handlePreparerSortieAvecVerifications(sortie);
                    }}
                    className="w-full"
                  >
                    Préparer et valider la sortie
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  // Fonction pour préparer une sortie avec les contrôles de vérification du magasinier
  async function handlePreparerSortieAvecVerifications(sortie: SortieRecord) {
    setIsVerifying((prev) => ({ ...prev, [sortie.documentId]: true }));
    setVerificationError((prev) => ({ ...prev, [sortie.documentId]: undefined }));

    try {
      // Vérifier une dernière fois que toutes les lignes ont un état
      const toutesLesLignesVerifiees = sortie.lignes?.every(
        (ligne, index) =>
          verificationsEnCours[sortie.documentId]?.[index]?.etat &&
          verificationsEnCours[sortie.documentId]?.[index]?.etat.trim() !== ""
      );

      if (!toutesLesLignesVerifiee) {
        throw new Error(
          "Veuillez spécifier l'état pour toutes les lignes avant de préparer la sortie"
        );
      }

      // Préparer la sortie
      const controlesToSend = verificationsEnCours[sortie.documentId] || [];
      const preparedSortie = await preparerSortie(sortie.documentId, controlesToSend);

      // Réinitialiser les vérifications pour cette sortie
      setVerificationsEnCours((prev) => {
        const newState = { ...prev };
        delete newState[sortie.documentId];
        return newState;
      });
      setIsVerifying((prev) => {
        const newState = { ...prev };
        delete newState[sortie.documentId];
        return newState;
      });

      onSortieSelect?.(preparedSortie.reference);
      toast.success("Sortie préparée et validée", {
        description: `Référence : ${preparedSortie.reference}`,
      });
    } catch (err: any) {
      setVerificationError((prev) => ({
        ...prev,
        [sortie.documentId]: err.message || "Erreur lors de la préparation",
      }));
      toast.error("Erreur de préparation", {
        description: err.message || "Erreur inconnue",
      });
    } finally {
      setIsVerifying((prev) => {
        const newState = { ...prev };
        delete newState[sortie.documentId];
        return newState;
      });
    }
  }

  // Check if user has permission to see this list
  if (isLoadingRole) {
    return <div className="text-center py-8">Chargement des permissions...</div>;
  }

  if (userRole === null) {
    return <div className="text-center py-8">Impossible de déterminer votre rôle</div>;
  }

  const allowedRoles = ["depositaire", "magasinier", "logistique", "comptable"];
  if (!allowedRoles.includes(userRole)) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Liste des ordres de sortie</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-destructive">
            Accès refusé : vous n'avez pas la permission de voir les ordres de sortie
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (isLoading || isInitialError) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Liste des ordres de sortie</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[200px] items-center justify-center">
          <button className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
            <span className="text-sm">
              {isLoadingRole ? "Chargement des permissions..." :
               isInitialError ? "Erreur de chargement" :
               "Chargement des ordres de sortie..."}
            </span>
          </button>
          {isInitialError && messageErreur && (
            <div className="mt-2 text-sm text-destructive">
              {messageErreur}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Liste des ordres de sortie</CardTitle>
          <Button
            variant="outline"
            onClick={refreshSortiesLive}
            size="sm"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Rafraîchir
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs for filtering */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="grid w-full grid-cols-6">
            {userRole === "magasinier" && (
              <>
                <TabsTrigger value="demandees" className="flex items-center justify-center px-3 py-2">
                  <User className="h-3 w-3 mr-2" /> Demandées
                </TabsTrigger>
              </>
            )}
            {userRole !== "magasinier" && (
              <>
                <TabsTrigger value="toutes" className="flex items-center justify-center px-3 py-2">
                  <Truck className="h-3 w-3 mr-2" /> Toutes
                </TabsTrigger>
                <TabsTrigger value="demandees" className="flex items-center justify-center px-3 py-2">
                  <User className="h-3 w-3 mr-2" /> Demandées
                </TabsTrigger>
                <TabsTrigger value="en_preparation" className="flex items-center justify-center px-3 py-2">
                  <RefreshCw className="h-3 w-3 mr-2" /> En préparation
                </TabsTrigger>
                <TabsTrigger value="validees" className="flex items-center justify-center px-3 py-2">
                  <CheckCircle className="h-3 w-3 mr-2" /> Validées
                </TabsTrigger>
                {userRole === "logistique" && (
                  <>
                    <TabsTrigger value="a_autoriser" className="flex items-center justify-center px-3 py-2">
                      <RefreshCw className="h-3 w-3 mr-2" /> À autoriser ({ordresAAutoriser(sortiesLive).length})
                    </TabsTrigger>
                    <TabsTrigger value="en_preparation_chez_autres" className="flex items-center justify-center px-3 py-2">
                      <User className="h-3 w-3 mr-2" /> En préparation chez les autres
                    </TabsTrigger>
                  </>
                )}
              </>
            )}
          </TabsList>
        </Tabs>

        {/* Preparation dialog */}
        {showPreparationDialog && sortieAPreparer && (
          <PreparationOrdreSortie
            sortie={sortieAPreparer}
            onSuccess={handlePreparationSuccess}
            onError={handlePreparationError}
          />
        )}

        {/* Dialogs - only show signature dialogs for non-magasinier roles */}
        {showSignatureDialog && sortieASigner && userRole !== "magasinier" && (
          <>
            {userRole === "logistique" && activeTab === "a_autoriser" && (
              <AutorisationOrdreSortie
                sortie={sortieASigner}
                onSuccess={handleAutorisationSuccess}
                onError={handleAutorisationError}
              />
            )}
            {! (userRole === "logistique" && activeTab === "a_autoriser") && (
              <SignatureControleSortie
                sortie={sortieASigner}
                onSuccess={handleSignatureSuccess}
                onError={handleSignatureError}
              />
            )}
          </>
        )}

        {/* Liste des sorties */}
        <div className="overflow-y-auto max-h-[400px]">
          {userRole === "magasinier" && activeTab === "demandees" ? (
            affichageVerificationMagasinier()
          ) : (
            sortiesFiltrees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Aucune sortie trouvée pour ce filtre</p>
              </div>
            ) : (
              sortiesFiltrees.map(sortie => (
                <Card
                  key={sortie.id}
                  className="border border-border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onSortieSelect?.(sortie.reference)}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium">{sortie.reference}</h3>
                        <p className="text-xs text-muted-foreground">
                          Créé le {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-2">
                        {/* mapSortie traduit DÉJÀ le statut en libellé français
                            (STATUTS_SORTIE_API) : comparer à l'énum brute
                            (« en_preparation ») ne correspondait jamais → badge
                            toujours gris, libellé « Effectuée » jamais atteint. */}
                        <span className={sortie.statut === "En préparation" ? "px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded"
                          : sortie.statut === "Validée" && userRole === "logistique" ? "px-2 py-0.5 bg-green-50 text-green-800 text-xs font-medium rounded"
                          : sortie.statut === "Validée" ? "px-2 py-0.5 bg-green-50 text-green-800 text-xs font-medium rounded"
                          : sortie.statut === "Sortie effectuée" ? "px-2 py-0.5 bg-green-100 text-green-900 text-xs font-medium rounded"
                          : sortie.statut === "Annulée" ? "px-2 py-0.5 bg-red-50 text-red-800 text-xs font-medium rounded"
                          : "px-2 py-0.5 bg-gray-50 text-gray-800 text-xs font-medium rounded"}>
                          {sortie.statut === "En préparation" ? "En préparation"
                            : sortie.statut === "Validée" && userRole === "logistique" ? "Validée, en attente de remise"
                            : sortie.statut === "Validée" ? "Validée"
                            : sortie.statut = "Sortie effectuée" ? "Effectuée"
                            : sortie.statut === "Annulée" ? "Annulée"
                            : sortie.statut}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Matière :</span>
                        {/* RÉGRESSION : le champ s'appelle `materiel` (mapSortie
                            agrège les désignations des lignes). Lisait
                            `sortie.matiere`, inexistant sur SortieRecord →
                            rendu TOUJOURS vide alors que les données sont là. */}
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {sortie.materiel}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Catégorie :</span>
                        <span className="text-muted-foreground">
                          {sortie.categorie}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Quantité :</span>
                        <span className="text-muted-foreground font-mono">
                          {sortie.quantite}
                        </span> unités
                      </div>
                      <div>
                        <span className="font-medium">Destination :</span>
                        <span className="text-muted-foreground">
                          {/* `serviceDemandeur` EST le service de la sortie (row.service) :
                              SortieRecord n'a pas de champ `service`, le remplissage
                              silencieux de ce fragment masquait le service choisi.
                              Les valeurs « — » (non renseignées) sont écartées. */}
                          {[sortie.direction, sortie.serviceDemandeur, sortie.beneficiaire]
                            .filter((v): v is string => !!v && v !== "—")
                            .join(" ")}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Justificatif :</span>
                        <span className="text-muted-foreground">
                          {sortie.justificatif || "—"}
                        </span>
                      </div>
                    </div>
                    {sortie.demandeur && (
                      <div>
                        <span className="font-medium">Demandeur :</span>
                        <span className="text-muted-foreground">
                          {sortie.demandeur}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Signature progress */}
                  
                {/* Action buttons */}
                <div className="flex justify-end space-x-3 mt-4">
                  {/* Préparer button - for magasinier when statut is Demandée */}
                  {userRole === "magasinier" && sortie.statut === "Demandée" && (
                    <Button
                      variant="outline"
                      onClick={() => handlePreparerSortie(sortie)}
                      size="sm"
                    >
                      Préparer
                    </Button>
                  )}

                  {/* Signer button - for appropriate roles when statut is En préparation (not for magasinier) */}
                  {userRole !== "magasinier" &&
                  ((userRole === "depositaire" && sortie.statut === "En préparation") ||
                    (userRole === "logistique" && sortie.statut === "En préparation")) && (
                    <Button
                      onClick={() => handleSignerSortie(sortie)}
                      size="sm"
                    >
                      Signer
                    </Button>
                  )}

                  {/* Autoriser button - for logistique when in a_autoriser tab */}
                  {(userRole === "logistique" && activeTab === "a_autoriser") && (
                    <Button
                      onClick={() => {
                        // Open the autorisation dialog
                        setSortieASigner(sortie);
                        setShowSignatureDialog(true);
                      }}
                      size="sm"
                    >
                      Autoriser
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        </div>
  );
}