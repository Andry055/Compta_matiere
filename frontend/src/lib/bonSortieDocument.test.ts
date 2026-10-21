// @vitest-environment jsdom
//
// (4) BON DE SORTIE / GARDE-RÉCEPTION — modèle du document.
//
// Le modèle est une fonction PURE : il se teste sans rendu, sans PDF.
// Preuves :
//   B1 les lignes du bon (numéro, désignation, nomenclature, quantité,
//      valeur unitaire, montant, état constaté, N° logistique) ;
//   B2 un N° logistique absent ne casse rien (chaîne vide) ;
//   B3 le total (quantités et montant) et le montant en toutes lettres ;
//   B4 les TROIS signataires (magasinier, dépositaire comptable, chef
//      logistique) avec nom et date posés par le serveur ;
//   B5 le bloc détenteur (nom, fonction, mandataire, date) ;
//   B6 la clause de responsabilité, marquée « à valider par le ministère » ;
//   B7 aucune erreur quand les données OPTIONNELLES manquent (ni lignes,
//      ni valorisation, ni signatures, ni détenteur).
import { describe, expect, it } from "vitest";
import { CLAUSE_RESPONSABILITE, modeleBonSortie } from "./bonSortieDocument";
import type { SortieRecord } from "./movements";

function sortie(overrides: Partial<SortieRecord> = {}): SortieRecord {
  return {
    id: "sortie-1",
    reference: "SOR-2026-001",
    dateSortie: "2026-10-18",
    materiel: "Tapis rouge, Chaise",
    categorie: "—",
    quantite: 3,
    serviceDemandeur: "Service Informatique",
    direction: "Direction Informatique",
    beneficiaire: "Ex",
    responsable: "—",
    statut: "Validée",
    magasinier_signed: true,
    depositaire_signed: true,
    logistique_signed: true,
    signataireMagasinier: "RAKOTO Bernard",
    dateSignatureMagasinier: "2026-10-19",
    signataireDepositaire: "RANAIVOSON Jean",
    dateSignatureDepositaire: "2026-10-19",
    signataireLogistique: "ANDRIANARISOA Hanta",
    dateSignatureLogistique: "2026-10-20",
    detenteurNom: "RAKOTOMALALA Hery",
    detenteurFonction: "Dépositaire",
    mandataireNom: "RASOANAIVO Naina",
    dateRemise: "2026-10-20",
    justificatif: "BL-2026-42",
    documents: [],
    lignes: [
      {
        documentId: "l1",
        designation: "Tapis rouge",
        quantite: 2,
        etat: "bon",
        valeurUnitaire: 250000,
        montant: 500000,
        numeroLogistique: "NL-001",
        materiel: {
          documentId: "mat-1",
          designation: "Tapis rouge",
          quantiteStock: 8,
          nomenclature: "NOM-2026-001",
        },
      },
      {
        documentId: "l2",
        designation: "Chaise",
        quantite: 1,
        etat: "neuf",
        valeurUnitaire: 125000,
        montant: 125000,
        numeroLogistique: null,
        materiel: {
          documentId: "mat-2",
          designation: "Chaise",
          quantiteStock: 4,
          nomenclature: null,
        },
      },
    ],
    ...overrides,
  } as unknown as SortieRecord;
}

describe("(4) modèle du bon de sortie", () => {
  it("B1 : les lignes du bon reprennent numéro, désignation, nomenclature, quantité, valorisation, état et N° logistique", () => {
    const bon = modeleBonSortie(sortie());

    expect(bon.lignes).toHaveLength(2);
    expect(bon.lignes[0]).toEqual({
      numero: 1,
      designation: "Tapis rouge",
      nomenclature: "NOM-2026-001",
      quantite: 2,
      valeurUnitaire: 250000,
      montant: 500000,
      etat: "bon",
      numeroLogistique: "NL-001",
    });
    expect(bon.lignes[1].numero).toBe(2);
    expect(bon.lignes[1].etat).toBe("neuf");
  });

  it("B2 : un N° logistique absent devient une chaîne vide (pas de « null », pas d'erreur)", () => {
    const bon = modeleBonSortie(sortie());

    expect(bon.lignes[1].numeroLogistique).toBe("");
    expect(bon.lignes[1].nomenclature).toBe("");
    expect(() => modeleBonSortie(sortie())).not.toThrow();
  });

  it("B3 : total des quantités, total du montant et montant en toutes lettres", () => {
    const bon = modeleBonSortie(sortie());

    expect(bon.totalQuantite).toBe(3);
    expect(bon.totalMontant).toBe(625000);
    expect(bon.montantEnLettres).toContain("ARIARY");
    expect(bon.montantEnLettres.length).toBeGreaterThan("ARIARY".length);
  });

  it("B4 : les trois signataires, avec nom et date posés par le serveur", () => {
    const bon = modeleBonSortie(sortie());

    expect(bon.signataires).toHaveLength(3);
    expect(bon.signataires.map((s) => s.role)).toEqual([
      "MAGASINIER",
      "DÉPOSITAIRE COMPTABLE",
      "CHEF LOGISTIQUE",
    ]);
    expect(bon.signataires[0]).toEqual({
      role: "MAGASINIER",
      nom: "RAKOTO Bernard",
      date: "2026-10-19",
      signe: true,
    });
    expect(bon.signataires[2].nom).toBe("ANDRIANARISOA Hanta");
    expect(bon.signataires[2].signe).toBe(true);
  });

  it("B5 : le bloc détenteur porte nom, fonction, mandataire et date", () => {
    const bon = modeleBonSortie(sortie());

    expect(bon.detenteur).toEqual({
      nom: "RAKOTOMALALA Hery",
      fonction: "Dépositaire",
      mandataire: "RASOANAIVO Naina",
      date: "2026-10-20",
    });
    expect(bon.dateRemise).toBe("2026-10-20");
    expect(bon.direction).toBe("Direction Informatique");
    expect(bon.service).toBe("Service Informatique");
    expect(bon.justificatif).toBe("BL-2026-42");
    expect(bon.reference).toBe("SOR-2026-001");
  });

  it("B6 : la clause de responsabilité est présente et neutre (à valider par le ministère)", () => {
    const bon = modeleBonSortie(sortie());

    expect(bon.clause).toBe(CLAUSE_RESPONSABILITE);
    expect(bon.clause).toContain("responsable du matériel désigné ci-dessus");
    expect(bon.clause).toContain("responsabilité est engagée");
  });

  it("B7 : aucune erreur quand les données optionnelles manquent", () => {
    const sortieMinimale = {
      id: "sortie-2",
      reference: "SOR-2026-002",
      dateSortie: "2026-10-18",
      materiel: "—",
      categorie: "—",
      quantite: 0,
      serviceDemandeur: "—",
      direction: "—",
      beneficiaire: "—",
      responsable: "—",
      statut: "Validée",
      justificatif: "—",
      documents: [],
    } as unknown as SortieRecord;

    let bon!: ReturnType<typeof modeleBonSortie>;
    expect(() => {
      bon = modeleBonSortie(sortieMinimale);
    }).not.toThrow();

    expect(bon.lignes).toEqual([]);
    expect(bon.totalQuantite).toBe(0);
    expect(bon.totalMontant).toBe(0);
    expect(bon.montantEnLettres).toBe("");
    // Signataires sans signature : nom et date vides, mais les TROIS rôles.
    expect(bon.signataires).toHaveLength(3);
    expect(bon.signataires.every((s) => s.signe === false)).toBe(true);
    expect(bon.detenteur).toEqual({ nom: "", fonction: "", mandataire: "", date: "" });
  });
});
