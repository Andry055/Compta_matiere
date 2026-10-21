// @vitest-environment jsdom
//
// (6) INTÉGRATION DE LA REMISE — onglets et visibilité selon le rôle.
//
// Preuves :
//   I1 espace MAGASINIER : l'onglet « À remettre » ne montre QUE les sorties
//      VALIDÉES (ni « En préparation », ni « Demandée », ni « Sortie
//      effectuée ») ;
//   I2 espace MAGASINIER : l'onglet « Remises » ne montre QUE les sorties
//      EFFECTUÉES, en lecture seule (aucune action de remise) ;
//   I3 espace MAGASINIER : la carte d'un ordre validé porte l'action
//      « Remettre » ;
//   I4 liste du DÉPOSITAIRE COMPTABLE : l'onglet « À remettre » n'existe que
//      pour lui, ne montre que les sorties validées, et l'action « Remettre »
//      n'apparaît QUE dans cet onglet ;
//   I5 aucun AUTRE rôle (logistique, comptable, demandeur) ne voit d'action de
//      remise : ni onglet, ni bouton.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EspaceMagasinierSorties } from "./EspaceMagasinierSorties";
import { ListeOrdresSortie } from "./ListeOrdresSortie";
import type { SortieRecord } from "@/lib/api";

const etat = vi.hoisted(() => ({
  sorties: [] as any[],
  refresh: vi.fn(async () => undefined),
}));

const { fetchSessionRole } = vi.hoisted(() => ({ fetchSessionRole: vi.fn() }));

