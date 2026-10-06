// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ListeEntreesATraiter } from "./MaterialEntry";
import { ENTREE_ADMIN_VIDE, type EntreeRecord } from "../lib/movements";

afterEach(cleanup);

function entree(
  p: Partial<EntreeRecord> & { id: string; reference: string },
): EntreeRecord {
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

/** Une ligne de tableau = une pièce à traiter, avec son action. */
function lignesTable(): string[][] {
  return Array.from(document.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map(
      (td) => td.textContent?.trim() || "",
    ),
  );
}

describe("Liste « À traiter » — choix de la pièce à contrôler", () => {
  it("affiche une ligne par entrée avec son BL, son nombre de lignes et son statut", () => {
    render(
      <ListeEntreesATraiter
        entrees={[
          entree({
            id: "1",
            reference: "ENT-2026-004",
            dateEntree: "2026-10-04",
            fournisseur: "Rakoto & Fils",
          }),
        ]}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );

    const lignes = lignesTable();
    expect(lignes).toHaveLength(1);
    expect(lignes[0][0]).toBe("ENT-2026-004");
    expect(lignes[0][2]).toBe("Rakoto & Fils");
    expect(lignes[0][3]).toBe("BL-2026-0042");
    expect(lignes[0][4]).toBe("1"); // nb de lignes
  });

  it("déclenche l'ouverture de la pièce cliquée", () => {
    const onOuvrir = vi.fn();
    const e = entree({ id: "1", reference: "ENT-2026-004" });
    render(
      <ListeEntreesATraiter
        entrees={[e]}
        role="magasinier"
        onOuvrir={onOuvrir}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Traiter/ }));
    expect(onOuvrir).toHaveBeenCalledWith(e);
  });

  it("classe les pièces actionnables avant celles sans bon de livraison", () => {
    // Volontairement dans le désordre : la plus récente SANS BL d'abord.
    render(
      <ListeEntreesATraiter
        entrees={[
          entree({
            id: "1",
            reference: "ENT-SANS-BL",
            dateEntree: "2026-10-09",
            admin: { ...ENTREE_ADMIN_VIDE, bonLivraison: "" },
          }),
          entree({
            id: "2",
            reference: "ENT-AVEC-BL",
            dateEntree: "2026-10-08",
          }),
        ]}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );

    expect(lignesTable().map((l) => l[0])).toEqual([
      "ENT-AVEC-BL",
      "ENT-SANS-BL",
    ]);
  });

  it("signale « BL à saisir » plutôt qu'un numéro absent", () => {
    render(
      <ListeEntreesATraiter
        entrees={[
          entree({
            id: "1",
            reference: "ENT-SANS-BL",
            admin: { ...ENTREE_ADMIN_VIDE, bonLivraison: "" },
          }),
        ]}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );
    expect(screen.getByText("BL à saisir")).toBeTruthy();
  });

  it("ordonne les pièces actionnables de la plus ancienne à la plus récente", () => {
    render(
      <ListeEntreesATraiter
        entrees={[
          entree({ id: "1", reference: "ENT-2026-009", dateEntree: "2026-10-09" }),
          entree({ id: "2", reference: "ENT-2026-004", dateEntree: "2026-10-04" }),
        ]}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );
    expect(lignesTable().map((l) => l[0])).toEqual([
      "ENT-2026-004",
      "ENT-2026-009",
    ]);
  });

  it("affiche un état vide explicite quand plus rien n'attend le rôle", () => {
    render(
      <ListeEntreesATraiter
        entrees={[]}
        role="magasinier"
        onOuvrir={() => {}}
      />,
    );
    expect(screen.getByText("Aucune entrée à traiter")).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: /Traiter/ })).toHaveLength(0);
  });
});
