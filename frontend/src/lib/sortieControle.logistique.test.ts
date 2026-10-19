// Phase 1 — fonctions pures du contrôle logistique + corps de la signature 3.
//   P1 stockApres / lignesInsuffisantes : calcul exact, jamais négatif.
//   P2 nettoyage des N° logistiques : espaces retirés, vides ignorés, 100 car.
//   P3 payload signature 3 : rôle + N° logistiques SEULEMENT (jamais de
//      statut, date, signataire ni stock), délai >= 20 s.
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  stockApres,
  lignesInsuffisantes,
  construirePayloadSignatureLogistique,
} from "./sortieControle";
import { api, signerSortie } from "./api";
import type { SortieRecord } from "./movements";

function ordre(lignes: SortieRecord["lignes"]): SortieRecord {
  return {
    id: "sor-1",
    reference: "SOR-2026-001",
    dateSortie: "2026-10-18",
    materiel: "—",
    categorie: "—",
    quantite: 0,
    serviceDemandeur: "—",
    direction: "—",
    beneficiaire: "—",
    responsable: "—",
    statut: "En préparation",
    justificatif: "PV.pdf",
    documents: [],
    ...(lignes ? { lignes } : {}),
  };
}

function ligne(id: string, quantite: number, stock: number, designation = id) {
  return {
    documentId: id,
    designation,
    quantite,
    materiel: { documentId: `mat-${id}`, designation, quantiteStock: stock },
  };
}

describe("stockApres", () => {
  it("retranche la quantité demandée", () => {
    expect(stockApres({ quantite: 3 }, 10)).toBe(7);
  });
  it("ne devient jamais négatif", () => {
    expect(stockApres({ quantite: 12 }, 10)).toBe(0);
  });
});

describe("lignesInsuffisantes", () => {
  it("liste uniquement les lignes non couvertes, avec matériel/demandé/disponible", () => {
    const ordreTest = ordre([
      ligne("l1", 5, 10, "Chaises"),
      ligne("l2", 8, 3, "Tables"),
    ] as SortieRecord["lignes"]);
    const stocks: Record<string, number> = { "mat-l1": 10, "mat-l2": 3 };
    expect(lignesInsuffisantes(ordreTest, stocks)).toEqual([
      { materiel: "Tables", demande: 8, disponible: 3 },
    ]);
  });
  it("retourne une liste vide quand tout est couvert", () => {
    const ordreTest = ordre([ligne("l1", 5, 5)] as SortieRecord["lignes"]);
    expect(lignesInsuffisantes(ordreTest, { "mat-l1": 5 })).toEqual([]);
  });
});

describe("construirePayloadSignatureLogistique — nettoyage", () => {
  const sortie = ordre([
    ligne("l1", 2, 10),
    ligne("l2", 4, 10),
  ] as SortieRecord["lignes"]);

  it("retire les espaces, ignore les vides et borne à 100 caractères", () => {
    const payload = construirePayloadSignatureLogistique(sortie, {
      l1: "   01/Log/108/DRHE/13   ",
      l2: "    ",
    });
    expect(payload).toEqual({
      role: "logistique",
      numeros_logistiques: [
        { ligne: "l1", numero_logistique: "01/Log/108/DRHE/13" },
      ],
    });

    const tropLong = construirePayloadSignatureLogistique(sortie, {
      l1: "x".repeat(150),
    });
    expect(tropLong.numeros_logistiques[0].numero_logistique).toHaveLength(100);
  });

  it("ignore une ligne qui n'appartient pas à l'ordre", () => {
    const payload = construirePayloadSignatureLogistique(sortie, {
      l99: "01/Log/108",
    });
    expect(payload.numeros_logistiques).toEqual([]);
  });

  it("n'expose jamais statut, date, signataire ni stock", () => {
    const payload = construirePayloadSignatureLogistique(sortie, {
      l1: "01/Log/108",
    });
    expect(Object.keys(payload).sort()).toEqual([
      "numeros_logistiques",
      "role",
    ]);
    expect(JSON.stringify(payload)).not.toMatch(
      /statut|date|signataire|stock/i
    );
  });
});

describe("signerSortie('logistique') — corps exact", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(api, "post").mockResolvedValue({
      data: { data: { documentId: "sor-1", reference: "SOR-2026-001", statut: "validee" } },
    } as never);
  });

  it("envoie rôle + N° logistiques non vides, avec un délai >= 20 s", async () => {
    await signerSortie("sor-1", "logistique", undefined, [
      { ligne: "l1", numero_logistique: "01/Log/108" },
    ]);

    const [url, corps, options] = spy.mock.calls[0] as [string, any, any];
    expect(url).toBe("/api/sorties/sor-1/sign");
    expect(Object.keys(corps.data).sort()).toEqual([
      "numeros_logistiques",
      "role",
    ]);
    expect(corps.data.role).toBe("logistique");
    expect(corps.data.numeros_logistiques).toEqual([
      { ligne: "l1", numero_logistique: "01/Log/108" },
    ]);
    expect(options.timeout).toBeGreaterThanOrEqual(20000);
  });

  it("n'ajoute pas la clé numeros_logistiques quand tout est vide", async () => {
    await signerSortie("sor-1", "logistique", undefined, []);
    const [, corps] = spy.mock.calls[0] as [string, any];
    expect(Object.keys(corps.data)).toEqual(["role"]);
  });
});
