// ---------------------------------------------------------------------------
// Document « INVENTAIRE ANNUEL » — génération PDF et Excel.
//
// Une feuille/section par nomenclature. Colonnes : Folio du grand-livre |
// Désignation du matériel | Espèce des unités (N) | Prix de l'unité |
// Quantités (existant au 1er janv., entrées, sorties, reste au 31 déc.) |
// Décompte en valeur (mêmes 4 colonnes) | Observations.
//
// Pied de page : « Arrêté ce présent inventaire à <nombre en lettres>
// ARTICLES (n articles) et à la somme de : <montant en lettres> ».
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import type { Inventaire, InventaireSection } from "./reddition";
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

const HEAD_SPAN = [
  [
    { content: "Folio du grand-livre", rowSpan: 2 },
    { content: "Désignation du matériel", rowSpan: 2 },
    { content: "Espèce des unités (N)", rowSpan: 2 },
    { content: "Prix de l'unité", rowSpan: 2 },
    { content: "Quantités", colSpan: 4 },
    { content: "Décompte en valeur (Ariary)", colSpan: 4 },
    { content: "Observations", rowSpan: 2 },
  ],
  [
    { content: "Existant au 1er janv." },
    { content: "Entrées" },
    { content: "Sorties" },
    { content: "Reste au 31 déc." },
    { content: "Existant au 1er janv." },
    { content: "Entrées" },
    { content: "Sorties" },
    { content: "Reste au 31 déc." },
  ],
];

/** Nombre total d'articles de l'inventaire. */
function nombreArticles(inventaire: Inventaire): number {
  return inventaire.sections.reduce((t, s) => t + s.articles.length, 0);
}

/** Valeur totale (reste) de l'inventaire. */
function valeurTotale(inventaire: Inventaire): number {
  return inventaire.sections.reduce((t, s) => t + s.totaux.valeurs.reste, 0);
}

/** Pied de page réglementaire. */
function texteArreteInventaire(inventaire: Inventaire): string[] {
  const nb = nombreArticles(inventaire);
  const nbLettres = nb === 0 ? "ZÉRO" : nombreEnLettresFr(nb);
  const valeur = arrondirAriary(valeurTotale(inventaire));
  return [
    `Arrêté ce présent inventaire à ${nbLettres} ARTICLES (${nb} articles)`,
    `et à la somme de : ${nombreEnLettresFr(valeur)} Ariary.`,
  ];
}

function corpsSection(section: InventaireSection): (string | number)[][] {
  const corps: (string | number)[][] = [];
  for (const a of section.articles) {
    corps.push([
      "", // Folio : renseigné manuellement au grand-livre
      a.designation,
      a.unite,
      formaterMontant(a.prixUnitaire),
      a.quantites.existant,
      a.quantites.entrees,
      a.quantites.sorties,
      a.quantites.reste,
      formaterMontant(a.valeurs.existant),
      formaterMontant(a.valeurs.entrees),
      formaterMontant(a.valeurs.sorties),
      formaterMontant(a.valeurs.reste),
      "",
    ]);
  }
  const tq = section.totaux.quantites;
  const tv = section.totaux.valeurs;
  corps.push([
    "TOTAUX",
    "",
    "",
    "",
    tq.existant,
    tq.entrees,
    tq.sorties,
    tq.reste,
    formaterMontant(tv.existant),
    formaterMontant(tv.entrees),
    formaterMontant(tv.sorties),
    formaterMontant(tv.reste),
    "",
  ]);
  return corps;
}

/* ─────────────────────────────── PDF ─────────────────────────────── */

export function genererPdfInventaire(inventaire: Inventaire): void {
  const annee = inventaire.annee;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();

  let premiereSection = true;
  let yCourant = 0;

  for (const section of inventaire.sections) {
    if (!premiereSection) {
      doc.addPage();
    }
    yCourant = 14;

    // En-tête (sur chaque feuille/section)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(textePdf(MINISTERE), pageW / 2, yCourant, { align: "center" });
    doc.setFontSize(12);
    doc.text(
      textePdf(`INVENTAIRE ANNUEL DES MATIÈRES — EXERCICE ${annee}`),
      pageW / 2,
      yCourant + 7,
      { align: "center" }
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      textePdf(`Nomenclature : ${section.nomenclature}`),
      pageW / 2,
      yCourant + 14,
      { align: "center" }
    );

    autoTable(doc, {
      startY: yCourant + 19,
      head: HEAD_SPAN as never,
      body: corpsSection(section).map((r) => r.map((c) => textePdf(String(c)))),
      styles: { fontSize: 7, halign: "right", cellPadding: 1.4 },
      headStyles: { halign: "center", fontStyle: "bold", fillColor: [230, 230, 230] },
      columnStyles: {
        0: { halign: "center", cellWidth: 16 },
        1: { halign: "left", cellWidth: 48 },
        2: { halign: "center", cellWidth: 18 },
        3: { halign: "right", cellWidth: 20 },
      },
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          data.row.index === section.articles.length
        ) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [245, 245, 245];
        }
      },
      margin: { left: 10, right: 10 },
    });

    const yFin =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(8.5);
    texteArreteInventaire({ annee, sections: [section] }).forEach((l, i) => {
      doc.text(textePdf(l), pageW / 2, yFin + i * 4.5, { align: "center" });
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const ySign = Math.max(yFin + 18, doc.internal.pageSize.getHeight() - 22);
    doc.text("Le DÉPOSITAIRE COMPTABLE", 28, ySign);
    doc.text("Vu par le CHEF DU SERVICE", pageW - 74, ySign);
    doc.text("DE LA LOGISTIQUE", pageW - 74, ySign + 5);

    premiereSection = false;
  }

  if (premiereSection) {
    // Aucune section : document vide avec mention
    doc.setFontSize(10);
    doc.text("Aucune donnée pour cette année.", pageW / 2, 40, { align: "center" });
  }

  doc.save(`Inventaire_annuel_${annee}.pdf`);
}

