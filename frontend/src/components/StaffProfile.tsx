import { useState } from "react";
import {
  User as UserIcon,
  Mail,
  Building,
  Shield,
  Calendar,
  Save,
  Edit,
  Camera,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { User } from "../App";

interface StaffProfileProps {
  user: User;
}

export function StaffProfile({ user }: StaffProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNotification, setShowNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  // Déterminer les informations du profil basées sur l'organigramme
  const getProfileInfo = () => {
    const [direction, service] = user.department.split(" - ");

    // Mapper les managers selon l'organigramme
    const managerMap: { [key: string]: string } = {
      "Direction Logistique - Service Comptabilité Matière":
        "Marie RAKOTO (Admin)",
      "Direction Logistique - Service Approvisionnement": "Paul ANDRY",
      "Direction Logistique - Service Maintenance": "Michel RABE",
      "Direction RH - Service Gestion Personnel": "Voahangy RAZANADRA",
      "Direction Informatique - Service Développement": "Lala RAZAFINDRAKOTO",
      "Direction Financière - Service Budget": "Patrick RAZANATSEHENO",
    };

    // Mapper les fonctions selon les départements
    const fonctionMap: { [key: string]: string } = {
      "Direction Logistique - Service Comptabilité Matière":
        user.role === "admin"
          ? "Administrateur Système"
          : "Agent Comptabilité Matière",
      "Direction Logistique - Service Approvisionnement":
        "Agent Approvisionnement",
      "Direction Logistique - Service Maintenance": "Technicien Maintenance",
      "Direction RH - Service Gestion Personnel": "Gestionnaire RH",
      "Direction Informatique - Service Développement": "Développeur IT",
      "Direction Financière - Service Budget": "Analyste Budgétaire",
    };

    // Mapper les IM selon les départements
    const imMap: { [key: string]: string } = {
      "Jean RAMAROSON": "LOG.001",
      "Sophie RANDRIAMAMPIONONA": "LOG.002",
      "Paul ANDRY": "LOG.101",
      "Michel RABE": "LOG.201",
      "Voahangy RAZANADRA": "RH.001",
      "Lala RAZAFINDRAKOTO": "IT.001",
      "Patrick RAZANATSEHENO": "FIN.001",
      "Marie RAKOTO": "ADM.001",
    };

    return {
      fonction: fonctionMap[user.department] || "Employé",
      manager: managerMap[user.department] || "N/A",
      employeeId: imMap[user.name] || "N/A",
    };
  };

  const profileInfo = getProfileInfo();

  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: "+261 20 22 123 45",
    department: user.department,
    fonction: profileInfo.fonction,
    manager: profileInfo.manager,
    CIN: "101234567890",
    employeeId: profileInfo.employeeId,
    address: "Lot II A 123 Antsahavola, Antananarivo 101, Madagascar",
    emergencyContact: "RAKOTO Hery - +261 34 12 345 67",
  });

  const [activityStats] = useState({
    totalMovements: 156,
    entriesThisMonth: 23,
    exitsThisMonth: 18,
    averagePerDay: 2.4,
    lastLogin: "2025-01-08 14:30",
  });

  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!profileData.name.trim()) {
      errors.name = "Le nom est obligatoire";
    }
    if (!profileData.email.trim()) {
      errors.email = "L'email est obligatoire";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) {
      errors.email = "Format d'email invalide";
    }
    if (!profileData.phone.trim()) {
      errors.phone = "Le téléphone est obligatoire";
    }
    if (!profileData.fonction.trim()) {
      errors.fonction = "Le poste est obligatoire";
    }
    if (!profileData.address.trim()) {
      errors.address = "L'adresse est obligatoire";
    }
    if (!profileData.emergencyContact.trim()) {
      errors.emergencyContact = "Le contact d'urgence est obligatoire";
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setShowNotification({
        type: "error",
        message: "Veuillez corriger les erreurs dans le formulaire",
      });
      setTimeout(() => setShowNotification(null), 4000);
      return;
    }

    setFormErrors({});
    setIsSaving(true);

    try {
      // Simulate API call
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate 95% success rate
          if (Math.random() > 0.05) {
            resolve(null);
          } else {
            reject(new Error("Erreur de connexion au serveur"));
          }
        }, 2000);
      });

      console.log("Saving profile:", profileData);

      setShowNotification({
        type: "success",
        message: "Profil mis à jour avec succès!",
      });

      setIsEditing(false);
      setTimeout(() => setShowNotification(null), 4000);
    } catch (error) {
      setShowNotification({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Erreur lors de la sauvegarde",
      });
      setTimeout(() => setShowNotification(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Success/Error Notification */}
      {showNotification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl text-white animate-in slide-in-from-right-full duration-300 ${
            showNotification.type === "success"
              ? "bg-gradient-to-r from-green-500 to-green-600"
              : "bg-gradient-to-r from-red-500 to-red-600"
          }`}
        >
          <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
            {showNotification.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">
              {showNotification.message}
            </div>
            <div className="text-xs opacity-90">
              {showNotification.type === "success"
                ? "Opération réussie"
                : "Une erreur est survenue"}
            </div>
          </div>
          <button
            onClick={() => setShowNotification(null)}
            className="ml-4 text-white/80 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight mb-2 text-foreground flex items-center gap-2">
            <UserIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Mon Profil
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Informations personnelles et activité
          </p>
        </div>

        <button
          onClick={() => {
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
              setFormErrors({});
            }
          }}
          disabled={isSaving}
          className={`group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 transform-gpu overflow-hidden ${
            isEditing
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md shadow-green-500/25 hover:shadow-lg hover:shadow-green-500/40 hover:scale-105 active:scale-95"
              : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
          } ${isSaving ? "cursor-not-allowed scale-100 opacity-90" : ""}`}
        >
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/15 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Loading Overlay */}
          {isSaving && (
            <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-green-500/10 animate-pulse" />
          )}

          {/* Icon */}
          <div className="relative flex items-center justify-center w-4 h-4">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              <Save className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
            ) : (
              <Edit className="h-4 w-4 group-hover:scale-110 transition-transform duration-200" />
            )}
          </div>

          {/* Text */}
          <span className="relative">
            {isSaving
              ? "Sauvegarde..."
              : isEditing
              ? "Sauvegarder"
              : "Modifier"}
          </span>

          {/* Border Glow */}
          <div className="absolute inset-0 border border-white/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

          {/* Shimmer Effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out" />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Informations Professionnelles
            </h3>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary rounded-full flex items-center justify-center">
                    <UserIcon className="h-10 w-10 sm:h-12 sm:w-12 text-primary-foreground" />
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 p-1 bg-accent border border-border rounded-full hover:bg-accent/80">
                      <Camera className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-sm text-card-foreground">
                    {profileData.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profileData.fonction}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Nom complet
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={profileData.name}
                        onChange={(e) => {
                          setProfileData({
                            ...profileData,
                            name: e.target.value,
                          });
                          if (formErrors.name) {
                            setFormErrors({ ...formErrors, name: "" });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                          formErrors.name
                            ? "border-red-500 focus:ring-red-500"
                            : "border-border"
                        }`}
                      />
                      {formErrors.name && (
                        <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.name}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-card-foreground flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      {profileData.name}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Email
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="email"
                        value={profileData.email}
                        onChange={(e) => {
                          setProfileData({
                            ...profileData,
                            email: e.target.value,
                          });
                          if (formErrors.email) {
                            setFormErrors({ ...formErrors, email: "" });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                          formErrors.email
                            ? "border-red-500 focus:ring-red-500"
                            : "border-border"
                        }`}
                      />
                      {formErrors.email && (
                        <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.email}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-card-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {profileData.email}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    IM employé
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="tel"
                        value={profileData.employeeId}
                        onChange={(e) => {
                          setProfileData({
                            ...profileData,
                            employeeId: e.target.value,
                          });
                          if (formErrors.employeeId) {
                            setFormErrors({ ...formErrors, employeeId: "" });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                          formErrors.employeeId
                            ? "border-red-500 focus:ring-red-500"
                            : "border-border"
                        }`}
                      />
                      {formErrors.employeeId && (
                        <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.employeeId}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-card-foreground">
                      {profileData.employeeId}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Direction
                  </label>
                  <div className="text-card-foreground flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {profileData.department}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Poste
                  </label>
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={profileData.fonction}
                        onChange={(e) => {
                          setProfileData({
                            ...profileData,
                            fonction: e.target.value,
                          });
                          if (formErrors.fonction) {
                            setFormErrors({ ...formErrors, position: "" });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                          formErrors.position
                            ? "border-red-500 focus:ring-red-500"
                            : "border-border"
                        }`}
                      />
                      {formErrors.position && (
                        <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {formErrors.position}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-card-foreground">
                      {profileData.fonction}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Manager
                  </label>
                  <div className="text-card-foreground">
                    {profileData.manager}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Employment Details */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informations Personnelles
            </h3>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Téléphone
                </label>
                <div className="text-card-foreground font-mono">
                  {profileData.phone}
                </div>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  CIN
                </label>
                <div className="text-card-foreground flex items-center gap-2">
                  {profileData.CIN}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-muted-foreground mb-2">
                  Adresse
                </label>
                {isEditing ? (
                  <>
                    <textarea
                      value={profileData.address}
                      onChange={(e) => {
                        setProfileData({
                          ...profileData,
                          address: e.target.value,
                        });
                        if (formErrors.address) {
                          setFormErrors({ ...formErrors, address: "" });
                        }
                      }}
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                        formErrors.address
                          ? "border-red-500 focus:ring-red-500"
                          : "border-border"
                      }`}
                    />
                    {formErrors.address && (
                      <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.address}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-card-foreground">
                    {profileData.address}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-muted-foreground mb-2">
                  Contact d'urgence
                </label>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={profileData.emergencyContact}
                      onChange={(e) => {
                        setProfileData({
                          ...profileData,
                          emergencyContact: e.target.value,
                        });
                        if (formErrors.emergencyContact) {
                          setFormErrors({
                            ...formErrors,
                            emergencyContact: "",
                          });
                        }
                      }}
                      className={`w-full px-3 py-2 border rounded-lg bg-background focus:ring-2 focus:ring-ring text-sm transition-colors ${
                        formErrors.emergencyContact
                          ? "border-red-500 focus:ring-red-500"
                          : "border-border"
                      }`}
                    />
                    {formErrors.emergencyContact && (
                      <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.emergencyContact}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-card-foreground">
                    {profileData.emergencyContact}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg text-card-foreground mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </h3>

            <div className="space-y-3">
              {user.permissions.map((permission, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <Shield className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm text-card-foreground">
                      {permission === "material_entry" &&
                        "Enregistrement entrées matières"}
                      {permission === "material_exit" &&
                        "Enregistrement sorties matières"}
                      {permission === "view_movements" &&
                        "Consultation journal comptable"}
                      {permission === "create_requests" &&
                        "Création demandes matériel"}
                      {permission === "maintenance_requests" &&
                        "Gestion demandes maintenance"}
                      {permission === "tech_support" && "Support technique IT"}
                      {permission === "financial_reports" &&
                        "Consultation rapports financiers"}
                      {permission === "all" &&
                        "Administration système complète"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {permission === "all"
                        ? "Accès complet à toutes les fonctionnalités"
                        : "Permission accordée selon votre fonction"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Stats */}
        <div className="space-y-6">
          {/* Current Session */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg text-card-foreground mb-4">
              Session Actuelle
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Statut:</span>
                <span className="text-sm text-green-600 dark:text-green-400">
                  Connecté
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Dernière connexion:
                </span>
                <span className="text-sm text-card-foreground">
                  {activityStats.lastLogin}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Rôle:</span>
                <span className="text-sm text-card-foreground">Personnel</span>
              </div>
            </div>
          </div>

          {/* Activity Statistics */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg text-card-foreground mb-4">
              Statistiques d'Activité
            </h3>
            <div className="space-y-4">
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <div className="text-2xl text-primary">
                  {activityStats.totalMovements}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total mouvements
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-lg text-green-600 dark:text-green-400">
                    {activityStats.entriesThisMonth}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Entrées ce mois
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-lg text-blue-600 dark:text-blue-400">
                    {activityStats.exitsThisMonth}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sorties ce mois
                  </div>
                </div>
              </div>

              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-lg text-purple-600 dark:text-purple-400">
                  {activityStats.averagePerDay}
                </div>
                <div className="text-xs text-muted-foreground">
                  Moyenne par jour
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-4 sm:p-6 shadow-sm">
            <h3 className="text-lg text-card-foreground mb-4">
              Actions Rapides
            </h3>
            <div className="space-y-2">
              <QuickActionButton
                title="Changer mon mot de passe"
                description="Sécurité du compte"
                icon="🔒"
                onClick={() => {
                  setShowNotification({
                    type: "success",
                    message:
                      "Redirection vers la page de changement de mot de passe",
                  });
                  setTimeout(() => setShowNotification(null), 3000);
                }}
              />
              <QuickActionButton
                title="Télécharger mes données"
                description="Export RGPD"
                icon="⬇️"
                onClick={() => {
                  setShowNotification({
                    type: "success",
                    message: "Préparation du téléchargement de vos données...",
                  });
                  setTimeout(() => setShowNotification(null), 3000);
                }}
              />
              <QuickActionButton
                title="Préférences notifications"
                description="Paramètres d'alerte"
                icon="🔔"
                onClick={() => {
                  setShowNotification({
                    type: "success",
                    message: "Ouverture des préférences de notification",
                  });
                  setTimeout(() => setShowNotification(null), 3000);
                }}
              />
              <QuickActionButton
                title="Aide et support"
                description="Centre d'assistance"
                icon="❓"
                onClick={() => {
                  setShowNotification({
                    type: "success",
                    message: "Redirection vers le centre d'aide",
                  });
                  setTimeout(() => setShowNotification(null), 3000);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Quick Action Button Component
interface QuickActionButtonProps {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}

function QuickActionButton({
  title,
  description,
  icon,
  onClick,
}: QuickActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    // Simulate processing delay
    setTimeout(() => {
      onClick();
      setIsLoading(false);
    }, 800);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="group relative w-full px-4 py-3 text-left border border-border rounded-lg transition-all duration-200 hover:bg-muted/30 hover:border-primary/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
    >
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-muted/50 rounded-lg flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-lg group-hover:scale-110 transition-transform duration-200">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-card-foreground group-hover:text-primary transition-colors duration-200">
            {title}
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="text-muted-foreground group-hover:text-primary transition-colors duration-200">
          <div className="w-5 h-5 border-2 border-current rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-current rounded-full transform scale-0 group-hover:scale-100 transition-transform duration-200" />
          </div>
        </div>
      </div>

      {/* Hover Border Effect */}
      <div className="absolute inset-0 border-2 border-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
    </button>
  );
}
