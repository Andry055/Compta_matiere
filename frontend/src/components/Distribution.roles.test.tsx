// @vitest-environment jsdom
//
// Aiguillage par rôle de la page Distribution :
//   R1 le dépositaire voit EXACTEMENT la page actuelle, création comprise ;
//   R2 le chef logistique obtient SON espace dédié (« Autorisation des
//      sorties ») : ni page à onglets, ni formulaire, ni message d'accès
//      refusé ; le comptable, lui, garde la page à onglets sans refus ;
//   R3 le comptable ne voit plus le message « Accès réservé au rôle
//      dépositaire » (et pas de formulaire) ;
//   R4 le magasinier obtient son espace (titre, compteurs) SANS les onglets
//      « Inventaire Stock » et « Demandes de Distribution », sans formulaire
//      ni message d'accès refusé.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Distribution } from "./Distribution";

const role = vi.hoisted(() => ({ courant: "depositaire" }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchSessionRole: vi.fn(async () => ({
      id: 7,
      documentId: "u-7",
      username: "Test",
      email: "test@example.mg",
      department: null,
      fonction: null,
      role: { id: 2, type: role.courant, name: role.courant },
    })),
  };
});

vi.mock("../lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: [],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date().toISOString(),
    changementsQuantite: {},
    refresh: vi.fn(),
  }),
}));

vi.mock("../lib/useSortiesLive", () => ({
  useSortiesLive: () => ({
    sorties: [],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date(),
    totalEnPreparation: 0,
    alertes: [],
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

async function ouvrirOngletOrdres() {
  const onglet = await screen.findByRole("tab", { name: /Ordres de sortie/ });
  fireEvent.mouseDown(onglet);
  fireEvent.click(onglet);
}

beforeEach(() => {
  role.courant = "depositaire";
});

afterEach(cleanup);

describe("Distribution — aiguillage par rôle", () => {
  it("R1 : le dépositaire voit la page actuelle, avec création et sans refus", async () => {
    role.courant = "depositaire";
    render(<Distribution />);

    expect(await screen.findByRole("tab", { name: /Inventaire Stock/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Demandes de Distribution/ })).toBeTruthy();

    // Le formulaire de création se trouve désormais dans l'onglet « Demandes de distribution ».
    const ongletDemandes = await screen.findByRole("tab", { name: /Demandes de Distribution/ });
    fireEvent.mouseDown(ongletDemandes);
    fireEvent.click(ongletDemandes);
    expect(await screen.findByText("Nouvel ordre de sortie")).toBeTruthy();
    expect(screen.queryByText(/Accès réservé au rôle dépositaire/)).toBeNull();
  });

  it("R2 : le chef logistique a SON espace (sans refus, sans création)", async () => {
    role.courant = "logistique";
    render(<Distribution />);

    // Espace dédié : à la place de la page à onglets (nouveau comportement).
    expect(await screen.findByText("Autorisation des sorties")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Inventaire Stock/ })).toBeNull();
    expect(
      screen.queryByRole("tab", { name: /Demandes de Distribution/ })
    ).toBeNull();
    expect(screen.queryByText(/Accès réservé au rôle dépositaire/)).toBeNull();
    expect(screen.queryByText("Nouvel ordre de sortie")).toBeNull();
    expect(screen.queryByText("Liste des ordres de sortie")).toBeNull();
  });

  it("R3 : le comptable ne voit plus le message d'accès refusé", async () => {
    role.courant = "comptable";
    render(<Distribution />);

    expect(await screen.findByRole("tab", { name: /Inventaire Stock/ })).toBeTruthy();
    await ouvrirOngletOrdres();

    expect(screen.queryByText(/Accès réservé au rôle dépositaire/)).toBeNull();
    expect(screen.queryByText("Nouvel ordre de sortie")).toBeNull();
    expect(await screen.findByText("Liste des ordres de sortie")).toBeTruthy();
  });

  it("R4 : le magasinier obtient son espace, sans onglets ni formulaire", async () => {
    role.courant = "magasinier";
    render(<Distribution />);

    expect(await screen.findByText("Préparation des sorties")).toBeTruthy();
    expect(
      screen.getByText(/Vérifiez le matériel demandé, constatez son état et signez/)
    ).toBeTruthy();

    expect(screen.queryByRole("tab", { name: /Inventaire Stock/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Demandes de Distribution/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Ordres de sortie/ })).toBeNull();
    expect(screen.queryByText("Nouvel ordre de sortie")).toBeNull();
    expect(screen.queryByText(/Accès réservé au rôle dépositaire/)).toBeNull();
  });
});
