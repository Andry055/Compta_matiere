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
  Building2,
  Package,
  Users,
  ArrowLeft,
  QrCode as QrCodeIcon,
  Download,
  Printer,
  Maximize2,
  Info,
  Paperclip,
  Circle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { User } from "../App";
import {
  EntreeLigne,
  EntreeAdmin,
  ENTREE_ADMIN_VIDE,
  TYPE_OPERATION_LABELS,
  formatMontant,
  SIGNATURE_ROLE_LABELS,
} from "../lib/movements";
import {
  creerEntree,
  fetchDirections,
  fetchFournisseurs,
  fetchMaterials,
  fetchServices,
  MaterialOption,
  RefOption,
} from "../lib/api";

const ETAPES = [
  { numero: 1, label: "Informations générales", icon: FileText },
  { numero: 2, label: "Fournisseur et documents", icon: Building2 },
  { numero: 3, label: "Matériels", icon: Package },
  { numero: 4, label: "Affectation et validation", icon: Users },
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
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [referencesError, setReferencesError] = useState<string | null>(null);

  // Étape 1 — informations générales
  const [dateEntree, setDateEntree] = useState(new Date().toISOString().slice(0, 10));
  const [typeOperation, setTypeOperation] = useState<EntreeAdmin["typeOperation"]>("");
  const [directionId, setDirectionId] = useState("");
  const [serviceId, setServiceId] = useState("");

  // Étape 2 — fournisseur et documents
  const [fournisseurId, setFournisseurId] = useState("");
  const [numeroFacture, setNumeroFacture] = useState("");
  const [dateFacture, setDateFacture] = useState("");
  const [bonLivraison, setBonLivraison] = useState("");
  const [documents, setDocuments] = useState<DocumentJoint[]>([]);

  // Étape 3 — matériels
  const [lignes, setLignes] = useState<EntreeLigne[]>([ligneVide(0)]);

  // Étape 4 — affectation et validation
  const [depotParService, setDepotParService] = useState("");
  const [chefService1, setChefService1] = useState("");
  const [chefService2, setChefService2] = useState("");

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
        setDirections(directionsData ?? []);
        setServices(servicesData ?? []);
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
  const validerEtape = (): string => {
    if (etape === 1) {
      if (!dateEntree) return "La date d'entrée est obligatoire.";
      if (!typeOperation) return "Veuillez choisir le type d'entrée.";
      if (!directionId) return "Veuillez sélectionner la direction.";
      if (!serviceId) return "Veuillez sélectionner le service.";
    }
    if (etape === 2) {
      if (!fournisseurId) return "Veuillez sélectionner le fournisseur.";
      if (!numeroFacture.trim()) return "Le numéro de facture est obligatoire.";
      if (!dateFacture) return "La date de facture est obligatoire.";
    }
    if (etape === 3) {
      if (lignes.length === 0) return "Au moins un matériel est requis.";
      for (const l of lignes) {
        if (!l.designation.trim()) return "Chaque matériel doit avoir une désignation.";
        if (!(Number(l.quantite) > 0))
          return `Quantité invalide pour « ${l.designation} » : elle doit être supérieure à 0.`;
        if (!(Number(l.prixUnitaire) >= 0))
          return `Prix unitaire invalide pour « ${l.designation} ».`;
      }
    }
    if (etape === 4) {
      if (!depotParService)
        return "Veuillez sélectionner le dépositaire par service.";
      if (!chefService1) return "Veuillez sélectionner le Chef de service 1.";
      if (!chefService2) return "Veuillez sélectionner le Chef de service 2.";
    }
    return "";
  };

  const suivant = () => {
    const err = validerEtape();
    setErreur(err);
    if (!err) setEtape((e) => Math.min(4, e + 1));
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

  /** Envoi : toutes les validations du formulaire sont exigées */
  const envoyer = async () => {
    // Vérifie toutes les étapes avant envoi
    for (let e = 1; e <= 4; e += 1) {
      const sauvegarde = etape;
      setEtape(e);
      const err = validerEtape();
      setEtape(sauvegarde);
      if (err) {
        setErreur(err);
        setEtape(e);
        return;
      }
    }
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
    fournisseur_id: fournisseurId || undefined,
    direction_id: directionId || undefined,
    service_id: serviceId || undefined,
    responsable: user?.name,
    brouillon,
    affectation_depositaire: depotParService || undefined,
    affectation_chef_service_1: chefService1 || undefined,
    affectation_chef_service_2: chefService2 || undefined,
    type_operation: typeOperation || undefined,
    date_facture: dateFacture || undefined,
    bon_livraison: bonLivraison || undefined,
    lignes: lignes
      .filter((l) => brouillon || l.designation.trim())
      .map((l) => ({
        designation: l.designation.trim(),
        espece: l.espece || undefined,
        unite: l.unite || undefined,
        quantite: Number(l.quantite) || 0,
        valeur_unitaire: Number(l.prixUnitaire) || 0,
      })),
  });

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

                {/* Contenu : toujours visible sur desktop, accordéon sur mobile */}
                <div className={`${active ? "block" : "hidden lg:block"} p-4 sm:p-6 pt-0`}>
                  {/* ---------------- ÉTAPE 1 ---------------- */}
                  {etapeDef.numero === 1 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>
                          Référence de l'entrée <span className="text-red-500">*</span>
                        </label>
                        <input
                          className={inputClass}
                          value="Automatique (ENT-AAAA-NNN)"
                          disabled
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Date d'entrée <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          className={inputClass}
                          value={dateEntree}
                          onChange={(e) => setDateEntree(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>
                          Type d'entrée <span className="text-red-500">*</span>
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
                      <div>
                        <label className={labelClass}>
                          Direction <span className="text-red-500">*</span>
                        </label>
                        <select
                          className={inputClass}
                          value={directionId}
                          onChange={(e) => setDirectionId(e.target.value)}
                        >
                          <option value="">Sélectionner une direction</option>
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
                        >
                          <option value="">Sélectionner un service</option>
                          {services.map((s) => (
                            <option key={s.documentId} value={s.documentId}>
                              {s.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 2 ---------------- */}
                  {etapeDef.numero === 2 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
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
                          <label className={labelClass}>
                            N° facture <span className="text-red-500">*</span>
                          </label>
                          <input
                            className={inputClass}
                            placeholder="FAC-2026-001"
                            value={numeroFacture}
                            onChange={(e) => setNumeroFacture(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Date facture <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            className={inputClass}
                            value={dateFacture}
                            onChange={(e) => setDateFacture(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Bon de livraison</label>
                          <input
                            className={inputClass}
                            placeholder="BL-2026-001"
                            value={bonLivraison}
                            onChange={(e) => setBonLivraison(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Pièce justificative */}
                      <div>
                        <label className={labelClass}>Pièce justificative</label>
                        <label className="flex flex-col items-center justify-center gap-2 px-4 py-6 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                          <Paperclip className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-card-foreground">
                            Ajouter une pièce justificative
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PDF, JPG, PNG — taille maximale : 5 Mo
                          </span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => ajouterDocument(e.target.files)}
                          />
                        </label>
                        {documents.length > 0 && (
                          <div className="mt-3 space-y-2">
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
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 3 ---------------- */}
                  {etapeDef.numero === 3 && (
                    <div className="space-y-3">
                      <div className="overflow-x-auto border border-border rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground min-w-[180px]">
                                Désignation
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-28">
                                Catégorie
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-24">
                                Unité
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-20">
                                Quantité
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-32">
                                Prix unitaire
                              </th>
                              <th className="text-left py-2 px-2 text-xs text-muted-foreground w-36">
                                Montant
                              </th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {lignes.map((ligne, index) => (
                              <tr
                                key={index}
                                className="border-b border-border last:border-b-0"
                              >
                                <td className="py-2 px-2">
                                  <input
                                    list="materiaux-nouvelle-entree"
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.designation}
                                    onChange={(e) =>
                                      majLigne(index, { designation: e.target.value })
                                    }
                                    placeholder="Ex. Ordinateur portable HP"
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
                                  <input
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.espece}
                                    onChange={(e) => majLigne(index, { espece: e.target.value })}
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <select
                                    className="w-full px-2 py-1.5 border border-border rounded bg-background text-sm"
                                    value={ligne.unite}
                                    onChange={(e) => majLigne(index, { unite: e.target.value })}
                                  >
                                    {UNITES.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
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
                                <td className="py-2 px-2 text-sm text-card-foreground font-mono whitespace-nowrap">
                                  {formatMontant(ligne.montant)}
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
                        <span className="text-sm text-muted-foreground">TOTAL ESTIMÉ :</span>
                        <span className="text-lg font-semibold text-card-foreground font-mono">
                          {formatMontant(total)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ---------------- ÉTAPE 4 ---------------- */}
                  {etapeDef.numero === 4 && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label className={labelClass}>
                            {SIGNATURE_ROLE_LABELS.depositaire}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={depotParService}
                            onChange={(e) => setDepotParService(e.target.value)}
                          >
                            <option value="">Sélectionner le service</option>
                            {services.map((s) => (
                              <option key={s.documentId} value={s.nom}>
                                {s.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>
                            {SIGNATURE_ROLE_LABELS.chefService1}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={chefService1}
                            onChange={(e) => setChefService1(e.target.value)}
                          >
                            <option value="">Sélectionner</option>
                            {directions.map((d) => (
                              <option key={d.documentId} value={d.nom}>
                                {d.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>
                            {SIGNATURE_ROLE_LABELS.chefService2}{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <select
                            className={inputClass}
                            value={chefService2}
                            onChange={(e) => setChefService2(e.target.value)}
                          >
                            <option value="">Sélectionner</option>
                            {directions.map((d) => (
                              <option key={d.documentId} value={d.nom}>
                                {d.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        L'entrée sera créée avec le statut « En attente » (0/3).
                        Les validations suivent l'ordre :{" "}
                        {SIGNATURE_ROLE_LABELS.depositaire} →{" "}
                        {SIGNATURE_ROLE_LABELS.chefService1} →{" "}
                        {SIGNATURE_ROLE_LABELS.chefService2}. À 3/3, l'entrée
                        est VALIDÉE et verrouillée.
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
          <button
            onClick={envoyer}
            disabled={saving}
            className="px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Envoyer la demande
          </button>
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
