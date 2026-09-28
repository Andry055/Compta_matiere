// ---------------------------------------------------------------------------
// Document « AFFECTATION DE MATÉRIEL » — génération PDF et Excel
//
//  - PDF réel (jsPDF) : en-tête, Direction, service source, service
//    destinataire, matériel, référence, quantité, motif, date, les 4
//    responsables + validations, statut, QR Code et historique.
//  - Excel .xlsx (exceljs) : A4 paysage, cellules fusionnées, bordures,
//    zone de signatures, QR Code — imprimable.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import {
  AffectationRecord,
  getStatutAffectationAffiche,
  getValidationsAffectation,
} from "./affectations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function dateFr(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function dateHeureFr(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return iso;
  }
}

export function valeurQrAffectation(a: AffectationRecord): string {
  return `comptamatiere:affectation:${a.qrToken || a.reference}`;
}

async function genererQrDataUrl(valeur: string): Promise<string> {
  return QRCode.toDataURL(valeur, {
    margin: 1,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

// ---------------------------------------------------------------------------
// PDF (jsPDF) — A4 portrait
// ---------------------------------------------------------------------------

const MARGE = 14;
const LARGEUR = 210 - MARGE * 2;

type ActionPdf = "download" | "preview";

export async function genererPdfAffectation(
  a: AffectationRecord,
  action: ActionPdf = "download"
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const qrDataUrl = await genererQrDataUrl(valeurQrAffectation(a));
  const validations = getValidationsAffectation(a);
  const statut = getStatutAffectationAffiche(a);
  const nb = validations.filter((v) => v.signed).length;

  let cur = 16;

  // ------------------------------------------------------------------ titre
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("COMPTABILITÉ MATIÈRE — GESTION DU PATRIMOINE MATÉRIEL", MARGE, cur);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Référence : ${textePdf(a.reference)}`, 210 - MARGE, cur, {
    align: "right",
  });
  cur += 5;
  doc.text(`Date : ${dateFr(a.date)}`, 210 - MARGE, cur, { align: "right" });
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(MARGE, cur + 2, 210 - MARGE, cur + 2);
  cur += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const titre = "AFFECTATION DE MATÉRIEL";
  doc.text(titre, 105, cur, { align: "center" });
  const wTitre = doc.getTextWidth(titre);
  doc.line(105 - wTitre / 2, cur + 1.6, 105 + wTitre / 2, cur + 1.6);
  cur += 7;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize(
    "Réaffectation interne d'un matériel déjà enregistré entre deux services d'une même Direction : sans sortie, sans nouvelle entrée — seule la destination du matériel est modifiée.",
    170
  );
  doc.text(intro, 105, cur, { align: "center" });
  cur += intro.length * 4.5 + 4;

  // ------------------------------------------------------------------ grille
  const hLigne = 6.5;
  const largeurs = [44, 47, 44, 47];
  const grille: Array<[{ label: string; value: string }, { label: string; value: string }]> = [
    [{ label: "Direction", value: a.direction }, { label: "Date", value: dateFr(a.date) }],
    [{ label: "Service d'origine", value: a.serviceSource }, { label: "Service destinataire", value: a.serviceDestinataire }],
    [{ label: "Matériel", value: a.materiel }, { label: "Référence", value: a.materielReference || "—" }],
    [{ label: "Quantité", value: String(a.quantite) }, { label: "Motif", value: a.motif || "—" }],
    [{ label: "Observation", value: a.observation || "—" }, { label: "Créateur", value: `${a.createur}` }],
  ];
  grille.forEach((pair, index) => {
    const yy = cur + index * hLigne;
    let x = MARGE;
    pair.forEach((cell, cellIndex) => {
      const wLabel = largeurs[cellIndex * 2];
      const wValue = largeurs[cellIndex * 2 + 1];
      doc.setFillColor(241, 245, 249);
      doc.rect(x, yy, wLabel, hLigne, "F");
      doc.setDrawColor(100, 116, 139);
      doc.setLineWidth(0.2);
      doc.rect(x, yy, wLabel, hLigne);
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text(textePdf(cell.label), x + 1.5, yy + 4.3);
      x += wLabel;
      doc.rect(x, yy, wValue, hLigne);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(textePdf(cell.value || "—"), x + 1.5, yy + 4.3, {
        maxWidth: wValue - 3,
      });
      x += wValue;
    });
  });
  cur += grille.length * hLigne + 8;

  // -------------------------------------------------------------- validations
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`VALIDATION — ${nb}/4`, MARGE, cur);
  cur += 5;

  autoTable(doc, {
    head: [["Validation", "Responsable désigné", "Statut", "Signataire", "Date"]],
    body: validations.map((v) => [
      v.label,
      a.responsables[
        v.key === "responsableTransfert"
          ? "responsableTransfert"
          : v.key === "depositaire"
          ? "depositaire"
          : v.key === "chefService1"
          ? "chefService1"
          : "chefService2"
      ] || "—",
      v.signed ? "Signé" : "En attente",
      v.signataire || "—",
      v.signed ? dateHeureFr(v.date) : "—",
    ]),
    startY: cur,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 52 }, 2: { cellWidth: 24 }, 3: { cellWidth: 34 }, 4: { cellWidth: 32 } },
    margin: { left: MARGE, right: MARGE },
  });
  cur =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? cur + 30;
  cur += 8;

  // Zone de signature (4 boîtes)
  const boiteW = (LARGEUR - 12) / 4;
  const boiteH = 30;
  validations.forEach((v, i) => {
    const x = MARGE + i * (boiteW + 4);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.rect(x, cur, boiteW, boiteH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(textePdf(v.label.toUpperCase()), x + 1.5, cur + 4.5, {
      maxWidth: boiteW - 3,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      v.signed ? `Signé le ${dateFr(v.date)}` : "En attente",
      x + 1.5,
      cur + 9.5,
      { maxWidth: boiteW - 3 }
    );
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.2);
    doc.line(x + 3, cur + 24, x + boiteW - 3, cur + 24);
    doc.setFontSize(6);
    doc.text("Signature", x + boiteW / 2, cur + 27.5, { align: "center" });
  });
  cur += boiteH + 8;

  // ------------------------------------------------------ statut + QR + date
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
  doc.rect(MARGE, cur, LARGEUR, 34, "FD");
  doc.addImage(qrDataUrl, "PNG", MARGE + 4, cur + 4, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("STATUT ET IDENTIFICATION", MARGE + 36, cur + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Statut : ${textePdf(statut)} (${nb}/4 validations)`,
    MARGE + 36,
    cur + 13
  );
  doc.text(`Référence : ${textePdf(a.reference)}`, MARGE + 36, cur + 18);
  doc.text(
    `Édité le : ${dateFr(new Date().toISOString())} — ComptaMatière`,
    MARGE + 36,
    cur + 23
  );
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.text(
    "QR Code : le scan identifie l'affectation ; la validation exige un rôle habilité.",
    MARGE + 36,
    cur + 29,
    { maxWidth: LARGEUR - 80 }
  );
  cur += 42;

  // ----------------------------------------------------------- historique
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("HISTORIQUE", MARGE, cur);
  cur += 5;
  doc.setFontSize(7.5);
  for (const ev of a.historique) {
    if (cur > 278) {
      doc.addPage();
      cur = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(dateFr(ev.date), MARGE, cur);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(textePdf(ev.libelle), MARGE + 22, cur, {
      maxWidth: LARGEUR - 22,
    });
    cur += 4.2;
  }

  // ------------------------------------------------------------ pieds page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${a.reference} — AFFECTATION DE MATÉRIEL — page ${p}/${totalPages}`,
      105,
      292,
      { align: "center" }
    );
  }

  if (action === "preview") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(`Affectation_${a.reference.replace(/[^\w-]/g, "")}.pdf`);
  }
}

