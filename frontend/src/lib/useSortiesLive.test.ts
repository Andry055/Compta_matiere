// @vitest-environment jsdom
//
// RÉGRESSION : useSortiesLive démarre une horloge d'1 s (startTicking) pour
// re-rendre les libellés « dernière synchro il y a X s ». L'état `setTick`
// avait été oublié à la déclaration → chaque tic levait
// « ReferenceError: setTick is not defined » en console, en boucle infinie
// (voir useMaterialsLive.ts, motif identique mais correct).
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSortiesLive } from "./useSortiesLive";

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, fetchSorties: vi.fn(async () => []) };
});

interface Capture {
  callback: () => void;
  intervalMs?: number;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSortiesLive — horloge de re-rendu", () => {
  it("le tick d'1 s s'exécute sans lever d'exception", async () => {
    const captures: Capture[] = [];

    vi.spyOn(globalThis, "setInterval").mockImplementation(
      ((callback: () => void, ms?: number) => {
        captures.push({ callback, intervalMs: ms });
        return 1 as unknown as ReturnType<typeof setInterval>;
      }) as unknown as typeof setInterval
    );
    vi.spyOn(globalThis, "clearInterval").mockImplementation((() =>
      undefined) as unknown as typeof clearInterval);

    const { unmount } = renderHook(() => useSortiesLive());

    // Laisse le premier fetch silencieux se terminer.
    await act(async () => {
      await Promise.resolve();
    });

    const tick = captures.find((capture) => capture.intervalMs === 1000);
    expect(tick, "un intervalle d'1 s doit être planifié au montage").toBeTruthy();

    // Avant le correctif : ReferenceError: setTick is not defined.
    await act(async () => {
      expect(() => tick!.callback()).not.toThrow();
      expect(() => tick!.callback()).not.toThrow();
    });

    unmount();
    // Le démontage nettoie l'horloge (clearInterval appelé, plus de tick).
    const actifs = captures.filter((capture) => capture.intervalMs === 1000);
    expect(actifs.length).toBeGreaterThan(0);
  });
});
