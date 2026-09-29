// ---------------------------------------------------------------------------
// Documents de clôture du dossier de reddition :
//   1. BORDEREAU D'ENVOI — liste des pièces avec le nombre de chacune + TOTAL
//      (ordres d'entrée et factures calculés depuis la base).
//   2. FICHE DE CENTRALISATION COMPTABLE — modèle pré-rempli.
//   3. ATTESTATION — modèle pré-rempli.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Bordereau } from "./reddition";
import { nombreEnLettresFr } from "./nombreEnLettres";
import { MINISTERE } from "./redditionDocuments";

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

/** « SIX (06) » — nombre en lettres + chiffres sur deux digits. */
function enChiffresEtLettres(n: number): string {
  const enLettres = n === 0 ? "ZÉRO" : nombreEnLettresFr(n);
  return `${enLettres} (${String(n).padStart(2, "0")})`;
}

/* ─────────────────────── 1. BORDEREAU D'ENVOI ─────────────────────── */

export function genererPdfBordereau(
  bordereau: Bordereau,
  { anneeDebut, anneeFin }: { anneeDebut: number; anneeFin: number }
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(textePdf(MINISTERE), pageW / 2, 14, { align: "center" });
  doc.setFontSize(12);
  doc.text(textePdf("BORDERAU D'ENVOI"), pageW / 2, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(
    textePdf(`Dossier de reddition de compte des matières — gestion ${anneeDebut}${anneeFin > anneeDebut ? ` à ${anneeFin}` : ""}`),
    pageW / 2,
    27,
    { align: "center" }
  );

  // Décompte des pièces calculées
  const parAnneeTexte = bordereau.parAnnee
    .map((a) => `${a.annee} : ${enChiffresEtLettres(a.ordresEntree)}`)
    .join("  •  ");

  const lignes: [string, string][] = [
    ["Notes de présentation du dossier", enChiffresEtLettres(1)],
    [
      "Décisions de nomination du dépositaire",
      enChiffresEtLettres(1),
    ],
    ["Inventaires annuels", enChiffresEtLettres(anneeFin - anneeDebut + 1)],
    [
      "Procès-verbaux de recensement",
      enChiffresEtLettres(anneeFin - anneeDebut + 1),
    ],
    ["États appréciatifs", enChiffresEtLettres(anneeFin - anneeDebut + 1)],
    [
      "Ordres d'entrée par année",
      enChiffresEtLettres(bordereau.totalOrdres),
    ],
    ["Factures par année", enChiffresEtLettres(bordereau.totalFactures)],
    ["Fiches de centralisation", enChiffresEtLettres(1)],
    ["Attestation", enChiffresEtLettres(1)],
  ];

  autoTable(doc, {
    startY: 34,
    head: [["Nature des pièces", "Nombre"]],
    body: lignes.map(([a, b]) => [textePdf(a), textePdf(b)]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [230, 230, 230], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "center", cellWidth: 45 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === lignes.length) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 20, right: 20 },
  });

  // TOTAL
  const yT = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  autoTable(doc, {
    startY: yT,
    body: [[
      { content: "TOTAL", styles: { fontStyle: "bold", halign: "left" } },
      {
        content: textePdf(enChiffresEtLettres(lignes.length + bordereau.totalOrdres + bordereau.totalFactures)),
        styles: { fontStyle: "bold", halign: "center" },
      },
    ]],
    styles: { fontSize: 9.5, cellPadding: 2 },
    columnStyles: { 1: { cellWidth: 45 } },
    margin: { left: 20, right: 20 },
  });

  const yNote = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.text(textePdf(`Décompte des ordres d'entrée (et des factures) depuis la base :`), 20, yNote);
  doc.setFont("helvetica", "normal");
  doc.text(textePdf(parAnneeTexte), 20, yNote + 5, { maxWidth: pageW - 40 });

  const y = Math.max(yNote + 16, doc.internal.pageSize.getHeight() - 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Le DÉPOSITAIRE COMPTABLE", 28, y);
  doc.text("Vu par le CHEF DU SERVICE", pageW - 74, y);
  doc.text("DE LA LOGISTIQUE", pageW - 74, y + 5);

  doc.save(`Bordereau_envoi_${anneeDebut}${anneeFin > anneeDebut ? `-${anneeFin}` : ""}.pdf`);
}

/* ────────────── 2. FICHE DE CENTRALISATION COMPTABLE ────────────── */

export function genererPdfCentralisation({
  annee,
  totalArticles,
  valeurReste,
}: {
  annee: number;
  totalArticles?: number;
  valeurReste?: number;
}): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(textePdf(MINISTERE), pageW / 2, 14, { align: "center" });
  doc.setFontSize(12);
  doc.text(textePdf("FICHE DE CENTRALISATION COMPTABLE"), pageW / 2, 21, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(textePdf(`Exercice ${annee}`), pageW / 2, 27, { align: "center" });

  autoTable(doc, {
    startY: 34,
    head: [["Nomenclature", "Valeur au 1er janvier", "Entrées", "Sorties", "Valeur au 31 décembre"]],
    body: [["", "", "", "", ""]], // pré-rempli à la main ou par les rapports
    styles: { fontSize: 9, halign: "right", cellPadding: 2.4, minCellHeight: 8 },
    headStyles: { fillColor: [230, 230, 230], fontStyle: "bold", halign: "center" },
    margin: { left: 16, right: 16 },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.text(
    textePdf(
      totalArticles != null
        ? `Nombre d'articles recensés : ${totalArticles}`
        : "Nombre d'articles recensés : ………………"
    ),
    16,
    y
  );
  y += 7;
  doc.text(
    textePdf(
      valeurReste != null
        ? `Valeur totale restant au 31 décembre ${annee} : ${valeurReste.toLocaleString("fr-FR")} Ariary`
        : `Valeur totale restant au 31 décembre ${annee} : ……………… Ariary`
    ),
    16,
    y
  );

  y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Le DÉPOSITAIRE COMPTABLE", 28, y);
  doc.text("Le COMPTABLE", pageW - 60, y);

  doc.save(`Fiche_centralisation_${annee}.pdf`);
}

/* ────────────────────────── 3. ATTESTATION ────────────────────────── */

export function genererPdfAttestation({ annee }: { annee: number }): void {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(textePdf(MINISTERE), pageW / 2, 16, { align: "center" });

  doc.setFontSize(13);
  doc.text(textePdf("ATTESTATION"), pageW / 2, 28, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  const paragraphe = [
    "Je soussigné, ………………………………………………, Dépositaire Comptable,",
    "atteste, sur l'honneur, l'exactitude et la sincérité des documents composant",
    "le présent dossier de reddition de compte des matières de l'exercice",
    `${annee}, ainsi que la réalité des quantités et des valeurs qui y sont`,
    "consignées.",
  ];
  paragraphe.forEach((l, i) => doc.text(textePdf(l), pageW / 2, 44 + i * 7, { align: "center" }));

  doc.setFontSize(10);
  doc.text("Fait à Antananarivo, le ……………………………", pageW - 30, 96, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Le DÉPOSITAIRE COMPTABLE", 30, 120);
  doc.text("(signature et cachet)", 30, 126);

  doc.save(`Attestation_${annee}.pdf`);
}
