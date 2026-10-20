// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { MyRequests } from "./MyRequests";
import type { DemandeRecord } from "@/lib/demandes";

/**
 * ÉTAPE 1 « Demande » — LECTURE : « Liste de mes demandes » doit refléter la
 * BASE DE DONNÉES.
 *
 *  1. une demande lue sur le serveur s'affiche même quand le libellé de
 *     direction est le NOM COMPLET de l'organigramme (« Direction des
 *     Ressources Humaines ») alors que le compte porte l'abréviation
 *     (« DRH - Service du Personnel ») : le serveur fait déjà le filtrage,
 *     l'écran ne doit pas le refaire (ni par le nom, ni par l'organigramme) ;
 *  2. une base VIDE s'affiche comme telle : le repli sur les données locales
 *     ne doit jamais faire croire qu'il existe des demandes en base.
 */

const { fetchDemandesMock, fetchDemandesDetailMock } = vi.hoisted(() => ({
  fetchDemandesMock: vi.fn(async () => null as DemandeRecord[] | null),
  fetchDemandesDetailMock: vi.fn(
    async () =>
      ({ ok: false, echec: "reseau" }) as
        | { ok: true; demandes: DemandeRecord[] }
        | { ok: false; echec: string }
  ),
}));

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

vi.mock("@/lib/demandes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/demandes")>();
  return {
    ...actual,
    fetchDemandes: fetchDemandesMock,
    fetchDemandesDetail: fetchDemandesDetailMock,
  };
});

/** Demande LUE SUR LE SERVEUR : la direction porte le NOM COMPLET de
 *  l'organigramme et le demandeur n'est pas renseigné (le serveur retire
 *  volontairement la relation `demandeur` des réponses). */
const DEMANDE_API: DemandeRecord = {
  id: 91,
  reference: "DEM-2026-007",
  date: "2026-10-18",
  lignes: [
    {
      categorie: "Informatique",
      materiel: "Clavier compact",
      quantite: 2,
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

/** Demande LOCALE (repli) : ne doit JAMAIS apparaître quand le serveur a
 *  répondu. */
const DEMANDE_LOCALE = {
  id: 7,
  reference: "DEM-2025-001",
  date: "2025-01-05",
  lignes: [
    { categorie: "Informatique", materiel: "Demande locale obsolète", quantite: 1, motif: "Local" },
  ],
  priorite: "Normale",
  statut: "En attente",
  direction: "DRH",
  service: "Service du Personnel",
  demandeur: "Rakotoson Jean",
};

const UTILISATEUR = {
  id: "u-1",
  name: "Rakotoson Jean",
  email: "jean@example.local",
  role: "demandeur" as const,
  department: "DRH - Service du Personnel",
  permissions: [],
};

beforeEach(() => {
  fetchDemandesMock.mockReset();
  fetchDemandesMock.mockResolvedValue(null);
  fetchDemandesDetailMock.mockReset();
  fetchDemandesDetailMock.mockResolvedValue({ ok: false, echec: "reseau" });
  localStorage.setItem("comptamatiere.demandes.v1", JSON.stringify([DEMANDE_LOCALE]));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("MyRequests — lecture de la liste depuis la base", () => {
  it("affiche la demande lue sur le serveur (direction = nom complet)", async () => {
    fetchDemandesDetailMock.mockResolvedValue({ ok: true, demandes: [DEMANDE_API] });

    render(<MyRequests user={UTILISATEUR} />);

    await waitFor(() =>
      expect(screen.getByText(/Liste de mes demandes \(1\)/)).toBeTruthy()
    );
    expect(screen.getByText("DEM-2026-007")).toBeTruthy();
    expect(screen.getByText("Direction des Ressources Humaines")).toBeTruthy();
    // Le repli local ne doit pas se mélanger à la donnée serveur.
    expect(screen.queryByText("DEM-2025-001")).toBeNull();
  });

  it("affiche une base VIDE comme vide (jamais le repli local)", async () => {
    fetchDemandesDetailMock.mockResolvedValue({ ok: true, demandes: [] });

    render(<MyRequests user={UTILISATEUR} />);

    await waitFor(() =>
      expect(screen.getByText(/Liste de mes demandes \(0\)/)).toBeTruthy()
    );
    expect(screen.getByText("Aucune demande pour le moment")).toBeTruthy();
    expect(screen.queryByText("DEM-2025-001")).toBeNull();
  });

  it("annonce la CAUSE du repli local (session expirée)", async () => {
    fetchDemandesDetailMock.mockResolvedValue({
      ok: false,
      echec: "session_expiree",
    });

    render(<MyRequests user={UTILISATEUR} />);

    await waitFor(() =>
      expect(screen.getByText(/Session expirée/i)).toBeTruthy()
    );
  });
});
