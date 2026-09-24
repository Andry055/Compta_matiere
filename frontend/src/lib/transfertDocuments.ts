// ---------------------------------------------------------------------------
// Document « TRANSFERT DE MATÉRIEL ENTRE DIRECTIONS » — PDF, Excel, QR Code
//
//  - PDF réel (jsPDF) : origine, destination, matériel, quantité, motif,
//    responsables + signatures (sortie 3/3, réception 3/3), statut, QR Code
//    et historique complet (le matériel est suivi de son départ à son arrivée).
//  - Excel .xlsx (exceljs) : A4 paysage, cellules fusionnées, bordures,
//    zone de signatures, QR Code — imprimable.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import {
  TransfertRecord,
  getStatutTransfertAffiche,
  getValidationsSortie,
  getValidationsReception,
  getSignatureSortieCount,
  getSignatureReceptionCount,
} from "./transferts";

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

export function valeurQrTransfert(t: TransfertRecord): string {
  return `comptamatiere:transfert:${t.qrToken || t.reference}`;
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

export async function genererPdfTransfert(
  t: TransfertRecord,
  action: ActionPdf = "download"
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const qrDataUrl = await genererQrDataUrl(valeurQrTransfert(t));
  const validationsSortie = getValidationsSortie(t);
  const validationsReception = getValidationsReception(t);
  const statut = getStatutTransfertAffiche(t);
  const nbSortie = getSignatureSortieCount(t);
  const nbReception = getSignatureReceptionCount(t);

  let cur = 16;

  // ------------------------------------------------------------------ titre
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("COMPTABILITÉ MATIÈRE — GESTION DU PATRIMOINE MATÉRIEL", MARGE, cur);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Référence : ${textePdf(t.reference)}`, 210 - MARGE, cur, {
    align: "right",
  });
  cur += 5;
  doc.text(`Date : ${dateFr(t.date)}`, 210 - MARGE, cur, { align: "right" });
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(MARGE, cur + 2, 210 - MARGE, cur + 2);
  cur += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const titre = "TRANSFERT DE MATÉRIEL ENTRE DIRECTIONS";
  doc.text(titre, 105, cur, { align: "center" });
  const wTitre = doc.getTextWidth(titre);
  doc.line(105 - wTitre / 2, cur + 1.6, 105 + wTitre / 2, cur + 1.6);
  cur += 7;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize(
    "Déplacement réel d'un matériel d'une Direction vers une autre : SORTIE du stock de la Direction d'origine, TRANSFERT, puis ENTRÉE dans le stock de la Direction destinataire après validation de la réception.",
    170
  );
  doc.text(intro, 105, cur, { align: "center" });
  cur += intro.length * 4.5 + 4;

  // ------------------------------------------------------------------ grille
  const hLigne = 6.5;
  const largeurs = [44, 47, 44, 47];
  const grille: Array<
    [{ label: string; value: string }, { label: string; value: string }]
  > = [
    [
      { label: "Direction d'origine", value: t.directionOrigine },
      { label: "Direction destinataire", value: t.directionDestination },
    ],
    [
      { label: "Service d'origine", value: t.serviceOrigine },
      { label: "Service destinataire", value: t.serviceDestination },
    ],
    [
      { label: "Matériel", value: t.materiel },
      { label: "Référence", value: t.materielReference || "—" },
    ],
    [
      { label: "Quantité", value: String(t.quantite) },
      { label: "Motif", value: t.motif || "—" },
    ],
    [
      { label: "Date sortie", value: t.dateSortie ? dateHeureFr(t.dateSortie) : "—" },
      { label: "Date réception", value: t.dateReception ? dateHeureFr(t.dateReception) : "—" },
    ],
    [
      { label: "Observation", value: t.observation || "—" },
      { label: "Créateur", value: `${t.createur}` },
    ],
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

  // ------------------------------------------------- signatures de SORTIE
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`VALIDATION DE LA SORTIE — Direction d'origine (${nbSortie}/3)`, MARGE, cur);
  cur += 5;

  autoTable(doc, {
    head: [["Validation", "Responsable désigné", "Statut", "Signataire", "Date"]],
    body: validationsSortie.map((v) => [
      v.label,
      t.responsablesOrigine[v.key] || "—",
      v.signed ? "Signé" : "En attente",
      v.signataire || "—",
      v.signed ? dateHeureFr(v.date) : "—",
    ]),
    startY: cur,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 48 }, 2: { cellWidth: 22 }, 3: { cellWidth: 32 }, 4: { cellWidth: 36 } },
    margin: { left: MARGE, right: MARGE },
  });
  cur =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? cur + 30;
  cur += 8;

  // ------------------------------------------------ signatures de RÉCEPTION
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `VALIDATION DE LA RÉCEPTION — Direction destinataire (${nbReception}/3)`,
    MARGE,
    cur
  );
  cur += 5;

  autoTable(doc, {
    head: [["Validation", "Responsable désigné", "Statut", "Signataire", "Date"]],
    body: validationsReception.map((v) => [
      v.label,
      t.responsablesDestination[v.key] || "—",
      v.signed ? "Signé" : "En attente",
      v.signataire || "—",
      v.signed ? dateHeureFr(v.date) : "—",
    ]),
    startY: cur,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [21, 128, 61], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 48 }, 2: { cellWidth: 22 }, 3: { cellWidth: 32 }, 4: { cellWidth: 36 } },
    margin: { left: MARGE, right: MARGE },
  });
  cur =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? cur + 30;
  cur += 8;

  if (cur > 220) {
    doc.addPage();
    cur = 20;
  }

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
    `Statut : ${textePdf(statut)} — sortie ${nbSortie}/3, réception ${nbReception}/3`,
    MARGE + 36,
    cur + 13
  );
  doc.text(`Référence : ${textePdf(t.reference)}`, MARGE + 36, cur + 18);
  doc.text(
    `Édité le : ${dateFr(new Date().toISOString())} — ComptaMatière`,
    MARGE + 36,
    cur + 23
  );
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.text(
    "QR Code : le scan identifie le transfert ; la validation exige un rôle habilité.",
    MARGE + 36,
    cur + 29,
    { maxWidth: LARGEUR - 80 }
  );
  cur += 42;

  // ----------------------------------------------------------- historique
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("HISTORIQUE — du départ à l'arrivée", MARGE, cur);
  cur += 5;
  doc.setFontSize(7.5);
  for (const ev of t.historique) {
    if (cur > 278) {
      doc.addPage();
      cur = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(dateHeureFr(ev.date), MARGE, cur);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(textePdf(ev.libelle), MARGE + 34, cur, {
      maxWidth: LARGEUR - 34,
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
      `${t.reference} — TRANSFERT ENTRE DIRECTIONS — page ${p}/${totalPages}`,
      105,
      292,
      { align: "center" }
    );
  }

  if (action === "preview") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(`Transfert_${t.reference.replace(/[^\w-]/g, "")}.pdf`);
  }
}

