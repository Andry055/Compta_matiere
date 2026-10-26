// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormulaireRéception } from "./FormulaireRéception";
import { receptions } from "@/lib/movements";
import { creerReceptionPhysique, getStrapiAuthUser, type ReceptionPhysiqueRecord } from "@/lib/api";
import type { SortieRecord } from "@/lib/movements";

vi.mock("@/lib/api", () => ({
  creerReceptionPhysique: vi.fn(),
  getStrapiAuthUser: vi.fn(),
}));

const sortie: SortieRecord = {
  id: "SORT-001",
  reference: "SOR-2026-001",
  dateSortie: "2026-01-08",
  materiel: "Ordinateur portable HP",
  categorie: "Informatique",
  quantite: 10,
  serviceDemandeur: "Service du Personnel",
  direction: "DRH",
  beneficiaire: "Alice Dupont",
  responsable: "Bob Responsable",
  statut: "Sortie effectuée",
  magasinier_signed: true,
  depositaire_signed: true,
  logistique_signed: true,
  justificatif: "Demande validée",
  documents: [],
  directionId: "d_drh",
};

function renderFormulaire(overrides: { receptionsServeur?: unknown[] } = {}) {
  const onClose = vi.fn();
  const onReceptionConfirmée = vi.fn();
  render(
    <FormulaireRéception
      sortie={sortie}
      receptionsServeur={overrides.receptionsServeur ?? []}
      onClose={onClose}
      onReceptionConfirmée={onReceptionConfirmée}
    />
  );
  return { onClose, onReceptionConfirmée };
}

describe("FormulaireRéception — actualisation après confirmation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    receptions.length = 0;
    vi.mocked(getStrapiAuthUser).mockReturnValue({ username: "testuser" } as never);
    vi.mocked(creerReceptionPhysique).mockResolvedValue({
      id: "REC-1",
      documentId: "doc-rec-1",
      sortieId: "SORT-001",
      date_reception: "2026-10-25T10:00:00.000Z",
      statut: "conforme",
      quantite_prevue: 10,
      quantite_recue: 5,
      utilisateur: "testuser",
    } as ReceptionPhysiqueRecord);
  });

  afterEach(() => {
    cleanup();
    receptions.length = 0;
  });

  it("appelle onReceptionConfirmée après un enregistrement serveur réussi (liste actualisée)", async () => {
    const { onReceptionConfirmée } = renderFormulaire();

    const input = screen.getByLabelText("Quantité reçue");
    fireEvent.change(input, { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /Confirmer la réception/ }));

    await waitFor(() => {
      expect(creerReceptionPhysique).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onReceptionConfirmée).toHaveBeenCalledTimes(1);
    });
  });

  it("n'appelle pas onReceptionConfirmée si l'enregistrement serveur échoue", async () => {
    vi.mocked(creerReceptionPhysique).mockRejectedValue(new Error("Erreur serveur"));

    const { onReceptionConfirmée } = renderFormulaire();

    const input = screen.getByLabelText("Quantité reçue");
    fireEvent.change(input, { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /Confirmer la réception/ }));

    await waitFor(() => {
      expect(onReceptionConfirmée).not.toHaveBeenCalled();
    });
  });

  it("transmet le bon payload à creerReceptionPhysique", async () => {
    renderFormulaire();

    const input = screen.getByLabelText("Quantité reçue");
    fireEvent.change(input, { target: { value: "5" } });

    fireEvent.click(screen.getByRole("button", { name: /Confirmer la réception/ }));

    await waitFor(() => {
      expect(creerReceptionPhysique).toHaveBeenCalledWith(
        expect.objectContaining({
          sortieId: "SORT-001",
          quantite_prevue: 10,
          quantite_recue: 5,
          utilisateur: "testuser",
          statut: "conforme",
        })
      );
    });
  });
});
