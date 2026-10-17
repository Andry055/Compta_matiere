import { describe, expect, it } from "vitest";
import {
  apparierDemande,
  construirePayloadSortie,
  validerSortieBrouillon,
} from "./sortieBrouillon";
import type { MaterialOption } from "./api";

/**
 * Contrat du payload de POST /api/sorties/create-complete.
 *
 * Le serveur (backend/src/api/sortie/controllers/sortie.js) identifie la
 * fiche par `materiel_id` : tout autre libellé (p.ex. `materielId`) est
 * ignoré et la ligne retombe sur une résolution par désignation EXACTE. Une
 * recherche partielle tapée dans le formulaire produisait donc un 400
 * « Matériel introuvable » alors que le formulaire affichait « Sélectionné ».
 */

const fiche: MaterialOption = {
  documentId: "doc-tapis",
  designation: "Tapis de souris",
  quantiteStock: 10,
  valeurUnitaire: 5000,
};

describe("construirePayloadSortie", () => {
  it("envoie materiel_id (nom attendu par le serveur) et jamais materielId", () => {
    const payload = construirePayloadSortie(
      "2026-10-16",
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      undefined,
      [{ materielId: fiche.documentId, designation: fiche.designation, quantite: 2 }]
    );

    expect(payload.lignes).toHaveLength(1);
    expect(payload.lignes[0]).toMatchObject({
      materiel_id: "doc-tapis",
      designation: "Tapis de souris",
      quantite: 2,
    });
    // La clé camelCase ne doit PLUS être produite : le serveur l'ignorait.
    expect(payload.lignes[0]).not.toHaveProperty("materielId");
  });

  it("écarte les valeurs vides (aucune clé inutile dans le corps)", () => {
    const payload = construirePayloadSortie(
      "2026-10-16",
      "  Bon n° 42  ",
      "",
      undefined,
      "   ",
      undefined,
      [{ materielId: " ", designation: "", quantite: 1 }]
    );

    expect(payload.justificatif).toBe("Bon n° 42");
    expect(payload.direction_id).toBeUndefined();
    expect(payload.beneficiaire).toBeUndefined();
    expect(payload.lignes[0].materiel_id).toBeUndefined();
    // La clé demande_id ne doit pas du tout figurer dans le payload
    expect("demande_id" in payload).toBe(false);
    expect("demande" in payload).toBe(false);
  });

  it("n'inclut jamais la clé demande_id si demandeId est vide ou ne contient que des espaces", () => {
    const payloadVide = construirePayloadSortie(
      "2026-10-16",
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      "",
      [{ materielId: fiche.documentId, designation: fiche.designation, quantite: 1 }]
    );
    expect("demande_id" in payloadVide).toBe(false);

    const payloadEspaces = construirePayloadSortie(
      "2026-10-16",
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      "     ",
      [{ materielId: fiche.documentId, designation: fiche.designation, quantite: 1 }]
    );
    expect("demande_id" in payloadEspaces).toBe(false);

    const payloadRempli = construirePayloadSortie(
      "2026-10-16",
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      "doc-dem-1",
      [{ materielId: fiche.documentId, designation: fiche.designation, quantite: 1 }]
    );
    expect(payloadRempli.demande_id).toBe("doc-dem-1");
  });
});

describe("validerSortieBrouillon — résolution obligatoire d'une fiche", () => {
  const stock = { [fiche.documentId]: 10 };

  it("accepte une ligne appariée à une fiche du stock", () => {
    const { estValide, erreurs } = validerSortieBrouillon(
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      [{ materielId: fiche.documentId, designation: fiche.designation, quantite: 2, materiel: fiche }],
      stock
    );
    expect(estValide).toBe(true);
    expect(erreurs).toEqual([]);
  });

  it("refuse une désignation seule : le serveur renverrait un 400", () => {
    const { estValide, erreurs } = validerSortieBrouillon(
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      [{ designation: "Tapis (recherche partielle)", quantite: 1 }],
      stock
    );
    expect(estValide).toBe(false);
    expect(erreurs.join(" ")).toMatch(/matériel introuvable dans le stock/i);
  });

  it("refuse une quantité supérieure au stock", () => {
    const { estValide } = validerSortieBrouillon(
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      [{ materielId: fiche.documentId, designation: fiche.designation, quantite: 11, materiel: fiche }],
      stock
    );
    expect(estValide).toBe(false);
  });
});

