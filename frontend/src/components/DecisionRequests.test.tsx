// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { DecisionRequests } from "./DecisionRequests";
import type { DemandeRecord } from "@/lib/demandes";

/**
 * ÉTAPE 2 « Décision » — écran du DÉPOSITAIRE (base de données).
 *
 *  1. l'écran montre les demandes EN ATTENTE lues sur le serveur (et rien
 *     d'autre : une demande déjà tranchée n'est plus à traiter) ;
 *  2. l'approbation envoie les QUANTITÉS AJUSTÉES (le Dépositaire peut
 *     réduire la quantité demandée) ;
 *  3. le rejet exige un MOTIF : sans motif, rien n'est envoyé au serveur ;
 *  4. un refus du serveur (stock insuffisant…) est AFFICHÉ : jamais de
 *     fausse réussite.
 */

const { fetchDemandesDetailMock, approuverMock, rejeterMock } = vi.hoisted(() => ({
  fetchDemandesDetailMock: vi.fn(),
  approuverMock: vi.fn(),
  rejeterMock: vi.fn(),
}));

vi.mock("@/lib/demandes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demandes")>();
  return {
    ...actual,
    fetchDemandesDetail: fetchDemandesDetailMock,
    approuverDemande: approuverMock,
    rejeterDemande: rejeterMock,
  };
});

/** Demande lue sur le serveur, en attente de décision. */
const DEMANDE_EN_ATTENTE: DemandeRecord = {
  id: 12,
  documentId: "dem-2026-012",
  reference: "DEM-2026-012",
  date: "2026-10-18",
  lignes: [
    {
      categorie: "Informatique",
      materiel: "Clavier compact",
      quantite: 3,
      quantiteDemandee: 3,
      motif: "Poste de travail",
      materielDocumentId: "mat-1",
    },
  ],
  priorite: "Normal",
  statut: "En attente",
  direction: "Direction des Ressources Humaines",
  service: "Service Gestion Personnel",
  demandeur: "—",
};

/** Demande déjà tranchée : elle ne doit PAS être proposée à la décision. */
const DEMANDE_VALIDEE: DemandeRecord = {
  ...DEMANDE_EN_ATTENTE,
  id: 13,
  documentId: "dem-2026-013",
  reference: "DEM-2026-013",
  statut: "Validée",
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
    demandes: [DEMANDE_EN_ATTENTE, DEMANDE_VALIDEE],
  });
  approuverMock.mockReset();
  approuverMock.mockResolvedValue({ ok: true });
  rejeterMock.mockReset();
  rejeterMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
});

describe("DecisionRequests — décision du Dépositaire sur les demandes en base", () => {
  it("liste les demandes EN ATTENTE lues sur le serveur", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);

    await waitFor(() => expect(screen.getByText("DEM-2026-012")).toBeTruthy());
    // La section « à traiter » ne contient QUE les demandes en attente : une
    // demande déjà validée n'y est plus (elle figure dans la section
    // « Demandes approuvées », qui porte l'étape 3).
    const aTraiter = within(screen.getByLabelText("Demandes à traiter"));
    expect(aTraiter.getByText("Clavier compact")).toBeTruthy();
    expect(aTraiter.queryByText("DEM-2026-013")).toBeNull();
  });

  it("approuve en envoyant les quantités AJUSTÉES", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() => expect(screen.getByText("DEM-2026-012")).toBeTruthy());

    const champ = screen.getByLabelText(/Quantité/i) as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Approuver/i }));

    await waitFor(() =>
      expect(approuverMock).toHaveBeenCalledTimes(1)
    );
    expect(approuverMock.mock.calls[0][0]).toBe("dem-2026-012");
    expect(approuverMock.mock.calls[0][1]).toEqual([
      { materiel: "mat-1", quantite: 2 },
    ]);
  });

  it("refuse d'envoyer un rejet SANS motif", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() => expect(screen.getByText("DEM-2026-012")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^Rejeter$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmer le rejet/i }));

    await waitFor(() =>
      expect(screen.getByText(/motif du rejet est obligatoire/i)).toBeTruthy()
    );
    expect(rejeterMock).not.toHaveBeenCalled();
  });

  it("rejette avec le motif saisi", async () => {
    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() => expect(screen.getByText("DEM-2026-012")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^Rejeter$/i }));
    fireEvent.change(screen.getByLabelText(/motif/i), {
      target: { value: "Non disponible en stock" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmer le rejet/i }));

    await waitFor(() => expect(rejeterMock).toHaveBeenCalledTimes(1));
    expect(rejeterMock.mock.calls[0][0]).toBe("dem-2026-012");
    expect(rejeterMock.mock.calls[0][1]).toBe("Non disponible en stock");
  });

  it("affiche le REFUS du serveur (jamais une fausse réussite)", async () => {
    approuverMock.mockResolvedValue({
      ok: false,
      message: "Stock insuffisant pour « Clavier compact » : quantité demandée 3, quantité disponible 1.",
    });

    render(<DecisionRequests user={UTILISATEUR} />);
    await waitFor(() => expect(screen.getByText("DEM-2026-012")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Approuver/i }));

    await waitFor(() =>
      expect(screen.getByText(/Stock insuffisant pour/)).toBeTruthy()
    );
  });
});
