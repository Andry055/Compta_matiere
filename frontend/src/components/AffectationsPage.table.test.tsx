// @vitest-environment jsdom
//
// Le tableau de la rubrique Transferts doit être « compatible transfert » :
//   - colonnes « Direction d'origine » et « Direction destinataire » ;
//   - la destination affichée est la valeur SAISIE à la création
//     (« — » si elle est inconnue, jamais une valeur déduite) ;
//   - la pastille Validation passe en VERT dès 2/2 (et non plus à 4).
//
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AffectationsPage } from "./AffectationsPage";
import {
  creerAffectation,
  NouvelleAffectation,
  validerAffectation,
} from "../lib/affectations";

vi.mock("../lib/api", () => ({
  fetchEntrees: vi.fn(async () => []),
  fetchDirections: vi.fn(async () => []),
  fetchServices: vi.fn(async () => []),
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function transfert(over: Partial<NouvelleAffectation> = {}): NouvelleAffectation {
  return {
    direction: "Direction des Ressources Humaines",
    directionDestinataire: "Direction des Affaires Financières",
    serviceSource: "Service Gestion Personnel",
    materiel: "Ordinateurs portables HP",
    materielReference: "HP-001",
    quantite: 1,
    motif: "Réaffectation interne",
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
    creerAffectation(transfert());
    render(<AffectationsPage />);

    expect(screen.getByText("Direction d'origine")).toBeTruthy();
    expect(screen.getByText("Direction destinataire")).toBeTruthy();
    // L'ancien intitulé « Direction » seul n'existe plus.
    expect(screen.queryByText("Direction", { selector: "th" })).toBeNull();
  });

  it("affiche la destination saisie, et « — » quand elle est inconnue", () => {
    creerAffectation(transfert());
    creerAffectation(
      transfert({
        direction: "Direction des Affaires Financières",
        directionDestinataire: "",
      })
    );
    render(<AffectationsPage />);

    // DAF : destination du 1ᵉʳ transfert ET Direction d'origine du 2ᵉ.
    expect(
      screen.getAllByText("Direction des Affaires Financières").length
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("n'écrase pas un ancien transfert sans Direction destinataire (« — »)", () => {
    // Enregistrements créés avant l'ajout du champ : la propriété est absente.
    const a = creerAffectation(transfert());
    const brut = JSON.parse(
      localStorage.getItem("comptamatiere_affectations_v2") || "[]"
    ) as Array<Record<string, unknown>>;
    delete brut[0].directionDestinataire;
    localStorage.setItem(
      "comptamatiere_affectations_v2",
      JSON.stringify(brut)
    );
    expect(a.directionDestinataire).toBeTruthy();

    render(<AffectationsPage />);

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getAllByText(/^AFF-\d{4}-\d{3}$/)).toHaveLength(1);
  });

  it("filtre le tableau avec la Direction d'origine saisie", async () => {
    creerAffectation(transfert());
    creerAffectation(
      transfert({
        direction: "Direction des Affaires Financières",
        directionDestinataire: "Direction du Numérique",
      })
    );
    render(<AffectationsPage />);

    expect(screen.getAllByText(/^AFF-\d{4}-\d{3}$/)).toHaveLength(2);

    fireEvent.change(
      screen.getByPlaceholderText(
        /Rechercher par référence, matériel, service, direction/
      ),
      { target: { value: "Ressources Humaines" } }
    );

    expect(await screen.findAllByText(/^AFF-\d{4}-\d{3}$/)).toHaveLength(1);
  });

  it("pastille Validation verte dès 2/2 (et non 4/4)", async () => {
    const a = creerAffectation(transfert());
    validerAffectation(a.reference, "responsableTransfert", {
      name: a.createur,
      email: a.createurEmail,
      role: "demandeur",
    });
    validerAffectation(a.reference, "depositaire", {
      name: "Mme RAZANADRA Voahangy",
      role: "depositaire",
    });

    render(<AffectationsPage />);

    const badge = await screen.findByTitle("2/2 validations");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.textContent).toBe("2/2");
  });
});
