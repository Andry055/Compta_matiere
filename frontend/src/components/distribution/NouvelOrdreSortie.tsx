import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Button
} from "@/components/ui/button";
import {
  Input
} from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Textarea
} from "@/components/ui/textarea";
import {
  Label
} from "@/components/ui/label";
import {
  Checkbox
} from "@/components/ui/checkbox";
import {
  SesameSeeds,
  Briefcase,
  User,
  MapPin,
  FileText,
  Clock,
  Truck
} from "lucide-react";
import { useMaterialsLive } from "@/lib/useMaterialsLive";
import { fetchDirections, fetchServices } from "@/lib/api";
import type { MaterialOption } from "@/lib/api";
import {
  validerSortieBrouillon,
  calculerTotalEstime,
  construirePayloadSortie,
  apparierDemande
} from "@/lib/sortieBrouillon";
import { fetchDemandesPourLiaison } from "@/lib/demandes";
import type { DemandeRecord } from "@/lib/demandes";
import { toast } from "sonner";

interface NouvelOrdreSortieProps {
  /** Fonction appelée lors de la soumission réussie */
  onSuccess: (reference: string) => void;
  /** Fonction appelée en cas d'erreur */
  onError: (message: string) => void;
  /** Utilisateur connecté (pour vérifier le rôle) */
  userRole: string;
  /** Matériau pré-sélectionné pour pré-remplir le formulaire (optionnel) */
  initialMaterial?: MaterialOption;
  /**
   * Demande APPROUVÉE à transformer en ordre de sortie (étape 3). Quand elle
   * est fournie, le formulaire se préremplit TOUT SEUL : direction, service,
   * lignes (quantités approuvées), pièce justificative = référence de la
   * demande et champ « Demande liée ». Le dépositaire n'a plus qu'à vérifier
   * puis confirmer.
   */
  initialDemande?: DemandeRecord | null;
  /** Notifie le parent que la demande a été appliquée (évite tout re-jeu). */
  onDemandePreRemplie?: () => void;
}

/** Normalisation des noms d'organigramme pour apparier la demande aux listes
 *  de référence (accents, casse, espaces : « Direction du Travail (DT) » vs
 *  « Direction du Travail »). */
