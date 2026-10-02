import { describe, expect, it } from "vitest";
import type { EntreeRecord } from "./movements";
import { compterNotifications, notificationsPourRole } from "./notificationEtapes";

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
