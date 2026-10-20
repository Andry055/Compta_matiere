import { afterEach, describe, expect, it, vi } from "vitest";
import { api, fetchOrdresValidesPourDepositaire, fetchSorties } from "./api";

afterEach(() => vi.restoreAllMocks());

// Charge utile REPRODUITE à l'identique de la sonde live GET /api/sorties
// (populate identique à fetchSorties) : c'est cette charge qui révélait les
// champs non mappés.
const CHARGE_STRAPI = {
  data: {
    data: [
      {
        id: 1,
        documentId: "sortie-doc-1",
        reference: "SOR-2026-001",
        date_sortie: "2026-10-16",
        statut: "en_preparation",
        beneficiaire: "Ex",
        justificatif: "azerty",
        observations: null,
        direction: { nom_direction: "Direction Informatique" },
        service: { nom_service: "Service Informatique" },
        magasinier_signed: true,
        depositaire_signed: false,
        logistique_signed: false,
        lignes: [
          {
            id: 10,
            quantite: 1,
            materiel: {
              designation: "Borne WiFi Ubiquiti UniFi",
              categorie: null,
            },
          },
        ],
      },
    ],
  },
};

describe("fetchSorties — mapSortie (données réelles Strapi → SortieRecord)", () => {
  it("expose la désignation du matériel, le service de destination et les 3 signatures", async () => {
    vi.spyOn(api, "get").mockResolvedValue(CHARGE_STRAPI as never);

    const rows = await fetchSorties();
    expect(rows, "fetchSorties ne doit pas renvoyer null ici").not.toBeNull();

    const sortie = rows![0];

    // RÉGRESSION : la carte lisait `matiere` (inexistant) → champ vide alors
    // que le serveur renvoie bien la désignation de la fiche.
    expect(sortie.materiel).toBe("Borne WiFi Ubiquiti UniFi");
    expect(sortie.quantite).toBe(1);

    // Destination : direction + service + bénéficiaire doivent TOUS être
    // disponibles (la carte lisait `service`, champ qui n'existe pas).
    expect(sortie.direction).toBe("Direction Informatique");
    expect(sortie.serviceDemandeur).toBe("Service Informatique");
    expect(sortie.beneficiaire).toBe("Ex");

    // Circuit à 3 signatures : jamais mappés auparavant → la progression
    // restait toujours « ○ Magasinier ○ Dépositaire ○ Logistique ».
    expect(sortie.magasinier_signed).toBe(true);
    expect(sortie.depositaire_signed).toBe(false);
    expect(sortie.logistique_signed).toBe(false);

    expect(sortie.statut).toBe("En préparation");
    expect(sortie.justificatif).toBe("azerty");
  });

  it("passe à false les signatures que Strapi renvoie null (lignes héritées)", async () => {
    // Les sorties SORT-20xx de la base de démo ont magasinier_signed = null :
    // `null` ne doit jamais être affiché comme « signé ».
    const heritee = JSON.parse(JSON.stringify(CHARGE_STRAPI));
    heritee.data.data[0].magasinier_signed = null;
    heritee.data.data[0].depositaire_signed = null;
    heritee.data.data[0].logistique_signed = null;
    vi.spyOn(api, "get").mockResolvedValue(heritee as never);

    const rows = await fetchSorties();
    expect(rows).not.toBeNull();
    expect(rows![0].magasinier_signed).toBe(false);
    expect(rows![0].depositaire_signed).toBe(false);
    expect(rows![0].logistique_signed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Flux DÉPOSITAIRE : la cloche doit savoir reconnaître une sortie acceptée
// par le chef logistique (3ᵉ signature) — c'est cette lecture qui déclenche
// la notification « le chef log a accepté la sortie ».
// ---------------------------------------------------------------------------

describe("fetchOrdresValidesPourDepositaire — lecture du déclenchement", () => {
  const CHARGE_VALIDEE = {
    data: {
      data: [
        {
          id: 7,
          documentId: "sortie-doc-7",
          reference: "SOR-2026-007",
          date_sortie: "2026-10-14",
          statut: "validee",
          magasinier_signed: true,
          depositaire_signed: true,
          logistique_signed: true,
          date_signature_logistique: "2026-10-15T09:30:00.000Z",
        },
      ],
      meta: { pagination: { page: 1, pageCount: 1 } },
    },
  };

  it("filtre côté SERVEUR sur la validation (statut + signature 3)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue(CHARGE_VALIDEE as never);

    await fetchOrdresValidesPourDepositaire();

    const params = get.mock.calls[0][1]?.params as Record<string, unknown>;
    // ⚠️ Énum SERVEUR (`validee`), jamais le libellé affiché « Validée ».
    expect(params["filters[statut][$eq]"]).toBe("validee");
    expect(params["filters[logistique_signed][$eq]"]).toBe(true);
  });

  it("mappe l'ordre accepté (statut affiché + horodatage de la 3ᵉ signature)", async () => {
    vi.spyOn(api, "get").mockResolvedValue(CHARGE_VALIDEE as never);

    const rows = await fetchOrdresValidesPourDepositaire();
    expect(rows, "ne doit pas renvoyer null ici").not.toBeNull();

    const ordre = rows![0];
    expect(ordre.reference).toBe("SOR-2026-007");
    // La cloche teste le libellé affiché « Validée » : sans ce mappage,
    // aucune notification ne s'afficherait jamais.
    expect(ordre.statut).toBe("Validée");
    expect(ordre.logistique_signed).toBe(true);
    expect(ordre.dateSignatureLogistique).toBe("2026-10-15T09:30:00.000Z");
  });

  it("retourne null (et jamais un faux succès) si le serveur est injoignable", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("réseau"));

    expect(await fetchOrdresValidesPourDepositaire()).toBeNull();
  });
});
