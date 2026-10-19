// @vitest-environment jsdom
//
// Règles d'alerte de la cloche magasinier — module PUR (aucune persistance).
//
// Preuves exigées (phase 2) :
//   R1  aucun alerte au premier chargement pour des ordres déjà connus ;
//   R2  aucun alerte après un rechargement (nouvelle session) ;
//   R3  UNE alerte pour un ordre réellement nouveau ;
//   R4  UNE SEULE alerte groupée quand plusieurs ordres arrivent ensemble ;
//   R5  l'alerte disparaît dès que l'ordre est signé ;
//   R6  un ordre « Demandée » ou déjà signé n'alerte jamais.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SortieRecord } from "./api";
import {
  alertesVisibles,
  compterAlertes,
  etatAlertesInitial,
  recalculerAlertes,
} from "./sortieAlertes";

function ordre(id: string, statut = "En préparation", magasinier_signed = false) {
  return {
    id,
    reference: `SOR-2026-${id}`,
    dateSortie: "2026-10-18",
    materiel: "Tapis",
    categorie: "—",
    quantite: 1,
    serviceDemandeur: "Service Test",
    direction: "Direction Test",
    beneficiaire: "—",
    responsable: "—",
    statut,
    magasinier_signed,
    depositaire_signed: false,
    logistique_signed: false,
    justificatif: "",
    documents: [],
  } as SortieRecord;
}

const referencesDe = (etat: ReturnType<typeof etatAlertesInitial>) =>
  alertesVisibles(etat).map((a) => a.references).flat();

describe("sortieAlertes — dérivé des données serveur, jamais persisté", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("R1 : aucun alerte au premier chargement pour des ordres déjà connus", () => {
    // Premier relevé : 3 ordres déjà en attente chez le magasinier.
    const etat = recalculerAlertes(
      etatAlertesInitial(),
      [ordre("a"), ordre("b"), ordre("c")]
    );
    expect(compterAlertes(etat)).toBe(0);
    expect(referencesDe(etat)).toEqual([]);
  });

  it("R2 : aucun alerte après un rechargement pour des ordres déjà connus", () => {
    // Session 1 : les 3 ordres deviennent la ligne de base.
    recalculerAlertes(etatAlertesInitial(), [ordre("a"), ordre("b")]);
    // Session 2 (rechargement) : nouvel état, mêmes ordres servis par le serveur.
    const rechargement = recalculerAlertes(
      etatAlertesInitial(),
      [ordre("a"), ordre("b")]
    );
    expect(compterAlertes(rechargement)).toBe(0);
  });

  it("R3 : une seule alerte pour un ordre réellement nouveau", () => {
    let etat = recalculerAlertes(etatAlertesInitial(), [ordre("a")]);
    etat = recalculerAlertes(etat, [ordre("a"), ordre("z")]);

    expect(compterAlertes(etat)).toBe(1);
    expect(referencesDe(etat)).toEqual(["SOR-2026-z"]);
  });

  it("R4 : une seule alerte GROUPÉE pour plusieurs ordres arrivés ensemble", () => {
    let etat = recalculerAlertes(etatAlertesInitial(), []);
    etat = recalculerAlertes(etat, [ordre("a"), ordre("b"), ordre("c")]);

    expect(compterAlertes(etat), "un seul groupe = une seule alerte").toBe(1);
    expect(alertesVisibles(etat)[0].ids).toEqual(["a", "b", "c"]);
    expect(referencesDe(etat)).toEqual([
      "SOR-2026-a",
      "SOR-2026-b",
      "SOR-2026-c",
    ]);
  });

  it("R5 : l'alerte disparaît dès que l'ordre est signé", () => {
    let etat = recalculerAlertes(etatAlertesInitial(), []);
    etat = recalculerAlertes(etat, [ordre("a")]);
    expect(compterAlertes(etat)).toBe(1);

    // Le serveur ne renvoie plus l'ordre (signature 1 posée) → plus d'alerte.
    etat = recalculerAlertes(etat, []);
    expect(compterAlertes(etat)).toBe(0);
    expect(referencesDe(etat)).toEqual([]);
  });

  it("R5 bis : un groupe partiellement signé ne montre que les ordres restants", () => {
    let etat = recalculerAlertes(etatAlertesInitial(), []);
    etat = recalculerAlertes(etat, [ordre("a"), ordre("b")]);
    etat = recalculerAlertes(etat, [ordre("b")]); // « a » signé

    expect(compterAlertes(etat)).toBe(1);
    expect(referencesDe(etat)).toEqual(["SOR-2026-b"]);
  });

  it("R6 : un ordre « Demandée » ou déjà signé ne déclenche aucune alerte", () => {
    let etat = recalculerAlertes(etatAlertesInitial(), []);
    etat = recalculerAlertes(etat, [
      ordre("d", "Demandée"),
      ordre("s", "En préparation", true),
      ordre("v", "Validée"),
    ]);
    expect(compterAlertes(etat)).toBe(0);
  });

  it("2ᵉ magasinier : aucun alerte pour l'ordre déjà traité par le 1er poste", () => {
    // Poste 1 découvre l'ordre « a » (alerte chez lui).
    const poste1 = recalculerAlertes(etatAlertesInitial(), []);
    const poste1Apres = recalculerAlertes(poste1, [ordre("a")]);
    expect(compterAlertes(poste1Apres)).toBe(1);

    // Poste 2 (2ᵉ magasinier) ouvre l'application : même relevé serveur.
    const poste2 = recalculerAlertes(etatAlertesInitial(), [ordre("a")]);
    expect(compterAlertes(poste2), "aucune alerte pour un ordre déjà connu").toBe(0);

    // Un ordre neuf arrive ensuite : chaque poste alerte une fois.
    const poste2Apres = recalculerAlertes(poste2, [ordre("a"), ordre("z")]);
    expect(compterAlertes(poste2Apres)).toBe(1);
  });

  it("n'écrit AUCUNE donnée dans localStorage (alerte = état dérivé)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    let etat = recalculerAlertes(etatAlertesInitial(), []);
    etat = recalculerAlertes(etat, [ordre("a")]);
    etat = recalculerAlertes(etat, []);

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem("appNotifications")).toBeNull();
    setItem.mockRestore();
  });
});
