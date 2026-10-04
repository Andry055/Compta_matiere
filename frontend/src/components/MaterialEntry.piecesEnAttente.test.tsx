// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  DetailEntreeTraitee,
  ListeEntreesTraitees,
  PiecesEnAttente,
} from "./MaterialEntry";
import { ENTREE_ADMIN_VIDE, type EntreeRecord } from "../lib/movements";

afterEach(cleanup);

/** Montant attendu comme l'affiche le composant. Les montants sont vérifiés
 *  sur le `textContent` BRUT (pas via getByText) : `toLocaleString("fr-MG")`
 *  insère une espace fine insécable (U+202F) qu'il ne faut donc pas
 *  normaliser — on compare exactement ce que produit le composant. */
function montantAriary(valeur: number): string {
  return valeur.toLocaleString("fr-MG") + " Ar";
}

/** Entrée serveur minimale mais complète (mêmes champs que mapEntree). */
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
    admin: { ...ENTREE_ADMIN_VIDE, bonLivraison: "BL-2026-0042" },
    ...p,
  } as EntreeRecord;
}

const entreeLogistique = entree({
  id: "1",
  reference: "ENT-2026-004",
  // Le magasinier a signé : la pièce attend la LOGISTIQUE.
  signatures: { chefService1: "2026-10-01T09:00:00.000Z" },
  signataires: { chefService1: "Rakoto" },
  lignes: [
    {
      numeroOrdre: 1,
      designation: "Clavier AZERTY",
      espece: "Informatique",
      unite: "unité",
      quantite: 10,
      prixUnitaire: 25000,
      montant: 250000,
      nomenclature: "NOM-001",
      pieceJustificative: "",
      observation: "",
      etat: "neuf",
      conforme: true,
    },
    {
      numeroOrdre: 2,
      designation: "Écran 24 pouces",
      espece: "Informatique",
      unite: "unité",
      quantite: 5,
      prixUnitaire: 120000,
      montant: 600000,
      nomenclature: "NOM-003",
      pieceJustificative: "",
      observation: "Écran rayé sur la façade",
      etat: "defaillant",
      conforme: false,
    },
  ],
});

