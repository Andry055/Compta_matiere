import React, { useState, useEffect } from "react";
import {
  Building2,
  X,
  Save,
  Plus,
  Trash2,
  Edit,
  User,
  Mail,
  MapPin,
  FileText,
} from "lucide-react";

interface Service {
  id: number;
  name: string;
  manager: string;
  managerEmail: string;
  description: string;
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

interface DirectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (direction: Partial<Direction>) => void;
  direction?: Direction | null; // Pour l'édition
  mode: "create" | "edit";
}

export function DirectionModal({
  isOpen,
  onClose,
  onSave,
  direction,
  mode,
}: DirectionModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    director: "",
    directorEmail: "",
    description: "",
    location: "",
  });

  const [services, setServices] = useState<Omit<Service, "id">[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (direction && mode === "edit") {
      setFormData({
        name: direction.name,
        director: direction.director,
        directorEmail: direction.directorEmail,
        description: direction.description,
        location: direction.location,
      });
      setServices(
        direction.services.map(({ id, ...service }) => service)
      );
    } else {
      // Reset form for create mode
      setFormData({
        name: "",
        director: "",
        directorEmail: "",
        description: "",
        location: "",
      });
      setServices([]);
    }
    setErrors({});
  }, [direction, mode, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom de la direction est requis";
    }
    if (!formData.director.trim()) {
      newErrors.director = "Le nom du directeur est requis";
    }
    if (!formData.directorEmail.trim()) {
      newErrors.directorEmail = "L'email du directeur est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.directorEmail)) {
      newErrors.directorEmail = "Format d'email invalide";
    }
    if (!formData.description.trim()) {
      newErrors.description = "La description est requise";
    }
    if (!formData.location.trim()) {
      newErrors.location = "La localisation est requise";
    }

    // Validate services
    services.forEach((service, index) => {
      if (!service.name.trim()) {
        newErrors[`service_${index}_name`] = "Le nom du service est requis";
      }
      if (!service.manager.trim()) {
        newErrors[`service_${index}_manager`] = "Le responsable est requis";
      }
      if (!service.managerEmail.trim()) {
        newErrors[`service_${index}_email`] = "L'email est requis";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(service.managerEmail)) {
        newErrors[`service_${index}_email`] = "Format d'email invalide";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const directionData: Partial<Direction> = {
        ...formData,
        services: services.map((service, index) => ({
          ...service,
          id: direction?.services[index]?.id || Date.now() + index,
          employees: direction?.services[index]?.employees || [],
        })),
      };

      if (mode === "edit" && direction) {
        directionData.id = direction.id;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      onSave(directionData);
      onClose();
    } catch (error) {
      console.error("Error saving direction:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addService = () => {
    setServices([
      ...services,
      {
        name: "",
        manager: "",
        managerEmail: "",
        description: "",
        location: "",
      },
    ]);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
    // Clear related errors
    const newErrors = { ...errors };
    Object.keys(newErrors).forEach((key) => {
      if (key.startsWith(`service_${index}_`)) {
        delete newErrors[key];
      }
    });
    setErrors(newErrors);
  };

  const updateService = (index: number, field: string, value: string) => {
    const updatedServices = [...services];
    updatedServices[index] = { ...updatedServices[index], [field]: value };
    setServices(updatedServices);

    // Clear specific error
    const errorKey = `service_${index}_${field === "managerEmail" ? "email" : field}`;
    if (errors[errorKey]) {
      setErrors({ ...errors, [errorKey]: "" });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-card-foreground">
                {mode === "edit" ? "Modifier la Direction" : "Nouvelle Direction"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {mode === "edit" 
                  ? "Modifier les informations de la direction" 
                  : "Créer une nouvelle direction dans l'organigramme"
                }
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
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Direction Details */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-card-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Informations de la Direction
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Nom de la Direction *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    placeholder="ex: Direction des Ressources Humaines"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Localisation *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="ex: Bâtiment Principal - 2ème étage"
                    />
                  </div>
                  {errors.location && (
                    <p className="text-xs text-destructive">{errors.location}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Directeur *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.director}
                      onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="ex: Dr. RAZAFY Jean Pierre"
                    />
                  </div>
                  {errors.director && (
                    <p className="text-xs text-destructive">{errors.director}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Email du Directeur *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={formData.directorEmail}
                      onChange={(e) => setFormData({ ...formData, directorEmail: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="directeur@ministere.gov.mg"
                    />
                  </div>
                  {errors.directorEmail && (
                    <p className="text-xs text-destructive">{errors.directorEmail}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-card-foreground">
                  Description *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
                    placeholder="Description des missions et responsabilités de la direction"
                  />
                </div>
                {errors.description && (
                  <p className="text-xs text-destructive">{errors.description}</p>
                )}
              </div>
            </div>

            {/* Services */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-card-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Services ({services.length})
                </h4>
                <button
                  type="button"
                  onClick={addService}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un Service
                </button>
              </div>

              <div className="space-y-4">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="p-4 border border-border rounded-lg bg-muted/20 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-card-foreground">
                        Service #{index + 1}
                      </h5>
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="text-destructive hover:text-destructive/80 p-1 hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Nom du Service *
                        </label>
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(index, "name", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                          placeholder="ex: Service Comptabilité Matière"
                        />
                        {errors[`service_${index}_name`] && (
                          <p className="text-xs text-destructive">
                            {errors[`service_${index}_name`]}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Localisation
                        </label>
                        <input
                          type="text"
                          value={service.location}
                          onChange={(e) => updateService(index, "location", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                          placeholder="ex: Bureau 201"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Responsable *
                        </label>
                        <input
                          type="text"
                          value={service.manager}
                          onChange={(e) => updateService(index, "manager", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                          placeholder="ex: Mme RAKOTO Marie"
                        />
                        {errors[`service_${index}_manager`] && (
                          <p className="text-xs text-destructive">
                            {errors[`service_${index}_manager`]}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Email du Responsable *
                        </label>
                        <input
                          type="email"
                          value={service.managerEmail}
                          onChange={(e) => updateService(index, "managerEmail", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                          placeholder="responsable@ministere.gov.mg"
                        />
                        {errors[`service_${index}_email`] && (
                          <p className="text-xs text-destructive">
                            {errors[`service_${index}_email`]}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Description
                      </label>
                      <textarea
                        value={service.description}
                        onChange={(e) => updateService(index, "description", e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors resize-none"
                        placeholder="Description des activités du service"
                      />
                    </div>
                  </div>
                ))}

                {services.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun service ajouté</p>
                    <p className="text-xs">Cliquez sur "Ajouter un Service" pour commencer</p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving 
              ? "Enregistrement..." 
              : mode === "edit" 
                ? "Modifier" 
                : "Créer"
            }
          </button>
        </div>
      </div>
    </div>
  );
}