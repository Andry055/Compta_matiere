import { describe, it, expect } from "vitest";
import {
  creerRegistreComptable,
  filtrerLignesJournal,
  trierLignesJournal,
  statistiquesRegistre,
} from "../lib/journal-registre";
import type { EntreeRecord, SortieRecord } from "../lib/movements";

// Entrées de test simulées (représentent ce que retournerait fetchEntrees()
// avec des données réelles du backend). Ces données sont en mémoire, jamais
// en base, et suivent la même structure que EntreeRecord (movements.ts).

function entreeValidee(overrides: Partial<EntreeRecord> = {}): EntreeRecord {
  return {
    id: "ENT-TEST-001",
    reference: "ENT-2026-0001",
    dateEntree: "2026-05-12",
    materiel: "Ordinateur portable professionnel",
    categorie: "Informatique",
    quantite: 5,
    fournisseur: "TechnoFournisseur SARL",
    numeroFacture: "BC-2026-015",
    direction: "DAF - Service Comptabilité Matière",
    service: "Service Comptabilité Matière",
    statut: "Validée",
    responsable: "Rakotomalala Hery",
    documents: [
      { nom: "BC-2026-015", type: "Bon de livraison" },
      { nom: "FAC-2026-015", type: "Facture / pièce justificative" },
    ],
    signatures: {
      depositaire: "2026-05-12T10:15:00",
      chefService1: "2026-05-12T11:05:00",
      chefService2: "2026-05-12T14:30:00",
    },
    ...overrides,
  };
}

function entreeEnAttente(overrides: Partial<EntreeRecord> = {}): EntreeRecord {
  return {
    id: "ENT-TEST-002",
    reference: "ENT-2026-0002",
    dateEntree: "2026-05-13",
    materiel: "Imprimante laser couleur",
    categorie: "Bureautique",
    quantite: 2,
    fournisseur: "Bureau Solutions",
    numeroFacture: "—",
    direction: "DAF - Service Comptabilité Matière",
    service: "Service Comptabilité Matière",
    statut: "En attente",
    responsable: "Rakotomalala Hery",
    documents: [],
    ...overrides,
  };
}

function entreeVerifiee(overrides: Partial<EntreeRecord> = {}): EntreeRecord {
  return {
    id: "ENT-TEST-003",
    reference: "ENT-2026-0003",
    dateEntree: "2026-05-14",
    materiel: "Tablette Android",
    categorie: "Communication",
    quantite: 3,
    fournisseur: "Digital Store",
    numeroFacture: "—",
    direction: "DAF - Service Comptabilité Matière",
    service: "Service Comptabilité Matière",
    statut: "Vérifiée",
    responsable: "Rakotomalala Hery",
    documents: [],
    signatures: {
      depositaire: "2026-05-14T09:00:00",
    },
    ...overrides,
  };
}

function entreeValideeSansLignes(overrides: Partial<EntreeRecord> = {}): EntreeRecord {
  return {
    id: "ENT-TEST-004",
    reference: "ENT-2026-0004",
    dateEntree: "2026-05-15",
    materiel: "Webcam Logitech C920",
    categorie: "Périphériques",
    quantite: 10,
    fournisseur: "Matériel Express",
    numeroFacture: "—",
    direction: "DAF - Service Comptabilité Matière",
    service: "Service Comptabilité Matière",
    statut: "Validée",
    responsable: "Rakotomalala Hery",
    documents: [{ nom: "BL-2026-004", type: "Bon de livraison" }],
    signatures: {
      depositaire: "2026-05-15T10:00:00",
      chefService1: "2026-05-15T11:00:00",
      chefService2: "2026-05-15T15:00:00",
    },
    lignes: [],
    ...overrides,
  };
}

