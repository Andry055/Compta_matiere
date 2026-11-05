import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener() {}

  close() {
    this.readyState = 2;
  }

  open() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  fail() {
    this.onerror?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", MockEventSource);
  MockEventSource.instances = [];
});

afterEach(async () => {
  const { disconnectSSE } = await import("./sseNotifications");
  disconnectSSE();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("reconnexion SSE", () => {
  it("réessaie avec un délai progressif et reprend après une coupure du backend", async () => {
    const { connectSSE } = await import("./sseNotifications");
    connectSSE(42, "test-jwt");

    MockEventSource.instances[0].fail();
    await vi.advanceTimersByTimeAsync(999);
    expect(MockEventSource.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockEventSource.instances).toHaveLength(2);

    MockEventSource.instances[1].fail();
    await vi.advanceTimersByTimeAsync(1999);
    expect(MockEventSource.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockEventSource.instances).toHaveLength(3);

    MockEventSource.instances[2].open();
    MockEventSource.instances[2].fail();
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it("annule une reconnexion différée à la déconnexion", async () => {
    const { connectSSE, disconnectSSE } = await import("./sseNotifications");
    connectSSE(42, "test-jwt");
    MockEventSource.instances[0].fail();

    disconnectSSE();
    await vi.advanceTimersByTimeAsync(30000);

    expect(MockEventSource.instances).toHaveLength(1);
  });
});
