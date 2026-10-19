// @vitest-environment jsdom
//
// Phase 4 — résultat et ERREURS de la signature 3 (règle d'or : ne jamais
// deviner le résultat).
//   R1 succès : écran « Sortie validée » avec statut, signataire et date du
//      serveur, stock avant (capturé) → après (rechargé), événement
//      « stock-mis-a-jour » émis, ordres rechargés ;
//   R2 409 « stock insuffisant » : lignes listées + « Rien n'a été modifié »,
//      et la saisie des N° logistiques est conservée ;
//   R3 409 « déjà signée » : rechargement → résultat normal si validée ;
//   R4 délai dépassé : « Vérification en cours… », conclusion d'après l'état
//      réel, AUCUN renvoi automatique ;
//   R5 double clic : une seule requête ;
//   R6 400/403 : le message français du serveur est affiché tel quel.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutorisationOrdreSortie } from "./distribution/AutorisationOrdreSortie";
import type { SortieRecord } from "@/lib/movements";
import { signerSortie, fetchSortiesAvecOptions } from "@/lib/api";

const stocks = vi.hoisted(() => ({ actuels: {} as Record<string, number> }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    signerSortie: vi.fn(async () => ({})),
    fetchSortiesAvecOptions: vi.fn(async () => []),
  };
});

vi.mock("@/lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: Object.entries(stocks.actuels).map(
      ([documentId, quantiteStock]) => ({
        documentId,
        designation: documentId,
        quantiteStock,
      })
    ),
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date().toISOString(),
    changementsQuantite: {},
    // Après la signature : le stock est RECHARGÉ (10 → 8).
    refresh: vi.fn(async () => {
      for (const id of Object.keys(stocks.actuels)) {
        stocks.actuels[id] = Math.max(0, stocks.actuels[id] - 0);
      }
      stocks.actuels["mat-1"] = 8;
    }),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const signer = signerSortie as unknown as ReturnType<typeof vi.fn>;
const recharger = fetchSortiesAvecOptions as unknown as ReturnType<typeof vi.fn>;

function ordreValide(): SortieRecord {
  return {
    id: "sor-1",
    reference: "SOR-2026-042",
    dateSortie: "2026-10-18",
    materiel: "—",
    categorie: "—",
    quantite: 2,
    serviceDemandeur: "RH",
    direction: "DRHE",
    beneficiaire: "Atelier",
    responsable: "Hery",
    statut: "Validée",
    justificatif: "PV.pdf",
    documents: [],
    magasinier_signed: true,
    depositaire_signed: true,
    logistique_signed: true,
    signataireMagasinier: "Fara",
    dateSignatureMagasinier: "2026-10-17T09:00:00.000Z",
    signataireDepositaire: "Hery",
    dateSignatureDepositaire: "2026-10-17T10:00:00.000Z",
    signataireLogistique: "Razafindrakoto Tojo",
    dateSignatureLogistique: "2026-10-18T11:00:00.000Z",
    stockImpacte: true,
    lignes: [
      {
        documentId: "l1",
        designation: "Chaises",
        quantite: 2,
        etat: "bon",
        observations: "RAS",
        valeurUnitaire: 5000,
        montant: 10000,
        numeroLogistique: "01/Log/108/DRHE/13",
        materiel: { documentId: "mat-1", designation: "Chaises" },
      },
    ],
  };
}

/** Même ordre, mais encore en préparation (état AVANT signature 3). */
function ordreEnPreparation(): SortieRecord {
  const { ...valide } = ordreValide();
  return {
    ...valide,
    statut: "En préparation",
    logistique_signed: false,
    signataireLogistique: undefined,
    dateSignatureLogistique: undefined,
    stockImpacte: false,
    lignes: [
      {
        documentId: "l1",
        designation: "Chaises",
        quantite: 2,
        etat: "bon",
        observations: "RAS",
        valeurUnitaire: 5000,
        montant: 10000,
        materiel: { documentId: "mat-1", designation: "Chaises" },
      },
    ],
  };
}

const onSuccess = vi.fn();
const onError = vi.fn();

function caseDe(texte: string): HTMLInputElement {
  const label = screen.getByText(texte).closest("label");
  if (!label) throw new Error(`label introuvable : ${texte}`);
  return label.querySelector("input") as HTMLInputElement;
}

