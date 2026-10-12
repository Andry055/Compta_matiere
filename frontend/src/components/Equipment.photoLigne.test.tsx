// @vitest-environment jsdom
//
// Écran Équipements — vignette de REPLI : quand une fiche matériel n'a pas de
// photo de référence, afficher la photo de la LIGNE d'entrée rattachée à la
// fiche (relation `materiel` posée au rapprochement) — même logique de repli
// que le Journal. Seule la relation compte : aucune correspondance devinée et
// jamais d'image Unsplash.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Equipment } from "./Equipment";
import { API_URL, api } from "../lib/api";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const CLE_STOCK = "/api/materials";
const CLE_LIGNES = "/api/entree-lignes";

function reponse(data: unknown[]) {
  return {
    data: {
      data,
      meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: data.length } },
    },
  };
}

/** Deux fiches : l'une SANS photo de référence, l'autre AVEC. */
function materiels() {
  return [
    {
      id: 1,
      documentId: "doc-lampe",
      designation: "Lampe",
      nomenclature: "11",
      statut: "en_stock",
      quantite_stock: 2,
      valeur_unitaire: 30000,
      categorie: { nom: "Mobilier" },
      createdAt: "2026-10-01T08:00:00.000Z",
      photos: [],
    },
    {
      id: 2,
      documentId: "doc-routeur",
      designation: "Routeur Cisco RV340",
      nomenclature: "05",
      statut: "en_stock",
      quantite_stock: 150,
      valeur_unitaire: 2800000,
      categorie: { nom: "Réseau" },
      createdAt: "2026-10-02T08:00:00.000Z",
      photos: [{ url: "/uploads/materiel_routeur.jpg" }],
    },
  ];
}

/** 2 lignes d'entrée avec photo : une RATTACHÉE à une fiche, l'autre non. */
function lignes(photoLampe: string | null = "/uploads/ligne_105_1_98862e8e93.jpg") {
  return [
    {
      id: 105,
      designation: "Lampe",
      materiel: { documentId: "doc-lampe", designation: "Lampe" },
      photos: photoLampe ? [{ url: photoLampe }] : [],
    },
    {
      id: 96,
      designation: "casque rm",
      materiel: null,
      photos: [{ url: "/uploads/ligne_96_1_7a8796265e.jpg" }],
    },
  ];
}

let getSpy: ReturnType<typeof vi.spyOn>;

function repondre(materiaux: unknown[], lignesRecues: unknown[] | Error) {
  getSpy.mockImplementation((url: string) => {
    if (url === CLE_LIGNES) {
      return lignesRecues instanceof Error
        ? Promise.reject(lignesRecues)
        : Promise.resolve(reponse(lignesRecues));
    }
    return Promise.resolve(reponse(materiaux));
  });
}

beforeEach(() => {
  getSpy = vi.spyOn(api, "get");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Équipements — vignette de repli : photo de la ligne d'entrée rattachée", () => {
  it("1. la fiche SANS photo de référence affiche la photo de sa ligne rattachée", async () => {
    repondre(materiels(), lignes());

    render(<Equipment />);
    await screen.findAllByText("Lampe");

    // La fiche « Lampe » (sans photo) prend la photo de SA ligne (relation).
    const vignettes = screen.getAllByAltText("Lampe");
    expect(vignettes.length).toBeGreaterThan(0);
    expect(vignettes[0].getAttribute("src")).toBe(
      `${API_URL}/uploads/ligne_105_1_98862e8e93.jpg`
    );

    // La ligne 96 n'est rattachée à AUCUNE fiche : sa photo n'est jamais
    // affichée (aucune correspondance devinée par désignation).
    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      i.getAttribute("src")
    );
    expect(srcs.some((s) => (s || "").includes("ligne_96"))).toBe(false);
    expect(srcs.some((s) => (s || "").includes("unsplash"))).toBe(false);
  });

  it("2. la photo de RÉFÉRENCE de la fiche prime sur celle de la ligne", async () => {
    repondre(materiels(), lignes());

    render(<Equipment />);
    await screen.findAllByText("Routeur Cisco RV340");

    const vignette = screen.getAllByAltText("Routeur Cisco RV340")[0];
    expect(vignette.getAttribute("src")).toBe(
      `${API_URL}/uploads/materiel_routeur.jpg`
    );
  });

  it("3. la lecture des lignes demande les populates materiel et photos", async () => {
    repondre(materiels(), lignes());

    render(<Equipment />);
    await screen.findAllByText("Lampe");

    const appelLignes = getSpy.mock.calls.find(([url]) => url === CLE_LIGNES);
    expect(appelLignes).toBeTruthy();
    const options = appelLignes![1];
    expect(options?.params?.populate).toContain("materiel");
    expect(options?.params?.populate).toContain("photos");
    // Le stock reste lu sur le canal habituel, en premier.
    expect(getSpy.mock.calls[0][0]).toBe(CLE_STOCK);
  });

  it("4. une photo de ligne apparue entre deux lectures s'affiche sans F5", async () => {
    // 1ʳᵉ lecture : la ligne n'a pas encore de photo -> icône neutre.
    repondre(materiels(), lignes(null));

    render(<Equipment />);
    await screen.findAllByText("Lampe");
    expect(document.querySelectorAll("img[src*='ligne_105']")).toHaveLength(0);

    // Photo ajoutée à la ligne côté serveur, puis événement de synchro.
    repondre(materiels(), lignes("/uploads/ligne_105_1_nouvelle.jpg"));
    window.dispatchEvent(new CustomEvent("stock-mis-a-jour"));

    await waitFor(() =>
      expect(
        document.querySelectorAll("img[src*='ligne_105_1_nouvelle']").length
      ).toBeGreaterThan(0)
    );
    // Toujours sans repasser par l'écran de chargement.
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();
  });

  it("5. si la lecture des lignes échoue, les matériels s'affichent quand même", async () => {
    repondre(materiels(), new Error("réseau coupé"));

    render(<Equipment />);
    await screen.findAllByText("Routeur Cisco RV340");

    // Aucun écran d'erreur : seul le repli de vignette est perdu.
    expect(screen.queryByText(/Impossible de charger le stock/)).toBeNull();
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();
    // La photo de RÉFÉRENCE reste affichée.
    expect(
      screen.getAllByAltText("Routeur Cisco RV340")[0].getAttribute("src")
    ).toBe(`${API_URL}/uploads/materiel_routeur.jpg`);
  });
});
