import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { ClipboardList, CheckCircle, Package, Calendar, PenTool, Check } from "lucide-react"
import { toast } from "sonner"
import { getSorties, signSortie } from "../lib/store"
import { SortieMateriel } from "../types/accounting"
import { User } from "../App"

export function DistributionRequests() {
  const [sorties, setSorties] = useState<SortieMateriel[]>([])
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    setSorties(getSorties())
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const handleSign = (sortieId: string, role: 'depositaire' | 'magasinier' | 'logistique') => {
    if (!user) return
    signSortie(sortieId, role, user.id, user.name)
    setSorties(getSorties()) // refresh
    toast.success("Signature ajoutée", {
      description: `La sortie a été signée avec succès.`
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === 'validee') {
      return <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">Validée</Badge>
    }
    return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">En attente de signatures</Badge>
  }

  const canSign = (role: string) => {
    if (!user) return false;
    return user.role === role;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 space-y-6 p-4 sm:p-6 overflow-auto">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl">Validation des Sorties</h1>
          <p className="text-muted-foreground">
            Circuit de validation à 3 signatures (Dépositaire, Magasinier, Logistique) avant la remise physique du matériel.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Total Sorties</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl">{sorties.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">En Attente de Signatures</CardTitle>
              <PenTool className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-yellow-600">
                {sorties.filter(s => s.statut === 'en_attente_signatures').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Sorties Validées</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-emerald-600">
                {sorties.filter(s => s.statut === 'validee').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Liste des Sorties à valider</CardTitle>
            <CardDescription>
              Une sortie est validée uniquement lorsque les 3 signatures sont apposées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sorties.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune sortie trouvée</p>
                </div>
              ) : (
                sorties.map((sortie) => (
                  <div key={sortie.id} className="border rounded-lg p-4 space-y-4">
                    {/* Header Sortie */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-primary">{sortie.id}</h3>
                          {getStatusBadge(sortie.statut)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Package className="h-4 w-4" />
                            <span>{sortie.equipementDemande} (x{sortie.quantite})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>Créée le {new Date(sortie.dateCreation).toLocaleDateString("fr-FR")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-right text-muted-foreground">
                        <p>Demandeur : <span className="font-medium text-foreground">{sortie.demandeurNom}</span></p>
                        <p>Direction : <span className="font-medium text-foreground">{sortie.direction}</span></p>
                      </div>
                    </div>

                    {/* Zone de signatures */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                      {/* 1. Dépositaire */}
                      <div className="p-3 bg-muted/30 rounded-lg flex flex-col gap-2 border border-border/50">
                        <div className="text-sm font-semibold text-muted-foreground">1. Dépositaire Comptable</div>
                        {sortie.signatures.depositaire ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-5 w-5" />
                            <div className="text-xs">
                              Signé par {sortie.signatures.depositaire.signePar}<br/>
                              le {sortie.signatures.depositaire.dateSignature}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-orange-500 mb-2 flex items-center gap-1"><PenTool className="h-3 w-3"/> En attente</div>
                            {canSign('depositaire') && (
                              <Button onClick={() => handleSign(sortie.id, 'depositaire')} size="sm" className="w-full">Signer (Dépositaire)</Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Magasinier */}
                      <div className="p-3 bg-muted/30 rounded-lg flex flex-col gap-2 border border-border/50">
                        <div className="text-sm font-semibold text-muted-foreground">2. Magasinier</div>
                        {sortie.signatures.magasinier ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-5 w-5" />
                            <div className="text-xs">
                              Signé par {sortie.signatures.magasinier.signePar}<br/>
                              le {sortie.signatures.magasinier.dateSignature}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-orange-500 mb-2 flex items-center gap-1"><PenTool className="h-3 w-3"/> En attente</div>
                            {canSign('magasinier') && (
                              <Button onClick={() => handleSign(sortie.id, 'magasinier')} size="sm" className="w-full">Signer (Magasinier)</Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 3. Logistique */}
                      <div className="p-3 bg-muted/30 rounded-lg flex flex-col gap-2 border border-border/50">
                        <div className="text-sm font-semibold text-muted-foreground">3. Chef Logistique</div>
                        {sortie.signatures.logistique ? (
                          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-5 w-5" />
                            <div className="text-xs">
                              Signé par {sortie.signatures.logistique.signePar}<br/>
                              le {sortie.signatures.logistique.dateSignature}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-xs text-orange-500 mb-2 flex items-center gap-1"><PenTool className="h-3 w-3"/> En attente</div>
                            {canSign('logistique') && (
                              <Button onClick={() => handleSign(sortie.id, 'logistique')} size="sm" className="w-full">Signer (Logistique)</Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}