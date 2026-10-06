// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";
import { ENTREE_ADMIN_VIDE, type EntreeRecord } from "../lib/movements";
import { fetchEntrees } from "../lib/api";
import type { User } from "../App";

vi.mock("../lib/api", () => ({
  fetchEntrees: vi.fn(async () => [] as EntreeRecord[]),
}));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchEntrees).mockReset();
  vi.mocked(fetchEntrees).mockResolvedValue([]);
});

function utilisateur(role: User["role"]): User {
  return {
    id: "u1",
    name: "Test",
    email: "test@example.mg",
    role,
    department: "Informatique",
    permissions: [],
  };
}

function entree(p: Partial<EntreeRecord> & { id: string; reference: string }): EntreeRecord {
  return {
    dateEntree: "2026-10-01",
    materiel: "Clavier AZERTY",
    categorie: "Informatique",
    quantite: 3,
    fournisseur: "Rakoto & Fils",
    numeroFacture: "—",
    direction: "—",
    service: "—",
    statut: "En attente",
    responsable: "—",
    documents: [],
    lignes: [],
    statutServeur: "en_attente",
    signatures: {},
    admin: { ...ENTREE_ADMIN_VIDE, bonLivraison: "BL-2026-0042" },
    ...p,
  } as EntreeRecord;
}

function ouvrirPanel() {
  fireEvent.click(screen.getByTitle("Mes notifications"));
}

/** Compteur rouge de la cloche (badge), texte concaténé. */
function badge(): string {
  return screen.getByTitle("Mes notifications").textContent ?? "";
}

/**
 * La cloche du navbar est désormais l'unique point de notifications des trois
 * rôles du circuit de réception : elle doit exposer les actions en attente
 * (qui vivaient dans un second panneau, sur l'écran Arrivée Matériel) et
 * permettre d'ouvrir la pièce concernée en un clic.
 */
describe("Cloche du navbar — point unique de notifications", () => {
  it("liste les actions en attente du rôle connecté dans le panneau", async () => {
    vi.mocked(fetchEntrees).mockResolvedValue([
      entree({ id: "doc-1", reference: "ENT-2026-004" }),
    ]);

    render(<NotificationBell user={utilisateur("magasinier")} />);
    ouvrirPanel();

    expect(
      await screen.findByText("Nouveau bon de livraison à contrôler"),
    ).toBeTruthy();
    expect(
      screen.getByText(/L'entrée ENT-2026-004 \(BL BL-2026-0042\)/),
    ).toBeTruthy();
  });

  it("compte ces actions dans le badge de la cloche", async () => {
    vi.mocked(fetchEntrees).mockResolvedValue([
      entree({ id: "doc-1", reference: "ENT-2026-004" }),
      entree({ id: "doc-2", reference: "ENT-2026-005" }),
    ]);

    render(<NotificationBell user={utilisateur("magasinier")} />);
    ouvrirPanel();

    await screen.findAllByText("Nouveau bon de livraison à contrôler");
    // 2 actions en attente + les 3 notifications d'information non lues.
    expect(badge()).toContain("5");
  });

  it("ouvre la pièce visée par la notification (un clic, un seul)", async () => {
    vi.mocked(fetchEntrees).mockResolvedValue([
      entree({ id: "doc-7", reference: "ENT-2026-004" }),
    ]);
    const onOpenEntree = vi.fn();

    render(
      <NotificationBell user={utilisateur("magasinier")} onOpenEntree={onOpenEntree} />,
    );
    ouvrirPanel();

    fireEvent.click(
      await screen.findByText("Nouveau bon de livraison à contrôler"),
    );
    expect(onOpenEntree).toHaveBeenCalledTimes(1);
    expect(onOpenEntree).toHaveBeenCalledWith("doc-7");
    // Le panneau se referme pour ne pas masquer la pièce ouverte.
    expect(screen.queryByText("Nouveau bon de livraison à contrôler")).toBeNull();
  });

  it("relit le serveur à chaque ouverture (pièce déjà traitée chez un autre poste)", async () => {
    vi.mocked(fetchEntrees).mockResolvedValue([]);
    render(<NotificationBell user={utilisateur("depositaire")} />);

    ouvrirPanel();
    await screen.findByText("Informations");
    ouvrirPanel();
    ouvrirPanel();

    await waitFor(() => expect(fetchEntrees).toHaveBeenCalledTimes(3));
  });

  it("n'appelle pas le serveur pour un rôle hors circuit de réception", async () => {
    render(<NotificationBell user={utilisateur("demandeur")} />);
    ouvrirPanel();

    await screen.findByText("Informations");
    expect(fetchEntrees).not.toHaveBeenCalled();
    expect(screen.queryByText(/^En attente —/)).toBeNull();
  });

  it("affiche le rôle en attente dans l'en-tête de la section", async () => {
    vi.mocked(fetchEntrees).mockResolvedValue([
      entree({
        id: "doc-1",
        reference: "ENT-2026-004",
        statutServeur: "verifiee",
        signatures: { chefService1: "2026-10-05T09:00:00.000Z" },
      }),
    ]);

    render(<NotificationBell user={utilisateur("logistique")} />);
    ouvrirPanel();

    expect(
      await screen.findByText(/En attente — Chef logistique/),
    ).toBeTruthy();
    expect(
      screen.getByText("Entrée contrôlée — signature logistique attendue"),
    ).toBeTruthy();
  });
});