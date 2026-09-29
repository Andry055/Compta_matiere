// ---------------------------------------------------------------------------
// Document « ÉTAT APPRÉCIATIF présentant les mouvements des entrées et
// sorties » — génération PDF et Excel.
//
// En-tête réglementaire :
//   MATÉRIEL EN SERVICE / BUDGET GÉNÉRAL / SOA (chapitron) / Ministère /
//   ÉTAT APPRÉCIATIF… / « Ci-joint : SIX (06) pièces justificatives » /
//   « du 01er janvier AAAA au 31 décembre AAAA » / « Gestion de Monsieur … »
//
// Corps : mouvements de l'année (entrées puis sorties) avec date,
// désignation, quantité, valeur, pièce justificative. Le nombre de pièces
// (chiffres ET lettres) = nombre de factures/ordres d'entrée de l'année.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { EtatAppreciatif } from "./reddition";
import { nombreEnLettresFr, arrondirAriary } from "./nombreEnLettres";
import { MINISTERE } from "./redditionDocuments";

/* ────────────────────────────── Helpers ────────────────────────────── */

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function formaterMontant(v: number): string {
  const arrondi = arrondirAriary(v);
  const signe = arrondi < 0 ? "-" : "";
  return `${signe}${Math.abs(arrondi)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

function dateFr(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

/** Nombre de pièces en chiffres ET en lettres : « SIX (06) ». */
function piecesEnChiffresEtLettres(n: number): string {
  const enLettres = n === 0 ? "ZÉRO" : nombreEnLettresFr(n);
  const enChiffres = String(n).padStart(2, "0");
  return `${enLettres} (${enChiffres})`;
}

const SOA = "00-32-0-110-00000"; // Session Ordonnateur — à ajuster si besoin

function lignesEntete(annee: number, gestionnaire: string): string[] {
  return [
    "MATÉRIEL EN SERVICE",
    "BUDGET GÉNÉRAL",
    `SOA ${SOA}`,
    MINISTERE,
    "ÉTAT APPRÉCIATIF présentant les mouvements des entrées et sorties",
    `du 01er janvier ${annee} au 31 décembre ${annee}`,
    `Gestion de Monsieur ${gestionnaire}`,
  ];
}

const COLONNES = [
  "Date",
  "Référence / Pièce justificative",
  "Désignation",
  "Quantité",
  "Valeur (Ariary)",
];

function corpsMouvements(etat: EtatAppreciatif): (string | number)[][] {
  const corps: (string | number)[][] = [];

  corps.push(["ENTRÉES", "", "", "", ""]);
  for (const m of etat.mouvementsEntree) {
    for (const l of m.lignes) {
      corps.push([
        dateFr(m.date),
        l.pieceJustificative || m.reference || "—",
        l.designation || "—",
        l.quantite,
        formaterMontant(l.montant),
      ]);
    }
  }
  corps.push([
    "TOTAL ENTRÉES",
    "",
    "",
    "",
    formaterMontant(etat.totalEntrees),
  ]);

  corps.push(["SORTIES", "", "", "", ""]);
  for (const m of etat.mouvementsSortie) {
    for (const l of m.lignes) {
      corps.push([
        dateFr(m.date),
        l.pieceJustificative || m.reference || "—",
        l.designation || "—",
        l.quantite,
        formaterMontant(l.montant),
      ]);
    }
  }
  corps.push([
    "TOTAL SORTIES",
    "",
    "",
    "",
    formaterMontant(etat.totalSorties),
  ]);

  return corps;
}

/* ─────────────────────────────── PDF ─────────────────────────────── */

export function genererPdfEtatAppreciatif(
  etat: EtatAppreciatif,
  { gestionnaire = "le Dépositaire Comptable" }: { gestionnaire?: string } = {}
): void {
  const annee = etat.annee;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  // En-tête réglementaire
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(textePdf("MATÉRIEL EN SERVICE"), 14, 14);
  doc.text(textePdf("BUDGET GÉNÉRAL"), 14, 19);
  doc.setFont("helvetica", "normal");
  doc.text(textePdf(`SOA ${SOA}`), 14, 24);
  doc.text(textePdf(MINISTERE), pageW - 14, 14, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    textePdf("ÉTAT APPRÉCIATIF présentant les mouvements des entrées et sorties"),
    pageW / 2,
    22,
    { align: "center" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(textePdf(`du 01er janvier ${annee} au 31 décembre ${annee}`), pageW / 2, 28, {
    align: "center",
  });
  doc.text(textePdf(`Gestion de Monsieur ${gestionnaire}`), pageW / 2, 33, {
    align: "center",
  });
  doc.text(
    textePdf(`Ci-joint : ${piecesEnChiffresEtLettres(etat.nombrePieces)} pièces justificatives`),
    pageW - 14,
    28,
    { align: "right" }
  );

  autoTable(doc, {
    startY: 40,
    head: [COLONNES.map(textePdf)],
    body: corpsMouvements(etat).map((r) => r.map((c) => textePdf(String(c)))),
    styles: { fontSize: 8, halign: "left", cellPadding: 1.6 },
    headStyles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] },
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
    didParseCell: (data) => {
      const brut = String(data.row.raw?.[0] ?? "");
      if (data.section === "body" && brut.startsWith("TOTAL")) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
      if (data.section === "body" && (brut === "ENTRÉES" || brut === "SORTIES")) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.colSpan = 5;
      }
    },
    margin: { left: 14, right: 14 },
  });

  const yTableau =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  const y = Math.max(yTableau, doc.internal.pageSize.getHeight() - 40);

  doc.setFontSize(9);
  doc.text("A Antananarivo, le ………………………", pageW - 30, y, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text("Le DÉPOSITAIRE COMPTABLE", 30, y + 16);

  doc.save(`Etat_appreciatif_${annee}.pdf`);
}

/* ────────────────────────────── Excel ────────────────────────────── */

export async function genererExcelEtatAppreciatif(
  etat: EtatAppreciatif,
  { gestionnaire = "le Dépositaire Comptable" }: { gestionnaire?: string } = {}
): Promise<void> {
  const annee = etat.annee;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`État appréciatif ${annee}`, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = [{ width: 14 }, { width: 30 }, { width: 46 }, { width: 12 }, { width: 18 }];

  const totalCols = COLONNES.length;
  const merge = (row: number, text: string, bold = false, size = 10, align: "left" | "center" = "center") => {
    ws.mergeCells(row, 1, row, totalCols);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.alignment = { horizontal: align, vertical: "middle" };
    cell.font = { bold, size };
  };

  const entete = lignesEntete(annee, gestionnaire);
  merge(1, entete[0], true, 11, "left");
  merge(2, entete[1], true, 10, "left");
  merge(3, entete[2], false, 10, "left");
  merge(4, entete[3], false, 10);
  merge(5, entete[4], true, 12);
  merge(6, entete[5], false, 10);
  merge(7, entete[6], false, 10);

  const headerRow = 9;
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

  let r = headerRow + 1;
  function ecrireLigne(valeurs: (string | number)[], bold = false, gris = false) {
    const row = ws.getRow(r);
    valeurs.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { bold, size: 9 };
      if (gris) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      if (i === 3) cell.alignment = { horizontal: "right" };
      if (i === 4) {
        cell.alignment = { horizontal: "right" };
        if (typeof v === "number") cell.numFmt = "# ##0";
      }
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });
    r += 1;
  }

  ecrireLigne(["ENTRÉES", "", "", "", ""], true, true);
  for (const m of etat.mouvementsEntree) {
    for (const l of m.lignes) {
      ecrireLigne([
        dateFr(m.date),
        l.pieceJustificative || m.reference || "—",
        l.designation || "—",
        l.quantite,
        arrondirAriary(l.montant),
      ]);
    }
  }
  ecrireLigne(["TOTAL ENTRÉES", "", "", "", arrondirAriary(etat.totalEntrees)], true);

  ecrireLigne(["SORTIES", "", "", "", ""], true, true);
  for (const m of etat.mouvementsSortie) {
    for (const l of m.lignes) {
      ecrireLigne([
        dateFr(m.date),
        l.pieceJustificative || m.reference || "—",
        l.designation || "—",
        l.quantite,
        arrondirAriary(l.montant),
      ]);
    }
  }
  ecrireLigne(["TOTAL SORTIES", "", "", "", arrondirAriary(etat.totalSorties)], true);

  r += 1;
  merge(r, `Ci-joint : ${piecesEnChiffresEtLettres(etat.nombrePieces)} pièces justificatives`, false, 9, "left");
  r += 3;
  ws.getCell(r, 4).value = "A Antananarivo, le ………………………";
  ws.getCell(r + 3, 1).value = "Le DÉPOSITAIRE COMPTABLE";
  ws.getCell(r + 3, 1).font = { bold: true, size: 9 };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Etat_appreciatif_${annee}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export { lignesEntete, piecesEnChiffresEtLettres };
