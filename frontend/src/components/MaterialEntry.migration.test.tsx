// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  entreeResteATraiter,
  entreeTraiteeParRole,
  ListeEntreesATraiter,
  ListeEntreesTraitees,
} from "./MaterialEntry";
import { ENTREE_ADMIN_VIDE, type EntreeRecord } from "../lib/movements";

afterEach(cleanup);

function entree(p: Partial<EntreeRecord> & { id: string; reference: string }): EntreeRecord {
  return {
    dateEntree: "2026-10-01",
    materiel: "—",
    categorie: "—",
    quantite: 0,
    fournisseur: "Société Ravit SARL",
    numeroFacture: "—",
    direction: "—",
    service: "—",
    statut: "En attente",
    responsable: "—",
    documents: [],
    lignes: [
      {
        numeroOrdre: 1,
        designation: "Clavier AZERTY",
        espece: "Informatique",
        unite: "unité",
        quantite: 3,
        prixUnitaire: 25000,
        montant: 75000,
        nomenclature: "",
        pieceJustificative: "",
        observation: "",
        etat: "neuf",
        conforme: true,
      },
    ],
    admin: { ...ENTREE_ADMIN_VIDE, bonLivraison: "BL-2026-0042" },
    ...p,
  } as EntreeRecord;
}

/**
 * Exigence : « une fois le dossier traité il apparaît dans l'onglet Articles
 * traités ». Les deux onglets sont alimentés par ces deux prédicats, appliqués
 * à la même lecture serveur : on vérifie donc que la bascule est EXCLUSIVE —
 * jamais la pièce dans les deux listes, jamais dans aucune.
 */
describe("Bascule « À traiter » → « Articles traités » après signature", () => {
  const enAttente = entree({ id: "1", reference: "ENT-2026-004" });
  const signee = entree({
    id: "1",
    reference: "ENT-2026-004",
    statutServeur: "verifiee",
    signatures: { chefService1: "2026-10-05T09:00:00.000Z" },
    signataires: { chefService1: "Andriamampianina Fara" },
  });

  it("avant signature : la pièce est À TRAITER et pas traitée", () => {
    expect(entreeResteATraiter(enAttente, "magasinier")).toBe(true);
    expect(entreeTraiteeParRole(enAttente, "magasinier")).toBe(false);
  });

  it("après signature : la pièce quitte « À traiter » et rejoint « Articles traités »", () => {
    expect(entreeResteATraiter(signee, "magasinier")).toBe(false);
    expect(entreeTraiteeParRole(signee, "magasinier")).toBe(true);
  });

  it("la bascule est exclusive : jamais dans les deux listes, jamais dans aucune", () => {
    for (const e of [enAttente, signee]) {
      const a = entreeResteATraiter(e, "magasinier");
      const b = entreeTraiteeParRole(e, "magasinier");
      expect(a && b).toBe(false); // pas les deux
      expect(a || b).toBe(true); // au moins un
    }
  });

  it("la pièce signée s'affiche bien dans la liste « Articles traités »", () => {
    render(
      <ListeEntreesTraitees
        entrees={[signee].filter((e) => entreeTraiteeParRole(e, "magasinier"))}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );
    expect(screen.getByText("ENT-2026-004")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Consulter/ })).toBeTruthy();
  });

  it("la pièce signée ne reste pas dans la liste « À traiter »", () => {
    render(
      <ListeEntreesATraiter
        entrees={[signee].filter((e) => entreeResteATraiter(e, "magasinier"))}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );
    expect(screen.getByText("Aucune entrée à traiter")).toBeTruthy();
  });
});