// ---------------------------------------------------------------------------
// Excel .xlsx (exceljs) — A4 paysage
// ---------------------------------------------------------------------------

const ARGENT_TITRE = "FF1E3A8A";
const ARGENT_HEADER = "FF1F4E79";
const ARGENT_HEADER_RECEPTION = "FF15803D";
const ARGENT_CLAIR = "FFEFF3F8";
const BORDURE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF64748B" } },
  left: { style: "thin", color: { argb: "FF64748B" } },
  bottom: { style: "thin", color: { argb: "FF64748B" } },
  right: { style: "thin", color: { argb: "FF64748B" } },
};

export async function genererExcelTransfert(t: TransfertRecord): Promise<void> {
  const qrBase64 = (await genererQrDataUrl(valeurQrTransfert(t))).replace(
    /^data:image\/png;base64,/,
    ""
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("TRANSFERT", {
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

  fusionner(`A${ligne}:E${ligne}`, `Référence : ${t.reference}`, {
    font: { bold: true, size: 10 },
  });
  fusionner(`F${ligne}:J${ligne}`, `Date : ${dateFr(t.date)}`, {
    font: { bold: true, size: 10 },
    alignment: { horizontal: "right" },
  });
  ws.getRow(ligne).height = 18;
  ligne += 1;

  fusionner(`A${ligne}:J${ligne}`, "TRANSFERT DE MATÉRIEL ENTRE DIRECTIONS", {
    font: { bold: true, size: 18, color: { argb: ARGENT_TITRE } },
    alignment: { horizontal: "center" },
  });
  ws.getRow(ligne).height = 30;
  ligne += 1;

  fusionner(
    `A${ligne}:J${ligne}`,
    "SORTIE du stock de la Direction d'origine → TRANSFERT → ENTRÉE dans le stock de la Direction destinataire après réception validée.",
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

  infoLigne("Direction d'origine", t.directionOrigine, "Direction destinataire", t.directionDestination);
  infoLigne("Service d'origine", t.serviceOrigine, "Service destinataire", t.serviceDestination);
  infoLigne("Matériel", t.materiel, "Référence", t.materielReference || "—");
  infoLigne("Quantité", t.quantite, "Motif", t.motif || "—");
  infoLigne(
    "Date sortie",
    t.dateSortie ? dateHeureFr(t.dateSortie) : "—",
    "Date réception",
    t.dateReception ? dateHeureFr(t.dateReception) : "—"
  );
  infoLigne("Observation", t.observation || "—", "Créateur", t.createur);
  ligne += 1;

  // ------------------------------------------------- signatures de sortie
  const nbSortie = getSignatureSortieCount(t);
  fusionner(
    `A${ligne}:J${ligne}`,
    `VALIDATION DE LA SORTIE — DIRECTION D'ORIGINE — ${nbSortie}/3 — ${getStatutTransfertAffiche(t).toUpperCase()}`,
    {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
    }
  );
  ws.getRow(ligne).height = 20;
  ligne += 1;

  const entetes = ["Validation", "Responsable désigné", "Statut", "Signataire", "Date"];
  const plagesEntete = [
    ["A", "B"],
    ["C", "D"],
    ["E", "E"],
    ["F", "H"],
    ["I", "J"],
  ];
  entetes.forEach((txt, i) => {
    const [debut, fin] = plagesEntete[i];
    fusionner(`${debut}${ligne}:${fin}${ligne}`, txt, {
      font: { bold: true, size: 9, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
    });
  });
  ws.getRow(ligne).height = 18;
  ligne += 1;

  for (const v of getValidationsSortie(t)) {
    fusionner(`A${ligne}:B${ligne}`, v.label, { font: { size: 9, bold: true } });
    fusionner(`C${ligne}:D${ligne}`, t.responsablesOrigine[v.key] || "—", { font: { size: 9 } });
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

  // --------------------------------------------- signatures de réception
  const nbReception = getSignatureReceptionCount(t);
  fusionner(
    `A${ligne}:J${ligne}`,
    `VALIDATION DE LA RÉCEPTION — DIRECTION DESTINATAIRE — ${nbReception}/3`,
    {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER_RECEPTION } },
    }
  );
  ws.getRow(ligne).height = 20;
  ligne += 1;

  entetes.forEach((txt, i) => {
    const [debut, fin] = plagesEntete[i];
    fusionner(`${debut}${ligne}:${fin}${ligne}`, txt, {
      font: { bold: true, size: 9, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER_RECEPTION } },
    });
  });
  ws.getRow(ligne).height = 18;
  ligne += 1;

  for (const v of getValidationsReception(t)) {
    fusionner(`A${ligne}:B${ligne}`, v.label, { font: { size: 9, bold: true } });
    fusionner(`C${ligne}:D${ligne}`, t.responsablesDestination[v.key] || "—", { font: { size: 9 } });
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
  fusionner(
    `A${ligne}:J${ligne}`,
    `QR CODE — ${t.reference} — Statut : ${getStatutTransfertAffiche(t)} (sortie ${nbSortie}/3, réception ${nbReception}/3)`,
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
    `Le scan du QR Code identifie le transfert ${t.reference} (${t.directionOrigine} / ${t.serviceOrigine} → ${t.directionDestination} / ${t.serviceDestination} — ${t.quantite} unité(s)).\n\nÉdité le ${dateFr(
      new Date().toISOString()
    )} — ComptaMatière`,
    { font: { size: 9 } }
  );
  ws.getRow(ligne).height = 62;
  ligne += 7;

  // --------------------------------------------------------- historique
  fusionner(`A${ligne}:J${ligne}`, "HISTORIQUE — DU DÉPART À L'ARRIVÉE", {
    font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
    alignment: { horizontal: "center" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
  });
  ws.getRow(ligne).height = 20;
  ligne += 1;
  for (const ev of t.historique) {
    const row = ws.getRow(ligne);
    for (let c = 1; c <= 10; c += 1) row.getCell(c).border = BORDURE;
    ws.mergeCells(`A${ligne}:B${ligne}`);
    const cellDate = row.getCell(1);
    cellDate.value = dateHeureFr(ev.date);
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
    oddFooter: `&C&"Helvetica"&8 ${t.reference} — Transfert entre Directions — Page &P / &N`,
  };
  ws.pageSetup.printArea = `A1:J${ligne}`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Transfert_${t.reference.replace(/[^\w-]/g, "")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
