// ---------------------------------------------------------------------------
// Document « RÉCAPITULATION » — génération PDF et Excel
//
// Une ligne par nomenclature (03, 05, 10…) puis une ligne TOTAUX.
// Colonnes : Numéro de nomenclature | Existant au 1er janvier | Entrées |
//            Total de l'existant | Sorties | Reste au 31 décembre.
// Sous le tableau : montants arrêtés en toutes lettres (entrées / sorties /
// valeur restant), lieu et date, signatures.
//
// PDF : jsPDF + jspdf-autotable (A4 portrait, en-tête ministère).
// Excel : exceljs (A4 portrait, bordures, zone de signatures) — imprimable.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { Recapitulation } from "./reddition";
import { nombreEnLettresFr, arrondirAriary } from "./nombreEnLettres";

/* ────────────────────────────── Helpers ────────────────────────────── */

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

/** Formate un montant Ariary : 1 777 192 633,6 (séparateur espace, 1 déc.). */
function formaterMontant(v: number): string {
  const arrondi = arrondirAriary(v);
  const entier = Math.floor(Math.abs(arrondi));
  const signe = arrondi < 0 ? "-" : "";
  const chiffres = entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${chiffres}`;
}

export const MINISTERE = "SECRÉTARIAT D'ÉTAT CHARGÉ DES TRAVAUX PUBLICS";
const TITRE = "RÉCAPITULATION DES MATIÈRES";
const SOUS_TITRE = (annee: number) =>
  `Exercice du 1er janvier ${annee} au 31 décembre ${annee}`;

function enteteCommune(annee: number): string[] {
  return [MINISTERE, TITRE, SOUS_TITRE(annee)];
}

const COLONNES = [
  "Numéro de nomenclature",
  "Existant au 1er janvier",
  "Entrées",
  "Total de l'existant",
  "Sorties",
  "Reste au 31 décembre",
];

function lignesTableau(recap: Recapitulation): (string | number)[][] {
  const corps = recap.lignes.map((l) => [
    l.nomenclature,
    formaterMontant(l.existant),
    formaterMontant(l.entrees),
    formaterMontant(l.total),
    formaterMontant(l.sorties),
    formaterMontant(l.reste),
  ]);
  const t = recap.totaux;
  corps.push([
    "TOTAUX",
    formaterMontant(t.existant),
    formaterMontant(t.entrees),
    formaterMontant(t.total),
    formaterMontant(t.sorties),
    formaterMontant(t.reste),
  ]);
  return corps;
}

function texteArrete(recap: Recapitulation): string[] {
  const t = recap.totaux;
  const entreesLettres =
    t.entrees > 0 ? nombreEnLettresFr(arrondirAriary(t.entrees)) : "NÉANT";
  const sortiesLettres =
    t.sorties > 0 ? nombreEnLettresFr(arrondirAriary(t.sorties)) : "NÉANT";
  const resteLettres = nombreEnLettresFr(arrondirAriary(t.reste));
  return [
    `Arrêté à la somme de : ${entreesLettres} Ariary en ce qui concerne les entrées,`,
    `à la somme de : ${sortiesLettres} Ariary en ce qui concerne les sorties,`,
    `à la somme de : ${resteLettres} Ariary valeur restant au dernier jour de l'année.`,
  ];
}

/* ─────────────────────────────── PDF ─────────────────────────────── */

