import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SortieRecord } from "./movements";
import { nombreEnLettresFr, arrondirAriary } from "./nombreEnLettres";

/**
 * BON DE SORTIE / GARDE-RÉCEPTION
 * ---------------------------------------------------------------------------
 * Document accompagnant la remise du matériel au détenteur (sortie validée).
 * Il est établi deux fois dans la vie d'un ordre :
 *   - après la VALIDATION (sortie « validée ») : le bon est imprimé pour
 *     être signé par le détenteur au moment de la remise ;
 *   - après la REMISE (sortie « sortie effectuée ») : réimpression du bon
 *     signé, avec le nom du détenteur, sa fonction, le mandataire éventuel
 *     et la date de remise renseignés par le serveur.
 *
 * La construction du modèle (`modeleBonSortie`) est une fonction PURE : elle
 * ne dépend d'aucun rendu et se teste seule. La génération du PDF reprend la
 * technique des autres documents du projet (jsPDF + jspdf-autotable), sans
 * dépendance supplémentaire.
 */

/** Clause de responsabilité, en formulation neutre (à valider par le ministère). */
export const CLAUSE_RESPONSABILITE =
  "Le détenteur est responsable du matériel désigné ci-dessus. " +
  "En cas de perte ou de non-réintégration, sa responsabilité est engagée.";

// ---------------------------------------------------------------------------
// Modèle du document
// ---------------------------------------------------------------------------

export interface BonSortieLigne {
  /** Numéro de ligne (1, 2, 3…). */
  numero: number;
  designation: string;
  /** Nomenclature de la fiche matériel — chaîne vide si elle n'existe pas. */
  nomenclature: string;
  quantite: number;
  /** Valeur unitaire figée sur l'ordre — null si elle n'est pas renseignée. */
  valeurUnitaire: number | null;
  /** Montant de la ligne — null s'il n'est pas renseigné. */
  montant: number | null;
  /** État constaté par le magasinier — chaîne vide s'il n'est pas renseigné. */
  etat: string;
  /** N° logistique saisi à la signature 3 — chaîne vide s'il n'est pas renseigné. */
  numeroLogistique: string;
}

export interface BonSortieSignataire {
  /** Rôle signataire : MAGASINIER, DÉPOSITAIRE COMPTABLE, CHEF LOGISTIQUE. */
  role: string;
  /** Nom du signataire — chaîne vide s'il n'a pas encore signé. */
  nom: string;
  /** Date de signature posée par le serveur — chaîne vide si absente. */
  date: string;
  /** true quand la signature est enregistrée. */
  signe: boolean;
}

export interface BonSortieDetenteur {
  nom: string;
  fonction: string;
  /** Mandataire mandaté par le détenteur — chaîne vide s'il n'y en a pas. */
  mandataire: string;
  date: string;
}

export interface BonSortieDocument {
  reference: string;
  dateSortie: string;
  dateRemise: string;
  /** Direction destinataire du matériel. */
  direction: string;
  service: string;
  /** Pièce justificative de la sortie. */
  justificatif: string;
  lignes: BonSortieLigne[];
  totalQuantite: number;
  totalMontant: number;
  /** Montant en toutes lettres — chaîne vide si le montant n'est pas connu. */
  montantEnLettres: string;
  signataires: BonSortieSignataire[];
  detenteur: BonSortieDetenteur;
  clause: string;
}

// ---------------------------------------------------------------------------
// Helpers texte / nombres (jsPDF = encodage WinAnsi : on évite les caractères
// spéciaux comme →, ↓, ✓ et les espaces insécables fines)
// ---------------------------------------------------------------------------

