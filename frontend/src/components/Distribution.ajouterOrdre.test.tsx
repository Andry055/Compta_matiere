// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Distribution } from "./Distribution";

vi.mock("../lib/useSortiesLive", () => ({
  useSortiesLive: () => ({
    sorties: [],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date(),
    totalEnPreparation: 0,
    alertes: [],
    refresh: vi.fn(),
  }),
}));

vi.mock("../lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: [
      {
        documentId: "mat-1",
        designation: "Borne WiFi Ubiquiti UniFi",
        categorie: "",
        numeroSerie: "",
        valeurUnitaire: 1_600_000,
        quantiteStock: 2,
        statut: "en_stock",
        photos: [],
      },
      {
        documentId: "mat-2",
        designation: "Bureau top",
        categorie: "",
        numeroSerie: "",
        valeurUnitaire: null,
        quantiteStock: 4,
        statut: "en_stock",
        photos: [],
      },
    ],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: new Date().toISOString(),
    changementsQuantite: {},
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    // VRAIE forme renvoyée par GET /api/session/role : `type` = CODE métier,
    // `name` = LIBELLÉ affiché (« Dépositaire par service »). C'est bien ce que
    // voit un dépositaire en production.
    fetchSessionRole: vi.fn(async () => ({
      id: 7,
      documentId: "u-7",
      username: "Rakotomalala Hery",
      email: "hery@example.mg",
      department: null,
      fonction: null,
      role: { id: 2, type: "depositaire", name: "Dépositaire par service" },
    })),
    fetchDirections: vi.fn(async () => []),
    fetchServices: vi.fn(async () => []),
    fetchSorties: vi.fn(async () => []),
    creerSortie: vi.fn(async () => ({ reference: "SOR-2026-001" })),
  };
});

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

describe("Inventaire → « Ajouter à l'ordre de sortie »", () => {
  it("bascule vers l'onglet « Ordres de sortie » où le formulaire est pré-rempli", async () => {
    render(<Distribution />);

    const bouton = await screen.findByRole("button", {
      name: /Ajouter à l'ordre de sortie/i,
    });

    // Tant qu'on reste sur l'inventaire, le formulaire n'est pas monté :
    // le clic sans bascule d'onglet était donc invisible (« bouton mort »).
    expect(screen.queryByText("Nouvel ordre de sortie")).toBeNull();

    fireEvent.click(bouton);

    expect(await screen.findByText("Nouvel ordre de sortie")).toBeTruthy();
    // RÉGRESSION : le libellé « Dépositaire par service » doit ouvrir l'accès
    // (aucun refus), car la comparaison se fait sur le CODE `type`.
    expect(screen.queryByText(/Accès refusé/)).toBeNull();
    expect(screen.queryByText(/Accès réservé au rôle dépositaire/)).toBeNull();
    // Le matériau cliqué est bien pré-rempli dans le champ « Matériel ».
    // La désignation n'apparaît que dans la VALEUR du champ : le repère visuel
    // « Sélectionné » ne doit pas répéter le texte (chevauchement illisible).
    const champMateriel = screen.getByPlaceholderText(
      /Commencez à taper pour rechercher un matériel/i,
    ) as HTMLInputElement;
    expect(champMateriel.value).toBe("Borne WiFi Ubiquiti UniFi");
    expect(screen.getByText("Sélectionné")).toBeTruthy();
    expect(
      screen.queryAllByText("Borne WiFi Ubiquiti UniFi"),
    ).toHaveLength(0); // visible uniquement dans la valeur du champ
  });

  it("un matériau sans valeur unitaire garde son bouton désactivé", async () => {
    render(<Distribution />);

    await screen.findByRole("button", {
      name: /Ajouter à l'ordre de sortie/i,
    });

    const boutons = screen.getAllByRole("button", {
      name: /Valeur manquante/i,
    });
    expect(boutons).toHaveLength(1);
    expect((boutons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("affiche le filtre par défaut Toutes, conserve Demandées, et passe à En préparation après création", async () => {
    render(<Distribution />);

    // Basculer vers l'onglet Ordres de sortie
    const ongletOrdres = await screen.findByRole("tab", { name: /Ordres de sortie/i });
    fireEvent.mouseDown(ongletOrdres);
    fireEvent.click(ongletOrdres);

    // Vérifier la présence des onglets Toutes et Demandées
    const tabToutes = await screen.findByRole("tab", { name: /Toutes/i });
    const tabDemandees = await screen.findByRole("tab", { name: /Demandées/i });
    expect(tabToutes).toBeTruthy();
    expect(tabDemandees).toBeTruthy();
    // Le filtre par défaut est Toutes (data-state=active)
    expect(tabToutes.getAttribute("data-state")).toBe("active");
  });

  it("re-bascule vers En préparation lors d'une seconde création même si le filtre avait été changé manuellement", async () => {
    render(<Distribution />);

    // Aller sur Ordres de sortie
    const ongletOrdres = await screen.findByRole("tab", { name: /Ordres de sortie/i });
    fireEvent.mouseDown(ongletOrdres);
    fireEvent.click(ongletOrdres);

    // Remplir et créer le premier ordre
    fireEvent.change(screen.getByLabelText(/Pièce justificative/), { target: { value: "Bon 1" } });
    fireEvent.change(screen.getByLabelText(/Bénéficiaire/), { target: { value: "Dir 1" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ Ajouter une ligne/i }));
    const champMat = screen.getByPlaceholderText(/Commencez à taper pour rechercher/i);
    fireEvent.change(champMat, { target: { value: "Borne WiFi Ubiquiti UniFi" } });

    // Soumettre 1ère création
    const btnCreer = screen.getByRole("button", { name: /Créer l'ordre de sortie/i });
    fireEvent.click(btnCreer);

    // Succès 1 : affichage SOR et bascule vers En préparation
    expect(await screen.findByText(/Ordre de sortie créé avec succès/i)).toBeTruthy();
    const tabPrep = await screen.findByRole("tab", { name: /En préparation/i });
    expect(tabPrep.getAttribute("data-state")).toBe("active");

    // L'utilisateur change manuellement le filtre pour revenir sur Toutes
    const tabToutes = await screen.findByRole("tab", { name: /Toutes/i });
    fireEvent.mouseDown(tabToutes);
    fireEvent.click(tabToutes);
    expect(tabToutes.getAttribute("data-state")).toBe("active");

    // Fermer le bandeau de succès précédent
    fireEvent.click(screen.getByRole("button", { name: /Fermer/i }));

    // Remplir et créer le second ordre
    fireEvent.change(screen.getByLabelText(/Pièce justificative/), { target: { value: "Bon 2" } });
    fireEvent.change(screen.getByLabelText(/Bénéficiaire/), { target: { value: "Dir 2" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ Ajouter une ligne/i }));
    const champMat2 = screen.getByPlaceholderText(/Commencez à taper pour rechercher/i);
    fireEvent.change(champMat2, { target: { value: "Borne WiFi Ubiquiti UniFi" } });

    // Soumettre 2ème création
    fireEvent.click(screen.getByRole("button", { name: /Créer l'ordre de sortie/i }));

    // Succès 2 : re-basculement automatique vers En préparation grâce à la version incrémentée
    expect(await screen.findByText(/Ordre de sortie créé avec succès/i)).toBeTruthy();
    expect(tabPrep.getAttribute("data-state")).toBe("active");
  });
});
