// ---------------------------------------------------------------------------
// Document « ORDRE D'ENTRÉE » — génération PDF et Excel
//
//  - PDF réel (jsPDF + autoTable) : pas une capture d'écran, un document
//    imprimable A4 avec en-tête administratif, Direction/Service, références
//    administratives, fournisseur, facture, tableau des matériels, totaux,
//    déclaration de prise en charge, responsables, statut, QR Code, date et
//    historique de validation.
//  - Excel .xlsx réel (exceljs) : A4, orientation paysage, cellules fusionnées,
//    bordures, titres, totaux, zone de signatures, zone de prise en charge et
//    QR Code. Mise en page imprimable.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import QRCode from "qrcode";
import {
  EntreeRecord,
  TYPE_OPERATION_LABELS,
  getSignatureCount,
  getSignaturesEntree,
  getStatutEntreeAffiche,
} from "./movements";
import { getHistoriqueAffectations } from "./transfers";

// ---------------------------------------------------------------------------
// Structure normalisée du document
// ---------------------------------------------------------------------------

export interface OrdreEntreeLigne {
  numero: number;
  reference: string;
  designation: string;
  espece: string;
  unite: string;
  quantite: number;
  prixUnitaire: number;
  valeur: number;
  piece: string;
  observation: string;
}

export interface OrdreEntreeSignature {
  label: string;
  nom: string;
  signe: boolean;
  date?: string;
}

export interface OrdreEntreeDocument {
  reference: string;
  dateEntree: string;
  admin: EntreeRecord["admin"];
  direction: string;
  service: string;
  depositaire: string;
  chefService1: string;
  chefService2: string;
  fournisseur: string;
  numeroFacture: string;
  lignes: OrdreEntreeLigne[];
  total: number;
  statut: string;
  nbSignatures: number;
  signatures: OrdreEntreeSignature[];
  historique: Array<{ date: string; libelle: string; detail: string }>;
  qrValeur: string;
  demandeur: string;
  typeOperation: string;
}