/** Coche la liste puis ouvre la confirmation et valide. */
async function confirmer(numeSaisi?: string) {
  fireEvent.click(caseDe("Les signatures 1 et 2 sont vérifiées"));
  fireEvent.click(
    caseDe("J'autorise la sortie de ce matériel ; le stock sera débité")
  );
  if (numeSaisi !== undefined) {
    const champ = screen.getAllByPlaceholderText("01/Log/108/DRHE/13")[0];
    fireEvent.change(champ, { target: { value: numeSaisi } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Autoriser la sortie (3/3)" }));
  const confirmerBouton = await screen.findByRole("button", {
    name: "Confirmer et autoriser",
  });
  fireEvent.click(confirmerBouton);
  return confirmerBouton;
}

function rendre() {
  render(
    <AutorisationOrdreSortie
      sortie={ordreEnPreparation()}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

beforeEach(() => {
  onSuccess.mockClear();
  onError.mockClear();
  signer.mockReset();
  recharger.mockReset().mockResolvedValue([]);
  stocks.actuels = { "mat-1": 10 };
});

afterEach(cleanup);

describe("Signature 3 — succès", () => {
  it("R1 : écran validé (serveur), stock avant → après, événement, rechargement", async () => {
    const evenements: string[] = [];
    const capter = () => evenements.push("stock");
    window.addEventListener("stock-mis-a-jour", capter);
    signer.mockResolvedValue(ordreValide());
    recharger.mockResolvedValue([ordreValide()]);

    rendre();
    await confirmer("01/Log/108");

    expect(await screen.findByText(/Sortie validée #SOR-2026-042/)).toBeTruthy();
    expect(screen.getByText("Validée")).toBeTruthy();
    expect(screen.getByText(/Razafindrakoto Tojo/)).toBeTruthy();
    expect(screen.getByText(/18\/10\/2026/)).toBeTruthy();
    // Stock AVANT capturé à la confirmation (10), stock APRÈS rechargé (8).
    expect(screen.getByText(/10 → 8/)).toBeTruthy();
    expect(screen.getByText("01/Log/108/DRHE/13")).toBeTruthy();

    expect(evenements).toContain("stock");
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sor-1", statut: "Validée" })
    );
    expect(signer).toHaveBeenCalledTimes(1);
    expect(signer).toHaveBeenCalledWith("sor-1", "logistique", undefined, [
      { ligne: "l1", numero_logistique: "01/Log/108" },
    ]);
    // Le rechargement des ordres est délégué au parent via onSuccess (store).
    expect(recharger).not.toHaveBeenCalled();
    window.removeEventListener("stock-mis-a-jour", capter);
  });
});

describe("Signature 3 — erreurs", () => {
  it("R2 : 409 stock insuffisant → lignes listées, saisie conservée", async () => {
    signer.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            message:
              "Stock insuffisant pour « Chaises » : quantité demandée 2, quantité disponible 1. Aucune modification enregistrée.",
          },
        },
      },
    });

    rendre();
    await confirmer("MA-LOG-77");

    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toMatch(/Stock insuffisant/);
    expect(alerte.textContent).toMatch(/Rien n'a été modifié/);
    expect(alerte.textContent).toMatch(/quantité disponible 1/);
    // Saisie conservée pour ne pas re-saisir l'utilisateur.
    expect(
      (screen.getAllByPlaceholderText("01/Log/108/DRHE/13")[0] as HTMLInputElement)
        .value
    ).toBe("MA-LOG-77");
    expect(screen.queryByText(/Sortie validée/)).toBeNull();
    expect(recharger).not.toHaveBeenCalled();
  });

  it("R3 : 409 déjà signée → rechargement, résultat normal si validée", async () => {
    signer.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error: {
            message: "Cette signature a déjà été enregistrée et ne peut pas être modifiée.",
          },
        },
      },
    });
    recharger.mockResolvedValue([ordreValide()]);

    rendre();
    await confirmer();

    expect(await screen.findByText(/Sortie validée #SOR-2026-042/)).toBeTruthy();
    expect(recharger).toHaveBeenCalled();
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it("R6 : 400/403 → message français du serveur affiché tel quel", async () => {
    signer.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: {
            message: "Signature manquante : la signature « depositaire » doit être apposée avant celle-ci.",
          },
        },
      },
    });

    rendre();
    await confirmer();

    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain(
      "Signature manquante : la signature « depositaire »"
    );
    expect(onError).toHaveBeenCalled();
    expect(screen.queryByText(/Sortie validée/)).toBeNull();
  });
});

describe("Signature 3 — résultat incertain et envoi unique", () => {
  it("R4 : délai dépassé → vérification en cours, puis succès d'après l'état réel", async () => {
    signer.mockRejectedValue(
      Object.assign(new Error("timeout of 30000ms exceeded"), {
        code: "ECONNABORTED",
      })
    );
    let liberer!: (v: SortieRecord[]) => void;
    recharger.mockReturnValue(
      new Promise<SortieRecord[]>((resoudre) => {
        liberer = resoudre;
      })
    );

    rendre();
    await confirmer();

    // Pas de « échec » pendant l'incertitude : on vérifie.
    expect(await screen.findByText("Vérification en cours…")).toBeTruthy();
    expect(screen.queryByText(/Signature non enregistrée/)).toBeNull();
    expect(signer).toHaveBeenCalledTimes(1);

    liberer([ordreValide()]);
    expect(await screen.findByText(/Sortie validée #SOR-2026-042/)).toBeTruthy();
    // Aucun renvoi automatique.
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it("R4b : vérification conclut à un échec CONFIRMÉ (aucun renvoi)", async () => {
    signer.mockRejectedValue(new Error("Network Error"));
    recharger.mockResolvedValue([ordreEnPreparation()]); // toujours non signée

    rendre();
    await confirmer();

    expect(await screen.findByText(/Signature non enregistrée/)).toBeTruthy();
    expect(screen.queryByText(/Sortie validée/)).toBeNull();
    expect(signer).toHaveBeenCalledTimes(1);
  });

  it("R5 : double clic → une seule requête", async () => {
    signer.mockReturnValue(new Promise(() => {})); // reste pendante

    rendre();
    const bouton = await confirmer();
    fireEvent.click(bouton);
    await new Promise((resoudre) => setTimeout(resoudre, 0));

    expect(signer).toHaveBeenCalledTimes(1);
  });
});