export function genererPdfRecapitulation(recap: Recapitulation): void {
  const annee = recap.annee;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  // En-tête ministère
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(textePdf(MINISTERE), pageW / 2, 16, { align: "center" });
  doc.setFontSize(13);
  doc.text(textePdf(TITRE), pageW / 2, 24, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(textePdf(SOUS_TITRE(annee)), pageW / 2, 30, { align: "center" });

  // Tableau principal
  autoTable(doc, {
    startY: 38,
    head: [COLONNES.map(textePdf)],
    body: lignesTableau(recap).map((r) => r.map((c) => textePdf(String(c)))),
    styles: { fontSize: 8.5, halign: "right", cellPadding: 1.8 },
    headStyles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] },
    columnStyles: { 0: { halign: "center", fontStyle: "bold", cellWidth: 32 } },
    didParseCell: (data) => {
      // Ligne TOTAUX en gras
      if (data.section === "body" && data.row.index === recap.lignes.length) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
    margin: { left: 12, right: 12 },
  });

  // Arrêté + signatures
  const yTableau = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  const y = Math.max(yTableau, 190);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  texteArrete(recap).forEach((ligne, i) => {
    doc.text(textePdf(ligne), pageW / 2, y + i * 5, { align: "center" });
  });

  const yLieu = y + 22;
  doc.text("A Antananarivo, le ………………………", pageW - 30, yLieu, { align: "right" });

  const ySign = yLieu + 20;
  doc.setFont("helvetica", "bold");
  doc.text("Le DÉPOSITAIRE COMPTABLE", 30, ySign);
  doc.text("Vu par le CHEF DU SERVICE", pageW - 70, ySign);
  doc.text("DE LA LOGISTIQUE", pageW - 70, ySign + 5);

  doc.save(`Recapitulation_${annee}.pdf`);
}

/* ────────────────────────────── Excel ────────────────────────────── */

export async function genererExcelRecapitulation(recap: Recapitulation): Promise<void> {
  const annee = recap.annee;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Récapitulation ${annee}`, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = [
    { width: 22 }, { width: 20 }, { width: 18 },
    { width: 20 }, { width: 16 }, { width: 20 },
  ];

  // En-tête
  const totalCols = COLONNES.length;
  const merge = (row: number, text: string, bold = false, size = 11) => {
    ws.mergeCells(row, 1, row, totalCols);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold, size };
  };

  merge(1, MINISTERE, true, 12);
  merge(2, TITRE, true, 14);
  merge(3, SOUS_TITRE(annee), false, 10);

  // Tableau
  const headerRow = 5;
  const header = ws.getRow(headerRow);
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
  header.height = 24;

  recap.lignes.forEach((l, idx) => {
    const row = ws.getRow(headerRow + 1 + idx);
    const valeurs = [l.nomenclature, l.existant, l.entrees, l.total, l.sorties, l.reste];
    valeurs.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = i === 0 ? v : arrondirAriary(Number(v));
      if (i > 0) cell.numFmt = "# ##0";
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
  });

  const totalIdx = headerRow + 1 + recap.lignes.length;
  const t = recap.totaux;
  const valeursTotaux = ["TOTAUX", t.existant, t.entrees, t.total, t.sorties, t.reste];
  const rowTotaux = ws.getRow(totalIdx);
  valeursTotaux.forEach((v, i) => {
    const cell = rowTotaux.getCell(i + 1);
    cell.value = i === 0 ? v : arrondirAriary(Number(v));
    cell.font = { bold: true };
    if (i > 0) cell.numFmt = "# ##0";
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  });

  // Arrêté
  const yArrete = totalIdx + 2;
  texteArrete(recap).forEach((ligne, i) => {
    merge(yArrete + i, ligne, false, 9);
  });

  const yLieu = yArrete + 4;
  ws.getCell(yLieu, 5).value = "A Antananarivo, le ………………………";
  ws.getCell(yLieu, 5).font = { size: 9 };

  const ySign = yLieu + 4;
  ws.getCell(ySign, 1).value = "Le DÉPOSITAIRE COMPTABLE";
  ws.getCell(ySign, 1).font = { bold: true, size: 9 };
  ws.getCell(ySign, 4).value = "Vu par le CHEF DU SERVICE";
  ws.getCell(ySign, 4).font = { bold: true, size: 9 };
  ws.getCell(ySign + 1, 4).value = "DE LA LOGISTIQUE";
  ws.getCell(ySign + 1, 4).font = { bold: true, size: 9 };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Recapitulation_${annee}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export { enteteCommune };
