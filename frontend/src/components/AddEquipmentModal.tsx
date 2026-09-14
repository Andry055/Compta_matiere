import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Package,
  Plus,
  Calculator,
  FileText,
  Building,
  Euro,
  Hash,
  Calendar,
  CheckCircle,
  AlertCircle,
  Upload,
  X,
} from "lucide-react";
import {
  JournalEntry,
  OrigineSortie,
  QualiteMateriel,
} from "../types/accounting";
import { toast } from "sonner";

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<JournalEntry, "id">) => void;
}

export function AddEquipmentModal({
  isOpen,
  onClose,
  onSave,
}: AddEquipmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  // État du formulaire
  const [formData, setFormData] = useState({
    numeroOrdre: "",
    pieceJustificative: "",
    dateEntree: new Date().toISOString().split("T")[0],
    designation: "",
    espece: "",
    numeroNomenclature: "",
    uniteNombre: 1,
    prixUnitaire: 0,
    observations: "",
    serialNumber: "",
    brand: "",
    model: "",
    warranty: "",
    specifications: "",
    image: "",
  });

  const [origine, setOrigine] = useState<OrigineSortie>({
    type: "fournisseur",
    nom: "",
    reference: "",
    adresse: "",
    contact: "",
  });

  const [qualite, setQualite] = useState<QualiteMateriel>({
    etat: "neuf",
    notes: "",
    dateControle: new Date().toISOString().split("T")[0],
    controlePar: "",
  });

  // Calcul automatique de la valeur totale
  const valeurTotale = formData.uniteNombre * formData.prixUnitaire;

  // Génération automatique du numéro d'ordre
  const generateNumeroOrdre = () => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `${year}-${timestamp}`;
  };

  // Génération automatique du numéro de série
  const generateSerialNumber = () => {
    const prefix = formData.espece.substring(0, 2).toUpperCase() || "EQ";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `${prefix}${year}${month}${random}`;
  };

  // Génération automatique du numéro de nomenclature
  const generateNomenclature = () => {
    const prefix = formData.espece.substring(0, 3).toUpperCase() || "MAT";
    const random = Math.floor(Math.random() * 10)
      .toString()
      .padStart(3, "0");
    return `${prefix}-${random}`;
  };

  // Gestion de l'upload d'image
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);

      // Simulation upload
      setTimeout(() => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageUrl = event.target?.result as string;
          setImagePreview(imageUrl);
          setFormData((prev) => ({ ...prev, image: imageUrl }));
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      }, 1000);
    }
    e.target.value = "";
  };

  const removeImage = () => {
    setImagePreview("");
    setFormData((prev) => ({ ...prev, image: "" }));
  };

  // Validation des étapes
  const isStep1Valid = () => {
    return (
      formData.numeroOrdre && formData.pieceJustificative && formData.dateEntree
    );
  };

  const isStep2Valid = () => {
    return (
      formData.designation &&
      formData.espece &&
      formData.numeroNomenclature &&
      origine.nom
    );
  };

  const isStep3Valid = () => {
    return (
      formData.uniteNombre > 0 &&
      formData.prixUnitaire >= 0 &&
      qualite.etat &&
      qualite.controlePar
    );
  };

  const handleSubmit = async () => {
    if (!isStep3Valid()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsSubmitting(true);

    try {
      const newEntry: Omit<JournalEntry, "id"> = {
        ...formData,
        origine,
        qualite,
        valeurTotale,
        statut: "en_stock", // Nouveau matériel directement en stock
        createdBy: "admin@comptamatiere.com",
        updatedAt: new Date().toISOString(),
      };

      await new Promise((resolve) => setTimeout(resolve, 1500));

      onSave(newEntry);

      toast.success("Équipement ajouté avec succès", {
        description: `${formData.designation} enregistré dans le journal comptable`,
      });

      resetForm();
      onClose();
    } catch (error) {
      toast.error("Erreur lors de l'ajout", {
        description: "Une erreur s'est produite lors de l'enregistrement",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      numeroOrdre: "",
      pieceJustificative: "",
      dateEntree: new Date().toISOString().split("T")[0],
      designation: "",
      espece: "",
      numeroNomenclature: "",
      uniteNombre: 1,
      prixUnitaire: 0,
      observations: "",
      serialNumber: "",
      brand: "",
      model: "",
      warranty: "",
      specifications: "",
      image: "",
    });
    setOrigine({
      type: "fournisseur",
      nom: "",
      reference: "",
      adresse: "",
      contact: "",
    });
    setQualite({
      etat: "neuf",
      notes: "",
      dateControle: new Date().toISOString().split("T")[0],
      controlePar: "",
    });
    setImagePreview("");
    setCurrentStep(1);
  };

  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && isStep2Valid()) {
      setCurrentStep(3);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nouvel Équipement - Entrée Journal
          </DialogTitle>
          <DialogDescription>
            Enregistrement d'un nouvel équipement dans le journal de
            comptabilité matière
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step < currentStep ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  step
                )}
              </div>
              <div
                className={`ml-2 text-sm ${
                  step <= currentStep
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {step === 1 && "Informations comptables"}
                {step === 2 && "Identification & origine"}
                {step === 3 && "Valorisation & qualité"}
              </div>
              {step < 3 && (
                <div
                  className={`ml-4 w-16 h-px ${
                    step < currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Informations comptables */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informations comptables
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="numeroOrdre">Numéro d'ordre *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="numeroOrdre"
                      value={formData.numeroOrdre}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          numeroOrdre: e.target.value,
                        }))
                      }
                      placeholder="2024-001"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          numeroOrdre: generateNumeroOrdre(),
                        }))
                      }
                    >
                      <Hash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="pieceJustificative">
                    Pièce justificative *
                  </Label>
                  <Input
                    id="pieceJustificative"
                    value={formData.pieceJustificative}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        pieceJustificative: e.target.value,
                      }))
                    }
                    placeholder="BC-2024-001, FAC-001..."
                    className="font-mono"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="dateEntree">Date d'entrée *</Label>
                <Input
                  id="dateEntree"
                  type="date"
                  value={formData.dateEntree}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      dateEntree: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="designation">
                  Désignation de l'équipement *
                </Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      designation: e.target.value,
                    }))
                  }
                  placeholder="Ordinateur portable Dell Latitude 5520"
                />
              </div>

              <div>
                <Label htmlFor="observations">Observations</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      observations: e.target.value,
                    }))
                  }
                  placeholder="Notes concernant cette entrée..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Identification et origine */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Identification technique
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="espece">Espèce/Catégorie *</Label>
                    <Select
                      value={formData.espece}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, espece: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Informatique">
                          Informatique
                        </SelectItem>
                        <SelectItem value="Communication">
                          Communication
                        </SelectItem>
                        <SelectItem value="Audiovisuel">Audiovisuel</SelectItem>
                        <SelectItem value="Mobilier">Mobilier</SelectItem>
                        <SelectItem value="Outillage">Outillage</SelectItem>
                        <SelectItem value="Véhicule">Véhicule</SelectItem>
                        <SelectItem value="Périphériques">
                          Périphériques
                        </SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="numeroNomenclature">
                      Numéro nomenclature *
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="numeroNomenclature"
                        value={formData.numeroNomenclature}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            numeroNomenclature: e.target.value,
                          }))
                        }
                        placeholder="INFO-001, BUR-002..."
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            numeroNomenclature: generateNomenclature(),
                          }))
                        }
                      >
                        <Hash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="serialNumber">Numéro de série</Label>
                    <div className="flex gap-2">
                      <Input
                        id="serialNumber"
                        value={formData.serialNumber}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            serialNumber: e.target.value,
                          }))
                        }
                        placeholder="DL2024001"
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            serialNumber: generateSerialNumber(),
                          }))
                        }
                        size="sm"
                      >
                        Gen
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="brand">Marque</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          brand: e.target.value,
                        }))
                      }
                      placeholder="Dell, HP, Cisco..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Modèle</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          model: e.target.value,
                        }))
                      }
                      placeholder="Latitude 5520, EliteBook..."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="warranty">Garantie</Label>
                  <Input
                    id="warranty"
                    value={formData.warranty}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        warranty: e.target.value,
                      }))
                    }
                    placeholder="3 ans, jusqu'au 2027-01-01"
                  />
                </div>

                <div>
                  <Label htmlFor="specifications">
                    Spécifications techniques
                  </Label>
                  <Textarea
                    id="specifications"
                    value={formData.specifications}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        specifications: e.target.value,
                      }))
                    }
                    placeholder="Processeur, RAM, stockage, écran, système..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Origine de l'équipement
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Type d'origine *</Label>
                  <Select
                    value={origine.type}
                    onValueChange={(value: any) =>
                      setOrigine((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fournisseur">Fournisseur</SelectItem>
                      <SelectItem value="entreprise">Entreprise</SelectItem>
                      <SelectItem value="donation">Donation</SelectItem>
                      <SelectItem value="retour">Retour</SelectItem>
                      <SelectItem value="transfert">Transfert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="origineNom">Nom *</Label>
                    <Input
                      id="origineNom"
                      value={origine.nom}
                      onChange={(e) =>
                        setOrigine((prev) => ({ ...prev, nom: e.target.value }))
                      }
                      placeholder="Nom du fournisseur/entreprise"
                    />
                  </div>
                  <div>
                    <Label htmlFor="origineAdresse">Adresse</Label>
                    <Input
                      id="origineAdresse"
                      value={origine.adresse || ""}
                      onChange={(e) =>
                        setOrigine((prev) => ({
                          ...prev,
                          adresse: e.target.value,
                        }))
                      }
                      placeholder="Adresse complète"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="origineContact">Contact</Label>
                  <Input
                    id="origineContact"
                    value={origine.contact || ""}
                    onChange={(e) =>
                      setOrigine((prev) => ({
                        ...prev,
                        contact: e.target.value,
                      }))
                    }
                    placeholder="Email ou téléphone"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Image Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Image de l'équipement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative border-2 border-dashed border-border rounded-lg p-4 text-center min-h-[120px] flex flex-col justify-center">
                      {imagePreview ? (
                        <div className="space-y-2">
                          <img
                            src={imagePreview}
                            alt="Aperçu"
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={removeImage}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Supprimer
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <div className="text-sm text-muted-foreground">
                            {isUploading
                              ? "Upload en cours..."
                              : "Cliquez pour ajouter une image"}
                          </div>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="sr-only"
                              disabled={isUploading}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isUploading}
                            >
                              Parcourir
                            </Button>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Valorisation et qualité */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Valorisation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="uniteNombre">Quantité (unités) *</Label>
                    <Input
                      id="uniteNombre"
                      type="number"
                      min="1"
                      value={formData.uniteNombre}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          uniteNombre: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="prixUnitaire">Prix unitaire (Ar) *</Label>
                    <Input
                      id="prixUnitaire"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prixUnitaire}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          prixUnitaire: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Valeur totale (Ar)</Label>
                    <div className="flex items-center h-10 px-3 border border-border rounded-lg bg-muted">
                      <Calculator className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="font-semibold text-primary">
                        {valeurTotale.toLocaleString()}Ar
                      </span>
                    </div>
                  </div>
                </div>

                {valeurTotale > 0 && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Valorisation: {formData.uniteNombre} ×{" "}
                        {formData.prixUnitaire.toLocaleString()}Ar ={" "}
                        {valeurTotale.toLocaleString()}Ar
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Contrôle qualité
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>État de l'équipement *</Label>
                    <Select
                      value={qualite.etat}
                      onValueChange={(value: any) =>
                        setQualite((prev) => ({ ...prev, etat: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neuf">Neuf</SelectItem>
                        <SelectItem value="bon">Bon état</SelectItem>
                        <SelectItem value="moyen">État moyen</SelectItem>
                        <SelectItem value="defaillant">Défaillant</SelectItem>
                        <SelectItem value="hs">Hors d'usage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dateControle">Date de contrôle *</Label>
                    <Input
                      id="dateControle"
                      type="date"
                      value={qualite.dateControle}
                      onChange={(e) =>
                        setQualite((prev) => ({
                          ...prev,
                          dateControle: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="controlePar">Contrôlé par *</Label>
                  <Input
                    id="controlePar"
                    value={qualite.controlePar}
                    onChange={(e) =>
                      setQualite((prev) => ({
                        ...prev,
                        controlePar: e.target.value,
                      }))
                    }
                    placeholder="Service ou personne responsable du contrôle"
                  />
                </div>

                <div>
                  <Label htmlFor="qualiteNotes">Notes qualité</Label>
                  <Textarea
                    id="qualiteNotes"
                    value={qualite.notes || ""}
                    onChange={(e) =>
                      setQualite((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Observations sur l'état de l'équipement..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Récapitulatif */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary">
                  Récapitulatif de l'entrée
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Numéro d'ordre:
                    </span>
                    <p className="font-mono">{formData.numeroOrdre}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Désignation:</span>
                    <p>{formData.designation}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantité:</span>
                    <p>{formData.uniteNombre} unité(s)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Valeur totale:
                    </span>
                    <p className="font-semibold text-primary">
                      {valeurTotale.toLocaleString()}Ar
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Origine:</span>
                    <p>{origine.nom}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">État:</span>
                    <Badge
                      className={`${
                        qualite.etat === "neuf"
                          ? "bg-emerald-100 text-emerald-800"
                          : qualite.etat === "bon"
                          ? "bg-green-100 text-green-800"
                          : qualite.etat === "moyen"
                          ? "bg-yellow-100 text-yellow-800"
                          : qualite.etat === "defaillant"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {qualite.etat}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">
                      Statut initial:
                    </span>
                    <Badge className="ml-2 bg-green-100 text-green-800">
                      En Stock
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-2">
                      (Disponible pour distribution)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrevious}>
                Précédent
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={
                  (currentStep === 1 && !isStep1Valid()) ||
                  (currentStep === 2 && !isStep2Valid())
                }
              >
                Suivant
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!isStep3Valid() || isSubmitting}
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter l'Équipement
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
