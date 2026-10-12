// @vitest-environment jsdom
//
// Écrans Équipements et Tableau de bord : lecture en quasi temps réel du stock
// RÉEL (champ serveur `quantite_stock`) via le hook partagé useMaterialsLive.
//
// Toutes les situations sont jouées avec des minuteurs SIMULÉS (vi.useFakeTimers)
// pour contrôler le sondage de 20 secondes, le retour sur l'onglet et les
// déclencheurs d'événements sans attendre le temps réel.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Equipment } from "./Equipment";
import { Dashboard } from "./Dashboard";
import { api } from "../lib/api";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const INFO_BULLE =
  "Le stock évolue uniquement par le circuit d’entrée validé (3 signatures)";

interface LigneSimulee {
  documentId: string;
  designation: string;
  quantite: number;
  statut?: string;
  valeur?: number;
}

/** Réponse GET /api/materials (ligne Strapi `material`). */
function matieres(rows: LigneSimulee[]) {
  return rows.map((r, i) => ({
    id: i + 1,
    documentId: r.documentId,
    designation: r.designation,
    nomenclature: `NOM-${i + 1}`,
    numero_serie: `SN-${i + 1}`,
    statut: r.statut ?? "en_stock",
    quantite_stock: r.quantite,
    valeur_unitaire: r.valeur ?? 1000,
    categorie: { nom: "Informatique" },
    createdAt: "2026-10-01T08:00:00.000Z",
    photos: [],
  }));
}

function reponse(
  rows: unknown[],
  pagination?: { page: number; pageSize: number; total: number }
) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 200;
  const total = pagination?.total ?? rows.length;
  return {
    data: {
      data: rows,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          total,
        },
      },
    },
  };
}

/** Vide la file des microtâches (promesses) puis les minuteurs simulés. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 50; i++) await Promise.resolve();
  });
}

function rendreVisible() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => false,
  });
}

function rendreMasque() {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "hidden",
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => true,
  });
}

let getSpy: ReturnType<typeof vi.spyOn>;

/** Nombre d'appels GET sur UN chemin : l'écran lit aussi `/api/entree-lignes`
 *  (vignette de repli des fiches sans photo) — les comptes de déclencheurs
 *  portent sur `/api/materials`, la lecture du stock. */
const appels = (chemin: string) =>
  getSpy.mock.calls.filter((appel) => appel[0] === chemin).length;

beforeEach(() => {
  vi.useFakeTimers();
  rendreVisible();
  getSpy = vi.spyOn(api, "get");
  // Par défaut : rien à lire (ni matériel ni ligne) — surtout JAMAIS de vraie
  // requête réseau quand un test ne mocke que /api/materials.
  getSpy.mockImplementation(() => Promise.resolve(reponse([])));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  rendreVisible();
});

