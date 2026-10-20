// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { MyRequests } from "./MyRequests";
import type { DemandeRecord } from "@/lib/demandes";

/**
 * ÉTAPE 2 « Décision » — REPLI (côté demandeur).
 *
 * La décision du Dépositaire doit être VISIBLE par le demandeur :
 *  - un rejet affiche son MOTIF (sinon le refus est opaque) ;
 *  - une approbation affichant une quantité AJUSTÉE conserve la trace de la
 *    quantité initialement demandée.
 */

const { fetchDemandesDetailMock } = vi.hoisted(() => ({
  fetchDemandesDetailMock: vi.fn(),
}));

vi.mock("@/lib/demandes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demandes")>();
  return { ...actual, fetchDemandesDetail: fetchDemandesDetailMock };
});

vi.mock("@/lib/useMaterialsLive", () => ({
  useMaterialsLive: () => ({
    materials: [],
    isLoading: false,
    isInitialError: false,
    isRefreshing: false,
    messageErreur: null,
    derniereSync: null,
    changementsQuantite: [],
    refresh: vi.fn(),
  }),
}));

const DEMANDE_REJETEE: DemandeRecord = {
  id: 21,
  documentId: "dem-2026-021",
  reference: "DEM-2026-021",
  date: "2026-10-19",
  lignes: [
    {
      categorie: "Informatique",
      materiel: "Ecran 24 pouces",
      quantite: 2,
      quantiteDemandee: 2,
      motif: "Poste de travail",
      materielDocumentId: "mat-9",
    },
  ],
  priorite: "Normal",
  statut: "Refusée",
  motifRejet: "Non disponible en stock",
  direction: "Direction des Ressources Humaines",
  service: "Service Gestion Personnel",
  demandeur: "Rakotoson Jean",
};

const DEMANDE_APPROUVEE: DemandeRecord = {
  ...DEMANDE_REJETEE,
  id: 22,
  documentId: "dem-2026-022",
  reference: "DEM-2026-022",
  statut: "Validée",
  motifRejet: undefined,
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
};

const UTILISATEUR = {
  id: "u-1",
  name: "Rakotoson Jean",
  email: "jean@example.local",
  role: "demandeur" as const,
  department: "DRH - Service du Personnel",
  permissions: [],
};

async function ouvrirDetail(reference: string, index = 0) {
  const boutons = await screen.findAllByTitle("Voir le suivi");
  fireEvent.click(boutons[index]);
  // La modale de suivi est la seule zone qui porte la référence ET le
  // bloc « Suivi de la demande ».
  await waitFor(() =>
    expect(screen.getByText("Suivi de la demande")).toBeTruthy()
  );
  expect(screen.getAllByText(reference).length).toBeGreaterThan(0);
}

beforeEach(() => {
  fetchDemandesDetailMock.mockReset();
  fetchDemandesDetailMock.mockResolvedValue({
    ok: true,
    demandes: [DEMANDE_REJETEE, DEMANDE_APPROUVEE],
  });
});

afterEach(() => {
  cleanup();
});

describe("MyRequests — le demandeur voit la décision du Dépositaire", () => {
  it("affiche le MOTIF de rejet dans le détail de la demande", async () => {
    render(<MyRequests user={UTILISATEUR} />);
    await waitFor(() => expect(screen.getByText("DEM-2026-021")).toBeTruthy());

    await ouvrirDetail("DEM-2026-021");

    expect(screen.getByText(/Motif du rejet/i)).toBeTruthy();
    expect(screen.getByText("Non disponible en stock")).toBeTruthy();
  });

  it("affiche la quantité APPROUVÉE et la quantité DEMANDÉE si elles diffèrent", async () => {
    render(<MyRequests user={UTILISATEUR} />);
    await waitFor(() => expect(screen.getByText("DEM-2026-022")).toBeTruthy());

    await ouvrirDetail("DEM-2026-022", 1);

    expect(screen.getByText("demandée : 3")).toBeTruthy();
  });
});
