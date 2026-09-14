import { useState } from "react";
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
  Calculator,
  FileText,
  Building,
  Package,
  Euro,
  Hash,
  Calendar,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  JournalEntry,
  OrigineSortie,
  QualiteMateriel,
} from "../types/accounting";
import { toast } from "sonner";

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<JournalEntry, "id">) => void;
}

export function JournalEntryModal({
  isOpen,
  onClose,
  onSave,
}: JournalEntryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

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
        statut: "en_stock",
        createdBy: "admin@comptamatiere.com", // En réalité, récupéré du contexte utilisateur
        updatedAt: new Date().toISOString(),
      };

      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulation API

      onSave(newEntry);

      toast.success("Entrée journal créée avec succès", {
        description: `${formData.designation} ajouté au registre`,
      });

      // Reset form
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
      setCurrentStep(1);
      onClose();
    } catch (error) {
      toast.error("Erreur lors de la création", {
        description: "Une erreur s'est produite lors de l'enregistrement",
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <DialogTitle>Nouvelle Entrée Journal</DialogTitle>
          <DialogDescription>
            Création d'une nouvelle entrée dans le journal de comptabilité
            matière
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
                {step === 1 && "Informations générales"}
                {step === 2 && "Classification et origine"}
                {step === 3 && "Valorisation et qualité"}
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

        {/* Step 1: Informations générales */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informations générales
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
                    placeholder="BC-2024-001, FAC-001, DON-001..."
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
                <Label htmlFor="designation">Désignation du matériel *</Label>
                <Input
                  id="designation"
                  value={formData.designation}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      designation: e.target.value,
                    }))
                  }
                  placeholder="Ordinateur portable, Imprimante laser..."
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

        {/* Step 2: Classification et origine */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Classification
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
                        <SelectItem value="Bureautique">Bureautique</SelectItem>
                        <SelectItem value="Communication">
                          Communication
                        </SelectItem>
                        <SelectItem value="Audiovisuel">Audiovisuel</SelectItem>
                        <SelectItem value="Mobilier">Mobilier</SelectItem>
                        <SelectItem value="Outillage">Outillage</SelectItem>
                        <SelectItem value="Véhicule">Véhicule</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="numeroNomenclature">
                      Numéro nomenclature *
                    </Label>
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
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Origine
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
                    <Label htmlFor="origineReference">Référence</Label>
                    <Input
                      id="origineReference"
                      value={origine.reference || ""}
                      onChange={(e) =>
                        setOrigine((prev) => ({
                          ...prev,
                          reference: e.target.value,
                        }))
                      }
                      placeholder="Référence fournisseur"
                      className="font-mono"
                    />
                  </div>
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
                    <Label>État du matériel *</Label>
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
                    placeholder="Observations sur l'état du matériel..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Récapitulatif */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary">Récapitulatif</CardTitle>
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
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Création...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Créer l'entrée
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
