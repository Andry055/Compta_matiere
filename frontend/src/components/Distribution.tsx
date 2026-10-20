import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Avatar, AvatarFallback } from "./ui/avatar"
import {
  Package,
  Truck,
  Building,
  ArrowRight,
  Search,
  Filter,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  User,
  Users,
  Phone,
  Mail,
  Grid3X3,
  List,
  Eye,
  Calendar,
  MapPin,
  Wrench,
  RefreshCw
} from "lucide-react"
import { useMaterialsLive } from "../lib/useMaterialsLive"
import { fetchSessionRole } from "@/lib/api"
import { mapStrapiUser } from "@/lib/session"
import { toast } from "sonner"
import { DistributionRequests } from "./DistributionRequests"
import { NouvelOrdreSortie } from "./distribution/NouvelOrdreSortie"
import { ListeOrdresSortie } from "./distribution/ListeOrdresSortie"
import { EspaceMagasinierSorties } from "./distribution/EspaceMagasinierSorties"
import { EspaceLogistiqueSorties } from "./distribution/EspaceLogistiqueSorties"
import { DepositaireOrdreSortie } from "./distribution/DepositaireOrdreSortie"
import type { DemandeRecord } from "@/lib/demandes"

interface DistributionProps {
  /**
   * Demande APPROUVÉE à transformer en ordre de sortie (étape 3). Posée par
   * le parent lors du clic sur « Créer l'ordre de sortie » (écran Décision) :
   * l'onglet « Ordres de sortie » s'ouvre et le formulaire se préremplit.
   */
  initialDemande?: DemandeRecord | null;
  /** Notifie le parent que la demande a été reprise par le formulaire. */
  onInitialDemandeConsumed?: () => void;
}

