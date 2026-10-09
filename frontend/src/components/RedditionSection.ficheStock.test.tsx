// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RedditionSection } from "./RedditionSection";
import { API_URL } from "../lib/api";
import type { User } from "../App";

const appels = vi.hoisted(() => ({
  fetchRecapitulation: vi.fn(),
  fetchEtatAppreciatif: vi.fn(),
  fetchInventaire: vi.fn(),
  fetchGrandLivre: vi.fn(),
  fetchBordereau: vi.fn(),
}));

vi.mock("../lib/reddition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/reddition")>();
  return { ...actual, ...appels };
});

afterEach(cleanup);

const DEPOSITAIRE = {
  id: "u1",
  name: "Rakotomalala Hery",
  email: "hery.rakoto@mtefop.gov.mg",
  role: "depositaire",
  department: "DAF",
  permissions: [],
} as unknown as User;

/** Inventaire d'un article (le sélecteur de la Fiche de stock en découle). */
function inventaire() {
  return {
    annee: 2026,
    sections: [
      {
        nomenclature: "05",
        articles: [
          {
            materielId: "doc-rv340",
            designation: "Routeur Cisco RV340",
            nomenclature: "05",
            unite: "Unité",
            valeurUnitaire: 2800000,
          },
        ],
        totaux: {
          quantites: { existant: 0, entrees: 4, sorties: 0, reste: 4 },
          valeurs: { existant: 0, entrees: 11200000, total: 11200000, sorties: 0, reste: 11200000 },
        },
      },
    ],
  };
}

function grandLivre(photo: string | null) {
  return {
    materielId: "doc-rv340",
    materiel: {
      documentId: "doc-rv340",
      designation: "Routeur Cisco RV340",
      nomenclature: "05",
      photo,
    },
    annee: 2026,
    mouvements: [
      {
        date: "2026-10-05",
        reference: "ENT-2026-001",
        sens: "entree" as const,
        quantiteEntree: 4,
        quantiteSortie: 0,
        quantiteCumulee: 4,
        montant: 11200000,
        pieceJustificative: "FAC-2026-001",
      },
    ],
    totalEntreesQ: 4,
    totalSortiesQ: 0,
    quantiteFinale: 4,
  };
}

/** Ouvre l'onglet « Fiche de stock » (le sélecteur d'article s'y trouve). */
function ouvrirFicheDeStock() {
  fireEvent.click(screen.getByRole("button", { name: "Fiche de stock" }));
}

beforeEach(() => {
  appels.fetchRecapitulation.mockResolvedValue(null);
  appels.fetchEtatAppreciatif.mockResolvedValue(null);
  appels.fetchInventaire.mockResolvedValue(inventaire());
  appels.fetchBordereau.mockResolvedValue(null);
});

describe("Fiche de stock — photo de référence du matériel", () => {
  it("5c. la photo de la fiche apparaît dans la Fiche de stock du grand livre", async () => {
    appels.fetchGrandLivre.mockResolvedValue(
      grandLivre("/uploads/materiel_7.jpg")
    );

    render(<RedditionSection user={DEPOSITAIRE} />);
    ouvrirFicheDeStock();

    const photo = await screen.findByAltText(
      "Routeur Cisco RV340 — photo de référence"
    );
    // URL relative Strapi convertie en URL absolue du backend (sinon l'image
    // partait sur le front et s'affichait cassée).
    expect(photo.getAttribute("src")).toBe(
      `${API_URL}/uploads/materiel_7.jpg`
    );
    expect(screen.getByText("Routeur Cisco RV340")).toBeTruthy();
    expect(screen.getByText(/Nomenclature 05/)).toBeTruthy();
    // La photo de contrôle (lignes d'entrée) n'est PAS confondue avec celle-ci.
    expect(screen.getByText(/photo de référence de la fiche/)).toBeTruthy();
    // Le mouvement de la ligne rattachée est bien dans la fiche.
    expect(screen.getByText("ENT-2026-001")).toBeTruthy();
  });

  it("6c. une fiche SANS photo s'affiche normalement, sans image cassée ni erreur", async () => {
    appels.fetchGrandLivre.mockResolvedValue(grandLivre(null));

    render(<RedditionSection user={DEPOSITAIRE} />);
    ouvrirFicheDeStock();

    // L'en-tête de la fiche est toujours là…
    expect(await screen.findByText("Routeur Cisco RV340")).toBeTruthy();
    expect(screen.getByText(/Nomenclature 05/)).toBeTruthy();
    // … mais AUCUNE image n'est rendue (pas d'attribut src vide, pas d'erreur).
    expect(screen.queryAllByAltText(/photo de référence/)).toHaveLength(0);
    expect(screen.getByText(/aucune photo de référence/)).toBeTruthy();
    expect(screen.getByText("ENT-2026-001")).toBeTruthy();
  });
});
