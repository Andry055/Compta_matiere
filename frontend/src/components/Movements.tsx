import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Download, X } from "lucide-react"
import { fetchMouvements, MouvementRecord } from "../lib/api"
import { Message } from "./ui/message"

export function Movements() {
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState("Tous")
  const [statusFilter, setStatusFilter] = useState("Tous")
  const [dateFilter, setDateFilter] = useState("")
  const [showDetails, setShowDetails] = useState<number | null>(null)

  // Données RÉELLES : traces lues en base (GET /api/mouvements). Aucune liste
  // de démonstration n'est affichée — une panne du backend est signalée, pas
  // masquée par des mouvements fictifs.
  const [movements, setMovements] = useState<MouvementRecord[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    let annule = false
    fetchMouvements().then((data) => {
      if (annule) return
      if (data) {
        setMovements(data)
        setErreur(false)
      } else {
        setMovements([])
        setErreur(true)
      }
      setChargement(false)
    })
    return () => {
      annule = true
    }
  }, [])

  const filteredMovements = movements.filter((movement) => {
    const matchesSearch =
      movement.equipement.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.action.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === "Tous" || movement.type === typeFilter
    const matchesStatus =
      statusFilter === "Tous" || movement.statut === statusFilter
    const matchesDate = !dateFilter || movement.date === dateFilter
    return matchesSearch && matchesType && matchesStatus && matchesDate
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Validé': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'En attente': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'Annulé': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getTypeIcon = (type: string) => {
    return type === 'Arrivée matériel' ? ArrowUp : ArrowDown
  }

  const getTypeColor = (type: string) => {
    return type === 'Arrivée matériel'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
  }

  const totalEntries = movements.filter(m => m.type === 'Arrivée matériel').length
  const totalExits = movements.filter(m => m.type === 'Sortie').length
  const pendingCount = movements.filter(m => m.statut === 'En attente').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl tracking-tight mb-2 text-foreground">
            Gestion des Mouvements
          </h1>
          <p className="text-muted-foreground">
            Suivi des entrées et sorties d'équipements — traces enregistrées en
            base
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </div>

      {erreur && (
        <Message variant="danger" size="sm">
          Mouvements illisibles : le backend n'a pas répondu (session expirée ou
          serveur injoignable). Aucune trace n'est affichée pour éviter de
          présenter des données qui ne viendraient pas de la base.
        </Message>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ArrowUp className="h-8 w-8 p-2 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Arrivées matériel
              </div>
              <div className="text-xl text-card-foreground">{totalEntries}</div>
            </div>
          </div>
        </div>

        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ArrowDown className="h-8 w-8 p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground">Total Sorties</div>
              <div className="text-xl text-card-foreground">{totalExits}</div>
            </div>
          </div>
        </div>

        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="h-8 w-8 p-2 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400" />
            <div>
              <div className="text-sm text-muted-foreground">
                Total Mouvements
              </div>
              <div className="text-xl text-card-foreground">
                {movements.length}
              </div>
            </div>
          </div>
        </div>

        <div className="cm-panel cm-panel-solid rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center text-xs">
              !
            </div>
            <div>
              <div className="text-sm text-muted-foreground">En Attente</div>
              <div className="text-xl text-card-foreground">{pendingCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="cm-panel cm-panel-solid rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par équipement, numéro de série ou agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous types</option>
              <option value="Arrivée matériel">Arrivée matériel</option>
              <option value="Sortie">Sorties</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            >
              <option value="Tous">Tous statuts</option>
              <option value="Validé">Validé</option>
              <option value="En attente">En attente</option>
              <option value="Annulé">Annulé</option>
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Movements List */}
      <div className="cm-panel cm-panel-solid rounded-lg">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg text-card-foreground">
            Liste des Mouvements ({filteredMovements.length})
          </h3>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Équipement
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Direction
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Agent
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Date/Heure
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {chargement
                        ? "Chargement des mouvements depuis le serveur..."
                        : erreur
                          ? "Mouvements indisponibles (backend injoignable)."
                          : movements.length === 0
                            ? "Aucun mouvement enregistré en base pour le moment."
                            : "Aucun mouvement ne correspond aux critères."}
                    </td>
                  </tr>
                )}
                {filteredMovements.map((movement) => {
                  const TypeIcon = getTypeIcon(movement.type);
                  return (
                    <tr
                      key={movement.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4" />
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getTypeColor(
                              movement.type
                            )}`}
                          >
                            {movement.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground max-w-[200px] truncate">
                        {movement.equipement}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {movement.direction || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        {movement.agent}
                      </td>
                      <td className="py-3 px-4 text-sm text-card-foreground">
                        <div>
                          <div>{movement.date}</div>
                          <div className="text-xs text-muted-foreground">
                            {movement.heure}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                            movement.statut
                          )}`}
                        >
                          {movement.statut}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() =>
                            setShowDetails(
                              showDetails === movement.id ? null : movement.id
                            )
                          }
                          className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors"
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Détail de la trace + de la PIÈCE liée (arrivée matériel ou sortie) */}
          {(() => {
            const movement = movements.find((m) => m.id === showDetails)
            if (!movement) return null
            const piece = movement.piece
            const estArrivee = movement.type === "Arrivée matériel"
            // PORTAL : la modale est rendue sur `document.body`. Dans la carte
            // `.cm-panel`, le `backdrop-filter` crée un bloc conteneur qui
            // réduisait le `position: fixed` à la carte — la fiche s'ouvrait
            // alors hors de vue (ou pas du tout à l'écran).
            return createPortal(
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="cm-modal border bg-popover w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start justify-between p-6 border-b border-border">
                    <div>
                      <h3 className="text-lg text-card-foreground flex items-center gap-2">
                        <ArrowUpDown className="h-5 w-5 text-primary" />
                        Détails — <span className="font-mono">{movement.reference}</span>
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {estArrivee
                          ? "Arrivée matériel — trace et pièce d'entrée"
                          : "Sortie — trace et pièce de sortie"}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDetails(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Fermer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Trace de traçabilité */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        { label: "Type", value: movement.type },
                        { label: "Action", value: movement.action },
                        { label: "Agent", value: movement.agent },
                        {
                          label: "Date / heure",
                          value: `${movement.date}${movement.heure ? ` ${movement.heure}` : ""}`,
                        },
                        { label: "Statut", value: movement.statut },
                        { label: "Matériel", value: movement.equipement },
                        { label: "Quantité", value: String(movement.quantite) },
                        { label: "Direction", value: movement.direction || "—" },
                      ].map((champ) => (
                        <div key={champ.label}>
                          <div className="text-sm text-muted-foreground mb-1">
                            {champ.label}
                          </div>
                          <div className="text-card-foreground">{champ.value}</div>
                        </div>
                      ))}
                    </div>

                    {movement.observations && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          Observations
                        </div>
                        <div className="text-card-foreground">
                          {movement.observations}
                        </div>
                      </div>
                    )}

                    {/* Pièce liée */}
                    {piece ? (
                      <div className="border-t border-border pt-4">
                        <h4 className="text-base text-card-foreground mb-3">
                          {estArrivee ? "Arrivée matériel" : "Sortie"} —{" "}
                          <span className="font-mono">{piece.reference}</span>
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2 mb-4">
                          {(estArrivee
                            ? [
                                { label: "Fournisseur", value: piece.fournisseur || "—" },
                                { label: "Bon de livraison", value: piece.bonLivraison || "—" },
                                { label: "Direction", value: piece.direction },
                                { label: "Service", value: piece.service },
                              ]
                            : [
                                { label: "Détenteur", value: piece.detenteur || "—" },
                                { label: "Fonction", value: piece.detenteurFonction || "—" },
                                { label: "Direction", value: piece.direction },
                                { label: "Service", value: piece.service },
                              ]
                          ).map((champ) => (
                            <div key={champ.label}>
                              <div className="text-sm text-muted-foreground mb-1">
                                {champ.label}
                              </div>
                              <div className="text-card-foreground">{champ.value}</div>
                            </div>
                          ))}
                        </div>

                        {piece.lignes.length > 0 && (
                          <div className="overflow-x-auto border border-border rounded-lg">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border bg-muted/20">
                                  <th className="text-left py-2 px-3 text-xs text-muted-foreground">
                                    Désignation
                                  </th>
                                  <th className="text-right py-2 px-3 text-xs text-muted-foreground">
                                    Qté
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {piece.lignes.map((ligne, index) => (
                                  <tr
                                    key={index}
                                    className="border-b border-border last:border-b-0"
                                  >
                                    <td className="py-2 px-3 text-sm text-card-foreground">
                                      {ligne.designation}
                                    </td>
                                    <td className="py-2 px-3 text-sm text-card-foreground text-right">
                                      {ligne.quantite}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border-t border-border pt-4 text-sm text-muted-foreground">
                        Pièce liée non disponible : elle n'est pas lisible par
                        votre rôle ou n'est plus accessible.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end p-6 border-t border-border sticky bottom-0 bg-card">
                    <button
                      onClick={() => setShowDetails(null)}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>,
              document.body
            )
          })()}
        </div>
      </div>
    </div>
  );
}