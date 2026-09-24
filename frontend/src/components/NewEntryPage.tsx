import { useEffect, useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Loader2,
  FileText,
  MapPin,
  Package,
  Truck,
  ClipboardCheck,
  ArrowLeft,
  QrCode as QrCodeIcon,
  Download,
  Printer,
  FileDown,
  FileSpreadsheet,
  Maximize2,
  Info,
  Paperclip,
  Circle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { User } from "../App";
import {
  EntreeLigne,
  EntreeRecord,
  EntreeAdmin,
  ENTREE_ADMIN_VIDE,
  TYPE_OPERATION_LABELS,
  formatMontant,
  SIGNATURE_ROLE_LABELS,
} from "../lib/movements";
import {
  creerEntree,
  fetchDirections,
  fetchEntrees,
  fetchFournisseurs,
  fetchMaterials,
  fetchServices,
  MaterialOption,
  RefOption,
} from "../lib/api";
import { getEntreesTransfert } from "../lib/transfers";
import {
  DIRECTIONS_REPLI,
  SERVICES_REPLI,
  estIdentifiantRepli,
  filtrerServicesParDirection,
  responsablesDuService,
} from "../lib/organigramme";
import {
  construireOrdreEntree,
  genererPdfOrdreEntree,
  genererExcelOrdreEntree,
} from "../lib/ordreDocument";
import { NewTransfertPage } from "./NewTransfertPage";

// Processus métier : DIRECTION → SERVICE → ENTRÉE EN STOCK → VÉRIFICATION →
// VALIDATION PAR LES RESPONSABLES DU SERVICE → STOCK DU SERVICE.
// Aucun « Dépositaire général » : les responsables sont ceux du service.
const ETAPES = [
  { numero: 1, label: "Destination — Direction et Service", icon: MapPin },
  { numero: 2, label: "Informations administratives", icon: FileText },
  { numero: 3, label: "Fournisseur et justificatifs", icon: Truck },
  { numero: 4, label: "Matériels et objets", icon: Package },
  { numero: 5, label: "Informations complémentaires", icon: Info },
  { numero: 6, label: "Vérification", icon: ClipboardCheck },
];

const UNITES = ["Unité", "Pièce", "Lot", "Kg", "Litre", "Mètre", "Boîte"];

interface NewEntryPageProps {
  user?: User;
  onClose: () => void;
  onCreated: (reference: string) => void;
}

const ligneVide = (index: number): EntreeLigne => ({
  numeroOrdre: index + 1,
  designation: "",
  espece: "",
  unite: "Unité",
  quantite: 1,
  prixUnitaire: 0,
  montant: 0,
  nomenclature: "",
  pieceJustificative: "",
  observation: "",
});

interface DocumentJoint {
  nom: string;
  taille: number;
  type: string;
}

export function NewEntryPage({ user, onClose, onCreated }: NewEntryPageProps) {
  const [etape, setEtape] = useState(1);
  const [erreur, setErreur] = useState("");
  const [saving, setSaving] = useState(false);
  const [qrAgrandi, setQrAgrandi] = useState(false);
  const [finalPreview, setFinalPreview] = useState(false);
  const [busyDoc, setBusyDoc] = useState<"" | "pdf" | "excel">("");
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<"stock" | "transfert" | null>(null);
  const [entrees, setEntrees] = useState<EntreeRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchEntrees()
      .then((data) => {
        if (cancelled) return;
        setEntrees([...(data && data.length ? data : []), ...getEntreesTransfert()]);
      })
      .catch(() => {
        if (!cancelled) setEntrees([...getEntreesTransfert()]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Étape 1 — destination (DIRECTION → SERVICE → responsables automatiques)
  const [directionId, setDirectionId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [depotParService, setDepotParService] = useState("");
  const [chefService1, setChefService1] = useState("");
  const [chefService2, setChefService2] = useState("");

  // Étape 2 — informations administratives (modèle « ORDRE D'ENTRÉE »)
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().slice(0, 10));
  const [typeOperation, setTypeOperation] = useState<EntreeAdmin["typeOperation"]>("");
  const [numeroChapitre, setNumeroChapitre] = useState("");
  const [libelleChapitre, setLibelleChapitre] = useState("");
  const [subdivisionChapitre, setSubdivisionChapitre] = useState("");
  const [numeroOrdreJournal, setNumeroOrdreJournal] = useState("");
  const [soa, setSoa] = useState("");

  // Étape 3 — fournisseur et justificatifs
  const [fournisseurId, setFournisseurId] = useState("");
  const [numeroFacture, setNumeroFacture] = useState("");
  const [dateFacture, setDateFacture] = useState("");
  const [bonLivraison, setBonLivraison] = useState("");
  const [dateBonLivraison, setDateBonLivraison] = useState("");
  const [documents, setDocuments] = useState<DocumentJoint[]>([]);

  // Étape 4 — matériels et objets
  const [lignes, setLignes] = useState<EntreeLigne[]>([ligneVide(0)]);

  // Étape 5 — informations complémentaires
  const [observations, setObservations] = useState("");
  const [motifEntree, setMotifEntree] = useState("");

  // Données de référence
  const [fournisseurs, setFournisseurs] = useState<RefOption[]>([]);
  const [directions, setDirections] = useState<RefOption[]>([]);
  const [services, setServices] = useState<RefOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);

  useEffect(() => {
    let cancelled = false;

    const chargerReferences = async () => {
      setLoadingReferences(true);
      setReferencesError(null);

      try {
        const [fournisseursData, directionsData, servicesData, materialsData] = await Promise.all([
          fetchFournisseurs(),
          fetchDirections(),
          fetchServices(),
          fetchMaterials(),
        ]);

        if (cancelled) return;

        setFournisseurs(fournisseursData ?? []);
        // Repli hors ligne : le processus DIRECTION → SERVICE reste utilisable
        setDirections(
          directionsData && directionsData.length ? directionsData : DIRECTIONS_REPLI
        );
        setServices(
          servicesData && servicesData.length ? servicesData : SERVICES_REPLI
        );
        setMaterials(materialsData ?? []);
      } catch (error) {
        console.error("Erreur de chargement des référentiels Nouvelle entrée:", error);
        if (!cancelled) {
          setReferencesError("Impossible de charger les données du formulaire.");
        }
      } finally {
        if (!cancelled) {
          setLoadingReferences(false);
        }
      }
    };

    chargerReferences();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(
    () => lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0),
    [lignes]
  );

  const nomFournisseur = fournisseurs.find((f) => f.documentId === fournisseurId)?.nom || "—";
  const nomDirection = directions.find((d) => d.documentId === directionId)?.nom || "—";
  const nomService = services.find((s) => s.documentId === serviceId)?.nom || "—";

  // -----------------------------------------------------------------------
  // DIRECTION → SERVICE : seuls les services de la direction choisie sont
  // proposés, et les responsables du service sont récupérés automatiquement.
  // -----------------------------------------------------------------------
  const servicesVisibles = filtrerServicesParDirection(services, directionId);
  const directionChoisie = directions.find((d) => d.documentId === directionId);
  const serviceChoisie = services.find((s) => s.documentId === serviceId);

  const changerDirection = (nouvelleDirection: string) => {
    setDirectionId(nouvelleDirection);
    setServiceId("");
    setDepotParService("");
    setChefService1("");
    setChefService2("");
  };

  // Responsables automatiques dès la sélection du Service
  useEffect(() => {
    if (!serviceId) return;
    const svc = services.find((s) => s.documentId === serviceId);
    const dir = directions.find((d) => d.documentId === directionId);
    const responsables = responsablesDuService(svc, dir);
    setDepotParService(responsables.depositaire);
    setChefService1(responsables.chefService1);
    setChefService2(responsables.chefService2);
  }, [serviceId, directionId, services, directions]);

  // Contenu du QR Code : identifiant seul, jamais de données sensibles.
  // La référence définitive est renvoyée par le serveur après création.
  const [referenceCreee, setReferenceCreee] = useState<string | null>(null);
  const qrValue = referenceCreee ? `comptamatiere:entree:${referenceCreee}` : "comptamatiere:entree:apercu";

  const majLigne = (index: number, patch: Partial<EntreeLigne>) => {
    setLignes((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const merged = { ...l, ...patch };
        merged.montant =
          Math.round((Number(merged.quantite) || 0) * (Number(merged.prixUnitaire) || 0) * 100) /
          100;
        return merged;
      })
    );
  };

  const ajouterLigne = () => setLignes((prev) => [...prev, ligneVide(prev.length)]);
  const supprimerLigne = (index: number) =>
    setLignes((prev) =>
      prev.length > 1
        ? prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, numeroOrdre: i + 1 }))
        : prev
    );

  const ajouterDocument = (files: FileList | null) => {
    if (!files) return;
    const nouveaux: DocumentJoint[] = Array.from(files).map((f) => ({
      nom: f.name,
      taille: f.size,
      type: f.type || "application/octet-stream",
    }));
    setDocuments((prev) => [...prev, ...nouveaux]);
  };

  /** Validation étape par étape, messages affichés sous les champs */
  const validerEtape = (numeroEtape = etape): string => {
    if (numeroEtape === 1) {
      if (!directionId) return "Veuillez sélectionner la Direction.";
      if (!serviceId)
        return "Veuillez sélectionner le Service (il dépend de la Direction).";
      if (!depotParService.trim())
        return "Le Dépositaire du service est requis (fiche du service à compléter).";
      if (!chefService1.trim())
        return "Le Chef de service 1 est requis (fiche du service à compléter).";
      if (!chefService2.trim())
        return "Le Chef de service 2 est requis (fiche du service à compléter).";
    }
    if (numeroEtape === 2) {
      if (!dateEntree) return "La date d'entrée est obligatoire.";
      if (!typeOperation) return "Veuillez choisir le type d'opération.";
    }
    if (numeroEtape === 3) {
      if (!fournisseurId) return "Veuillez sélectionner le fournisseur.";
    }
    if (numeroEtape === 4) {
      if (lignes.length === 0) return "Au moins un matériel est requis.";
      for (const l of lignes) {
        if (!l.designation.trim()) return "Chaque matériel doit avoir une désignation.";
        if (!(Number(l.quantite) > 0))
          return `Quantité invalide pour « ${l.designation} » : elle doit être supérieure à 0.`;
        if (!(Number(l.prixUnitaire) >= 0))
          return `Prix unitaire invalide pour « ${l.designation} ».`;
      }
    }
    return "";
  };

  const suivant = () => {
    const err = validerEtape();
    setErreur(err);
    if (!err) setEtape((e) => Math.min(6, e + 1));
  };

  /** Brouillon : enregistrement partiel (validation assouplie côté serveur) */
  const enregistrerBrouillon = async () => {
    setErreur("");
    setSaving(true);
    try {
      await creerEntree(payloadCommun(true));
      onCreated("brouillon");
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: { message?: string } } } };
      setErreur(axiosErr.response?.data?.error?.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const validerToutesLesEtapes = () => {
    for (let e = 1; e <= 6; e += 1) {
      const err = validerEtape(e);
      if (err) {
        setErreur(err);
        setEtape(e);
        return false;
      }
    }
    setErreur("");
    return true;
  };

  const previsualiser = () => {
    if (validerToutesLesEtapes()) setFinalPreview(true);
  };

  /** Envoi : toutes les validations du formulaire sont exigées */
  const envoyer = async () => {
    if (!validerToutesLesEtapes()) return;
    setErreur("");
    setSaving(true);
    try {
      const creee = await creerEntree(payloadCommun(false));
      setReferenceCreee(creee.reference);
      onCreated(creee.reference);
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: { message?: string } } } };
      setErreur(axiosErr.response?.data?.error?.message || "Création impossible : vérifiez que le serveur est démarré.");
    } finally {
      setSaving(false);
    }
  };

  const payloadCommun = (brouillon: boolean) => ({
    date_entree: dateEntree,
    numero_facture: numeroFacture || undefined,
    fournisseur_id:
      fournisseurId && !estIdentifiantRepli(fournisseurId)
        ? fournisseurId
        : undefined,
    direction_id:
      directionId && !estIdentifiantRepli(directionId) ? directionId : undefined,
    service_id:
      serviceId && !estIdentifiantRepli(serviceId) ? serviceId : undefined,
    responsable: user?.name,
    brouillon,
    affectation_depositaire: depotParService || undefined,
    affectation_chef_service_1: chefService1 || undefined,
    affectation_chef_service_2: chefService2 || undefined,
    type_operation: typeOperation || undefined,
    date_facture: dateFacture || undefined,
    bon_livraison: bonLivraison || undefined,
    date_bon_livraison: dateBonLivraison || undefined,
    numero_chapitre: numeroChapitre || undefined,
    libelle_chapitre: libelleChapitre || undefined,
    subdivision_chapitre: subdivisionChapitre || undefined,
    numero_ordre_journal: numeroOrdreJournal || undefined,
    soa: soa || undefined,
    motif_entree: motifEntree || undefined,
    observations: observations || undefined,
    notes: observations || undefined,
    piece_justificative: documents[0]?.nom || numeroFacture || undefined,
    lignes: lignes
      .filter((l) => brouillon || l.designation.trim())
      .map((l, index) => ({
        numero_ordre: index + 1,
        designation: l.designation.trim(),
        reference: l.reference?.trim() || undefined,
        espece: l.espece || undefined,
        unite: l.unite || undefined,
        quantite: Number(l.quantite) || 0,
        valeur_unitaire: Number(l.prixUnitaire) || 0,
        piece_justificative: l.pieceJustificative || numeroFacture || undefined,
        observations: l.observation || undefined,
      })),
  });

  const nomTypeOperation = typeOperation
    ? TYPE_OPERATION_LABELS[typeOperation]
    : "—";
  const dateEntreeFormatee = dateEntree
    ? new Date(`${dateEntree}T00:00:00`).toLocaleDateString("fr-FR")
    : "—";
  const dateFactureFormatee = dateFacture
    ? new Date(`${dateFacture}T00:00:00`).toLocaleDateString("fr-FR")
    : "—";

  const telechargerCsvFinal = () => {
    const headers = [
      "Numero",
      "Designation",
      "Espece",
      "Unite",
      "Quantite",
      "Prix unitaire",
      "Montant",
      "Piece justificative",
    ];
    const csvCell = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const rows = lignes.map((ligne) =>
      [
        ligne.numeroOrdre,
        ligne.designation,
        ligne.espece,
        ligne.unite,
        ligne.quantite,
        ligne.prixUnitaire,
        ligne.montant,
        ligne.pieceJustificative || numeroFacture,
      ]
        .map(csvCell)
        .join(";")
    );
    const content = [headers.map(csvCell).join(";"), ...rows].join("\r\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
    link.download = `${referenceCreee || "ordre-entree"}.csv`;
    link.click();
  };

  /**
   * Brouillon de l'entrée sous forme d'EntreeRecord : sert à pré-remplir
   * l'aperçu de l'Ordre d'entrée et à générer le PDF / le classeur Excel.
   */
  const recordApercu = (): EntreeRecord => ({
    id: referenceCreee || "apercu",
    reference: referenceCreee || "ENT-AAAA-NNN",
    dateEntree,
    materiel:
      lignes
        .filter((l) => l.designation.trim())
        .map((l) => l.designation)
        .join(", ") || "—",
    categorie:
      lignes
        .filter((l) => l.espece.trim())
        .map((l) => l.espece)
        .join(", ") || "—",
    quantite: lignes.reduce((s, l) => s + (Number(l.quantite) || 0), 0),
    fournisseur: nomFournisseur,
    numeroFacture: numeroFacture || "—",
    direction: nomDirection,
    service: nomService,
    statut: "En attente",
    responsable: user?.name || "—",
    documents: documents.map((d) => ({ nom: d.nom, type: d.type })),
    affectations: {
      depositaire: depotParService,
      chefService1,
      chefService2,
    },
    qrToken: referenceCreee || undefined,
    total,
    admin: {
      ...ENTREE_ADMIN_VIDE,
      numeroChapitre,
      libelleChapitre,
      subdivisionChapitre,
      numeroOrdreJournal,
      soa,
      typeOperation,
      dateFacture,
      bonLivraison,
      dateBonLivraison,
      motifEntree,
      observations,
      pieceJustificative: documents[0]?.nom || numeroFacture || "",
      declarationNom: depotParService,
      declarationFonction: "Dépositaire du service",
      declarationDate: dateEntree,
    },
    lignes: lignes.filter((l) => l.designation.trim()),
  });

  /** PDF réel (jsPDF) de l'Ordre d'entrée — pas une capture d'écran */
  const genererPdfFinal = async () => {
    setBusyDoc("pdf");
    setErreur("");
    try {
      await genererPdfOrdreEntree(construireOrdreEntree(recordApercu()));
    } catch {
      setErreur("Génération du PDF impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  /** Classeur .xlsx réel (exceljs) — A4 paysage, bordures, signatures */
  const telechargerExcelFinal = async () => {
    setBusyDoc("excel");
    setErreur("");
    try {
      await genererExcelOrdreEntree(construireOrdreEntree(recordApercu()));
    } catch {
      setErreur("Génération du fichier Excel impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  /** Téléchargement du QR Code en PNG */
  const telechargerQr = () => {
    const svg = document.getElementById("qr-entree") as SVGSVGElement | null;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
        const lien = document.createElement("a");
        lien.download = `qr-${referenceCreee || "entree"}.png`;
        lien.href = canvas.toDataURL("image/png");
        lien.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  /** Impression du QR Code agrandi */
  const imprimerQr = () => {
    const svg = document.getElementById("qr-entree") as SVGSVGElement | null;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const win = window.open("", "_blank", "width=500,height=600");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>QR ${referenceCreee || "entrée"}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif}
      img{width:380px;height:380px}p{font-size:16px;font-weight:bold}</style></head>
      <body><img src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data)))}" />
      <p>${referenceCreee || "Nouvelle entrée"} — ComptaMatière</p>
      <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  if (entryMode === "transfert") {
    return (
      <NewTransfertPage
        user={user}
        entrees={entrees}
        onClose={() => setEntryMode(null)}
        onCreated={onCreated}
      />
    );
  }

  if (entryMode === null) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 pb-24 sm:pb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Entrées
          </button>
          <span>/</span>
          <span className="text-foreground font-medium">Nouvelle entrée</span>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">
              NOUVELLE ENTRÉE
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base mt-1">
              Choisissez le type d'entrée.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setEntryMode("stock")}
            className="group rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div className="text-xl font-semibold text-foreground">Nouvelle entrée en stock</div>
            <p className="mt-2 text-sm text-muted-foreground">Réception d'un nouveau matériel</p>
            <div className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              Sélectionner
            </div>
          </button>

          <button
            type="button"
            onClick={() => setEntryMode("transfert")}
            className="group rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowLeft className="h-6 w-6" />
            </div>
            <div className="text-xl font-semibold text-foreground">Entrée suite à transfert entre Directions</div>
            <p className="mt-2 text-sm text-muted-foreground">Matériel provenant d'une autre Direction</p>
            <div className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
              Sélectionner
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (finalPreview) {
    return (
      <div className="ordre-entree-preview p-3 sm:p-6 space-y-4">
        <div className="ordre-entree-actions flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setFinalPreview(false)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Modifier la demande
            </button>
            <h1 className="mt-3 text-2xl font-semibold text-foreground">Aperçu final</h1>
            <p className="text-sm text-muted-foreground">
              Toutes les conditions sont complètes. Vérifiez l'ordre avant de l'envoyer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={genererPdfFinal} disabled={busyDoc !== ""} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
              {busyDoc === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Générer PDF
            </button>
            <button type="button" onClick={telechargerExcelFinal} disabled={busyDoc !== ""} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
              {busyDoc === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Exporter Excel
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
              <Printer className="h-4 w-4" /> Imprimer
            </button>
            <button type="button" onClick={telechargerCsvFinal} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        {erreur && (
          <div className="ordre-entree-actions rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erreur}
          </div>
        )}

        <article className="ordre-entree-document border border-slate-900 bg-white p-4 text-slate-900 shadow-sm sm:p-8">
          <header className="grid gap-4 border-b-2 border-slate-900 pb-4 text-center text-xs sm:grid-cols-[1fr_auto_1fr] sm:text-left">
            <div>
              <p className="font-semibold">MINISTÈRE DE LA FONCTION PUBLIQUE</p>
              <p>DE LA RÉFORME DE L'ADMINISTRATION</p>
              <p>DU TRAVAIL ET DES LOIS SOCIALES</p>
              <p className="mt-2">Budget général</p>
            </div>
            <div className="self-center font-semibold">MODÈLE N°7</div>
            <div className="sm:text-right">
              <p>Référence : {referenceCreee || "À attribuer"}</p>
              <p>Date : {dateEntreeFormatee}</p>
              <p>Instruction générale du 22 juillet 1955</p>
            </div>
          </header>

          <div className="py-5 text-center">
            <h2 className="text-xl font-bold underline">ORDRE D'ENTRÉE</h2>
            <p className="mt-2 text-sm">MATÉRIEL EN APPROVISIONNEMENT / MATÉRIEL EN SERVICE</p>
            <p className="mt-1 text-sm">Type : {nomTypeOperation}</p>
          </div>

          <div className="grid gap-2 border-y border-slate-900 py-3 text-sm sm:grid-cols-2">
            <p><strong>Direction :</strong> {nomDirection}</p>
            <p><strong>Service :</strong> {nomService}</p>
            <p><strong>Fournisseur :</strong> {nomFournisseur}</p>
            <p><strong>Facture :</strong> {numeroFacture} du {dateFactureFormatee}</p>
            <p><strong>Bon de livraison :</strong> {bonLivraison || "—"}{dateBonLivraison ? ` du ${new Date(`${dateBonLivraison}T00:00:00`).toLocaleDateString("fr-FR")}` : ""}</p>
            <p><strong>Chapitre :</strong> {numeroChapitre || "—"} — {libelleChapitre || "—"} (subdivision {subdivisionChapitre || "—"})</p>
            <p><strong>Journal / SOA :</strong> {numeroOrdreJournal || "—"} / {soa || "—"}</p>
            <p><strong>Dépositaire :</strong> {depotParService || "—"}</p>
            <p><strong>Demandeur :</strong> {user?.name || "—"}</p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100">
                  {[
                    "N°",
                    "Désignation des matières et objets",
                    "Espèce",
                    "Unité",
                    "Quantité",
                    "Prix de l'unité",
                    "Valeur partielle",
                    "Pièce justificative",
                  ].map((heading) => <th key={heading} className="border border-slate-900 px-2 py-2 text-left font-semibold">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.numeroOrdre}>
                    <td className="border border-slate-900 px-2 py-2">{ligne.numeroOrdre}</td>
                    <td className="border border-slate-900 px-2 py-2">{ligne.designation}</td>
                    <td className="border border-slate-900 px-2 py-2">{ligne.espece || "—"}</td>
                    <td className="border border-slate-900 px-2 py-2">{ligne.unite}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right">{ligne.quantite}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right">{formatMontant(ligne.prixUnitaire)}</td>
                    <td className="border border-slate-900 px-2 py-2 text-right">{formatMontant(ligne.montant)}</td>
                    <td className="border border-slate-900 px-2 py-2">{ligne.pieceJustificative || numeroFacture}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={6} className="border border-slate-900 px-2 py-2 text-right">TOTAL</td>
                  <td className="border border-slate-900 px-2 py-2 text-right">{formatMontant(total)}</td>
                  <td className="border border-slate-900" />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-8 text-sm sm:grid-cols-3">
            <div><p className="font-semibold">Le comptable dépositaire</p><p className="mt-1 text-xs">{depotParService || "—"}</p><p className="mt-10 border-t border-slate-900 pt-2">Signature</p></div>
            <div><p className="font-semibold">Chef de service 1</p><p className="mt-1 text-xs">{chefService1 || "—"}</p><p className="mt-10 border-t border-slate-900 pt-2">Signature</p></div>
            <div><p className="font-semibold">Chef de service 2</p><p className="mt-1 text-xs">{chefService2 || "—"}</p><p className="mt-10 border-t border-slate-900 pt-2">Signature</p></div>
          </div>
        </article>

        <div className="ordre-entree-actions flex justify-end gap-2">
          <button type="button" onClick={() => setFinalPreview(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Modifier</button>
          <button type="button" onClick={envoyer} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Confirmer et envoyer
          </button>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-ring focus:border-transparent";
  const labelClass = "block text-xs sm:text-sm text-muted-foreground mb-1.5";

  if (loadingReferences) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mb-3 h-6 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mb-4 h-4 w-full animate-pulse rounded bg-muted/80" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" />
          </div>
        </div>
      </div>
    );
  }

  if (referencesError) {
    return (
      <div className="p-3 sm:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm dark:border-red-800 dark:bg-red-950/30">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl text-red-600 dark:bg-red-900/40 dark:text-red-300">⚠</div>
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">Impossible de charger la page.</h2>
          <p className="mt-2 text-sm text-red-700/80 dark:text-red-300/80">{referencesError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Cartes de validation du processus (résumé)
  const validations = [
    {
      label: SIGNATURE_ROLE_LABELS.depositaire,
      valeur: depotParService || nomService,
      done: false,
    },
    { label: SIGNATURE_ROLE_LABELS.chefService1, valeur: chefService1, done: false },
    { label: SIGNATURE_ROLE_LABELS.chefService2, valeur: chefService2, done: false },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 pb-24 sm:pb-6">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Entrées
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">Nouvelle entrée</span>
      </div>

      {/* Header de page */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-primary/10 rounded-lg flex-shrink-0">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight text-foreground">
            NOUVELLE ENTRÉE
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Enregistrez une nouvelle entrée de matériel et suivez son processus
            de validation.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* --------------------------------------------------------------
            Colonne formulaire (2/3 sur desktop)
        -------------------------------------------------------------- */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {erreur && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              <X className="h-4 w-4 shrink-0 mt-0.5" />
              {erreur}
            </div>
          )}

          {/* Sections numérotées — accordéons sur mobile, cartes sur desktop */}
          {ETAPES.map((etapeDef) => {
            const Icon = etapeDef.icon;
            const active = etape === etapeDef.numero;
            const terminee = etape > etapeDef.numero;
            return (
              <div
                key={etapeDef.numero}
                className={`bg-card border rounded-lg shadow-sm overflow-hidden ${
                  active ? "border-primary/50 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <button
                  onClick={() => setEtape(etapeDef.numero)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
                    active ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0 ${
                      terminee
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {terminee ? <Check className="h-4 w-4" /> : etapeDef.numero}
                  </span>
                  <Icon
                    className={`h-4 w-4 flex-shrink-0 ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm sm:text-base ${
                      active ? "text-card-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {etapeDef.label}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform lg:hidden ${
                      active ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {/* Contenu de l'étape active — assistant en 6 étapes */}
                <div className={`${active ? "block" : "hidden"} p-4 sm:p-6 pt-0`}>
                  {/* ---------------- ÉTAPE 1 — DESTINATION ---------------- */}
                  {etapeDef.numero === 1 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>
                            Direction <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={directionId}
                            onChange={(e) => changerDirection(e.target.value)}
                          >
                            <option value="">Sélectionner une Direction</option>
                            {directions.map((d) => (
                              <option key={d.documentId} value={d.documentId}>
                                {d.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Service <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={serviceId}
                            onChange={(e) => setServiceId(e.target.value)}
                            disabled={!directionId}
                          >
                            <option value="">
                              {directionId
                                ? "Sélectionner un Service"
                                : "Choisissez d'abord une Direction"}
                            </option>
                            {servicesVisibles.map((s) => (
                              <option key={s.documentId} value={s.documentId}>
                                {s.nom}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Seuls les services de la Direction sélectionnée sont
                            proposés.
                          </p>
                        </div>
                      </div>

                      {/* Responsables du service — récupérés automatiquement */}
                      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Responsables du service (automatiques)
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <label className={labelClass}>
                              {SIGNATURE_ROLE_LABELS.depositaire}
                            </label>
                            <input
                              className={inputClass}
                              value={depotParService}
                              onChange={(e) => setDepotParService(e.target.value)}
                              placeholder="Dépositaire du service"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              {SIGNATURE_ROLE_LABELS.chefService1}
                            </label>
                            <input
                              className={inputClass}
                              value={chefService1}
                              onChange={(e) => setChefService1(e.target.value)}
                              placeholder="Chef de service 1"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>
                              {SIGNATURE_ROLE_LABELS.chefService2}
                            </label>
                            <input
                              className={inputClass}
                              value={chefService2}
                              onChange={(e) => setChefService2(e.target.value)}
                              placeholder="Chef de service 2"
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                          Destination du matériel : {nomDirection} / {nomService} —
                          le matériel sera enregistré dans le stock de ce service.
                          Aucun « Dépositaire général » : les responsables sont
                          ceux du service.
                        </p>
                      </div>

                      <div className="flex items-start gap-2 px-4 py-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        Processus : DIRECTION → SERVICE → ENTRÉE EN STOCK DU
                        SERVICE → VÉRIFICATION → VALIDATION PAR LES 3
                        RESPONSABLES DU SERVICE → STOCK DU SERVICE.
                      </div>
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 2 — INFORMATIONS ADMINISTRATIVES ---------------- */}
                  {etapeDef.numero === 2 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Numéro du chapitre</label>
                          <input
                            className={inputClass}
                            placeholder="Ex. 312"
                            value={numeroChapitre}
                            onChange={(e) => setNumeroChapitre(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Libellé du chapitre</label>
                          <input
                            className={inputClass}
                            placeholder="Ex. Équipements informatiques"
                            value={libelleChapitre}
                            onChange={(e) => setLibelleChapitre(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Subdivision du chapitre</label>
                          <input
                            className={inputClass}
                            placeholder="Ex. Matériel de bureau"
                            value={subdivisionChapitre}
                            onChange={(e) => setSubdivisionChapitre(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>N° d'ordre du journal</label>
                          <input
                            className={inputClass}
                            placeholder="Ex. 001"
                            value={numeroOrdreJournal}
                            onChange={(e) => setNumeroOrdreJournal(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            className={inputClass}
                            value={dateEntree}
                            onChange={(e) => setDateEntree(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>SOA</label>
                          <input
                            className={inputClass}
                            placeholder="Ex. SOA-2026-001"
                            value={soa}
                            onChange={(e) => setSoa(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>
                          Type d'opération <span className="text-red-500">*</span>
                        </label>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(TYPE_OPERATION_LABELS).map(([value, label]) => (
                            <label
                              key={value}
                              className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
                                typeOperation === value
                                  ? "border-primary bg-primary/5 text-card-foreground"
                                  : "border-border hover:bg-muted/30"
                              }`}
                            >
                              <input
                                type="radio"
                                name="typeOperation"
                                checked={typeOperation === value}
                                onChange={() => setTypeOperation(value as EntreeAdmin["typeOperation"])}
                                className="accent-primary"
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 px-4 py-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        Référence de l'entrée attribuée automatiquement à
                        l'enregistrement : ENT-AAAA-NNN (visible aussi dans le QR
                        Code).
                      </div>
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 3 — FOURNISSEUR ET JUSTIFICATIFS ---------------- */}
                  {etapeDef.numero === 3 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className={labelClass}>
                            Fournisseur <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={fournisseurId}
                            onChange={(e) => setFournisseurId(e.target.value)}
                          >
                            <option value="">Sélectionner un fournisseur</option>
                            {fournisseurs.map((f) => (
                              <option key={f.documentId} value={f.documentId}>
                                {f.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Numéro de facture</label>
                          <input
                            className={inputClass}
                            placeholder="FAC-2026-034"
                            value={numeroFacture}
                            onChange={(e) => setNumeroFacture(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Date de la facture</label>
                          <input
                            type="date"
                            className={inputClass}
                            value={dateFacture}
                            onChange={(e) => setDateFacture(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Numéro du bon de livraison</label>
                          <input
                            className={inputClass}
                            placeholder="BL-2026-001"
                            value={bonLivraison}
                            onChange={(e) => setBonLivraison(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Date du bon de livraison</label>
                          <input
                            type="date"
                            className={inputClass}
                            value={dateBonLivraison}
                            onChange={(e) => setDateBonLivraison(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className={labelClass}>Pièce justificative</label>
                          <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                            <Paperclip className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-card-foreground">
                              Télécharger la pièce justificative
                            </span>
                            <span className="text-xs text-muted-foreground">
                              PDF, JPG, PNG — 5 Mo max.
                            </span>
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => ajouterDocument(e.target.files)}
                            />
                          </label>
                        </div>
                        <div>
                          <label className={labelClass}>Autres documents</label>
                          <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                            <Paperclip className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm text-card-foreground">
                              Télécharger d'autres documents
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Bon de livraison, PV, marché…
                            </span>
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => ajouterDocument(e.target.files)}
                            />
                          </label>
                        </div>
                      </div>

                      {documents.length > 0 && (
                        <div className="space-y-2">
                          {documents.map((doc, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-muted/20"
                            >
                              <div className="min-w-0">
                                <div className="text-sm text-card-foreground truncate">
                                  {doc.nom}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {(doc.taille / 1024).toFixed(0)} Ko — {doc.type}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  setDocuments((prev) => prev.filter((_, j) => j !== i))
                                }
                                className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                                title="Supprimer le document"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 4 — MATÉRIELS ET OBJETS ---------------- */}
                  {etapeDef.numero === 4 && (
                    <div className="space-y-3">
                      <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="w-full text-sm min-w-[1020px]">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-10">
                                N°
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-36">
                                Référence
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground min-w-[200px]">
                                Désignation des matières et objets
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-44">
                                Espèce / unité
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-20">
                                Quantité
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-28">
                                Prix unitaire
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-32">
                                Valeur
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-32">
                                N° pièce just.
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-36">
                                Observation
                              </th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {lignes.map((ligne, index) => (
                              <tr
                                key={index}
                                className="border-b border-border last:border-b-0 align-top"
                              >
                                <td className="py-2.5 px-2 text-sm text-muted-foreground">
                                  {index + 1}
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.reference ?? ""}
                                    onChange={(e) =>
                                      majLigne(index, { reference: e.target.value })
                                    }
                                    placeholder="MAT-2026-001"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    list="materiaux-nouvelle-entree"
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.designation}
                                    onChange={(e) =>
                                      majLigne(index, { designation: e.target.value })
                                    }
                                    placeholder="Ex. Ordinateur HP ProBook"
                                  />
                                  {index === 0 && (
                                    <datalist id="materiaux-nouvelle-entree">
                                      {materials.map((m) => (
                                        <option key={m.documentId} value={m.designation} />
                                      ))}
                                    </datalist>
                                  )}
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex gap-1">
                                    <input
                                      className="w-1/2 px-2 py-1.5 border border-border rounded bg-background text-sm"
                                      value={ligne.espece}
                                      onChange={(e) => majLigne(index, { espece: e.target.value })}
                                      placeholder="Espèce"
                                    />
                                    <select
                                      className="w-1/2 px-1 py-1.5 border border-border rounded bg-background text-sm"
                                      value={ligne.unite}
                                      onChange={(e) => majLigne(index, { unite: e.target.value })}
                                    >
                                      {UNITES.map((u) => (
                                        <option key={u} value={u}>
                                          {u}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    min={1}
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.quantite}
                                    onChange={(e) =>
                                      majLigne(index, { quantite: Number(e.target.value) })
                                    }
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.prixUnitaire}
                                    onChange={(e) =>
                                      majLigne(index, { prixUnitaire: Number(e.target.value) })
                                    }
                                  />
                                </td>
                                <td className="py-2.5 px-2 text-sm text-card-foreground font-mono whitespace-nowrap">
                                  {formatMontant(ligne.montant)}
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.pieceJustificative}
                                    onChange={(e) =>
                                      majLigne(index, { pieceJustificative: e.target.value })
                                    }
                                    placeholder={numeroFacture || "FAC-2026-034"}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <input
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.observation}
                                    onChange={(e) =>
                                      majLigne(index, { observation: e.target.value })
                                    }
                                    placeholder="—"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <button
                                    onClick={() => supprimerLigne(index)}
                                    disabled={lignes.length === 1}
                                    className="p-1.5 rounded text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                                    title="Supprimer la ligne"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={ajouterLigne}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter un matériel
                      </button>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <span className="text-sm text-muted-foreground">TOTAL :</span>
                        <span className="text-lg font-semibold text-card-foreground font-mono">
                          {formatMontant(total)}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 px-4 py-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        Valeur = Quantité × Prix unitaire — le montant de chaque
                        ligne puis le TOTAL sont calculés automatiquement.
                      </div>
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 5 — INFORMATIONS COMPLÉMENTAIRES ---------------- */}
                  {etapeDef.numero === 5 && (
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Observations</label>
                        <textarea
                          className={`${inputClass} min-h-[90px]`}
                          rows={3}
                          value={observations}
                          onChange={(e) => setObservations(e.target.value)}
                          placeholder="État du matériel, réserves éventuelles, précisions complémentaires…"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Motif de l'entrée</label>
                        <textarea
                          className={`${inputClass} min-h-[70px]`}
                          rows={2}
                          value={motifEntree}
                          onChange={(e) => setMotifEntree(e.target.value)}
                          placeholder="Ex. Acquisition sur facture, don d'entreprise, retour de mise en service, transfert…"
                        />
                      </div>
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 6 — VÉRIFICATION ---------------- */}
                  {etapeDef.numero === 6 && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <h4 className="text-sm font-medium text-card-foreground mb-3">
                          RÉSUMÉ AVANT VALIDATION
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            ["DIRECTION", nomDirection],
                            ["SERVICE", nomService],
                            [SIGNATURE_ROLE_LABELS.depositaire, depotParService],
                            [SIGNATURE_ROLE_LABELS.chefService1, chefService1],
                            [SIGNATURE_ROLE_LABELS.chefService2, chefService2],
                            ["FOURNISSEUR", nomFournisseur],
                            ["FACTURE", numeroFacture || "—"],
                            ["DATE D'ENTRÉE", dateEntreeFormatee],
                          ].map(([label, valeur]) => (
                            <div
                              key={label}
                              className="rounded border border-border bg-background px-3 py-2"
                            >
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                {label}
                              </div>
                              <div className="text-sm text-card-foreground">
                                {valeur || "—"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <h4 className="text-sm font-medium text-card-foreground mb-3">
                          MATÉRIELS
                        </h4>
                        {lignes.filter((l) => l.designation.trim()).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Aucun matériel saisi.
                          </p>
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {lignes
                              .filter((l) => l.designation.trim())
                              .map((l, i) => (
                                <li
                                  key={i}
                                  className="flex justify-between gap-2 text-card-foreground"
                                >
                                  <span className="truncate">
                                    {l.reference ? `${l.reference} — ` : ""}
                                    {l.designation}
                                  </span>
                                  <span className="text-muted-foreground whitespace-nowrap">
                                    {l.quantite} × {formatMontant(l.prixUnitaire)} ={" "}
                                    {formatMontant(l.montant)}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <span className="text-sm font-medium text-card-foreground">
                            MONTANT TOTAL
                          </span>
                          <span className="text-base font-semibold text-card-foreground font-mono">
                            {formatMontant(total)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        L'entrée démarre « En attente » (0/3). Elle n'est VALIDÉE
                        qu'après les 3 validations obligatoires du service :
                        Dépositaire → Chef de service 1 → Chef de service 2. Vous
                        ne pouvez jamais signer à la place d'un responsable.
                      </div>

                      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                        <button
                          onClick={() => setEtape(5)}
                          className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-card-foreground inline-flex items-center justify-center gap-2"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Retour
                        </button>
                        <button
                          onClick={enregistrerBrouillon}
                          disabled={saving}
                          className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-card-foreground inline-flex items-center justify-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Enregistrer comme brouillon
                        </button>
                        <button
                          onClick={previsualiser}
                          disabled={saving}
                          className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-card-foreground inline-flex items-center justify-center gap-2"
                        >
                          <Printer className="h-4 w-4" />
                          Aperçu de l'Ordre d'entrée (PDF / Excel)
                        </button>
                        <button
                          onClick={envoyer}
                          disabled={saving}
                          className="px-4 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          Valider l'entrée
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* --------------------------------------------------------------
            Colonne droite — Résumé + QR Code (sticky sur desktop)
        -------------------------------------------------------------- */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* QR Code */}
            <div className="bg-card border border-border rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-card-foreground flex items-center gap-2 mb-3">
                <QrCodeIcon className="h-4 w-4 text-primary" />
                QR CODE DE L'ENTRÉE
              </h3>
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-white rounded-lg" id="qr-container">
                  <QRCodeSVG
                    id="qr-entree"
                    value={qrValue}
                    size={140}
                    level="M"
                    includeMargin
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {referenceCreee
                    ? `Identifiant : ${referenceCreee}`
                    : "Généré définitivement après création. Le scan identifie l'entrée ; la validation exige une authentification."}
                </p>
                {referenceCreee && (
                  <div className="flex flex-wrap justify-center gap-2 w-full">
                    <button
                      onClick={telechargerQr}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Télécharger
                    </button>
                    <button
                      onClick={imprimerQr}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimer
                    </button>
                    <button
                      onClick={() => setQrAgrandi(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Agrandir
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Résumé */}
            <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
              <div className="p-4">
                <h3 className="text-sm font-medium text-card-foreground mb-2">
                  RÉSUMÉ DE L'ENTRÉE
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Date</span>
                    <span className="text-card-foreground">
                      {new Date(dateEntree).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Fournisseur</span>
                    <span className="text-card-foreground text-right">{nomFournisseur}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-card-foreground text-right">
                      {typeOperation ? TYPE_OPERATION_LABELS[typeOperation] : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Direction / Service</span>
                    <span className="text-card-foreground text-right">
                      {nomDirection} / {nomService}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Dépositaire</span>
                    <span className="text-card-foreground text-right">
                      {depotParService || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Chef de service 1</span>
                    <span className="text-card-foreground text-right">
                      {chefService1 || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Chef de service 2</span>
                    <span className="text-card-foreground text-right">
                      {chefService2 || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-sm font-medium text-card-foreground mb-2">MATÉRIELS</h3>
                {lignes.filter((l) => l.designation.trim()).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun matériel saisi.</p>
                ) : (
                  <ul className="space-y-1">
                    {lignes
                      .filter((l) => l.designation.trim())
                      .map((l, i) => (
                        <li key={i} className="text-sm text-card-foreground flex justify-between gap-2">
                          <span className="truncate">{l.designation}</span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            × {l.quantite}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-card-foreground">MONTANT TOTAL</h3>
                  <span className="text-base font-semibold text-card-foreground font-mono">
                    {formatMontant(total)}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-card-foreground">
                    PROCESSUS DE VALIDATION
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                    0 / 3
                  </span>
                </div>
                <ul className="space-y-2">
                  {validations.map((v) => (
                    <li key={v.label} className="flex items-start gap-2">
                      {v.done ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-card-foreground truncate">{v.label}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {v.valeur || "—"}
                        </div>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 mt-0.5">
                          🟠 En attente
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-2 mt-3 px-3 py-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  L'entrée sera validée après les 3 validations obligatoires,
                  puis verrouillée et le stock mis à jour.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barre d'actions — fixe sur mobile, intégrée sur desktop */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:relative sm:z-auto border-t border-border bg-card/95 backdrop-blur p-3 sm:p-0 sm:bg-transparent sm:border-0 sm:backdrop-blur-none">
        <div className="sm:pl-[calc(18rem+1.5rem)] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-card-foreground"
          >
            Annuler
          </button>
          <button
            onClick={enregistrerBrouillon}
            disabled={saving}
            className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 text-card-foreground inline-flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Enregistrer comme brouillon
          </button>
          {etape > 1 && (
            <button
              onClick={() => setEtape((e) => Math.max(1, e - 1))}
              className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-card-foreground inline-flex items-center justify-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {etape === ETAPES.length ? "Retour" : "Précédent"}
            </button>
          )}
          {etape < ETAPES.length ? (
            <button
              onClick={suivant}
              className="px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
            >
              Suivant
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={envoyer}
              disabled={saving}
              className="px-4 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Valider l'entrée
            </button>
          )}
        </div>
      </div>

      {/* QR agrandi (dialogue) */}
      {qrAgrandi && referenceCreee && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setQrAgrandi(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base text-card-foreground">QR Code — {referenceCreee}</h3>
              <button
                onClick={() => setQrAgrandi(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG value={qrValue} size={240} level="M" includeMargin />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Le scan identifie l'entrée. La validation exige une
              authentification et un rôle habilité.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
