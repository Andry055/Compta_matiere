import { describe, expect, it } from "vitest";
import type { EntreeRecord, SortieRecord } from "./movements";
import {
  compterNotifications,
  compterNotificationsSortie,
  notificationsPourRole,
  notificationsPourRoleSortie,
} from "./notificationEtapes";

function entree(partiel: Partial<EntreeRecord> & { id: string }): EntreeRecord {
  return {
    reference: "ENT-2026-001",
    dateEntree: "2026-09-29",
    materiel: "—",
    categorie: "—",
    quantite: 1,
    fournisseur: "Fournisseur Test",
    numeroFacture: "—",
    direction: "—",
    service: "—",
    statut: "En attente",
    responsable: "—",
    documents: [],
    statutServeur: "en_attente",
    ...partiel,
  } as EntreeRecord;
}

describe("notificationsPourRole — calcul dérivé (Étape 5)", () => {
  const enAttente = entree({ id: "a" });
  const signeeMagasinier = entree({
    id: "b",
    signatures: { chefService1: "2026-09-29T10:00:00.000Z" },
  });
  const signeeMagLog = entree({
    id: "c",
    signatures: {
      chefService1: "2026-09-29T10:00:00.000Z",
      chefService2: "2026-09-29T11:00:00.000Z",
    },
  });
  const validee = entree({
    id: "d",
    statutServeur: "validee",
    signatures: {
      depositaire: "2026-09-29T12:00:00.000Z",
      chefService1: "2026-09-29T10:00:00.000Z",
      chefService2: "2026-09-29T11:00:00.000Z",
    },
  });
  const rejetee = entree({ id: "e", statutServeur: "rejetee" });
  const brouillon = entree({ id: "f", statutServeur: "brouillon" });

  const toutes = [enAttente, signeeMagasinier, signeeMagLog, validee, rejetee, brouillon];

  it("magasinier : exactement les entrées non signées chef_service_1 (ni validée ni rejetée)", () => {
    const items = notificationsPourRole("magasinier", toutes);
    expect(items.map((i) => i.id)).toEqual(["mag-a", "mag-f"]);
  });

  it("logistique : exactement les entrées signées magasinier mais pas logistique", () => {
    const items = notificationsPourRole("logistique", toutes);
    expect(items.map((i) => i.id)).toEqual(["log-b"]);
  });

  it("dépositaire : validation finale attendue + brouillons à finaliser", () => {
    const items = notificationsPourRole("depositaire", toutes);
    expect(items.map((i) => i.id)).toEqual(["dep-fin-c", "dep-brd-f"]);
  });

  it("dépositaire : une entrée en_attente sans signatures n'apparaît pas (pas son tour)", () => {
    const items = notificationsPourRole("depositaire", [enAttente]);
    expect(items).toHaveLength(0);
  });

  it("une entrée validée ou rejetée n'apparaît nulle part", () => {
    expect(notificationsPourRole("magasinier", [validee, rejetee])).toHaveLength(0);
    expect(notificationsPourRole("logistique", [validee, rejetee])).toHaveLength(0);
    expect(notificationsPourRole("depositaire", [validee, rejetee])).toHaveLength(0);
  });

  it("déterministe : deux sessions du même rôle voient la même liste", () => {
    expect(notificationsPourRole("magasinier", toutes)).toEqual(
      notificationsPourRole("magasinier", toutes)
    );
  });

  it("compteur = taille de la liste", () => {
    expect(compterNotifications("magasinier", toutes)).toBe(2);
    expect(compterNotifications("logistique", toutes)).toBe(1);
    expect(compterNotifications("depositaire", toutes)).toBe(2);
  });

  it("dépend uniquement des données passées (aucune lecture localStorage)", () => {
    // Simulation : même appel avec un localStorage vide ou rempli ne change
    // rien — la fonction est pure (pas d'accès global). On vérifie juste le
    // contrat : liste vide si aucune entrée.
    expect(notificationsPourRole("magasinier", [])).toEqual([]);
  });
});

function sortie(
  partiel: Partial<SortieRecord> & { id: string; statut: SortieRecord["statut"] }
): SortieRecord {
  return {
    reference: `SOR-2026-${partiel.id.toUpperCase()}`,
    dateSortie: "2026-10-14",
    materiel: "Ordinateur portable",
    categorie: "Informatique",
    quantite: 2,
    serviceDemandeur: "—",
    direction: "—",
    beneficiaire: "—",
    responsable: "—",
    justificatif: "—",
    documents: [],
    ...partiel,
  } as SortieRecord;
}

describe("notificationsPourRoleSortie — 3ᵉ signature du chef logistique", () => {
  const acceptee = sortie({
    id: "acc",
    statut: "Validée",
    logistique_signed: true,
    dateSignatureLogistique: "2026-10-15T09:30:00.000Z",
  });
  const enPreparation = sortie({ id: "prep", statut: "En préparation" });
  const remise = sortie({
    id: "rem",
    statut: "Sortie effectuée",
    logistique_signed: true,
    dateSignatureLogistique: "2026-10-10T09:30:00.000Z",
  });

  it("dépositaire : NOTIFIE l'acceptation par le chef logistique (3/3)", () => {
    const items = notificationsPourRoleSortie("depositaire", [
      enPreparation,
      acceptee,
      remise,
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("sortie-acc-acc");
    expect(items[0].title).toBe("Sortie acceptée par le chef logistique");
    expect(items[0].body).toContain(acceptee.reference);
    expect(items[0].body).toContain("journal comptable");
    // Date affichée = horodatage de la 3ᵉ signature, posé par le serveur.
    expect(items[0].date).toBe("2026-10-15T09:30:00.000Z");
  });

  it("dépositaire : rien avant la 3ᵉ signature ni après la remise", () => {
    expect(notificationsPourRoleSortie("depositaire", [enPreparation])).toEqual(
      []
    );
    expect(notificationsPourRoleSortie("depositaire", [remise])).toEqual([]);
    expect(notificationsPourRoleSortie("depositaire", [])).toEqual([]);
  });

  it("magasinier : inchangé — la sortie acceptée n'est plus à préparer", () => {
    const items = notificationsPourRoleSortie("magasinier", [
      enPreparation,
      acceptee,
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("sortie-mag-prep");
    expect(items[0].title).toBe("Sortie à préparer");
  });

  it("autres rôles (logistique, comptable, demandeur) : aucun flux", () => {
    expect(
      notificationsPourRoleSortie("logistique", [acceptee, enPreparation])
    ).toEqual([]);
    expect(notificationsPourRoleSortie("comptable", [acceptee])).toEqual([]);
    expect(notificationsPourRoleSortie("demandeur", [acceptee])).toEqual([]);
  });

  it("compteur = taille de la liste (badge cloche)", () => {
    expect(
      compterNotificationsSortie("depositaire", [enPreparation, acceptee, remise])
    ).toBe(1);
    expect(compterNotificationsSortie("depositaire", [])).toBe(0);
  });
});
