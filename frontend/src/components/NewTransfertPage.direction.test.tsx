// @vitest-environment jsdom
//
// L'origine du transfert n'est PLUS à saisir :
//   - la Direction et le service d'origine sont DÉDUITS DU COMPTE connecté
//     (département « Direction - Service » du profil) et affichés en lecture
//     seule dans le bloc « ORIGINE — ISSUE DE VOTRE COMPTE » ;
//   - l'assistant ne compte plus que 3 étapes, la première étant la
//     « Direction destinataire » (jamais la Direction du compte) ;
//   - le motif est une donnée SAISIE (champ libre) et le circuit de
//     validation compte 3 signatures : Responsable du transfert, Dépositaire,
//     Logistique (plus de chefs de service).
//
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewTransfertPage } from "./NewTransfertPage";
import { fetchDirections, fetchMaterials, fetchServices } from "../lib/api";
import type { MaterialOption, RefOption } from "../lib/api";
import type { User } from "../App";

vi.mock("../lib/api", () => ({
  fetchDirections: vi.fn(async () => [] as RefOption[]),
  fetchServices: vi.fn(async () => [] as RefOption[]),
  // Étape 2 « Matériel » : aucune fiche Équipement dans ce test.
  fetchMaterials: vi.fn(async () => []),
  // Aucun transfert en base dans ce test : le stock vient du localStorage.
  fetchTransferts: vi.fn(async () => []),
  creerTransfertServeur: vi.fn(async () => ({})),
}));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchDirections).mockReset();
  vi.mocked(fetchServices).mockReset();
  vi.mocked(fetchServices).mockResolvedValue([]);
  vi.mocked(fetchMaterials).mockReset();
  vi.mocked(fetchMaterials).mockResolvedValue([]);
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
    <NewTransfertPage
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
      screen.queryByRole("option", { name: "Rétransfert interne" })
    ).toBeNull();
  });

  it("n'affiche que 3 validations : Responsable du transfert, Dépositaire, Logistique", async () => {
    renderFormulaire("DRH - Service Gestion Personnel");

    expect(await screen.findByText("1. Responsable du transfert")).toBeTruthy();
    expect(screen.getByText("2. Dépositaire")).toBeTruthy();
    expect(screen.getByText("3. Logistique")).toBeTruthy();
    expect(screen.getByText("0 / 3")).toBeTruthy();
    expect(screen.queryByText(/Chef de service/)).toBeNull();
  });

  it("propose le Chef logistique comme 3ᵉ responsable (prérempli)", async () => {
    renderFormulaire("DRH - Service Gestion Personnel");

    const champ = (await screen.findByPlaceholderText(
      "Chef logistique…"
    )) as HTMLInputElement;
    expect(champ.value).toBe("Razafindrakoto Tojo");
    // Le bloc reste éditable, comme les deux autres responsables.
    fireEvent.change(champ, { target: { value: "Rakoto Jean" } });
    expect(champ.value).toBe("Rakoto Jean");
  });

  it("propose le matériel LUE DANS LA BASE des fiches Équipement", async () => {
    vi.mocked(fetchDirections).mockResolvedValue([
      {
        documentId: "dir-drh",
        nom: "Direction des Ressources Humaines",
        abbreviation: "DRH",
      },
    ]);
    vi.mocked(fetchServices).mockResolvedValue([
      {
        documentId: "svc-gest",
        nom: "Service Gestion Personnel",
        directionId: "dir-drh",
      },
    ]);
    // GET /api/materials : la fiche vient de la base, pas du stock local
    // (aucune entrée n'est fournie à ce formulaire).
    vi.mocked(fetchMaterials).mockResolvedValue([
      {
        documentId: "mat-1",
        designation: "Ordinateurs portables HP",
        nomenclature: "INFO-001",
        quantiteStock: 5,
        statut: "en_stock",
      } as MaterialOption,
      {
        documentId: "mat-2",
        designation: "Imprimante laser",
        nomenclature: "COMM-002",
        quantiteStock: 0,
        statut: "reforme",
      } as MaterialOption,
    ]);

    renderFormulaire("DRH - Service Gestion Personnel");

    // Étape 2 — Matériel
    fireEvent.click(await screen.findByRole("button", { name: /Matériel/ }));

    const option = await screen.findByRole("option", {
      name: /Ordinateurs portables HP \(INFO-001\) — disponible : 5/,
    });
    expect(option).toBeTruthy();
    // Fiche sans stock : jamais proposée.
    expect(
      screen.queryByRole("option", { name: /Imprimante laser/ })
    ).toBeNull();
    expect(fetchMaterials).toHaveBeenCalled();
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
