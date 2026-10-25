//
// (5) RÈGLES PURES DE LA REMISE — payload, dates.
//
// Preuves :
//   R5 le payload porte deux champs au maximum (date_remise + mandataire_nom),
//      jamais un statut ni le stock ; le mandataire n'est envoyé que s'il est rempli ;
//   R6 « aujourd'hui » est calculé en HEURE LOCALE (jamais UTC) ;
//   R7 une date postérieure à aujourd'hui est détectée.
import { describe, expect, it } from "vitest";
import {
  construirePayloadRemise,
  dateDuJourLocal,
  dateEstDansLeFutur,
  estARemettre,
  estRemise,
} from "./remiseSortie";

describe("(5) règles pures de la remise", () => {
  it("R5 : le payload porte date_remise (+ mandataire_nom si rempli), jamais un statut ni le stock", () => {
    const payload = construirePayloadRemise({
      mandataireNom: "",
      dateRemise: "2026-10-20",
    });

    expect(Object.keys(payload).sort()).toEqual(["date_remise"]);
    expect(payload.date_remise).toBe("2026-10-20");
    expect("mandataire_nom" in payload).toBe(false);
    expect("statut" in payload).toBe(false);
    expect("stock" in payload).toBe(false);
  });

  it("R5 bis : le mandataire n'est envoyé que s'il est rempli", () => {
    const payload = construirePayloadRemise({
      mandataireNom: "   RASOANAIVO Naina  ",
      dateRemise: "2026-10-20",
    });

    expect(Object.keys(payload).sort()).toEqual(["date_remise", "mandataire_nom"]);
    expect(payload.mandataire_nom).toBe("RASOANAIVO Naina");
    expect(payload.date_remise).toBe("2026-10-20");
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

  it("Statuts : « Validée » attend la remise, « Sortie effectuée » est faite", () => {
    expect(estARemettre({ statut: "Validée" })).toBe(true);
    expect(estARemettre({ statut: "Sortie effectuée" })).toBe(false);
    expect(estRemise({ statut: "Sortie effectuée" })).toBe(true);
    expect(estRemise({ statut: "Validée" })).toBe(false);
  });
});
