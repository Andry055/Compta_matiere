import { afterEach, describe, expect, it, vi } from "vitest";
import { api, fetchSorties } from "./api";

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