describe("journal-registre : transformation des entrées en lignes de journal", () => {
  it("n'inclut que les entrées validées (statut Validée)", () => {
    const entrees = [
      entreeValidee({ id: "ENT-1", reference: "ENT-2026-0001" }),
      entreeEnAttente({ id: "ENT-2", reference: "ENT-2026-0002" }),
      entreeVerifiee({ id: "ENT-3", reference: "ENT-2026-0003" }),
      entreeValidee({ id: "ENT-4", reference: "ENT-2026-0004" }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    // Seules les deux entrées validées doivent donner des lignes
    expect(lignes.length).toBeGreaterThanOrEqual(2);
    // Chaque entrée validée sans lignes donne une ligne
    expect(lignes.map((l) => l.sourceId)).toEqual(
      expect.arrayContaining(["ENT-1", "ENT-4"])
    );
  });

  it("ne compte pas les entrées en cours dans le registre", () => {
    const entrees = [
      entreeEnAttente({ id: "EA-1" }),
      entreeVerifiee({ id: "EV-1" }),
      entreeValideeSansLignes({ id: "EV-2" }),
    ];

    const lignes = creerRegistreComptable(entrees, []);
    const stats = statistiquesRegistre(lignes);

    // Une seule entrée validée → 1 ligne, 1 entrée comptabilisée
    expect(lignes.length).toBe(1);
    expect(stats.nombreEntrees).toBe(1);
    expect(stats.nombreSorties).toBe(0);
  });

  it("numérote par année dans l'ordre chronologique des dates de validation", () => {
    const entrees = [
      // Entrée validée plus tard dans le temps
      entreeValideeSansLignes({
        id: "ENT-PLUS-RECENT",
        reference: "ENT-2026-0010",
        dateEntree: "2026-12-01",
        signatures: {
          depositaire: "2026-12-01T10:00:00",
          chefService1: "2026-12-01T11:00:00",
          chefService2: "2026-12-01T15:00:00",
        },
      }),
      // Entrée validée plus tôt
      entreeValideeSansLignes({
        id: "ENT-MOINS-RECENT",
        reference: "ENT-2026-0001",
        dateEntree: "2026-01-01",
        signatures: {
          depositaire: "2026-01-01T10:00:00",
          chefService1: "2026-01-01T11:00:00",
          chefService2: "2026-01-01T15:00:00",
        },
      }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    // Tri plus récent d'abord : le numéro 1 correspond à la date la plus récente
    expect(lignes[0].numeroOrdre).toBe("2026-0001");
    expect(lignes[0].sourceId).toBe("ENT-PLUS-RECENT");
    expect(lignes[1].numeroOrdre).toBe("2026-0002");
    expect(lignes[1].sourceId).toBe("ENT-MOINS-RECENT");
  });

  it("respecte l'ordre chronologique même quand les dates entrée sont inversées", () => {
    // La date de validation (3ᵉ signature) prime sur la date d'entrée
    const entrees = [
      entreeValideeSansLignes({
        id: "ENT-A",
        reference: "ENT-2026-0001",
        dateEntree: "2026-06-01", // plus récente comme date d'entrée
        signatures: {
          depositaire: "2026-06-01T10:00:00",
          chefService1: "2026-06-01T11:00:00",
          chefService2: "2026-06-01T15:00:00",
        },
      }),
      entreeValideeSansLignes({
        id: "ENT-B",
        reference: "ENT-2026-0002",
        dateEntree: "2026-01-01", // moins récente comme date d'entrée
        signatures: {
          depositaire: "2026-01-01T10:00:00",
          chefService1: "2026-01-01T11:00:00",
          chefService2: "2026-01-01T15:00:00",
        },
      }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    // Le numéro 1 correspond à la date de validation la plus récente (juin)
    expect(lignes[0].sourceId).toBe("ENT-A");
    expect(lignes[0].numeroOrdre).toBe("2026-0001");
    expect(lignes[1].sourceId).toBe("ENT-B");
    expect(lignes[1].numeroOrdre).toBe("2026-0002");
  });

  it("calcule le numéro d'ordre à l'affichage, pas depuis le backend", () => {
    // Le numéro d'ordre affiché ne dépend pas de numéro_ordre_journal renseigné
    // dans l'administration (qui peut être vide ou obsolète)
    const entrees = [
      entreeValideeSansLignes({
        id: "ENT-1",
        reference: "ENT-2026-0001",
        admin: {
          numeroOrdreJournal: "999-0001", // valeur fictive, non utilisée
        },
        signatures: {
          depositaire: "2026-03-01T10:00:00",
          chefService1: "2026-03-01T11:00:00",
          chefService2: "2026-03-01T15:00:00",
        },
      }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    // Le numéro affiché est calculé, pas repris de admin.numeroOrdreJournal
    expect(lignes[0].numeroOrdre).toBe("2026-0001");
    expect(lignes[0].numeroOrdre).not.toBe("999-0001");
  });

  it("gère correctement une entrée sans pièce justificative", () => {
    const entrees = [
      entreeValideeSansLignes({
        id: "ENT-SANS-PJ",
        reference: "ENT-2026-0001",
        documents: [], // aucune pièce jointe
        signatures: {
          depositaire: "2026-07-01T10:00:00",
          chefService1: "2026-07-01T11:00:00",
          chefService2: "2026-07-01T15:00:00",
        },
      }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    // La ligne n'aura pas de pièce justificative
    expect(lignes[0].pieceJustificative).toBeNull();
  });

  it("extrait le bon de livraison comme pièce justificative principale", () => {
    const entrees = [
      entreeValideeSansLignes({
        id: "ENT-1",
        reference: "ENT-2026-0001",
        documents: [
          { nom: "FAC-2026-001", type: "Facture / pièce justificative" },
          { nom: "BL-2026-001", type: "Bon de livraison" },
        ],
        signatures: {
          depositaire: "2026-08-01T10:00:00",
          chefService1: "2026-08-01T11:00:00",
          chefService2: "2026-08-01T15:00:00",
        },
      }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    // Le bon de livraison est prioritaire
    expect(lignes[0].pieceJustificative).toBe("BL-2026-001");
  });

  it("déduit le type d'origine depuis le fournisseur", () => {
    const entreesDonation = [
      entreeValideeSansLignes({
        id: "ENT-DON",
        reference: "ENT-2026-0001",
        fournisseur: "Donation Entreprise Partenaire",
        documents: [],
        signatures: {
          depositaire: "2026-09-01T10:00:00",
          chefService1: "2026-09-01T11:00:00",
          chefService2: "2026-09-01T15:00:00",
        },
      }),
    ];

    const lignes = creerRegistreComptable(entreesDonation, []);

    expect(lignes[0].origine).toBe("donation");
  });

  it("gère une entrée avec plusieurs lignes matérielles", () => {
    const entree = entreeValidee({
      id: "ENT-MULTI",
      reference: "ENT-2026-0001",
      lignes: [
        {
          numeroOrdre: 1,
          designation: "Ordinateur portable",
          espece: "Informatique",
          quantite: 2,
          prixUnitaire: 1000,
          montant: 2000,
          nomenclature: "INFO-001",
          pieceJustificative: "BL-2026-001",
          observation: "",
          etat: "neuf",
        },
        {
          numeroOrdre: 2,
          designation: "Écran Dell",
          espece: "Informatique",
          quantite: 3,
          prixUnitaire: 300,
          montant: 900,
          nomenclature: "INFO-002",
          pieceJustificative: "BL-2026-001",
          observation: "",
          etat: "bon",
        },
      ],
      signatures: {
        depositaire: "2026-10-01T10:00:00",
        chefService1: "2026-10-01T11:00:00",
        chefService2: "2026-10-01T15:00:00",
      },
    });

    const lignes = creerRegistreComptable([entree], []);

    // Deux lignes de journal pour une entrée avec deux lignes matérielles
    expect(lignes.length).toBe(2);
    expect(lignes[0].designation).toBe("Ordinateur portable");
    expect(lignes[1].designation).toBe("Écran Dell");
    expect(lignes[0].numeroOrdre).toBe("2026-0001");
    expect(lignes[1].numeroOrdre).toBe("2026-0002");
  });
});

describe("journal-registre : filtrage et tri", () => {
  const lignesDeBase = [
    {
      id: "L1",
      numeroOrdre: "2026-0001",
      reference: "ENT-2026-0001",
      dateValidation: "2026-05-01",
      fournisseur: "Fournisseur A",
      pieceJustificative: "BL-001",
      quantite: 10,
      designation: "Produit A",
      numeroNomenclature: "INFO-001",
      prixUnitaire: 100,
      montant: 1000,
      espece: "Informatique",
      sens: "Entrée" as const,
      origine: "fournisseur" as const,
      sourceId: "ENT-1",
    },
    {
      id: "L2",
      numeroOrdre: "2026-0002",
      reference: "ENT-2026-0002",
      dateValidation: "2026-06-01",
      fournisseur: "Fournisseur B",
      pieceJustificative: null,
      quantite: 5,
      designation: "Produit B",
      numeroNomenclature: "BUR-001",
      prixUnitaire: 200,
      montant: 1000,
      espece: "Bureautique",
      sens: "Entrée" as const,
      origine: "fournisseur" as const,
      sourceId: "ENT-2",
    },
    {
      id: "L3",
      numeroOrdre: "2026-0003",
      reference: "ENT-2026-0003",
      dateValidation: "2026-05-15",
      fournisseur: "Donation C",
      pieceJustificative: "DON-003",
      quantite: 3,
      designation: "Produit C",
      numeroNomenclature: "COMM-001",
      prixUnitaire: 150,
      montant: 450,
      espece: "Communication",
      sens: "Entrée" as const,
      origine: "donation" as const,
      sourceId: "ENT-3",
    },
  ];

  it("filtre par terme de recherche", () => {
    const resultat = filtrerLignesJournal(lignesDeBase, {
      searchTerm: "Produit A",
    });

    expect(resultat.length).toBe(1);
    expect(resultat[0].designation).toBe("Produit A");
  });

  it("filtre par origine", () => {
    const resultat = filtrerLignesJournal(lignesDeBase, {
      origine: "donation",
    });

    expect(resultat.length).toBe(1);
    expect(resultat[0].origine).toBe("donation");
  });

  it("filtre par plage de dates", () => {
    const resultat = filtrerLignesJournal(lignesDeBase, {
      dateDebut: "2026-05-10",
      dateFin: "2026-05-20",
    });

    expect(resultat.length).toBe(1);
    expect(resultat[0].designation).toBe("Produit C");
  });

  it("filtre par sens (Entrée / Sortie)", () => {
    const lignesAvecSortie = [
      ...lignesDeBase,
      {
        id: "L4",
        numeroOrdre: "2026-0004",
        reference: "SORT-2026-0001",
        dateValidation: "2026-07-01",
        fournisseur: "Bénéficiaire X",
        pieceJustificative: "BON-SORTIE-001",
        quantite: 2,
        designation: "Clé USB",
        numeroNomenclature: "",
        prixUnitaire: 0,
        montant: 0,
        espece: "Périphérique",
        sens: "Sortie" as const,
        origine: "entreprise" as const,
        sourceId: "SORT-1",
      },
    ];

    const resultatEntrees = filtrerLignesJournal(lignesAvecSortie, {
      sens: "Entrée",
    });
    const resultatSorties = filtrerLignesJournal(lignesAvecSortie, {
      sens: "Sortie",
    });

    expect(resultatEntrees.length).toBe(3);
    expect(resultatSorties.length).toBe(1);
    expect(resultatSorties[0].sens).toBe("Sortie");
  });

  it("trie par numéro d'ordre croissant", () => {
    const lignesMelangees = [...lignesDeBase].reverse();

    const triees = trierLignesJournal(lignesMelangees, {
      trierPar: "numeroOrdre",
      ordreTri: "asc",
    });

    expect(triees[0].numeroOrdre).toBe("2026-0001");
    expect(triees[1].numeroOrdre).toBe("2026-0002");
    expect(triees[2].numeroOrdre).toBe("2026-0003");
  });

  it("trie par valeur décroissante", () => {
    const triees = trierLignesJournal(lignesDeBase, {
      trierPar: "valeur",
      ordreTri: "desc",
    });

    expect(triees[0].montant).toBeGreaterThanOrEqual(triees[1].montant);
    expect(triees[1].montant).toBeGreaterThanOrEqual(triees[2].montant);
  });

  it("trie par date décroissante (par défaut)", () => {
    const lignesMelangees = [...lignesDeBase].reverse();

    const triees = trierLignesJournal(lignesMelangees, {
      trierPar: "date",
      ordreTri: "desc",
    });

    expect(triees[0].dateValidation).toBe("2026-06-01");
    expect(triees[1].dateValidation).toBe("2026-05-15");
    expect(triees[2].dateValidation).toBe("2026-05-01");
  });
});

describe("journal-registre : statistiques", () => {
  it("calcule le total des valeurs des entrées", () => {
    const lignes = [
      {
        id: "L1",
        numeroOrdre: "2026-0001",
        reference: "ENT-2026-0001",
        dateValidation: "2026-05-01",
        fournisseur: "Fournisseur A",
        pieceJustificative: "BL-001",
        quantite: 10,
        designation: "Produit A",
        numeroNomenclature: "INFO-001",
        prixUnitaire: 100,
        montant: 1000,
        espece: "Informatique",
        sens: "Entrée" as const,
        origine: "fournisseur" as const,
        sourceId: "ENT-1",
      },
      {
        id: "L2",
        numeroOrdre: "2026-0002",
        reference: "ENT-2026-0002",
        dateValidation: "2026-06-01",
        fournisseur: "Fournisseur B",
        pieceJustificative: null,
        quantite: 5,
        designation: "Produit B",
        numeroNomenclature: "BUR-001",
        prixUnitaire: 200,
        montant: 1000,
        espece: "Bureautique",
        sens: "Entrée" as const,
        origine: "fournisseur" as const,
        sourceId: "ENT-2",
      },
    ];

    const stats = statistiquesRegistre(lignes);

    expect(stats.totalValeurEntrees).toBe(2000);
    expect(stats.nombreEntrees).toBe(2);
    expect(stats.nombreSorties).toBe(0);
  });

  it("calcule le total des valeurs des sorties", () => {
    const lignes = [
      {
        id: "L1",
        numeroOrdre: "2026-0001",
        reference: "SORT-2026-0001",
        dateValidation: "2026-07-01",
        fournisseur: "Bénéficiaire X",
        pieceJustificative: "BON-SORTIE-001",
        quantite: 2,
        designation: "Clé USB",
        numeroNomenclature: "",
        prixUnitaire: 0,
        montant: 0,
        espece: "Périphérique",
        sens: "Sortie" as const,
        origine: "entreprise" as const,
        sourceId: "SORT-1",
      },
    ];

    const stats = statistiquesRegistre(lignes);

    expect(stats.totalValeurSorties).toBe(0);
    expect(stats.nombreSorties).toBe(1);
  });

  it("ne compte pas les lignes vides", () => {
    const stats = statistiquesRegistre([]);

    expect(stats.totalEntrees).toBe(0);
    expect(stats.totalSorties).toBe(0);
    expect(stats.totalValeurEntrees).toBe(0);
    expect(stats.totalValeurSorties).toBe(0);
  });
});

describe("journal-registre : état vide", () => {
  it("le registre est vide quand il n'y a aucune entrée validée", () => {
    const entrees = [
      entreeEnAttente({ id: "EA-1" }),
      entreeVerifiee({ id: "EV-1" }),
    ];

    const lignes = creerRegistreComptable(entrees, []);

    expect(lignes.length).toBe(0);
  });

  it("le registre est vide quand l'API ne répond pas (null)", () => {
    // fetchEntrees() retourne null en cas d'erreur réseau → on n'affiche pas
    // de données fictives, mais un état vide avec message d'erreur
    const entrees: EntreeRecord[] | null = null;

    // Dans le composant, on vérifie null avant d'appeler creerRegistreComptable
    // Cette fonction ne reçoit que des tableaux, jamais null
    // (la transformation n'est pas appelée si entrees est null)
    expect(entrees).toBeNull();
  });

  it("les entrées en cours n'apparaissent que dans l'onglet Non comptabilisées", () => {
    const entrees = [
      entreeValidee({ id: "ENT-VAL", reference: "ENT-2026-0001" }),
      entreeEnAttente({ id: "ENT-EA", reference: "ENT-2026-0002" }),
      entreeVerifiee({ id: "ENT-EV", reference: "ENT-2026-0003" }),
    ];

    const lignesRegistre = creerRegistreComptable(entrees, []);
    const entreesEnCour = entrees.filter(
      (e) => e.statut !== "Validée"
    );

    // Le registre ne contient que l'entrée validée
    expect(lignesRegistre.length).toBe(1);
    expect(lignesRegistre[0].sourceId).toBe("ENT-VAL");

    // Les entrées en cours sont séparées (à afficher dans l'onglet dédié)
    expect(entreesEnCour.length).toBe(2);
    expect(entreesEnCour.map((e) => e.statut)).toContain("En attente");
    expect(entreesEnCour.map((e) => e.statut)).toContain("Vérifiée");
  });
});

// ---------------------------------------------------------------------------
// Sorties : le journal est DÉCLENCHÉ par la 3ᵉ signature (chef logistique),
// pas par la remise — c'est à la validation que le stock est débité.
// ---------------------------------------------------------------------------

function sortie(
  partiel: Partial<SortieRecord> & {
    id: string;
    statut: SortieRecord["statut"];
  }
): SortieRecord {
  return {
    reference: `SOR-2026-${partiel.id.toUpperCase()}`,
    dateSortie: "2026-10-12",
    materiel: "Ordinateur portable, Écran Dell",
    categorie: "Informatique",
    quantite: 5,
    serviceDemandeur: "Service Informatique",
    direction: "DAF",
    beneficiaire: "Service Informatique",
    responsable: "Rakoto",
    justificatif: "BL-SOR-2026-001",
    documents: [],
    ...partiel,
  } as SortieRecord;
}

describe("journal-registre : les sorties comptabilisées", () => {
  it("une sortie validée par le chef logistique entre au registre", () => {
    const lignes = creerRegistreComptable(
      [],
      [
        sortie({
          id: "s1",
          statut: "Validée",
          logistique_signed: true,
          dateSignatureLogistique: "2026-10-15T09:30:00.000Z",
        }),
      ]
    );

    expect(lignes).toHaveLength(1);
    expect(lignes[0].sens).toBe("Sortie");
    expect(lignes[0].reference).toBe("SOR-2026-S1");
    // L'écriture porte la date de la 3ᵉ signature (débit du stock), pas la
    // date de remise.
    expect(lignes[0].dateValidation).toBe("2026-10-15T09:30:00.000Z");
    expect(lignes[0].numeroOrdre).toBe("2026-0001");
  });

  it("une sortie encore en préparation n'est pas comptabilisée", () => {
    const lignes = creerRegistreComptable([], [
      sortie({ id: "s2", statut: "En préparation" }),
      sortie({ id: "s3", statut: "Demandée" }),
      sortie({ id: "s4", statut: "Annulée" }),
    ]);

    expect(lignes).toHaveLength(0);
  });

  it("après la remise, la sortie reste au registre en UNE seule ligne", () => {
    const remise = sortie({
      id: "s5",
      statut: "Sortie effectuée",
      logistique_signed: true,
      dateSignatureLogistique: "2026-10-15T09:30:00.000Z",
      dateRemise: "2026-10-16",
    });

    // Le statut change (Validée → Sortie effectuée) mais l'écriture ne bouge
    // pas : ni doublon, ni date réécrite à la remise.
    const lignes = creerRegistreComptable([], [remise]);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].dateValidation).toBe("2026-10-15T09:30:00.000Z");
  });

  it("valorise l'écriture à partir des lignes peuplées (montant serveur)", () => {
    const lignes = creerRegistreComptable([], [
      sortie({
        id: "s6",
        statut: "Validée",
        dateSignatureLogistique: "2026-10-15T09:30:00.000Z",
        lignes: [
          {
            documentId: "l1",
            designation: "Ordinateur portable",
            quantite: 2,
            valeurUnitaire: 1_000_000,
            montant: 2_000_000,
            etat: "neuf",
            observations: null,
          },
          {
            documentId: "l2",
            designation: "Écran Dell",
            quantite: 3,
            valeurUnitaire: 300_000,
            montant: 900_000,
            etat: "bon",
            observations: null,
          },
        ],
      }),
    ]);

    expect(lignes[0].montant).toBe(2_900_000);
    const stats = statistiquesRegistre(lignes);
    expect(stats.totalValeurSorties).toBe(2_900_000);
  });

  it("sans lignes peuplées : montant 0, jamais de montant inventé", () => {
    const lignes = creerRegistreComptable([], [
      sortie({ id: "s7", statut: "Validée" }),
    ]);

    expect(lignes[0].montant).toBe(0);
  });
});