// RÉGRESSION : 5 fiches sur 15 n'ont aucune valeur unitaire. Le formulaire les
// proposait, le serveur refusait au moment de l'envoi (400 « Valeur unitaire
// manquante sur la fiche de X ») — raison illisible dans la console. La
// validation doit désormais bloquer AVANT l'envoi, avec un message explicite.
describe("validerSortieBrouillon — fiche sans valeur unitaire", () => {
  const sansPrix: MaterialOption = {
    documentId: "doc-lampe",
    designation: "Lampe",
    quantiteStock: 5,
    valeurUnitaire: null,
  };
  const stockPrix = { [fiche.documentId]: 10, [sansPrix.documentId]: 5 };

  it("refuse une ligne dont la fiche n'a aucun prix", () => {
    const { estValide, erreurs } = validerSortieBrouillon(
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      [
        {
          materielId: sansPrix.documentId,
          designation: sansPrix.designation,
          quantite: 1,
          materiel: sansPrix,
        },
      ],
      stockPrix
    );
    expect(estValide).toBe(false);
    expect(erreurs.join(" ")).toMatch(/n'a pas de valeur unitaire/i);
    expect(erreurs.join(" ")).toMatch(/Lampe/);
  });

  it("refuse aussi un prix à 0 (aucun montant calculable)", () => {
    const prixZero: MaterialOption = { ...sansPrix, valeurUnitaire: 0 };
    const { estValide, erreurs } = validerSortieBrouillon(
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      [
        {
          materielId: prixZero.documentId,
          designation: prixZero.designation,
          quantite: 1,
          materiel: prixZero,
        },
      ],
      stockPrix
    );
    expect(estValide).toBe(false);
    expect(erreurs.join(" ")).toMatch(/n'a pas de valeur unitaire/i);
  });

  it("n'ajoute aucune erreur quand la fiche est pourvue d'un prix", () => {
    const { estValide, erreurs } = validerSortieBrouillon(
      "Bon n° 42",
      undefined,
      undefined,
      "Service Formation",
      [
        {
          materielId: fiche.documentId,
          designation: fiche.designation,
          quantite: 2,
          materiel: fiche,
        },
      ],
      stockPrix
    );
    expect(estValide).toBe(true);
    expect(erreurs).toEqual([]);
  });
});

// RÉGRESSION : le champ « Demande liée » est du texte libre, envoyé tel quel en
// demande_id alors que le serveur attend un documentId EXISTANT au statut
// approuvee/preparation → TOUTE saisie renvoyait un 400 « Demande introuvable. »
describe("apparierDemande — résolution du champ « Demande liée »", () => {
  const demandes = [
    { documentId: "doc-dem-1", reference: "DEM-2026-014", statut: "approuvee" },
    { documentId: "doc-dem-2", reference: "DEM-2026-015", statut: "en_attente" },
    { documentId: "doc-dem-3", reference: "DEM-2026-016", statut: "preparation" },
  ];

  it("accepte une référence saisie (casse/espaces indifférents) et renvoie le documentId", () => {
    const res = apparierDemande("  dem-2026-014 ", demandes);
    expect(res).toEqual({ ok: true, documentId: "doc-dem-1" });
  });

  it("accepte un documentId saisi tel quel", () => {
    const res = apparierDemande("doc-dem-3", demandes);
    expect(res).toEqual({ ok: true, documentId: "doc-dem-3" });
  });

  it("accepte le statut « preparation » (autorisé par le serveur)", () => {
    expect(apparierDemande("DEM-2026-016", demandes).ok).toBe(true);
  });

  it("refuse une demande inconnue AVANT l'envoi (message lisible)", () => {
    const res = apparierDemande("DEM-9999-999", demandes);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/Aucune demande ne correspond à « DEM-9999-999 »/);
  });

  it("refuse un statut non éligible en nommant la demande et le statut", () => {
    const res = apparierDemande("DEM-2026-015", demandes);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/DEM-2026-015/);
    expect(res.message).toMatch(/« en_attente »/);
  });

  it("quand aucune demande n'existe, invite à laisser le champ vide", () => {
    const res = apparierDemande("5", []);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.message).toMatch(/Aucune demande en base/);
    expect(res.message).toMatch(/laissez le champ/i);
  });
});
