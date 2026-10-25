import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  creerReceptionPhysique,
  listerReceptionsPhysiques,
  type ReceptionPhysiqueCreatePayload,
} from "./api";

afterEach(() => vi.restoreAllMocks());

describe("api — réceptions physiques (/api/receptions-physiques)", () => {
  it("creerReceptionPhysique POST avec le payload attendu (sortieId, quantités, utilisateur)", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { data: { id: 1, documentId: "doc-1" } } } as never);

    const payload: ReceptionPhysiqueCreatePayload = {
      sortieId: "sortie-123",
      date_reception: "2026-10-25T10:00:00.000Z",
      statut: "conforme",
      quantite_prevue: 10,
      quantite_recue: 5,
      utilisateur: "jdoe",
    };

    const resultat = await creerReceptionPhysique(payload);

    expect(postSpy).toHaveBeenCalledWith("/api/receptions-physiques", {
      data: {
        sortieId: "sortie-123",
        date_reception: "2026-10-25T10:00:00.000Z",
        statut: "conforme",
        quantite_prevue: 10,
        quantite_recue: 5,
        utilisateur: "jdoe",
      },
    });
    expect(resultat).toEqual({ id: 1, documentId: "doc-1" });
  });

  it("creerReceptionPhysique envoie type_anomalie et description_anomalie quand déclarés", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { data: { id: 2 } } } as never);

    await creerReceptionPhysique({
      sortieId: "sortie-456",
      statut: "anomalie",
      quantite_prevue: 10,
      quantite_recue: 3,
      utilisateur: "jdoe",
      type_anomalie: "endommage",
      description_anomalie: "Matériel rayé",
    });

    expect(postSpy).toHaveBeenCalledWith("/api/receptions-physiques", {
      data: {
        sortieId: "sortie-456",
        statut: "anomalie",
        quantite_prevue: 10,
        quantite_recue: 3,
        utilisateur: "jdoe",
        type_anomalie: "endommage",
        description_anomalie: "Matériel rayé",
      },
    });
  });

  it("creerReceptionPhysique omet type_anomalie quand il est undefined", async () => {
    const postSpy = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { data: { id: 3 } } } as never);

    await creerReceptionPhysique({
      sortieId: "sortie-789",
      quantite_prevue: 7,
      quantite_recue: 7,
      utilisateur: "jdoe",
      type_anomalie: undefined,
    });

    const appel = postSpy.mock.calls[0][1] as { data: Record<string, unknown> };
    expect(appel.data.type_anomalie).toBeUndefined();
  });

  it("listerReceptionsPhysiques GET avec populate sortie.direction", async () => {
    const getSpy = vi
      .spyOn(api, "get")
      .mockResolvedValue({
        data: {
          data: [{ id: 1, documentId: "doc-1" }],
          meta: { pagination: { total: 1 } },
        },
      } as never);

    const resultat = await listerReceptionsPhysiques();

    expect(getSpy).toHaveBeenCalledWith("/api/receptions-physiques", {
      timeout: 5000,
      params: {
        populate: {
          sortie: {
            populate: { direction: true },
          },
        },
      },
    });
    expect(resultat).toEqual([{ id: 1, documentId: "doc-1" }]);
  });

  it("listerReceptionsPhysiques retourne null en cas d'échec réseau", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("Network error"));

    const resultat = await listerReceptionsPhysiques();
    expect(resultat).toBeNull();
  });
});
