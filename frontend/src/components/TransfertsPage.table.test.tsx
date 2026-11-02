// @vitest-environment jsdom
//
// Le tableau de la rubrique Transferts doit être « compatible transfert » :
//   - colonnes « Direction d'origine » et « Direction destinataire » ;
//   - la destination affichée est la valeur SAISIE à la création
//     (« — » si elle est inconnue, jamais une valeur déduite) ;
//   - la pastille Validation passe en VERT dès 3/3 (et non plus à 4).
//
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TransfertsPage } from "./TransfertsPage";
import {
  creerTransfert,
  NouveauTransfert,
  validerTransfert,
} from "../lib/transferts";

vi.mock("../lib/api", () => ({
  fetchEntrees: vi.fn(async () => []),
  fetchDirections: vi.fn(async () => []),
  fetchServices: vi.fn(async () => []),
  // Transferts en base : aucun dans ce test, la liste vient du localStorage.
  fetchTransferts: vi.fn(async () => []),
  estTransfertServeur: vi.fn(() => false),
  signerTransfertServeur: vi.fn(async () => ({})),
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function transfert(over: Partial<NouveauTransfert> = {}): NouveauTransfert {
  return {
    direction: "Direction des Ressources Humaines",
    directionDestinataire: "Direction des Affaires Financières",
    serviceSource: "Service Gestion Personnel",
    materiel: "Ordinateurs portables HP",
    materielReference: "HP-001",
    quantite: 1,
    motif: "Rétransfert interne",
    responsables: {
      responsableTransfert: "Mme RAZANADRA Voahangy",
      depositaire: "Mme RAZANADRA Voahangy",
    },
    createur: "Randriamampionona Tolotra",
    createurEmail: "tolotra.randria@mtefop.gov.mg",
    ...over,
  };
}

describe("Tableau des transferts — colonnes et valeurs", () => {
  it("affiche « Direction d'origine » et « Direction destinataire »", () => {
    creerTransfert(transfert());
    render(<TransfertsPage />);

    expect(screen.getByText("Direction d'origine")).toBeTruthy();
    expect(screen.getByText("Direction destinataire")).toBeTruthy();
    // L'ancien intitulé « Direction » seul n'existe plus.
    expect(screen.queryByText("Direction", { selector: "th" })).toBeNull();
  });

  it("affiche la destination saisie, et « — » quand elle est inconnue", () => {
    creerTransfert(transfert());
    creerTransfert(
      transfert({
        direction: "Direction des Affaires Financières",
        directionDestinataire: "",
      })
    );
    render(<TransfertsPage />);

    // DAF : destination du 1ᵉʳ transfert ET Direction d'origine du 2ᵉ.
    expect(
      screen.getAllByText("Direction des Affaires Financières").length
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("n'écrase pas un ancien transfert sans Direction destinataire (« — »)", () => {
    // Enregistrements créés avant l'ajout du champ : la propriété est absente.
    const a = creerTransfert(transfert());
    const brut = JSON.parse(
      localStorage.getItem("comptamatiere_transferts_v2") || "[]"
    ) as Array<Record<string, unknown>>;
    delete brut[0].directionDestinataire;
    localStorage.setItem(
      "comptamatiere_transferts_v2",
      JSON.stringify(brut)
    );
    expect(a.directionDestinataire).toBeTruthy();

    render(<TransfertsPage />);

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getAllByText(/^TRF-\d{4}-\d{3}$/)).toHaveLength(1);
  });

  it("filtre le tableau avec la Direction d'origine saisie", async () => {
    creerTransfert(transfert());
    creerTransfert(
      transfert({
        direction: "Direction des Affaires Financières",
        directionDestinataire: "Direction du Numérique",
      })
    );
    render(<TransfertsPage />);

    expect(screen.getAllByText(/^TRF-\d{4}-\d{3}$/)).toHaveLength(2);

    fireEvent.change(
      screen.getByPlaceholderText(
        /Rechercher par référence, matériel, service, direction/
      ),
      { target: { value: "Ressources Humaines" } }
    );

    expect(await screen.findAllByText(/^TRF-\d{4}-\d{3}$/)).toHaveLength(1);
  });

  it("pastille Validation verte dès 3/3 (et non 4/4)", async () => {
    const a = creerTransfert(transfert());
    validerTransfert(a.reference, "responsableTransfert", {
      name: a.createur,
      email: a.createurEmail,
      role: "demandeur",
    });
    validerTransfert(a.reference, "depositaire", {
      name: "Mme RAZANADRA Voahangy",
      role: "depositaire",
    });

    render(<TransfertsPage />);
    // 2/3 seulement : le Logistique n'a pas encore signé.
    expect(
      (await screen.findByTitle("2/3 validations")).className
    ).toContain("bg-yellow-100");
    cleanup();

    validerTransfert(a.reference, "logistique", {
      name: "Razafindrakoto Tojo",
      role: "logistique",
    });
    render(<TransfertsPage />);

    const badge = await screen.findByTitle("3/3 validations");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.textContent).toBe("3/3");
  });
});
