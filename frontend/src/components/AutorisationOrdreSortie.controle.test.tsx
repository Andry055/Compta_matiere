// @vitest-environment jsdom
//
// Phase 2/4 — panneau « Contrôler et autoriser » (partie CONTRÔLE).
//   C1 lecture seule : état constaté, remarque, signatures 1 et 2 (nom + date),
//      stock actuel et stock après sortie, par ligne.
//   C2 stock insuffisant : bouton désactivé + lignes listées, « rien n'a été
//      modifié ».
//   C3 liste à cocher exigée, et case « défaillant » exigée si besoin.
//   C4 N° logistique facultatif, 100 caractères max, jamais imposé.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutorisationOrdreSortie } from "./distribution/AutorisationOrdreSortie";
import type { SortieRecord } from "@/lib/movements";
import { signerSortie } from "@/lib/api";

const stocks = vi.hoisted(() => ({ actuels: {} as Record<string, number> }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, signerSortie: vi.fn(async () => ({})) };
});

vi.mock("@/lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: Object.entries(stocks.actuels).map(([documentId, quantiteStock]) => ({
      documentId,
      designation: documentId,
      quantiteStock,
    })),
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date().toISOString(),
    changementsQuantite: {},
    refresh: vi.fn(async () => {}),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function panneau(overrides: Partial<SortieRecord> = {}): SortieRecord {
  return {
    id: "sor-1",
    reference: "SOR-2026-042",
    dateSortie: "2026-10-18",
    materiel: "—",
    categorie: "—",
    quantite: 7,
    serviceDemandeur: "RH",
    direction: "DRHE",
    beneficiaire: "Atelier",
    responsable: "Hery",
    statut: "En préparation",
    justificatif: "PV-042.pdf",
    documents: [],
    magasinier_signed: true,
    depositaire_signed: true,
    signataireMagasinier: "Andriamampianina Fara",
    dateSignatureMagasinier: "2026-10-17T09:00:00.000Z",
    signataireDepositaire: "Rakotomalala Hery",
    dateSignatureDepositaire: "2026-10-17T10:30:00.000Z",
    lignes: [
      {
        documentId: "l1",
        designation: "Chaises",
        quantite: 2,
        etat: "bon",
        observations: "Rien à signaler",
        valeurUnitaire: 5000,
        montant: 10000,
        materiel: { documentId: "mat-1", designation: "Chaises" },
      },
      {
        documentId: "l2",
        designation: "Tables",
        quantite: 5,
        etat: "defaillant",
        observations: "Pied cassé",
        valeurUnitaire: 20000,
        montant: 100000,
        materiel: { documentId: "mat-2", designation: "Tables" },
      },
    ],
    ...overrides,
  };
}

const onSuccess = vi.fn();
const onError = vi.fn();

function caseDe(texte: string): HTMLInputElement {
  const label = screen.getByText(texte).closest("label");
  if (!label) throw new Error(`label introuvable : ${texte}`);
  return label.querySelector("input") as HTMLInputElement;
}

beforeEach(() => {
  onSuccess.mockClear();
  onError.mockClear();
  vi.mocked(signerSortie).mockClear();
  stocks.actuels = { "mat-1": 10, "mat-2": 6 };
});

afterEach(cleanup);

describe("AutorisationOrdreSortie — contrôle", () => {
  it("C1 : états, remarques, signatures 1 et 2, stock actuel et après, par ligne", () => {
    render(
      <AutorisationOrdreSortie
        sortie={panneau()}
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    expect(screen.getByText(/Signature 1 — magasinier/)).toBeTruthy();
    expect(screen.getByText(/Andriamampianina Fara/)).toBeTruthy();
    expect(screen.getAllByText(/17\/10\/2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Signature 2 — dépositaire/)).toBeTruthy();
    expect(screen.getByText(/Rakotomalala Hery/)).toBeTruthy();

    expect(screen.getByText(/Ligne 1 — Chaises/)).toBeTruthy();
    expect(screen.getByText("Bon")).toBeTruthy();
    expect(screen.getByText("Rien à signaler")).toBeTruthy();
    expect(screen.getByText(/Ligne 2 — Tables/)).toBeTruthy();
    expect(screen.getByText("Défaillant")).toBeTruthy();
    expect(screen.getByText("Pied cassé")).toBeTruthy();

    expect(screen.getAllByText("Stock actuel :").length).toBe(2);
    expect(screen.getAllByText("Stock après sortie :").length).toBe(2);
    expect(screen.getByText("8")).toBeTruthy(); // 10 - 2
    expect(screen.getByText("1")).toBeTruthy(); // 6 - 5
  });

  it("C2 : stock insuffisant → bouton désactivé et lignes listées", () => {
    stocks.actuels = { "mat-1": 10, "mat-2": 3 };
    render(
      <AutorisationOrdreSortie
        sortie={panneau()}
        onSuccess={onSuccess}
        onError={onError}
      />
    );

    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toMatch(/Stock insuffisant/);
    expect(alerte.textContent).toMatch(/« Tables » — demandé 5, disponible 3/);
    expect(alerte.textContent).toMatch(/Rien n'a été modifié/);

    const bouton = screen.getByRole("button", { name: "Autoriser la sortie (3/3)" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(bouton);
    expect(signerSortie).not.toHaveBeenCalled();
  });

  it("C3 : liste à cocher exigée, et case défaillant exigée", () => {
    render(
      <AutorisationOrdreSortie
        sortie={panneau()}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
    const bouton = () =>
      screen.getByRole("button", { name: "Autoriser la sortie (3/3)" }) as HTMLButtonElement;
    expect(bouton().disabled).toBe(true);

    fireEvent.click(caseDe("Les signatures 1 et 2 sont vérifiées"));
    fireEvent.click(
      caseDe("J'autorise la sortie de ce matériel ; le stock sera débité")
    );
    expect(bouton().disabled).toBe(true); // case défaillant manquante

    fireEvent.click(
      caseDe("J'ai noté que du matériel défaillant sort")
    );
    expect(bouton().disabled).toBe(false);
  });

  it("C4 : N° logistique facultatif, 100 caractères max, non pré-rempli", () => {
    render(
      <AutorisationOrdreSortie
        sortie={panneau()}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
    const champs = screen.getAllByPlaceholderText("01/Log/108/DRHE/13");
    expect(champs).toHaveLength(2);
    for (const champ of champs) {
      expect((champ as HTMLInputElement).maxLength).toBe(100);
      expect((champ as HTMLInputElement).value).toBe("");
    }
    // Aucune saisie imposée : bouton activable sans N° logistique.
    fireEvent.click(caseDe("Les signatures 1 et 2 sont vérifiées"));
    fireEvent.click(
      caseDe("J'autorise la sortie de ce matériel ; le stock sera débité")
    );
    fireEvent.click(caseDe("J'ai noté que du matériel défaillant sort"));
    expect(
      (screen.getByRole("button", { name: "Autoriser la sortie (3/3)" }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});
