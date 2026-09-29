// ---------------------------------------------------------------------------
// Document « PROCÈS-VERBAL DE RECENSEMENT » annuel — génération PDF.
//
// Texte officiel avec : date, membres de la commission, total des articles
// et de la valeur (calculés depuis l'inventaire de l'année), signatures.
// ---------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import type { Inventaire } from "./reddition";
import { nombreEnLettresFr, arrondirAriary } from "./nombreEnLettres";
import { MINISTERE } from "./redditionDocuments";

function textePdf(value: string): string {
  return (value || "")
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[→↓↑⇐⇒]/g, "-")
    .replace(/✓/g, "OK")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export interface MembreCommission {
  nom: string;
  fonction: string;
}

/**
 * Génère le PV de recensement de l'année. Les totaux proviennent de
 * l'inventaire annuel calculé (sections → articles → valeurs reste).
 */
export function genererPdfRecensement(
  inventaire: Inventaire,
  {
    membres = [],
    lieu = "Antananarivo",
    date = "",
    nomMinistere = MINISTERE,
  }: {
    membres?: MembreCommission[];
    lieu?: string;
    date?: string;
    nomMinistere?: string;
  } = {}
): void {
  const annee = inventaire.annee;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const marge = 22;
  let y = 20;

  const ligne = (t: string, { bold = false, center = false, size = 10.5, gap = 6.5 } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(textePdf(t), center ? pageW / 2 : marge, y, {
      align: center ? "center" : "left",
      maxWidth: pageW - marge * 2,
    });
    y += gap;
  };

  // En-tête
  ligne(nomMinistere, { bold: true, center: true, size: 10 });
  y += 4;
  ligne("PROCÈS-VERBAL DE RECENSEMENT DES MATIÈRES", { bold: true, center: true, size: 13 });
  ligne(`Exercice ${annee}`, { center: true, size: 10.5 });
  y += 6;

  // Corps
  const nbArticles = inventaire.sections.reduce((t, s) => t + s.articles.length, 0);
  const valeur = arrondirAriary(
    inventaire.sections.reduce((t, s) => t + s.totaux.valeurs.reste, 0)
  );

  ligne(
    `L'an deux mille ${annee > 2000 ? `vingt-${String(annee).slice(2)}` : ""} et le ……………………,`,
    { gap: 7 }
  );
  ligne(
    "Nous, membres de la commission de recensement des matières, désignés par",
    { gap: 7 }
  );
  ligne("décision n° …………………… du …………………… :", { gap: 9 });

  const commission: MembreCommission[] =
    membres.length > 0
      ? membres
      : [
          { nom: "……………………………………", fonction: "Dépositaire Comptable" },
          { nom: "……………………………………", fonction: "Magasinier" },
          { nom: "……………………………………", fonction: "Chef du Service de la Logistique" },
        ];
  for (const m of commission) {
    ligne(`— ${m.nom}, ${m.fonction}`, { gap: 7 });
  }
  y += 3;

  ligne("Avons procédé au recensement des matières placées sous notre responsabilité.", { gap: 9 });
  ligne("Ce recensement a porté sur la totalité du matériel existant au", { gap: 7 });
  ligne(`31 décembre ${annee}, soit :`, { gap: 9 });

  ligne(
    `${nbArticles} article(s) — ${nombreEnLettresFr(nbArticles)} ARTICLES,`,
    { bold: true, gap: 8 }
  );
  ligne(
    `pour une valeur totale de ${valeur.toLocaleString("fr-FR")} Ariary`,
    { bold: true, gap: 8 }
  );
  ligne(`(${nombreEnLettresFr(valeur)} ARIARY).`, { bold: true, gap: 10 });

  ligne(
    "Il n'a été constaté, sauf erreur ou omission, aucune différence entre le",
    { gap: 7 }
  );
  ligne(
    "recensement matériel et les écritures du grand-livre.",
    { gap: 12 }
  );

  ligne("En foi de quoi, le présent procès-verbal a été établi pour servir et valoir", { gap: 7 });
  ligne("ce que de droit.", { gap: 14 });

  // Signatures
  ligne(`Fait à ${lieu}, le ${date || "…………………………"}`, { gap: 12 });
  for (const m of commission) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(textePdf(m.fonction), marge, y, { maxWidth: 50 });
    doc.text(textePdf(m.nom), marge, y + 4, { maxWidth: 50 });
    y += 18;
  }

  doc.save(`PV_recensement_${annee}.pdf`);
}