function normaliserNom(valeur?: string): string {
  return (valeur || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Radix <Select> INTERDIT `value=""` (c'est la valeur réservée au
 *  placeholder) : un <SelectItem value=""> fait planter le rendu entier du
 *  formulaire. On passe donc par des sentinels, réinterprétées en `undefined`. */
const AUCUNE_DIRECTION = "__aucune_direction__";
const AUCUN_SERVICE = "__aucun_service__";

export function NouvelOrdreSortie({
  onSuccess,
  onError,
  userRole,
  initialMaterial,
  initialDemande,
  onDemandePreRemplie
}: NouvelOrdreSortieProps) {
  const {
    materials,
    isLoading: isLoadingMaterials,
    refresh: refreshMaterials
  } = useMaterialsLive();

  const [dateSortie, setDateSortie] = useState<string>(new Date().toISOString().slice(0, 10));
  const [justificatif, setJustificatif] = useState<string>("");
  const [observations, setObservations] = useState<string>("");
  const [directionId, setDirectionId] = useState<string | undefined>(undefined);
  const [serviceId, setServiceId] = useState<string | undefined>(undefined);
  const [beneficiaire, setBeneficiaire] = useState<string>("");
  const [demandeId, setDemandeId] = useState<string>("");
  const [demandesDisponibles, setDemandesDisponibles] = useState<Array<{ documentId: string; reference: string; statut: string }> | null>(null);
  const [lignes, setLignes] = useState<Array<{
    materielId: string | undefined;
    designation: string;
    quantite: number;
    materiel?: MaterialOption;
    observations: string;
  }>>([]);

  // States for directions and services (for filtering)
  const [directions, setDirections] = useState<Array<{id: string; nom: string}>>([]);
  const [services, setServices] = useState<Array<{id: string; nom: string; directionId: string}>>([]);
  const [isLoadingDirections, setIsLoadingDirections] = useState<boolean>(false);
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);
  // Les listes de référence sont encore VIDES au premier rendu : sans ce
  // pavé, le préremplissage depuis une demande s'exécutait trop tôt (les
  // noms de direction/service de la demande ne pouvaient pas être résolus en
  // identifiants) puis était définitivement ignoré.
  const [refsChargees, setRefsChargees] = useState<boolean>(false);

  /** Demande déjà appliquée au formulaire : le préremplissage n'a lieu qu'UNE fois. */
  const demandeAppliquee = useRef<string | null>(null);

  // States for form submission
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize form with initialMaterial if provided
  useEffect(() => {
    if (initialMaterial && lignes.length === 0) {
      setLignes([{
        materielId: initialMaterial.documentId,
        designation: initialMaterial.designation,
        quantite: 1,
        materiel: initialMaterial,
        observations: ""
      }]);
    }
  }, [initialMaterial, lignes.length]);

  // Load directions and services on mount
  useEffect(() => {
    const loadDirectionsAndServices = async () => {
      setIsLoadingDirections(true);
      setIsLoadingServices(true);

      try {
        const directionsData = await fetchDirections();
        const servicesData = await fetchServices();

        // Transform directions data
        setDirections(directionsData.map(dir => ({
          id: dir.documentId,
          nom: dir.nom
        })));

        // Transform services data
        setServices(servicesData.map(serv => ({
          id: serv.documentId,
          nom: serv.nom,
          directionId: serv.directionId
        })));
      } catch (error) {
        console.error("Failed to load directions/services:", error);
        toast.error("Erreur lors du chargement des directions/services");
      } finally {
        setIsLoadingDirections(false);
        setIsLoadingServices(false);
        setRefsChargees(true);
      }
    };

    loadDirectionsAndServices();
  }, []);

  // Charger les demandes au montage pour savoir si le champ doit être actif
  useEffect(() => {
    let ignore = false;
    const loadDemandes = async () => {
      try {
        const list = await fetchDemandesPourLiaison();
        if (!ignore) {
          setDemandesDisponibles(list);
        }
      } catch {
        if (!ignore) {
          setDemandesDisponibles(null);
        }
      }
    };

    loadDemandes();
    return () => {
      ignore = true;
    };
  }, []);

  // ── ÉTAPE 3 : préremplissage à partir d'une demande approuvée ──────────
  // Le dépositaire clique sur « Créer l'ordre de sortie » dans l'écran
  // Décision : l'onglet « Ordres de sortie » s'ouvre et le formulaire se
  // remplit TOUT SEUL avec la demande (mêmes règles que le préremplissage
  // serveur de POST /api/demandes/:id/creer-ordre) :
  //   - pièce justificative = RÉFÉRENCE de la demande ;
  //   - direction et service APPARIÉS par nom sur les listes de référence ;
  //   - lignes = lignes de la demande, quantités APPROUVÉES, fiches de stock
  //     résolues par materielDocumentId ;
  //   - champ « Demande liée » = référence de la demande (le serveur enforce
  //     « une demande, un ordre » à la création).
  // Le préremplissage attend la fin du chargement des listes de référence et
  // du stock : effectué trop tôt, il laisserait direction/service/lignes vides
  // et serait ensuite définitivement ignoré (demandeAppliquee).
  useEffect(() => {
    const demande = initialDemande ?? null;
    const cible = demande?.documentId || null;
    if (!cible || demandeAppliquee.current === cible) return;
    if (!refsChargees || isLoadingDirections || isLoadingServices || isLoadingMaterials) return;

    demandeAppliquee.current = cible;

    const trouverParNom = (
      nom: string | undefined,
      options: Array<{ id: string; nom: string }>
    ) => {
      const attendu = normaliserNom(nom);
      if (!attendu) return undefined;
      return options.find((option) => {
        const candidat = normaliserNom(option.nom);
        if (!candidat) return false;
        return (
          candidat === attendu ||
          attendu.includes(candidat) ||
          candidat.includes(attendu)
        );
      });
    };

    const directionChoisie = trouverParNom(demande!.direction, directions);
    // Le service est d'abord cherché dans la direction appariée (le champ est
    // filtré par direction dans le formulaire) puis, à défaut, dans l'ensemble
    // de l'organigramme : mieux vaut un service juste d'une autre direction
    // qu'un service vide faute de correspondance de nom.
    const servicesCandidats = directionChoisie
      ? services.filter((service) => service.directionId === directionChoisie.id)
      : services;
    const serviceChoisi =
      trouverParNom(demande!.service, servicesCandidats) ||
      trouverParNom(demande!.service, services);

    setDirectionId(directionChoisie?.id);
    setServiceId(serviceChoisi?.id);
    // Pièce justificative = référence de la demande (règle serveur).
    setJustificatif(demande!.reference);
    setDemandeId(demande!.reference);
    // Si ni la direction ni le service de la demande n'ont pu être résolus
    // dans l'organigramme, le bénéficiaire (le demandeur) garantit une
    // destination valide plutôt qu'un blocage silencieux du formulaire.
    if (
      !directionChoisie &&
      !serviceChoisi &&
      demande!.demandeur &&
      demande!.demandeur !== "—"
    ) {
      setBeneficiaire(demande!.demandeur);
    }

    const lignesDemande = (demande!.lignes || []).map((ligne) => {
      const materiel = ligne.materielDocumentId
        ? materials.find((m) => m.documentId === ligne.materielDocumentId)
        : undefined;
      return {
        materielId: materiel?.documentId ?? ligne.materielDocumentId,
        // Désignation CANONIQUE de la fiche résolue (sinon celle de la demande).
        designation: materiel?.designation ?? ligne.materiel ?? "",
        quantite: Math.max(1, Number(ligne.quantite) || 1),
        materiel,
        observations: ""
      };
    });
    setLignes(lignesDemande);

    toast.info("Demande pré-remplie", {
      description: `La demande ${demande!.reference} a été reprise dans le formulaire : vérifiez puis confirmez la création.`
    });

    onDemandePreRemplie?.();
  }, [
    initialDemande,
    refsChargees,
    isLoadingDirections,
    isLoadingServices,
    isLoadingMaterials,
    directions,
    services,
    materials,
    onDemandePreRemplie
  ]);

  // Function to add a new line
  const ajouterLigne = () => {
    setLignes(prev => [
      ...prev,
      {
        materielId: undefined,
        designation: "",
        quantite: 1,
        materiel: undefined,
        observations: ""
      }
    ]);
  };

  // Function to remove a line
  const supprimerLigne = (index: number) => {
    if (lignes.length <= 1) {
      toast.error("Au moins une ligne est requise");
      return;
    }
    setLignes(prev => prev.filter((_, i) => i !== index));
  };

  // Function to handle material selection/change
  const handleMaterielChange = (index: number, field: keyof Omit<typeof lignes[0], "materiel" | "designation" | "quantite" | "observations">, value: any) => {
    setLignes(prev => {
      const newLignes = [...prev];
      const ligne = newLignes[index];

      if (field === "materielId") {
        // When materielId changes, find the material and update designation
        const materielId = value;
        if (materielId) {
          const materiel = materials.find(m => m.documentId === materielId);
          return [
            ...newLignes.slice(0, index),
            {
              ...ligne,
              materielId,
              materiel,
              designation: materiel ? materiel.designation : "",
              quantite: ligne.quantite
            },
            ...newLignes.slice(index + 1)
          ];
        } else {
          return [
            ...newLignes.slice(0, index),
            {
              ...ligne,
              materielId: undefined,
              materiel: undefined,
              designation: "",
              quantite: ligne.quantite
            },
            ...newLignes.slice(index + 1)
          ];
        }
      }

      if (field === "designation") {
        // When designation changes, try to find matching material
        const designation = value;
        if (designation && designation.trim() !== "") {
          const materiel = materials.find(m =>
            m.designation.toLowerCase().includes(designation.toLowerCase())
          );
          return [
            ...newLignes.slice(0, index),
            {
              ...ligne,
              materielId: materiel ? materiel.documentId : undefined,
              materiel,
              designation,
              quantite: ligne.quantite
            },
            ...newLignes.slice(index + 1)
          ];
        } else {
          return [
            ...newLignes.slice(0, index),
            {
              ...ligne,
              materielId: undefined,
              materiel: undefined,
              designation: "",
              quantite: ligne.quantite
            },
            ...newLignes.slice(index + 1)
          ];
        }
      }

      // For other fields, just update the value
      return [
        ...newLignes.slice(0, index),
        {
          ...ligne,
          [field]: value
        },
        ...newLignes.slice(index + 1)
      ];
    });
  };

  // Function to handle quantity change
  const handleQuantiteChange = (index: number, value: string) => {
    const quantite = parseInt(value, 10);
    setLignes(prev => {
      const newLignes = [...prev];
      const ligne = newLignes[index];

      // Validate: must be integer >= 1
      if (Number.isInteger(quantite) && quantite >= 1) {
        return [
          ...newLignes.slice(0, index),
          {
            ...ligne,
            quantite
          },
          ...newLignes.slice(index + 1)
        ];
      }

      // If invalid, keep the previous value (don't update)
      return prev;
    });
  };

  // Calculate available stock for each material.
  // ATTENTION : cet objet doit être MÉMOÏSÉ. Recréé à chaque rendu et utilisé
  // en dépendance d'effet, il déclenchait une boucle infinise
  // rendu → effet → setState → rendu… qui gelait tout l'onglet
  // (les boutons devenaient « non cliquables » car le fil principal était bloqué).
  const stockDisponible = useMemo<Record<string, number>>(() => {
    const stock: Record<string, number> = {};
    materials.forEach(material => {
      if (material.documentId) {
        stock[material.documentId] = material.quantiteStock ?? 0;
      }
    });
    return stock;
  }, [materials]);

  // Validation : DÉRIVÉE du rendu (useMemo), pas un useEffect + setState.
  // Un effet qui mettait à jour un tableau d'erreurs recréé à chaque passe
  // produisait la boucle infinie décrite ci-dessus.
  const validationErrors = useMemo(
    () => validerSortieBrouillon(
      justificatif,
      directionId,
      serviceId,
      beneficiaire,
      lignes,
      stockDisponible
    ).erreurs,
    [justificatif, directionId, serviceId, beneficiaire, lignes, stockDisponible]
  );

  // Calculate estimated total
  const totalEstime = calculerTotalEstime(lignes.map(l => ({
    quantite: l.quantite,
    materiel: l.materiel
  })));

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is depositor
    if (userRole !== "depositaire") {
      onError("Seul le dépositaire peut créer un ordre de sortie");
      return;
    }

    // Check if form is valid
    const { estValide } = validerSortieBrouillon(
      justificatif,
      directionId,
      serviceId,
      beneficiaire,
      lignes,
      stockDisponible
    );

    if (!estValide) {
      return;
    }

    setIsSubmitting(true);

    try {
      // « Demande liée » = facultatif : si le champ est vide (espaces compris),
      // aucune clé demande_id n'est ajoutée au payload.
      let demandeIdResolue: string | undefined = undefined;
      const demandeTapee = (demandeId || "").trim();
      if (demandeTapee) {
        const demandes = demandesDisponibles !== null ? demandesDisponibles : await fetchDemandesPourLiaison();
        if (demandes !== null) {
          const resolution = apparierDemande(demandeTapee, demandes);
          if (!resolution.ok) {
            onError(resolution.message);
            return; // `finally` remet isSubmitting à false, le formulaire n'est PAS vidé
          }
          demandeIdResolue = resolution.documentId;
        } else {
          // Serveur injoignable ou fetch en échec : on transmet la saisie telle quelle
          // et le serveur validera
          demandeIdResolue = demandeTapee;
        }
      }

      // Build payload
      const payload = construirePayloadSortie(
        dateSortie,
        justificatif,
        directionId,
        serviceId,
        beneficiaire,
        demandeIdResolue,
        lignes.map(l => ({
          materielId: l.materielId,
          // Désignation CANONIQUE de la fiche choisie : le serveur résout la
          // ligne par materiel_id, et retombe sur une recherche de désignation
          // EXACTE — envoyer le texte tapé (recherche partielle) provoquait un
          // 400 « Matériel introuvable ».
          designation: l.materiel?.designation || l.designation,
          quantite: l.quantite,
          observations: l.observations
        }))
      );

      // Call API
      // Import dynamically to avoid circular dependency issues
      const { creerSortie } = await import("@/lib/api");
      const sortie = await creerSortie(payload);

      // Success (l'événement sortie-mis-a-jour est émis par le composant parent Distribution)
      onSuccess(sortie.reference);

      // Reset form
      setDateSortie(new Date().toISOString().slice(0, 10));
      setJustificatif("");
      setObservations("");
      setDirectionId(undefined);
      setServiceId(undefined);
      setBeneficiaire("");
      setDemandeId("");
      setLignes([]);

      // Refresh materials to update stock
      await refreshMaterials();

    } catch (error: any) {
      console.error("Error creating sortie:", error);
      let message = "Erreur lors de la création de l'ordre de sortie";

      if (error.response?.data?.error?.message) {
        message = error.response.data.error.message;
      } else if (error.message) {
        message = error.message;
      }

      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user has permission to see this form.
  // Distribution n'affiche ce formulaire qu'au dépositaire ; pour tout autre
  // rôle on ne rend AUCUN message (plus de « Accès réservé » en rouge).
  if (userRole !== "depositaire") {
    return null;
  }

  return (
    <Card className="w-full space-y-4">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          <CardTitle className="text-base font-medium">Nouvel ordre de sortie</CardTitle>
        </div>
        <CardDescription>
          Création d'un ordre de sortie (étape 1 du circuit : dépositaire)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date-sortie">Date de sortie</Label>
          <Input
            id="date-sortie"
            type="date"
            value={dateSortie}
            onChange={(e) => setDateSortie(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Justificatif */}
        <div className="space-y-2">
          <Label htmlFor="justificatif">Pièce justificative *</Label>
          <Textarea
            id="justificatif"
            value={justificatif}
            onChange={(e) => setJustificatif(e.target.value)}
            rows={3}
            placeholder="Numéro de bon de commande, référé décision, etc."
            required
            disabled={isSubmitting}
          />
          {validationErrors.includes("Pièce justificative obligatoire.") && (
            <p className="text-sm text-destructive">Pièce justificative obligatoire.</p>
          )}
        </div>

        {/* Destination */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Destination *</Label>
            <p className="text-sm text-muted-foreground">
              Direction, service et/ou bénéficiaire (au moins un requis)
            </p>
          </div>

          <div className="space-y-4">
            {/* Direction */}
            <div className="space-y-2">
              <Label htmlFor="direction-select">Direction</Label>
              <Select
                id="direction-select"
                value={directionId || AUCUNE_DIRECTION}
                onValueChange={(value) => setDirectionId(value === AUCUNE_DIRECTION ? undefined : value)}
                disabled={isSubmitting || isLoadingDirections}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner une direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUNE_DIRECTION}>Aucune direction</SelectItem>
                  {directions.map(dir => (
                    <SelectItem key={dir.id} value={dir.id}>
                      {dir.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoadingDirections && (
                <p className="text-xs text-muted-foreground italic">Chargement...</p>
              )}
            </div>

            {/* Service */}
            <div className="space-y-2">
              <Label htmlFor="service-select">Service</Label>
              <Select
                id="service-select"
                value={serviceId || AUCUN_SERVICE}
                onValueChange={(value) => setServiceId(value === AUCUN_SERVICE ? undefined : value)}
                disabled={isSubmitting || isLoadingServices}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUN_SERVICE}>Aucun service</SelectItem>
                  {services.map(serv => (
                    <SelectItem
                      key={serv.id}
                      value={serv.id}
                      disabled={!directionId || serv.directionId !== directionId}
                    >
                      {serv.nom} {directionId && serv.directionId !== directionId &&
                        "(direction non sélectionnée)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoadingServices && (
                <p className="text-xs text-muted-foreground italic">Chargement...</p>
              )}
            </div>

            {/* Bénéficiaire */}
            <div className="space-y-2">
              <Label htmlFor="beneficiaire-input">Bénéficiaire</Label>
              <Input
                id="beneficiaire-input"
                value={beneficiaire}
                onChange={(e) => setBeneficiaire(e.target.value)}
                placeholder="Nom et fonction du bénéficiaire"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Validation for destination */}
          {(!directionId && !serviceId && !beneficiaire.trim()) && (
            <p className="text-sm text-destructive mt-2">
              Une destination est obligatoire : direction, service ou bénéficiaire.
            </p>
          )}
        </div>

        {/* Demande liée (facultatif) */}
        <div className="space-y-2">
          <Label htmlFor="ref-demande-sortie">Demande liée (facultatif)</Label>
          <Input
            id="ref-demande-sortie"
            name="ref_demande_sortie"
            autoComplete="off"
            value={demandeId}
            onChange={(e) => setDemandeId(e.target.value)}
            placeholder="Numéro de demande (ex. DEM-2026-001)"
            disabled={isSubmitting || (demandesDisponibles !== null && demandesDisponibles.length === 0)}
          />
          {demandesDisponibles !== null && demandesDisponibles.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Aucune demande enregistrée pour le moment
            </p>
          )}
        </div>

        {/* Lignes de matériel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Lignes de matériel</h3>
            <Button
              variant="outline"
              onClick={ajouterLigne}
              disabled={isSubmitting || lignes.length >= 20}
              size="sm"
            >
              + Ajouter une ligne
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Recherchez un matériel du stock : la ligne n'est créable que si la
            recherche aboutit à une fiche existante
          </p>

          {lignes.map((ligne, index) => (
            <Card key={index} className="border border-border/50">
              <CardContent className="space-y-3 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Ligne {index + 1}</span>
                  <Button
                    variant="ghost"
                    onClick={() => supprimerLigne(index)}
                    disabled={lignes.length <= 1 || isSubmitting}
                    size="sm"
                  >
                    <span className="text-[0.8rem]">−</span>
                  </Button>
                </div>

                {/* Material selection */}
                <div className="space-y-2">
                  <Label>Matériel</Label>
                  <div className="flex gap-2">
                    {/* Le repère « SéLECTIONNÉ » est un FRÈRE du champ, jamais
                        un calque par-dessus. Les classes right-2 / top-1/2 /
                        -translate-y-1/2 / pr-28 N'EXISTENT PAS dans le CSS du
                        projet (src/index.css est un export Tailwind FIGÉ, aucune
                        étape de build Tailwind dans vite.config) : en calque,
                        elles étaient silencieusement ignorées et le repère
                        retombait en haut à GAUCHE du champ, par-dessus le texte
                        (désignation illisible, en double). */}
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        className="flex-1"
                        placeholder="Commencez à taper pour rechercher un matériel..."
                        value={ligne.designation}
                        onChange={(e) => handleMaterielChange(index, "designation", e.target.value)}
                        disabled={isSubmitting}
                      />
                      {ligne.materiel && (
                        <div
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                          aria-hidden="true"
                        >
                          <Checkbox
                            checked={true}
                            disabled
                            className="h-3 w-3"
                          />
                          <span>Sélectionné</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Voir le détail du matériel"
                      disabled={!ligne.materiel || isSubmitting}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  </div>

                  {ligne.designation && !ligne.materiel && (
                    <p className="text-sm text-destructive">
                      Matériel introuvable dans le stock — choisissez une fiche
                      existante (une désignation inconnue est refusée à la création)
                    </p>
                  )}

                  {!ligne.designation.trim() && !ligne.materielId && (
                    <p className="text-sm text-destructive">
                      Matériel requis (sélectionnez dans le stock ou entrez une désignation)
                    </p>
                  )}

                  {/* RÉGRESSION évitée : 5 fiches sur 15 n'ont aucun prix —
                      sélectionnables, elles ne se révélaient qu'au moment de
                      l'envoi par un 400 « Valeur unitaire manquante ». */}
                  {ligne.materiel && !(Number(ligne.materiel.valeurUnitaire) > 0) && (
                    <p className="text-sm text-destructive">
                      Prix manquant sur la fiche : renseignez la valeur unitaire du
                      matériel (Inventaire) — la création serait refusée (montant non calculable)
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label htmlFor={`quantite-${index}`}>Quantité</Label>
                  <Input
                    id={`quantite-${index}`}
                    type="number"
                    min="1"
                    value={ligne.quantite.toString()}
                    onChange={(e) => handleQuantiteChange(index, e.target.value)}
                    disabled={isSubmitting}
                  />
                  {ligne.materiel && ligne.quantite > (stockDisponible[ligne.materiel.documentId] || 0) && (
                    <p className="text-sm text-destructive mt-1">
                      Stock insuffisant: demandé {ligne.quantite}, disponible {stockDisponible[ligne.materiel.documentId] || 0}
                    </p>
                  )}
                </div>

                {/* Line observations */}
                <div className="space-y-2">
                  <Label htmlFor={`observations-${index}`}>Observations (optionnel)</Label>
                  <Textarea
                    id={`observations-${index}`}
                    value={ligne.observations}
                    onChange={(e) => handleMaterielChange(index, "observations", e.target.value)}
                    rows={2}
                    placeholder="État du matériel, remarques particulières..."
                    disabled={isSubmitting}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total estimé</span>
            <span>{totalEstime.toLocaleString()} FCFA</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            À titre indicatif - le serveur calcule le prix final basé sur la valeur unitaire des fiches matériau
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-end gap-2 pt-4">
        {/* Raison bloquante affichée : le bouton est désactivé tant que le
            brouillon est invalide, sans quoi il est impossible de savoir
            pourquoi il l'est. */}
        {validationErrors.length > 0 && (
          <div className="w-full rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              Création impossible en l'état :
            </p>
            <ul className="mt-1 list-inside list-disc text-sm text-destructive">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            // Reset form
            setDateSortie(new Date().toISOString().slice(0, 10));
            setJustificatif("");
            setObservations("");
            setDirectionId(undefined);
            setServiceId(undefined);
            setBeneficiaire("");
            setDemandeId(undefined);
            setLignes([]);
          }}
          disabled={isSubmitting}
        >
          Réinitialiser
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || validationErrors.length > 0}
        >
          {isSubmitting ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="3"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
              </svg>
              Création en cours...
            </>
          ) : (
            <>
              <Truck className="mr-2 h-4 w-4" />
              Créer l'ordre de sortie
            </>
          )}
        </Button>
        </div>
      </CardFooter>
    </Card>
  );
}