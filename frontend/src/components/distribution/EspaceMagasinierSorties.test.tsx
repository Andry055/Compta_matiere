// @vitest-environment jsdom
//
// Espace magasinier dans Distribution — preuves :
//   E1 en-tête, deux compteurs et onglet « À préparer » ; NI inventaire,
//      NI onglet « Demandes de Distribution », NI formulaire, NI message
//      d'accès refusé ;
//   E2 « À préparer » = en_preparation SANS signature 1 (jamais « Demandée ») ;
//      « Déjà traités » = ordres déjà signés, en lecture seule ;
//   E3 bouton « Signer (1/3) » désactivé tant qu'une ligne n'a pas d'état ou
//      n'est pas cochée ; texte d'aide du panneau ;
//   E4 payload inchangé : signerSortie(documentId, 'magasinier', controles)
//      avec {ligne, etat, observations} — la case de vérification n'y figure
//      pas ;
//   E5 le rejet exige un motif ; l'ordre quitte ensuite « À préparer » ;
//   E6 un nouvel ordre apparaît sans action de l'utilisateur.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EspaceMagasinierSorties } from "./EspaceMagasinierSorties";
import type { SortieRecord } from "@/lib/api";

const etat = vi.hoisted(() => ({ serveur: [] as any[] }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    countSortiesPourPreparation: vi.fn(async () =>
      etat.serveur.filter((s) => s.statut === "En préparation" && !s.magasinier_signed).length
    ),
    fetchOrdresPourAlertes: vi.fn(async () => []),
    fetchAllSortiesOrThrow: vi.fn(async () => etat.serveur.map((s) => ({ ...s }))),
    signerSortie: vi.fn(async (documentId: string) => {
      const s = etat.serveur.find((x) => x.id === documentId);
      if (s) s.magasinier_signed = true;
      return { ...s };
    }),
    rejeterSortie: vi.fn(async (documentId: string) => {
      const s = etat.serveur.find((x) => x.id === documentId);
      if (s) s.statut = "Annulée";
      return { ...s };
    }),
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const api = await import("@/lib/api");
const signerSortie = api.signerSortie as unknown as ReturnType<typeof vi.fn>;
const rejeterSortie = api.rejeterSortie as unknown as ReturnType<typeof vi.fn>;

function ordre(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    documentId: id,
    reference: `SOR-2026-${id}`,
    dateSortie: "2026-10-18",
    materiel: "Tapis",
    categorie: "—",
    quantite: 3,
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
        materiel: { documentId: "mat-1", designation: "Tapis rouge", quantiteStock: 8 },
      },
      {
        documentId: `${id}-l2`,
        designation: "Chaise",
        quantite: 1,
        materiel: { documentId: "mat-2", designation: "Chaise", quantiteStock: 4 },
      },
    ],
    ...overrides,
  } as unknown as SortieRecord;
}

async function monter() {
  const vue = render(<EspaceMagasinierSorties />);
  await act(async () => {
    await Promise.resolve();
  });
  return vue;
}

beforeEach(() => {
  etat.serveur = [
    ordre("a-preparer-1"),
    ordre("a-preparer-2"),
    ordre("signe", { magasinier_signed: true }),
    ordre("demandee", { statut: "Demandée" }),
  ];
  signerSortie.mockClear();
  rejeterSortie.mockClear();
});

afterEach(cleanup);

describe("Espace magasinier — en-tête, compteurs, onglets", () => {
  it("E1 : titre, sous-titre, compteurs ; ni inventaire, ni demandes, ni création, ni accès refusé", async () => {
    await monter();

    expect(screen.getByText("Préparation des sorties")).toBeTruthy();
    expect(
      screen.getByText(/Vérifiez le matériel demandé, constatez son état et signez/)
    ).toBeTruthy();

    // Compteurs : 2 à préparer, 1 déjà signé.
    expect(screen.getAllByText("À préparer (2)").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Signés par moi, en attente des autres (1)")
    ).toBeTruthy();

    // Onglet de l'espace, pas ceux de la page du dépositaire.
    expect(screen.getByRole("tab", { name: /À préparer/ })).toBeTruthy();
    expect(screen.queryByText("Inventaire Stock")).toBeNull();
    expect(screen.queryByText("Demandes de Distribution")).toBeNull();
    expect(screen.queryByText("Nouvel ordre de sortie")).toBeNull();
    expect(screen.queryByText(/Accès réservé au rôle dépositaire/)).toBeNull();
  });

  it("E2 : « À préparer » exclut « Demandée » ; « Déjà traités » est en lecture seule", async () => {
    await monter();

    expect(await screen.findByText("SOR-2026-a-preparer-1")).toBeTruthy();
    expect(screen.getByText("SOR-2026-a-preparer-2")).toBeTruthy();
    // Statut « Demandée » : jamais dans l'espace du magasinier.
    expect(screen.queryByText("SOR-2026-demandee")).toBeNull();
    // Déjà signé : pas dans « À préparer ».
    expect(screen.queryByText("SOR-2026-signe")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Déjà traités/ }));

    expect(await screen.findByText("SOR-2026-signe")).toBeTruthy();
    expect(screen.queryByText("SOR-2026-a-preparer-1")).toBeNull();
    // Lecture seule : AUCUNE action, mais la progression des 3 signatures.
    expect(screen.queryAllByText("Préparer et signer")).toHaveLength(0);
    expect(screen.queryAllByText("Rejeter")).toHaveLength(0);
    expect(
      screen.getByText(/Magasinier : ✓ · Dépositaire : ○ · Logistique : ○/)
    ).toBeTruthy();
  });
});

