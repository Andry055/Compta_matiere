import { describe, expect, it } from "vitest";
import {
  SortieRecord,
  sortiesRéceptionnables,
  getQuantiteDejaRecue,
  getReliquat,
  getStatutRéceptionSortie,
  peutRecevoir,
  peutReceptionnerSortie,
} from "./movements";

/* ------------------------------------------------------------------ */
/* Données de test réutilisables                                      */
/* ------------------------------------------------------------------ */

const sortieComplete: SortieRecord = {
  id: "SORT-001",
  reference: "SORT-2025-001",
  dateSortie: "2025-01-08",
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

const sortieAutreDirection: SortieRecord = {
  ...sortieComplete,
  id: "SORT-002",
  reference: "SORT-2025-002",
  direction: "IT",
  directionId: "d_it",
};

const sortieSansSignatures: SortieRecord = {
  ...sortieComplete,
  id: "SORT-003",
  reference: "SORT-2025-003",
  magasinier_signed: false,
  depositaire_signed: false,
  logistique_signed: false,
};

const sortieStatutNonEffecute: SortieRecord = {
  ...sortieComplete,
  id: "SORT-004",
  reference: "SORT-2025-004",
  statut: "Validée",
};

const userDepositaireDRH = { role: "depositaire", department: "DRH", directionId: "d_drh" };
const userDepositaireIT = { role: "depositaire", department: "IT", directionId: "d_it" };
const userDemandeurDRH = { role: "demandeur", department: "DRH" };
const userAutre = { role: "magasinier", department: "DRH" };

/* ------------------------------------------------------------------ */
/* getQuantiteDejaRecue                                               */
/* ------------------------------------------------------------------ */

describe("getQuantiteDejaRecue", () => {
  it("retourne 0 quand aucune réception n'existe pour la sortie", () => {
    expect(getQuantiteDejaRecue("SORT-001")).toBe(0);
  });

  it("retourne 0 quand receptionsServeur est vide", () => {
    expect(getQuantiteDejaRecue("SORT-001", [])).toBe(0);
  });

  it("somme les quantite_recue des réceptions serveur pour une sortie donnée", () => {
    const receptionsServeur = [
      { sortieId: "SORT-001", quantite_recue: 3 },
      { sortieId: "SORT-001", quantite_recue: 2 },
      { sortieId: "SORT-002", quantite_recue: 5 },
    ];
    expect(getQuantiteDejaRecue("SORT-001", receptionsServeur)).toBe(5);
    expect(getQuantiteDejaRecue("SORT-002", receptionsServeur)).toBe(5);
  });

  it("ignore les entrées sans sortieId ou quantite_recue nulles", () => {
    const receptionsServeur = [
      { sortieId: null, quantite_recue: 10 },
      { sortieId: "SORT-001", quantite_recue: null },
      { sortieId: "SORT-001", quantite_recue: 4 },
    ];
    expect(getQuantiteDejaRecue("SORT-001", receptionsServeur)).toBe(4);
  });

  it("additionne le tableau local receptions et les réceptions serveur", () => {
    // Le tableau local `receptions` est toujours vide en production,
    // seules les réceptions serveur comptent.
    expect(getQuantiteDejaRecue("SORT-001", [{ sortieId: "SORT-001", quantite_recue: 7 }])).toBe(7);
  });
});

/* ------------------------------------------------------------------ */
/* getReliquat                                                        */
/* ------------------------------------------------------------------ */

describe("getReliquat", () => {
  it("retourne la quantité totale quand aucune réception n'a été faite", () => {
    expect(getReliquat(sortieComplete)).toBe(10);
  });

  it("réduit le reliquat selon les réceptions serveur", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 4 }];
    expect(getReliquat(sortieComplete, receptionsServeur)).toBe(6);
  });

  it("retourne 0 quand le reliquat est entièrement consommé", () => {
    const receptionsServeur = [
      { sortieId: "SORT-001", quantite_recue: 6 },
      { sortieId: "SORT-001", quantite_recue: 4 },
    ];
    expect(getReliquat(sortieComplete, receptionsServeur)).toBe(0);
  });

  it("ne retourne jamais un reliquat négatif", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 12 }];
    expect(getReliquat(sortieComplete, receptionsServeur)).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* getStatutRéceptionSortie                                           */
/* ------------------------------------------------------------------ */

describe("getStatutRéceptionSortie", () => {
  it("retourne « En cours » quand aucune réception n'existe", () => {
    expect(getStatutRéceptionSortie(sortieComplete)).toBe("En cours");
  });

  it("retourne « Partielle » quand une partie est reçue", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 4 }];
    expect(getStatutRéceptionSortie(sortieComplete, receptionsServeur)).toBe("Partielle");
  });

  it("retourne « Complète » quand tout est reçu", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 10 }];
    expect(getStatutRéceptionSortie(sortieComplete, receptionsServeur)).toBe("Complète");
  });
});

/* ------------------------------------------------------------------ */
/* peutRecevoir                                                       */
/* ------------------------------------------------------------------ */

