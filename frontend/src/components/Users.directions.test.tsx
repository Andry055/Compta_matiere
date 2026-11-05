// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDirectionsOrThrow, fetchServicesOrThrow } from "../lib/api";
import { Users } from "./Users";

vi.mock("../lib/api", () => ({
  fetchDirectionsOrThrow: vi.fn(),
  fetchServicesOrThrow: vi.fn(),
}));

describe("affectation des directions dans la gestion des utilisateurs", () => {
  beforeEach(() => {
    vi.mocked(fetchDirectionsOrThrow).mockResolvedValue([
      {
        id: 8,
        documentId: "direction-logistique",
        nom: "Direction Logistique",
        directeur: "Directeur Test",
      },
    ]);
    vi.mocked(fetchServicesOrThrow).mockResolvedValue([
      {
        id: 21,
        documentId: "service-magasin",
        nom: "Service Magasin",
        directionId: "direction-logistique",
      },
    ]);
  });

  it("affiche les directions du backend et les services de la direction choisie", async () => {
    render(<Users />);

    await waitFor(() => {
      expect(fetchDirectionsOrThrow).toHaveBeenCalledOnce();
      expect(fetchServicesOrThrow).toHaveBeenCalledOnce();
    });

    fireEvent.click(screen.getByRole("button", { name: /nouvel utilisateur/i }));

    const directionSelect = screen.getByLabelText("Direction *") as HTMLSelectElement;
    expect(
      Array.from(directionSelect.options).some(
        (option) => option.textContent === "Direction Logistique"
      )
    ).toBe(true);
    fireEvent.change(directionSelect, { target: { value: "8" } });

    expect(screen.getByRole("option", { name: "Service Magasin" })).toBeTruthy();
  });
});
