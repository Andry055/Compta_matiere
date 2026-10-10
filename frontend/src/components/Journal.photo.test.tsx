// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Journal } from "./Journal";
import { API_URL } from "../lib/api";
import type { EntreeRecord } from "../lib/movements";

const appels = vi.hoisted(() => ({
  fetchEntrees: vi.fn(),
  fetchMaterialsOrThrow: vi.fn(),
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
  appels.fetchMaterialsOrThrow.mockReset();
  appels.fetchEntrees.mockResolvedValue([]);
  appels.fetchMaterialsOrThrow.mockResolvedValue([]);
});

/**
 * Ouvre les Détails de l'écriture dont la carte porte cette désignation.
 * Le journal trie ses cartes (et le tri MUTATE le tableau partagé du jeu de
 * démonstration) : on ne se fie donc jamais à l'indice de la carte.
 */
async function ouvrirDetails(designation: string) {
  render(<Journal />);
  const boutons = await screen.findAllByRole("button", { name: /Détails/ });
  const bouton = boutons.find((bouton) =>
    // `div.border` : la carte englobante (le bouton lui-même porte « border »).
    bouton.closest("div.border")?.textContent?.includes(designation)
  );
  expect(
    bouton,
    `bouton « Détails » de la carte « ${designation} » introuvable`
  ).toBeTruthy();
  fireEvent.click(bouton as HTMLElement);
}

describe("Détails du journal — photo de l'article", () => {
  it("1. affiche la photo de la ligne d'entrée en base (référence ENT-…)", async () => {
    appels.fetchEntrees.mockResolvedValue([
      {
        id: "1",
        reference: "2024-001",
        lignes: [
          {
            numeroOrdre: 1,
            designation: "Ordinateur portable professionnel",
            photos: ["http://localhost:1337/uploads/ligne_1_controle.jpg"],
          },
        ],
      },
    ] as unknown as EntreeRecord[]);

    await ouvrirDetails("Ordinateur portable professionnel");

    const img = await screen.findByAltText(
      "Photo — Ordinateur portable professionnel"
    );
    expect(img.getAttribute("src")).toBe(
      "http://localhost:1337/uploads/ligne_1_controle.jpg"
    );
    expect(appels.fetchEntrees).toHaveBeenCalled();
  });

  it("2. repli sur la photo de référence de la fiche matériel (même source que la Fiche de stock)", async () => {
    appels.fetchEntrees.mockResolvedValue([]);
    appels.fetchMaterialsOrThrow.mockResolvedValue([
      {
        documentId: "doc-latitude",
        designation: "Ordinateur portable professionnel",
        photos: ["/uploads/materiel_7.jpg"],
      },
    ]);

    await ouvrirDetails("Ordinateur portable professionnel");

    const img = await screen.findByAltText(
      "Photo — Ordinateur portable professionnel"
    );
    // URL relative Strapi → URL absolue du backend (pas de photo cassée).
    expect(img.getAttribute("src")).toBe(`${API_URL}/uploads/materiel_7.jpg`);
    expect(appels.fetchMaterialsOrThrow).toHaveBeenCalled();
  });

  it("3. sans photo, affiche le message explicite au lieu d'une image cassée", async () => {
    await ouvrirDetails("Scanner Canon");

    expect(
      await screen.findByText("Aucune photo enregistrée pour cet article.")
    ).toBeTruthy();
    expect(screen.queryByAltText(/^Photo —/)).toBeNull();
  });

  it("4. un échec réseau n'empêche pas l'affichage du détail", async () => {
    appels.fetchEntrees.mockRejectedValue(new Error("backend injoignable"));
    appels.fetchMaterialsOrThrow.mockRejectedValue(new Error("timeout"));

    await ouvrirDetails("Ordinateur portable professionnel");

    expect(
      await screen.findByText("Aucune photo enregistrée pour cet article.")
    ).toBeTruthy();
    // Le détail reste complet : on se limite à la fenêtre (la carte du journal
    // affiche aussi le n° d'ordre).
    const dialogue = screen.getByRole("dialog");
    expect(within(dialogue).getByText("Numéro d'ordre")).toBeTruthy();
    expect(within(dialogue).getByText("2024-001")).toBeTruthy();
  });
});