function textePdf(value: string): string {
  return (value || "")
    .replace(/ | /g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
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

function dateFr(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Construction du modèle à partir d'une SortieRecord — fonction PURE
// ---------------------------------------------------------------------------

/**
 * Transforme une sortie en modèle de bon de sortie.
 *
 * Ne lève jamais : les données optionnelles absentes (lignes, valuation,
 * état, N° logistique, signatures, détenteur) sont rendues par des chaines
 * vides ou des valeurs nulles, que le PDF sait présenter.
 */
export function modeleBonSortie(sortie: SortieRecord): BonSortieDocument {
  const lignes: BonSortieLigne[] = (sortie.lignes ?? []).map((ligne, index) => {
    const quantite = Number(ligne.quantite) || 0;
    const valeurUnitaire =
      ligne.valeurUnitaire != null ? Number(ligne.valeurUnitaire) || 0 : null;
    // Le montant est celui posé par le serveur ; à défaut, il se déduit de
    // la quantité × la valeur unitaire.
    const montant =
      ligne.montant != null
        ? Number(ligne.montant) || 0
        : valeurUnitaire != null
        ? valeurUnitaire * quantite
        : null;
    return {
      numero: index + 1,
      designation: ligne.designation || "—",
      nomenclature: ligne.materiel?.nomenclature ?? "",
      quantite,
      valeurUnitaire,
      montant,
      etat: ligne.etat ?? "",
      numeroLogistique: ligne.numeroLogistique ?? "",
    };
  });

  const totalQuantite = lignes.reduce((somme, l) => somme + (l.quantite || 0), 0);
  const totalMontant = lignes.reduce((somme, l) => somme + (l.montant ?? 0), 0);

  return {
    reference: sortie.reference || "—",
    dateSortie: sortie.dateSortie || "",
    dateRemise: sortie.dateRemise || "",
    direction: sortie.direction || "—",
    service: sortie.serviceDemandeur || "—",
    justificatif: sortie.justificatif || "—",
    lignes,
    totalQuantite,
    totalMontant,
    montantEnLettres:
      totalMontant > 0
        ? `${nombreEnLettresFr(arrondirAriary(totalMontant))} ARIARY`
        : "",
    signataires: [
      {
        role: "MAGASINIER",
        nom: sortie.signataireMagasinier || "",
        date: sortie.dateSignatureMagasinier || "",
        signe: sortie.magasinier_signed === true,
      },
      {
        role: "DÉPOSITAIRE COMPTABLE",
        nom: sortie.signataireDepositaire || "",
        date: sortie.dateSignatureDepositaire || "",
        signe: sortie.depositaire_signed === true,
      },
      {
        role: "CHEF LOGISTIQUE",
        nom: sortie.signataireLogistique || "",
        date: sortie.dateSignatureLogistique || "",
        signe: sortie.logistique_signed === true,
      },
    ],
    detenteur: {
      nom: sortie.detenteurNom || "",
      fonction: sortie.detenteurFonction || "",
      mandataire: sortie.mandataireNom || "",
      date: sortie.dateRemise || "",
    },
    clause: CLAUSE_RESPONSABILITE,
  };
}

// ---------------------------------------------------------------------------
// Génération du PDF
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
      doc.text(cell.label, x + 1.5, yy + 4.2);
      doc.setDrawColor(100, 116, 139);
      doc.rect(x + wLabel, yy, wValue, hLigne);
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "normal");
      doc.text(textePdf(cell.value || "—"), x + wLabel + 1.5, yy + 4.2, {
        maxWidth: wValue - 3,
      });
      x += wLabel + wValue;
    });
  });
  return y + lignes.length * hLigne;
}

export type ActionPdf = "download" | "preview";

/**
 * Génère le bon de sortie / garde-réception au format PDF.
 *
 * @param bon     modèle produit par `modeleBonSortie`
 * @param action  « download » pour enregistrer le fichier, « preview » pour
 *                l'ouvrir dans un nouvel onglet
 */
