// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Equipment } from "./Equipment";
import { API_URL, api } from "../lib/api";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Charge utile Strapi : un matériel AVEC photo de référence, un sans photo. */
function charge(materiel: { photo?: string } = {}) {
  return {
    data: {
      data: [
        {
          id: 7,
          documentId: "doc-rv340",
          designation: "Routeur Cisco RV340",
          nomenclature: "05",
          statut: "en_stock",
          quantite_stock: 4,
          valeur_unitaire: 2800000,
          categorie: { nom: "Réseau" },
          createdAt: "2026-10-01T08:00:00.000Z",
          photos: materiel.photo ? [{ url: materiel.photo }] : [],
        },
        {
          id: 8,
          documentId: "doc-chaise",
          designation: "Chaise de bureau ergonomique",
          nomenclature: "03",
          statut: "en_stock",
          quantite_stock: 10,
          valeur_unitaire: 280000,
          categorie: { nom: "Mobilier" },
          createdAt: "2026-10-02T08:00:00.000Z",
          photos: [],
        },
      ],
    },
  };
}

describe("Équipements — photo de référence de la fiche matériel", () => {
  let getSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSpy = vi.spyOn(api, "get");
  });

  it("5a. la photo de référence est affichée à côté du matériel (chargement)", async () => {
    getSpy.mockResolvedValue(charge({ photo: "/uploads/materiel_7.jpg" }) as never);

    render(<Equipment />);

    await screen.findAllByText("Routeur Cisco RV340");
    const vignette = screen.getAllByAltText("Routeur Cisco RV340")[0];
    expect(vignette.getAttribute("src")).toBe(
      `${API_URL}/uploads/materiel_7.jpg`
    );
    // La photo vient bien de `populate[photos]` de GET /api/materials.
    const [chemin, options] = getSpy.mock.calls[0];
    expect(chemin).toBe("/api/materials");
    expect(options?.params?.populate).toContain("photos");
  });

  it("6a. une fiche SANS photo s'affiche normalement (visuel de repli, aucune erreur)", async () => {
    getSpy.mockResolvedValue(charge() as never);

    render(<Equipment />);

    await screen.findAllByText("Chaise de bureau ergonomique");
    // Les deux fiches sont affichées, y compris celle sans photo.
    const sansPhoto = screen.getAllByAltText("Chaise de bureau ergonomique");
    expect(sansPhoto.length).toBeGreaterThan(0);
    expect(sansPhoto[0].getAttribute("src")).toContain("images.unsplash.com");
    const avecPhoto = screen.getAllByAltText("Routeur Cisco RV340");
    expect(avecPhoto[0].getAttribute("src")).toContain("images.unsplash.com");
    expect(document.querySelector("img")?.getAttribute("alt")).toBeTruthy();
  });

  it("5b. la photo ajoutée depuis la fiche est persistée et visible après rechargement", async () => {
    // 1ʳᵉ lecture : sans photo. 2ᵉ (rechargement après envoi) : avec photo.
    getSpy
      .mockResolvedValueOnce(charge() as never)
      .mockResolvedValueOnce(
        charge({ photo: "/uploads/materiel_7_reference.jpg" }) as never
      );
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({
      data: [{ id: 99, url: "/uploads/materiel_7_reference.jpg" }],
    } as never);

    render(<Equipment />);
    await screen.findAllByText("Routeur Cisco RV340");

    // Ouverture de la fiche : menu « Actions » de la première ligne, puis
    // « Voir les détails » (la vue non-Demandeur n'a pas de bouton Eye).
    fireEvent.click(screen.getAllByTitle("Actions")[0]);
    fireEvent.click(screen.getAllByText("Voir les détails")[0]);
    const input = await screen.findByTestId("input-photo-materiel");
    const fichier = new File([new Uint8Array([1, 2, 3])], "routeur.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(input, { target: { files: [fichier] } });

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const [chemin, forme, options] = postSpy.mock.calls[0];
    // Même mécanisme Strapi que les photos des lignes d'entrée.
    expect(chemin).toBe("/api/upload");
    expect(forme).toBeInstanceOf(FormData);
    expect(forme.get("ref")).toBe("api::material.material");
    // refId = id NUMÉRIQUE de la fiche (clé primaire, jamais le documentId).
    expect(forme.get("refId")).toBe("7");
    expect(forme.get("field")).toBe("photos");
    expect(forme.getAll("files")).toHaveLength(1);
    expect(options?.headers?.["Content-Type"]).toBeUndefined();

    // Rechargement : la vignette affichée est celle RÉELLEMENT persistée.
    await waitFor(() =>
      expect(
        screen
          .getAllByAltText("Routeur Cisco RV340")
          .some((img) =>
            (img.getAttribute("src") || "").endsWith(
              "materiel_7_reference.jpg"
            )
          )
      ).toBe(true)
    );
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});
