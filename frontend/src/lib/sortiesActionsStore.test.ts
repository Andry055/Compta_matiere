// @vitest-environment jsdom
//
// Preuves (phase 2) sur le SEUL sondage de l'application :
//   S1  N composants montés => UN seul relevé (requêtes comptées) ;
//   S2  le détail des ordres n'est chargé QUE pour l'onglet Distribution ;
//   S3  onglet masqué => aucune requête, onglet visible => reprise ;
//   S4  panne réseau => état d'erreur, badge sans chiffre périmé, anciennes
//       données conservées, et surtout AUCUNE fausse alerte ;
//   S5  le flux d'alerte n'écrit rien dans localStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SortieRecord } from "./api";
import { SortiesActionsStore } from "./sortiesActionsStore";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    countSortiesPourPreparation: vi.fn(),
    fetchOrdresPourAlertes: vi.fn(),
    fetchAllSortiesOrThrow: vi.fn(),
  };
});

const api = await import("./api");
const compteur = api.countSortiesPourPreparation as unknown as ReturnType<typeof vi.fn>;
const alertes = api.fetchOrdresPourAlertes as unknown as ReturnType<typeof vi.fn>;
const detail = api.fetchAllSortiesOrThrow as unknown as ReturnType<typeof vi.fn>;

function ordre(id: string): SortieRecord {
  return {
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
    justificatif: "",
    documents: [],
  } as SortieRecord;
}

const releves = () => ({
  compteur: compteur.mock.calls.length,
  alertes: alertes.mock.calls.length,
  detail: detail.mock.calls.length,
});

const les = async () => {
  await vi.advanceTimersByTimeAsync(0);
};

describe("sortiesActionsStore — un seul sondage partagé", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    compteur.mockReset().mockResolvedValue(3);
    alertes.mockReset().mockResolvedValue([]);
    detail.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("S1 : trois consommateurs => un seul relevé, pas trois", async () => {
    const store = new SortiesActionsStore();
    // Menu + cloche (sans détail) + onglet Distribution (avec détail).
    store.acquire();
    store.acquire();
    store.acquire({ detail: true });
    await les();

    expect(releves()).toEqual({ compteur: 1, alertes: 1, detail: 1 });

    // Tic du sondage : toujours UN relevé, malgré les trois abonnés.
    await vi.advanceTimersByTimeAsync(store.POLL_INTERVAL_MS);
    expect(releves()).toEqual({ compteur: 2, alertes: 2, detail: 2 });
  });

  it("S1 bis : libérer un composant n'arrête pas le sondage des autres", async () => {
    const store = new SortiesActionsStore();
    const libererMenu = store.acquire();
    store.acquire({ detail: true });
    await les();
    libererMenu();

    await vi.advanceTimersByTimeAsync(store.POLL_INTERVAL_MS);
    const apres = releves();
    expect(apres.compteur).toBe(2);
    expect(apres.detail).toBe(2);
  });

  it("S2 : le détail n'est chargé que pour l'onglet Distribution", async () => {
    const store = new SortiesActionsStore();
    store.acquire(); // menu, sans détail
    store.acquire(); // cloche, sans détail
    await les();

    expect(releves()).toEqual({ compteur: 1, alertes: 1, detail: 0 });

    store.acquire({ detail: true }); // Distribution s'ouvre
    await les();
    expect(detail).toHaveBeenCalledTimes(1);
    expect(store.getState().sorties).toEqual([]);
  });

  it("S3 : pause de l'onglet masqué, reprise à la visibilité", async () => {
    const store = new SortiesActionsStore();
    store.acquire();
    await les();

    store.setEnPause(true);
    await vi.advanceTimersByTimeAsync(store.POLL_INTERVAL_MS * 3);
    expect(releves()).toEqual({ compteur: 1, alertes: 1, detail: 0 });

    store.setEnPause(false);
    await les();
    expect(releves()).toEqual({ compteur: 2, alertes: 2, detail: 0 });
  });

  it("S4 : panne réseau => erreur signalée, badge sans chiffre périmé, listes conservées", async () => {
    const store = new SortiesActionsStore();
    detail.mockResolvedValue([ordre("a")]);
    store.acquire({ detail: true });
    await les();
    expect(store.getState().totalEnPreparation).toBe(3);
    expect(store.getState().error).toBe(false);

    // Le serveur tombe : le compteur et la liste légère renvoient null.
    compteur.mockResolvedValue(null);
    alertes.mockResolvedValue(null);
    await store.refresh();

    const etat = store.getState();
    expect(etat.error).toBe(true);
    expect(etat.totalEnPreparation).toBeNull();
    expect(etat.sorties).toEqual([ordre("a")], "la dernière liste connue est conservée");
  });

  it("S4 bis : une panne ne fabrique JAMAIS d'alerte", async () => {
    const store = new SortiesActionsStore();
    alertes.mockResolvedValue([ordre("a")]); // ordre déjà connu au 1er relevé
    store.acquire();
    await les();
    expect(store.getState().alertes).toEqual([]);

    alertes.mockResolvedValue(null); // réseau coupé
    await store.refresh();
    expect(store.getState().alertes).toEqual([]);

    // Retour réseau avec le MÊME ordre : toujours aucune alerte.
    alertes.mockResolvedValue([ordre("a")]);
    await store.refresh();
    expect(store.getState().alertes).toEqual([]);
  });

  it("S5 : le flux d'alerte n'écrit rien dans localStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const store = new SortiesActionsStore();
    store.acquire();
    await les();

    alertes.mockResolvedValue([ordre("a")]); // ordre neuf
    await store.refresh();
    expect(store.getState().alertes).toHaveLength(1);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem("appNotifications")).toBeNull();
  });

  it("alerte du store : présence à la découverte, disparition à la signature", async () => {
    const store = new SortiesActionsStore();
    store.acquire();
    await les();

    alertes.mockResolvedValue([ordre("a"), ordre("b")]);
    await store.refresh();
    expect(store.getState().alertes).toHaveLength(1);

    alertes.mockResolvedValue([]); // les deux ordres sont signés
    await store.refresh();
    expect(store.getState().alertes).toHaveLength(0);
  });
});
