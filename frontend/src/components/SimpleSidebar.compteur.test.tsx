// @vitest-environment jsdom
//
// Compteur du MENU (badge « Distribution ») — preuves de la phase 2 :
//   M1  le chiffre vient de la requête filtrée SERVEUR (en_preparation +
//       signature 1 absente), pas d'un recalcul client ;
//   M2  le menu ne charge JAMAIS le détail des ordres (populate interdit) ;
//   M3  le menu n'a AUCUN intervalle local : il lit l'état du sondage
//       partagé (un relevé serveur par tic, pas un par composant).
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimpleSidebar } from "./SimpleSidebar";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    countSortiesPourPreparation: vi.fn(async () => 12),
    fetchOrdresPourAlertes: vi.fn(async () => []),
    fetchAllSortiesOrThrow: vi.fn(async () => []),
  };
});

const api = await import("@/lib/api");
const compteur = api.countSortiesPourPreparation as unknown as ReturnType<typeof vi.fn>;
const detail = api.fetchAllSortiesOrThrow as unknown as ReturnType<typeof vi.fn>;

const magasinier = {
  id: "u-1",
  name: "Andriamampianina Fara",
  email: "fara@mtefop.gov.mg",
  role: "magasinier",
  department: "Magasin central",
  permissions: [],
} as unknown as import("../App").User;

async function aplatir(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  compteur.mockClear();
  detail.mockClear();
});

afterEach(() => {
  // Le démontage libère le sondage partagé (release → arrêt de l'intervalle).
  cleanup();
  vi.useRealTimers();
});

describe("SimpleSidebar — compteur du menu magasinier", () => {
  it("M1+M2 : affiche le total serveur et ne charge jamais le détail", async () => {
    render(
      <SimpleSidebar
        activeSection="dashboard"
        onSectionChange={() => {}}
        user={magasinier}
      />
    );
    await aplatir();

    expect(compteur, "le badge s'appuie sur la requête filtrée serveur").toHaveBeenCalled();
    expect(screen.getByText("12")).toBeTruthy();
    expect(detail, "le menu ne charge pas le détail des ordres").not.toHaveBeenCalled();
  });

  it("M3 : aucun intervalle local — un seul relevé serveur par tic du sondage partagé", async () => {
    render(
      <SimpleSidebar
        activeSection="dashboard"
        onSectionChange={() => {}}
        user={magasinier}
      />
    );
    await aplatir();
    const apresMontage = compteur.mock.calls.length;
    expect(apresMontage).toBe(1);

    // 35 s : le SONDATEUR partagé (20 s) a un seul tic dans cette fenêtre.
    // Un intervalle local de 30 s dans le menu en donnerait un de plus.
    await aplatir(35_000);
    expect(compteur.mock.calls.length).toBe(2);
  });

  it("un menu déconnecté n'émet aucune requête de compteur", async () => {
    render(
      <SimpleSidebar activeSection="dashboard" onSectionChange={() => {}} />
    );
    await aplatir();
    expect(compteur).not.toHaveBeenCalled();
  });
});