// ---------------------------------------------------------------------------
// Excel .xlsx (exceljs) — A4 paysage
// ---------------------------------------------------------------------------

const ARGENT_TITRE = "FF1E3A8A";
const ARGENT_HEADER = "FF1F4E79";
const ARGENT_CLAIR = "FFEFF3F8";
const BORDURE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF64748B" } },
  left: { style: "thin", color: { argb: "FF64748B" } },
  bottom: { style: "thin", color: { argb: "FF64748B" } },
  right: { style: "thin", color: { argb: "FF64748B" } },
};

export async function genererExcelAffectation(a: AffectationRecord): Promise<void> {
  const qrBase64 = (await genererQrDataUrl(valeurQrAffectation(a))).replace(
    /^data:image\/png;base64,/,
    ""
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("AFFECTATION", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      horizontalCentered: true,
    },
  });

  const largeurs = [18, 22, 22, 22, 18, 14, 14, 18, 18, 20];
  largeurs.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const appliquerBordures = (plage: string) => {
    const [debut, fin] = plage.split(":");
    const match = /^([A-Z]+)(\d+)$/.exec(debut);
    const matchFin = /^([A-Z]+)(\d+)$/.exec(fin || debut);
    if (!match || !matchFin) return;
    const numCol = (lettre: string) => {
      let n = 0;
      for (const ch of lettre) n = n * 26 + (ch.charCodeAt(0) - 64);
      return n;
    };
    const c1 = numCol(match[1]);
    const c2 = numCol(matchFin[1]);
    const r1 = Number(match[2]);
    const r2 = Number(matchFin[2]);
    for (let c = c1; c <= c2; c += 1) {
      for (let r = r1; r <= r2; r += 1) {
        ws.getCell(`${String.fromCharCode(64 + c)}${r}`).border = BORDURE;
      }
    }
  };

  const fusionner = (
    plage: string,
    valeur: ExcelJS.CellValue,
    style?: Partial<ExcelJS.Style>
  ) => {
    appliquerBordures(plage);
    ws.mergeCells(plage);
    const cell = ws.getCell(plage.split(":")[0]);
    cell.value = valeur;
    cell.alignment = { vertical: "middle", wrapText: true };
    if (style?.font) cell.font = style.font;
    if (style?.alignment)
      cell.alignment = { ...cell.alignment, ...style.alignment };
    if (style?.fill) cell.fill = style.fill;
    return cell;
  };

  let ligne = 1;
  fusionner(
    `A${ligne}:J${ligne}`,
    "COMPTABILITÉ MATIÈRE — GESTION DU PATRIMOINE MATÉRIEL",
    {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_TITRE } },
    }
  );
  ws.getRow(ligne).height = 24;
  ligne += 1;

  fusionner(`A${ligne}:E${ligne}`, `Référence : ${a.reference}`, {
    font: { bold: true, size: 10 },
  });
  fusionner(`F${ligne}:J${ligne}`, `Date : ${dateFr(a.date)}`, {
    font: { bold: true, size: 10 },
    alignment: { horizontal: "right" },
  });
  ws.getRow(ligne).height = 18;
  ligne += 1;

  fusionner(`A${ligne}:J${ligne}`, "AFFECTATION DE MATÉRIEL", {
    font: { bold: true, size: 18, color: { argb: ARGENT_TITRE } },
    alignment: { horizontal: "center" },
  });
  ws.getRow(ligne).height = 30;
  ligne += 1;

  fusionner(
    `A${ligne}:J${ligne}`,
    "Réaffectation interne entre deux services d'une même Direction : pas de sortie, pas de nouvelle entrée — le total de la Direction est inchangé.",
    { font: { italic: true, size: 10 }, alignment: { horizontal: "center" } }
  );
  ws.getRow(ligne).height = 22;
  ligne += 2;

  // ------------------------------------------------------ informations
  const infoLigne = (
    l1: string,
    v1: ExcelJS.CellValue,
    l2: string,
    v2: ExcelJS.CellValue
  ) => {
    const r = ligne;
    fusionner(`A${r}:B${r}`, l1, {
      font: { bold: true, size: 9, color: { argb: "FF334155" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_CLAIR } },
    });
    fusionner(`C${r}:E${r}`, v1, { font: { size: 9 } });
    fusionner(`F${r}:G${r}`, l2, {
      font: { bold: true, size: 9, color: { argb: "FF334155" } },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_CLAIR } },
    });
    fusionner(`H${r}:J${r}`, v2, { font: { size: 9 } });
    ws.getRow(r).height = 17;
    ligne += 1;
  };

  infoLigne("Direction", a.direction, "Date", dateFr(a.date));
  infoLigne("Service d'origine", a.serviceSource, "Service destinataire", a.serviceDestinataire);
  infoLigne("Matériel", a.materiel, "Référence", a.materielReference || "—");
  infoLigne("Quantité", a.quantite, "Motif", a.motif || "—");
  infoLigne("Observation", a.observation || "—", "Créateur", a.createur);
  ligne += 1;

  // ------------------------------------------------------- validations
  fusionner(
    `A${ligne}:J${ligne}`,
    `VALIDATION — ${getValidationsAffectation(a).filter((v) => v.signed).length}/4 — ${getStatutAffectationAffiche(a).toUpperCase()}`,
    {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
    }
  );
  ws.getRow(ligne).height = 20;
  ligne += 1;

  const entetes = ["Validation", "Responsable désigné", "Statut", "Signataire", "Date"];
  const rEntete = ws.getRow(ligne);
  const plagesEntete = [
    ["A", "B"],
    ["C", "D"],
    ["E", "E"],
    ["F", "H"],
    ["I", "J"],
  ];
  entetes.forEach((t, i) => {
    const [debut, fin] = plagesEntete[i];
    fusionner(`${debut}${ligne}:${fin}${ligne}`, t, {
      font: { bold: true, size: 9, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
    });
  });
  void rEntete;
  ws.getRow(ligne).height = 18;
  ligne += 1;

  for (const v of getValidationsAffectation(a)) {
    const responsable = a.responsables[
      v.key === "responsableTransfert"
        ? "responsableTransfert"
        : v.key === "depositaire"
        ? "depositaire"
        : v.key === "chefService1"
        ? "chefService1"
        : "chefService2"
    ] || "—";
    fusionner(`A${ligne}:B${ligne}`, v.label, { font: { size: 9, bold: true } });
    fusionner(`C${ligne}:D${ligne}`, responsable, { font: { size: 9 } });
    fusionner(`E${ligne}:E${ligne}`, v.signed ? "✓ Signé" : "En attente", {
      font: {
        size: 9,
        bold: v.signed,
        color: { argb: v.signed ? "FF15803D" : "FFB45309" },
      },
      alignment: { horizontal: "center" },
    });
    fusionner(`F${ligne}:H${ligne}`, v.signataire || "—", { font: { size: 9 } });
    fusionner(
      `I${ligne}:J${ligne}`,
      v.signed ? dateHeureFr(v.date) : "—",
      { font: { size: 9 } }
    );
    ws.getRow(ligne).height = 17;
    ligne += 1;
  }
  ligne += 1;

  // ---------------------------------------------------------- QR + statut
  const validations = getValidationsAffectation(a);
  const nb = validations.filter((v) => v.signed).length;
  fusionner(
    `A${ligne}:J${ligne}`,
    `QR CODE — ${a.reference} — Statut : ${getStatutAffectationAffiche(a)} (${nb}/4 validations)`,
    {
      font: { bold: true, size: 10, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
    }
  );
  ws.getRow(ligne).height = 20;
  ligne += 1;

  const imageId = wb.addImage({ base64: qrBase64, extension: "png" });
  ws.addImage(imageId, {
    tl: { col: 0.1, row: ligne - 0.1 },
    ext: { width: 110, height: 110 },
  });
  fusionner(
    `B${ligne}:J${ligne}`,
    `Le scan du QR Code identifie l'affectation ${a.reference} (Direction ${a.direction} — ${a.serviceSource} → ${a.serviceDestinataire} — ${a.quantite} unité(s)).\n\nÉdité le ${dateFr(
      new Date().toISOString()
    )} — ComptaMatière`,
    { font: { size: 9 } }
  );
  ws.getRow(ligne).height = 62;
  ligne += 7;

  // --------------------------------------------------------- historique
  fusionner(`A${ligne}:J${ligne}`, "HISTORIQUE", {
    font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
    alignment: { horizontal: "center" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
  });
  ws.getRow(ligne).height = 20;
  ligne += 1;
  for (const ev of a.historique) {
    const row = ws.getRow(ligne);
    for (let c = 1; c <= 10; c += 1) row.getCell(c).border = BORDURE;
    ws.mergeCells(`A${ligne}:B${ligne}`);
    const cellDate = row.getCell(1);
    cellDate.value = dateFr(ev.date);
    cellDate.font = { size: 9, bold: true };
    cellDate.alignment = { vertical: "middle" };
    ws.mergeCells(`C${ligne}:J${ligne}`);
    const cellLib = row.getCell(3);
    cellLib.value = ev.libelle;
    cellLib.font = { size: 9 };
    cellLib.alignment = { vertical: "middle", wrapText: true };
    row.height = 16;
    ligne += 1;
  }

  ws.headerFooter = {
    oddFooter: `&C&"Helvetica"&8 ${a.reference} — Affectation de matériel — Page &P / &N`,
  };
  ws.pageSetup.printArea = `A1:J${ligne}`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Affectation_${a.reference.replace(/[^\w-]/g, "")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
