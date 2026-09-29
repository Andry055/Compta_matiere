import { describe, it, expect } from "vitest";
import {
  nombreEnLettresFr,
  nombreEnLettresArticles,
  arrondirAriary,
} from "./nombreEnLettres";

describe("nombreEnLettresFr — cas de base", () => {
  it("0 → ZÉRO", () => {
    expect(nombreEnLettresFr(0)).toBe("ZÉRO");
  });

  it("1 → UN", () => {
    expect(nombreEnLettresFr(1)).toBe("UN");
  });

  it("21 → VINGT ET UN", () => {
    expect(nombreEnLettresFr(21)).toBe("VINGT ET UN");
  });

  it("71 → SOIXANTE ET ONZE", () => {
    expect(nombreEnLettresFr(71)).toBe("SOIXANTE ET ONZE");
  });

  it("80 → QUATRE-VINGTS", () => {
    expect(nombreEnLettresFr(80)).toBe("QUATRE-VINGTS");
  });

  it("81 → QUATRE-VINGT-UN", () => {
    expect(nombreEnLettresFr(81)).toBe("QUATRE-VINGT-UN");
  });

  it("100 → CENT", () => {
    expect(nombreEnLettresFr(100)).toBe("CENT");
  });

  it("200 → DEUX CENTS", () => {
    expect(nombreEnLettresFr(200)).toBe("DEUX CENTS");
  });

  it("201 → DEUX CENT UN (pas CENTS)", () => {
    expect(nombreEnLettresFr(201)).toBe("DEUX CENT UN");
  });

  it("1000 → MILLE (invariable, pas UN MILLE)", () => {
    expect(nombreEnLettresFr(1000)).toBe("MILLE");
  });

  it("2000 → DEUX MILLE", () => {
    expect(nombreEnLettresFr(2000)).toBe("DEUX MILLE");
  });

  it("1 000 000 → UN MILLION", () => {
    expect(nombreEnLettresFr(1_000_000)).toBe("UN MILLION");
  });

  it("2 000 000 → DEUX MILLIONS", () => {
    expect(nombreEnLettresFr(2_000_000)).toBe("DEUX MILLIONS");
  });

  it("1 000 000 000 → UN MILLIARD", () => {
    expect(nombreEnLettresFr(1_000_000_000)).toBe("UN MILLIARD");
  });
});

describe("nombreEnLettresFr — montants des modèles Excel", () => {
  it("1 777 192 634 (reste 2017)", () => {
    expect(nombreEnLettresFr(1_777_192_634)).toBe(
      "UN MILLIARD SEPT CENT SOIXANTE-DIX-SEPT MILLIONS CENT QUATRE-VINGT-DOUZE MILLE SIX CENT TRENTE-QUATRE"
    );
  });

  it("4 972 237 714 (reste 2020 arrondi)", () => {
    expect(nombreEnLettresFr(4_972_237_714)).toBe(
      "QUATRE MILLIARDS NEUF CENT SOIXANTE-DOUZE MILLIONS DEUX CENT TRENTE-SEPT MILLE SEPT CENT QUATORZE"
    );
  });
});

describe("nombreEnLettresFr — cas composés supplémentaires", () => {
  it("91 → QUATRE-VINGT-ONZE", () => {
    expect(nombreEnLettresFr(91)).toBe("QUATRE-VINGT-ONZE");
  });

  it("75 → SOIXANTE-QUINZE", () => {
    expect(nombreEnLettresFr(75)).toBe("SOIXANTE-QUINZE");
  });

  it("101 → CENT UN", () => {
    expect(nombreEnLettresFr(101)).toBe("CENT UN");
  });

  it("1 777 192 633,6 arrondi à l'Ariary → 1 777 192 634", () => {
    const arrondi = arrondirAriary(1_777_192_633.6);
    expect(arrondi).toBe(1_777_192_634);
    expect(nombreEnLettresFr(arrondi)).toBe(
      "UN MILLIARD SEPT CENT SOIXANTE-DIX-SEPT MILLIONS CENT QUATRE-VINGT-DOUZE MILLE SIX CENT TRENTE-QUATRE"
    );
  });

  it("3 268 880 140,996 arrondi → 3 268 880 141", () => {
    expect(arrondirAriary(3_268_880_140.996)).toBe(3_268_880_141);
  });

  it("négatif → MOINS …", () => {
    expect(nombreEnLettresFr(-21)).toBe("MOINS VINGT ET UN");
  });

  it("non fini → NÉANT", () => {
    expect(nombreEnLettresFr(NaN)).toBe("NÉANT");
    expect(nombreEnLettresFr(Infinity)).toBe("NÉANT");
  });
});

describe("nombreEnLettresArticles", () => {
  it("compte les articles en lettres", () => {
    expect(nombreEnLettresArticles(6)).toBe("SIX");
    expect(nombreEnLettresArticles(22)).toBe("VINGT-DEUX");
  });
});
