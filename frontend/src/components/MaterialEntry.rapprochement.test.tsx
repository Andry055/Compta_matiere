// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  Step1BonLivraison,
  lignesPayloadDepuisArticles,
} from "./MaterialEntry";
import { API_URL, api, MaterialOption, signerEntree } from "../lib/api";
import { STEP_ROLE_REQUIREMENTS, canPerformStepAction } from "../lib/role-access";
import { NOMENCLATURES } from "../lib/nomenclature";
import type { BonLivraisonArticle, ReceptionData } from "../types/accounting";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

/** Matériel déjà en base : désignation SANS espace avant le modèle. */
const ROUTEUR_EXISTANT: MaterialOption = {
  documentId: "doc-rv340",
  id: 7,
  designation: "Routeur Cisco RV340",
  nomenclature: "05",
  quantiteStock: 4,
  photos: ["/uploads/materiel_7.jpg"],
};

function donnees(article: Partial<BonLivraisonArticle> = {}): ReceptionData {
  return {
    fournisseur: "Établissements Rakoto & Fils",
    numeroBL: "BL-2026-0147",
    dateBL: "2026-10-06",
    articles: [
      {
        id: "art-1",
        designation: "",
        referenceNomenclature: "",
        nomenclature: "",
        quantiteCommandee: 1,
        quantiteLivree: 1,
        prixUnitaire: 0,
        ...article,
      },
    ],
    observationsBL: "",
    controles: [],
    magasinierCertifie: false,
    depositaireCertifie: false,
    journalEntryId: "",
  };
}

/** Écran d'état : les changements passés à onChange sont RÉELLEMENT appliqués
 *  (la saisie vit dans le state du dépositaire), comme en production. */
let derniereDonnees: ReceptionData;
function Saisie({
  materiels,
  initial,
}: {
  materiels: MaterialOption[];
  initial: ReceptionData;
}) {
  const [data, setData] = useState<ReceptionData>(initial);
  derniereDonnees = data;
  return (
    <Step1BonLivraison
      data={data}
      onChange={(partiel) => setData((d) => ({ ...d, ...partiel }))}
      canEdit
      requiredRoleLabel="Dépositaire par service"
      materiels={materiels}
    />
  );
}

// L'écran rend une version bureau (table) ET une version mobile (cartes) pour
// CHAQUE article : tous les éléments existent en double dans le DOM. On prend
// le premier rencontré — les deux partagent le même état.
function premier<T>(elements: T[]): T {
  expect(elements.length).toBeGreaterThan(0);
  return elements[0];
}

function saisirDesignation(texte: string) {
  fireEvent.change(
    premier(screen.getAllByPlaceholderText<HTMLInputElement>("Désignation")),
    { target: { value: texte } }
  );
}

function choisirNomenclature(valeur: string) {
  fireEvent.change(
    premier(
      screen.getAllByLabelText<HTMLSelectElement>("Nomenclature de l'article 1")
    ),
    { target: { value: valeur } }
  );
}

function bouton(texte: RegExp | string): HTMLElement {
  return premier(screen.getAllByRole("button", { name: texte }));
}

let postSpy: ReturnType<typeof vi.fn>;
let getSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  postSpy = vi.spyOn(api, "post");
  getSpy = vi.spyOn(api, "get");
});

