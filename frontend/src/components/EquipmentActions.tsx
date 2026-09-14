import { useState } from "react";
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Download,
  Share2,
  Archive,
  AlertTriangle,
  Check,
  X,
  History,
  Settings,
  MapPin,
  User,
  Calendar,
} from "lucide-react";
import { User as UserType } from "../App";

interface EquipmentItem {
  id: number;
  name: string;
  serialNumber: string;
  category: string;
  status: "Disponible" | "Attribué" | "Maintenance" | "Retiré";
  department: string;
  assignedTo?: string;
  purchaseDate: string;
  value: number;
  image: string;
  supplier?: string;
  warranty?: string;
  specifications?: string;
  notes?: string;
}

interface EquipmentActionsProps {
  equipment: EquipmentItem;
  currentUser: UserType;
  onView: (equipment: EquipmentItem) => void;
  onEdit: (equipment: EquipmentItem) => void;
  onDelete: (equipmentId: number) => void;
  onDuplicate?: (equipment: EquipmentItem) => void;
  onExport?: (equipment: EquipmentItem) => void;
  onShare?: (equipment: EquipmentItem) => void;
  onArchive?: (equipment: EquipmentItem) => void;
  onViewHistory?: (equipment: EquipmentItem) => void;
}

export function EquipmentActions({
  equipment,
  currentUser,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onExport,
  onShare,
  onArchive,
  onViewHistory,
}: EquipmentActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Permissions basées sur le rôle
  const canEdit =
    currentUser.role === "admin" ||
    currentUser.permissions.includes("equipment.edit");
  const canDelete =
    currentUser.role === "admin" ||
    currentUser.permissions.includes("equipment.delete");
  const canArchive = currentUser.role === "admin";
  const canView = true; // Tout le monde peut voir
  const canDuplicate =
    currentUser.role === "admin" ||
    currentUser.permissions.includes("equipment.create");

  const handleAction = async (
    action: () => void,
    closeMenu: boolean = true
  ) => {
    setIsProcessing(true);
    try {
      action();
      if (closeMenu) {
        setIsOpen(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      onDelete(equipment.id);
      setShowDeleteConfirm(false);
      setIsOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchive = async () => {
    setIsProcessing(true);
    try {
      onArchive?.(equipment);
      setShowArchiveConfirm(false);
      setIsOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Disponible":
        return "text-green-600 dark:text-green-400";
      case "Attribué":
        return "text-blue-600 dark:text-blue-400";
      case "Maintenance":
        return "text-orange-600 dark:text-orange-400";
      case "Retiré":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="relative">
      {/* Actions Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isProcessing}
        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
        title="Actions"
      >
        <MoreHorizontal className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            {/* Equipment Header */}
            <div className="p-4 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3">
                <img
                  src={equipment.image}
                  alt={equipment.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-card-foreground truncate">
                    {equipment.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{equipment.serialNumber}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full ${getStatusColor(
                        equipment.status
                      )} bg-current/10`}
                    >
                      {equipment.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{equipment.department}</span>
                </div>
                {equipment.assignedTo && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{equipment.assignedTo}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{equipment.purchaseDate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                  <span className="text-primary">
                    {equipment.value.toLocaleString()}Ar
                  </span>
                </div>
              </div>
            </div>

            {/* Actions List */}
            <div className="py-2">
              {/* Primary Actions */}
              <div className="px-2 pb-2">
                <div className="text-xs text-muted-foreground px-2 py-1 uppercase tracking-wide">
                  Actions Principales
                </div>

                {canView && (
                  <button
                    onClick={() => handleAction(() => onView(equipment))}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                  >
                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-md group-hover:bg-blue-200 transition-colors dark:bg-blue-900/30 dark:text-blue-400">
                      <Eye className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Voir les détails</div>
                      <div className="text-xs text-muted-foreground">
                        Afficher toutes les informations
                      </div>
                    </div>
                  </button>
                )}

                {canEdit && (
                  <button
                    onClick={() => handleAction(() => onEdit(equipment))}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                  >
                    <div className="p-1.5 bg-green-100 text-green-600 rounded-md group-hover:bg-green-200 transition-colors dark:bg-green-900/30 dark:text-green-400">
                      <Edit className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Modifier</div>
                      <div className="text-xs text-muted-foreground">
                        Éditer les propriétés
                      </div>
                    </div>
                  </button>
                )}

                {onViewHistory && (
                  <button
                    onClick={() => handleAction(() => onViewHistory(equipment))}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                  >
                    <div className="p-1.5 bg-purple-100 text-purple-600 rounded-md group-hover:bg-purple-200 transition-colors dark:bg-purple-900/30 dark:text-purple-400">
                      <History className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Historique</div>
                      <div className="text-xs text-muted-foreground">
                        Voir les mouvements
                      </div>
                    </div>
                  </button>
                )}
              </div>

              {/* Secondary Actions */}
              {(canDuplicate || onExport || onShare) && (
                <div className="px-2 py-2 border-t border-border">
                  <div className="text-xs text-muted-foreground px-2 py-1 uppercase tracking-wide">
                    Actions Secondaires
                  </div>

                  {canDuplicate && onDuplicate && (
                    <button
                      onClick={() => handleAction(() => onDuplicate(equipment))}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                    >
                      <div className="p-1.5 bg-gray-100 text-gray-600 rounded-md group-hover:bg-gray-200 transition-colors dark:bg-gray-900/30 dark:text-gray-400">
                        <Copy className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Dupliquer</div>
                        <div className="text-xs text-muted-foreground">
                          Créer une copie
                        </div>
                      </div>
                    </button>
                  )}

                  {onExport && (
                    <button
                      onClick={() => handleAction(() => onExport(equipment))}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                    >
                      <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md group-hover:bg-indigo-200 transition-colors dark:bg-indigo-900/30 dark:text-indigo-400">
                        <Download className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Exporter</div>
                        <div className="text-xs text-muted-foreground">
                          Télécharger les données
                        </div>
                      </div>
                    </button>
                  )}

                  {onShare && (
                    <button
                      onClick={() => handleAction(() => onShare(equipment))}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                    >
                      <div className="p-1.5 bg-cyan-100 text-cyan-600 rounded-md group-hover:bg-cyan-200 transition-colors dark:bg-cyan-900/30 dark:text-cyan-400">
                        <Share2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Partager</div>
                        <div className="text-xs text-muted-foreground">
                          Envoyer les détails
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}

              {/* Destructive Actions */}
              {(canArchive || canDelete) && (
                <div className="px-2 pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground px-2 py-1 uppercase tracking-wide">
                    Actions Critiques
                  </div>

                  {canArchive && onArchive && equipment.status !== "Retiré" && (
                    <button
                      onClick={() => setShowArchiveConfirm(true)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-card-foreground hover:bg-muted rounded-lg transition-colors duration-150 group"
                    >
                      <div className="p-1.5 bg-orange-100 text-orange-600 rounded-md group-hover:bg-orange-200 transition-colors dark:bg-orange-900/30 dark:text-orange-400">
                        <Archive className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Archiver</div>
                        <div className="text-xs text-muted-foreground">
                          Marquer comme retiré
                        </div>
                      </div>
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 group"
                    >
                      <div className="p-1.5 bg-red-100 text-red-600 rounded-md group-hover:bg-red-200 transition-colors dark:bg-red-900/30 dark:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">Supprimer</div>
                        <div className="text-xs text-muted-foreground">
                          Action irréversible
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  Confirmer la suppression
                </h3>
                <p className="text-sm text-muted-foreground">
                  Cette action est irréversible
                </p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-3">
                <img
                  src={equipment.image}
                  alt={equipment.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div>
                  <div className="font-medium text-card-foreground">
                    {equipment.name}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {equipment.serialNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Valeur: {equipment.value.toLocaleString()}Ar
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Supprimer définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg dark:bg-orange-900/30 dark:text-orange-400">
                <Archive className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  Archiver l'équipement
                </h3>
                <p className="text-sm text-muted-foreground">
                  L'équipement sera marqué comme retiré
                </p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-3">
                <img
                  src={equipment.image}
                  alt={equipment.name}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div>
                  <div className="font-medium text-card-foreground">
                    {equipment.name}
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {equipment.serialNumber}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Statut actuel: {equipment.status}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleArchive}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Archivage...
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    Archiver
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
