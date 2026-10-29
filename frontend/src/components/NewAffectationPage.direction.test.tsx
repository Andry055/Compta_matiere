// @vitest-environment jsdom
//
// L'origine du transfert n'est PLUS à saisir :
//   - la Direction et le service d'origine sont DÉDUITS DU COMPTE connecté
//     (département « Direction - Service » du profil) et affichés en lecture
//     seule dans le bloc « ORIGINE — ISSUE DE VOTRE COMPTE » ;
//   - l'assistant ne compte plus que 3 étapes, la première étant la
//     « Direction destinataire » (jamais la Direction du compte) ;
//   - le motif est une donnée SAISIE (champ libre) et le circuit de
//     validation ne compte plus que 2 signatures : Responsable du transfert
//     puis Dépositaire (plus de chefs de service).
//
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NewAffectationPage } from "./NewAffectationPage";
import { fetchDirections, fetchServices } from "../lib/api";
import type { RefOption } from "../lib/api";
import type { User } from "../App";

vi.mock("../lib/api", () => ({
  fetchDirections: vi.fn(async () => [] as RefOption[]),
  fetchServices: vi.fn(async () => [] as RefOption[]),
}));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchDirections).mockReset();
  vi.mocked(fetchServices).mockReset();
  vi.mocked(fetchServices).mockResolvedValue([]);
});

function compte(departement: string): User {
  return {
    id: "u1",
    name: "Randriamampionona Tolotra",
    email: "tolotra.randria@mtefop.gov.mg",
    role: "demandeur",
    department: departement,
    permissions: [],
  };
}

function renderFormulaire(departement: string) {
  return render(
    <NewAffectationPage
      user={compte(departement)}
      entrees={[]}
      onClose={() => {}}
      onCreated={() => {}}
    />
  );
}

describe("Nouveau transfert — origine issue du compte et formulaire", () => {
  it("affiche en lecture seule la Direction et le Service du compte", async () => {
    vi.mocked(fetchDirections).mockResolvedValue([
      {
        documentId: "dir-daf",
        nom: "Direction des Affaires Financières",
        abbreviation: "DAF",
      },
    ]);
    vi.mocked(fetchServices).mockResolvedValue([
      {
        documentId: "svc-compta",
        nom: "Service Comptabilité Matière",
        directionId: "dir-daf",
      },
    ]);

    renderFormulaire("DAF - Service Comptabilité Matière");

    await waitFor(() =>
      expect(
        screen.getAllByText("Direction des Affaires Financières")
      ).not.toHaveLength(0)
    );
    expect(
      screen.getAllByText("Service Comptabilité Matière")
    ).not.toHaveLength(0);
    // Les deux valeurs vivent dans le bloc d'origine, pas dans un sélecteur.
    expect(screen.getByText("ORIGINE — ISSUE DE VOTRE COMPTE")).toBeTruthy();
  });

  it("ne propose jamais la Direction du compte comme Direction destinataire", async () => {
    vi.mocked(fetchDirections).mockResolvedValue([
      {
        documentId: "dir-daf",
        nom: "Direction des Affaires Financières",
        abbreviation: "DAF",
      },
      { documentId: "dir-drh", nom: "Direction DRH", abbreviation: "DRH" },
    ]);

    renderFormulaire("DAF - Service Comptabilité Matière");
    await waitFor(() =>
      expect(
        screen.getAllByText("Direction des Affaires Financières")
      ).not.toHaveLength(0)
    );

    // La 1ʳᵉ liste est la Direction destinataire.
    const destination = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    const valeurs = Array.from(destination.options).map((o) => o.value);
    expect(valeurs).not.toContain("Direction des Affaires Financières");
    expect(valeurs).toContain("Direction DRH");
  });

  it("propose le motif comme champ libre (donnée saisie, pas de liste)", async () => {
    renderFormulaire("DRH - Service Gestion Personnel");

    const champMotif = await screen.findByPlaceholderText("Motif du transfert…");
    expect(champMotif.tagName).toBe("INPUT");
    expect(
      screen.queryByRole("option", { name: "Réaffectation interne" })
    ).toBeNull();
  });

  it("n'affiche que 2 validations : Responsable du transfert puis Dépositaire", async () => {
    renderFormulaire("DRH - Service Gestion Personnel");

    expect(await screen.findByText("1. Responsable du transfert")).toBeTruthy();
    expect(screen.getByText("2. Dépositaire")).toBeTruthy();
    expect(screen.getByText("0 / 2")).toBeTruthy();
    expect(screen.queryByText(/Chef de service/)).toBeNull();
  });

  it("affiche la Direction brute du département quand aucune ne correspond", async () => {
    vi.mocked(fetchDirections).mockResolvedValue([
      {
        documentId: "dir-drh",
        nom: "Direction des Ressources Humaines",
        abbreviation: "DRH",
      },
    ]);

    renderFormulaire("DIRECTION INCONNUE - Service X");

    await waitFor(() =>
      expect(screen.getAllByText("DIRECTION INCONNUE")).not.toHaveLength(0)
    );
  });
});
