// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { MyRequests } from "./MyRequests";

/**
 * ÉTAPE 1 « Demande » — ÉCRITURE.
 *
 *  - le matériel vient du STOCK RÉEL (et non d'une liste de démonstration) ;
 *  - toutes les lignes partent dans UNE SEULE requête (`data.lignes`) ;
 *  - la direction / le service / la référence ne sont JAMAIS envoyés par
 *    l'écran : ils sont déduits du compte côté serveur ;
 *  - une erreur du serveur est VISIBLE, et aucun message de succès n'apparaît.
 */

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn(), post: postMock },
  };
});

/** État du hook `useMaterialsLive`, modifiable par chaque test. */
const etatStock = vi.hoisted(() => ({
  materials: [
    {
      documentId: "mat-1",
      designation: "Clavier compact",
      categorie: "Informatique",
      quantiteStock: 5,
      statut: "en_stock",
    },
    {
      documentId: "mat-2",
      designation: "Webcam HD",
      categorie: "Informatique",
      quantiteStock: 2,
      statut: "en_stock",
    },
  ],
  isLoading: false,
  isInitialError: false,
  isRefreshing: false,
  messageErreur: null as string | null,
}));

vi.mock("@/lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: etatStock.materials,
    isLoading: etatStock.isLoading,
    isInitialError: etatStock.isInitialError,
    isRefreshing: etatStock.isRefreshing,
    messageErreur: etatStock.messageErreur,
    derniereSync: null,
    changementsQuantite: [],
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/demandes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demandes")>();
  return { ...actual, fetchDemandes: vi.fn(async () => null) };
});

/** Matériel de DÉMONSTRATION : ne doit JAMAIS être proposé au demandeur. */
vi.mock("./Equipment", () => ({
  mockEquipment: [
    { name: "Clavier mécanique Logitech", category: "Informatique" },
  ],
}));

const UTILISATEUR = {
  id: "u-1",
  name: "Rakotoson Jean",
  email: "jean@example.local",
  role: "demandeur" as const,
  department: "DRH - Service du Personnel",
  permissions: [],
};

function ouvrirFormulaire() {
  const boutons = screen.getAllByRole("button", { name: /Nouvelle demande/ });
  fireEvent.click(boutons[0]);
}

function saisirLigne(
  index: number,
  valeurs: { materiel?: string; quantite?: string; motif?: string } = {}
) {
  if (valeurs.materiel !== undefined) {
    fireEvent.change(screen.getByLabelText(`Matériel de la ligne ${index}`), {
      target: { value: valeurs.materiel },
    });
  }
  if (valeurs.quantite !== undefined) {
    fireEvent.change(screen.getByLabelText(`Quantité de la ligne ${index}`), {
      target: { value: valeurs.quantite },
    });
  }
  if (valeurs.motif !== undefined) {
    fireEvent.change(screen.getByLabelText(`Motif de la ligne ${index}`), {
      target: { value: valeurs.motif },
    });
  }
}

async function envoyer() {
  fireEvent.click(screen.getByRole("button", { name: /Voir le résumé/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Envoyer la demande/ }));
}

beforeEach(() => {
  postMock.mockReset();
  postMock.mockResolvedValue({ data: { data: { documentId: "dem-1" } } });
  etatStock.materials = [
    {
      documentId: "mat-1",
      designation: "Clavier compact",
      categorie: "Informatique",
      quantiteStock: 5,
      statut: "en_stock",
    },
    {
      documentId: "mat-2",
      designation: "Webcam HD",
      categorie: "Informatique",
      quantiteStock: 2,
      statut: "en_stock",
    },
  ];
  etatStock.isLoading = false;
  etatStock.isInitialError = false;
  etatStock.isRefreshing = false;
  etatStock.messageErreur = null;
});

afterEach(() => {
  cleanup();
});

describe("MyRequests — écriture d'une demande conforme à l'étape 1", () => {
  it("propose le STOCK RÉEL et non la liste de démonstration", async () => {
    render(<MyRequests user={UTILISATEUR} />);
    ouvrirFormulaire();

    const select = (await screen.findByLabelText(
      "Matériel de la ligne 1"
    )) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.textContent);

    expect(options.join(" | ")).toContain("Clavier compact");
    expect(options.join(" | ")).toContain("Webcam HD");
    expect(options.join(" | ")).not.toContain("Clavier mécanique Logitech");
  });

  it("envoie TOUTES les lignes dans UNE seule requête, sans direction ni service", async () => {
    render(<MyRequests user={UTILISATEUR} />);
    ouvrirFormulaire();

    saisirLigne(1, { materiel: "mat-1", quantite: "2", motif: "Poste de travail" });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un matériel/ }));
    saisirLigne(2, { materiel: "mat-2", quantite: "1", motif: "Salle de réunion" });

    await envoyer();

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    const url = postMock.mock.calls[0][0];
    const corps = postMock.mock.calls[0][1];
    expect(url).toBe("/api/demandes");
    expect(corps.data.lignes).toEqual([
      { materiel: "mat-1", quantite: 2, motif: "Poste de travail" },
      { materiel: "mat-2", quantite: 1, motif: "Salle de réunion" },
    ]);
    expect(corps.data.direction).toBeUndefined();
    expect(corps.data.service).toBeUndefined();
    expect(corps.data.reference).toBeUndefined();
    expect(corps.data.groupe).toBeUndefined();
  });

  it("distingue un stock ILLISIBLE d'un stock vide", async () => {
    // Échec du PREMIER chargement : le hook signale `isInitialError` et
    // laisse `messageErreur` à null. Le stock n'a pas été lu — l'écran ne
    // doit PAS annoncer « aucun matériel disponible ».
    etatStock.materials = [];
    etatStock.isInitialError = true;

    render(<MyRequests user={UTILISATEUR} />);
    ouvrirFormulaire();

    await waitFor(() =>
      expect(screen.getByText(/Stock illisible/i)).toBeTruthy()
    );
    expect(screen.queryByText(/Aucun matériel disponible/i)).toBeNull();
  });

  it("affiche l'erreur du serveur et ne claim pas la réussite", async () => {
    postMock.mockRejectedValue({
      response: {
        data: {
          error: {
            message:
              "Stock insuffisant pour « Webcam HD » : quantité demandée 9, quantité disponible 2.",
          },
        },
      },
    });

    render(<MyRequests user={UTILISATEUR} />);
    ouvrirFormulaire();
    saisirLigne(1, { materiel: "mat-2", quantite: "9", motif: "Test" });

    await envoyer();

    await waitFor(() =>
      expect(screen.getByText(/Stock insuffisant pour/)).toBeTruthy()
    );
    expect(screen.queryByText(/envoyée/)).toBeNull();
    expect(screen.queryByText(/créée avec succès/i)).toBeNull();
  });
});
