// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RemiseDetenteurDemandeur } from "./RemiseDetenteurDemandeur";
import type { SortieRecord } from "@/lib/movements";
import type { ReceptionPhysiqueRecord } from "@/lib/api";
import * as api from "@/lib/api";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";

// Mock des fonctions API
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    fetchRemisesDetenteurs: vi.fn(),
    createRemiseDetenteur: vi.fn(),
  };
});

// Données de test
const sortieRecueComplete: SortieRecord = {
  id: "SORT-001",
  reference: "SORT-2025-001",
  dateSortie: "2025-01-15",
  materiel: "Ordinateurs portables HP",
  categorie: "Informatique",
  quantite: 5,
  serviceDemandeur: "Service IT",
  direction: "DSI",
  directionId: "dir-1",
  beneficiaire: "Jean Dupont",
  responsable: "Marie Martin",
  statut: "Sortie effectuée",
  magasinier_signed: true,
  depositaire_signed: true,
  logistique_signed: true,
  justificatif: "Demande DEM-2025-001",
  documents: [],
  lignes: [
    {
      documentId: "ligne-1",
      designation: "Ordinateur portable HP EliteBook",
      quantite: 3,
      etat: "neuf",
      observations: null,
      valeurUnitaire: 1500000,
      montant: 4500000,
      numeroLogistique: "LOG-001",
    },
    {
      documentId: "ligne-2",
      designation: "Souris sans fil Logitech",
      quantite: 2,
      etat: "neuf",
      observations: null,
      valeurUnitaire: 150000,
      montant: 300000,
      numeroLogistique: "LOG-002",
    },
  ],
};

const sortieAvecReliquat: SortieRecord = {
  ...sortieRecueComplete,
  id: "SORT-002",
  reference: "SORT-2025-002",
  quantite: 10,
  lignes: [
    {
      documentId: "ligne-3",
      designation: "Écran Dell 24\"",
      quantite: 10,
      etat: "neuf",
      observations: null,
      valeurUnitaire: 800000,
      montant: 8000000,
      numeroLogistique: "LOG-003",
    },
  ],
};

const mockUser = {
  id: "user-1",
  name: "Pierre Demandeur",
  role: "demandeur",
  directionId: "dir-1",
};

const mockReceptionsServeur: ReceptionPhysiqueRecord[] = [
  {
    id: "rec-1",
    sortieId: "SORT-001",
    date_reception: "2025-01-16T10:00:00Z",
    statut: "conforme",
    quantite_prevue: 5,
    quantite_recue: 5,
    utilisateur: "Pierre Demandeur",
    createdAt: "2025-01-16T10:00:00Z",
    updatedAt: "2025-01-16T10:00:00Z",
  },
];

// Remise existante retournée par l'API (mock)
const mockRemiseExistante = {
  id: "rem-1",
  documentId: "rem-1",
  reference: "RD-2025-001",
  date_remise: "2025-01-17T10:00:00Z",
  sortie: {
    documentId: "SORT-001",
    reference: "SORT-2025-001",
    dateSortie: "2025-01-15",
    materiel: "Ordinateurs portables HP",
    quantite: 5,
    beneficiaire: "Jean Dupont",
    direction: "DSI",
    serviceDemandeur: "Service IT",
    remise_detenteur_cloturee: true,
  },
  lignes: [
    {
      id: "rem-ligne-1",
      documentId: "rem-ligne-1",
      sortie_ligne: {
        documentId: "ligne-1",
        designation: "Ordinateur portable HP EliteBook",
        quantite: 3,
      },
      detenteur_nom: "Rakoto",
      detenteur_fonction: "Chef IT",
      observation: "",
      createdAt: "2025-01-17T10:00:00Z",
      updatedAt: "2025-01-17T10:00:00Z",
      publishedAt: "2025-01-17T10:00:00Z",
    },
    {
      id: "rem-ligne-2",
      documentId: "rem-ligne-2",
      sortie_ligne: {
        documentId: "ligne-2",
        designation: "Souris sans fil Logitech",
        quantite: 2,
      },
      detenteur_nom: "Rasoa",
      detenteur_fonction: "Assistant IT",
      observation: "",
      createdAt: "2025-01-17T10:00:00Z",
      updatedAt: "2025-01-17T10:00:00Z",
      publishedAt: "2025-01-17T10:00:00Z",
    },
  ],
  attestation: true,
  createdAt: "2025-01-17T10:00:00Z",
  updatedAt: "2025-01-17T10:00:00Z",
  publishedAt: "2025-01-17T10:00:00Z",
};

