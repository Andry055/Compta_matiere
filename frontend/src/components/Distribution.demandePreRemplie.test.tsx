// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Distribution } from "./Distribution";
import type { DemandeRecord } from "@/lib/demandes";

/**
 * ÉTAPE 3 « ouverte » : le dépositaire clique sur « Créer l'ordre de sortie »
 * dans l'écran Décision → la page Distribution s'ouvre sur l'onglet
 * « Ordres de sortie » et le formulaire se PRÉREMPLIT avec la demande :
 *   - pièce justificative = référence de la demande ;
 *   - direction et service appariés sur l'organigramme ;
 *   - lignes = fiches de stock + quantités approuvées ;
 *   - champ « Demande liée » = référence de la demande.
 * La création n'a lieu qu'à la CONFIRMATION du formulaire (le serveur reste
 * seul juge : stock, valeur unitaire, « une demande, un ordre »).
 */

let payloadCapture: any = null;
let mockDirections: Array<{ documentId: string; nom: string }> = [
  { documentId: "dir-1", nom: "Direction du Travail" },
];
let mockServices: Array<{ documentId: string; nom: string; directionId: string }> = [
  { documentId: "ser-1", nom: "Service Dev", directionId: "dir-1" },
];

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
        quantiteStock: 5,
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
    fetchSessionRole: vi.fn(async () => ({
      id: 7,
      documentId: "u-7",
      username: "Rakotomalala Hery",
      email: "hery@example.mg",
      department: null,
      fonction: null,
      role: { id: 2, type: "depositaire", name: "Dépositaire par service" },
    })),
    fetchDirections: vi.fn(async () => mockDirections),
    fetchServices: vi.fn(async () => mockServices),
    fetchSorties: vi.fn(async () => []),
    creerSortie: vi.fn(async (payload) => {
      payloadCapture = payload;
      return { reference: "SOR-2026-042" };
    }),
  };
});

vi.mock("@/lib/demandes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demandes")>();
  return {
    ...actual,
    fetchDemandesPourLiaison: vi.fn(async () => [
      { documentId: "dem-2026-020", reference: "DEM-2026-020", statut: "approuvee" },
    ]),
  };
});

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

/** Demande APPROUVÉE reçue par le dépositaire (étape 2 terminée). */
const DEMANDE_APPROUVEE: DemandeRecord = {
  id: 20,
  documentId: "dem-2026-020",
  reference: "DEM-2026-020",
  date: "2026-10-19",
  lignes: [
    {
      categorie: "Informatique",
      materiel: "Borne WiFi Ubiquiti UniFi",
      quantite: 2,
      quantiteDemandee: 3,
      motif: "Poste de travail",
      materielDocumentId: "mat-1",
    },
  ],
  priorite: "Normal",
  statut: "Validée",
  direction: "Direction du Travail",
  service: "Service Dev",
  demandeur: "Rakotoson Jean",
};

beforeEach(() => {
  payloadCapture = null;
  mockDirections = [{ documentId: "dir-1", nom: "Direction du Travail" }];
  mockServices = [{ documentId: "ser-1", nom: "Service Dev", directionId: "dir-1" }];
});

afterEach(cleanup);

describe("Distribution — demande transformée en ordre de sortie prérempli", () => {
  it("ouvre l'onglet « Ordres de sortie » et préremplit le formulaire", async () => {
    const onConsume = vi.fn();
    render(
      <Distribution
        initialDemande={DEMANDE_APPROUVEE}
        onInitialDemandeConsumed={onConsume}
      />
    );

    // Bascule AUTOMATIQUE vers l'onglet « Ordres de sortie » (le formulaire
    // n'existe que dans cet onglet : sans bascule, le bouton serait « mort »).
    const ongletOrdres = await screen.findByRole("tab", {
      name: /Ordres de sortie/i,
    });
    expect(ongletOrdres.getAttribute("data-state")).toBe("active");
    expect(await screen.findByText("Nouvel ordre de sortie")).toBeTruthy();

    // Le parent est notifié une seule fois (aucun re-jeu au re-rendu).
    await waitFor(() => expect(onConsume).toHaveBeenCalledTimes(1));

    // Pièce justificative = RÉFÉRENCE de la demande (règle serveur).
    expect(
      (screen.getByLabelText(/Pièce justificative/) as HTMLTextAreaElement).value
    ).toBe("DEM-2026-020");

    // Champ « Demande liée » = référence de la demande.
    expect(
      (screen.getByLabelText(/Demande liée/) as HTMLInputElement).value
    ).toBe("DEM-2026-020");

    // Ligne préremplie avec la FICHE de stock et la quantité approuvée.
    expect(
      (
        screen.getByPlaceholderText(
          /Commencez à taper pour rechercher un matériel/i
        ) as HTMLInputElement
      ).value
    ).toBe("Borne WiFi Ubiquiti UniFi");
    expect(screen.getByText("Sélectionné")).toBeTruthy();
    expect((screen.getByLabelText(/^Quantité/) as HTMLInputElement).value).toBe(
      "2"
    );

    // Destination résolue (direction + service) : aucune erreur affichée et
    // le bouton de création est DÉSACTIVÉ seulement si un blocage subsiste.
    expect(screen.queryByText(/Une destination est obligatoire/i)).toBeNull();
    expect(screen.queryByText(/Création impossible en l'état/i)).toBeNull();
    expect(
      (screen.getByRole("button", { name: /Créer l'ordre de sortie/i }) as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it("la confirmation du formulaire crée l'ordre LIÉ à la demande", async () => {
    render(<Distribution initialDemande={DEMANDE_APPROUVEE} />);

    await screen.findByRole("button", { name: /Créer l'ordre de sortie/i });
    // On attend la fin du préremplissage (liste des demandes + organigramme
    // chargés) : le bouton n'est cliquable qu'une fois le brouillon valide.
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/Demande liée/) as HTMLInputElement).value
      ).toBe("DEM-2026-020")
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", { name: /Créer l'ordre de sortie/i }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Créer l'ordre de sortie/i })
    );

    await waitFor(() => expect(payloadCapture).toBeTruthy());
    expect(payloadCapture.justificatif).toBe("DEM-2026-020");
    expect(payloadCapture.demande_id).toBe("dem-2026-020");
    expect(payloadCapture.direction_id).toBe("dir-1");
    expect(payloadCapture.service_id).toBe("ser-1");
    expect(payloadCapture.lignes).toHaveLength(1);
    expect(payloadCapture.lignes[0].materiel_id).toBe("mat-1");
    expect(payloadCapture.lignes[0].quantite).toBe(2);
  });

  it("un organigramme inconnu retombe sur le bénéficiaire (le demandeur)", async () => {
    mockDirections = [];
    mockServices = [];

    render(
      <Distribution
        initialDemande={{
          ...DEMANDE_APPROUVEE,
          direction: "Direction Inexistante",
          service: "Service Inexistant",
        }}
      />
    );

    const bouton = await screen.findByRole("button", {
      name: /Créer l'ordre de sortie/i,
    });
    expect(bouton).toBeTruthy();

    // La destination reste valide grâce au bénéficiaire (= le demandeur) :
    // le formulaire n'est jamais bloqué silencieusement.
    await waitFor(() =>
      expect(
        (screen.getByLabelText(/Bénéficiaire/) as HTMLInputElement).value
      ).toBe("Rakotoson Jean")
    );
    expect(screen.queryByText(/Une destination est obligatoire/i)).toBeNull();
    expect(
      (
        screen.getByRole("button", { name: /Créer l'ordre de sortie/i }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });
});