describe("Liste des pièces en attente — écran « rien à signer »", () => {
  it("chef logistique sans pièce actionnable : référence, étape bloquante et détail de l'entrée", () => {
    render(
      <PiecesEnAttente
        pieces={[
          { id: "1", reference: "ENT-2026-004", bloqueePar: "validation logistique" },
        ]}
        entrees={[entreeLogistique]}
      />
    );

    // Textes explicatifs conservés, au-dessus de la liste
    expect(
      screen.getByText("Aucune entrée n'attend votre signature")
    ).toBeTruthy();
    expect(
      screen.getByText(/L'écran se remettra à jour automatiquement/i)
    ).toBeTruthy();

    // Référence + étape bloquante : exactement comme avant…
    const ligne = screen.getByRole("button", { name: /ENT-2026-004/ });
    expect(within(ligne).getByText("ENT-2026-004")).toBeTruthy();
    expect(ligne.textContent).toContain("en attente : validation logistique");

    // … et la ligne est désormais enrichie (fournisseur, BL, lignes, valeur).
    expect(ligne.textContent).toContain("Société Ravit SARL");
    expect(ligne.textContent).toContain("BL-2026-0042");
    expect(ligne.textContent).toContain("2 ligne(s)");
    expect(ligne.textContent).toContain(montantAriary(850000));
  });

  it("un clic sur la référence ouvre le détail complet, en lecture seule", () => {
    render(
      <PiecesEnAttente
        pieces={[
          { id: "1", reference: "ENT-2026-004", bloqueePar: "validation logistique" },
        ]}
        entrees={[entreeLogistique]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ENT-2026-004/ }));

    // Le composant existant DetailEntreeTraitee affiche le détail complet.
    expect(screen.getByText(/Bon de livraison BL-2026-0042/)).toBeTruthy();
    expect(screen.getByText(/Société Ravit SARL/)).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Clavier AZERTY")).toBeTruthy();
    expect(within(table).getByText("10")).toBeTruthy();
    expect(within(table).getByText("Écran 24 pouces")).toBeTruthy();
    expect(within(table).getByText("Défaillant")).toBeTruthy();
    expect(within(table).getByText("Réserve")).toBeTruthy();

    // Circuit de signatures : les 3 SignataireChip, avec leur état réel.
    expect(screen.getByText("Circuit de signatures")).toBeTruthy();
    expect(screen.getByText("Magasinier :")).toBeTruthy();
    expect(screen.getByText("Chef logistique :")).toBeTruthy();
    expect(screen.getByText("Dépositaire :")).toBeTruthy();
    expect(screen.getByText(/signé par Rakoto/)).toBeTruthy();
    // Logistique et dépositaire n'ont pas encore signé.
    expect(screen.getAllByText("en attente")).toHaveLength(2);

    // Retour à la liste.
    fireEvent.click(screen.getByRole("button", { name: /Retour à la liste/ }));
    expect(screen.getByRole("button", { name: /ENT-2026-004/ })).toBeTruthy();
  });

  it("aucune action de signature ou de modification depuis cette vue", () => {
    render(
      <PiecesEnAttente
        pieces={[
          { id: "1", reference: "ENT-2026-004", bloqueePar: "validation logistique" },
        ]}
        entrees={[entreeLogistique]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /ENT-2026-004/ }));

    // Ni case de certification, ni signature, ni champ éditable : le seul
    // bouton est la navigation « Retour à la liste ».
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText(/certifie/i)).toBeNull();
    expect(screen.queryByText(/apposez/i)).toBeNull();
    expect(screen.queryByText(/Valider/i)).toBeNull();
    const boutons = screen.getAllByRole("button");
    expect(boutons).toHaveLength(1);
    expect(boutons[0].textContent).toContain("Retour à la liste");
  });

  it("comportement identique pour les autres rôles (magasinier, dépositaire)", () => {
    const cas: Array<{ role: string; bloqueePar: string; signatures?: EntreeRecord["signatures"] }> = [
      // Vue du MAGASINIER : la pièce est bloquée au contrôle magasinier.
      { role: "magasinier", bloqueePar: "contrôle magasinier" },
      // Vue du DÉPOSITAIRE : la pièce est bloquée à l'enregistrement.
      {
        role: "depositaire",
        bloqueePar: "validation finale du dépositaire",
        signatures: { chefService1: "2026-10-01T09:00:00.000Z", chefService2: "2026-10-01T10:00:00.000Z" },
      },
    ];

    for (const { role, bloqueePar, signatures } of cas) {
      const e = entree({ ...entreeLogistique, signatures });
      const { unmount } = render(
        <PiecesEnAttente
          pieces={[{ id: "1", reference: "ENT-2026-004", bloqueePar }]}
          entrees={[e]}
        />
      );

      const ligne = screen.getByRole("button", { name: /ENT-2026-004/ });
      expect(ligne.textContent).toContain(`en attente : ${bloqueePar}`);
      expect(ligne.textContent).toContain("Société Ravit SARL");
      expect(ligne.textContent).toContain("2 ligne(s)");

      // Le détail s'ouvre aussi pour ces rôles, et reste en lecture seule.
      fireEvent.click(ligne);
      expect(screen.getByText(/Bon de livraison BL-2026-0042/)).toBeTruthy();
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(role).toBeTruthy();

      unmount();
    }
  });

  it("non-régression : l'onglet « Articles traités » et DetailEntreeTraitee inchangés", () => {
    const traitee = entree({ ...entreeLogistique, statut: "Validée" });
    const onOuvrir = vi.fn();
    render(
      <ListeEntreesTraitees
        entrees={[traitee]}
        role="logistique"
        onOuvrir={onOuvrir}
      />
    );

    // Liste d'origine : référence, fournisseur, BL, nb de lignes, bouton.
    const table = screen.getByRole("table");
    expect(within(table).getByText("ENT-2026-004")).toBeTruthy();
    expect(within(table).getByText("Société Ravit SARL")).toBeTruthy();
    expect(within(table).getByText("BL-2026-0042")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Consulter/ }));
    expect(onOuvrir).toHaveBeenCalledWith(traitee);
  });

  it("non-régression : DetailEntreeTraitee isolé reste purement informatif", () => {
    render(
      <DetailEntreeTraitee
        entree={entreeLogistique}
        onRetour={() => {}}
      />
    );
    expect(screen.getByText(/Bon de livraison BL-2026-0042/)).toBeTruthy();
    expect(screen.getByText("Circuit de signatures")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});