export async function genererPdfBonSortie(
  bon: BonSortieDocument,
  action: ActionPdf = "download"
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

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
  doc.setFontSize(8);
  doc.text(
    "COMPTABILITÉ MATIÈRE — GESTION DU PATRIMOINE MATÉRIEL",
    105,
    15,
    { align: "center" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Référence : ${textePdf(bon.reference)}`, 210 - PDF_MARGE, 12, {
    align: "right",
  });
  doc.text(`Date : ${dateFr(bon.dateSortie)}`, 210 - PDF_MARGE, 15.8, {
    align: "right",
  });
  doc.text("Instruction générale du 22 juillet 1955", 210 - PDF_MARGE, 19.6, {
    align: "right",
  });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(PDF_MARGE, 29, 210 - PDF_MARGE, 29);

  // ------------------------------------------------------------------ titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  const titre = "BON DE SORTIE / GARDE-RÉCEPTION";
  doc.text(titre, 105, 38, { align: "center" });
  const largeurTitre = doc.getTextWidth(titre);
  doc.line(105 - largeurTitre / 2, 39.6, 105 + largeurTitre / 2, 39.6);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const intro = doc.splitTextToSize(
    "Le matériel ci-après est remis au détenteur désigné. Le présent bon vaut " +
      "garde-réception : il doit être signé par le détenteur.",
    170
  );
  doc.text(intro, 105, 46, { align: "center" });

  // ------------------------------------------- grille administrative
  let y = 54;
  y = dessinerGrille(
    doc,
    [
      [
        { label: "Référence de l'ordre", value: bon.reference },
        { label: "Date de l'ordre", value: dateFr(bon.dateSortie) },
      ],
      [
        { label: "Direction destinataire", value: bon.direction },
        { label: "Service destinataire", value: bon.service },
      ],
      [
        { label: "Pièce justificative", value: bon.justificatif },
        { label: "Date de remise", value: dateFr(bon.dateRemise) },
      ],
    ],
    y
  );

  // ------------------------------------------------- tableau des matériels
  const avecNomenclature = bon.lignes.some((l) => !!l.nomenclature);

  const head = [["N°", "Désignation du matériel"]];
  if (avecNomenclature) head.push(["Nomenclature"]);
  head.push(["Qté", "P. unitaire", "Montant", "État constaté", "N° logistique"]);

  const body = bon.lignes.map((l) => {
    const ligne = [String(l.numero), l.designation];
    if (avecNomenclature) ligne.push(l.nomenclature || "—");
    ligne.push(
      nombrePdf(l.quantite),
      l.valeurUnitaire == null ? "—" : nombrePdf(l.valeurUnitaire),
      l.montant == null ? "—" : nombrePdf(l.montant),
      l.etat || "—",
      l.numeroLogistique || "—"
    );
    return ligne;
  });

  // Pied du tableau : une seule cellule couvrant toutes les colonnes, le
  // total à droite.
  const nbColonnes = avecNomenclature ? 8 : 7;
  const foot = [
    [
      {
        content: `TOTAL — ${nombrePdf(bon.totalQuantite)} article(s) — ${
          bon.totalMontant > 0 ? montantPdf(bon.totalMontant) : "—"
        }`,
        colSpan: nbColonnes,
        styles: { halign: "right" },
      },
    ],
  ];

  autoTable(doc, {
    head,
    body,
    foot,
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
    columnStyles: avecNomenclature
      ? {
          0: { cellWidth: 8 },
          1: { cellWidth: 52 },
          2: { cellWidth: 20 },
          3: { cellWidth: 12, halign: "right" },
          4: { cellWidth: 20, halign: "right" },
          5: { cellWidth: 22, halign: "right" },
          6: { cellWidth: 22 },
          7: { cellWidth: 24 },
        }
      : {
          0: { cellWidth: 8 },
          1: { cellWidth: 60 },
          2: { cellWidth: 12, halign: "right" },
          3: { cellWidth: 20, halign: "right" },
          4: { cellWidth: 22, halign: "right" },
          5: { cellWidth: 24 },
          6: { cellWidth: 30 },
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

  // ------------------------------------------------- arrêté du montant
  if (bon.montantEnLettres) {
    assurerEspace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const arrete = doc.splitTextToSize(
      `Arrêté à la somme de : ${textePdf(bon.montantEnLettres)}`,
      PDF_LARGEUR
    );
    doc.text(arrete, PDF_MARGE, cur);
    cur += arrete.length * 4.5 + 4;
  }

  // ------------------------------------------------------------- signatures
  assurerEspace(40);
  const boiteW = (PDF_LARGEUR - 8) / 3;
  const boiteH = 34;
  bon.signataires.forEach((signataire, i) => {
    const x = PDF_MARGE + i * (boiteW + 4);
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.rect(x, cur, boiteW, boiteH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(textePdf(signataire.role), x + 2, cur + 4.5, {
      maxWidth: boiteW - 4,
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`Nom : ${textePdf(signataire.nom || "—")}`, x + 2, cur + 9.5, {
      maxWidth: boiteW - 4,
    });
    doc.text(
      signataire.signe
        ? `Signé le ${dateFr(signataire.date)}`
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

  // ------------------------------------------------- bloc détenteur
  assurerEspace(52);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.rect(PDF_MARGE, cur, PDF_LARGEUR, 44);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("GARDE-RÉCEPTION — REPRISE PAR LE DÉTENTEUR", PDF_MARGE + 3, cur + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const detenteur = bon.detenteur;
  doc.text(`Nom : ${textePdf(detenteur.nom || "—")}`, PDF_MARGE + 3, cur + 12, {
    maxWidth: 120,
  });
  doc.text(
    `Fonction : ${textePdf(detenteur.fonction || "—")}`,
    PDF_MARGE + 3,
    cur + 17.5,
    { maxWidth: 120 }
  );
  // Le mandataire n'apparaît que s'il existe.
  if (detenteur.mandataire) {
    doc.text(
      `Retiré par (mandataire) : ${textePdf(detenteur.mandataire)}`,
      PDF_MARGE + 3,
      cur + 23,
      { maxWidth: 120 }
    );
  }
  doc.text(`Date : ${dateFr(detenteur.date)}`, PDF_MARGE + 3, cur + 28.5);

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.2);
  doc.line(PDF_MARGE + 125, cur + 36, 210 - PDF_MARGE - 3, cur + 36);
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Signature du détenteur", PDF_MARGE + 125, cur + 40, {
    align: "center",
  });
  cur += 48;

  // ------------------------------------------------------------- clause
  assurerEspace(16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const clause = doc.splitTextToSize(textePdf(bon.clause), PDF_LARGEUR);
  doc.text(clause, PDF_MARGE, cur);
  cur += clause.length * 4 + 4;

  // ------------------------------------------------------------- pieds page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${bon.reference} — BON DE SORTIE / GARDE-RÉCEPTION — page ${p}/${totalPages}`,
      105,
      292,
      { align: "center" }
    );
  }

  const nomFichier = `Bon_sortie_${bon.reference.replace(/[^\w-]/g, "")}.pdf`;
  if (action === "preview") {
    window.open(doc.output("bloburl"), "_blank");
  } else {
    doc.save(nomFichier);
  }
}
