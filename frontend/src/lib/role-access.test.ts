import { describe, expect, it } from "vitest";
import {
  canPerformStepAction,
  guardReceptionUpdate,
  STEP_ROLE_REQUIREMENTS,
} from "./role-access";

// Non-régression du correctif « le dépositaire ne peut jamais signer la
// validation finale » : la case de certification vit à l'ÉTAPE 4 et le champ
// `depositaireCertifie` est protégé par cette même étape. Tant qu'il était
// rattaché à l'étape 3 (réservée à la logistique), guardReceptionUpdate
// refusait la coche au dépositaire même depuis l'étape 4 : la case restait
// affichée mais l'état ne changeait jamais et le bouton de signature finale
// demeurait bloqué.
describe("guardReceptionUpdate — certification du dépositaire (étape 4)", () => {
  it("autorise le dépositaire à cocher depositaireCertifie", () => {
    const guard = guardReceptionUpdate(
      { depositaireCertifie: true },
      "depositaire"
    );
    expect(guard.allowed).toBe(true);
  });

  it("refuse la logistique (étape 3 ne lui appartient plus)", () => {
    const guard = guardReceptionUpdate(
      { depositaireCertifie: true },
      "logistique"
    );
    expect(guard.allowed).toBe(false);
    expect(guard.deniedStep).toBe(4);
    expect(guard.requiredRole).toBe("depositaire");
  });

  it("refuse le magasinier", () => {
    expect(
      guardReceptionUpdate({ depositaireCertifie: true }, "magasinier").allowed
    ).toBe(false);
  });

  it("n'autorise que le dépositaire à agir sur l'étape 4", () => {
    expect(canPerformStepAction("depositaire", 4)).toBe(true);
    expect(canPerformStepAction("magasinier", 4)).toBe(false);
    expect(canPerformStepAction("logistique", 4)).toBe(false);
    expect(STEP_ROLE_REQUIREMENTS[4]).toBe("depositaire");
  });
});

describe("guardReceptionUpdate — non-régression des autres étapes", () => {
  it("le magasinier reste seul propriétaire des contrôles et de sa certification", () => {
    expect(
      guardReceptionUpdate({ magasinierCertifie: true }, "magasinier").allowed
    ).toBe(true);
    expect(
      guardReceptionUpdate({ controles: [] }, "magasinier").allowed
    ).toBe(true);
    expect(
      guardReceptionUpdate({ magasinierCertifie: true }, "depositaire").allowed
    ).toBe(false);
    expect(guardReceptionUpdate({ controles: [] }, "depositaire").allowed).toBe(
      false
    );
  });

  it("le dépositaire reste seul propriétaire du bon de livraison (étape 1)", () => {
    expect(
      guardReceptionUpdate(
        { fournisseur: "X", numeroBL: "BL-1", dateBL: "2026-01-01" },
        "depositaire"
      ).allowed
    ).toBe(true);
    expect(
      guardReceptionUpdate({ numeroBL: "BL-1" }, "magasinier").allowed
    ).toBe(false);
  });

  it("la logistique reste seule à l'étape 3", () => {
    expect(canPerformStepAction("logistique", 3)).toBe(true);
    expect(canPerformStepAction("depositaire", 3)).toBe(false);
    expect(canPerformStepAction("magasinier", 3)).toBe(false);
  });
});