// Fonction helper pour attendre que le chargement initial se termine
async function attendreChargementRemises() {
  // Attendre que le spinner de chargement disparaisse OU que le contenu apparaisse
  await waitFor(() => {
    // Soit le chargement est fini (plus de spinner), soit on a le contenu
    const spinner = screen.queryByText("Chargement des remises…");
    const contenu = screen.queryByText("SORT-2025-001");
    const etatVide = screen.queryByText("Aucune sortie éligible à la remise");
    const compteur = screen.queryByText("Sorties réceptionnées complètement");

    if (spinner) {
      throw new Error("Encore en chargement");
    }
    if (contenu || etatVide || compteur) {
      return; // Chargement terminé
    }
    throw new Error("En attente de chargement");
  }, { timeout: 3000 });
}

describe("RemiseDetenteurDemandeur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations - important: mockReset() clears the implementation
    vi.mocked(api.fetchRemisesDetenteurs).mockReset();
    vi.mocked(api.createRemiseDetenteur).mockReset();
    // Default: no existing remises
    vi.mocked(api.fetchRemisesDetenteurs).mockResolvedValue([]);
    vi.mocked(api.createRemiseDetenteur).mockResolvedValue(mockRemiseExistante);
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche le titre sans badge de simulation", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    expect(screen.getByText("Remise au détenteur")).toBeInTheDocument();
    // Plus de badge "Mode simulation (localStorage)"
    expect(screen.queryByText("Mode simulation")).not.toBeInTheDocument();
  });

  it("affiche les compteurs corrects", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete, sortieAvecReliquat]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    // Seulement sortieRecueComplete a reliquat = 0 (5 reçus sur 5)
    expect(screen.getByText("1")).toBeInTheDocument(); // Sorties réceptionnées complètement
    expect(screen.getByText("Sorties réceptionnées complètement")).toBeInTheDocument();
  });

  it("n'affiche que les sorties avec réception complète (reliquat = 0)", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete, sortieAvecReliquat]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    expect(screen.getByText("SORT-2025-001")).toBeInTheDocument();
    expect(screen.queryByText("SORT-2025-002")).not.toBeInTheDocument();
  });

  it("ouvre le formulaire quand on clique sur 'Enregistrer la remise'", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    const button = screen.getByText("Enregistrer la remise");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Remise au détenteur — SORT-2025-001")).toBeInTheDocument();
    });
  });

  it("valide que toutes les lignes ont un détenteur avant de soumettre", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    const button = screen.getByText("Enregistrer la remise");
    fireEvent.click(button);

    // Attendre que le dialogue s'ouvre
    await waitFor(() => {
      expect(screen.getByText("Remise au détenteur — SORT-2025-001")).toBeInTheDocument();
    });

    // Le message de validation doit s'afficher (bouton "Enregistrer la remise" désactivé)
    await waitFor(() => {
      expect(screen.getByText("2 ligne(s) sans détenteur défini.")).toBeInTheDocument();
    });

    // Le bouton "Enregistrer la remise" dans le dialogue doit être désactivé
    const saveButton = screen.getByRole("button", { name: "Enregistrer la remise" });
    expect(saveButton).toBeDisabled();
  });

  it("permet de remplir les détenteurs et de confirmer la remise", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    const button = screen.getByText("Enregistrer la remise");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Remise au détenteur — SORT-2025-001")).toBeInTheDocument();
    });

    // Remplir les champs pour les 2 lignes
    const inputs = screen.getAllByPlaceholderText("Ex: Rakoto");
    fireEvent.change(inputs[0], { target: { value: "Rakoto" } });
    fireEvent.change(inputs[1], { target: { value: "Rasoa" } });

    const fonctionInputs = screen.getAllByPlaceholderText("Ex: Chef de service IT");
    fireEvent.change(fonctionInputs[0], { target: { value: "Chef IT" } });
    fireEvent.change(fonctionInputs[1], { target: { value: "Assistant IT" } });

    // Soumettre le formulaire via testid
    const form = screen.getByTestId("rdd-form");
    fireEvent.submit(form);

    // Vérifier que l'API a été appelée
    await waitFor(() => {
      expect(vi.mocked(api.createRemiseDetenteur)).toHaveBeenCalledWith(
        expect.objectContaining({
          sortie: "SORT-001",
          date_remise: expect.any(String),
          materiels: expect.arrayContaining([
            expect.objectContaining({
              ligne: "ligne-1",
              detenteur_nom: "Rakoto",
              detenteur_fonction: "Chef IT",
            }),
            expect.objectContaining({
              ligne: "ligne-2",
              detenteur_nom: "Rasoa",
              detenteur_fonction: "Assistant IT",
            }),
          ]),
          attestation: true,
        })
      );
    });

    // Vérifier que toast.success a été appelé avec le nouveau message (sans "simulation")
    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "Remise au détenteur enregistrée",
        expect.any(Object)
      );
    });
  });

  it("affiche les détenteurs déjà enregistrés en lecture seule (depuis l'API)", async () => {
    // Mock fetchRemisesDetenteurs pour retourner une remise existante
    vi.mocked(api.fetchRemisesDetenteurs).mockResolvedValue([mockRemiseExistante]);

    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    // Attendre le chargement des remises depuis l'API
    await waitFor(() => {
      expect(screen.getByText("→ Rakoto (Chef IT)")).toBeInTheDocument();
    });

    expect(screen.getByText("→ Rasoa (Assistant IT)")).toBeInTheDocument();
    // Nouveau texte : "Remis au détenteur" avec la date (pas "(simulation)")
    expect(screen.getByText("Remis au détenteur")).toBeInTheDocument();
    // Date formatée - utiliser un matcher flexible car toLocaleDateString dépend du fuseau horaire
    await waitFor(() => {
      expect(screen.getByText(/17\/01\/2025|16\/01\/2025/)).toBeInTheDocument();
    });
    // Badge "Remis au détenteur" (pas "Déjà remis")
    expect(screen.getByText("Remis au détenteur")).toBeInTheDocument();
    // Le bouton "Enregistrer la remise" ne doit pas être affiché pour cette sortie
    expect(screen.queryByText("Enregistrer la remise")).not.toBeInTheDocument();
  });

  it("affiche le message d'état vide quand aucune sortie n'est éligible", async () => {
    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieAvecReliquat]} // Cette sortie a du reliquat
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    expect(screen.getByText("Aucune sortie éligible à la remise")).toBeInTheDocument();
    expect(screen.getByText("Les sorties doivent avoir une réception physique complète (reliquat = 0) et le statut « Sortie effectuée ».")).toBeInTheDocument();
  });

  it("gère l'erreur API lors de la création de la remise", async () => {
    // Mock l'erreur API
    vi.mocked(api.createRemiseDetenteur).mockRejectedValue(new Error("Erreur serveur"));

    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    const button = screen.getByText("Enregistrer la remise");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Remise au détenteur — SORT-2025-001")).toBeInTheDocument();
    });

    // Remplir les champs pour les 2 lignes
    const inputs = screen.getAllByPlaceholderText("Ex: Rakoto");
    fireEvent.change(inputs[0], { target: { value: "Rakoto" } });
    fireEvent.change(inputs[1], { target: { value: "Rasoa" } });

    const fonctionInputs = screen.getAllByPlaceholderText("Ex: Chef de service IT");
    fireEvent.change(fonctionInputs[0], { target: { value: "Chef IT" } });
    fireEvent.change(fonctionInputs[1], { target: { value: "Assistant IT" } });

    // Soumettre le formulaire
    const form = screen.getByTestId("rdd-form");
    fireEvent.submit(form);

    // Vérifier que toast.error a été appelé avec le message d'erreur du composant
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Échec",
        expect.objectContaining({
          description: "Échec de l'enregistrement de la remise.",
        })
      );
    });
  });

  it("affiche l'état de chargement pendant l'appel API", async () => {
    // Mock avec délai pour tester l'état de chargement
    let resolveCreate: (value: any) => void;
    const createPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });
    vi.mocked(api.createRemiseDetenteur).mockReturnValue(createPromise);

    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    await attendreChargementRemises();

    // Cliquer sur "Enregistrer la remise" sur la carte principale -> ouvre le dialogue
    const button = screen.getByText("Enregistrer la remise");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Remise au détenteur — SORT-2025-001")).toBeInTheDocument();
    });

    // Remplir les champs
    const inputs = screen.getAllByPlaceholderText("Ex: Rakoto");
    fireEvent.change(inputs[0], { target: { value: "Rakoto" } });
    fireEvent.change(inputs[1], { target: { value: "Rasoa" } });

    const fonctionInputs = screen.getAllByPlaceholderText("Ex: Chef de service IT");
    fireEvent.change(fonctionInputs[0], { target: { value: "Chef IT" } });
    fireEvent.change(fonctionInputs[1], { target: { value: "Assistant IT" } });

    // Dans le dialogue, cliquer sur "Enregistrer la remise" (pied de page) -> ouvre la confirmation
    // Il y a deux boutons "Enregistrer la remise" : un sur la page principale et un dans le dialogue
    // On prend le dernier (celui dans le dialogue)
    const enregistrerButtons = screen.getAllByText("Enregistrer la remise");
    fireEvent.click(enregistrerButtons[enregistrerButtons.length - 1]);

    // Maintenant le bouton "Confirmer la remise" devrait être visible dans le footer
    // Utiliser getByRole pour cibler spécifiquement le bouton (pas le titre du modal)
    const confirmButton = await waitFor(() =>
      screen.getByRole("button", { name: "Confirmer la remise" })
    );
    fireEvent.click(confirmButton);

    // Le bouton doit être désactivé pendant le chargement
    // Quand isSubmitting=true, le texte du bouton devient "Enregistrement..."
    // Il y a deux boutons "Enregistrement..." (footer dialogue + modal de confirmation)
    // On prend le premier
    const saveButtons = await waitFor(() =>
      screen.getAllByRole("button", { name: /enregistrement/i })
    );
    const saveButton = saveButtons[0];
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Enregistrement...");

    // Résoudre la promesse
    resolveCreate!(mockRemiseExistante);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "Remise au détenteur enregistrée",
        expect.any(Object)
      );
    });
  });

  it("rafraîchit la liste après une remise réussie via onRemiseConfirmee", async () => {
    const onRemiseConfirmee = vi.fn();

    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
        onRemiseConfirmee={onRemiseConfirmee}
      />
    );

    await attendreChargementRemises();

    const button = screen.getByText("Enregistrer la remise");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Remise au détenteur — SORT-2025-001")).toBeInTheDocument();
    });

    // Remplir les champs
    const inputs = screen.getAllByPlaceholderText("Ex: Rakoto");
    fireEvent.change(inputs[0], { target: { value: "Rakoto" } });
    fireEvent.change(inputs[1], { target: { value: "Rasoa" } });

    const fonctionInputs = screen.getAllByPlaceholderText("Ex: Chef de service IT");
    fireEvent.change(fonctionInputs[0], { target: { value: "Chef IT" } });
    fireEvent.change(fonctionInputs[1], { target: { value: "Assistant IT" } });

    const form = screen.getByTestId("rdd-form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        "Remise au détenteur enregistrée",
        expect.any(Object)
      );
    });

    // Vérifier que onRemiseConfirmee a été appelé pour rafraîchir
    await waitFor(() => {
      expect(onRemiseConfirmee).toHaveBeenCalled();
    });
  });

  it("ne permet pas de créer une remise si une remise existe déjà pour la sortie (clôturée)", async () => {
    // Mock fetchRemisesDetenteurs pour retourner une remise existante (clôturée)
    vi.mocked(api.fetchRemisesDetenteurs).mockResolvedValue([mockRemiseExistante]);

    render(
      <RemiseDetenteurDemandeur
        sorties={[sortieRecueComplete]}
        receptionsServeur={mockReceptionsServeur}
        user={mockUser}
      />
    );

    // Attendre le chargement
    await waitFor(() => {
      expect(screen.getByText("Remis au détenteur")).toBeInTheDocument();
    });

    // Le bouton "Enregistrer la remise" ne doit pas être présent pour cette sortie
    // car remise_detenteur_cloturee = true
    expect(screen.queryByText("Enregistrer la remise")).not.toBeInTheDocument();
  });
});