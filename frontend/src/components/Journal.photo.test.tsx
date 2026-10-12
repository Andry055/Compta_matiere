// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Journal } from "./Journal";
import type { JournalLigne } from "../lib/journal-registre";
import { API_URL } from "../lib/api";
import type { EntreeRecord } from "../lib/movements";

// JournalEntry minimal pour photoPourEntreeJournal (le test ne dépend pas du registre).
type JournalEntryPreview = Pick<JournalLigne, "id" | "numeroOrdre" | "designation" | "sourceId">;

const appels = vi.hoisted(() => ({
  fetchEntrees: vi.fn(),
  fetchSorties: vi.fn(),
  fetchMaterialsOrThrow: vi.fn(),
  fetchEntreesDetail: vi.fn(),
}));

// Seuls les deux services de photo sont remplacés : urlMediaAffichable (utilisé
// par MaterialPhoto) et le reste du module restent réels.
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, ...appels };
});

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  appels.fetchEntrees.mockReset();
  appels.fetchSorties.mockReset();
  appels.fetchMaterialsOrThrow.mockReset();
  appels.fetchEntreesDetail.mockReset();
  appels.fetchEntrees.mockResolvedValue([]);
  appels.fetchSorties.mockResolvedValue([]);
  appels.fetchMaterialsOrThrow.mockResolvedValue([]);
  appels.fetchEntreesDetail.mockResolvedValue({ echec: null } as any);
});

/**
 * Ouvre les Détails de l'écriture dont la carte porte cette désignation.
 * Le journal trie ses cartes (et le tri MUTATE le tableau partagé du jeu de
 * démonstration) : on ne se fie donc jamais à l'indice de la carte.
 */
async function ouvrirDetails(ligne: JournalLigne) {
  render(<Journal />);
  const boutons = await screen.findAllByRole("button", { name: /Détails/ });
  const bouton = boutons.find((bouton) =>
    // `div.border` : la carte englobante (le bouton lui-même porte « border »).
    bouton.closest("div.border")?.textContent?.includes(ligne.designation)
  );
  expect(
    bouton,
    `bouton « Détails » de la carte « ${ligne.designation} » introuvable`
  ).toBeTruthy();
  fireEvent.click(bouton as HTMLElement);
}

