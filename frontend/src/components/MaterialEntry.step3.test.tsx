// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Step3SignatureLogistique } from "./MaterialEntry";
import type { ReceptionData } from "../types/accounting";

// vitest tourne ici sans `globals: true` : le nettoyage automatique de
// testing-library n'est donc pas actif, chaque rendu doit être isolé.
afterEach(cleanup);

/** Entrée de test : 3 lignes, dont une en réserve avec état « défaillant »
 *  et deux lignes conformes — c'est exactement ce que le magasinier aurait
 *  saisi à l'étape 2. */
function donneesTest(): ReceptionData {
  return {
    fournisseur: "Société Ravit SARL",
    numeroBL: "BL-2026-0042",
    dateBL: "2026-10-01",
    articles: [
      {
        id: "ligne-1",
        designation: "Clavier AZERTY",
        referenceNomenclature: "NOM-001",
        quantiteCommandee: 10,
        quantiteLivree: 10,
        prixUnitaire: 25000,
      },
      {
        id: "ligne-2",
        designation: "Souris sans fil",
        referenceNomenclature: "NOM-002",
        quantiteCommandee: 25,
        quantiteLivree: 25,
        prixUnitaire: 8000,
      },
      {
        id: "ligne-3",
        designation: "Écran 24 pouces",
        referenceNomenclature: "NOM-003",
        quantiteCommandee: 5,
        quantiteLivree: 5,
        prixUnitaire: 120000,
      },
    ],
    observationsBL: "Livraison effectuée le matin même.",
    controles: [
      { articleId: "ligne-1", etat: "neuf", conforme: true, remarque: "" },
      { articleId: "ligne-2", etat: "moyen", conforme: true, remarque: "" },
      {
        articleId: "ligne-3",
        etat: "defaillant",
        conforme: false,
        remarque: "Écran rayé sur la façade",
      },
    ],
    magasinierCertifie: true,
    depositaireCertifie: false,
    journalEntryId: "ENT-2026-001",
  };
}

function rendre() {
  return render(
    <Step3SignatureLogistique
      data={donneesTest()}
      logistiqueCertifie={false}
      onCertifier={vi.fn()}
    />
  );
}

/** Montant attendu comme l'affiche le composant. `toLocaleString("fr-MG")`
 *  insère une espace fine insécable (U+202F) : testing-library normalise le
 *  texte du DOM mais PAS la chaîne attendue, il faut donc appliquer le même
 *  remplacement de côté pour que la comparaison stricte passe. */
function montantAriary(valeur: number): string {
  return valeur.toLocaleString("fr-MG").replace(/\s/g, " ") + " Ar";
}

/** La carte « Détails des articles » est la seule à contenir l'en-tête
 *  « Réf. Nomenclature » : la table du PV (étape 4) en a un aussi mais elle
 *  n'est pas rendue ici. */
function tableArticles(): HTMLElement {
  return screen.getByRole("table", {
    name: /détails des articles/i,
  });
}

