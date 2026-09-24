// Journal de comptabilité matière — store partagé (localStorage).
//
// L'écran Journal.tsx démarre avec un jeu de démonstration. Les écritures
// RÉELLEMENT validées par le flux de réception (étape 3 de MaterialEntry) sont
// ajoutées ici : elles apparaissent dans le journal pour tous les rôles et
// survivent au rechargement de la page.
//
// Modèle : le jeu de démonstration reste dans Journal.tsx (non persisté) ;
// ce store ne contient QUE les écritures issues des réceptions, identifiées
// par leur n° d'écriture (data.journalEntryId).

import {
  EtatConstate,
  JournalEntry,
  ReceptionData,
} from "../types/accounting";

const JOURNAL_KEY = "compta_journal_receptions";

/** Correspondance code nomenclature → espèce (catégorie) du matériel. */
const ESPECE_BY_CODE: Record<string, string> = {
  INFO: "Informatique",
  IMPR: "Bureautique",
  BUR: "Bureautique",
  MOB: "Mobilier",
  COMM: "Communication",
};

/** Dérive l'espèce depuis la référence nomenclature (ex. NOM-INFO-001 → Informatique). */
function deriveEspece(referenceNomenclature: string): string {
  const parts = referenceNomenclature.split("-");
  const code = (parts.length >= 2 ? parts[1] : referenceNomenclature).trim();
  if (!code) return "Divers";
  return ESPECE_BY_CODE[code.toUpperCase()] ?? code;
}

/**
 * Charge toutes les entrées du journal à afficher : le jeu de démonstration
 * passé par l'appelant + les écritures de réception persistées.
 */
export function getJournalEntries(mockEntries: JournalEntry[]): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return mockEntries;
    const persisted = JSON.parse(raw) as JournalEntry[];
    if (!Array.isArray(persisted)) return mockEntries;
    return [...mockEntries, ...persisted];
  } catch {
    return mockEntries;
  }
}

/**
 * Ajoute l'écriture générée par la validation de l'étape 3 du flux de
 * réception : UNE ligne par article livré, reprenant désignation, référence,
 * quantité, prix, valeur totale et l'état constaté par le magasinier.
 *
 * Idempotent : si une écriture portant le même n° (data.journalEntryId) existe
 * déjà, rien n'est écrit et la fonction retourne null — un double « Suivant »
 * ne duplique donc jamais les lignes.
 *
 * Retourne les lignes créées (tableau d'au moins 1 élément), ou null si
 * l'écriture existait déjà ou si le stockage est indisponible.
 */
export function appendJournalEntryFromReception(
  data: ReceptionData,
  options: { createdBy: string; controlePar: string }
): JournalEntry[] | null {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    const existing: JournalEntry[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(existing)) return null;

    // Idempotence : l'écriture a déjà été enregistrée.
    if (existing.some((entry) => entry.id === data.journalEntryId)) {
      return null;
    }

    const now = new Date().toISOString();
    const today = now.split("T")[0];
    const nonConformes = data.controles.filter((c) => !c.conforme).length;

    const observations = [
      `Enregistré depuis la réception BL ${data.numeroBL} (${data.fournisseur})`,
      data.observationsBL || null,
      nonConformes > 0
        ? `${nonConformes} article(s) signalé(s) non conforme(s) au contrôle magasinier`
        : null,
    ]
      .filter(Boolean)
      .join(" — ");

    const created: JournalEntry[] = data.articles.map((article, index) => {
      const controle = data.controles.find((c) => c.articleId === article.id);
      const etat: EtatConstate = controle?.etat ?? "neuf";
      return {
        id: `${data.journalEntryId}-${index + 1}`,
        numeroOrdre: data.journalEntryId,
        pieceJustificative: data.numeroBL,
        dateEntree: data.dateBL || today,
        origine: {
          type: "fournisseur",
          nom: data.fournisseur || "Fournisseur non renseigné",
          reference: data.numeroBL,
        },
        numeroNomenclature: article.referenceNomenclature,
        designation: article.designation,
        espece: deriveEspece(article.referenceNomenclature),
        uniteNombre: article.quantiteLivree,
        prixUnitaire: article.prixUnitaire,
        valeurTotale: article.quantiteLivree * article.prixUnitaire,
        qualite: {
          etat,
          dateControle: today,
          controlePar: options.controlePar,
          ...(controle?.remarque ? { notes: controle.remarque } : {}),
        },
        statut: "en_stock",
        observations,
        createdBy: options.createdBy,
        updatedAt: now,
        source: "reception",
      };
    });

    if (created.length === 0) return null;

    localStorage.setItem(JOURNAL_KEY, JSON.stringify([...existing, ...created]));
    return created;
  } catch {
    // Stockage indisponible : le flux de réception reste fonctionnel,
    // l'écriture ne sera simplement pas visible dans le journal.
    return null;
  }
}

/** Indique si des lignes existent déjà pour ce n° d'écriture (utile au PV). */
export function journalEntryExists(journalEntryId: string): boolean {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    if (!raw) return false;
    const persisted = JSON.parse(raw) as JournalEntry[];
    return (
      Array.isArray(persisted) &&
      persisted.some((entry) => entry.id.startsWith(journalEntryId))
    );
  } catch {
    return false;
  }
}