describe("peutRecevoir", () => {
  it("autorise une réception qui ne dépasse pas le reliquat", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 3 }];
    const resultat = peutRecevoir(sortieComplete, 5, receptionsServeur);
    expect(resultat.ok).toBe(true);
    expect(resultat.reliquat).toBe(2);
  });

  it("refuse une réception qui dépasserait le reliquat", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 8 }];
    const resultat = peutRecevoir(sortieComplete, 3, receptionsServeur);
    expect(resultat.ok).toBe(false);
    expect(resultat.message).toContain("dépasser");
  });

  it("autorise une quantité nulle (ne modifie pas le reliquat)", () => {
    const resultat = peutRecevoir(sortieComplete, 0);
    expect(resultat.ok).toBe(true);
    expect(resultat.reliquat).toBe(10);
  });
});

/* ------------------------------------------------------------------ */
/* sortiesRéceptionnables                                             */
/* ------------------------------------------------------------------ */

describe("sortiesRéceptionnables", () => {
  const sorties = [
    sortieComplete,
    sortieAutreDirection,
    sortieSansSignatures,
    sortieStatutNonEffecute,
  ];

  it("une sortie valide avec trois signatures apparaît pour la bonne direction", () => {
    const resultat = sortiesRéceptionnables(sorties, userDepositaireDRH);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].id).toBe("SORT-001");
  });

  it("une sortie d'une autre direction n'apparaît pas quand on filtre par DRH", () => {
    const resultat = sortiesRéceptionnables(sorties, userDepositaireDRH);
    const refs = resultat.map((s) => s.reference);
    expect(refs).not.toContain("SORT-2025-002"); // direction IT, filtrée par DRH
  });

  it("une sortie de la direction IT apparaît quand on filtre par IT", () => {
    const resultat = sortiesRéceptionnables(sorties, userDepositaireIT);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].id).toBe("SORT-002");
  });

  it("une sortie sans les trois signatures n'apparaît pas", () => {
    const resultat = sortiesRéceptionnables(sorties, userDepositaireDRH);
    const refs = resultat.map((s) => s.reference);
    expect(refs).not.toContain("SORT-2025-003");
  });

  it("une sortie dont le statut n'est pas « Sortie effectuée » n'apparaît pas", () => {
    const resultat = sortiesRéceptionnables(sorties, userDepositaireDRH);
    const refs = resultat.map((s) => s.reference);
    expect(refs).not.toContain("SORT-2025-004");
  });

  it("un utilisateur non dépositaire ni demandeur obtient une liste vide", () => {
    const resultat = sortiesRéceptionnables(sorties, userAutre);
    expect(resultat).toHaveLength(0);
  });

  it("sans utilisateur, la liste est vide", () => {
    const resultat = sortiesRéceptionnables(sorties);
    expect(resultat).toHaveLength(0);
  });

  it("une réception complète exclut la sortie de la liste", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 10 }];
    const resultat = sortiesRéceptionnables(sorties, userDepositaireDRH, receptionsServeur);
    const refs = resultat.map((s) => s.reference);
    expect(refs).not.toContain("SORT-2025-001");
  });

  it("une réception partielle conserve la sortie avec le reliquat restant", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 4 }];
    const resultat = sortiesRéceptionnables(sorties, userDepositaireDRH, receptionsServeur);
    expect(resultat).toHaveLength(1);
    expect(getReliquat(resultat[0], receptionsServeur)).toBe(6);
  });

  it("plusieurs articles sont traités individuellement", () => {
    const receptionsServeur = [
      { sortieId: "SORT-001", quantite_recue: 10 }, // complète -> exclue
      { sortieId: "SORT-002", quantite_recue: 3 },   // partielle -> incluse si direction correspond
    ];
    const resultat = sortiesRéceptionnables(sorties, userDepositaireIT, receptionsServeur);
    // SORT-001 est en DRH (exclue par réception complète), SORT-002 est en IT (partielle, incluse)
    expect(resultat).toHaveLength(1);
    expect(resultat[0].id).toBe("SORT-002");
  });
});

/* ------------------------------------------------------------------ */
/* peutReceptionnerSortie                                             */
/* ------------------------------------------------------------------ */

