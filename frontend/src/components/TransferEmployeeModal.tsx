import React, { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  X,
  Save,
  User,
  Building2,
  Briefcase,
  Calendar,
  FileText,
  AlertCircle,
  Check,
} from "lucide-react";

interface Employee {
  id: number;
  name: string;
  im: string;
  fonction: string;
  email: string;
  phone: string;
  CIN: string;
  status: "Actif" | "Inactif" | "Congé";
}

interface Service {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
  employees: Employee[];
  location: string;
}

interface Direction {
  id: number;
  name: string;
  director: string;
  directorEmail: string;
  description: string;
  services: Service[];
  location: string;
  isCurrentAdminDirection?: boolean;
}

interface TransferEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransfer: (transfer: TransferData) => void;
  employee: Employee;
  currentService: Service;
  currentDirection: Direction;
  allDirections: Direction[];
}

interface TransferData {
  employeeId: number;
  fromServiceId: number;
  toServiceId: number;
  fromDirectionId: number;
  toDirectionId: number;
  newFonction?: string;
  effectiveDate: string;
  reason: string;
  notes?: string;
}

export function TransferEmployeeModal({
  isOpen,
  onClose,
  onTransfer,
  employee,
  currentService,
  currentDirection,
  allDirections,
}: TransferEmployeeModalProps) {
  const [selectedDirectionId, setSelectedDirectionId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [transferData, setTransferData] = useState({
    newFonction: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    reason: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const selectedDirection = allDirections.find(d => d.id === selectedDirectionId);
  const selectedService = selectedDirection?.services.find(s => s.id === selectedServiceId);

  useEffect(() => {
    if (isOpen) {
      setSelectedDirectionId(null);
      setSelectedServiceId(null);
      setTransferData({
        newFonction: employee.fonction,
        effectiveDate: new Date().toISOString().split("T")[0],
        reason: "",
        notes: "",
      });
      setErrors({});
      setShowConfirmation(false);
    }
  }, [isOpen, employee.fonction]);

  const availableServices = selectedDirection?.services.filter(
    service => service.id !== currentService.id
  ) || [];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedDirectionId) {
      newErrors.direction = "Veuillez sélectionner une direction";
    }
    if (!selectedServiceId) {
      newErrors.service = "Veuillez sélectionner un service";
    }
    if (!transferData.newFonction.trim()) {
      newErrors.fonction = "La nouvelle fonction est requise";
    }
    if (!transferData.effectiveDate) {
      newErrors.effectiveDate = "La date d'effet est requise";
    } else {
      const selectedDate = new Date(transferData.effectiveDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.effectiveDate = "La date d'effet ne peut pas être dans le passé";
      }
    }
    if (!transferData.reason.trim()) {
      newErrors.reason = "La raison du transfert est requise";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedService) return;

    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSaving(true);
    try {
      const transfer: TransferData = {
        employeeId: employee.id,
        fromServiceId: currentService.id,
        toServiceId: selectedServiceId!,
        fromDirectionId: currentDirection.id,
        toDirectionId: selectedDirectionId!,
        newFonction: transferData.newFonction.trim(),
        effectiveDate: transferData.effectiveDate,
        reason: transferData.reason.trim(),
        notes: transferData.notes.trim() || undefined,
      };

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate API call
      onTransfer(transfer);
      onClose();
    } catch (error) {
      console.error("Error transferring employee:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setTransferData({ ...transferData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  if (!isOpen) return null;

  const isInternal = selectedDirectionId === currentDirection.id;
  const transferType = isInternal ? "interne" : "externe";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-card-foreground">
                Transfert d'Employé
              </h3>
              <p className="text-sm text-muted-foreground">
                {employee.name} - {employee.im}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Current Information */}
            <div className="bg-muted/20 border border-border rounded-lg p-4">
              <h4 className="text-sm font-medium text-card-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Situation Actuelle
              </h4>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Direction:</span>
                  <div className="font-medium">{currentDirection.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <div className="font-medium">{currentService.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Fonction:</span>
                  <div className="font-medium">{employee.fonction}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Responsable:</span>
                  <div className="font-medium">{currentService.manager}</div>
                </div>
              </div>
            </div>

            {!showConfirmation ? (
              <>
                {/* Destination Selection */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-card-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Destination du Transfert
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">
                        Direction de Destination *
                      </label>
                      <select
                        value={selectedDirectionId || ""}
                        onChange={(e) => {
                          const directionId = e.target.value ? parseInt(e.target.value) : null;
                          setSelectedDirectionId(directionId);
                          setSelectedServiceId(null);
                          if (errors.direction) {
                            setErrors({ ...errors, direction: "" });
                          }
                        }}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      >
                        <option value="">Sélectionner une direction</option>
                        {allDirections.map((direction) => (
                          <option key={direction.id} value={direction.id}>
                            {direction.name}
                          </option>
                        ))}
                      </select>
                      {errors.direction && (
                        <p className="text-xs text-destructive">{errors.direction}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">
                        Service de Destination *
                      </label>
                      <select
                        value={selectedServiceId || ""}
                        onChange={(e) => {
                          const serviceId = e.target.value ? parseInt(e.target.value) : null;
                          setSelectedServiceId(serviceId);
                          if (errors.service) {
                            setErrors({ ...errors, service: "" });
                          }
                        }}
                        disabled={!selectedDirectionId}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Sélectionner un service</option>
                        {availableServices.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                      {errors.service && (
                        <p className="text-xs text-destructive">{errors.service}</p>
                      )}
                      {selectedDirectionId && availableServices.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Aucun service disponible pour le transfert
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedService && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isInternal 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                        }`}>
                          Transfert {transferType}
                        </span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div><strong>Service:</strong> {selectedService.name}</div>
                        <div><strong>Responsable:</strong> {selectedService.manager}</div>
                        <div><strong>Localisation:</strong> {selectedService.location}</div>
                        <div><strong>Description:</strong> {selectedService.description}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transfer Details */}
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-card-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Détails du Transfert
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">
                        Nouvelle Fonction *
                      </label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          value={transferData.newFonction}
                          onChange={(e) => handleInputChange("newFonction", e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                          placeholder="Nouvelle fonction dans le service"
                        />
                      </div>
                      {errors.fonction && (
                        <p className="text-xs text-destructive">{errors.fonction}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">
                        Date d'Effet *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                          type="date"
                          value={transferData.effectiveDate}
                          onChange={(e) => handleInputChange("effectiveDate", e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                        />
                      </div>
                      {errors.effectiveDate && (
                        <p className="text-xs text-destructive">{errors.effectiveDate}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">
                      Raison du Transfert *
                    </label>
                    <select
                      value={transferData.reason}
                      onChange={(e) => handleInputChange("reason", e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    >
                      <option value="">Sélectionner une raison</option>
                      <option value="reorganisation">Réorganisation du service</option>
                      <option value="promotion">Promotion</option>
                      <option value="demande_employe">Demande de l'employé</option>
                      <option value="competences">Adéquation des compétences</option>
                      <option value="charge_travail">Répartition de la charge de travail</option>
                      <option value="autre">Autre</option>
                    </select>
                    {errors.reason && (
                      <p className="text-xs text-destructive">{errors.reason}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">
                      Notes Additionnelles
                    </label>
                    <textarea
                      value={transferData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
                      placeholder="Informations supplémentaires sur le transfert..."
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Confirmation */
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <div>
                    <h4 className="font-medium text-orange-800 dark:text-orange-200">
                      Confirmer le Transfert
                    </h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Cette action va déplacer l'employé vers un nouveau service. Veuillez vérifier les informations.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-card-foreground">Résumé du Transfert</h4>
                  
                  <div className="grid gap-4 md:grid-cols-2 text-sm">
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground">Employé:</span>
                        <div className="font-medium">{employee.name} ({employee.im})</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">De:</span>
                        <div className="font-medium">{currentDirection.name}</div>
                        <div className="text-muted-foreground">{currentService.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fonction actuelle:</span>
                        <div className="font-medium">{employee.fonction}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground">Date d'effet:</span>
                        <div className="font-medium">
                          {new Date(transferData.effectiveDate).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vers:</span>
                        <div className="font-medium">{selectedDirection?.name}</div>
                        <div className="text-muted-foreground">{selectedService?.name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nouvelle fonction:</span>
                        <div className="font-medium">{transferData.newFonction}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Raison:</span>
                    <div className="font-medium">{transferData.reason}</div>
                  </div>

                  {transferData.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes:</span>
                      <div className="font-medium">{transferData.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={showConfirmation ? () => setShowConfirmation(false) : onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            {showConfirmation ? "Retour" : "Annuler"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving || (!showConfirmation && (!selectedServiceId || !transferData.reason))}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : showConfirmation ? (
              <Check className="h-4 w-4" />
            ) : (
              <ArrowRightLeft className="h-4 w-4" />
            )}
            {isSaving 
              ? "Transfert en cours..." 
              : showConfirmation 
                ? "Confirmer le Transfert"
                : "Continuer"
            }
          </button>
        </div>
      </div>
    </div>
  );
}