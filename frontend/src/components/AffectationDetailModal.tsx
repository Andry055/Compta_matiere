import { useState } from "react";
import {
  X,
  Package,
  CheckCircle2,
  Circle,
  PenTool,
  FileDown,
  FileSpreadsheet,
  Download,
  QrCode as QrCodeIcon,
  History,
  Loader2,
  AlertTriangle,
  Maximize2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { User } from "../App";
import {
  AffectationCleValidation,
  AffectationRecord,
  StockLigne,
  getStatutAffectationAffiche,
  getValidationsAffectation,
  getValidationCount,
  peutValiderAffectation,
  statutAffectationBadge,
  validerAffectation,
} from "../lib/affectations";
import {
  genererPdfAffectation,
  genererExcelAffectation,
  valeurQrAffectation,
} from "../lib/affectationDocuments";

interface AffectationDetailModalProps {
  open: boolean;
  affectation: AffectationRecord | null;
  /** Stock consolidé (pour afficher l'état après validation) */
  stock?: StockLigne[];
  user?: User;
  onChanged?: () => void;
  onClose: () => void;
}

function InfoField({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm text-card-foreground">{value}</div>
    </div>
  );
}

export function AffectationDetailModal({
  open,
  affectation,
  stock = [],
  user,
  onChanged,
  onClose,
}: AffectationDetailModalProps) {
  const [confirmKey, setConfirmKey] = useState<AffectationCleValidation | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [busyDoc, setBusyDoc] = useState<"" | "pdf" | "excel">("");
  const [erreur, setErreur] = useState("");
  const [qrAgrandi, setQrAgrandi] = useState(false);
  // Copie locale mise à jour après chaque signature
  const [locale, setLocale] = useState<AffectationRecord | null>(null);

  if (!open || !affectation) return null;
  const record = locale && locale.reference === affectation.reference ? locale : affectation;

  const validations = getValidationsAffectation(record);
  const nb = getValidationCount(record);
  const statut = getStatutAffectationAffiche(record);
  const validee = record.statut === "Validée" || nb >= 4;
  const qrValue = valeurQrAffectation(record);

  const poserValidation = (key: AffectationCleValidation) => {
    setBusy(true);
    setErreur("");
    try {
      const maj = validerAffectation(record.reference, key, {
        name: user?.name,
        email: user?.email,
        role: user?.role,
      });
      setLocale(maj);
      setConfirmKey(null);
      onChanged?.();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Validation impossible.");
    } finally {
      setBusy(false);
    }
  };

  const telechargerPdf = async (action: "download" | "preview") => {
    setBusyDoc("pdf");
    setErreur("");
    try {
      await genererPdfAffectation(record, action);
    } catch {
      setErreur("Génération du PDF impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  const telechargerExcel = async () => {
    setBusyDoc("excel");
    setErreur("");
    try {
      await genererExcelAffectation(record);
    } catch {
      setErreur("Génération du fichier Excel impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  /** Téléchargement du QR Code en PNG */
  const telechargerQr = () => {
    const svg = document.getElementById(
      `qr-affectation-${record.reference}`
    ) as SVGSVGElement | null;
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
        lien.download = `qr-${record.reference}.png`;
        lien.href = canvas.toDataURL("image/png");
        lien.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const stockSource = stock.find(
    (l) =>
      l.direction === record.direction &&
      l.service === record.serviceSource &&
      l.materiel === record.materiel
  );
  const stockDest = stock.find(
    (l) =>
      l.direction === record.direction &&
      l.service === record.serviceDestinataire &&
      l.materiel === record.materiel
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg text-card-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Affectation <span className="font-mono text-primary">{record.reference}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${statutAffectationBadge(
                  statut
                )}`}
              >
                {statut}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                Validations : {nb} / 4
              </span>
              <span className="text-xs text-muted-foreground">
                {record.materiel} — {record.quantite} unité(s)
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

        {/* Actions documents */}
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-border">
          <button
            onClick={() => telechargerPdf("download")}
            disabled={busyDoc !== ""}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title="Télécharger l'affectation en PDF imprimable"
          >
            {busyDoc === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            PDF
          </button>
          <button
            onClick={() => telechargerPdf("preview")}
            disabled={busyDoc !== ""}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            Voir PDF
          </button>
          <button
            onClick={telechargerExcel}
            disabled={busyDoc !== ""}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Exporter en classeur Excel (.xlsx)"
          >
            {busyDoc === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            Excel
          </button>
        </div>

        <div className="p-6 space-y-6">
          {erreur && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erreur}
            </div>
          )}

          {/* Informations */}
          <div>
            <h4 className="text-sm text-card-foreground mb-3">
              Informations de l'affectation
            </h4>
            <div className="grid gap-4 md:grid-cols-3">
              <InfoField label="Direction" value={record.direction} />
              <InfoField label="Service d'origine" value={record.serviceSource} />
              <InfoField label="Service destinataire" value={record.serviceDestinataire} />
              <InfoField label="Matériel" value={record.materiel} />
              <InfoField label="Référence" value={record.materielReference || "—"} />
              <InfoField label="Quantité" value={record.quantite} />
              <InfoField label="Motif" value={record.motif || "—"} />
              <InfoField
                label="Date"
                value={new Date(`${record.date}T00:00:00`).toLocaleDateString("fr-FR")}
              />
              <InfoField label="Créateur" value={record.createur} />
              {record.observation && (
                <div className="md:col-span-3">
                  <InfoField label="Observation" value={record.observation} />
                </div>
              )}
            </div>
          </div>

          {/* Responsables */}
          <div>
            <h4 className="text-sm text-card-foreground mb-3">Responsables</h4>
            <div className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["Responsable du transfert", record.responsables.responsableTransfert],
                  ["Dépositaire", record.responsables.depositaire],
                  ["Chef de service 1", record.responsables.chefService1],
                  ["Chef de service 2", record.responsables.chefService2],
                ] as Array<[string, string]>
              ).map(([label, nom]) => (
                <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="text-sm text-card-foreground mt-0.5">
                    {nom || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm text-card-foreground">Validation</h4>
              <span className="text-xs font-mono text-muted-foreground">{nb} / 4</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {validations.map((v, idx) => {
                const precedenteSignee =
                  idx === 0 || validations.slice(0, idx).every((p) => p.signed);
                const autorise =
                  !validee &&
                  precedenteSignee &&
                  peutValiderAffectation(
                    { name: user?.name, email: user?.email, role: user?.role },
                    record,
                    v.key
                  );
                return (
                  <div
                    key={v.key}
                    className={`border rounded-lg p-3 ${
                      v.signed
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {v.signed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm text-card-foreground">{v.label}</span>
                    </div>
                    <div
                      className={`text-xs ${
                        v.signed
                          ? "text-green-700 dark:text-green-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {v.signed ? `${idx + 1}/4 signé` : "En attente"}
                    </div>
                    {v.signed && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {v.signataire}
                        <br />
                        {v.date
                          ? new Date(v.date).toLocaleString("fr-FR")
                          : ""}
                      </div>
                    )}
                    {autorise && (
                      <button
                        onClick={() => setConfirmKey(v.key)}
                        disabled={busy}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-xs"
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        Valider
                      </button>
                    )}
                    {!v.signed && !autorise && !validee && !precedenteSignee && (
                      <div className="mt-2 text-[11px] text-muted-foreground">
                        Workflow : la validation précédente est requise.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {validee ? (
              <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>✓ AFFECTATION VALIDÉE (4/4)</strong> — stock mis à jour :
                  −{record.quantite} ({record.serviceSource}) / +
                  {record.quantite} ({record.serviceDestinataire}), total de la
                  Direction inchangé. Affectation verrouillée : plus modifiable
                  sans nouvelle opération.
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <PenTool className="h-4 w-4 shrink-0 mt-0.5" />
                4 validations obligatoires dans l'ordre : Responsable du
                transfert (créateur) → Dépositaire → Chef de service 1 → Chef de
                service 2. Aucune sortie, aucune nouvelle entrée.
              </div>
            )}
          </div>

          {/* Stock après affectation */}
          {validee && (stockSource || stockDest) && (
            <div>
              <h4 className="text-sm text-card-foreground mb-3">
                Stock du service (après affectation)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {record.serviceSource}
                  </div>
                  <div className="text-card-foreground font-mono">
                    {stockSource ? stockSource.quantite : 0} unité(s) restante(s)
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {record.serviceDestinataire}
                  </div>
                  <div className="text-card-foreground font-mono">
                    {stockDest ? stockDest.quantite : 0} unité(s)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historique */}
          <div>
            <h4 className="text-sm text-card-foreground mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Historique
            </h4>
            <ul className="space-y-2">
              {record.historique.map((ev, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    {new Date(`${ev.date}T00:00:00`).toLocaleDateString("fr-FR")}
                  </span>
                  <span className="text-card-foreground">{ev.libelle}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* QR Code */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-border rounded-lg bg-muted/20">
            <div className="p-2 bg-white rounded-lg shrink-0">
              <QRCodeSVG
                id={`qr-affectation-${record.reference}`}
                value={qrValue}
                size={96}
                level="M"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm text-card-foreground flex items-center gap-2">
                <QrCodeIcon className="h-4 w-4 text-primary" />
                QR Code — {record.reference}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Le scan retrouve la référence, la Direction, les services,
                le matériel, la quantité, la date, le statut et l'historique.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  onClick={() => setQrAgrandi(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Afficher QR Code
                </button>
                <button
                  onClick={telechargerQr}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger QR Code
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation de validation */}
        {confirmKey && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30">
                  <PenTool className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base text-card-foreground">
                    Confirmer cette validation ?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    «{" "}
                    {validations.find((v) => v.key === confirmKey)?.label} » au
                    nom de {user?.name}. Action tracée et non modifiable.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmKey(null)}
                  disabled={busy}
                  className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => poserValidation(confirmKey)}
                  disabled={busy}
                  className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR agrandi */}
        {qrAgrandi && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]"
            onClick={() => setQrAgrandi(false)}
          >
            <div
              className="bg-card border border-border rounded-lg p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base text-card-foreground">
                  QR Code — {record.reference}
                </h3>
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
