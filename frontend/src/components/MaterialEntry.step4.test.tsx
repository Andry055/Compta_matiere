// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Step4PVReception } from "./MaterialEntry";
import type { ReceptionData } from "../types/accounting";
import type { EntreeRecord } from "../lib/movements";

afterEach(cleanup);

const LIBELLE_CERTIFICATION = /Le dépositaire certifie l/i;

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
    ],
    observationsBL: "",
    controles: [{ articleId: "ligne-1", etat: "neuf", conforme: true, remarque: "" }],
    magasinierCertifie: true,
    depositaireCertifie: false,
    journalEntryId: "ENT-2026-018",
  };
}

function entreeServeur(): EntreeRecord {
  return {
    id: "doc-entree-18",
    reference: "ENT-2026-018",
    dateEntree: "2026-10-05",
    lignes: [],
    signatures: {
      chefService1: "2026-10-05T14:31:00.000Z",
      chefService2: "2026-10-05T14:35:00.000Z",
    },
    signataires: { chefService1: "Fara", chefService2: "Tojo" },
  } as unknown as EntreeRecord;
}

function rendre(peutCertifier: boolean, onChange: (d: Partial<ReceptionData>) => void = vi.fn()) {
  return render(
    <Step4PVReception
      data={donneesTest()}
      extra={{ estBrouillon: false, etatsNonControles: {} }}
      entreeServeur={entreeServeur()}
      magasinierName="Andriamampianina Fara"
      depositaireName="Rakotomalala Hery"
      logistiqueName="Razafindrakoto Tojo"
      onOpenJournal={vi.fn()}
      onChange={onChange}
      peutCertifier={peutCertifier}
      requiredRoleLabel="Dépositaire par service"
    />
  );
}

describe("Étape 4 — la certification de l'enregistrement est une action du Dépositaire", () => {
  it("elle est rendue et cochable pour le Dépositaire comptable", () => {
    const onChange = vi.fn();
    rendre(true, onChange);

    const case_ = screen.getByRole("checkbox", { name: LIBELLE_CERTIFICATION });
    expect(case_).toBeTruthy();
    expect(case_.getAttribute("data-state")).toBe("unchecked");
    expect(screen.queryByText(/Étape réservée au/i)).toBeNull();
  });

  it("elle n'est PAS affichée pour le chef logistique (lecture seule du PV)", () => {
    rendre(false);

    // Aucune case, et surtout aucune mention « Étape réservée au Dépositaire »
    // qui exposait au logistics une action qui n'est pas la sienne.
    expect(screen.queryByRole("checkbox", { name: LIBELLE_CERTIFICATION })).toBeNull();
    expect(screen.queryByText(LIBELLE_CERTIFICATION)).toBeNull();
    expect(screen.queryByText(/Étape réservée au/i)).toBeNull();
  });

  it("le PV porte la photo du contrôle magasinier dans la ligne de l'article", () => {
    const data = donneesTest();
    data.controles[0].photos = ["http://localhost:1337/uploads/ligne-1_1.jpg"];
    render(
      <Step4PVReception
        data={data}
        extra={{ estBrouillon: false, etatsNonControles: {} }}
        entreeServeur={entreeServeur()}
        magasinierName="Fara"
        depositaireName="Hery"
        logistiqueName="Tojo"
        onOpenJournal={vi.fn()}
        onChange={vi.fn()}
        peutCertifier={false}
        requiredRoleLabel="Dépositaire par service"
      />
    );

    const table = screen.getByText("Clavier AZERTY").closest("table")!;
    const image = within(table).getByAltText("Clavier AZERTY — photo 1");
    expect(image.getAttribute("src")).toBe(
      "http://localhost:1337/uploads/ligne-1_1.jpg"
    );
    // L'ancien bloc « Preuves photographiques » sous le tableau a disparu.
    expect(screen.queryByText(/Preuves photographiques/i)).toBeNull();
  });

  it("le PV reste intégralement consultable par les rôles non dépositaires", () => {
    rendre(false);

    // Le contenu documentaire reste visible : on cache une ACTION, pas le PV.
    expect(screen.getByText(/Clavier AZERTY/)).toBeTruthy();
    expect(screen.getByText(/Le Magasinier/)).toBeTruthy();
    expect(screen.getByText(/La Logistique/)).toBeTruthy();
    expect(screen.getByText(/Le Dépositaire Comptable/)).toBeTruthy();
  });
});