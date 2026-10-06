// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Message } from "./message";
import { AlertTriangle, Info } from "lucide-react";

describe("Message — bandeau unifié", () => {
  afterEach(() => cleanup());

  it("applique la classe sémantique de la variante et le libellé accessible", () => {
    render(<Message variant="warning">Réserve signalée</Message>);
    const el = screen.getByRole("status");
    expect(el.className).toContain("msg");
    expect(el.className).toContain("msg--warning");
    expect(el.textContent).toContain("Réserve signalée");
  });

  it("reste lisible en thème sombre : plus de classe -950 inexistante", () => {
    // Régression : `dark:bg-amber-950/30` n'existe pas dans le CSS compilé,
    // ce qui laissait le fond crème clair en thème sombre.
    render(<Message variant="danger">Erreur</Message>);
    expect(screen.getByRole("alert").className).not.toMatch(/-950/);
  });

  it("distingue les rôles d'accessibilité danger (alert) et information (status)", () => {
    const { rerender } = render(<Message variant="danger">Erreur</Message>);
    expect(screen.queryByRole("alert")).not.toBeNull();

    rerender(<Message variant="success">Enregistré</Message>);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).not.toBeNull();
  });

  it("affiche le titre en gras et le texte en secondaire", () => {
    render(
      <Message variant="info" title="Titre">
        Détail
      </Message>,
    );
    expect(screen.getByText("Titre").className).toContain("msg-title");
    expect(screen.getByText("Détail").className).toContain("msg-text");
  });

  it("accepte une icône personnalisée et permet de la supprimer", () => {
    const { container, rerender } = render(
      <Message variant="info" icon={Info}>
        x
      </Message>,
    );
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(
      <Message variant="info" icon={AlertTriangle}>
        x
      </Message>,
    );
    expect(container.querySelector("svg")).not.toBeNull();

    rerender(
      <Message variant="info" icon={null}>
        x
      </Message>,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("applique la taille demandée et masque le message à l'impression", () => {
    const { rerender } = render(<Message size="sm">court</Message>);
    expect(screen.getByRole("status").className).toContain("msg--sm");

    rerender(
      <Message size="lg" printHidden>
        grand
      </Message>,
    );
    expect(screen.getByRole("status").className).toContain("msg--lg");
    expect(screen.getByRole("status").className).toContain("print-hidden");
  });

  it("transmet le className de mise en page sans le neutraliser", () => {
    // Regression : les classes .msg sont dans @layer components. Si elles
    // retrouvaient la cascade hors couche, `position: relative` l'emporterait
    // sur `fixed` et le toast de succes ne serait plus ancre en bas a droite.
    const { rerender } = render(
      <Message className="fixed bottom-6 right-6 z-50">Enregistré</Message>,
    );
    const el = screen.getByRole("status");
    expect(el.className).toContain("fixed");
    expect(el.className).toContain("bottom-6");

    rerender(<Message className="flex-col items-center">Erreur</Message>);
    expect(screen.getByRole("status").className).toContain("flex-col");
    expect(screen.getByRole("status").className).toContain("items-center");
  });
});
