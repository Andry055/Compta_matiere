import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
import { fetchSessionRole, SortieRecord } from "@/lib/api";
import { mapStrapiUser } from "@/lib/session";
import { preparerSortie } from "@/lib/api";
import { estAPreparerPourMagasinier, ordresAAutoriser } from "@/lib/sortieControle";
import { toast } from "sonner";
import { DepositaireOrdreSortie } from "./DepositaireOrdreSortie";

interface ListeOrdresSortieProps {
  /** Fonction appelée lorsqu'une sortie est sélectionnée (optionnel) */
  onSortieSelect?: (reference: string) => void;
  /** Fonction appelée lorsqu'un dépositaire signe une sortie (optionnel) */
  onDepositaireSign?: (sortie: SortieRecord) => void;
  /** Filtre actif ou imposé (ex: "en_preparation" ou versionné { statut: "en_preparation", version: 1 }) */
  filtreStatut?: string | { statut: string; version: number };
}

export function ListeOrdresSortie({
  onSortieSelect,
  filtreStatut,
}: ListeOrdresSortieProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(true);
  const statutInitial = typeof filtreStatut === "object" ? filtreStatut?.statut : filtreStatut;
  const [activeTab, setActiveTab] = useState<string>(statutInitial || "toutes");
  const [depositaireOuvert, setDepositaireOuvert] = useState<string | null>(null);
  const handleDepositaireOpen = (sortie: SortieRecord) => {
    setDepositaireOuvert(sortie.id);
  };

  const handleDepositaireSuccess = () => {
    setDepositaireOuvert(null);
  };

  const handleDepositaireError = () => {
    setDepositaireOuvert(null);
  };

  useEffect(() => {
    if (filtreStatut) {
      const nouveauStatut = typeof filtreStatut === "object" ? filtreStatut.statut : filtreStatut;
      if (nouveauStatut) {
        setActiveTab(nouveauStatut);
      }
    }
  }, [filtreStatut]);

  useEffect(() => {
    const loadUserRole = async () => {
      setIsLoadingRole(true);
      try {
        const user = await fetchSessionRole();
        const userRoleFromUser = mapStrapiUser(user)?.role ?? null;
        setUserRole(userRoleFromUser);
        // If no filtreStatut is provided, set the default tab based on the user role
        if (!filtreStatut) {
          const defaultTab = userRoleFromUser === "magasinier" ? "a_preparer" : "toutes";
          setActiveTab(defaultTab);
        }
      } catch (error) {
        console.error("Failed to fetch user role:", error);
        setUserRole(null);
      } finally {
        setIsLoadingRole(false);
      }
    };

    loadUserRole();
  }, [filtreStatut]);

  const {
    sorties: sortiesLive,
    isLoading,
    isInitialError,
    isRefreshing,
    messageErreur,
    totalEnPreparation
  } = useSortiesLive();
  // Badge « À préparer (n) » : TOTAL SERVEUR FILTRÉ (statut = en_preparation,
  // magasinier_signed = false, requête pageSize=1 + withCount=true), transmis
  // par le store partagé. Aucun intervalle local, aucun recalcul client : la
  // carte ne déclenche donc que le sondage partagé, pas une requête de plus.
  const magasinerAPreparedCount = totalEnPreparation ?? 0;
  const isLoadingCount = totalEnPreparation === null;

  const sortiesFiltrees = sortiesLive.filter((sortie) => {
    // Magasinier : fonction pure (en_preparation ET signature 1 absente).
    // Jamais de test sur le statut « Demandée ».
    if (userRole === "magasinier") {
      return estAPreparerPourMagasinier(sortie);
    }

    switch (activeTab) {
      case "toutes":
        return true;
      case "demandees":
        return sortie.statut === "Demandée";
      case "en_preparation":
        return sortie.statut === "En préparation";
      case "validees":
        return sortie.statut === "Validée";
      case "a_autoriser":
        // Logistique : règle pure partagée (sig. 1 + 2 posées, 3e absente).
        return userRole === "logistique" && ordresAAutoriser([sortie]).length === 1;
      case "en_preparation_chez_autres":
        return userRole === "logistique" && sortie.statut === "En préparation";
      default:
        return false;
    }
  });

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
            onClick={() => { /* refreshSortiesLive(); */ }}
            size="sm"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Rafraîchir
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList
            className="w-full rounded-md bg-muted p-1"
            style={{
              display: "flex",
              flexWrap: "wrap",
              height: "auto",
              minHeight: "2.5rem",
              gap: "0.25rem",
              marginBottom: "1rem",
            }}
          >
            {userRole === "magasinier" && (
              <>
                <TabsTrigger
                  value="a_preparer"
                  className="flex items-center justify-center px-3 py-2"
                  style={{ flex: "1 1 auto", minWidth: "120px" }}
                >
                  À préparer ({magasinerAPreparedCount})
                  {isLoadingCount && <span className="animate-pulse">…</span>}
                </TabsTrigger>
              </>
            )}
            {userRole !== "magasinier" && (
              <>
                <TabsTrigger
                  value="toutes"
                  className="flex items-center justify-center px-3 py-2"
                  style={{ flex: "1 1 auto", minWidth: "120px" }}
                >
                  <Truck className="h-3 w-3 mr-2" /> Toutes
                </TabsTrigger>
                <TabsTrigger
                  value="demandees"
                  className="flex items-center justify-center px-3 py-2"
                  style={{ flex: "1 1 auto", minWidth: "120px" }}
                >
                  <User className="h-3 w-3 mr-2" /> Demandées
                </TabsTrigger>
                <TabsTrigger
                  value="en_preparation"
                  className="flex items-center justify-center px-3 py-2"
                  style={{ flex: "1 1 auto", minWidth: "120px" }}
                >
                  <RefreshCw className="h-3 w-3 mr-2" /> En préparation
                </TabsTrigger>
                <TabsTrigger
                  value="validees"
                  className="flex items-center justify-center px-3 py-2"
                  style={{ flex: "1 1 auto", minWidth: "120px" }}
                >
                  <CheckCircle className="h-3 w-3 mr-2" /> Validées
                </TabsTrigger>
                {userRole === "logistique" && (
                  <>
                    <TabsTrigger
                      value="a_autoriser"
                      className="flex items-center justify-center px-3 py-2"
                      style={{ flex: "1 1 auto", minWidth: "120px" }}
                    >
                      <RefreshCw className="h-3 w-3 mr-2" /> À autoriser
                    </TabsTrigger>
                    <TabsTrigger
                      value="en_preparation_chez_autres"
                      className="flex items-center justify-center px-3 py-2"
                      style={{ flex: "1 1 auto", minWidth: "120px" }}
                    >
                      <User className="h-3 w-3 mr-2" /> En préparation chez les autres
                    </TabsTrigger>
                  </>
                )}
              </>
            )}
          </TabsList>
        </Tabs>

        <div className="overflow-y-auto" style={{ maxHeight: "400px", marginTop: "1rem" }}>
          {userRole === "magasinier" && activeTab === "demandees" ? (
            <div className="text-center py-8">
              <p>Interface de vérification pour le magasinier (à implémenter)</p>
            </div>
          ) : sortiesFiltrees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune sortie trouvée pour ce filtre</p>
            </div>
          ) : (
            <div>
              {sortiesFiltrees.map(sortie => (
                <Card
                  key={sortie.id}
                  className="border border-border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onSortieSelect?.(sortie.reference)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium">{sortie.reference}</h3>
                        <p className="text-xs text-muted-foreground">
                          Créé le {new Date(sortie.dateSortie).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={sortie.statut === "En préparation" ? "px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-medium rounded"
                          : sortie.statut === "Validée" && userRole === "logistique" ? "px-2 py-0.5 bg-green-50 text-green-800 text-xs font-medium rounded"
                          : sortie.statut === "Validée" ? "px-2 py-0.5 bg-green-50 text-green-800 text-xs font-medium rounded"
                          : sortie.statut === "Sortie effectuée" ? "px-2 py-0.5 bg-green-100 text-green-900 text-xs font-medium rounded"
                          : sortie.statut === "Annulée" ? "px-2 py-0.5 bg-red-50 text-red-800 text-xs font-medium rounded"
                          : "px-2 py-0.5 bg-gray-50 text-gray-800 text-xs font-medium rounded"}>
                          {sortie.statut === "En préparation" ? "En préparation"
                            : sortie.statut === "Validée" && userRole === "logistique" ? "Validée, en attente de remise"
                            : sortie.statut === "Validée" ? "Validée"
                            : sortie.statut === "Sortie effectuée" ? "Effectuée"
                            : sortie.statut === "Annulée" ? "Annulée"
                            : sortie.statut}
                        </span>
                      </div>
                    </div>
                    {/* Détails : Matière et Destination */}
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground font-medium">Matière : </span>
                        <span>{sortie.materiel}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground font-medium">Destination : </span>
                        <span>
                          {[sortie.direction, sortie.serviceDemandeur, sortie.beneficiaire]
                            .filter((part) => Boolean(part) && part !== "—")
                            .join(" ")}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border flex items-center justify-between">
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="font-medium text-foreground mb-1">Progression des signatures :</div>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <span>Magasinier :</span>
                            <span className="font-bold">{sortie.magasinier_signed ? "✓" : "○"}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span>Dépositaire :</span>
                            <span className="font-bold">{sortie.depositaire_signed ? "✓" : "○"}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span>Logistique :</span>
                            <span className="font-bold">{sortie.logistique_signed ? "✓" : "○"}</span>
                          </span>
                        </div>
                      </div>
                      {userRole === "depositaire" && sortie.statut === "En préparation" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDepositaireOpen(sortie);
                          }}
                        >
                          Signer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        {depositaireOuvert && (
          <DepositaireOrdreSortie
            sortie={sortiesLive.find(s => s.id === depositaireOuvert) ?? null}
            onSuccess={handleDepositaireSuccess}
            onError={handleDepositaireError}
          />
        )}
      </CardContent>
    </Card>
  );
}