describe("Stock réel en quasi temps réel (useMaterialsLive)", () => {
  it("1. une quantité qui change côté API apparaît seule, sans action utilisateur et sans repasser par « chargement »", async () => {
    getSpy
      .mockResolvedValueOnce(
        reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 }]))
      )
      .mockResolvedValue(
        reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 157 }]))
      );

    render(<Equipment />);
    await flush();

    // Premier chargement : état « chargement » puis données du serveur.
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();

    // Sondage automatique (20 s) : nouvelle valeur SANS aucune action de l'utilisateur.
    await flush(20000);

    expect(screen.getAllByText("157").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();
    expect(screen.queryByText(/Impossible de charger le stock/)).toBeNull();

    // Signal visuel quelques secondes : « 150 → 157 ».
    const badge = screen.getByTestId("changement-quantite-doc-a");
    expect(badge.textContent).toContain("150 → 157");

    // Indicateur de synchro + bouton Rafraîchir (style écran de réception).
    expect(screen.getAllByText(/Synchronisé il y a/).length).toBeGreaterThan(0);
    expect(screen.getByText("Rafraîchir")).toBeTruthy();

    // Le signal disparaît quelques secondes plus tard.
    await flush(5000);
    expect(screen.queryByTestId("changement-quantite-doc-a")).toBeNull();
  });

  it("2. le sondage est en pause quand l'onglet est masqué et reprend au retour", async () => {
    rendreMasque();
    getSpy.mockResolvedValue(
      reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 }]))
    );

    render(<Equipment />);
    await flush();
    expect(appels("/api/materials")).toBe(1);

    // Onglet masqué : AUCUN sondage, même au-delà de 20 s.
    await flush(60000);
    expect(appels("/api/materials")).toBe(1);

    // Retour sur l'onglet : rechargement immédiat + reprise du sondage.
    rendreVisible();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    expect(appels("/api/materials")).toBe(2);

    await flush(20000);
    expect(appels("/api/materials")).toBe(3);
  });

  it("3. jamais deux requêtes simultanées (un seul déclencheur à la fois)", async () => {
    getSpy.mockResolvedValueOnce(
      reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 }]))
    );
    render(<Equipment />);
    await flush();
    expect(appels("/api/materials")).toBe(1);

    // Requête stock en vol : elle reste inachevée (les lignes, elles,
    // répondent immédiatement — seul le stock doit bloquer le cycle).
    let finDeRequete: (() => void) | null = null;
    getSpy.mockImplementation((url: string) => {
      if (url === "/api/entree-lignes") return Promise.resolve(reponse([]));
      return new Promise((resolve) => {
        finDeRequete = () =>
          resolve(
            reponse(
              matieres([
                { documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 175 },
              ])
            )
          );
      });
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("stock-mis-a-jour"));
    });
    await flush();
    expect(appels("/api/materials")).toBe(2);

    // Tandis que la requête est en vol : sondage + autres déclencheurs IGNORÉS.
    await flush(20000);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("stock-mis-a-jour"));
      window.dispatchEvent(new Event("online"));
    });
    await flush();
    expect(appels("/api/materials")).toBe(2);

    // Pendant la requête : les données restent affichées (jamais l'écran de chargement).
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);

    // Fin de la requête unique : la nouvelle valeur s'affiche.
    await act(async () => {
      finDeRequete?.();
    });
    await flush();
    expect(screen.getAllByText("175").length).toBeGreaterThan(0);
    expect(appels("/api/materials")).toBe(2);
  });

  it("4. l'événement stock-mis-a-jour déclenche un rechargement immédiat", async () => {
    getSpy
      .mockResolvedValueOnce(
        reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 }]))
      )
      .mockResolvedValue(
        reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 200 }]))
      );

    render(<Equipment />);
    await flush();
    expect(appels("/api/materials")).toBe(1);

    // Aucun minuteur n'est avancé : le déclencheur doit suffire.
    await act(async () => {
      window.dispatchEvent(new CustomEvent("stock-mis-a-jour"));
    });
    await flush(0);

    expect(appels("/api/materials")).toBe(2);
    expect(screen.getAllByText("200").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();
  });

  it("5. après un échec réseau : données conservées + message, puis reprise au déclencheur suivant", async () => {
    getSpy.mockResolvedValueOnce(
      reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 }]))
    );
    render(<Equipment />);
    await flush();
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);

    // Échec réseau au sondage suivant.
    getSpy.mockRejectedValueOnce(new Error("réseau coupé"));
    await flush(20000);

    // Les dernières données restent affichées + message explicite.
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Connexion indisponible, dernière synchro à \d{2}:\d{2}/)
    ).toBeTruthy();
    expect(screen.queryByText(/Chargement du stock réel/)).toBeNull();
    expect(screen.queryByText(/Impossible de charger le stock/)).toBeNull();

    // Reprise au déclencheur suivant (retour sur l'onglet) avec des données à jour.
    getSpy.mockResolvedValueOnce(
      reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 165 }]))
    );
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();

    expect(screen.getAllByText("165").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Connexion indisponible/)).toBeNull();
  });

  it("6. recherche, filtres et élément sélectionné sont conservés pendant un rafraîchissement", async () => {
    getSpy.mockResolvedValue(
      reponse([
        { documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 },
        { documentId: "doc-b", designation: "Chaise de bureau", quantite: 10 },
      ])
    );

    render(<Equipment />);
    await flush();

    // Recherche + filtre de statut.
    const recherche = screen.getByPlaceholderText(
      "Rechercher par nom ou numéro de série..."
    );
    fireEvent.change(recherche, { target: { value: "Routeur" } });
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "Disponible" } });
    expect(screen.queryByText("Chaise de bureau")).toBeNull();

    // Sélection d'un élément (fiche détaillée).
    fireEvent.click(screen.getAllByTitle("Actions")[0]);
    fireEvent.click(screen.getByText("Voir les détails").closest("button")!);
    expect(screen.getByText("Détails de l'équipement")).toBeTruthy();

    // Rafraîchissement manuel avec une quantité modifiée côté serveur.
    getSpy.mockResolvedValueOnce(
      reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 157 }]))
    );
    const avant = appels("/api/materials");
    fireEvent.click(screen.getByText("Rafraîchir"));
    await flush();

    expect(appels("/api/materials")).toBe(avant + 1);
    // Recherche conservée.
    expect(
      (screen.getByPlaceholderText("Rechercher par nom ou numéro de série...") as HTMLInputElement).value
    ).toBe("Routeur");
    // Filtre conservé.
    expect((document.querySelectorAll("select")[0] as HTMLSelectElement).value).toBe("Disponible");
    // Élément sélectionné conservé ET mis à jour avec la nouvelle quantité.
    expect(screen.getByText("Détails de l'équipement")).toBeTruthy();
    expect(screen.getAllByText("157").length).toBeGreaterThan(0);
    expect(screen.queryByText("Chaise de bureau")).toBeNull();
  });

  it("7. avec plus de 200 matériels simulés, tous sont affichés (pagination complète)", async () => {
    const total = 250;
    const lignes = matieres(
      Array.from({ length: total }, (_, i) => ({
        documentId: `doc-${i + 1}`,
        designation: `Matériel ${String(i + 1).padStart(3, "0")}`,
        quantite: i + 1,
      }))
    );

    getSpy.mockImplementation((_url, options) => {
      const page = Number(options?.params?.["pagination[page]"] ?? 1);
      const pageSize = Number(options?.params?.["pagination[pageSize]"] ?? 200);
      const debut = (page - 1) * pageSize;
      return Promise.resolve(
        reponse(lignes.slice(debut, debut + pageSize), { page, pageSize, total })
      );
    });

    render(<Equipment />);
    await flush();

    // Les deux pages ont été parcourues : rien n'est tronqué silencieusement.
    expect(appels("/api/materials")).toBeGreaterThanOrEqual(2);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(total);
    // Présent dans la vue mobile ET dans le tableau desktop.
    expect(screen.getAllByText("Matériel 250").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Liste des Équipements (250)")).toBeTruthy();
  });

  it("8. aucune action fictive ne modifie l'affichage", async () => {
    getSpy.mockResolvedValue(
      reponse(matieres([{ documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150 }]))
    );
    const { toast } = await import("sonner");

    render(<Equipment />);
    await flush();

    // Comptage sur les LIGNES du tableau (le menu ouvert répète la désignation).
    const lignesAvant = document.querySelectorAll("tbody tr").length;
    expect(lignesAvant).toBe(1);
    expect(screen.getAllByText("Routeur Cisco RV340").length).toBeGreaterThan(0);

    // Bouton d'ajout : masqué en action, avec l'info-bulle exigée.
    const ajouter = screen.getByText("Ajouter Équipement").closest("button")!;
    expect(ajouter.disabled).toBe(true);
    expect(ajouter.title).toBe(INFO_BULLE);
    fireEvent.click(ajouter);

    // Menu d'actions de la ligne : toutes les actions fictives sont désactivées.
    fireEvent.click(screen.getAllByTitle("Actions")[0]);
    for (const libelle of [
      "Modifier",
      "Historique",
      "Dupliquer",
      "Exporter",
      "Partager",
      "Archiver",
      "Supprimer",
    ]) {
      const bouton = screen.getByText(libelle).closest("button")!;
      expect(bouton.disabled).toBe(true);
      expect(bouton.title).toBe(INFO_BULLE);
      fireEvent.click(bouton);
    }

    // Aucune modification locale : même liste, aucune modale, aucun toast.
    expect(document.querySelectorAll("tbody tr")).toHaveLength(lignesAvant);
    expect(screen.getAllByText("Routeur Cisco RV340").length).toBeGreaterThan(0);
    expect(screen.queryByText("Confirmer la suppression")).toBeNull();
    expect(screen.queryByText("Détails de l'équipement")).toBeNull();
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    expect(vi.mocked(toast.success)).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    expect(appels("/api/materials")).toBe(1);
  });

  it("9. Équipements et tableau de bord affichent les mêmes quantités", async () => {
    getSpy.mockResolvedValue(
      reponse(
        matieres([
          { documentId: "doc-a", designation: "Routeur Cisco RV340", quantite: 150, statut: "en_stock" },
          { documentId: "doc-b", designation: "Chaise de bureau", quantite: 30, statut: "distribue" },
        ])
      )
    );

    render(<Equipment />);
    await flush();
    render(<Dashboard />);
    await flush();

    // Équipements : les quantités serveur telles quelles.
    expect(screen.getAllByText("150").length).toBeGreaterThan(0);
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);

    // Tableau de bord : indicateurs recalculés sur CES MÊMES données.
    const carte = screen.getByText("Matériels en Stock").parentElement!
      .parentElement!;
    expect(carte.textContent).toContain("150");
    // Seuls les matériels en_stock sont cumulés (la chaise distribuée est exclue).
    expect(carte.textContent).not.toContain("30");
  });
});