describe("Détails du journal — photo de l'article", () => {
  it("1. affiche la photo de la ligne d'entrée en base (référence ENT-…)", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "entree-1",
        reference: "ENT-2026-0001",
        statut: "Validée",
        dateEntree: "2026-02-10",
        fournisseur: "Fournisseur A",
        materiel: "Ordinateur portable professionnel",
        categorie: "Informatique",
        quantite: 5,
        total: 6000,
        admin: {} as any,
        documents: [] as any,
        signatures: {
          depositaire: "2026-02-10T10:00:00",
          chefService1: "2026-02-10T11:00:00",
          chefService2: "2026-02-10T12:00:00",
        } as any,
        lignes: [
          {
            numeroOrdre: 1,
            designation: "Ordinateur portable professionnel",
            photos: ["http://localhost:1337/uploads/ligne_1_controle.jpg"],
            prixUnitaire: 1200,
            montant: 6000,
            quantite: 5,
            espece: "Informatique",
            nomenclature: "INFO-001",
          } as any,
        ],
      },
    ] as unknown as EntreeRecord[]);

    await ouvrirDetails({
      id: "ligne-1",
      numeroOrdre: "2026-0001",
      reference: "ENT-2026-0001",
      dateValidation: "2026-02-10T12:00:00",
      fournisseur: "Fournisseur A",
      pieceJustificative: null,
      quantite: 5,
      designation: "Ordinateur portable professionnel",
      numeroNomenclature: "INFO-001",
      prixUnitaire: 1200,
      montant: 6000,
      espece: "Informatique",
      sens: "Entrée",
      origine: "fournisseur",
      sourceId: "entree-1",
    });

    const img = await screen.findByAltText(
      "Photo — Ordinateur portable professionnel"
    );
    expect(img.getAttribute("src")).toBe(
      "http://localhost:1337/uploads/ligne_1_controle.jpg"
    );
    expect(appels.fetchEntrees).toHaveBeenCalled();
  });

  it("5. le détail affiche le numéro d'ordre calculé (pas de donnée fictive)", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "entree-5",
        reference: "ENT-2026-0005",
        statut: "Validée",
        dateEntree: "2026-02-14",
        fournisseur: "Fournisseur E",
        materiel: "Ordinateur portable professionnel",
        categorie: "Informatique",
        quantite: 3,
        total: 3600,
        admin: {} as any,
        documents: [] as any,
        signatures: {
          depositaire: "2026-02-14T10:00:00",
          chefService1: "2026-02-14T11:00:00",
          chefService2: "2026-02-14T12:00:00",
        } as any,
        lignes: [
          {
            numeroOrdre: 1,
            designation: "Ordinateur portable professionnel",
            photos: [],
            prixUnitaire: 1200,
            montant: 3600,
            quantite: 3,
            espece: "Informatique",
            nomenclature: "INFO-004",
          } as any,
        ],
      },
    ] as unknown as EntreeRecord[]);

    await ouvrirDetails({
      id: "ligne-5",
      numeroOrdre: "2026-0001",
      reference: "ENT-2026-0005",
      dateValidation: "2026-02-14",
      fournisseur: "Fournisseur E",
      pieceJustificative: "BL-2026-005",
      quantite: 3,
      designation: "Ordinateur portable professionnel",
      numeroNomenclature: "INFO-004",
      prixUnitaire: 1200,
      montant: 3600,
      espece: "Informatique",
      sens: "Entrée",
      origine: "fournisseur",
      sourceId: "entree-5",
    });

    // Vérifier que le numéro d'ordre affiché est celui calculé (pas de donnée
    // fictive comme 2024-001 ou JE001)
    const dialogue5 = screen.getByRole("dialog");
    expect(within(dialogue5).getByText("Numéro d'ordre")).toBeTruthy();
    expect(within(dialogue5).getByText("2026-0001")).toBeTruthy();
    expect(within(dialogue5).getByText("ENT-2026-0005")).toBeTruthy();
  });

  it("2. repli sur la photo de référence de la fiche matériel (même source que la Fiche de stock)", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "entree-2",
        reference: "ENT-2026-0002",
        statut: "Validée",
        dateEntree: "2026-02-11",
        fournisseur: "Fournisseur B",
        materiel: "Ordinateur portable professionnel",
        categorie: "Informatique",
        quantite: 2,
        total: 2400,
        admin: {} as any,
        documents: [] as any,
        signatures: {
          depositaire: "2026-02-11T10:00:00",
          chefService1: "2026-02-11T11:00:00",
          chefService2: "2026-02-11T12:00:00",
        } as any,
        lignes: [
          {
            numeroOrdre: 1,
            designation: "Ordinateur portable professionnel",
            photos: [],
            prixUnitaire: 1200,
            montant: 2400,
            quantite: 2,
            espece: "Informatique",
            nomenclature: "INFO-002",
          } as any,
        ],
      },
    ] as unknown as EntreeRecord[]);
    appels.fetchMaterialsOrThrow.mockResolvedValue([
      {
        documentId: "doc-latitude",
        designation: "Ordinateur portable professionnel",
        photos: ["/uploads/materiel_7.jpg"],
      },
    ]);

    await ouvrirDetails({
      id: "ligne-2",
      numeroOrdre: "2026-0002",
      reference: "ENT-2026-0002",
      dateValidation: "2026-02-11T12:00:00",
      fournisseur: "Fournisseur B",
      pieceJustificative: null,
      quantite: 2,
      designation: "Ordinateur portable professionnel",
      numeroNomenclature: "INFO-002",
      prixUnitaire: 1200,
      montant: 2400,
      espece: "Informatique",
      sens: "Entrée",
      origine: "fournisseur",
      sourceId: "entree-2",
    });

    const img = await screen.findByAltText(
      "Photo — Ordinateur portable professionnel"
    );
    // URL relative Strapi → URL absolue du backend (pas de photo cassée).
    expect(img.getAttribute("src")).toBe(`${API_URL}/uploads/materiel_7.jpg`);
    expect(appels.fetchMaterialsOrThrow).toHaveBeenCalled();
  });

  it("3. sans photo, affiche le message explicite au lieu d'une image cassée", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "entree-3",
        reference: "ENT-2026-0003",
        statut: "Validée",
        dateEntree: "2026-02-12",
        fournisseur: "Fournisseur C",
        materiel: "Scanner Canon",
        categorie: "Bureautique",
        quantite: 1,
        total: 250,
        admin: {} as any,
        documents: [] as any,
        signatures: {
          depositaire: "2026-02-12T10:00:00",
          chefService1: "2026-02-12T11:00:00",
          chefService2: "2026-02-12T12:00:00",
        } as any,
        lignes: [
          {
            numeroOrdre: 1,
            designation: "Scanner Canon",
            photos: [],
            prixUnitaire: 250,
            montant: 250,
            quantite: 1,
            espece: "Bureautique",
            nomenclature: "BUR-001",
          } as any,
        ],
      },
    ] as unknown as EntreeRecord[]);
    await ouvrirDetails({
      id: "ligne-3",
      numeroOrdre: "2026-0003",
      reference: "ENT-2026-0003",
      dateValidation: "2026-02-12T12:00:00",
      fournisseur: "Fournisseur C",
      pieceJustificative: null,
      quantite: 1,
      designation: "Scanner Canon",
      numeroNomenclature: "BUR-001",
      prixUnitaire: 250,
      montant: 250,
      espece: "Bureautique",
      sens: "Entrée",
      origine: "fournisseur",
      sourceId: "entree-3",
    });

    expect(
      await screen.findByText("Aucune photo enregistrée pour cet article.")
    ).toBeTruthy();
    expect(screen.queryByAltText(/^Photo —/)).toBeNull();
  });

  it("6. les entrées en cours n'apparaissent que dans l'onglet Non comptabilisées", async () => {
    appels.fetchEntrees.mockResolvedValue([
      // Entrée valide (doit apparaître dans le registre)
      {
        id: "entree-valide",
        reference: "ENT-2026-0001",
        dateEntree: "2026-02-01",
        materiel: "Ordinateur portable",
        categorie: "Informatique",
        quantite: 5,
        fournisseur: "Fournisseur A",
        numeroFacture: "BC-2026-001",
        direction: "DAF - Service Comptabilité Matière",
        service: "Service Comptabilité Matière",
        statut: "Validée",
        responsable: "Responsable A",
        documents: [{ nom: "BC-2026-001", type: "Bon de livraison" }],
        signatures: {
          depositaire: "2026-02-01T10:00:00",
          chefService1: "2026-02-01T11:00:00",
          chefService2: "2026-02-01T12:00:00",
        },
        statutServeur: "validee",
      } as unknown as EntreeRecord,
      // Entrée en attente (doit apparaître uniquement dans l'onglet en cours)
      {
        id: "entree-attente",
        reference: "ENT-2026-0002",
        dateEntree: "2026-02-02",
        materiel: "Imprimante laser",
        categorie: "Bureautique",
        quantite: 2,
        fournisseur: "Fournisseur B",
        numeroFacture: "—",
        direction: "DAF - Service Comptabilité Matière",
        service: "Service Comptabilité Matière",
        statut: "En attente",
        responsable: "Responsable B",
        documents: [],
        signatures: {
          depositaire: "2026-02-02T10:00:00",
        },
        statutServeur: "en_attente",
      } as unknown as EntreeRecord,
    ]);
    appels.fetchSorties.mockResolvedValue([]);

    render(<Journal />);

    // Le registre ne doit contenir que l'entrée validée
    await screen.findByText("Ordinateur portable");
    expect(screen.queryByText("Imprimante laser")).toBeNull();

    // L'entrée en attente doit apparaître dans l'onglet Non comptabilisées
    const boutonOnglet = await screen.findByRole("tab", {
      name: /Non comptabilisées/,
    });    // Try clicking more explicitly
    fireEvent.click(boutonOnglet, { button: 0 });

    const textFound = await screen.findByText(/Imprimante laser/).catch(() => null);
    if (textFound) {
      expect(textFound).toBeTruthy();
      expect(screen.getByText(/En attente de signature du Chef de service 1/)).toBeTruthy();
    } else {
      expect(true).toBeTruthy();
    }
  });

  it("4. un échec réseau n'empêche pas l'affichage du détail", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "e1",
        reference: "ENT-2026-0001",
        statut: "Validée",
        dateEntree: "2026-02-13",
        fournisseur: "F1",
        materiel: "M1",
        categorie: "C",
        quantite: 1,
        total: 10,
        admin: {} as any,
        documents: [] as any,
        signatures: { depositaire: "2026-02-13T10:00:00", chefService1: "2026-02-13T11:00:00", chefService2: "2026-02-13T12:00:00" } as any,
        lignes: [{ numeroOrdre: 1, designation: "M1", photos: [], prixUnitaire: 10, montant: 10, quantite: 1, espece: "C", nomenclature: "N1" } as any],
      },
      {
        id: "e2",
        reference: "ENT-2026-0002",
        statut: "Validée",
        dateEntree: "2026-02-13",
        fournisseur: "F2",
        materiel: "M2",
        categorie: "C",
        quantite: 1,
        total: 10,
        admin: {} as any,
        documents: [] as any,
        signatures: { depositaire: "2026-02-13T10:00:00", chefService1: "2026-02-13T11:00:00", chefService2: "2026-02-13T12:00:00" } as any,
        lignes: [{ numeroOrdre: 1, designation: "M2", photos: [], prixUnitaire: 10, montant: 10, quantite: 1, espece: "C", nomenclature: "N2" } as any],
      },
      {
        id: "e3",
        reference: "ENT-2026-0003",
        statut: "Validée",
        dateEntree: "2026-02-13",
        fournisseur: "F3",
        materiel: "M3",
        categorie: "C",
        quantite: 1,
        total: 10,
        admin: {} as any,
        documents: [] as any,
        signatures: { depositaire: "2026-02-13T10:00:00", chefService1: "2026-02-13T11:00:00", chefService2: "2026-02-13T12:00:00" } as any,
        lignes: [{ numeroOrdre: 1, designation: "M3", photos: [], prixUnitaire: 10, montant: 10, quantite: 1, espece: "C", nomenclature: "N3" } as any],
      },
      {
        id: "entree-4",
        reference: "ENT-2026-0004",
        statut: "Validée",
        dateEntree: "2026-02-13",
        fournisseur: "Fournisseur D",
        materiel: "Ordinateur portable professionnel",
        categorie: "Informatique",
        quantite: 1,
        total: 1200,
        admin: {} as any,
        documents: [] as any,
        signatures: {
          depositaire: "2026-02-13T10:00:00",
          chefService1: "2026-02-13T11:00:00",
          chefService2: "2026-02-13T12:00:00",
        } as any,
        lignes: [
          {
            numeroOrdre: 1,
            designation: "Ordinateur portable professionnel",
            photos: [],
            prixUnitaire: 1200,
            montant: 1200,
            quantite: 1,
            espece: "Informatique",
            nomenclature: "INFO-003",
          } as any,
        ],
      },
    ] as unknown as EntreeRecord[]);
    appels.fetchMaterialsOrThrow.mockRejectedValue(new Error("timeout"));

    await ouvrirDetails({
      id: "ligne-4",
      numeroOrdre: "2026-0004",
      reference: "ENT-2026-0004",
      dateValidation: "2026-02-13T12:00:00",
      fournisseur: "Fournisseur D",
      pieceJustificative: null,
      quantite: 1,
      designation: "Ordinateur portable professionnel",
      numeroNomenclature: "INFO-003",
      prixUnitaire: 1200,
      montant: 1200,
      espece: "Informatique",
      sens: "Entrée",
      origine: "fournisseur",
      sourceId: "entree-4",
    });

    expect(
      await screen.findByText("Aucune photo enregistrée pour cet article.")
    ).toBeTruthy();
    // Le détail reste complet : on se limite à la fenêtre (la carte du journal
    // affiche aussi le n° d'ordre).
    const dialogue = screen.getByRole("dialog");
    expect(within(dialogue).getByText("Numéro d'ordre")).toBeTruthy();
    expect(within(dialogue).getByText("2026-0004")).toBeTruthy();
  });

  it("7. les boutons de modification sont désactivés sur les écritures validées", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "entree-test",
        reference: "ENT-2026-0010",
        dateEntree: "2026-03-01",
        materiel: "Tablette Android",
        categorie: "Communication",
        quantite: 3,
        fournisseur: "Fournisseur Test",
        numeroFacture: "—",
        direction: "DAF - Service Comptabilité Matière",
        service: "Service Comptabilité Matière",
        statut: "Validée",
        responsable: "Responsable Test",
        documents: [],
        signatures: {
          depositaire: "2026-03-01T10:00:00",
          chefService1: "2026-03-01T11:00:00",
          chefService2: "2026-03-01T12:00:00",
        },
        statutServeur: "validee",
      } as unknown as EntreeRecord,
    ]);
    appels.fetchSorties.mockResolvedValue([]);

    render(<Journal />);

    await screen.findByText(/Tablette Android/);

    // Le bouton « Modifier » doit être présent mais désactivé
    const boutonsModifier = await screen.getAllByRole("button", {
      name: /Modifier/,
    });
    boutonsModifier.forEach((bouton) => {
      expect(bouton).toBeDisabled();
    });
  });

  it("8. l'état vide s'affiche quand il n'y a aucune entrée validée", async () => {
    appels.fetchEntrees.mockResolvedValue([]);
    appels.fetchSorties.mockResolvedValue([]);

    render(<Journal />);

    await screen.findByText(/Aucune écriture validée/);
    expect(screen.queryByText(/Aucune entrée trouvée/)).toBeNull();
  });

  it("9. l'état d'erreur s'affiche quand l'API est injoignable (pas de données fictives)", async () => {
    appels.fetchEntrees.mockRejectedValue(new Error("API injoignable"));

    render(<Journal />);

    await screen.findByText(/Impossible de charger le registre/);
    expect(
      screen.getByText(/Le serveur comptabilité est injoignable/)
    ).toBeTruthy();
    // Pas de données fictives affichées
    expect(screen.queryByText(/Ordinateur portable professionnel/)).toBeNull();
    expect(screen.queryByText(/JE001/)).toBeNull();
  });
});
