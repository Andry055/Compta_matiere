// @vitest-environment jsdom
//
// Phase 3 — alerte « Nouvel ordre à autoriser » dans la cloche.
//   N1 rôle logistique : rien au premier chargement, puis UNE alerte
//      « Nouvel ordre à autoriser : SOR-… » quand l'ordre arrive ;
//   N2 disparition quand la signature 3 est posée (l'ordre sort du filtre) ;
//   N3 le magasinier ne lit PAS le flux logistique, et AUCUNE écriture
//      localStorage.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./NotificationBell";
import type { SortieRecord } from "@/lib/movements";
import type { User } from "@/App";

vi.mock("../lib/api", () => ({
  fetchEntrees: vi.fn(async () => []),
  countSortiesPourPreparation: vi.fn(async () => 0),
  fetchOrdresPourAlertes: vi.fn(async () => []),
  countSortiesAAutoriser: vi.fn(async () => 0),
  fetchOrdresAAutoriser: vi.fn(async () => []),
  fetchAllSortiesOrThrow: vi.fn(async () => []),
  // Flux DU DÉPOSITAIRE (ordres acceptés par le chef logistique) : requis par
  // la cloche dès qu'un rôle hors logistique est monté.
  fetchOrdresValidesPourDepositaire: vi.fn(async () => []),
}));

const api = await import("../lib/api");
const alertesA = api.fetchOrdresAAutoriser as unknown as ReturnType<typeof vi.fn>;
const alertesM = api.fetchOrdresPourAlertes as unknown as ReturnType<typeof vi.fn>;

function ordre(id: string): SortieRecord {
  return {
    id,
    reference: `SOR-2026-${id.toUpperCase()}`,
    dateSortie: "2026-10-18",
    materiel: "—",
    categorie: "—",
    quantite: 1,
    serviceDemandeur: "—",
    direction: "—",
    beneficiaire: "—",
    responsable: "—",
    statut: "En préparation",
    justificatif: "—",
    documents: [],
    magasinier_signed: true,
    depositaire_signed: true,
    logistique_signed: false,
  };
}

function utilisateur(role: User["role"]): User {
  return {
    id: "u1",
    name: "Test",
    email: "test@example.mg",
    role,
    department: "Logistique",
    permissions: [],
  };
}

async function tic(ms = 20000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  alertesM.mockReset().mockResolvedValue([]);
  alertesA.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Cloche — alerte « nouvel ordre à autoriser »", () => {
  it("N1+N2 : rien au chargement, une alerte à l'arrivée, disparition à la signature", async () => {
    render(<NotificationBell user={utilisateur("logistique")} />);
    await tic(0); // premier relevé : ligne de base, AUCUNE alerte

    fireEvent.click(screen.getByTitle("Mes notifications"));
    expect(screen.queryByText(/Nouvel ordre à autoriser/)).toBeNull();
    expect(localStorage.length).toBe(0);

    // L'ordre arrive APRÈS le premier relevé → UNE alerte, libellé exact.
    alertesA.mockResolvedValue([ordre("a")]);
    await tic(20000);
    const { sortiesActionsStore } = await import("../lib/sortiesActionsStore");
    expect(sortiesActionsStore.getState().alertesAutorisation).toHaveLength(1);
    expect(
      screen.getByText("Nouvel ordre à autoriser : SOR-2026-A")
    ).toBeTruthy();
    expect(localStorage.length).toBe(0); // rien de persisté

    // Signature 3 posée → l'ordre sort du filtre serveur → disparition.
    alertesA.mockResolvedValue([]);
    await tic(20000);
    expect(screen.queryByText(/Nouvel ordre à autoriser/)).toBeNull();
  });

  it("N3 : le magasinier ne lit pas le flux logistique", async () => {
    alertesA.mockResolvedValue([ordre("a")]);
    render(<NotificationBell user={utilisateur("magasinier")} />);
    await tic(0);
    await tic(20000);

    fireEvent.click(screen.getByTitle("Mes notifications"));
    expect(screen.queryByText(/Nouvel ordre à autoriser/)).toBeNull();
    // Son propre flux (signature 1 absente) est vide : rien d'autre non plus.
    expect(screen.queryByText(/à préparer/)).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
