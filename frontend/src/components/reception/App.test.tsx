// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import App from "../../App";

vi.mock("../../lib/api", () => ({
  clearStrapiSession: vi.fn(),
  fetchNotificationsOutbox: vi.fn(async () => []),
  fetchSessionRole: vi.fn(async () => null),
  getStrapiJwt: vi.fn(() => "fake-jwt"),
  getStrapiAuthUser: vi.fn(() => null),
}));

vi.mock("../../lib/session", () => ({
  mapStrapiUser: vi.fn(() => null),
}));

vi.mock("../../lib/sseNotifications", () => ({
  connectSSE: vi.fn(),
  disconnectSSE: vi.fn(),
  onSSEEvent: vi.fn(),
}));

vi.mock("../../lib/notifications", () => ({
  pushRealtimeNotification: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../components/AuthGuard", () => ({
  AuthGuard: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock("../../components/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock("../../components/StaffDashboardLayout", () => ({
  StaffDashboardLayout: ({ children }: { children: any }) => <>{children}</>,
}));

vi.mock("../../components/LoginScreen", () => ({
  LoginScreen: () => <div>LoginScreen</div>,
}));

import { fetchNotificationsOutbox } from "../../lib/api";
import { connectSSE, onSSEEvent } from "../../lib/sseNotifications";
import { pushRealtimeNotification } from "../../lib/notifications";
import { toast } from "sonner";

const magasinierUser = {
  id: "1",
  strapiId: 1,
  name: "Magasinier Test",
  email: "magasinier@test.com",
  role: "magasinier",
  department: "DRH",
  permissions: [],
  directionId: "d_drh",
};

let sseCallback: ((event: any) => void) | null = null;

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem("currentUser", JSON.stringify(magasinierUser));
  localStorage.setItem("loginTime", Date.now().toString());

  sseCallback = null;
  vi.mocked(onSSEEvent).mockImplementation((callback: (event: any) => void) => {
    sseCallback = callback;
    return vi.fn();
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("App.tsx — événement SSE ordre_sortie_autorise", () => {
  it("connecte le SSE pour un magasinier et capture le callback d'événement", async () => {
    render(<App />);

    await waitFor(() => {
      expect(sseCallback).not.toBeNull();
    });

    expect(vi.mocked(connectSSE)).toHaveBeenCalledWith(1, "fake-jwt");
  });

  it("affiche 'Réception confirmée' quand le message indique une réception physique", async () => {
    render(<App />);

    await waitFor(() => {
      expect(sseCallback).not.toBeNull();
    });

    sseCallback!({
      type: "ordre_sortie_autorise",
      data: {
        reference: "SOR-2026-001",
        date_sortie: "2026-10-25T10:00:00.000Z",
        direction: "DRH",
        message: "La réception physique de la sortie SOR-2026-001 a été confirmée par le dépositaire.",
      },
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Réception confirmée", expect.objectContaining({
        description: expect.stringContaining("réception physique"),
      }));
    });
  });

  it("affiche 'Ordre autorisé' quand le message ne mentionne pas la réception physique", async () => {
    render(<App />);

    await waitFor(() => {
      expect(sseCallback).not.toBeNull();
    });

    sseCallback!({
      type: "ordre_sortie_autorise",
      data: {
        reference: "SOR-2026-001",
        date_sortie: "2026-10-25T10:00:00.000Z",
        direction: "DRH",
        message: "Un ordre de sortie est autorisé à la sortie.",
      },
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Ordre autorisé", expect.anything());
    });
  });

  it("réconcilie les notifications outbox pour le magasinier à la connexion", async () => {
    vi.mocked(fetchNotificationsOutbox).mockResolvedValue([
      { id: "N-1", createdAt: "2026-10-25T10:00:00.000Z", payload: { message: "Réception en attente" } },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(sseCallback).not.toBeNull();
    });

    await waitFor(() => {
      expect(fetchNotificationsOutbox).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(pushRealtimeNotification).toHaveBeenCalledWith(
        "sortie",
        "Réception en attente",
        expect.any(String),
        "outbox-N-1",
        "magasinier"
      );
    });
  });
});
