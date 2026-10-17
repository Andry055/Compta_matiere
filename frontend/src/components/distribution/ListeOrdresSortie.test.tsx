// @vitest-environment jsdom
//
// RÉGRESSIONS de la carte « Liste des ordres de sortie » (vue dépositaire) :
//  1. « Matière : » était TOUJOURS vide : le composant lisait `sortie.matiere`,
//     champ qui n'existe pas sur SortieRecord (mapSortie remplit `materiel`).
//  2. « Destination : » masquait le service : lecture de `sortie.service`,
//     inexistant (le champ s'appelle `serviceDemandeur`).
//  3. « Progression des signatures » restait toujours à « ○ » : les drapeaux
//     magasinier_signed / depositaire_signed / logistique_signed n'étaient
//     jamais mappés par mapSortie.
//  4. Le badge de statut comparait l'énum brute (« en_preparation ») à un
//     libellé déjà traduit → jamais de couleur (toujours gris).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListeOrdresSortie } from "./ListeOrdresSortie";

vi.mock("@/lib/useSortiesLive", () => ({
  useSortiesLive: () => ({
    sorties: [
      {
        id: "sortie-doc-1",
        reference: "SOR-2026-001",
        dateSortie: "2026-10-16",
        materiel: "Borne WiFi Ubiquiti UniFi",
        categorie: "—",
        quantite: 1,
        serviceDemandeur: "Service Informatique",
        direction: "Direction Informatique",
        beneficiaire: "Ex",
        responsable: "—",
        statut: "En préparation",
        justificatif: "azerty",
        documents: [],
        magasinier_signed: true,
        depositaire_signed: false,
        logistique_signed: false,
      },
    ],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    // Même forme réelle de GET /api/session/role que dans
    // Distribution.ajouterOrdre.test.tsx : code métier dans `role.type`.
    fetchSessionRole: vi.fn(async () => ({
      id: 7,
      documentId: "u-7",
      username: "Rakotomalala Hery",
      email: "hery@example.mg",
      department: null,
      fonction: null,
      role: { id: 2, type: "depositaire", name: "Dépositaire par service" },
    })),
  };
});

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

/**
 * Le composant démarre désormais sur l'onglet « Demandées » (état initial
 * modifié) — or une sortie créée par le dépositaire démarre toujours
 * « En préparation » : la carte n'apparaît qu'après bascule sur « Toutes »,
 * comme le ferait réellement l'utilisateur.
 */
async function rendreListeAvecOngletToutes() {
  render(<ListeOrdresSortie />);
  const onglet = await screen.findByRole("tab", { name: /Toutes/ });
  fireEvent.mouseDown(onglet);
  fireEvent.click(onglet);
}

describe("Carte d'ordre de sortie — affichage des données", () => {
  it("affiche la désignation du matériel dans « Matière : »", async () => {
    await rendreListeAvecOngletToutes();

    // Avant le correctif : ce texte était absent (sortie.matiere = undefined).
    expect(
      await screen.findByText("Borne WiFi Ubiquiti UniFi")
    ).toBeTruthy();
  });

  it("affiche la destination complète (direction + service + bénéficiaire)", async () => {
    await rendreListeAvecOngletToutes();

    const destination = await screen.findByText(
      /Direction Informatique\s+Service Informatique\s+Ex/
    );
    expect(destination).toBeTruthy();
    // Aucun « — » parasite (service non renseigné serait écarté, pas affiché).
    expect(destination.textContent).not.toContain("—");
  });

  it("reflète l'état réel des signatures (un ✓, deux ○)", async () => {
    await rendreListeAvecOngletToutes();

    // Point de synchronisation indépendant : l'en-tête de la carte (toujours
    // rendu), pour que chaque test échoue sur SA propre assertion.
    expect(await screen.findByText("SOR-2026-001")).toBeTruthy();
    expect(screen.getAllByText("✓")).toHaveLength(1); // magasinier signé
    expect(screen.getAllByText("○")).toHaveLength(2); // dépositaire + logistique
  });

  it("colore le badge « En préparation » (libellé traduit, pas l'énum brute)", async () => {
    await rendreListeAvecOngletToutes();

    expect(await screen.findByText("SOR-2026-001")).toBeTruthy();
    const badges = screen.getAllByText("En préparation");
    expect(
      badges.some((el) => el.className.includes("bg-blue-50")),
      "le badge doit porter la classe bleue prévue pour « En préparation »"
    ).toBe(true);
  });

  it("propose le bouton Signer au dépositaire pour une sortie en préparation", async () => {
    await rendreListeAvecOngletToutes();

    expect(await screen.findByRole("button", { name: /Signer/ })).toBeTruthy();
  });
});
