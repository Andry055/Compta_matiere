//
// (5) RÈGLES PURES DE LA REMISE — proposition de détenteur, payload, dates.
//
// Preuves :
//   R1 le détenteur est proposé quand le référentiel relie un responsable au
//      service destinataire ;
//   R2 le détenteur est proposé quand SEULE la direction correspond
//      (responsable de repli) ;
//   R3 AUCUNE proposition quand rien ne correspond : les champs restent
//      vides et l'utilisateur saisit ;
//   R4 la comparaison ignore casse, accents et espaces ;
//   R5 le payload porte QUATRE champs, jamais un statut ni le stock ; le
//      mandataire n'est envoyé que s'il est rempli ;
//   R6 « aujourd'hui » est calculé en HEURE LOCALE (jamais UTC) ;
//   R7 une date postérieure à aujourd'hui est détectée.
import { describe, expect, it } from "vitest";
import {
  construirePayloadRemise,
  dateDuJourLocal,
  dateEstDansLeFutur,
  estARemettre,
  estRemise,
  personnesDepuisReferentiel,
  proposerDetenteur,
  type CandidatDetenteur,
} from "./remiseSortie";
import type { RefOption } from "./api";

const sortie = {
  direction: "Direction Informatique",
  serviceDemandeur: "Service Informatique",
};

const personnes: CandidatDetenteur[] = [
  {
    nom: "RAKOTOMALALA Hery",
    fonction: "Dépositaire",
    direction: "Direction Informatique",
    service: "Service Informatique",
  },
  {
    nom: "ANDRIANARISOA Hanta",
    fonction: "Directeur",
    direction: "Direction Informatique",
  },
];

describe("(5) proposition du détenteur", () => {
  it("R1 : le dépositaire du service destinataire est proposé", () => {
    const proposition = proposerDetenteur(sortie, personnes);

    expect(proposition).not.toBeNull();
    expect(proposition?.nom).toBe("RAKOTOMALALA Hery");
    expect(proposition?.fonction).toBe("Dépositaire");
  });

  it("R2 : à défaut de service, le responsable de la direction est proposé", () => {
    const proposition = proposerDetenteur(
      { direction: "Direction Informatique", serviceDemandeur: "Service Inconnu" },
      personnes
    );

    expect(proposition?.nom).toBe("ANDRIANARISOA Hanta");
    expect(proposition?.fonction).toBe("Directeur");
  });

  it("R3 : aucune donnée ne reliant un compte à la destination → aucune proposition", () => {
    expect(
      proposerDetenteur(
        { direction: "Direction Inconnue", serviceDemandeur: "Service Inconnu" },
        personnes
      )
    ).toBeNull();
    // Référentiel vide : idem.
    expect(proposerDetenteur(sortie, [])).toBeNull();
  });

  it("R4 : la comparaison ignore la casse, les accents et les espaces", () => {
    const proposition = proposerDetenteur(
      { direction: "direction informatique", serviceDemandeur: "  SERVICE   Informatique " },
      [{ nom: "RAKOTOMALALA Hery", fonction: "Dépositaire", service: "Service Informatique" }]
    );

    expect(proposition?.nom).toBe("RAKOTOMALALA Hery");
  });

  it("R5 : le payload porte quatre champs — jamais un statut, jamais le stock", () => {
    const payload = construirePayloadRemise({
      detenteurNom: "  RAKOTOMALALA Hery  ",
      detenteurFonction: " Dépositaire ",
      mandataireNom: "",
      dateRemise: "2026-10-20",
    });

    expect(Object.keys(payload).sort()).toEqual([
      "date_remise",
      "detenteur_fonction",
      "detenteur_nom",
    ]);
    expect(payload.detenteur_nom).toBe("RAKOTOMALALA Hery");
    expect(payload.detenteur_fonction).toBe("Dépositaire");
    expect(payload.date_remise).toBe("2026-10-20");
    expect("mandataire_nom" in payload).toBe(false);
    expect("statut" in payload).toBe(false);
    expect("stock" in payload).toBe(false);
  });

  it("R5 bis : le mandataire n'est envoyé que s'il est rempli", () => {
    const payload = construirePayloadRemise({
      detenteurNom: "RAKOTOMALALA Hery",
      detenteurFonction: "Dépositaire",
      mandataireNom: "   RASOANAIVO Naina  ",
      dateRemise: "2026-10-20",
    });

    expect(Object.keys(payload).sort()).toEqual([
      "date_remise",
      "detenteur_fonction",
      "detenteur_nom",
      "mandataire_nom",
    ]);
    expect(payload.mandataire_nom).toBe("RASOANAIVO Naina");
  });

  it("R6 : « aujourd'hui » est la date LOCALE (à 23 h 30 UTC, on est déjà le lendemain)", () => {
    const instant = new Date("2026-10-20T23:30:00Z");

    const jour = dateDuJourLocal(instant);

    // La machine est en Indian/Antananarivo (UTC+3) : 23 h 30 UTC = 02 h 30
    // le lendemain. Un calcul UTC donnerait 2026-10-20 — c'est exactement le
    // décalage que la date de remise ne doit pas subir.
    expect(jour).toBe("2026-10-21");
    expect(jour).not.toBe(instant.toISOString().slice(0, 10));
  });

  it("R7 : une date postérieure à aujourd'hui est détectée", () => {
    expect(dateEstDansLeFutur("2026-10-21", "2026-10-20")).toBe(true);
    expect(dateEstDansLeFutur("2026-10-20", "2026-10-20")).toBe(false);
    expect(dateEstDansLeFutur("2026-10-19", "2026-10-20")).toBe(false);
    expect(dateEstDansLeFutur("pas une date", "2026-10-20")).toBe(false);
  });

  it("R8 : le référentiel produit des candidats et les statuts sont bien distincts", () => {
    const services: RefOption[] = [
      {
        documentId: "svc-1",
        nom: "Service Informatique",
        directionId: "dir-1",
        depositaire: "RAKOTOMALALA Hery",
      },
    ];
    const directions: RefOption[] = [
      { documentId: "dir-1", nom: "Direction Informatique", directeur: "ANDRIANARISOA Hanta" },
    ];

    const candidats = personnesDepuisReferentiel(services, directions);

    expect(candidats).toHaveLength(2);
    expect(candidats[0]).toEqual({
      nom: "RAKOTOMALALA Hery",
      fonction: "Dépositaire",
      direction: "Direction Informatique",
      service: "Service Informatique",
    });
    expect(candidats[1].nom).toBe("ANDRIANARISOA Hanta");

    // Statuts : « Validée » attend la remise, « Sortie effectuée » est faite.
    expect(estARemettre({ statut: "Validée" })).toBe(true);
    expect(estARemettre({ statut: "Sortie effectuée" })).toBe(false);
    expect(estRemise({ statut: "Sortie effectuée" })).toBe(true);
    expect(estRemise({ statut: "Validée" })).toBe(false);
  });
});
