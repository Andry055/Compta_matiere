// @vitest-environment jsdom
//
// Phase 3 — badge du MENU pour le chef logistique.
//   B1 le total vient de la requête filtrée SERVEUR (signatures 1 et 2 posées,
//      signature 3 absente), SANS ouvrir Distribution ;
//   B2 pas de badge à 0, et le libellé du menu devient « Autorisation sorties » ;
//   B3 un autre rôle ne déclenche AUCUNE requête logistique (pas de badge volé).
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimpleSidebar } from "./SimpleSidebar";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    countSortiesPourPreparation: vi.fn(async () => 12),
    countSortiesAAutoriser: vi.fn(async () => 4),
    fetchOrdresPourAlertes: vi.fn(async () => []),
    fetchOrdresAAutoriser: vi.fn(async () => []),
    fetchAllSortiesOrThrow: vi.fn(async () => []),
  };
});

const api = await import("@/lib/api");
const compteur = api.countSortiesPourPreparation as unknown as ReturnType<typeof vi.fn>;
const compteurA = api.countSortiesAAutoriser as unknown as ReturnType<typeof vi.fn>;
const detail = api.fetchAllSortiesOrThrow as unknown as ReturnType<typeof vi.fn>;

function utilisateur(role: string) {
  return {
    id: "u-9",
    name: "Razafindrakoto Tojo",
    email: "tojo@mtefop.gov.mg",
    role,
    department: "Logistique",
    permissions: [],
  } as unknown as import("../App").User;
}

async function aplatir(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  compteur.mockClear();
  compteurA.mockClear();
  detail.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function rendre(role: string) {
  render(
    <SimpleSidebar
      activeSection="dashboard"
      onSectionChange={() => {}}
      user={utilisateur(role)}
    />
  );
}

describe("SimpleSidebar — badge « Distribution » du chef logistique", () => {
  it("B1 : total SERVEUR affiché sans ouvrir Distribution, libellé dédié", async () => {
    rendre("logistique");
    await aplatir();

    expect(screen.getByText("Autorisation sorties")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy(); // total serveur à autoriser
    expect(screen.queryByText("12")).toBeNull(); // pas le compteur magasinier
    expect(detail).not.toHaveBeenCalled(); // jamais de détail depuis le menu
  });

  it("B2 : aucun badge à 0", async () => {
    compteurA.mockResolvedValue(0);
    rendre("logistique");
    await aplatir();

    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByText("Autorisation sorties")).toBeTruthy();
  });

  it("B3 : un autre rôle ne déclenche aucune requête logistique", async () => {
    rendre("depositaire");
    await aplatir();

    expect(compteurA).not.toHaveBeenCalled();
    expect(screen.queryByText("4")).toBeNull();
    expect(screen.getByText("12")).toBeTruthy(); // badge existant, inchangé
    expect(screen.queryByText("Autorisation sorties")).toBeNull();
  });
});
