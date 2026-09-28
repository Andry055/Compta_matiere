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
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { User } from "../App";
import {
  TransfertRecord,
  getStatutTransfertAffiche,
  getValidationsSortie,
  getValidationsReception,
  getSignatureSortieCount,
  getSignatureReceptionCount,
  peutSignerSortie,
  peutSignerReception,
  statutTransfertBadge,
  signerSortie,
  signerReception,
  rejeterTransfert,
} from "../lib/transferts";
import {
  genererPdfTransfert,
  genererExcelTransfert,
  valeurQrTransfert,
} from "../lib/transfertDocuments";

interface TransfertDetailModalProps {
  open: boolean;
  transfert: TransfertRecord | null;
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

type CleSignature = "depositaire" | "chefService1" | "chefService2";

export function TransfertDetailModal({
  open,
  transfert,
  user,
  onChanged,
  onClose,
}: TransfertDetailModalProps) {
  const [confirm, setConfirm] = useState<{
    type: "sortie" | "reception";
    key: CleSignature;
  } | null>(null);
  const [confirmRejet, setConfirmRejet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyDoc, setBusyDoc] = useState<"" | "pdf" | "excel">("");
  const [erreur, setErreur] = useState("");
  const [qrAgrandi, setQrAgrandi] = useState(false);
  // Copie locale mise à jour après chaque signature
  const [locale, setLocale] = useState<TransfertRecord | null>(null);

  if (!open || !transfert) return null;
  const record =
    locale && locale.reference === transfert.reference ? locale : transfert;

  const validationsSortie = getValidationsSortie(record);
  const validationsReception = getValidationsReception(record);
  const nbSortie = getSignatureSortieCount(record);
  const nbReception = getSignatureReceptionCount(record);
  const statut = getStatutTransfertAffiche(record);
  const termine = nbSortie >= 3 && nbReception >= 3;
  const rejetee = record.statut === "Rejeté";
  const qrValue = valeurQrTransfert(record);

  const poserSignature = (type: "sortie" | "reception", key: CleSignature) => {
    setBusy(true);
    setErreur("");
    try {
      const maj =
        type === "sortie"
          ? signerSortie(record.reference, key, {
              name: user?.name,
              email: user?.email,
              role: user?.role,
            })
          : signerReception(record.reference, key, {
              name: user?.name,
              email: user?.email,
              role: user?.role,
            });
      setLocale(maj);
      setConfirm(null);
      onChanged?.();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Signature impossible.");
    } finally {
      setBusy(false);
    }
  };

  const rejeter = () => {
    setBusy(true);
    setErreur("");
    try {
      const maj = rejeterTransfert(record.reference, {
        name: user?.name,
        email: user?.email,
        role: user?.role,
      });
      setLocale(maj);
      setConfirmRejet(false);
      onChanged?.();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Rejet impossible.");
    } finally {
      setBusy(false);
    }
  };

  const telechargerPdf = async (action: "download" | "preview") => {
    setBusyDoc("pdf");
    setErreur("");
    try {
      await genererPdfTransfert(record, action);
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
      await genererExcelTransfert(record);
    } catch {
      setErreur("Génération du fichier Excel impossible.");
    } finally {
      setBusyDoc("");
    }
  };

  const telechargerQr = () => {
    const svg = document.getElementById(
      `qr-transfert-${record.reference}`
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

  const carteValidation = (
    v: { key: CleSignature; label: string; signed: boolean; date?: string; signataire?: string },
    idx: number,
    total: 3,
    type: "sortie" | "reception",
    precedentesSignees: boolean
  ) => {
    const autorise =
      !termine &&
      !rejetee &&
      precedentesSignees &&
      (type === "sortie"
        ? peutSignerSortie(
            { name: user?.name, email: user?.email, role: user?.role },
            record,
            v.key
          )
        : peutSignerReception(
            { name: user?.name, email: user?.email, role: user?.role },
            record,
            v.key
          ));
    return (
      <div
        key={`${type}-${v.key}`}
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
            v.signed ? "text-green-700 dark:text-green-400" : "text-muted-foreground"
          }`}
        >
          {v.signed ? `${idx + 1}/${total} signé` : "En attente"}
        </div>
        {v.signed && (
          <div className="text-xs text-muted-foreground mt-1">
            {v.signataire}
            <br />
            {v.date ? new Date(v.date).toLocaleString("fr-FR") : ""}
          </div>
        )}
        {autorise && (
          <button
            onClick={() => setConfirm({ type, key: v.key })}
            disabled={busy}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-xs"
          >
            <PenTool className="h-3.5 w-3.5" />
            Valider
          </button>
        )}
        {!v.signed && !autorise && !termine && !rejetee && !precedentesSignees && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            Workflow : la validation précédente est requise.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg text-card-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Transfert <span className="font-mono text-primary">{record.reference}</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${statutTransfertBadge(
                  statut
                )}`}
              >
                {statut}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                Sortie : {nbSortie}/3
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground">
                Réception : {nbReception}/3
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
            title="Télécharger le transfert en PDF imprimable"
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
          {!termine && !rejetee && nbSortie < 3 && (
            <button
              onClick={() => setConfirmRejet(true)}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              title="Rejeter le transfert (sortie non encore validée)"
            >
              <XCircle className="h-4 w-4" />
              Rejeter
            </button>
          )}
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
              Informations du transfert
            </h4>
            <div className="grid gap-4 md:grid-cols-3">
              <InfoField label="Direction d'origine" value={record.directionOrigine} />
              <InfoField label="Service d'origine" value={record.serviceOrigine} />
              <InfoField label="Matériel" value={record.materiel} />
              <InfoField label="Direction destinataire" value={record.directionDestination} />
              <InfoField label="Service destinataire" value={record.serviceDestination} />
              <InfoField label="Référence matériel" value={record.materielReference || "—"} />
              <InfoField label="Quantité" value={record.quantite} />
              <InfoField label="Motif" value={record.motif || "—"} />
              <InfoField
                label="Date"
                value={new Date(`${record.date}T00:00:00`).toLocaleDateString("fr-FR")}
              />
              <InfoField
                label="Date de sortie"
                value={record.dateSortie ? new Date(record.dateSortie).toLocaleString("fr-FR") : "—"}
              />
              <InfoField
                label="Date de réception"
                value={record.dateReception ? new Date(record.dateReception).toLocaleString("fr-FR") : "—"}
              />
              <InfoField label="Créateur" value={record.createur} />
              {record.observation && (
                <div className="md:col-span-3">
                  <InfoField label="Observation" value={record.observation} />
                </div>
              )}
            </div>
          </div>

          {/* Trajet */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-center">
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Origine
                </div>
                <div className="text-card-foreground font-medium">
                  {record.directionOrigine} / {record.serviceOrigine}
                </div>
                <div className="text-xs text-muted-foreground">
                  −{record.quantite} unité(s) après sortie validée
                </div>
              </div>
              <div className="text-primary">
                <X className="h-4 w-4 rotate-90" />
              </div>
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Destination
                </div>
                <div className="text-card-foreground font-medium">
                  {record.directionDestination} / {record.serviceDestination}
                </div>
                <div className="text-xs text-muted-foreground">
                  +{record.quantite} unité(s) après réception validée
                </div>
              </div>
            </div>
          </div>

          {/* Validation de la SORTIE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm text-card-foreground">
                Validation de la sortie — Direction d'origine
              </h4>
              <span className="text-xs font-mono text-muted-foreground">{nbSortie} / 3</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {validationsSortie.map((v, idx) =>
                carteValidation(
                  v,
                  idx,
                  3,
                  "sortie",
                  idx === 0 || validationsSortie.slice(0, idx).every((p) => p.signed)
                )
              )}
            </div>
            {nbSortie < 3 ? (
              <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <PenTool className="h-4 w-4 shrink-0 mt-0.5" />
                Les 3 responsables de la Direction d'origine valident la SORTIE
                (Dépositaire → Chef de service 1 → Chef de service 2). Le stock
                d'origine est diminué uniquement après la 3ᵉ signature.
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>SORTIE VALIDÉE (3/3) — EN TRANSFERT</strong> : le
                  matériel n'est plus dans le stock de {record.directionOrigine}{" "}
                  / {record.serviceOrigine}.
                </span>
              </div>
            )}
          </div>

          {/* Validation de la RÉCEPTION */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm text-card-foreground">
                Validation de la réception — Direction destinataire
              </h4>
              <span className="text-xs font-mono text-muted-foreground">
                {nbReception} / 3
              </span>
            </div>
            {nbSortie < 3 && (
              <div className="mb-3 text-[11px] text-muted-foreground">
                La réception sera ouverte après la validation complète de la
                sortie (3/3).
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {validationsReception.map((v, idx) =>
                carteValidation(
                  v,
                  idx,
                  3,
                  "reception",
                  idx === 0 ||
                    (validationsReception.slice(0, idx).every((p) => p.signed) &&
                      nbSortie >= 3)
                )
              )}
            </div>
            {termine && (
              <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>✓ TRANSFERT RÉCEPTIONNÉ — ENTRÉE EN STOCK VALIDÉE</strong>{" "}
                  : +{record.quantite} unité(s) dans {record.directionDestination}{" "}
                  / {record.serviceDestination}. Transfert terminé et verrouillé.
                </span>
              </div>
            )}
          </div>

          {/* Historique */}
          <div>
            <h4 className="text-sm text-card-foreground mb-3 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Historique — du départ à l'arrivée
            </h4>
            <ul className="space-y-2">
              {record.historique.map((ev, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    {new Date(ev.date).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
                id={`qr-transfert-${record.reference}`}
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
                Le scan retrouve la référence, les Directions et services,
                le matériel, la quantité, les dates de sortie et de réception,
                le statut, les responsables et l'historique.
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

        {/* Confirmation de signature */}
        {confirm && (
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
                    {confirm.type === "sortie" ? "Sortie" : "Réception"} —{" "}
                    {(confirm.type === "sortie"
                      ? validationsSortie.find((v) => v.key === confirm.key)?.label
                      : validationsReception.find((v) => v.key === confirm.key)?.label) ||
                      ""}{" "}
                    au nom de {user?.name}. Action tracée et non modifiable.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  disabled={busy}
                  className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => poserSignature(confirm.type, confirm.key)}
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

        {/* Confirmation du rejet */}
        {confirmRejet && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg dark:bg-red-900/30">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base text-card-foreground">
                    Rejeter ce transfert ?
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Le transfert {record.reference} sera marqué « Rejeté ». Le
                    stock de la Direction d'origine n'est pas affecté.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmRejet(false)}
                  disabled={busy}
                  className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={rejeter}
                  disabled={busy}
                  className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Rejeter
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
