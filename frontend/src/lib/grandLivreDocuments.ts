// ---------------------------------------------------------------------------
// Document « FICHE DE STOCK / GRAND-LIVRE » d'un article — PDF et Excel.
//
// Colonnes : Date | Référence | Quantité entrée | Quantité sortie |
//            Quantité cumulée | (signatures reportées en tête de page).
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { GrandLivre } from "./reddition";
import { MINISTERE } from "./redditionDocuments";

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function dateFr(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso || "—";
  }
}

const COLONNES = ["Date", "Référence", "Quantité entrée", "Quantité sortie", "Quantité cumulée", "Pièce justificative"];

function corps(gl: GrandLivre): (string | number)[][] {
  const corps = gl.mouvements.map((m) => [
    dateFr(m.date),
    m.reference || "—",
    m.quantiteEntree || "",
    m.quantiteSortie || "",
    m.quantiteCumulee,
    m.pieceJustificative || "",
  ]);
  corps.push([
    "TOTAUX",
    "",
    gl.totalEntreesQ,
    gl.totalSortiesQ,
    gl.quantiteFinale,
    "",
  ]);
  return corps;
}

export function genererPdfGrandLivre(
  gl: GrandLivre,
  { designation }: { designation?: string } = {}
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const titre = `FICHE DE STOCK — GRAND-LIVRE${gl.annee ? ` ${gl.annee}` : ""}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(textePdf(MINISTERE), pageW / 2, 14, { align: "center" });
  doc.setFontSize(12);
  doc.text(textePdf(titre), pageW / 2, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    textePdf(designation ? `Article : ${designation}` : `Article n° ${gl.materielId}`),
    pageW / 2,
    27,
    { align: "center" }
  );

  autoTable(doc, {
    startY: 33,
    head: [COLONNES.map(textePdf)],
    body: corps(gl).map((r) => r.map((c) => textePdf(String(c)))),
    styles: { fontSize: 8, halign: "center", cellPadding: 1.6 },
    headStyles: { fillColor: [230, 230, 230], fontStyle: "bold" },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === gl.mouvements.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
    margin: { left: 14, right: 14 },
  });

  const yFin =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  const y = Math.max(yFin, doc.internal.pageSize.getHeight() - 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Le DÉPOSITAIRE COMPTABLE", 28, y);
  doc.text("Vu par le CHEF DU SERVICE", pageW - 74, y);
  doc.text("DE LA LOGISTIQUE", pageW - 74, y + 5);

  doc.save(`Fiche_stock_${designation ? designation.replace(/[^\w-]+/g, "_") : gl.materielId}${gl.annee ? `_${gl.annee}` : ""}.pdf`);
}

export async function genererExcelGrandLivre(
  gl: GrandLivre,
  { designation }: { designation?: string } = {}
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Grand-livre", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = [{ width: 14 }, { width: 24 }, { width: 15 }, { width: 15 }, { width: 16 }, { width: 26 }];

  const COLS = COLONNES.length;
  const merge = (row: number, text: string, bold = false, size = 10) => {
    ws.mergeCells(row, 1, row, COLS);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold, size };
  };

  merge(1, MINISTERE, true, 11);
  merge(2, `FICHE DE STOCK — GRAND-LIVRE${gl.annee ? ` ${gl.annee}` : ""}`, true, 13);
  merge(3, designation ? `Article : ${designation}` : `Article n° ${gl.materielId}`, false, 10);

  const header = ws.getRow(5);
  COLONNES.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });

  let r = 6;
  for (const m of gl.mouvements) {
    const row = ws.getRow(r);
    [dateFr(m.date), m.reference || "—", m.quantiteEntree || null, m.quantiteSortie || null, m.quantiteCumulee, m.pieceJustificative || null].forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { size: 9 };
      if (i >= 2 && i <= 4) cell.alignment = { horizontal: "right" };
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
    r += 1;
  }
  const rowT = ws.getRow(r);
  ["TOTAUX", null, gl.totalEntreesQ, gl.totalSortiesQ, gl.quantiteFinale, null].forEach((v, i) => {
    const cell = rowT.getCell(i + 1);
    cell.value = v;
    cell.font = { bold: true, size: 9 };
    if (i >= 2 && i <= 4) cell.alignment = { horizontal: "right" };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });

  r += 3;
  ws.getCell(r, 1).value = "Le DÉPOSITAIRE COMPTABLE";
  ws.getCell(r, 1).font = { bold: true, size: 9 };
  ws.getCell(r, 5).value = "Vu par le CHEF DU SERVICE";
  ws.getCell(r + 1, 5).value = "DE LA LOGISTIQUE";

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Fiche_stock_${gl.materielId}${gl.annee ? `_${gl.annee}` : ""}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
