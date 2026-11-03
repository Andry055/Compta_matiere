// @vitest-environment jsdom
//
// Notifications « transfert » dans la cloche (Dépositaire 2/3, Chef logistique 3/3) :
//   T1 un clic sur la notification OUVRE la rubrique Transferts ;
//   T2 ce même clic la SUPPRIME de la liste (elle ne reste pas en « lue »).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";
import { pushNotification } from "../lib/notifications";
import type { EntreeRecord } from "../lib/movements";
import type { User } from "../App";

vi.mock("../lib/api", () => ({
  fetchEntrees: vi.fn(async () => [] as EntreeRecord[]),
  countSortiesPourPreparation: vi.fn(async () => 0),
  fetchOrdresPourAlertes: vi.fn(async () => []),
  countSortiesAAutoriser: vi.fn(async () => 0),
  fetchOrdresAAutoriser: vi.fn(async () => []),
  fetchAllSortiesOrThrow: vi.fn(async () => []),
  fetchOrdresValidesPourDepositaire: vi.fn(async () => []),
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const depositaire = {
  id: "u1",
  name: "Rakotomalala Hery",
  email: "hery@example.mg",
  role: "depositaire",
  department: "Direction des Ressources Humaines",
  permissions: [],
} as unknown as User;

function pousserTransfert(reference: string) {
  pushNotification(
    "depositaire",
    "transfert",
    `Nouveau transfert ${reference}`,
    `Ordinateurs portables HP ×1 — DRH → DAF.`
  );
}

describe("Cloche — notification de transfert", () => {
  it("T1 : un clic ouvre la rubrique Transferts", async () => {
    pousserTransfert("TRF-2026-001");
    const ouvrirTransferts = vi.fn();

    render(<NotificationBell user={depositaire} onOpenTransfert={ouvrirTransferts} />);
    fireEvent.click(screen.getByTitle("Mes notifications"));

    const ligne = await screen.findByText(/Nouveau transfert TRF-2026-001/);
    fireEvent.click(ligne);

    expect(ouvrirTransferts).toHaveBeenCalledTimes(1);
  });

  it("T2 : la notification cliquée disparaît de la liste", async () => {
    pousserTransfert("TRF-2026-002");
    const ouvrirTransferts = vi.fn();

    render(<NotificationBell user={depositaire} onOpenTransfert={ouvrirTransferts} />);
    fireEvent.click(screen.getByTitle("Mes notifications"));

    const ligne = await screen.findByText(/Nouveau transfert TRF-2026-002/);
    fireEvent.click(ligne);

    await waitFor(() =>
      expect(screen.queryByText(/Nouveau transfert TRF-2026-002/)).toBeNull()
    );
  });
});