// Le sondage partagé est mocké : les deux écrans lisent la même liste.
vi.mock("@/lib/useSortiesLive", () => ({
  useSortiesLive: () => ({
    sorties: etat.sorties,
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date("2026-10-20T08:00:00Z"),
    totalEnPreparation: 0,
    alertes: [],
    refresh: etat.refresh,
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchSessionRole,
    preparerSortie: vi.fn(),
    remettreSortie: vi.fn(),
    rechargerSortie: vi.fn(async () => null),
    fetchServices: vi.fn(async () => []),
    fetchDirections: vi.fn(async () => []),
    fetchAllSortiesOrThrow: vi.fn(async () => etat.sorties),
  };
});

vi.mock("@/lib/bonSortieDocument", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bonSortieDocument")>();
  return { ...actual, genererPdfBonSortie: vi.fn(async () => undefined) };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function ordre(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    documentId: id,
    reference: `SOR-2026-${id}`,
    dateSortie: "2026-10-18",
    materiel: "Tapis",
    categorie: "—",
    quantite: 2,
    serviceDemandeur: "Service Informatique",
    direction: "Direction Informatique",
    beneficiaire: "Ex",
    responsable: "—",
    statut: "En préparation",
    magasinier_signed: false,
    depositaire_signed: false,
    logistique_signed: false,
    justificatif: "BL-2026-42",
    documents: [],
    lignes: [
      {
        documentId: `${id}-l1`,
        designation: "Tapis rouge",
        quantite: 2,
        etat: "bon",
        numeroLogistique: "NL-001",
        materiel: { documentId: "mat-1", designation: "Tapis rouge", quantiteStock: 8 },
      },
    ],
    ...overrides,
  } as unknown as SortieRecord;
}

/** Jeu d'ordres couvrant les quatre statuts du circuit de sortie. */
function jeuDOrdres() {
  return [
    ordre("validee", {
      statut: "Validée",
      magasinier_signed: true,
      depositaire_signed: true,
      logistique_signed: true,
    }),
    ordre("prep", { statut: "En préparation" }),
    ordre("demandee", { statut: "Demandée" }),
    ordre("remise", {
      statut: "Sortie effectuée",
      magasinier_signed: true,
      depositaire_signed: true,
      logistique_signed: true,
      detenteurNom: "RAKOTOMALALA Hery",
      detenteurFonction: "Dépositaire",
      dateRemise: "2026-10-20",
    }),
  ];
}

function avecRole(type: string) {
  fetchSessionRole.mockResolvedValue({
    id: 7,
    documentId: "u-7",
    username: "Test",
    email: "test@example.mg",
    department: null,
    fonction: null,
    role: { id: 2, type, name: type },
  });
}

/** Radix Tabs réagissent aux événements pointeur (mouseDown + click). */
async function activerOnglet(nom: RegExp) {
  const onglet = await screen.findByRole("tab", { name: nom });
  fireEvent.mouseDown(onglet);
  fireEvent.click(onglet);
}

beforeEach(() => {
  etat.sorties = jeuDOrdres();
  etat.refresh.mockClear();
  fetchSessionRole.mockReset();
});

afterEach(cleanup);

describe("(6) espace magasinier — onglets de remise", () => {
  it("I1 : « À remettre » ne montre QUE les sorties validées", async () => {
    render(<EspaceMagasinierSorties />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("tab", { name: /À remettre/ }));

    expect(await screen.findByText("SOR-2026-validee")).toBeTruthy();
    // Ni « En préparation », ni « Demandée », ni déjà remise.
    expect(screen.queryByText("SOR-2026-prep")).toBeNull();
    expect(screen.queryByText("SOR-2026-demandee")).toBeNull();
    expect(screen.queryByText("SOR-2026-remise")).toBeNull();
  });

  it("I2 : « Remises » ne montre QUE les sorties effectuées, en lecture seule", async () => {
    render(<EspaceMagasinierSorties />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("tab", { name: /Remises/ }));

    expect(await screen.findByText("SOR-2026-remise")).toBeTruthy();
    expect(screen.queryByText("SOR-2026-validee")).toBeNull();
    expect(screen.queryByText("SOR-2026-prep")).toBeNull();
    // Lecture seule : ni action de remise, ni formulaire de saisie.
    expect(screen.queryByRole("button", { name: "Remettre" })).toBeNull();
    expect(screen.queryByLabelText(/Nom du détenteur/)).toBeNull();
    // Le détenteur et la date de la remise sont affichés.
    expect(screen.getByText(/RAKOTOMALALA Hery/)).toBeTruthy();
    expect(screen.getByText(/Date de remise :/)).toBeTruthy();
  });

  it("I3 : la carte d'un ordre validé porte l'action « Remettre »", async () => {
    render(<EspaceMagasinierSorties />);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("tab", { name: /À remettre/ }));
    await screen.findByText("SOR-2026-validee");

    const boutons = screen.getAllByRole("button", { name: "Remettre" });
    expect(boutons).toHaveLength(1);
  });
});

describe("(6) liste du dépositaire comptable — onglet « À remettre »", () => {
  it("I4 : l'onglet « À remettre » n'existe que pour le dépositaire, et ne montre que les validées", async () => {
    avecRole("depositaire");
    render(<ListeOrdresSortie />);

    // L'onglet existe pour le dépositaire comptable.
    const onglet = await screen.findByRole("tab", { name: /À remettre/ });
    expect(onglet).toBeTruthy();

    // Onglet « Toutes » : la sortie validée y est visible, mais SANS action.
    expect(await screen.findByText("SOR-2026-validee")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remettre" })).toBeNull();

    // Onglet « À remettre » : seule la validée, et l'action apparaît.
    fireEvent.mouseDown(onglet);
    fireEvent.click(onglet);
    expect(await screen.findByText("SOR-2026-validee")).toBeTruthy();
    expect(screen.queryByText("SOR-2026-prep")).toBeNull();
    expect(screen.queryByText("SOR-2026-demandee")).toBeNull();
    expect(screen.queryByText("SOR-2026-remise")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Remettre" })).toHaveLength(1);
  });
});

describe("(6) les autres rôles ne voient AUCUNE action de remise", () => {
  it("I5a : le logistique n'a ni l'onglet « À remettre » ni le bouton « Remettre »", async () => {
    avecRole("logistique");
    render(<ListeOrdresSortie />);

    await screen.findByRole("tab", { name: /Toutes/ });
    expect(screen.queryByRole("tab", { name: /À remettre/ })).toBeNull();
    // Même dans « Toutes », la sortie validée n'a pas d'action de remise.
    expect(await screen.findByText("SOR-2026-validee")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remettre" })).toBeNull();
  });

  it("I5b : le comptable ordinaire n'a ni l'onglet « À remettre » ni le bouton « Remettre »", async () => {
    avecRole("comptable");
    render(<ListeOrdresSortie />);

    await screen.findByRole("tab", { name: /Toutes/ });
    expect(screen.queryByRole("tab", { name: /À remettre/ })).toBeNull();
    expect(await screen.findByText("SOR-2026-validee")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remettre" })).toBeNull();
  });

  it("I5c : le demandeur n'a accès à AUCUNE action de remise", async () => {
    avecRole("demandeur");
    render(<ListeOrdresSortie />);

    expect(await screen.findByText(/Accès refusé/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /À remettre/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remettre" })).toBeNull();
  });
});
