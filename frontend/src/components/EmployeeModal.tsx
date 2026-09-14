import React, { useState, useEffect } from "react";
import {
  User,
  X,
  Save,
  Mail,
  Phone,
  IdCard,
  Briefcase,
  Hash,
  AlertCircle,
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
  location: string;
}

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: Partial<Employee>) => void;
  employee?: Employee | null;
  service: Service;
  mode: "create" | "edit";
}

export function EmployeeModal({
  isOpen,
  onClose,
  onSave,
  employee,
  service,
  mode,
}: EmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    im: "",
    fonction: "",
    email: "",
    phone: "",
    CIN: "",
    status: "Actif" as const,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (employee && mode === "edit") {
      setFormData({
        name: employee.name,
        im: employee.im,
        fonction: employee.fonction,
        email: employee.email,
        phone: employee.phone,
        CIN: employee.CIN,
        status: employee.status,
      });
    } else {
      setFormData({
        name: "",
        im: "",
        fonction: "",
        email: "",
        phone: "",
        CIN: "",
        status: "Actif",
      });
    }
    setErrors({});
  }, [employee, mode, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom complet est requis";
    }
    if (!formData.im.trim()) {
      newErrors.im = "Le numéro IM est requis";
    } else if (!/^[A-Z]{2,4}\.\d{3}$/.test(formData.im)) {
      newErrors.im = "Format IM invalide (ex: MIN.001)";
    }
    if (!formData.fonction.trim()) {
      newErrors.fonction = "La fonction est requise";
    }
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Format d'email invalide";
    }
    if (!formData.phone.trim()) {
      newErrors.phone = "Le téléphone est requis";
    } else if (!/^\+261\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{2}$/.test(formData.phone)) {
      newErrors.phone = "Format téléphone invalide (+261 20 22 123 45)";
    }
    if (!formData.CIN.trim()) {
      newErrors.CIN = "Le numéro CIN est requis";
    } else if (!/^\d{12}$/.test(formData.CIN)) {
      newErrors.CIN = "Le CIN doit contenir 12 chiffres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const employeeData: Partial<Employee> = {
        ...formData,
      };

      if (mode === "edit" && employee) {
        employeeData.id = employee.id;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      onSave(employeeData);
      onClose();
    } catch (error) {
      console.error("Error saving employee:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const generateIM = () => {
    const prefix = "MIN"; // You could make this dynamic based on direction
    const lastPart = Math.floor(Math.random() * 900) + 100; // 100-999
    const newIM = `${prefix}.${lastPart}`;
    handleInputChange("im", newIM);
  };

  if (!isOpen) return null;

  const statusOptions = ["Actif", "Inactif", "Congé"] as const;
  const statusColors = {
    Actif: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Inactif: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    Congé: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-card-foreground">
                {mode === "edit" ? "Modifier l'Employé" : "Nouvel Employé"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Service: {service.name}
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
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-card-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Informations Personnelles
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Nom Complet *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="ex: Marie RAKOTO"
                    />
                  </div>
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Numéro IM *
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={formData.im}
                        onChange={(e) => handleInputChange("im", e.target.value.toUpperCase())}
                        className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                        placeholder="MIN.001"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={generateIM}
                      className="px-3 py-2 text-xs bg-muted text-muted-foreground hover:bg-muted/80 rounded-lg transition-colors"
                      title="Générer un IM automatique"
                    >
                      Auto
                    </button>
                  </div>
                  {errors.im && (
                    <p className="text-xs text-destructive">{errors.im}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Fonction *
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formData.fonction}
                      onChange={(e) => handleInputChange("fonction", e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="ex: Gestionnaire Matériel"
                    />
                  </div>
                  {errors.fonction && (
                    <p className="text-xs text-destructive">{errors.fonction}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Statut *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange("status", e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Aperçu:</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                        statusColors[formData.status]
                      }`}
                    >
                      {formData.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-card-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Informations de Contact
              </h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="nom.prenom@ministere.gov.mg"
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-card-foreground">
                    Téléphone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      placeholder="+261 20 22 123 45"
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-destructive">{errors.phone}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-card-foreground">
                  Numéro CIN *
                </label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={formData.CIN}
                    onChange={(e) => handleInputChange("CIN", e.target.value.replace(/\D/g, ""))}
                    maxLength={12}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                    placeholder="123456789012"
                  />
                </div>
                {errors.CIN && (
                  <p className="text-xs text-destructive">{errors.CIN}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3" />
                  12 chiffres requis
                </div>
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
                : "Ajouter"
            }
          </button>
        </div>
      </div>
    </div>
  );
}