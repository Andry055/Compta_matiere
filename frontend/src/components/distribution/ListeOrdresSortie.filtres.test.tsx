// @vitest-environment jsdom
//
// Filtres de « Liste des ordres de sortie » — preuves de la phase 2 :
//   F1  l'onglet PAR DÉFAUT du magasinier est « À préparer (n) » (n = total
//       serveur filtré) ;
//   F2  la liste magasinier repose sur la fonction pure (en_preparation ET
//       signature 1 absente) — un ordre « Demandée » n'y figure JAMAIS ;
//   F3  les filtres des autres rôles (Demandées / En préparation / Validées /
//       À autoriser) ne montrent que les ordres de leur statut.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListeOrdresSortie } from "./ListeOrdresSortie";
import type { SortieRecord } from "@/lib/api";

const ordres = [
  {
    id: "d", reference: "SOR-DEMANDEE", statut: "Demandée",
    magasinier_signed: false, depositaire_signed: false, logistique_signed: false,
  },
  {
    id: "e", reference: "SOR-EN-PREP", statut: "En préparation",
    magasinier_signed: false, depositaire_signed: false, logistique_signed: false,
  },
  {
    id: "f", reference: "SOR-SIGNEE", statut: "En préparation",
    magasinier_signed: true, depositaire_signed: true, logistique_signed: false,
  },
  {
    id: "v", reference: "SOR-VALIDEE", statut: "Validée",
    magasinier_signed: true, depositaire_signed: true, logistique_signed: true,
  },
] as unknown as SortieRecord[];

vi.mock("@/lib/useSortiesLive", () => ({
  useSortiesLive: () => ({
    sorties: ordres,
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date(),
    totalEnPreparation: 2,
    alertes: [],
    refresh: vi.fn(),
  }),
}));

const { fetchSessionRole } = vi.hoisted(() => ({ fetchSessionRole: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, fetchSessionRole, preparerSortie: vi.fn() };
});

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

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

beforeEach(() => fetchSessionRole.mockReset());
afterEach(cleanup);

/** Radix Tabs réagissent aux événements pointeur (mouseDown + click). */
async function activerOnglet(nom: RegExp) {
  const onglet = await screen.findByRole("tab", { name: nom });
  fireEvent.mouseDown(onglet);
  fireEvent.click(onglet);
}

describe("ListeOrdresSortie — magasinier", () => {
  it("F1 : l'onglet par défaut est « À préparer (n) » avec le total serveur", async () => {
    avecRole("magasinier");
    render(<ListeOrdresSortie />);

    // Le badge affiche le total SERVEUR filtré, jamais un compteur local.
    expect(await screen.findByRole("tab", { name: /À préparer \(2\)/ })).toBeTruthy();
    expect(screen.getByRole("tab")).toBeTruthy();
    // Le magasinier n'a qu'UN onglet : pas de « Toutes », pas de « Demandées ».
    expect(screen.queryByRole("tab", { name: /Toutes/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /Demandées/ })).toBeNull();
  });

  it("F2 : le filtre pur exclut les ordres « Demandée » et les déjà signés", async () => {
    avecRole("magasinier");
    render(<ListeOrdresSortie />);

    expect(await screen.findByText("SOR-EN-PREP")).toBeTruthy();
    // Statut « Demandée » : JAMAIS dans l'onglet « À préparer ».
    expect(screen.queryByText("SOR-DEMANDEE")).toBeNull();
    // Signature 1 déjà posée : hors filtre.
    expect(screen.queryByText("SOR-SIGNEE")).toBeNull();
    // Validée : hors filtre.
    expect(screen.queryByText("SOR-VALIDEE")).toBeNull();
  });
});

describe("ListeOrdresSortie — autres rôles", () => {
  it("F3a : le dépositaire voit « Toutes » par défaut, « Demandées » filtre sur le statut", async () => {
    avecRole("depositaire");
    render(<ListeOrdresSortie />);

    expect(await screen.findByRole("tab", { name: /Toutes/ })).toBeTruthy();
    expect(screen.getAllByText("SOR-VALIDEE")).toHaveLength(1);

    await activerOnglet(/Demandées/);
    expect(await screen.findByText("SOR-DEMANDEE")).toBeTruthy();
    expect(screen.queryByText("SOR-EN-PREP")).toBeNull();
  });

  it("F3b : le dépositaire, onglet « En préparation », ne voit que ce statut", async () => {
    avecRole("depositaire");
    render(<ListeOrdresSortie />);

    await activerOnglet(/En préparation/);
    expect(await screen.findByText("SOR-EN-PREP")).toBeTruthy();
    expect(screen.queryByText("SOR-DEMANDEE")).toBeNull();
    expect(screen.queryByText("SOR-VALIDEE")).toBeNull();
  });

  it("F3c : le logistique, onglet « À autoriser », applique la règle pure 1+2 posées", async () => {
    avecRole("logistique");
    render(<ListeOrdresSortie />);

    await activerOnglet(/À autoriser/);
    // Seul SOR-SIGNEE (sig. 1 + 2 posées, 3e absente) est autorisable.
    expect(await screen.findByText("SOR-SIGNEE")).toBeTruthy();
    expect(screen.queryByText("SOR-EN-PREP")).toBeNull();
  });
});
