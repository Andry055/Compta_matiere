import { useEffect, useState } from "react";
import {
  X,
  Eye,
  History,
  FileText,
  Download,
  FileDown,
  FileSpreadsheet,
  Package,
  CheckCircle2,
  Circle,
  PenTool,
  Printer,
  AlertTriangle,
  Loader2,
  QrCode as QrCodeIcon,
} from "lucide-react";
import {
  EntreeRecord,
  SortieRecord,
  getEntreeChain,
  getSortieChain,
  getEntreeTrace,
  getSortieTrace,
  getSignaturesEntree,
  getSignatureCount,
  getStatutEntreeAffiche,
  getOrdreEntreeDocument,
  formatMontant,
  TYPE_OPERATION_LABELS,
  SIGNATURE_ROLE_LABELS,
} from "../lib/movements";
import { QRCodeSVG } from "qrcode.react";
import { getAllDemandes } from "../lib/demandes";
import { User } from "../App";
import { rejeterEntree, signerEntree } from "../lib/api";
import { getHistoriqueAffectations } from "../lib/transfers";
import {
  construireOrdreEntree,
  genererPdfOrdreEntree,
  genererExcelOrdreEntree,
} from "../lib/ordreDocument";

/** Libellé d'une demande associée : référence DEM-AAAA-NNN si connue */
function demandeLabel(id?: number): string {
  if (!id) return "—";
  const dem = getAllDemandes().find((d) => d.id === id);
  return dem ? dem.reference : `Demande n° ${id}`;
}

export type MouvementDetailTab =
  | "details"
  | "historique"
  | "documents"
  | "signatures";

interface MovementDetailModalProps {
  open: boolean;
  type: "entree" | "sortie";
  entree?: EntreeRecord | null;
  sortie?: SortieRecord | null;
  initialTab?: MouvementDetailTab;
  canExport?: boolean;
  user?: User | null;
  onChanged?: () => void;
  onClose: () => void;
}

/** Rôle de signature autorisé pour le profil connecté (l'admin signe tout) */
function roleDeSignature(user?: User | null): "depositaire" | "chef_service_1" | "chef_service_2" | null {
  if (!user) return null;
  if (user.role === "depositaire") return "depositaire";
  if (user.role === "magasinier") return "chef_service_1";
  if (user.role === "logistique") return "chef_service_2";
  if (user.role === "admin") return "depositaire"; // l'admin choisit via le menu
  return null;
}

const TABS: Array<{ key: MouvementDetailTab; label: string; icon: typeof Eye }> = [
  { key: "details", label: "Voir détails", icon: Eye },
  { key: "historique", label: "Voir historique", icon: History },
  { key: "documents", label: "Documents", icon: FileText },
];

function getStatusColor(statut: string) {
  switch (statut) {
    case "Validée":
    case "Vérifiée":
    case "Sortie effectuée":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "Partiellement signée":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "En attente":
    case "Demandée":
    case "En préparation":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    case "Rejetée":
    case "Annulée":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function InfoField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm text-card-foreground">{value}</div>
    </div>
  );
}