/* ────────────────────────────── Excel ────────────────────────────── */

export async function genererExcelInventaire(inventaire: Inventaire): Promise<void> {
  const annee = inventaire.annee;
  const wb = new ExcelJS.Workbook();
  const COLS = 13;

  for (const section of inventaire.sections) {
    const ws = wb.addWorksheet(`Nom. ${section.nomenclature}`.slice(0, 31), {
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1 },
    });
    ws.columns = [
      { width: 10 }, { width: 40 }, { width: 12 }, { width: 14 },
      { width: 11 }, { width: 9 }, { width: 9 }, { width: 11 },
      { width: 16 }, { width: 14 }, { width: 14 }, { width: 16 },
      { width: 18 },
    ];

    const merge = (row: number, text: string, bold = false, size = 10) => {
      ws.mergeCells(row, 1, row, COLS);
      const cell = ws.getCell(row, 1);
      cell.value = text;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold, size };
    };

    merge(1, MINISTERE, true, 11);
    merge(2, `INVENTAIRE ANNUEL DES MATIÈRES — EXERCICE ${annee}`, true, 13);
    merge(3, `Nomenclature : ${section.nomenclature}`, false, 10);

    // Double en-tête
    const h1 = ws.getRow(5);
    const spans: Array<[string, number]> = [
      ["Folio du grand-livre", 1], ["Désignation du matériel", 1],
      ["Espèce des unités (N)", 1], ["Prix de l'unité", 1],
      ["Quantités", 4], ["Décompte en valeur (Ariary)", 4], ["Observations", 1],
    ];
    let col = 1;
    for (const [titre, span] of spans) {
      if (span > 1) ws.mergeCells(5, col, 5, col + span - 1);
      const cell = h1.getCell(col);
      cell.value = titre;
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      col += span;
    }
    const h2 = ws.getRow(6);
    [
      "", "", "", "",
      "Existant au 1er janv.", "Entrées", "Sorties", "Reste au 31 déc.",
      "Existant au 1er janv.", "Entrées", "Sorties", "Reste au 31 déc.",
      "",
    ].forEach((v, i) => {
      const cell = h2.getCell(i + 1);
      cell.value = v || null;
      cell.font = { bold: true, size: 8 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    [5, 6].forEach((rowIdx) => {
      for (let c = 1; c <= COLS; c++) {
        ws.getCell(rowIdx, c).border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
      }
    });
    h1.height = 20;
    h2.height = 26;

    let r = 7;
    for (const a of section.articles) {
      const row = ws.getRow(r);
      const vals: (string | number)[] = [
        "", a.designation, a.unite, arrondirAriary(a.prixUnitaire),
        a.quantites.existant, a.quantites.entrees, a.quantites.sorties, a.quantites.reste,
        arrondirAriary(a.valeurs.existant), arrondirAriary(a.valeurs.entrees),
        arrondirAriary(a.valeurs.sorties), arrondirAriary(a.valeurs.reste),
        "",
      ];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v === "" ? null : v;
        cell.font = { size: 9 };
        if (i >= 3 && i <= 11) cell.alignment = { horizontal: "right" };
        if (i === 4 || i === 8) cell.numFmt = "# ##0";
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" },
        };
      });
      r += 1;
    }

    // Totaux de section
    const tq = section.totaux.quantites;
    const tv = section.totaux.valeurs;
    const rowT = ws.getRow(r);
    const valsT: (string | number | null)[] = [
      "TOTAUX", null, null, null,
      tq.existant, tq.entrees, tq.sorties, tq.reste,
      arrondirAriary(tv.existant), arrondirAriary(tv.entrees),
      arrondirAriary(tv.sorties), arrondirAriary(tv.reste),
      null,
    ];
    valsT.forEach((v, i) => {
      const cell = rowT.getCell(i + 1);
      cell.value = v;
      cell.font = { bold: true, size: 9 };
      if (i >= 4 && i <= 11) { cell.alignment = { horizontal: "right" }; cell.numFmt = "# ##0"; }
      cell.border = {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" },
      };
    });

    r += 2;
    texteArreteInventaire({ annee, sections: [section] }).forEach((l, i) => {
      merge(r + i, l, false, 9);
    });
    r += 4;
    ws.getCell(r, 1).value = "Le DÉPOSITAIRE COMPTABLE";
    ws.getCell(r, 1).font = { bold: true, size: 9 };
    ws.getCell(r, 10).value = "Vu par le CHEF DU SERVICE";
    ws.getCell(r + 1, 10).value = "DE LA LOGISTIQUE";
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Inventaire_annuel_${annee}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export { texteArreteInventaire, nombreArticles, valeurTotale };