// ---------------------------------------------------------------------------
// Helpers texte / nombres (jsPDF = encodage WinAnsi : on évite les caractères
// spéciaux comme →, ↓, ✓ et les espaces insécables fines)
// ---------------------------------------------------------------------------

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒<-]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function nombrePdf(n: number): string {
  const value = Math.round((Number(n) || 0) * 100) / 100;
  const [entier, dec] = String(value).split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${groupe}.${dec}` : groupe;
}

function montantPdf(n: number): string {
  return `${nombrePdf(n)} Ar`;
}

function dateFr(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Construction du document à partir d'une EntreeRecord
// ---------------------------------------------------------------------------

export function construireOrdreEntree(e: EntreeRecord): OrdreEntreeDocument {
  const lignes: OrdreEntreeLigne[] =
    e.lignes && e.lignes.length > 0
      ? e.lignes.map((l) => ({
          numero: l.numeroOrdre,
          reference: l.reference || "—",
          designation: l.designation,
          espece: l.espece || "—",
          unite: l.unite || "Unité",
          quantite: Number(l.quantite) || 0,
          prixUnitaire: Number(l.prixUnitaire) || 0,
          valeur: Number(l.montant) || 0,
          piece: l.pieceJustificative || e.numeroFacture || "—",
          observation: l.observation || "—",
        }))
      : [
          {
            numero: 1,
            reference: "—",
            designation: e.materiel,
            espece: e.categorie,
            unite: "Unité",
            quantite: e.quantite,
            prixUnitaire: 0,
            valeur: Number(e.total) || 0,
            piece: e.numeroFacture,
            observation: "—",
          },
        ];

  const total =
    e.total ?? lignes.reduce((s, l) => s + (Number(l.valeur) || 0), 0);

  const signatures: OrdreEntreeSignature[] = getSignaturesEntree(e).map((s) => ({
    label: s.label,
    nom:
      e.signataires?.[
        s.key === "depositaire"
          ? "depositaire"
          : s.key === "chefService1"
          ? "chefService1"
          : "chefService2"
      ] || "—",
    signe: s.signed,
    date: s.date,
  }));

  const depositaire = e.affectations?.depositaire || signatures[0]?.nom || "—";
  const chefService1 = e.affectations?.chefService1 || signatures[1]?.nom || "—";
  const chefService2 = e.affectations?.chefService2 || signatures[2]?.nom || "—";

  const statut = getStatutEntreeAffiche(e);
  const nbSignatures = getSignatureCount(e);

  const historique: Array<{ date: string; libelle: string; detail: string }> = [
    {
      date: e.dateEntree,
      libelle: "Création de l'entrée",
      detail: `Saisie par ${e.responsable || "—"} — statut « En attente » (0/3)`,
    },
    {
      date: e.dateEntree,
      libelle: "Vérification",
      detail: `Direction ${e.direction} / Service ${e.service} — fournisseur ${e.fournisseur}`,
    },
  ];
  for (const s of signatures) {
    if (s.signe) {
      historique.push({
        date: s.date || e.dateEntree,
        libelle: `Validation ${s.label}`,
        detail: `Signé par ${s.nom !== "—" ? s.nom : e.signataires?.depositaire || "le responsable habilité"}`,
      });
    }
  }
  if (statut === "Validée") {
    historique.push({
      date: signatures[2]?.date || e.dateEntree,
      libelle: "Entrée validée",
      detail: "3/3 signatures réunies — matériel enregistré au stock du service",
    });
  }
  for (const ev of getHistoriqueAffectations(e.reference)) {
    historique.push({ date: ev.date, libelle: ev.libelle, detail: ev.detail });
  }

  return {
    reference: e.reference,
    dateEntree: e.dateEntree,
    admin: e.admin,
    direction: e.direction,
    service: e.service,
    depositaire,
    chefService1,
    chefService2,
    fournisseur: e.fournisseur,
    numeroFacture: e.numeroFacture,
    lignes,
    total,
    statut,
    nbSignatures,
    signatures,
    historique,
    qrValeur: `comptamatiere:entree:${e.qrToken || e.reference}`,
    demandeur: e.responsable || "—",
    typeOperation: (e.admin?.typeOperation &&
      TYPE_OPERATION_LABELS[e.admin.typeOperation]) || "—",
  };
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
// PDF (jsPDF)
// ---------------------------------------------------------------------------

const PDF_MARGE = 14;
const PDF_LARGEUR = 210 - PDF_MARGE * 2; // 182 mm

interface GrilleCell {
  label: string;
  value: string;
}

function dessinerGrille(
  doc: jsPDF,
  lignes: Array<[GrilleCell, GrilleCell]>,
  y: number
): number {
  const hLigne = 6.5;
  const largeurs = [44, 47, 44, 47]; // = 182
  lignes.forEach((pair, index) => {
    const yy = y + index * hLigne;
    let x = PDF_MARGE;
    [pair[0], pair[1]].forEach((cell, cellIndex) => {
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
      doc.setDrawColor(100, 116, 139);
      doc.rect(x, yy, wValue, hLigne);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(textePdf(cell.value || "—"), x + 1.5, yy + 4.3, {
        maxWidth: wValue - 3,
      });
      x += wValue;
    });
  });
  return y + lignes.length * hLigne;
}

export type ActionPdf = "download" | "preview";

export async function genererPdfOrdreEntree(
  ordre: OrdreEntreeDocument,
  action: ActionPdf = "download"
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const qrDataUrl = await genererQrDataUrl(ordre.qrValeur);

  // ---------------------------------------------------------------- en-tête
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("MINISTÈRE DE LA FONCTION PUBLIQUE", PDF_MARGE, 12);
  doc.text("DE LA RÉFORME DE L'ADMINISTRATION", PDF_MARGE, 15.8);
  doc.text("DU TRAVAIL ET DES LOIS SOCIALES", PDF_MARGE, 19.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Budget général", PDF_MARGE, 25);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("MODÈLE N°7", 105, 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Référence : ${textePdf(ordre.reference)}`, 210 - PDF_MARGE, 12, {
    align: "right",
  });
  doc.text(`Date : ${dateFr(ordre.dateEntree)}`, 210 - PDF_MARGE, 15.8, {
    align: "right",
  });
  doc.text(
    "Instruction générale du 22 juillet 1955",
    210 - PDF_MARGE,
    19.6,
    { align: "right" }
  );

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(PDF_MARGE, 29, 210 - PDF_MARGE, 29);

  // ------------------------------------------------------------------ titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  const titre = "ORDRE D'ENTRÉE";
  doc.text(titre, 105, 38, { align: "center" });
  const largeurTitre = doc.getTextWidth(titre);
  doc.line(105 - largeurTitre / 2, 39.6, 105 + largeurTitre / 2, 39.6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize(
    "Seront portés en entrée dans les écritures de comptabilité matière les matières et objets ci-après désignés.",
    170
  );
  doc.text(intro, 105, 46, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`Type de matériel : ${textePdf(ordre.typeOperation)}`, 105, 55, {
    align: "center",
  });

  // ------------------------------------------- grille administrative (9 lignes)
  const admin = ordre.admin;
  let y = 62;
  y = dessinerGrille(
    doc,
    [
      [
        { label: "Numéro du chapitre", value: admin?.numeroChapitre },
        { label: "N° d'ordre du journal", value: admin?.numeroOrdreJournal },
      ],
      [
        { label: "Libellé du chapitre", value: admin?.libelleChapitre },
        { label: "Date", value: dateFr(ordre.dateEntree) },
      ],
      [
        {
          label: "Subdivision du chapitre",
          value: admin?.subdivisionChapitre,
        },
        { label: "SOA", value: admin?.soa },
      ],
      [
        { label: "Direction", value: ordre.direction },
        { label: "Service", value: ordre.service },
      ],
      [
        { label: "Dépositaire du service", value: ordre.depositaire },
        { label: "Chef de service 1", value: ordre.chefService1 },
      ],
      [
        { label: "Chef de service 2", value: ordre.chefService2 },
        { label: "Demandeur", value: ordre.demandeur },
      ],
      [
        { label: "Fournisseur", value: ordre.fournisseur },
        { label: "N° facture", value: ordre.numeroFacture },
      ],
      [
        { label: "Date de facture", value: dateFr(admin?.dateFacture) },
        {
          label: "Bon de livraison",
          value: admin?.bonLivraison
            ? `${admin.bonLivraison}${
                admin.dateBonLivraison
                  ? ` du ${dateFr(admin.dateBonLivraison)}`
                  : ""
              }`
            : "",
        },
      ],
      [
        { label: "Motif de l'entrée", value: admin?.motifEntree },
        { label: "Pièce justificative", value: admin?.pieceJustificative },
      ],
    ].map((paire) => paire as [GrilleCell, GrilleCell]),
    y
  );

  // ------------------------------------------------- tableau des matériels
  const head = [
    [
      "N°",
      "Référence",
      "Désignation des matières et objets",
      "Espèce",
      "Unité",
      "Qté",
      "Prix unitaire",
      "Valeur",
      "Pièce just.",
      "Observation",
    ],
  ];
  const body = ordre.lignes.map((l) => [
    String(l.numero),
    l.reference,
    l.designation,
    l.espece,
    l.unite,
    nombrePdf(l.quantite),
    nombrePdf(l.prixUnitaire),
    nombrePdf(l.valeur),
    l.piece,
    l.observation,
  ]);

  autoTable(doc, {
    head,
    body,
    foot: [
      [
        { content: "TOTAL", colSpan: 7, styles: { halign: "right" } },
        { content: montantPdf(ordre.total), styles: { halign: "right" } },
        { content: "", colSpan: 2 },
      ],
    ],
    startY: y + 6,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 1.4,
      textColor: [15, 23, 42],
      lineColor: [100, 116, 139],
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      fontStyle: "bold",
      textColor: [15, 23, 42],
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 20 },
      2: { cellWidth: 40 },
      3: { cellWidth: 17 },
      4: { cellWidth: 12 },
      5: { cellWidth: 10, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 19 },
      9: { cellWidth: 20 },
    },
    margin: { left: PDF_MARGE, right: PDF_MARGE },
  });

  const finalY = (): number =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 20;

  let cur = finalY() + 6;

  const assurerEspace = (besoin: number) => {
    if (cur + besoin > 280) {
      doc.addPage();
      cur = 20;
    }
  };

  // --------------------------------------------------------- prise en charge
  assurerEspace(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("PRISE EN CHARGE", PDF_MARGE, cur);
  cur += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  const priseEnCharge = doc.splitTextToSize(
    `Le comptable dépositaire prend en charge les matières et objets désignés ci-dessus, dont la valeur totale s'élève à ${montantPdf(
      ordre.total
    )}. Déclaration en date du ${dateFr(
      ordre.admin?.declarationDate || ordre.dateEntree
    )}.`,
    PDF_LARGEUR
  );
  doc.text(priseEnCharge, PDF_MARGE, cur);
  cur += priseEnCharge.length * 4 + 4;

  // ------------------------------------------------------------- signatures
  assurerEspace(38);
  const boiteW = (PDF_LARGEUR - 8) / 3;
  const boiteH = 34;
  const blocs: Array<{ label: string; sig: OrdreEntreeSignature | undefined }> =
    [
      { label: "DÉPOSITAIRE DU SERVICE", sig: ordre.signatures[0] },
      { label: "CHEF DE SERVICE 1", sig: ordre.signatures[1] },
      { label: "CHEF DE SERVICE 2", sig: ordre.signatures[2] },
    ];
  blocs.forEach((bloc, i) => {
    const x = PDF_MARGE + i * (boiteW + 4);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.rect(x, cur, boiteW, boiteH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(bloc.label, x + 2, cur + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    const nom = textePdf(
      bloc.sig?.signe
        ? bloc.sig.nom
        : bloc.label === "DÉPOSITAIRE DU SERVICE"
        ? ordre.depositaire
        : bloc.label === "CHEF DE SERVICE 1"
        ? ordre.chefService1
        : ordre.chefService2
    );
    doc.text(`Nom : ${nom || "—"}`, x + 2, cur + 9.5, {
      maxWidth: boiteW - 4,
    });
    doc.text(
      bloc.sig?.signe
        ? `Signé le ${dateFr(bloc.sig.date)}`
        : "En attente de signature",
      x + 2,
      cur + 14.5,
      { maxWidth: boiteW - 4 }
    );
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.2);
    doc.line(x + 4, cur + 28, x + boiteW - 4, cur + 28);
    doc.setFontSize(6.5);
    doc.text("Signature", x + boiteW / 2, cur + 31.5, { align: "center" });
  });
  cur += boiteH + 8;

  // ------------------------------------------------ statut + QR Code + date
  assurerEspace(40);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
  doc.rect(PDF_MARGE, cur, PDF_LARGEUR, 34, "FD");
  doc.addImage(qrDataUrl, "PNG", PDF_MARGE + 4, cur + 4, 26, 26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("STATUT ET IDENTIFICATION", PDF_MARGE + 36, cur + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Statut : ${textePdf(ordre.statut)} (${ordre.nbSignatures}/3)`, PDF_MARGE + 36, cur + 13);
  doc.text(`Référence : ${textePdf(ordre.reference)}`, PDF_MARGE + 36, cur + 18);
  doc.text(
    `Édité le : ${dateFr(new Date().toISOString())} — ComptaMatière`,
    PDF_MARGE + 36,
    cur + 23
  );
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7);
  doc.text(
    "QR Code : le scan identifie l'entrée ; la validation exige une authentification et un rôle habilité.",
    PDF_MARGE + 36,
    cur + 29,
    { maxWidth: PDF_LARGEUR - 80 }
  );
  cur += 42;

  // -------------------------------------------------- historique validation
  assurerEspace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("HISTORIQUE DE VALIDATION", PDF_MARGE, cur);
  cur += 5;
  doc.setFontSize(7.5);
  for (const evenement of ordre.historique) {
    assurerEspace(6);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(dateFr(evenement.date), PDF_MARGE, cur);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    const ligne = `${evenement.libelle} — ${evenement.detail}`;
    doc.text(textePdf(ligne), PDF_MARGE + 22, cur, {
      maxWidth: PDF_LARGEUR - 22,
    });
    cur += 4.2;
  }

  // ------------------------------------------------------------- pieds page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${ordre.reference} — ORDRE D'ENTRÉE — page ${p}/${totalPages}`,
      105,
      292,
      { align: "center" }
    );
  }

  const nomFichier = `Ordre_entree_${ordre.reference.replace(/[^\w-]/g, "")}.pdf`;
  if (action === "preview") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(nomFichier);
  }
}

