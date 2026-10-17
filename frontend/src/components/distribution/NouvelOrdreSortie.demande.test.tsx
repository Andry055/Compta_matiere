// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { NouvelOrdreSortie } from "./NouvelOrdreSortie";

const mockDemandes = [
  { documentId: "doc-dem-1", reference: "DEM-2026-001", statut: "approuvee" },
];

let mockDemandesPourLiaison: any[] | null = [];
let payloadCapture: any = null;

vi.mock("@/lib/demandes", () => ({
  fetchDemandesPourLiaison: vi.fn(async () => mockDemandesPourLiaison),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchDirections: vi.fn(async () => [{ id: "dir-1", nom: "Direction Info" }]),
    fetchServices: vi.fn(async () => [{ id: "ser-1", nom: "Service Dev", directionId: "dir-1" }]),
    creerSortie: vi.fn(async (payload) => {
      payloadCapture = payload;
      return { reference: "SOR-2026-999" };
    }),
  };
});

vi.mock("@/lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: [
      { documentId: "mat-1", designation: "Ecran 27 pouces", quantiteStock: 5, valeurUnitaire: 50000 },
    ],
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  payloadCapture = null;
});

describe("NouvelOrdreSortie — Demande liée facultative", () => {
  it("initialise le champ à vide et le désactive si la liste des demandes est vide", async () => {
    mockDemandesPourLiaison = [];
    render(
      <NouvelOrdreSortie
        userRole="depositaire"
        onSuccess={vi.fn()}
        onError={vi.fn()}
      />
    );

    const input = await screen.findByLabelText(/Demande liée \(facultatif\)/);
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");
    expect(input.getAttribute("autoComplete")).toBe("off");
    expect(input.getAttribute("name")).toBe("ref_demande_sortie");
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(await screen.findByText("Aucune demande enregistrée pour le moment")).toBeTruthy();
  });

  it("laisse le champ actif si des demandes existent et valide une création sans demande", async () => {
    mockDemandesPourLiaison = mockDemandes;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    render(
      <NouvelOrdreSortie
        userRole="depositaire"
        onSuccess={onSuccess}
        onError={onError}
        initialMaterial={{
          documentId: "mat-1",
          designation: "Ecran 27 pouces",
          quantiteStock: 5,
          valeurUnitaire: 50000,
        }}
      />
    );

    const input = await screen.findByLabelText(/Demande liée \(facultatif\)/);
    expect((input as HTMLInputElement).disabled).toBe(false);

    // Remplir les champs obligatoires
    fireEvent.change(screen.getByLabelText(/Pièce justificative/), {
      target: { value: "Decision D-2026-01" },
    });
    fireEvent.change(screen.getByLabelText(/Bénéficiaire/), {
      target: { value: "M. Dupont" },
    });

    // Soumettre sans toucher au champ demande
    const submitBtn = screen.getByRole("button", { name: /Créer l'ordre de sortie/ });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("SOR-2026-999"));
    expect(onError).not.toHaveBeenCalled();

    // Vérifier que demande_id n'est absolument pas dans le payload
    expect(payloadCapture).toBeTruthy();
    expect("demande_id" in payloadCapture).toBe(false);
    expect("demande" in payloadCapture).toBe(false);
  });

  it("affiche l'erreur d'écran si une référence saisie ne correspond à rien", async () => {
    mockDemandesPourLiaison = mockDemandes;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    render(
      <NouvelOrdreSortie
        userRole="depositaire"
        onSuccess={onSuccess}
        onError={onError}
        initialMaterial={{
          documentId: "mat-1",
          designation: "Ecran 27 pouces",
          quantiteStock: 5,
          valeurUnitaire: 50000,
        }}
      />
    );

    fireEvent.change(screen.getByLabelText(/Pièce justificative/), {
      target: { value: "Decision D-2026-01" },
    });
    fireEvent.change(screen.getByLabelText(/Bénéficiaire/), {
      target: { value: "M. Dupont" },
    });

    // Saisie d'une demande inconnue
    const input = await screen.findByLabelText(/Demande liée \(facultatif\)/);
    fireEvent.change(input, { target: { value: "DEM-INCONNUE-999" } });

    const submitBtn = screen.getByRole("button", { name: /Créer l'ordre de sortie/ });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][0]).toMatch(/Aucune demande ne correspond/);
    expect(onSuccess).not.toHaveBeenCalled();
    // Le formulaire conserve le brouillon tapé
    expect((input as HTMLInputElement).value).toBe("DEM-INCONNUE-999");
  });
});
