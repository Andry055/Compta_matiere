import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  ArrowDown,
  ArrowUp,
  Calendar,
  Plus,
  Activity,
  BookOpen,
  Euro,
  FileText,
  Hash,
  Building,
} from "lucide-react";
import { User } from "../App";
import { MaterialEntryModal } from "./MaterialEntryModal";
import { MaterialExitModal } from "./MaterialExitModal";
import { QuickActionCard } from "./QuickActionCard";

interface StaffDashboardProps {
  user: User;
}

interface JournalMovement {
  id: number;
  type: "entry" | "exit";
  numeroOrdre: string;
  pieceJustificative: string;
  designation: string;
  espece: string;
  quantity: number;
  valeurUnitaire: number;
  valeurTotale: number;
  timestamp: string;
  status: "completed" | "pending" | "approved";
  batchReference: string;
  origine?: string;
  destination?: string;
}

const mockJournalMovements: JournalMovement[] = [
  {
    id: 1,
    type: "entry",
    numeroOrdre: "2025-001234",
    pieceJustificative: "BC-2025-015",
    designation: "Ordinateurs portables HP EliteBook",
    espece: "Informatique",
    quantity: 15,
    valeurUnitaire: 1200,
    valeurTotale: 18000,
    timestamp: "2025-01-08 14:30",
    status: "completed",
    batchReference: "ENT-2025-001",
    origine: "TechnoFournisseur SARL",
  },
  {
    id: 2,
    type: "exit",
    numeroOrdre: "2025-S001235",
    pieceJustificative: "BS-2025-008",
    designation: "Claviers mécaniques Logitech",
    espece: "Périphériques",
    quantity: 8,
    valeurUnitaire: 120,
    valeurTotale: 960,
    timestamp: "2025-01-08 11:15",
    status: "completed",
    batchReference: "EXT-2025-003",
    destination: "IT - Développement",
  },
  {
    id: 3,
    type: "entry",
    numeroOrdre: "2025-001236",
    pieceJustificative: "BC-2025-016",
    designation: 'Écrans Dell UltraSharp 24"',
    espece: "Affichage",
    quantity: 5,
    valeurUnitaire: 320,
    valeurTotale: 1600,
    timestamp: "2025-01-08 09:45",
    status: "pending",
    batchReference: "ENT-2025-002",
    origine: "Digital Store",
  },
  {
    id: 4,
    type: "exit",
    numeroOrdre: "2025-S001237",
    pieceJustificative: "BS-2025-007",
    designation: "Souris sans fil",
    espece: "Périphériques",
    quantity: 12,
    valeurUnitaire: 45,
    valeurTotale: 540,
    timestamp: "2025-01-07 16:20",
    status: "completed",
    batchReference: "EXT-2025-002",
    destination: "Finance - Comptabilité",
  },
  {
    id: 5,
    type: "entry",
    numeroOrdre: "2025-001238",
    pieceJustificative: "BC-2025-017",
    designation: "Imprimantes Canon laser couleur",
    espece: "Impression",
    quantity: 3,
    valeurUnitaire: 450,
    valeurTotale: 1350,
    timestamp: "2025-01-07 13:10",
    status: "approved",
    batchReference: "ENT-2025-003",
    origine: "Office Equipment Co.",
  },
];

