// @vitest-environment jsdom
//
// Modal de détail d'un transfert — deux exigences d'affichage :
//   M1 la barre collante épinglée en pied de modal a été SUPPRIMÉE (demande
//      utilisateur) : la validation se fait uniquement depuis la carte ;
//   M2 la fenêtre « Confirmer cette validation ? » est FIXÉE au VIEWPORT :
//      elle ne doit PAS être un descendant du conteneur défilant (`.cm-modal`
//      porte un `backdrop-filter`, qui — cf. spec CSS — ferait de ce conteneur
//      le contexte de positionnement des `fixed` descendants).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TransfertDetailModal } from "./TransfertDetailModal";
import type { TransfertRecord } from "../lib/transferts";
import type { User } from "../App";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, signerTransfertServeur: vi.fn(async () => ({})) };
});

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const depositaire = {
  id: "u-1",
  name: "Rakotomalala Hery",
  email: "hery@mtefop.gov.mg",
  role: "depositaire",
  department: "Direction des Ressources Humaines",
  permissions: [],
} as unknown as User;

/** Transfert à 1/3 : le Responsable a signé, le Dépositaire peut signer (2/3). */
function transfertEnAttente(): TransfertRecord {
  return {
    id: "doc-1",
    reference: "TRF-2026-001",
    qrToken: "TRF-2026-001",
    date: "2026-11-02",
    direction: "Direction des Ressources Humaines",
    directionDestinataire: "Direction des Affaires Financières",
    serviceSource: "Service Gestion Personnel",
    serviceDestinataire: "",
    materiel: "Ordinateurs portables HP",
    materielReference: "HP-001",
    quantite: 1,
    motif: "Réaffectation",
    observation: "",
    createur: "Randriamampionona Tolotra",
    createurEmail: "tolotra@mtefop.gov.mg",
    responsables: {
      responsableTransfert: "Randriamampionona Tolotra",
      depositaire: "Rakotomalala Hery",
      logistique: "Razafindrakoto Tojo",
    },
    validations: {
      responsableTransfert: {
        date: "2026-11-02T08:00:00.000Z",
        signataire: "Randriamampionona Tolotra",
      },
    },
    statut: "En attente",
    historique: [],
  };
}

function rendre() {
  return render(
    <TransfertDetailModal
      open
      transfert={transfertEnAttente()}
      user={depositaire}
      onClose={() => {}}
    />
  );
}

describe("TransfertDetailModal — bouton et confirmation épinglés", () => {
  it("M1 : la barre collante en pied de modal n'existe plus", () => {
    rendre();

    expect(
      document.querySelector(".sticky.bottom-0"),
      "la barre collante a été supprimée à la demande de l'utilisateur"
    ).toBeNull();
    // La validation reste disponible depuis la carte de validation.
    expect(screen.getAllByRole("button", { name: /Valider/ }).length).toBeGreaterThan(0);
  });

  it("M2 : la confirmation est fixée au viewport, hors du conteneur défilant", () => {
    rendre();

    fireEvent.click(screen.getAllByRole("button", { name: /Valider/ })[0]);

    const titre = screen.getByText("Confirmer cette validation ?");
    const overlay = titre.closest(".fixed.inset-0");
    expect(overlay, "la fenêtre de confirmation doit être en position fixed").not.toBeNull();
    // Régression du backdrop-filter de .cm-modal : aucun ancêtre défilant.
    expect(
      overlay!.closest(".cm-modal"),
      "la confirmation ne doit pas être piégée dans le modal défilant"
    ).toBeNull();
    expect(overlay!.parentElement!.className).toContain("z-50");
    expect(screen.getByRole("button", { name: /Confirmer/ })).toBeTruthy();
  });
});
