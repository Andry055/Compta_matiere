// @vitest-environment jsdom
//
// Phase 3 — compteur et alerte DU CHEF LOGISTIQUE dans le SEUL sondage.
//   A1 consommateur logistique : 4 requêtes par tic (2 dédiées en plus), et
//      un SEUL intervalle (le 2e tic n'ajoute rien d'autre) ;
//   A2 sans consommateur logistique : AUCUNE requête dédiée ;
//   A3 alertes « nouvel ordre à autoriser » : rien au premier relevé, un SEUL
//      groupe quand plusieurs arrivent, disparition à la signature, et
//      AUCUNE écriture localStorage ;
//   A4 libération du lecteur : totalAAutoriser redevient null (badge à 0).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SortieRecord } from "./api";
import { SortiesActionsStore } from "./sortiesActionsStore";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    countSortiesPourPreparation: vi.fn(async () => 0),
    fetchOrdresPourAlertes: vi.fn(async () => []),
    countSortiesAAutoriser: vi.fn(async () => 0),
    fetchOrdresAAutoriser: vi.fn(async () => []),
    fetchAllSortiesOrThrow: vi.fn(async () => []),
  };
});

const api = await import("./api");
const compteur = api.countSortiesPourPreparation as unknown as ReturnType<typeof vi.fn>;
const alertes = api.fetchOrdresPourAlertes as unknown as ReturnType<typeof vi.fn>;
const compteurA = api.countSortiesAAutoriser as unknown as ReturnType<typeof vi.fn>;
const alertesA = api.fetchOrdresAAutoriser as unknown as ReturnType<typeof vi.fn>;

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

function releves() {
  return {
    compteur: compteur.mock.calls.length,
    alertes: alertes.mock.calls.length,
    compteurA: compteurA.mock.calls.length,
    alertesA: alertesA.mock.calls.length,
  };
}

async function tic(ms = 20000) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  compteur.mockClear().mockResolvedValue(0);
  alertes.mockClear().mockResolvedValue([]);
  compteurA.mockClear().mockResolvedValue(0);
  alertesA.mockClear().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Sondage unique + requêtes logistique", () => {
  it("A1 : 4 requêtes par tic, un seul intervalle, total serveur affiché", async () => {
    compteurA.mockResolvedValue(4);
    const store = new SortiesActionsStore();
    const liberer = store.acquire({ autorisation: true });
    await tic(0);

    expect(releves()).toEqual({ compteur: 1, alertes: 1, compteurA: 1, alertesA: 1 });
    expect(store.getState().totalAAutoriser).toBe(4);

    await tic(20000);
    expect(releves()).toEqual({ compteur: 2, alertes: 2, compteurA: 2, alertesA: 2 });
    await tic(20000);
    expect(releves()).toEqual({ compteur: 3, alertes: 3, compteurA: 3, alertesA: 3 });
    expect(store.getState().totalAAutoriser).toBe(4);
    liberer();
  });

  it("A2 : sans consommateur logistique, aucune requête dédiée", async () => {
    const store = new SortiesActionsStore();
    const liberer = store.acquire();
    await tic(0);
    await tic(20000);

    expect(releves()).toEqual({ compteur: 2, alertes: 2, compteurA: 0, alertesA: 0 });
    expect(store.getState().totalAAutoriser).toBeNull();
    liberer();
  });

  it("A3 : alertes — rien au 1er relevé, un seul groupe, disparition, aucun localStorage", async () => {
    const store = new SortiesActionsStore();
    const liberer = store.acquire({ autorisation: true });

    alertesA.mockResolvedValue([]);
    await tic(0); // premier relevé : graine, aucune alerte
    expect(store.getState().alertesAutorisation).toEqual([]);

    // Deux ordres découverts ENSEMBLE après le premier relevé → UN groupe.
    alertesA.mockResolvedValue([ordre("a"), ordre("b")]);
    await tic(20000);
    const groupes = store.getState().alertesAutorisation;
    expect(groupes).toHaveLength(1);
    expect(groupes[0].references).toEqual(["SOR-2026-A", "SOR-2026-B"]);

    alertesA.mockResolvedValue([]); // signatures 3 posées → disparition
    await tic(20000);
    expect(store.getState().alertesAutorisation).toEqual([]);

    // Aucune écriture de persistance : les alertes vivent en mémoire.
    expect(localStorage.length).toBe(0);
    liberer();
  });

  it("A4 : libération du lecteur → totalAAutoriser nul (badge à 0)", async () => {
    compteurA.mockResolvedValue(4);
    const store = new SortiesActionsStore();
    const liberer = store.acquire({ autorisation: true });
    await tic(0);
    expect(store.getState().totalAAutoriser).toBe(4);

    liberer();
    expect(store.getState().totalAAutoriser).toBeNull();
  });
});
