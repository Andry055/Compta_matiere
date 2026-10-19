// @vitest-environment jsdom
//
// Preuve « aucun nouveau sondage » (fichier dédié : le store partagé est un
// singleton, il doit démarrer vierge pour que le comptage soit parlant) :
//   S1 deux composants montés (espace + seconde vue) => UN seul appel de
//      détail au montage, pas un par composant ;
//   S2 un tic du sondage partagé (20 s) => +1 requête, pas +1 par composant ;
//   S3 AUCUN intervalle local : seuls existent le tic d'affichage (1 s) du
//      hook existant et le sondage du store (20 s).
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EspaceMagasinierSorties } from "./EspaceMagasinierSorties";

const etat = vi.hoisted(() => ({ serveur: [] as any[] }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    countSortiesPourPreparation: vi.fn(async () => 1),
    fetchOrdresPourAlertes: vi.fn(async () => []),
    fetchAllSortiesOrThrow: vi.fn(async () => etat.serveur.map((s) => ({ ...s }))),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const api = await import("@/lib/api");
const detail = api.fetchAllSortiesOrThrow as unknown as ReturnType<typeof vi.fn>;
const compteur = api.countSortiesPourPreparation as unknown as ReturnType<typeof vi.fn>;

const ordre = (id: string) => ({
  id,
  reference: `SOR-2026-${id}`,
  dateSortie: "2026-10-18",
  materiel: "Tapis",
  categorie: "—",
  quantite: 1,
  serviceDemandeur: "—",
  direction: "—",
  beneficiaire: "—",
  responsable: "—",
  statut: "En préparation",
  magasinier_signed: false,
  depositaire_signed: false,
  logistique_signed: false,
  justificatif: "—",
  documents: [],
});

async function aplatir(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  etat.serveur = [ordre("a")];
  detail.mockClear();
  compteur.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Espace magasinier — sondage unique", () => {
  it("S1+S3 : deux montages => une seule requête de détail, aucun intervalle local", async () => {
    // Surveillance des intervalles pour prouver l'absence de tout sondage local.
    const delais = vi.spyOn(globalThis, "setInterval");
    const delaisVus = new Set<number>();

    render(<EspaceMagasinierSorties />); // l'espace
    await aplatir();
    render(<EspaceMagasinierSorties />); // seconde vue du même store
    await aplatir();

    // Un seul appel de détail malgré deux montages (store partagé).
    expect(detail).toHaveBeenCalledTimes(1);
    // Le compteur du badge : une seule requête filtrée serveur.
    expect(compteur).toHaveBeenCalledTimes(1);

    // Seuls les délais autorisés apparaissent : tick d'affichage (1 s) du hook
    // existant et sondage partagé (20 s) du store. Aucun 30 s local.
    delais.mock.calls.forEach((appel) => {
      const ms = appel[1];
      if (typeof ms === "number") delaisVus.add(ms);
    });
    expect(
      [...delaisVus].filter((ms) => ms !== 1000 && ms !== 20000),
      "aucun nouvel intervalle de sondage"
    ).toEqual([]);
  });

  it("S2 : un tic du sondage (20 s) ajoute une requête, pas une par vue", async () => {
    const { sortiesActionsStore } = await import("@/lib/sortiesActionsStore");
    render(<EspaceMagasinierSorties />);
    render(<EspaceMagasinierSorties />);
    await aplatir();

    const avantDetail = detail.mock.calls.length;
    const avantCompteur = compteur.mock.calls.length;

    await aplatir(sortiesActionsStore.POLL_INTERVAL_MS);

    expect(detail.mock.calls.length - avantDetail, "un seul appel de détail par tic").toBe(1);
    expect(compteur.mock.calls.length - avantCompteur, "un seul comptage par tic").toBe(1);
  });

  it("S3 bis : le sondage se met en pause quand l'onglet est masqué", async () => {
    const { sortiesActionsStore } = await import("@/lib/sortiesActionsStore");
    render(<EspaceMagasinierSorties />);
    await aplatir();
    const avant = detail.mock.calls.length;

    sortiesActionsStore.setEnPause(true); // onglet masqué (visibilitychange)
    await aplatir(sortiesActionsStore.POLL_INTERVAL_MS * 2);
    expect(detail.mock.calls.length, "aucune requête pendant la pause").toBe(avant);

    sortiesActionsStore.setEnPause(false);
    await aplatir();
    expect(detail.mock.calls.length).toBe(avant + 1);
  });
});