describe("peutReceptionnerSortie", () => {
  it("autorise le dépositaire de la même direction pour une sortie complète à 3 signatures", () => {
    expect(
      peutReceptionnerSortie(sortieComplete, userDepositaireDRH)
    ).toBe(true);
  });

  it("refuse un utilisateur d'une autre direction", () => {
    expect(
      peutReceptionnerSortie(sortieComplete, userDepositaireIT)
    ).toBe(false);
  });

  it("refuse quand le reliquat est épuisé (réception complète côté serveur)", () => {
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 10 }];
    expect(
      peutReceptionnerSortie(sortieComplete, userDepositaireDRH, receptionsServeur)
    ).toBe(false);
  });

  it("refuse quand le statut n'est pas « Sortie effectuée »", () => {
    expect(
      peutReceptionnerSortie(sortieStatutNonEffecute, userDepositaireDRH)
    ).toBe(false);
  });

  it("autorise le demandeur (dépositaire de direction) de la même direction", () => {
    const demandeurDRH = { role: "demandeur", department: "DRH", directionId: "d_drh" };
    expect(peutReceptionnerSortie(sortieComplete, demandeurDRH)).toBe(true);
  });

  it("refuse le demandeur d'une autre direction", () => {
    const demandeurIT = { role: "demandeur", department: "IT", directionId: "d_it" };
    expect(peutReceptionnerSortie(sortieComplete, demandeurIT)).toBe(false);
  });

  it("refuse le demandeur quand le reliquat est épuisé", () => {
    const demandeurDRH = { role: "demandeur", department: "DRH", directionId: "d_drh" };
    const receptionsServeur = [{ sortieId: "SORT-001", quantite_recue: 10 }];
    expect(
      peutReceptionnerSortie(sortieComplete, demandeurDRH, receptionsServeur)
    ).toBe(false);
  });

  it("refuse le demandeur quand une signature manque", () => {
    const demandeurDRH = { role: "demandeur", department: "DRH", directionId: "d_drh" };
    expect(peutReceptionnerSortie(sortieSansSignatures, demandeurDRH)).toBe(false);
  });

  it("refuse un rôle non autorisé (magasinier) même avec la bonne direction", () => {
    const magasinierDRH = { role: "magasinier", department: "DRH", directionId: "d_drh" };
    expect(peutReceptionnerSortie(sortieComplete, magasinierDRH)).toBe(false);
  });

  it("refuse un rôle non autorisé (logistique) même avec la bonne direction", () => {
    const logistiqueDRH = { role: "logistique", department: "DRH", directionId: "d_drh" };
    expect(peutReceptionnerSortie(sortieComplete, logistiqueDRH)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/ Sorties réceptionnables — filtrage par identifiant stable de direction */
/* ------------------------------------------------------------------ */

const sortieDirectionDAF: SortieRecord = {
  ...sortieComplete,
  id: "SORT-DAF",
  reference: "SORT-DAF-001",
  direction: "DAF - Service Comptabilité Matière",
  directionId: "d_daf",
};

const sortieDirectionDF: SortieRecord = {
  ...sortieComplete,
  id: "SORT-DF",
  reference: "SORT-DF-001",
  direction: "Direction Financière",
  directionId: "d_df",
};

const userDepositaireDAF = {
  role: "depositaire",
  department: "DAF - Service Comptabilité Matière",
  directionId: "d_daf",
};
const userDepositaireDAFSansId = {
  role: "depositaire",
  department: "DAF - Service Comptabilité Matière",
};

describe("sortiesRéceptionnables — direction (identifiant stable)", () => {
  const receptionsVides: Array<{
    sortieId?: string | null;
    quantite_recue?: number | null;
  }> = [];

  it("reproduit le défaut : une sortie de la DAF est injustement exclue par comparaison de libellés", () => {
    // Avant la correction, splitDepartement renvoie "DAF" alors que la sortie
    // porte le libellé complet "DAF - Service Comptabilité Matière" : la
    // comparaison stricte exclut à tort la sortie de la bonne direction.
    const resultat = sortiesRéceptionnables(
      [sortieDirectionDAF],
      userDepositaireDAF,
      receptionsVides
    );
    expect(resultat).toHaveLength(1); // échoue avant la correction, réussit après
  });

  it("exclut une sortie d'une autre direction", () => {
    const resultat = sortiesRéceptionnables(
      [sortieDirectionDAF, sortieDirectionDF],
      userDepositaireDAF,
      receptionsVides
    );
    expect(resultat).toHaveLength(1);
    expect(resultat[0].id).toBe("SORT-DAF");
  });

  it("exclut quand l'identifiant de direction du dépositaire est absent (comportement fermé)", () => {
    const resultat = sortiesRéceptionnables(
      [sortieDirectionDAF],
      userDepositaireDAFSansId,
      receptionsVides
    );
    expect(resultat).toHaveLength(0);
  });

  it("exclut une sortie sans identifiant de direction", () => {
    const sortieSansId = { ...sortieDirectionDAF, directionId: undefined };
    const resultat = sortiesRéceptionnables(
      [sortieSansId],
      userDepositaireDAF,
      receptionsVides
    );
    expect(resultat).toHaveLength(0);
  });

  it("exclut une sortie sans les trois signatures", () => {
    const resultat = sortiesRéceptionnables(
      [{ ...sortieDirectionDAF, magasinier_signed: false }],
      userDepositaireDAF,
      receptionsVides
    );
    expect(resultat).toHaveLength(0);
  });

  it("exclut une sortie dont le statut n'est pas « Sortie effectuée »", () => {
    const resultat = sortiesRéceptionnables(
      [{ ...sortieDirectionDAF, statut: "Validée" }],
      userDepositaireDAF,
      receptionsVides
    );
    expect(resultat).toHaveLength(0);
  });

  it("exclut une sortie dont le reliquat est nul", () => {
    const receptions = [{ sortieId: "SORT-DAF", quantite_recue: 10 }];
    const resultat = sortiesRéceptionnables(
      [sortieDirectionDAF],
      userDepositaireDAF,
      receptions
    );
    expect(resultat).toHaveLength(0);
  });
});