describe("Step3SignatureLogistique — enrichissement chef logistique", () => {
  it("affiche l'en-tête du BL (fournisseur, numéro, date, référence) en plus de la synthèse", () => {
    rendre();

    // En-tête BL
    expect(screen.getByText("Société Ravit SARL")).toBeTruthy();
    expect(screen.getByText("BL-2026-0042")).toBeTruthy();
    expect(screen.getByText("2026-10-01")).toBeTruthy();
    expect(screen.getByText("ENT-2026-001")).toBeTruthy();

    // La carte de synthèse existante est CONSERVÉE (non-régression)
    expect(screen.getByText(/Synthèse du contrôle physique/i)).toBeTruthy();
    expect(screen.getByText(/Articles conformes/i)).toBeTruthy();
  });

  it("affiche le tableau complet des articles avec état constaté et conformité", () => {
    rendre();

    const table = tableArticles();
    const lignes = within(table).getAllByRole("row");
    // 1 en-tête + 3 articles + 1 pied de tableau (TOTAL GÉNÉRAL)
    expect(lignes).toHaveLength(5);

    // Colonnes : celles du PV (étape 4) + les 2 ajoutées pour ce rôle.
    for (const entete of [
      "Désignation",
      "Réf. Nomenclature",
      "Quantité",
      "Prix unit.",
      "Valeur",
      "État constaté",
      "Conformité",
    ]) {
      expect(within(table).getByRole("columnheader", { name: entete })).toBeTruthy();
    }

    // Détail ligne par ligne : désignation, réf, quantité, prix, valeur
    const ligne1 = lignes[1];
    expect(within(ligne1).getByText("Clavier AZERTY")).toBeTruthy();
    expect(within(ligne1).getByText("NOM-001")).toBeTruthy();
    expect(within(ligne1).getByText("10")).toBeTruthy();
    expect(within(ligne1).getByText(montantAriary(25000))).toBeTruthy();
    expect(within(ligne1).getByText(montantAriary(250000))).toBeTruthy();

    // États constatés : badges ETAT_LABELS
    expect(within(lignes[1]).getByText("Neuf")).toBeTruthy();
    expect(within(lignes[2]).getByText("État moyen")).toBeTruthy();
    expect(within(lignes[3]).getByText("Défaillant")).toBeTruthy();

    // Conformité : « Conforme » / « Réserve »
    expect(within(lignes[1]).getByText("Conforme")).toBeTruthy();
    expect(within(lignes[2]).getByText("Conforme")).toBeTruthy();
    expect(within(lignes[3]).getByText("Réserve")).toBeTruthy();

    // Total cohérent avec les lignes
    expect(within(table).getByText("TOTAL GÉNÉRAL")).toBeTruthy();
  });

  it("reproduit exactement les données saisies par le magasinier, sans recalcul", () => {
    const data = donneesTest();
    render(
      <Step3SignatureLogistique
        data={data}
        logistiqueCertifie={false}
        onCertifier={vi.fn()}
      />
    );

    // Valeurs de la table === valeurs de data (pas de nouvelle formule).
    for (const article of data.articles) {
      const controle = data.controles.find((c) => c.articleId === article.id)!;
      const libelleEtat = {
        neuf: "Neuf",
        bon: "Bon état",
        moyen: "État moyen",
        defaillant: "Défaillant",
      }[controle.etat];
      expect(screen.getByText(libelleEtat)).toBeTruthy();
      expect(
        screen.getByText(
          montantAriary(article.quantiteLivree * article.prixUnitaire)
        )
      ).toBeTruthy();
    }
    // La remarque du magasinier reste visible via la liste des réserves.
    expect(screen.getByText(/Écran rayé sur la façade/)).toBeTruthy();
  });

  it("reste en lecture seule : aucun contrôle éditable dans le tableau", () => {
    rendre();

    const table = tableArticles();
    expect(within(table).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(table).queryAllByRole("spinbutton")).toHaveLength(0);
    expect(within(table).queryAllByRole("combobox")).toHaveLength(0);
    expect(within(table).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(table).queryAllByRole("button")).toHaveLength(0);

    // Le seul contrôle de la carte est la case de certification (hors table).
    const tableSynthese = screen.getByText(/Synthèse du contrôle physique/i);
    expect(tableSynthese).toBeTruthy();
  });

  it("non-régression : la case de certification logistique fonctionne toujours", () => {
    const onCertifier = vi.fn();
    const { rerender } = render(
      <Step3SignatureLogistique
        data={donneesTest()}
        logistiqueCertifie={false}
        onCertifier={onCertifier}
      />
    );

    const case_ = screen.getByRole("checkbox", {
      name: /Le chef logistique certifie la conformité du circuit/i,
    }) as HTMLButtonElement;
    expect(case_.getAttribute("data-state")).toBe("unchecked");
    expect(case_.getAttribute("aria-checked")).toBe("false");

    // Les réserves et la valeur totale de la synthèse sont intactes.
    expect(screen.getByText(/Réserves émises par le magasinier/i)).toBeTruthy();
    expect(screen.getByText(/Valeur totale de l'entrée/i)).toBeTruthy();

    rerender(
      <Step3SignatureLogistique
        data={donneesTest()}
        logistiqueCertifie={true}
        onCertifier={onCertifier}
      />
    );
    const coche = screen.getByRole("checkbox", {
      name: /Le chef logistique certifie la conformité du circuit/i,
    }) as HTMLButtonElement;
    expect(coche.getAttribute("data-state")).toBe("checked");
  });
});
