// Pagination des ordres de sortie — preuve côté client du plafond Strapi.
//
// backend/config/api.js : defaultLimit 25, maxLimit 100. Le serveur CLAMPE
// donc toute demande de page (un `pagination[pageSize]=1000` ne rapporte
// jamais plus de 100 lignes). Ce harnais rejoue exactement cette sémantique
// (clamp + meta.pagination.pageCount) pour verrouiller le comportement du
// client :
//   P1  une requête unique est bien plafonnée (Strapi plafonne : OUI) ;
//   P2  fetchAllSortiesOrThrow parcourt meta.pagination.pageCount : 120/120 ;
//   P3  au-delà de 25 lignes (defaultLimit) la boucle reste complète ;
//   P4  le compteur du badge n'émet QUE le filtre serveur + pageSize=1 ;
//   P5  la liste légère de la cloche filtre côté serveur, sans populate ;
//   P6  un filtre sur le libellé affiché (« En préparation ») ne matche rien.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, countSortiesPourPreparation, fetchAllSortiesOrThrow, fetchOrdresPourAlertes } from "./api";

const DEFAULT_LIMIT = 25; // backend/config/api.js → rest.defaultLimit
const MAX_LIMIT = 100; // backend/config/api.js → rest.maxLimit

interface Ligne {
  id: number;
  documentId: string;
  reference: string;
  date_sortie: string;
  statut: string;
  magasinier_signed: boolean;
}

function ordres(n: number, debut = 0): Ligne[] {
  return Array.from({ length: n }, (_, i) => ({
    id: debut + i + 1,
    documentId: `doc-${debut + i + 1}`,
    reference: `SOR-2026-${String(debut + i + 1).padStart(3, "0")}`,
    date_sortie: "2026-10-18",
    statut: "en_preparation",
    magasinier_signed: false,
  }));
}

/** Sémantique REST Strapi : clamp de la taille de page + meta.pagination. */
function serveurStrapi(lignes: Ligne[]) {
  return vi.spyOn(api, "get").mockImplementation((async (_url: string, options?: any) => {
    const p = options?.params ?? {};
    let base = lignes;
    if (p["filters[statut][$eq]"] !== undefined) {
      base = base.filter((l) => l.statut === p["filters[statut][$eq]"]);
    }
    if (p["filters[magasinier_signed][$eq]"] !== undefined) {
      base = base.filter(
        (l) => l.magasinier_signed === p["filters[magasinier_signed][$eq]"]
      );
    }
    const demandee = Number(p["pagination[pageSize]"] ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const pageSize = Math.min(demandee, MAX_LIMIT); // le plafond serveur
    const page = Number(p["pagination[page]"] ?? 1);
    const data =
      p["pagination[page]"] === undefined
        ? base.slice(0, pageSize)
        : base.slice((page - 1) * pageSize, page * pageSize);
    return {
      data: {
        data,
        meta: {
          pagination: {
            page,
            pageSize,
            total: base.length,
            pageCount: Math.max(1, Math.ceil(base.length / pageSize)),
          },
        },
      },
    };
  }) as any);
}

describe("Pagination des ordres — le store ne tronque jamais", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("P1 : Strapi plafonne une requête unique à 100 lignes (120 créées)", async () => {
    serveurStrapi(ordres(120));
    const { data } = await api.get("/api/sorties", {
      params: { "pagination[pageSize]": 1000 },
    });
    expect(data.data).toHaveLength(100);
    expect(data.meta.pagination.total).toBe(120);
    expect(data.meta.pagination.pageCount).toBe(2);
  });

  it("P2 : fetchAllSortiesOrThrow reçoit bien les 120 ordres (boucle pageCount)", async () => {
    const spy = serveurStrapi(ordres(120));
    const lignes = await fetchAllSortiesOrThrow();

    expect(lignes).toHaveLength(120);
    expect(spy).toHaveBeenCalledTimes(2); // page 1 + page 2
    expect(new Set(lignes.map((l) => l.id)).size).toBe(120);
  });

  it("P3 : au-delà de 25 ordres (defaultLimit) la liste reste complète", async () => {
    const sansPageSize = serveurStrapi(ordres(30));
    const page1 = await api.get("/api/sorties", { params: {} });
    expect(page1.data.data).toHaveLength(25);
    sansPageSize.mockRestore();

    serveurStrapi(ordres(30));
    expect(await fetchAllSortiesOrThrow()).toHaveLength(30);
  });

  it("P4 : le compteur du badge n'envoie que le filtre serveur + pageSize=1", async () => {
    const spy = serveurStrapi(ordres(120));
    const total = await countSortiesPourPreparation();

    expect(total).toBe(120);
    expect(spy).toHaveBeenCalledTimes(1);
    const params = spy.mock.calls[0][1]?.params;
    expect(params["filters[statut][$eq]"]).toBe("en_preparation");
    expect(params["filters[magasinier_signed][$eq]"]).toBe(false);
    expect(params["pagination[pageSize]"]).toBe(1);
    expect(String(params["pagination[withCount]"])).toBe("true");
    expect(params.populate, "le badge ne charge jamais le détail").toBeUndefined();
  });

  it("P5 : la liste légère de la cloche filtre côté serveur, sans populate", async () => {
    const spy = serveurStrapi([...ordres(120), {
      id: 999, documentId: "doc-999", reference: "SOR-AUTRE",
      date_sortie: "2026-10-18", statut: "validee", magasinier_signed: true,
    }]);

    const ordresAlerte = await fetchOrdresPourAlertes();
    expect(ordresAlerte).toHaveLength(120);
    expect(ordresAlerte?.some((o) => o.reference === "SOR-AUTRE")).toBe(false);
    expect(spy.mock.calls[0][1]?.params.populate, "jamais de détail").toBeUndefined();
  });

  it("P6 : un filtre sur le libellé affiché (« En préparation ») ne matche rien", async () => {
    serveurStrapi(ordres(120));
    const { data } = await api.get("/api/sorties", {
      params: { "filters[statut][$eq]": "En préparation" },
    });
    // C'était le bug du badge : l'énum serveur vaut `en_preparation`, le
    // libellé affiché ne correspond à AUCUNE ligne (badge toujours à 0).
    expect(data.data).toHaveLength(0);
    expect(data.meta.pagination.total).toBe(0);
  });
});