// ---------------------------------------------------------------------------
// Excel .xlsx (exceljs) — A4 paysage, fusionné, bordures, signatures, QR
// ---------------------------------------------------------------------------

const ARGENT_TITRE = "FF1E3A8A"; // bleu nuit
const ARGENT_HEADER = "FF1F4E79";
const ARGENT_CLAIR = "FFEFF3F8";
const BORDURE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF64748B" } },
  left: { style: "thin", color: { argb: "FF64748B" } },
  bottom: { style: "thin", color: { argb: "FF64748B" } },
  right: { style: "thin", color: { argb: "FF64748B" } },
};

export async function genererExcelOrdreEntree(
  ordre: OrdreEntreeDocument
): Promise<void> {
  const qrBase64 = (await genererQrDataUrl(ordre.qrValeur)).replace(
    /^data:image\/png;base64,/,
    ""
  );

  const wb = new ExcelJS.Workbook();
  // NB : pas d'apostrophe dans le nom de feuille — elle casserait le
  // definedName de la zone d'impression (« Ordre d'entrée »).
  const ws = wb.addWorksheet("ORDRE ENTREE", {
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

  // 10 colonnes (A..J)
  const largeurs = [6, 18, 34, 16, 12, 10, 16, 18, 20, 24];
  largeurs.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  let ligne = 1;

  /** Applique les bordures sur TOUTES les cellules d'une plage (avant fusion)
   *  pour que le cadre du tableau fusionné soit dessiné par Excel. */
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
    appliquerBordures(plage); // avant fusion : Excel garde les bordures de contour
    ws.mergeCells(plage);
    const cell = ws.getCell(plage.split(":")[0]);
    cell.value = valeur;
    cell.alignment = { vertical: "middle", wrapText: true };
    if (style?.font) cell.font = style.font;
    if (style?.alignment) cell.alignment = { ...cell.alignment, ...style.alignment };
    if (style?.fill) cell.fill = style.fill;
    return cell;
  };

  // ----------------------------------------------------------- en-tête
  fusionner(
    `A${ligne}:J${ligne}`,
    "MINISTÈRE DE LA FONCTION PUBLIQUE — DE LA RÉFORME DE L'ADMINISTRATION DU TRAVAIL ET DES LOIS SOCIALES",
    {
      font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_TITRE } },
    }
  );
  ws.getRow(ligne).height = 26;
  ligne += 1;

  fusionner(`A${ligne}:E${ligne}`, "Budget général — MODÈLE N°7 — Instruction générale du 22 juillet 1955", {
    font: { italic: true, size: 9, color: { argb: "FF334155" } },
  });
  fusionner(
    `F${ligne}:J${ligne}`,
    `Référence : ${ordre.reference}   |   Date : ${dateFr(ordre.dateEntree)}`,
    { font: { bold: true, size: 10 }, alignment: { horizontal: "right" } }
  );
  ws.getRow(ligne).height = 18;
  ligne += 1;

  fusionner(`A${ligne}:J${ligne}`, "ORDRE D'ENTRÉE", {
    font: { bold: true, size: 18, color: { argb: ARGENT_TITRE } },
    alignment: { horizontal: "center" },
  });
  ws.getRow(ligne).height = 30;
  ligne += 1;

  fusionner(
    `A${ligne}:J${ligne}`,
    "Seront portés en entrée dans les écritures de comptabilité matière les matières et objets ci-après désignés.",
    { font: { italic: true, size: 10 }, alignment: { horizontal: "center" } }
  );
  ws.getRow(ligne).height = 20;
  ligne += 1;

  fusionner(`A${ligne}:J${ligne}`, `Type de matériel : ${ordre.typeOperation}`, {
    font: { bold: true, size: 10 },
    alignment: { horizontal: "center" },
  });
  ws.getRow(ligne).height = 18;
  ligne += 2;

  // ------------------------------------------------ informations (fusion A:B / C:E / F:G / H:J)
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

  const admin = ordre.admin;
  infoLigne("Numéro du chapitre", admin?.numeroChapitre || "—", "N° d'ordre du journal", admin?.numeroOrdreJournal || "—");
  infoLigne("Libellé du chapitre", admin?.libelleChapitre || "—", "Date", dateFr(ordre.dateEntree));
  infoLigne("Subdivision du chapitre", admin?.subdivisionChapitre || "—", "SOA", admin?.soa || "—");
  infoLigne("Direction", ordre.direction, "Service", ordre.service);
  infoLigne("Dépositaire du service", ordre.depositaire, "Chef de service 1", ordre.chefService1);
  infoLigne("Chef de service 2", ordre.chefService2, "Demandeur", ordre.demandeur);
  infoLigne("Fournisseur", ordre.fournisseur, "N° facture", ordre.numeroFacture);
  infoLigne(
    "Date de facture",
    dateFr(admin?.dateFacture),
    "Bon de livraison",
    admin?.bonLivraison
      ? `${admin.bonLivraison}${admin.dateBonLivraison ? ` du ${dateFr(admin.dateBonLivraison)}` : ""}`
      : "—"
  );
  infoLigne("Motif de l'entrée", admin?.motifEntree || "—", "Pièce justificative", admin?.pieceJustificative || ordre.numeroFacture);
  ligne += 1;

  // ------------------------------------------------------ tableau des matériels
  const entetes = [
    "N°",
    "Référence",
    "Désignation des matières et objets",
    "Espèce",
    "Unité",
    "Quantité",
    "Prix unitaire",
    "Valeur",
    "N° pièce justificative",
    "Observation",
  ];
  const rowEntete = ws.getRow(ligne);
  entetes.forEach((t, i) => {
    const cell = rowEntete.getCell(i + 1);
    cell.value = t;
    cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDURE;
  });
  rowEntete.height = 26;
  ligne += 1;

  for (const l of ordre.lignes) {
    const row = ws.getRow(ligne);
    const valeurs: ExcelJS.CellValue[] = [
      l.numero,
      l.reference,
      l.designation,
      l.espece,
      l.unite,
      l.quantite,
      l.prixUnitaire,
      l.valeur,
      l.piece,
      l.observation,
    ];
    valeurs.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { size: 9 };
      cell.border = BORDURE;
      cell.alignment = {
        vertical: "middle",
        wrapText: i === 2 || i === 9,
        horizontal: i >= 5 && i <= 7 ? "right" : "left",
      };
      if (i === 6 || i === 7) cell.numFmt = '#,##0" Ar"';
      if (i === 5) cell.numFmt = "#,##0";
    });
    row.height = 18;
    ligne += 1;
  }

  // TOTAL (fusion A:G + valeur en H + I:J vides)
  const rowTotal = ws.getRow(ligne);
  for (let c = 1; c <= 10; c += 1) {
    rowTotal.getCell(c).border = BORDURE;
    rowTotal.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: ARGENT_CLAIR },
    };
  }
  ws.mergeCells(`A${ligne}:G${ligne}`);
  const cellTotalLabel = ws.getCell(`A${ligne}`);
  cellTotalLabel.value = "TOTAL";
  cellTotalLabel.font = { bold: true, size: 11 };
  cellTotalLabel.alignment = { horizontal: "right", vertical: "middle" };
  const cellTotal = ws.getCell(`H${ligne}`);
  cellTotal.value = ordre.total;
  cellTotal.numFmt = '#,##0" Ar"';
  cellTotal.font = { bold: true, size: 11, color: { argb: ARGENT_TITRE } };
  cellTotal.alignment = { horizontal: "right", vertical: "middle" };
  ws.mergeCells(`I${ligne}:J${ligne}`);
  rowTotal.height = 22;
  ligne += 2;

  // -------------------------------------------------------- prise en charge
  fusionner(
    `A${ligne}:J${ligne}`,
    `PRISE EN CHARGE — Le comptable dépositaire prend en charge les matières et objets désignés ci-dessus, dont la valeur totale s'élève à ${nombrePdf(
      ordre.total
    )} Ariary. Déclaration en date du ${dateFr(
      admin?.declarationDate || ordre.dateEntree
    )}.`,
    { font: { italic: true, size: 10 } }
  );
  ws.getRow(ligne).height = 34;
  ligne += 2;

  // ------------------------------------------------------ zone de signatures
  fusionner(`A${ligne}:J${ligne}`, "VALIDATION PAR LES RESPONSABLES DU SERVICE", {
    font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
    alignment: { horizontal: "center" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
  });
  ws.getRow(ligne).height = 20;
  ligne += 1;

  const blocs: Array<{ plage: [string, string]; label: string; sig: OrdreEntreeSignature | undefined; nom: string }> = [
    { plage: ["A", "D"], label: "DÉPOSITAIRE DU SERVICE", sig: ordre.signatures[0], nom: ordre.depositaire },
    { plage: ["E", "G"], label: "CHEF DE SERVICE 1", sig: ordre.signatures[1], nom: ordre.chefService1 },
    { plage: ["H", "J"], label: "CHEF DE SERVICE 2", sig: ordre.signatures[2], nom: ordre.chefService2 },
  ];
  const rLabel = ligne;
  const rNom = ligne + 1;
  const rStatut = ligne + 2;
  const rSig = ligne + 3;
  for (const bloc of blocs) {
    const [debut, fin] = bloc.plage;
    fusionner(`${debut}${rLabel}:${fin}${rLabel}`, bloc.label, {
      font: { bold: true, size: 10 },
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_CLAIR } },
    });
    fusionner(
      `${debut}${rNom}:${fin}${rNom}`,
      `Nom : ${bloc.sig?.signe ? bloc.sig.nom : bloc.nom || "—"}`,
      { font: { size: 9 }, alignment: { horizontal: "center" } }
    );
    fusionner(
      `${debut}${rStatut}:${fin}${rStatut}`,
      bloc.sig?.signe
        ? `Signé le ${dateFr(bloc.sig.date)}`
        : "En attente de signature",
      {
        font: { size: 9, bold: !!bloc.sig?.signe, color: { argb: bloc.sig?.signe ? "FF15803D" : "FFB45309" } },
        alignment: { horizontal: "center" },
      }
    );
    fusionner(`${debut}${rSig}:${fin}${rSig}`, "Signature :", {
      font: { size: 9, italic: true },
      alignment: { horizontal: "center" },
    });
  }
  ws.getRow(rLabel).height = 18;
  ws.getRow(rNom).height = 18;
  ws.getRow(rStatut).height = 18;
  ws.getRow(rSig).height = 46;
  ligne = rSig + 2;

  // ------------------------------------------------ QR Code + statut
  fusionner(`A${ligne}:J${ligne}`, `QR CODE — ${ordre.reference} — Statut : ${ordre.statut} (${ordre.nbSignatures}/3 signatures)`, {
    font: { bold: true, size: 10, color: { argb: "FFFFFFFF" } },
    alignment: { horizontal: "center" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
  });
  ws.getRow(ligne).height = 20;
  ligne += 1;

  const imageId = wb.addImage({ base64: qrBase64, extension: "png" });
  ws.addImage(imageId, {
    tl: { col: 0.1, row: ligne - 0.1 },
    ext: { width: 110, height: 110 },
  });
  fusionner(
    `B${ligne}:J${ligne}`,
    `Le scan du QR Code identifie l'entrée ${ordre.reference} et permet de consulter ses informations selon les permissions. La validation exige une authentification et un rôle habilité (aucune signature électronique).\n\nÉdité le ${dateFr(
      new Date().toISOString()
    )} — ComptaMatière`,
    { font: { size: 9 } }
  );
  ws.getRow(ligne).height = 62;
  ligne += 7;

  // -------------------------------------------------------- historique
  fusionner(`A${ligne}:J${ligne}`, "HISTORIQUE DE VALIDATION", {
    font: { bold: true, size: 11, color: { argb: "FFFFFFFF" } },
    alignment: { horizontal: "center" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: ARGENT_HEADER } },
  });
  ws.getRow(ligne).height = 20;
  ligne += 1;
  for (const ev of ordre.historique) {
    const row = ws.getRow(ligne);
    for (let c = 1; c <= 10; c += 1) row.getCell(c).border = BORDURE;
    ws.mergeCells(`A${ligne}:B${ligne}`);
    const cellDate = row.getCell(1);
    cellDate.value = dateFr(ev.date);
    cellDate.font = { size: 9, bold: true };
    cellDate.alignment = { vertical: "middle" };
    ws.mergeCells(`C${ligne}:J${ligne}`);
    const cellLib = row.getCell(3);
    cellLib.value = `${ev.libelle} — ${ev.detail}`;
    cellLib.font = { size: 9 };
    cellLib.alignment = { vertical: "middle", wrapText: true };
    row.height = 16;
    ligne += 1;
  }

  // -------------------------------------------------------------- impression
  ws.headerFooter = { oddFooter: "&C&\"Helvetica\"&8 " + ordre.reference + " — Ordre d'entrée — Page &P / &N" };
  ws.pageSetup.printArea = `A1:J${ligne}`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Ordre_entree_${ordre.reference.replace(/[^\w-]/g, "")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