describe("Espace magasinier — panneau de vérification et signature 1", () => {
  it("E3 : « Signer (1/3) » reste désactivé sans état ou sans case cochée", async () => {
    await monter();

    // Ouvre le panneau de vérification du premier ordre.
    fireEvent.click(screen.getAllByText("Préparer et signer")[0]);

    expect(screen.getByText(/Si le matériel ou la quantité ne correspond pas/)).toBeTruthy();
    // Les lignes portent bien la quantité demandée ET le stock actuel.
    expect(
      screen.getAllByText("Quantité demandée :")[0].closest(".msa-champ")?.textContent
    ).toContain("2");
    expect(
      screen.getAllByText("Stock actuel :")[0].closest(".msa-champ")?.textContent
    ).toContain("8");

    const signer = screen.getByRole("button", { name: "Signer (1/3)" }) as HTMLButtonElement;
    expect(signer.disabled, "aucune ligne constatée").toBe(true);

    // Cocher sans état : toujours désactivé.
    const cases = screen.getAllByRole("checkbox");
    fireEvent.click(cases[0]);
    expect(signer.disabled, "case cochée mais état manquant").toBe(true);

    // État sur UNE seule ligne : toujours désactivé (2 lignes).
    const etats = screen.getAllByLabelText(/État à constater/);
    fireEvent.change(etats[0], { target: { value: "bon" } });
    expect(signer.disabled, "une ligne reste sans état").toBe(true);

    // Deuxième ligne : état + case → enfin activé.
    fireEvent.change(etats[1], { target: { value: "neuf" } });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect((screen.getByRole("button", { name: "Signer (1/3)" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("E3 bis : une ligne « Défaillant » exige une remarque", async () => {
    await monter();
    fireEvent.click(screen.getAllByText("Préparer et signer")[0]);

    const etats = screen.getAllByLabelText(/État à constater/);
    fireEvent.change(etats[0], { target: { value: "defaillant" } });
    expect(screen.getByText(/exige une remarque/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Signer (1/3)" }) as HTMLButtonElement).disabled).toBe(true);

    // Une remarque lève le blocage (les cases et l'autre état suivent).
    fireEvent.change(screen.getAllByLabelText(/Remarque/)[0], {
      target: { value: "Écran fissuré" },
    });
    fireEvent.change(screen.getAllByLabelText(/État à constater/)[1], { target: { value: "bon" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect((screen.getByRole("button", { name: "Signer (1/3)" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Espace magasinier — payload, rejet, arrivée d'un nouvel ordre", () => {
  it("E4 : le payload envoyé est inchangé (rôle + contrôles, sans la case)", async () => {
    await monter();
    fireEvent.click(screen.getAllByText("Préparer et signer")[0]);

    fireEvent.change(screen.getAllByLabelText(/État à constater/)[0], { target: { value: "bon" } });
    fireEvent.change(screen.getAllByLabelText(/État à constater/)[1], { target: { value: "moyen" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Signer (1/3)" }));

    expect(signerSortie).toHaveBeenCalledTimes(1);
    const [documentId, role, controles] = signerSortie.mock.calls[0];
    expect(documentId).toBe("a-preparer-1");
    expect(role, "signature 1 = rôle magasinier").toBe("magasinier");
    expect(controles).toEqual([
      { ligne: "a-preparer-1-l1", etat: "bon", observations: "" },
      { ligne: "a-preparer-1-l2", etat: "moyen", observations: "" },
    ]);
    // La case de vérification reste une aide d'écran : aucun champ en plus.
    for (const controle of controles as any[]) {
      expect(Object.keys(controle).sort()).toEqual(["etat", "ligne", "observations"]);
    }
  });

  it("E5 : le rejet exige un motif, puis l'ordre quitte « À préparer »", async () => {
    await monter();

    fireEvent.click(screen.getAllByText("Rejeter")[0]);
    const dialogue = await screen.findByRole("dialog");
    expect(dialogue).toBeTruthy();

    // Soumettre sans motif → erreur, rien d'envoyé.
    fireEvent.click(screen.getByRole("button", { name: "Rejeter la sortie" }));
    expect(await screen.findByText("Le motif est requis")).toBeTruthy();
    expect(rejeterSortie).not.toHaveBeenCalled();

    // Avec motif → rejet enregistré, l'ordre disparaît de l'onglet.
    fireEvent.change(screen.getByLabelText(/Motif du rejet/), {
      target: { value: "Matériel non conforme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rejeter la sortie" }));

    expect(rejeterSortie).toHaveBeenCalledWith("a-preparer-1", "Matériel non conforme");
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("SOR-2026-a-preparer-1")).toBeNull();
    expect(screen.getByText("SOR-2026-a-preparer-2")).toBeTruthy();
  });

  it("E6 : un nouvel ordre apparaît sans action de l'utilisateur", async () => {
    await monter();
    expect(screen.queryByText("SOR-2026-arrivee")).toBeNull();

    // L'ordre arrive côté serveur ; c'est le relevé du store qui l'apporte.
    etat.serveur = [ordre("arrivee"), ...etat.serveur];
    const { sortiesActionsStore } = await import("@/lib/sortiesActionsStore");
    await act(async () => {
      await sortiesActionsStore.refresh();
    });

    expect(await screen.findByText("SOR-2026-arrivee")).toBeTruthy();
    expect(screen.getAllByText("À préparer (3)").length).toBeGreaterThan(0);
  });
});