export function StaffDashboard({ user }: StaffDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);

  const todayMovements = mockJournalMovements.filter((m) =>
    m.timestamp.startsWith("2025-01-08")
  );
  const pendingCount = mockJournalMovements.filter(
    (m) => m.status === "pending"
  ).length;
  const completedToday = todayMovements.filter(
    (m) => m.status === "completed"
  ).length;
  const entriesCount = todayMovements.filter((m) => m.type === "entry").length;
  const exitsCount = todayMovements.filter((m) => m.type === "exit").length;

  // Calculs de valeurs
  const totalValueEntries = todayMovements
    .filter((m) => m.type === "entry" && m.status === "completed")
    .reduce((sum, m) => sum + m.valeurTotale, 0);
  const totalValueExits = todayMovements
    .filter((m) => m.type === "exit" && m.status === "completed")
    .reduce((sum, m) => sum + m.valeurTotale, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Enregistré";
      case "pending":
        return "En attente";
      case "approved":
        return "Approuvé";
      default:
        return status;
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground">
            Bonjour, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Journal de comptabilité matière - {user.department}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            <span>
              Traçabilité complète • Pièces justificatives • Valorisation
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-green-100 text-green-600 rounded-lg dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center">
              <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Entrées Journal
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {entriesCount}
              </div>
              {totalValueEntries > 0 && (
                <div className="text-xs text-green-600">
                  {totalValueEntries.toLocaleString()}Ar
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
              <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Sorties Journal
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {exitsCount}
              </div>
              {totalValueExits > 0 && (
                <div className="text-xs text-blue-600">
                  {totalValueExits.toLocaleString()}Ar
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400 flex items-center justify-center">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                En Validation
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {pendingCount}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-purple-100 text-purple-600 rounded-lg dark:bg-purple-900/30 dark:text-purple-400 flex items-center justify-center">
              <Euro className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Valeur Jour
              </div>
              <div className="text-lg sm:text-xl text-card-foreground">
                {(totalValueEntries + totalValueExits).toLocaleString()}Ar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg text-foreground">Actions Rapides</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <QuickActionCard
            icon={ArrowDown}
            title="Entrée de Matériel"
            description="Enregistrer l'arrivée de nouveaux équipements avec pièces justificatives et valorisation"
            buttonText="Nouvelle entrée journal"
            onClick={() => setEntryModalOpen(true)}
            color="green"
          />

          <QuickActionCard
            icon={ArrowUp}
            title="Sortie de Matériel"
            description="Enregistrer les sorties d'équipements avec traçabilité complète et destinataires"
            buttonText="Nouvelle sortie journal"
            onClick={() => setExitModalOpen(true)}
            color="blue"
          />

          <QuickActionCard
            icon={BookOpen}
            title="Consulter Journal"
            description="Accéder au journal comptable complet avec historique et recherche avancée"
            buttonText="Ouvrir le journal"
            onClick={() => {
              const notification = document.createElement("div");
              notification.className =
                "fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg shadow-xl animate-in slide-in-from-right-full duration-300";
              notification.innerHTML = `
                <div class="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                  </svg>
                </div>
                <div>
                  <div class="font-semibold text-sm">Journal ouvert</div>
                  <div class="text-xs opacity-90">Accès complet au registre comptable</div>
                </div>
                <button onclick="this.parentElement.remove()" class="ml-4 text-white/80 hover:text-white transition-colors">×</button>
              `;
              document.body.appendChild(notification);
              setTimeout(() => notification.remove(), 4000);
            }}
            color="purple"
            className="md:col-span-2 lg:col-span-1"
          />
        </div>
      </div>

      {/* Recent Journal Activity */}
      <div className="bg-card border border-border rounded-lg shadow-sm">
        <div className="p-4 sm:p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h3 className="text-lg text-card-foreground">
                Mouvements Journal Récents
              </h3>
            </div>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="block lg:hidden p-4 space-y-3">
          {todayMovements.slice(0, 5).map((movement) => (
            <div
              key={movement.id}
              className="border border-border rounded-lg p-3 space-y-2 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {movement.type === "entry" ? (
                    <ArrowDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                  <span className="text-sm text-card-foreground">
                    {movement.type === "entry" ? "Entrée" : "Sortie"}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                    movement.status
                  )}`}
                >
                  {getStatusText(movement.status)}
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-card-foreground font-medium">
                  {movement.designation}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {movement.numeroOrdre}
                </div>
                <div className="text-xs text-muted-foreground">
                  P.J.: {movement.pieceJustificative}
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div className="text-muted-foreground">
                  <span>Qté: {movement.quantity}</span>
                  <span className="ml-2">• {movement.espece}</span>
                </div>
                <div className="text-primary font-semibold">
                  {movement.valeurTotale.toLocaleString()}Ar
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {movement.timestamp.split(" ")[1]} • Réf:{" "}
                {movement.batchReference}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    N° Ordre
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Désignation
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    P.J.
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Espèce
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Qté
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Valeur
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Statut
                  </th>
                  <th className="text-left py-3 px-4 text-sm text-muted-foreground">
                    Heure
                  </th>
                </tr>
              </thead>
              <tbody>
                {todayMovements.slice(0, 5).map((movement) => (
                  <tr
                    key={movement.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {movement.type === "entry" ? (
                          <ArrowDown className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <ArrowUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                        <span className="text-sm text-card-foreground">
                          {movement.type === "entry" ? "Entrée" : "Sortie"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground font-mono">
                      {movement.numeroOrdre}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground max-w-[200px] truncate">
                      {movement.designation}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                      {movement.pieceJustificative}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {movement.espece}
                    </td>
                    <td className="py-3 px-4 text-sm text-card-foreground">
                      {movement.quantity}
                    </td>
                    <td className="py-3 px-4 text-sm text-primary font-semibold">
                      {movement.valeurTotale.toLocaleString()}Ar
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                          movement.status
                        )}`}
                      >
                        {getStatusText(movement.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {movement.timestamp.split(" ")[1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {todayMovements.length === 0 && (
          <div className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-sm text-muted-foreground mb-2">
              Aucune entrée journal aujourd'hui
            </h4>
            <p className="text-xs text-muted-foreground">
              Commencez par enregistrer une entrée ou sortie de matériel
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <MaterialEntryModal
        user={user}
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
      />
      <MaterialExitModal
        user={user}
        isOpen={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
      />
    </div>
  );
}