export function Distribution({ initialDemande, onInitialDemandeConsumed }: DistributionProps) {
  const {
    materials,
    isLoading: isLoadingMaterials,
    isInitialError,
    isRefreshing,
    messageErreur,
    derniereSync,
    changementsQuantite,
    refresh: refreshMaterials
  } = useMaterialsLive();

  // Onglet actif (contrôlé) : permet de basculer vers « Ordres de sortie »
  // lorsqu'on clique sur « Ajouter à l'ordre de sortie » dans l'inventaire.
  const [activeTab, setActiveTab] = useState<string>("inventory");

  // Inventaire = matériels RÉELLEMENT disponibles : le titre promet la
  // « liste complète des matériaux disponibles en stock » — un matériel à 0
  // (jamais entré, ou sorti) ne doit pas apparaître comme disponible.
  const materielsEnStock = materials.filter(
    (material) => (material.quantiteStock ?? 0) > 0
  );

  // State for nouvel ordre de sortie
  const [showNouvelOrdre, setShowNouvelOrdre] = useState<boolean>(false);
  const [nouvelOrdreReference, setNouvelOrdreReference] = useState<string | null>(null);
  const [nouvelOrdreError, setNouvelOrdreError] = useState<string | null>(null);

  // State for material selected from inventory to add to nouvel ordre
  const [selectedMaterialForNouvelOrdre, setSelectedMaterialForNouvelOrdre] = useState<MaterialOption | null>(null);

  // Demande à reprendre dans le formulaire de l'onglet « Ordres de sortie »
  // (posée ci-dessous par l'effet d'ouverture automatique).
  const [demandeAPreRemplir, setDemandeAPreRemplir] = useState<DemandeRecord | null>(null);

  // State for user role
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(true);

  // Fetch user role on mount
  useEffect(() => {
    const loadUserRole = async () => {
      setIsLoadingRole(true);
      try {
        // ⚠️ Ne JAMAIS comparer le LIBELLÉ du rôle Strapi (« Dépositaire par
        // service ») aux codes métier (« depositaire ») : les contrôles d'accès
        // comparent le CODE. mapStrapiUser est la source canonique du rôle
        // (connexion ET reprise de session) : on la réutilise telle quelle.
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

  // État du filtre pour la liste des ordres de sortie (versionné pour forcer la bascule à chaque création)
  const [filtreSorties, setFiltreSorties] = useState<{ statut: string; version: number }>({
    statut: "toutes",
    version: 0,
  });

  // ── ÉTAPE 3 : ouverture automatique sur une demande à transformer ──────
  // Le dépositaire clique sur « Créer l'ordre de sortie » dans l'écran
  // Décision : on bascule TOUT SEUL sur l'onglet « Ordres de sortie » et le
  // formulaire est prérempli avec la demande (voir NouvelOrdreSortie).
  useEffect(() => {
    if (!initialDemande) return;
    setDemandeAPreRemplir(initialDemande);
    // La demande prime sur un éventuel matériel choisi dans l'inventaire.
    setSelectedMaterialForNouvelOrdre(null);
    // Bascule vers l'onglet « Ordres de sortie » où se trouve le formulaire.
    setActiveTab("ordres");
    onInitialDemandeConsumed?.();
  }, [initialDemande, onInitialDemandeConsumed]);

  // Handler for successful sortie creation
  const handleNouvelOrdreSuccess = (reference: string) => {
    setNouvelOrdreReference(reference);
    setNouvelOrdreError(null);
    setShowNouvelOrdre(false);
    setSelectedMaterialForNouvelOrdre(null);
    setDemandeAPreRemplir(null);
    setFiltreSorties((prev) => ({ statut: "en_preparation", version: prev.version + 1 }));

    // Show success toast
    toast.success("Ordre de sortie créé", {
      description: `Référence : ${reference} - En attente des 3 signatures : le stock baissera à la validation finale`
    });

    // Refresh materials to update stock and trigger sorties refresh (unique émission)
    refreshMaterials();
    window.dispatchEvent(new CustomEvent("sortie-mis-a-jour"));
  };

  // Handler for sortie creation error
  const handleNouvelOrdreError = (message: string) => {
    setNouvelOrdreError(message);
    setNouvelOrdreReference(null);
    setSelectedMaterialForNouvelOrdre(null);

    // Show error toast
    toast.error("Erreur lors de la création", {
      description: message
    });
  };

  // ── Aiguillage par rôle ──────────────────────────────────────────────
  // Le magasinier dispose de SON espace : préparation + signature 1, sans
  // inventaire, sans création, sans message d'accès refusé. Les autres rôles
  // conservent la page à onglets à l'identique.
  if (userRole === "logistique") {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <EspaceLogistiqueSorties />
        </div>
      </div>
    );
  }

  if (userRole === "magasinier") {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 p-4 sm:p-6 overflow-auto">
          <EspaceMagasinierSorties />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 space-y-6 p-4 sm:p-6 overflow-auto">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl">Distribution d'Équipements</h1>
          <p className="text-muted-foreground">
            Gérez la distribution des équipements vers les directions avec
            traçabilité complète
          </p>
        </div>

        {isLoadingMaterials && (
          <div className="p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">
              Chargement du stock réel depuis la base…
            </p>
          </div>
        )}
        {isInitialError && !isLoadingMaterials && (
          <div className="p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
            </div>
            <p className="text-sm text-muted-foreground">
              Impossible de charger le stock
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Le serveur est injoignable ou a répondu par une erreur. Aucune
              donnée fictive n'est affichée à la place du stock réel.
            </p>
            <Button onClick={() => void refreshMaterials()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventaire Stock
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Demandes de Distribution
            </TabsTrigger>
            <TabsTrigger value="ordres" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Ordres de sortie
            </TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            {/* Controls */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Filtres et Recherche
                  </CardTitle>
                  <div className="flex items-center border border-border rounded-lg p-1">
                    <button
                      onClick={() => { /* Table view - kept for compatibility */ }}
                      className="p-2 rounded transition-colors bg-primary text-primary-foreground"
                      title="Vue tableau"
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { /* Grid view - kept for compatibility */ }}
                      className="p-2 rounded transition-colors hover:bg-muted text-muted-foreground"
                      title="Vue grille"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Rechercher par nom, série, marque, modèle..."
                          value=""
                          onChange={(e) => {/* No-op - kept for compatibility */}}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value="all"
                        onValueChange={(v) => {/* No-op - kept for compatibility */}}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les statuts</SelectItem>
                          <SelectItem value="en_stock">En stock</SelectItem>
                          <SelectItem value="distribue">Distribué</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value="all"
                        onValueChange={(v) => {/* No-op - kept for compatibility */}}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Toutes catégories</SelectItem>
                          {/* Categories will be dynamically generated from materials */}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {materielsEnStock.length} matériau(s) affiché(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <Filter className="h-3 w-3" />
                      Mode Compatibilité
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Materials List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Inventaire des Matériaux
                </CardTitle>
                <CardDescription>
                  Liste complète des matériaux disponibles en stock
                </CardDescription>
              </CardHeader>
              <CardContent>
                {materielsEnStock.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun matériau en stock</p>
                    <p className="text-sm">Le stock réel est vide ou le serveur est injoignable</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {materielsEnStock.map((material) => (
                      <div
                        key={material.documentId}
                        className="flex flex-col items-start justify-between p-4 border rounded-lg gap-4 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <img
                            src={
                              material.photos?.[0] ||
                              material.photoDeLigne ||
                              `https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=80&h=80&fit=crop&crop=center&sig=${material.documentId}`
                            }
                            alt={material.designation}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <h3 className="text-base font-medium">
                                {material.designation}
                              </h3>
                              {/* Status badge */}
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                material.statut === "en_stock"
                                  ? "bg-green-50 text-green-800"
                                  : material.statut === "distribue"
                                    ? "bg-blue-50 text-blue-800"
                                    : material.statut === "maintenance"
                                      ? "bg-orange-50 text-orange-800"
                                      : "bg-gray-50 text-gray-800"
                              }`}
                              >
                                {material.statut === "en_stock" ? "En Stock" :
                                 material.statut === "distribue" ? "Distribué" :
                                 material.statut === "maintenance" ? "Maintenance" : material.statut}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Catégorie:</span>
                                <span>{material.categorie || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Numéro de série:</span>
                                <span className="font-mono">{material.numeroSerie || "—"}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Valeur unitaire:</span>
                                <span className="font-mono">
                                  {material.valeurUnitaire !== null && material.valeurUnitaire !== undefined
                                    ? material.valeurUnitaire.toLocaleString() + " FCFA"
                                    : "Non renseignée"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-medium">Quantité en stock:</span>
                                <span className="font-mono">{material.quantiteStock}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                          {/* Button to add to sortie order - only for depositor */}
                          <Button
                            onClick={() => {
                              setSelectedMaterialForNouvelOrdre(material);
                              setShowNouvelOrdre(true);
                              // Bascule vers l'onglet « Ordres de sortie » où se trouve le formulaire
                              setActiveTab("ordres");
                              toast.info("Ajout à l'ordre de sortie", {
                                description: `${material.designation} a été pré-rempli dans le formulaire de l'onglet « Ordres de sortie ».`
                              });
                            }}
                            className="flex-1 lg:flex-none"
                            size="sm"
                            disabled={material.valeurUnitaire === null || material.valeurUnitaire === undefined || material.valeurUnitaire <= 0}
                          >
                            {material.valeurUnitaire === null || material.valeurUnitaire === undefined || material.valeurUnitaire <= 0 ? (
                              <>
                                <AlertTriangle className="h-3 w-3 mr-2" />
                                Valeur manquante
                              </>
                            ) : (
                              <>
                                <Truck className="h-3 w-3 mr-2" />
                                Ajouter à l'ordre de sortie
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 lg:flex-none"
                            size="sm"
                            onClick={() => {
                              // View material details - placeholder
                              toast.info("Détails du matériau", {
                                description: `${material.designation} - Référence: ${material.documentId}`
                              });
                            }}
                          >
                            <Eye className="h-3 w-3 mr-2" />
                            Détails
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            <DistributionRequests />
          </TabsContent>

          {/* Ordres de sortie Tab */}
          <TabsContent value="ordres" className="space-y-6">
            {/* Formulaire de création : réservé au dépositaire. Un rôle sans
                droit de création ne voit simplement pas le formulaire (plus de
                message « Accès réservé »). */}
            {userRole === "depositaire" && (
              <NouvelOrdreSortie
                onSuccess={handleNouvelOrdreSuccess}
                onError={handleNouvelOrdreError}
                userRole={userRole ?? ''}
                initialMaterial={selectedMaterialForNouvelOrdre}
                initialDemande={demandeAPreRemplir}
                onDemandePreRemplie={() => setDemandeAPreRemplir(null)}
              />
            )}

            {/* Divider */}
            {showNouvelOrdre || nouvelOrdreReference || nouvelOrdreError ? (
              <div className="border-t border-border/50 my-6"></div>
            ) : null}

            {/* Success message */}
            {nouvelOrdreReference && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Succès
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="font-medium">
                    Ordre de sortie créé avec succès !
                  </p>
                  <p className="text-sm">
                    Référence : <code className="bg-muted px-2 py-0.5 rounded">{nouvelOrdreReference}</code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    En attente des 3 signatures : le stock baissera à la validation finale
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNouvelOrdreReference(null);
                      refreshMaterials(); // Refresh stock to show updated quantities
                    }}
                    size="sm"
                  >
                    Fermer
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Error message */}
            {nouvelOrdreError && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Erreur
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-destructif">{nouvelOrdreError}</p>
                  <Button
                    variant="outline"
                    onClick={() => setNouvelOrdreError(null)}
                    size="sm"
                  >
                    Fermer
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Liste des ordres de sortie existentes */}
            <ListeOrdresSortie filtreStatut={filtreSorties} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}