describe("Saisie étape 1 — rapprochement fiable de la désignation", () => {
  it("1. une désignation proche d'un matériel existant déclenche une suggestion", () => {
    render(<Saisie materiels={[ROUTEUR_EXISTANT]} initial={donnees()} />);

    // Texte saisi par le dépositaire : espace avant le modèle.
    saisirDesignation("Routeur Cisco RV 340");

    expect(
      screen.getAllByTestId("suggestion-rapprochement-art-1").length
    ).toBeGreaterThan(0);
    // La proposition cite le matériel existant, son stock, et pose la question.
    expect(
      screen.getAllByText(/Ce matériel ressemble à/).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Routeur Cisco RV340").length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/4 unités/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/s'agit-il du même article/).length
    ).toBeGreaterThan(0);
    // Les DEUX décisions sont proposées — jamais appliquées seules.
    expect(bouton("Oui, c'est le même article")).toBeTruthy();
    expect(bouton("Non, c'est un nouvel article")).toBeTruthy();
    expect(derniereDonnees.articles[0].materielId).toBeUndefined();

    // La photo de la fiche sert à comparer visuellement avant de trancher.
    const apercu = screen.getAllByAltText(
      "Routeur Cisco RV340 — photo de référence"
    )[0];
    expect(apercu.getAttribute("src")).toBe(
      `${API_URL}/uploads/materiel_7.jpg`
    );
  });

  it("2. confirmer le rapprochement rattache la ligne au matériel existant dans le payload", () => {
    render(<Saisie materiels={[ROUTEUR_EXISTANT]} initial={donnees()} />);
    saisirDesignation("Routeur Cisco RV 340");

    fireEvent.click(bouton("Oui, c'est le même article"));

    // Retour visuel : la ligne est explicitement rattachée.
    expect(
      screen.getAllByTestId("rapprochement-lie-art-1").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Lié au matériel existant/).length
    ).toBeGreaterThan(0);
    // La nomenclature de la fiche est reprise sur la ligne (cohérence).
    expect(derniereDonnees.articles[0].materielId).toBe("doc-rv340");
    expect(derniereDonnees.articles[0].nomenclature).toBe("05");

    // C'est CE payload qui part à la création de l'entrée : la relation
    // entree_ligne → material est posée dès la saisie, pas à la 3ᵉ signature.
    const lignes = lignesPayloadDepuisArticles(derniereDonnees.articles);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].materiel_id).toBe("doc-rv340");
    expect(lignes[0].designation).toBe("Routeur Cisco RV 340");
    expect(lignes[0].nomenclature).toBe("05");
    // Article EXISTANT confirmé : aucune création de fiche.
    expect(postSpy).not.toHaveBeenCalled();

    // Après rechargement, la décision est reprise — plus de question posée.
    cleanup();
    render(
      <Saisie
        materiels={[ROUTEUR_EXISTANT]}
        initial={donnees({
          designation: "Routeur Cisco RV 340",
          materielId: "doc-rv340",
          materielLien: "existant",
          materielDesignationLiee: "Routeur Cisco RV 340",
          nomenclature: "05",
        })}
      />
    );
    expect(
      screen.queryAllByTestId("suggestion-rapprochement-art-1")
    ).toHaveLength(0);
    expect(
      screen.getAllByTestId("rapprochement-lie-art-1").length
    ).toBeGreaterThan(0);
  });

  it("3. refuser le rapprochement crée immédiatement une fiche avec la nomenclature choisie", async () => {
    postSpy.mockResolvedValue({
      data: {
        data: {
          id: 42,
          documentId: "doc-nouveau",
          designation: "Routeur Cisco RV 340",
          nomenclature: "05",
        },
      },
    } as never);

    render(<Saisie materiels={[ROUTEUR_EXISTANT]} initial={donnees()} />);
    saisirDesignation("Routeur Cisco RV 340");

    // Sans nomenclature : AUCUNE création (pas de fiche sans classement).
    fireEvent.click(bouton("Non, c'est un nouvel article"));
    expect(postSpy).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(/Sélectionnez d'abord la nomenclature/).length
    ).toBeGreaterThan(0);

    // Nomenclature choisie dans la liste de référence → création possible.
    choisirNomenclature("05");
    fireEvent.click(bouton("Non, c'est un nouvel article"));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const [chemin, corps] = postSpy.mock.calls[0];
    expect(chemin).toBe("/api/materials");
    expect(corps).toEqual({
      data: { designation: "Routeur Cisco RV 340", nomenclature: "05" },
    });

    // La fiche créée devient LA fiche de la ligne : plus aucune ligne en
    // désignation libre.
    await waitFor(() =>
      expect(
        screen.getAllByTestId("rapprochement-nouveau-art-1").length
      ).toBeGreaterThan(0)
    );
    expect(derniereDonnees.articles[0].materielId).toBe("doc-nouveau");
    expect(
      lignesPayloadDepuisArticles(derniereDonnees.articles)[0].materiel_id
    ).toBe("doc-nouveau");
  });

  it("4. la liste déroulante de nomenclature propose les 3 codes historiques avec leurs libellés", () => {
    render(
      <Saisie
        materiels={[]}
        initial={donnees({ designation: "Chaise de bureau ergonomique" })}
      />
    );

    const select = premier(
      screen.getAllByLabelText<HTMLSelectElement>(
        "Nomenclature de l'article 1"
      )
    );
    const textes = Array.from(select.querySelectorAll("option")).map(
      (o) => o.textContent?.trim() || ""
    );

    expect(textes).toHaveLength(1 + NOMENCLATURES.length); // « choisir » + 3
    expect(textes[0]).toBe("— choisir —");
    // Les 3 codes du modèle historique, avec leur libellé.
    expect(textes[1]).toContain("03");
    expect(textes[1]).toContain("Mobilier");
    expect(textes[2]).toContain("05");
    expect(textes[2]).toContain("informatique");
    expect(textes[3]).toContain("10");
    expect(textes[3]).toContain("ixe");
    // La liste est celle de la référence (jamais un champ libre).
    expect(NOMENCLATURES.map((n) => n.code)).toEqual(["03", "05", "10"]);

    // La valeur choisie alimente la ligne d'entrée.
    choisirNomenclature("10");
    expect(derniereDonnees.articles[0].nomenclature).toBe("10");
    const lignes = lignesPayloadDepuisArticles(derniereDonnees.articles);
    expect(lignes[0].nomenclature).toBe("10");
    // « Référence » reste indépendante : un texte libre ne devient pas une
    // nomenclature.
    expect(lignes[0].reference).toBeUndefined();
    // Aucun appel réseau : la liste est une constante du code.
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("7. non-régression : circuit de signature à 4 étapes et liaison stock inchangés", async () => {
    // a) Les 4 étapes et leurs rôles sont intacts (dépositaire → magasinier →
    //    logistique → dépositaire).
    expect(Object.keys(STEP_ROLE_REQUIREMENTS).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(STEP_ROLE_REQUIREMENTS[1]).toBe("depositaire");
    expect(STEP_ROLE_REQUIREMENTS[2]).toBe("magasinier");
    expect(STEP_ROLE_REQUIREMENTS[3]).toBe("logistique");
    expect(STEP_ROLE_REQUIREMENTS[4]).toBe("depositaire");
    expect(canPerformStepAction("magasinier", 2)).toBe(true);
    expect(canPerformStepAction("magasinier", 4)).toBe(false);

    // b) Une ligne SANS décision garde EXACTEMENT le payload historique : pas
    //    de materiel_id, pas de nomenclature forcée → le serveur retrouve son
    //    rapprochement exact et appliquerImpactStock (3ᵉ signature) s'en
    //    charge comme avant. Le nouveau mécanisme ne REMPLACE rien.
    render(
      <Saisie
        materiels={[]}
        initial={
          donnees({
            designation: "Chaise de bureau ergonomique",
            referenceNomenclature: "",
            nomenclature: "",
          })
        }
      />
    );
    expect(lignesPayloadDepuisArticles(derniereDonnees.articles)).toEqual([
      {
        numero_ordre: 1,
        designation: "Chaise de bureau ergonomique",
        quantite: 1,
        valeur_unitaire: 0,
      },
    ]);

    // c) Le contrat de signature (4 étapes = 3 signatures serveur) est intact.
    postSpy.mockResolvedValue({ data: { data: {}, meta: {} } } as never);
    await signerEntree("doc-entree-1", "chef_service_1", [
      { numero_ordre: 1, etat: "neuf" as never, conforme: true },
    ]);
    const [chemin, corps] = postSpy.mock.calls.at(-1)!;
    expect(chemin).toBe("/api/entrees/doc-entree-1/sign");
    expect(corps).toEqual({
      data: {
        role: "chef_service_1",
        controles: [{ numero_ordre: 1, etat: "neuf", conforme: true }],
      },
    });
    expect(String(chemin)).not.toContain("upload");
  });
});
