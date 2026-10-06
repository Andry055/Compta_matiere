// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MaterialEntry } from "./MaterialEntry";
import { ENTREE_ADMIN_VIDE, type EntreeRecord } from "../lib/movements";
import { fetchEntreesDetail } from "../lib/api";
import type { User } from "../App";

vi.mock("../lib/api", () => ({
  creerEntree: vi.fn(),
  fetchEntreesDetail: vi.fn(),
  signerEntree: vi.fn(),
  uploadPhotosLigne: vi.fn(async () => []),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
});

function utilisateur(role: User["role"]): User {
  return {
    id: "u1",
    name: "Andriamampianina Fara",
    email: "magasinier@example.mg",
    role,
    department: "Informatique",
    permissions: [],
  };
}

/** Pièce en attente du magasinier. `designation` sert de témoin : elle n'est
 *  affichée que si la pièce est OUVERTE (la liste de choix n'affiche que des
 *  références). */
function entree(
  p: Partial<EntreeRecord> & { id: string; reference: string },
): EntreeRecord {
  return {
    dateEntree: "2026-10-01",
    categorie: "Informatique",
    quantite: 3,
    fournisseur: "Rakoto & Fils",
    numeroFacture: "—",
    direction: "—",
    service: "—",
    statut: "En attente",
    responsable: "—",
    documents: [],
    statutServeur: "en_attente",
    signatures: {},
    lignes: [
      {
        numeroOrdre: 1,
        designation: "Clavier AZERTY",
        espece: "Informatique",
        unite: "unité",
        quantite: 3,
        prixUnitaire: 25000,
        montant: 75000,
        nomenclature: "",
        pieceJustificative: "",
        observation: "",
      },
    ],
    admin: { ...ENTREE_ADMIN_VIDE, bonLivraison: "BL-2026-0042" },
    ...p,
  } as EntreeRecord;
}

/**
 * La cloche du navbar ouvre une pièce précise : l'écran Arrivée Matériel doit
 * donc s'afficher DIRECTEMENT dessus, y compris quand plusieurs pièces
 * attendent le rôle (cas où, sans demande explicite, aucune n'est choisie).
 */
describe("Arrivée Matériel — ouverture d'une pièce demandée par la notification", () => {
  beforeEach(() => {
    vi.mocked(fetchEntreesDetail).mockResolvedValue({
      ok: true,
      entrees: [
        entree({
          id: "doc-1",
          reference: "ENT-2026-001",
          materiel: "Clavier AZERTY",
          lignes: [
            {
              numeroOrdre: 1,
              designation: "Clavier AZERTY",
              espece: "Informatique",
              unite: "unité",
              quantite: 3,
              prixUnitaire: 25000,
              montant: 75000,
              nomenclature: "",
              pieceJustificative: "",
              observation: "",
            },
          ],
        }),
        entree({
          id: "doc-2",
          reference: "ENT-2026-002",
          materiel: "Souris sans fil",
          lignes: [
            {
              numeroOrdre: 1,
              designation: "Souris sans fil",
              espece: "Informatique",
              unite: "unité",
              quantite: 5,
              prixUnitaire: 18000,
              montant: 90000,
              nomenclature: "",
              pieceJustificative: "",
              observation: "",
            },
          ],
        }),
      ],
    });
  });

  it("sans demande explicite, plusieurs pièces en attente n'en ouvrent aucune", async () => {
    render(<MaterialEntry user={utilisateur("magasinier")} />);

    // L'écran attend un choix : les deux pièces sont listées, aucune ouverte.
    expect(await screen.findByText("ENT-2026-001")).toBeTruthy();
    expect(screen.getByText("ENT-2026-002")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Clavier AZERTY");
    expect(document.body.textContent).not.toContain("Souris sans fil");
  });

  it("ouvre la pièce visée par la notification de la cloche", async () => {
    render(
      <MaterialEntry user={utilisateur("magasinier")} entreeCibleId="doc-2" />,
    );

    // La pièce demandée est hydratée, et elle SEULE.
    await waitFor(() =>
      expect(document.body.textContent).toContain("Souris sans fil"),
    );
    expect(document.body.textContent).toContain("ENT-2026-002");
    expect(document.body.textContent).not.toContain("Clavier AZERTY");
  });

  it("consomme la cible : une relecture ultérieure ne rouvre pas la pièce traitée", async () => {
    // Non-régression : après une signature, la relecture de fond doit DÉTACHER
    // la pièce traitée (bascule « Articles traités »). Si la cible de la
    // notification restait mémorisée, elle rouvrirait cette pièce à l'écran.
    vi.mocked(fetchEntreesDetail).mockResolvedValue({
      ok: true,
      entrees: [
        entree({
          id: "doc-1",
          reference: "ENT-2026-001",
        }),
      ],
    });
    const consomme = vi.fn();
    render(
      <MaterialEntry
        user={utilisateur("magasinier")}
        entreeCibleId="doc-1"
        onEntreeCibleConsumed={consomme}
      />,
    );

    // La pièce demandée est ouverte, et la cible est consommée une fois servie.
    await waitFor(() =>
      expect(document.body.textContent).toContain("Clavier AZERTY"),
    );
    expect(consomme).toHaveBeenCalledTimes(1);

    // La pièce vient d'être signée ailleurs : elle n'est plus à contrôler.
    vi.mocked(fetchEntreesDetail).mockResolvedValue({
      ok: true,
      entrees: [
        entree({
          id: "doc-1",
          reference: "ENT-2026-001",
          statutServeur: "verifiee",
          signatures: { chefService1: "2026-10-05T09:00:00.000Z" },
        }),
      ],
    });
    window.dispatchEvent(new Event("focus"));

    await waitFor(() =>
      expect(document.body.textContent).not.toContain("Clavier AZERTY"),
    );
  });
});