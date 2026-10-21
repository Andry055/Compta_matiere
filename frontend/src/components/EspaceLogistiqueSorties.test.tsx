// @vitest-environment jsdom
//
// Phase 2 — Espace du chef logistique (partie 1 : page et onglets).
//   L1 le logistique voit « Autorisation des sorties » et ses 2 compteurs,
//      sans inventaire, sans création, sans « Demandes », sans accès refusé.
//   L2 « À autoriser » ne montre QUE les ordres signés 1 et 2, 3 absente.
//   L3 « En préparation chez les autres » affiche l'étape bloquante, sans action.
//   L4 « Autorisées » est en lecture seule (statut de remise, date).
//   L5 le dépositaire conserve exactement sa page actuelle.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Distribution } from "./Distribution";
import type { SortieRecord } from "@/lib/movements";

const role = vi.hoisted(() => ({ courant: "logistique" }));
const sorties = vi.hoisted(() => [] as unknown[]);

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    fetchSessionRole: vi.fn(async () => ({
      id: 7,
      documentId: "u-7",
      username: "Tojo",
      email: "tojo@mtefop.gov.mg",
      department: null,
      fonction: null,
      role: { id: 6, type: role.courant, name: role.courant },
    })),
  };
});

vi.mock("../lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: [
      { documentId: "mat-1", designation: "Chaises", quantiteStock: 10 },
    ],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date().toISOString(),
    changementsQuantite: {},
    refresh: vi.fn(async () => {}),
  }),
}));

vi.mock("../lib/useSortiesLive", () => ({
  useSortiesLive: () => ({
    sorties: sorties as SortieRecord[],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date(),
    totalEnPreparation: null,
    alertes: [],
    refresh: vi.fn(async () => {}),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function ordre(overrides: Partial<SortieRecord>): SortieRecord {
  return {
    id: "o1",
    reference: "SOR-2026-001",
    dateSortie: "2026-10-18",
    materiel: "Chaises",
    categorie: "Mobilier",
    quantite: 2,
    serviceDemandeur: "RH",
    direction: "DRHE",
    beneficiaire: "Direction",
    responsable: "Hery",
    statut: "En préparation",
    justificatif: "PV.pdf",
    documents: [],
    lignes: [
      {
        documentId: "l1",
        designation: "Chaises",
        quantite: 2,
        etat: "bon",
        observations: "RAS",
        valeurUnitaire: 5000,
        montant: 10000,
        materiel: { documentId: "mat-1", designation: "Chaises", quantiteStock: 10 },
      },
    ],
    ...overrides,
  };
}

const aAutoriser = ordre({
  id: "o1",
  reference: "SOR-2026-001",
  magasinier_signed: true,
  depositaire_signed: true,
  signataireMagasinier: "Fara",
  dateSignatureMagasinier: "2026-10-17T09:00:00.000Z",
  signataireDepositaire: "Hery",
  dateSignatureDepositaire: "2026-10-17T10:00:00.000Z",
});
const chezAutres = ordre({ id: "o2", reference: "SOR-2026-002" });
const validee = ordre({
  id: "o3",
  reference: "SOR-2026-003",
  statut: "Validée",
  magasinier_signed: true,
  depositaire_signed: true,
  logistique_signed: true,
  signataireLogistique: "Tojo",
  dateSignatureLogistique: "2026-10-18T08:00:00.000Z",
});

function ouvrirOnglet(nom: RegExp) {
  const onglet = screen.getByRole("tab", { name: nom });
  fireEvent.mouseDown(onglet);
  fireEvent.click(onglet);
}

beforeEach(() => {
  role.courant = "logistique";
  sorties.length = 0;
  sorties.push(aAutoriser, chezAutres, validee);
});

afterEach(cleanup);

describe("Espace du chef logistique — page et onglets", () => {
  it("L1 : titre, 2 compteurs, 3 onglets — sans inventaire, création, demandes ni refus", async () => {
    render(<Distribution />);

    expect(await screen.findByText("Autorisation des sorties")).toBeTruthy();
    expect(
      screen.getByText("Contrôlez les signatures et le stock, puis autorisez la sortie.")
    ).toBeTruthy();
    // Compteur + onglet portent le même libellé : au moins un affichage chacun.
    expect(screen.getAllByText("À autoriser (1)").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Autorisées (1)").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole("tab", { name: /À autoriser \(1\)/ })).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: /En préparation chez les autres \(1\)/ })
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Autorisées \(1\)/ })).toBeTruthy();

    expect(screen.queryByRole("tab", { name: /Inventaire Stock/ })).toBeNull();
    expect(
      screen.queryByRole("tab", { name: /Demandes de Distribution/ })
    ).toBeNull();
    expect(screen.queryByText(/Accès réservé/)).toBeNull();
    expect(screen.queryByText("Nouvel ordre de sortie")).toBeNull();
  });

  it("L2 : « À autoriser » ne montre que les ordres signés 1 et 2, signature 3 absente", async () => {
    render(<Distribution />);
    await screen.findByText("Autorisation des sorties");

    expect(screen.getByText("SOR-2026-001")).toBeTruthy();
    expect(screen.getByText("Signatures 1 et 2 posées")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Contrôler et autoriser/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Rejeter/ })
    ).toBeTruthy();
    expect(screen.queryByText("SOR-2026-002")).toBeNull();
    expect(screen.queryByText("SOR-2026-003")).toBeNull();
  });

  it("L3 : « En préparation chez les autres » affiche l'étape bloquante, sans action", async () => {
    render(<Distribution />);
    await screen.findByText("Autorisation des sorties");

    ouvrirOnglet(/En préparation chez les autres/);

    expect(await screen.findByText("SOR-2026-002")).toBeTruthy();
    expect(screen.getByText("Signature 1 : magasinier")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Contrôler et autoriser/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Rejeter/ })).toBeNull();
  });

  it("L4 : « Autorisées » est en lecture seule (remise, date, aucun bouton)", async () => {
    render(<Distribution />);
    await screen.findByText("Autorisation des sorties");

    ouvrirOnglet(/Autorisées/);

    expect(await screen.findByText("SOR-2026-003")).toBeTruthy();
    expect(screen.getByText("en attente de remise")).toBeTruthy();
    expect(screen.getByText("Validée le :")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Contrôler et autoriser/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Rejeter/ })).toBeNull();
  });

  it("L5 : le dépositaire conserve sa page actuelle (création comprise)", async () => {
    role.courant = "depositaire";
    render(<Distribution />);

    expect(await screen.findByRole("tab", { name: /Inventaire Stock/ })).toBeTruthy();
    await fireEvent.mouseDown(screen.getByRole("tab", { name: /Demandes de Distribution/ }));
    fireEvent.click(screen.getByRole("tab", { name: /Demandes de Distribution/ }));
    expect(await screen.findByText("Nouvel ordre de sortie")).toBeTruthy();
    expect(screen.queryByText("Autorisation des sorties")).toBeNull();
  });
});
