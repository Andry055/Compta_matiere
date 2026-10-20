// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { DecisionRequests } from "./DecisionRequests";
import type { DemandeRecord } from "@/lib/demandes";

/**
 * ÉTAPE 3 « Ordre de sortie » — le bouton du DÉPOSITAIRE.
 *
 *  1. une demande APPROUVÉE est proposée à la transformation en ordre ;
 *  2. le bouton appelle le serveur (le serveur préremplit TOUT : l'écran
 *     n'envoie que l'identifiant de la demande) ;
 *  3. une demande qui a DÉJÀ un ordre n'est plus transformable (une
 *     demande, un ordre) ;
 *  4. un refus du serveur est AFFICHÉ : jamais de fausse réussite.
 */

const { fetchDemandesDetailMock, creerOrdreSortieMock } = vi.hoisted(() => ({
  fetchDemandesDetailMock: vi.fn(),
  creerOrdreSortieMock: vi.fn(),
}));

vi.mock("@/lib/demandes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demandes")>();
  return {
    ...actual,
    fetchDemandesDetail: fetchDemandesDetailMock,
    creerOrdreSortie: creerOrdreSortieMock,
  };
});

/** Demande APPROUVÉE : elle peut devenir un ordre de sortie. */
const DEMANDE_APPROUVEE: DemandeRecord = {
  id: 20,
  documentId: "dem-2026-020",
  reference: "DEM-2026-020",
  date: "2026-10-19",
  lignes: [
    {
      categorie: "Informatique",
      materiel: "Clavier compact",
      quantite: 2,
      quantiteDemandee: 3,
      motif: "Poste de travail",
      materielDocumentId: "mat-1",
    },
  ],
  priorite: "Normal",
  statut: "Validée",
  direction: "Direction des Ressources Humaines",
  service: "Service Gestion Personnel",
  demandeur: "—",
};

/** Même demande, mais son ordre de sortie existe DÉJÀ. */
const DEMANDE_DEJA_ORDONNEE: DemandeRecord = {
  ...DEMANDE_APPROUVEE,
  id: 21,
  documentId: "dem-2026-021",
  reference: "DEM-2026-021",
  sortieReference: "SOR-2026-007",
  sortieDocumentId: "sor-2026-007",
};

const UTILISATEUR = {
  id: "u-dep",
  name: "Rakotomalala Hery",
  email: "hery@example.local",
  role: "depositaire" as const,
  department: "DAF - Service Comptabilité Matière",
  permissions: [],
};

beforeEach(() => {
  fetchDemandesDetailMock.mockReset();
  fetchDemandesDetailMock.mockResolvedValue({
    ok: true,
    demandes: [DEMANDE_APPROUVEE, DEMANDE_DEJA_ORDONNEE],
  });
  creerOrdreSortieMock.mockReset();
  creerOrdreSortieMock.mockResolvedValue({ ok: true, reference: "SOR-2026-008" });
});

afterEach(() => {
  cleanup();
});

describe("DecisionRequests — étape 3 : l'ordre de sortie", () => {
  it("propose la demande approuvée à la transformation en ordre", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);

    await waitFor(() =>
      expect(screen.getByText("Demandes approuvées")).toBeTruthy()
    );
    expect(screen.getByText("DEM-2026-020")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Créer l'ordre de sortie/i })).toBeTruthy();
  });

  it("le bouton demande au serveur la création de l'ordre", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Créer l'ordre de sortie/i })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole("button", { name: /Créer l'ordre de sortie/i }));

    await waitFor(() => expect(creerOrdreSortieMock).toHaveBeenCalledTimes(1));
    // L'écran n'envoie QUE l'identifiant : le préremplissage est côté serveur.
    expect(creerOrdreSortieMock.mock.calls[0][0]).toBe("dem-2026-020");
    expect(creerOrdreSortieMock.mock.calls[0]).toHaveLength(1);
  });

  it("affiche la référence de l'ordre créé", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Créer l'ordre de sortie/i })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole("button", { name: /Créer l'ordre de sortie/i }));

    await waitFor(() =>
      expect(screen.getByText(/SOR-2026-008/)).toBeTruthy()
    );
  });

  it("une demande qui a DÉJÀ un ordre n'est plus transformable", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() =>
      expect(screen.getByText("DEM-2026-021")).toBeTruthy()
    );

    // Un seul bouton : celui de la demande SANS ordre.
    const boutons = screen.getAllByRole("button", {
      name: /Créer l'ordre de sortie/i,
    });
    expect(boutons.length).toBe(1);
    expect(screen.getByText(/SOR-2026-007/)).toBeTruthy();
  });

  it("affiche le REFUS du serveur (jamais une fausse réussite)", async () => {
    creerOrdreSortieMock.mockResolvedValue({
      ok: false,
      message:
        "Un ordre de sortie existe déjà pour cette demande (SOR-2026-007) : une demande ne porte qu'un seul ordre.",
    });

    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Créer l'ordre de sortie/i })).toBeTruthy()
    );

    fireEvent.click(screen.getByRole("button", { name: /Créer l'ordre de sortie/i }));

    await waitFor(() =>
      expect(screen.getByText(/une demande ne porte qu'un seul ordre/i)).toBeTruthy()
    );
  });
});
