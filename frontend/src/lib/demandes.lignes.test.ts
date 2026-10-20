// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDemandes } from "./demandes";

/**
 * ÉTAPE 1 « Demande » — LECTURE.
 *
 * Une demande peut porter PLUSIEURS lignes : la réponse du serveur contient un
 * tableau `lignes`, et l'écran doit reconstituer une ligne par élément (matériel
 * du stock réel, quantité, motif). Le repli sur les champs plats reste accepté
 * pour les demandes antérieures à l'étape 1 (une seule ligne dénormalisée).
 */

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock("./api", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
  },
  getStrapiJwt: () => "jeton-test",
  // Le classifieur d'échec de `api.ts` : l'écran l'utilise pour distinguer
  // « session expirée » / « droits insuffisants » / « backend injoignable ».
  classerEchecApi: () => "reseau",
}));

function reponseApi(rows: unknown[]) {
  return { data: { data: rows } };
}

describe("fetchDemandes — lignes de la demande", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("reconstruit UNE ligne par ligne renvoyée par le serveur", async () => {
    getMock.mockResolvedValue(
      reponseApi([
        {
          id: 7,
          documentId: "dem-1",
          reference: "DEM-2026-001",
          statut: "en_attente",
          date_demande: "2026-10-20",
          lignes: [
            {
              designation: "Clavier compact",
              quantite: 2,
              motif: "Nouveau poste de travail",
              materiel: { documentId: "mat-1", designation: "Clavier compact" },
            },
            {
              // Ligne dont la désignation n'est portée que par la relation
              // populationnée vers la fiche de stock.
              quantite: 1,
              motif: "Salle de réunion",
              materiel: { documentId: "mat-2", designation: "Webcam HD" },
            },
          ],
        },
      ])
    );

    const rows = await fetchDemandes();

    expect(rows).not.toBeNull();
    expect(rows).toHaveLength(1);
    const demande = rows![0];
    expect(demande.lignes).toHaveLength(2);
    expect(demande.lignes[0].materiel).toBe("Clavier compact");
    expect(demande.lignes[0].quantite).toBe(2);
    expect(demande.lignes[0].motif).toBe("Nouveau poste de travail");
    expect(demande.lignes[1].materiel).toBe("Webcam HD");
    expect(demande.lignes[1].quantite).toBe(1);
    expect(demande.lignes[1].motif).toBe("Salle de réunion");
  });

  it("replie sur les champs plats pour une demande sans lignes", async () => {
    getMock.mockResolvedValue(
      reponseApi([
        {
          id: 8,
          documentId: "dem-2",
          reference: "DEM-2026-002",
          statut: "en_attente",
          date_demande: "2026-10-19",
          designation_materiel: "Casque audio",
          quantite: 3,
          motif: "Télétravail",
        },
      ])
    );

    const rows = await fetchDemandes();

    expect(rows).toHaveLength(1);
    expect(rows![0].lignes).toHaveLength(1);
    expect(rows![0].lignes[0].materiel).toBe("Casque audio");
    expect(rows![0].lignes[0].quantite).toBe(3);
  });

  it("demande au serveur de peupler les lignes de la demande", async () => {
    getMock.mockResolvedValue(reponseApi([]));

    await fetchDemandes();

    expect(getMock).toHaveBeenCalledTimes(1);
    const params = getMock.mock.calls[0][1].params;
    expect(JSON.stringify(params)).toContain("lignes");
  });
});