export function MovementDetailModal({
  open,
  type,
  entree,
  sortie,
  initialTab = "details",
  canExport = false,
  user,
  onChanged,
  onClose,
}: MovementDetailModalProps) {
  const [tab, setTab] = useState<MouvementDetailTab>(initialTab);
  const [confirmRole, setConfirmRole] = useState<
    "depositaire" | "chef_service_1" | "chef_service_2" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [busyDoc, setBusyDoc] = useState<"" | "pdf" | "excel">("");
  const [erreur, setErreur] = useState("");
  // Force le re-render quand le prop `entree` est muté après signature
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  if (!open || (!entree && !sortie)) return null;

  const record = type === "entree" ? entree : sortie;
  if (!record) return null;

  // Onglet « Signatures » : réservé aux entrées (validation à 3 signatures)
  const tabs: Array<{ key: MouvementDetailTab; label: string; icon: typeof Eye }> =
    type === "entree"
      ? [
          ...TABS,
          { key: "signatures", label: "Signatures", icon: PenTool },
        ]
      : TABS;

  const reference = type === "entree" ? entree!.reference : sortie!.reference;
  const monRole = roleDeSignature(user);
  const nbSigs = type === "entree" ? getSignatureCount(entree!) : 0;

  const poserSignature = async (role: "depositaire" | "chef_service_1" | "chef_service_2") => {
    setBusy(true);
    setErreur("");
    try {
      const updated = await signerEntree(entree!.id, role);
      entree!.signatures = updated.signatures;
      entree!.signataires = updated.signataires;
      entree!.statut = updated.statut;
      entree!.lignes = updated.lignes;
      entree!.total = updated.total;
      setConfirmRole(null);
      forceRender((n) => n + 1);
      onChanged?.();
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: { message?: string } } } };
      setErreur(axiosErr.response?.data?.error?.message || "Signature impossible.");
    } finally {
      setBusy(false);
    }
  };

  const rejeter = async () => {
    setBusy(true);
    setErreur("");
    try {
      const updated = await rejeterEntree(entree!.id);
      entree!.statut = updated.statut;
      forceRender((n) => n + 1);
      onChanged?.();
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { error?: { message?: string } } } };
      setErreur(axiosErr.response?.data?.error?.message || "Rejet impossible.");
    } finally {
      setBusy(false);
    }
  };

  /** Impression du document « Ordre d'entrée » (ouvre une fenêtre dédiée) */
  const imprimerOrdreEntree = () => {
    if (!entree) return;
    const doc = getOrdreEntreeDocument(entree);
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    const lignesHtml = doc.lignes
      .map(
        (l) => `<tr>
          <td>${l.numeroOrdre}</td>
          <td>${l.designation}</td>
          <td>${l.espece}</td>
          <td>${l.unite}</td>
          <td style="text-align:right">${l.quantite}</td>
          <td style="text-align:right">${l.prixUnitaire.toLocaleString("fr-FR")}</td>
          <td style="text-align:right">${l.montant.toLocaleString("fr-FR")}</td>
          <td>${l.nomenclature}</td>
          <td>${l.pieceJustificative}</td>
        </tr>`
      )
      .join("");
    const enteteHtml = doc.entete
      .map(
        ({ label, value }) =>
          `<tr><th>${label}</th><td>${value}</td></tr>`
      )
      .join("");
    const sigCard = (label: string, signe: boolean, nom: string, date?: string) => `
      <div class="sig">
        <div class="sig-title">${signe ? "✓" : "○"} ${label}</div>
        <div>${signe ? "Signé" : "En attente"}</div>
        ${signe ? `<div>Nom : ${nom}</div><div>Date : ${date ? new Date(date).toLocaleDateString("fr-FR") : "—"}</div>` : ""}
      </div>`;
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Ordre d'entrée ${entree.reference}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; margin: 32px; color: #111; }
  h1 { text-align: center; font-size: 18px; letter-spacing: 2px; margin-bottom: 4px; }
  .ref { text-align: center; font-size: 13px; margin-bottom: 20px; color: #444; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th, td { border: 1px solid #333; padding: 4px 6px; }
  th { background: #eee; text-align: left; }
  .entete th { width: 40%; }
  .sigs { display: flex; gap: 12px; margin-top: 24px; }
  .sig { flex: 1; border: 1px solid #333; padding: 10px; font-size: 11px; min-height: 90px; }
  .sig-title { font-weight: bold; margin-bottom: 4px; }
  .decl { font-size: 12px; font-style: italic; border: 1px solid #333; padding: 10px; margin-top: 8px; }
  .total-row td { font-weight: bold; background: #eee; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <h1>ORDRE D'ENTRÉE</h1>
  <div class="ref">${entree.reference} — Comptabilité matière</div>
  <table class="entete">${enteteHtml}</table>
  <table>
    <thead><tr>
      <th>N°</th><th>Désignation des matériels et objets</th><th>Espèce / nature</th>
      <th>Unité</th><th>Quantité</th><th>Prix unitaire</th><th>Montant</th>
      <th>Nomenclature</th><th>N° pièce justificative</th>
    </tr></thead>
    <tbody>
      ${lignesHtml}
      <tr class="total-row"><td colspan="6">TOTAL</td><td style="text-align:right">${doc.total.toLocaleString("fr-FR")}</td><td colspan="2"></td></tr>
    </tbody>
  </table>
  <div class="decl">
    Déclaration de prise en charge — Je soussigné(e), ${doc.declaration.nom}
    (${doc.declaration.fonction}), déclare avoir pris en charge le matériel
    désigné ci-dessus, en date du ${doc.declaration.date}.
  </div>
  <div class="sigs">
    ${sigCard("DÉPOSITAIRE", doc.signatures[0].signed, entree.signataires?.depositaire || doc.declaration.nom, doc.signatures[0].date)}
    ${sigCard("CHEF DE SERVICE 1", doc.signatures[1].signed, entree.signataires?.chefService1 || "", doc.signatures[1].date)}
    ${sigCard("CHEF DE SERVICE 2", doc.signatures[2].signed, entree.signataires?.chefService2 || "", doc.signatures[2].date)}
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`);
    win.document.close();
  };
  const statut = type === "entree" ? entree!.statut : sortie!.statut;
  const chain =
    type === "entree" ? getEntreeChain(entree!) : getSortieChain(sortie!);
  const trace =
    type === "entree" ? getEntreeTrace(entree!) : getSortieTrace(sortie!);
  const documents = type === "entree" ? entree!.documents : sortie!.documents;

  // Historique enrichi : affectations internes / transferts entre Directions
  const traceAffectations =
    type === "entree"
      ? getHistoriqueAffectations(entree!.reference).map((ev) => ({
          date: ev.date,
          utilisateur: "Affectation / transfert",
          action: `${ev.libelle} — ${ev.detail}`,
          materiel: entree!.materiel,
          quantite: entree!.quantite,
          statut: "Traçabilité",
          reference: entree!.reference,
        }))
      : [];
  const traceComplete = [...trace, ...traceAffectations].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  /** PDF réel (jsPDF) de l'Ordre d'entrée : téléchargement ou aperçu */
  const telechargerPdf = async (action: "download" | "preview" = "download") => {
    if (!entree) return;
    setBusyDoc("pdf");
    setErreur("");
    try {
      await genererPdfOrdreEntree(construireOrdreEntree(entree), action);
    } catch {
      setErreur("Génération du PDF impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  /** Classeur .xlsx réel (exceljs) de l'Ordre d'entrée */
  const telechargerExcel = async () => {
    if (!entree) return;
    setBusyDoc("excel");
    setErreur("");
    try {
      await genererExcelOrdreEntree(construireOrdreEntree(entree));
    } catch {
      setErreur("Génération du fichier Excel impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  const handleExport = () => {
    const headers =
      type === "entree"
        ? [
            "Reference",
            "Date",
            "Materiel",
            "Categorie",
            "Quantite",
            "Fournisseur",
            "Facture",
            "Direction",
            "Service",
            "Statut",
            "Responsable",
          ]
        : [
            "Reference",
            "Date",
            "Materiel",
            "Categorie",
            "Quantite",
            "Service demandeur",
            "Direction",
            "Beneficiaire",
            "Responsable",
            "Statut",
          ];
    const ligne =
      type === "entree"
        ? [
            entree!.reference,
            entree!.dateEntree,
            entree!.materiel,
            entree!.categorie,
            String(entree!.quantite),
            entree!.fournisseur,
            entree!.numeroFacture,
            entree!.direction,
            entree!.service,
            entree!.statut,
            entree!.responsable,
          ]
        : [
            sortie!.reference,
            sortie!.dateSortie,
            sortie!.materiel,
            sortie!.categorie,
            String(sortie!.quantite),
            sortie!.serviceDemandeur,
            sortie!.direction,
            sortie!.beneficiaire,
            sortie!.responsable,
            sortie!.statut,
          ];
    const csv =
      "data:text/csv;charset=utf-8," +
      encodeURIComponent([headers.join(","), ligne.join(",")].join("\n"));
    const link = document.createElement("a");
    link.setAttribute("href", csv);
    link.setAttribute("download", `${reference}_${type}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg text-card-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {type === "entree"
                ? "Détails de l'entrée"
                : "Détails de la sortie"}{" "}
              <span className="font-mono text-primary">{reference}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${getStatusColor(
                  type === "entree"
                    ? getStatutEntreeAffiche(entree!)
                    : statut
                )}`}
              >
                {type === "entree" ? getStatutEntreeAffiche(entree!) : statut}
              </span>
              {type === "entree" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                  Signatures : {getSignatureCount(entree!)} / 3
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {record.materiel} - {record.quantite} unité(s)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tab === item.key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          {canExport && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted transition-colors ml-auto"
            >
              <Download className="h-4 w-4" />
              Exporter
            </button>
          )}
          {type === "entree" && (
            <>
              <button
                onClick={() => telechargerPdf("download")}
                disabled={busyDoc !== ""}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                title="Télécharger l'Ordre d'entrée en PDF imprimable"
              >
                {busyDoc === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                Générer PDF
              </button>
              <button
                onClick={telechargerExcel}
                disabled={busyDoc !== ""}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Exporter l'Ordre d'entrée en classeur Excel (.xlsx)"
              >
                {busyDoc === "excel" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Exporter Excel
              </button>
              <button
                onClick={imprimerOrdreEntree}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted transition-colors"
                title="Version imprimable de l'Ordre d'entrée"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </button>
            </>
          )}
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {tab === "details" && (
            <>
              {/* Chaîne de traçabilité */}
              <div>
                <h4 className="text-sm text-card-foreground mb-3">
                  Chaîne de traçabilité
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {chain.map((step, index) => (
                    <div key={step.etape} className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                          step.ok
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "border-border bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        {step.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                        <span className="font-medium">{step.etape}</span>
                        <span className="opacity-70">({step.statut})</span>
                      </div>
                      {index < chain.length - 1 && (
                        <span className="text-muted-foreground">→</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Champs */}
              <div className="grid gap-4 md:grid-cols-3">
                {type === "entree" ? (
                  <>
                    <InfoField label="Référence" value={entree!.reference} />
                    <InfoField
                      label="Date d'entrée"
                      value={new Date(entree!.dateEntree).toLocaleDateString(
                        "fr-FR"
                      )}
                    />
                    <InfoField label="Matériel" value={entree!.materiel} />
                    <InfoField label="Catégorie" value={entree!.categorie} />
                    <InfoField label="Quantité" value={entree!.quantite} />
                    <InfoField label="Fournisseur" value={entree!.fournisseur} />
                    <InfoField label="N° facture" value={entree!.numeroFacture} />
                    <InfoField label="Direction" value={entree!.direction} />
                    <InfoField label="Service" value={entree!.service} />
                    <InfoField
                      label="Statut"
                      value={getStatutEntreeAffiche(entree!)}
                    />
                    <InfoField
                      label="Signatures"
                      value={`${getSignatureCount(entree!)} / 3`}
                    />
                    <InfoField label="Responsable" value={entree!.responsable} />
                    <InfoField
                      label="Dépositaire du service"
                      value={entree!.affectations?.depositaire || "—"}
                    />
                    <InfoField
                      label="Chef de service 1"
                      value={entree!.affectations?.chefService1 || "—"}
                    />
                    <InfoField
                      label="Chef de service 2"
                      value={entree!.affectations?.chefService2 || "—"}
                    />
                  </>
                ) : (
                  <>
                    <InfoField
                      label="Référence de sortie"
                      value={sortie!.reference}
                    />
                    <InfoField
                      label="Date de sortie"
                      value={new Date(sortie!.dateSortie).toLocaleDateString(
                        "fr-FR"
                      )}
                    />
                    <InfoField label="Matériel" value={sortie!.materiel} />
                    <InfoField label="Catégorie" value={sortie!.categorie} />
                    <InfoField label="Quantité" value={sortie!.quantite} />
                    <InfoField
                      label="Service demandeur"
                      value={sortie!.serviceDemandeur}
                    />
                    <InfoField label="Direction" value={sortie!.direction} />
                    <InfoField
                      label="Demande associée"
                      value={demandeLabel(sortie!.demandeId)}
                    />
                    <InfoField label="Bénéficiaire" value={sortie!.beneficiaire} />
                    <InfoField label="Responsable" value={sortie!.responsable} />
                    <InfoField label="Statut" value={sortie!.statut} />
                    <InfoField label="Justificatif" value={sortie!.justificatif} />
                  </>
                )}
              </div>
            </>
          )}

          {tab === "signatures" && type === "entree" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-card-foreground">
                  Validation et signatures
                </h4>
                <span className="text-xs font-mono text-muted-foreground">
                  {getSignatureCount(entree!)} / 3
                </span>
              </div>

              {erreur && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  {erreur}
                </div>
              )}

              {/* QR Code de l'entrée (identification, sans données sensibles) */}
              {entree!.qrToken && (
                <div className="flex items-center gap-4 p-4 border border-border rounded-lg bg-muted/20">
                  <div className="p-2 bg-white rounded-lg shrink-0">
                    <QRCodeSVG
                      value={`comptamatiere:entree:${entree!.qrToken}`}
                      size={80}
                      level="M"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm text-card-foreground flex items-center gap-2">
                      <QrCodeIcon className="h-4 w-4 text-primary" />
                      QR Code de l'entrée
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Le scan identifie l'entrée et retrouve sa fiche. La
                      validation exige une authentification avec un rôle
                      habilité — le scan seul ne valide jamais.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {getSignaturesEntree(entree!).map((signature, idx) => {
                  const signataireNom =
                    entree!.signataires?.[
                      signature.key === "depositaire"
                        ? "depositaire"
                        : signature.key === "chefService1"
                        ? "chefService1"
                        : "chefService2"
                    ];
                  const roleAttendant =
                    signature.key === "depositaire"
                      ? "depositaire"
                      : signature.key === "chefService1"
                      ? "chef_service_1"
                      : "chef_service_2";
                  // Le bouton n'est actif que pour le rôle habilité ET non déjà signé
                  const peutSigner =
                    !!monRole &&
                    !signature.signed &&
                    entree!.statut !== "Rejetée" &&
                    (user?.role === "admin"
                      ? true
                      : monRole === roleAttendant);
                  // Ordre du workflow : les étapes précédentes doivent être signées
                  const precedenteSignee =
                    idx === 0 ||
                    getSignaturesEntree(entree!)
                      .slice(0, idx)
                      .every((s) => s.signed);
                  return (
                    <div
                      key={signature.key}
                      className={`border rounded-lg p-4 ${
                        signature.signed
                          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {signature.signed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm text-card-foreground">
                          {signature.label}
                        </span>
                      </div>
                      <div
                        className={`text-xs ${
                          signature.signed
                            ? "text-green-700 dark:text-green-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {signature.signed ? "Signé" : "En attente"}
                      </div>
                      {signature.signed && (
                        <>
                          <div className="text-xs text-muted-foreground mt-1">
                            Signé par : {signataireNom || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Date :{" "}
                            {signature.date
                              ? new Date(signature.date).toLocaleDateString("fr-FR")
                              : "—"}{" "}
                            {signature.date
                              ? new Date(signature.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                              : ""}
                          </div>
                        </>
                      )}
                      {peutSigner && precedenteSignee && (
                        <button
                          onClick={() => setConfirmRole(roleAttendant)}
                          disabled={busy}
                          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-xs"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                          Signer l'entrée
                        </button>
                      )}
                      {peutSigner && !precedenteSignee && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Workflow : la signature précédente est requise d'abord.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {entree!.statut === "Rejetée" ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Cette entrée a été rejetée : les signatures sont bloquées.
                </div>
              ) : nbSigs === 3 ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  🟢 ENTRÉE VALIDÉE — 3/3 signatures réunies, matériel
                  enregistré au stock, traçabilité complète.
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <PenTool className="h-4 w-4" />
                  L'entrée n'est validée que lorsque les 3 signatures sont
                  réunies (3/3). Ordre : Dépositaire → Chef de service 1 →
                  Chef de service 2. Une signature enregistrée n'est jamais
                  modifiable.
                </div>
              )}

              {(user?.role === "admin" || user?.role === "depositaire") &&
                entree!.statut !== "Rejetée" &&
                entree!.statut !== "Validée" && (
                  <div className="flex justify-end">
                    <button
                      onClick={rejeter}
                      disabled={busy}
                      className="inline-flex items-center gap-2 px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors text-xs"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Rejeter l'entrée
                    </button>
                  </div>
                )}

              {/* Confirmation avant signature (traçabilité) */}
              {confirmRole && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
                  <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
                        <PenTool className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base text-card-foreground">
                          Confirmez-vous la validation de cette entrée ?
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Signature «{" "}
                          {confirmRole.replace(/_/g, " ")}
                          » au nom de {user?.name}. Action tracée et non
                          modifiable.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirmRole(null)}
                        disabled={busy}
                        className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => poserSignature(confirmRole)}
                        disabled={busy}
                        className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Confirmer et signer
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "historique" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Date
                    </th>
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Utilisateur
                    </th>
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Action
                    </th>
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Matériel
                    </th>
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Qté
                    </th>
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Statut
                    </th>
                    <th className="text-left py-2 px-3 text-sm text-muted-foreground">
                      Référence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {traceComplete.map((event, index) => (
                    <tr
                      key={index}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2 px-3 text-sm text-card-foreground">
                        {new Date(event.date).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-2 px-3 text-sm text-card-foreground">
                        {event.utilisateur}
                      </td>
                      <td className="py-2 px-3 text-sm text-card-foreground">
                        {event.action}
                      </td>
                      <td className="py-2 px-3 text-sm text-card-foreground max-w-[180px] truncate">
                        {event.materiel}
                      </td>
                      <td className="py-2 px-3 text-sm text-card-foreground">
                        {event.quantite}
                      </td>
                      <td className="py-2 px-3 text-sm">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                            event.statut
                          )}`}
                        >
                          {event.statut}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm font-mono text-card-foreground">
                        {event.reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "documents" && (
            <div className="space-y-3">
              {documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>Aucun document joint à ce mouvement.</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.nom}
                    className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <div className="text-sm text-card-foreground font-mono">
                          {doc.nom}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {doc.type}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Consulter
                    </span>
                  </div>
                ))
              )}

              {type === "entree" && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => telechargerPdf("preview")}
                    disabled={busyDoc !== ""}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    {busyDoc === "pdf" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    Voir PDF
                  </button>
                  <button
                    onClick={() => telechargerPdf("download")}
                    disabled={busyDoc !== ""}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger PDF
                  </button>
                  <button
                    onClick={telechargerExcel}
                    disabled={busyDoc !== ""}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Exporter Excel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
