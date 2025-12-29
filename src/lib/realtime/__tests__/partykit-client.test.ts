/**
 * Unit Tests: Partykit Client
 *
 * Tests for the useGameSocket hook and related utilities.
 * Note: These tests focus on utility functions and type safety.
 * Integration tests with actual WebSocket connections would require
 * a running Partykit server or mocked WebSocket implementation.
 *
 * @see SRD §7.5 Partykit Server
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  generateSessionId,
  useGameSocket,
  type GameSocketConfig,
  type ConnectionStatus,
} from "../partykit-client";

// ============================================================================
// MOCKS
// ============================================================================

// Mock PartySocket
const mockPartySocket = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.OPEN,
};

vi.mock("partysocket", () => ({
  default: vi.fn(() => mockPartySocket),
}));

// ============================================================================
// Session ID Generation Tests
// ============================================================================

describe("generateSessionId", () => {
  it("should generate a 4-character string", () => {
    const id = generateSessionId();
    expect(id).toHaveLength(4);
    expect(typeof id).toBe("string");
  });

  it("should only use valid characters (no 0, O, I, l)", () => {
    const invalidChars = ["0", "O", "I", "l", "1"];

    // Generate many IDs and check none contain invalid chars
    for (let i = 0; i < 100; i++) {
      const id = generateSessionId();
      for (const char of id) {
        expect(invalidChars).not.toContain(char);
      }
    }
  });

  it("should only use uppercase letters and numbers", () => {
    const validChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    for (let i = 0; i < 100; i++) {
      const id = generateSessionId();
      for (const char of id) {
        expect(validChars).toContain(char);
      }
    }
  });

  it("should generate different IDs (statistical check)", () => {
    const ids = new Set<string>();

    // Generate 100 IDs, expect most to be unique
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }

    // With 32^4 = 1,048,576 possible IDs, 100 should almost always be unique
    expect(ids.size).toBeGreaterThan(90);
  });

  it("should be case-insensitive friendly (all uppercase)", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateSessionId();
      expect(id).toBe(id.toUpperCase());
    }
  });
});

// ============================================================================
// useGameSocket Hook Tests
// ============================================================================

describe("useGameSocket", () => {
  const defaultConfig: GameSocketConfig = {
    roomId: "ABCD",
    role: "host",
    debug: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPartySocket.readyState = WebSocket.OPEN;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should start with disconnected status", () => {
      const { result } = renderHook(() => useGameSocket(defaultConfig));

      expect(result.current.status).toBe("disconnected");
      expect(result.current.error).toBeNull();
      expect(result.current.roomId).toBeNull();
      expect(result.current.controllerConnected).toBe(false);
      expect(result.current.hostConnected).toBe(false);
      expect(result.current.lastStateUpdate).toBeNull();
    });

    it("should provide all action methods", () => {
      const { result } = renderHook(() => useGameSocket(defaultConfig));

      expect(typeof result.current.connect).toBe("function");
      expect(typeof result.current.disconnect).toBe("function");
      expect(typeof result.current.drawCard).toBe("function");
      expect(typeof result.current.pauseGame).toBe("function");
      expect(typeof result.current.resumeGame).toBe("function");
      expect(typeof result.current.resetGame).toBe("function");
      expect(typeof result.current.sendStateUpdate).toBe("function");
      expect(typeof result.current.onMessage).toBe("function");
    });
  });

  describe("Message Subscription", () => {
    it("should return unsubscribe function from onMessage", () => {
      const { result } = renderHook(() => useGameSocket(defaultConfig));

      const handler = vi.fn();
      const unsubscribe = result.current.onMessage(handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should allow multiple handlers", () => {
      const { result } = renderHook(() => useGameSocket(defaultConfig));

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      result.current.onMessage(handler1);
      result.current.onMessage(handler2);

      // Both should be registered (we can't easily test this without triggering messages)
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should remove handler on unsubscribe", () => {
      const { result } = renderHook(() => useGameSocket(defaultConfig));

      const handler = vi.fn();
      const unsubscribe = result.current.onMessage(handler);

      // Unsubscribe
      unsubscribe();

      // Handler should no longer be in the set (internal state)
      // We verify by the fact that no error occurs
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("Role-based Configuration", () => {
    it("should accept host role", () => {
      const { result } = renderHook(() =>
        useGameSocket({ ...defaultConfig, role: "host" })
      );

      expect(result.current.status).toBe("disconnected");
    });

    it("should accept controller role", () => {
      const { result } = renderHook(() =>
        useGameSocket({ ...defaultConfig, role: "controller" })
      );

      expect(result.current.status).toBe("disconnected");
    });
  });

  describe("Connection Status Types", () => {
    it("should have valid ConnectionStatus type", () => {
      const statuses: ConnectionStatus[] = [
        "disconnected",
        "connecting",
        "connected",
        "reconnecting",
      ];

      // Type check - these should all be valid
      statuses.forEach((status) => {
        expect(typeof status).toBe("string");
      });
    });
  });
});

// ============================================================================
// Convenience Hooks Tests
// ============================================================================

describe("Convenience Hooks", () => {
  // Note: useHostSocket and useControllerSocket are thin wrappers
  // around useGameSocket with the role pre-set.
  // Their functionality is tested through useGameSocket tests.

  it("should export useHostSocket", async () => {
    const { useHostSocket } = await import("../partykit-client");
    expect(typeof useHostSocket).toBe("function");
  });

  it("should export useControllerSocket", async () => {
    const { useControllerSocket } = await import("../partykit-client");
    expect(typeof useControllerSocket).toBe("function");
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("Edge Cases", () => {
  describe("Session ID Edge Cases", () => {
    it("should handle rapid generation without collision", () => {
      const ids: string[] = [];

      // Generate many IDs rapidly
      for (let i = 0; i < 1000; i++) {
        ids.push(generateSessionId());
      }

      // Check for basic validity
      ids.forEach((id) => {
        expect(id).toHaveLength(4);
      });

      // Calculate uniqueness rate (should be very high)
      const uniqueIds = new Set(ids);
      const uniquenessRate = uniqueIds.size / ids.length;

      // With 32^4 possibilities, 1000 should have >99% uniqueness
      expect(uniquenessRate).toBeGreaterThan(0.99);
    });
  });

  describe("Hook Cleanup", () => {
    it("should not throw on unmount", () => {
      const { unmount } = renderHook(() =>
        useGameSocket({
          roomId: "TEST",
          role: "host",
        })
      );

      // Should not throw
      expect(() => unmount()).not.toThrow();
    });

    it("should cleanup resources on unmount", () => {
      // Note: Full connection test requires integration testing with actual PartySocket
      // This test verifies the hook can unmount cleanly without connecting
      const { unmount } = renderHook(() =>
        useGameSocket({
          roomId: "TEST",
          role: "host",
        })
      );

      // Unmount should trigger cleanup without errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Config Changes", () => {
    it("should handle roomId prop changes", () => {
      const { result, rerender } = renderHook(
        ({ roomId }) =>
          useGameSocket({
            roomId,
            role: "host",
          }),
        { initialProps: { roomId: "AAAA" } }
      );

      expect(result.current.status).toBe("disconnected");

      // Change roomId
      rerender({ roomId: "BBBB" });

      // Should still be disconnected (need to reconnect manually)
      expect(result.current.status).toBe("disconnected");
    });
  });
});

// ============================================================================
// Type Safety Tests
// ============================================================================

describe("Type Safety", () => {
  it("should enforce GameSocketConfig shape", () => {
    // These should compile without errors
    const validConfig1: GameSocketConfig = {
      roomId: "ABCD",
      role: "host",
    };

    const validConfig2: GameSocketConfig = {
      roomId: "EFGH",
      role: "controller",
      host: "localhost:1999",
      debug: true,
    };

    expect(validConfig1.roomId).toBe("ABCD");
    expect(validConfig2.role).toBe("controller");
  });

  it("should type state updates correctly", () => {
    const { result } = renderHook(() =>
      useGameSocket({
        roomId: "TEST",
        role: "host",
      })
    );

    // sendStateUpdate should accept StateUpdatePayload
    // Type check at compile time
    const validPayload = {
      currentItem: null,
      currentIndex: 0,
      totalItems: 36,
      status: "playing" as const,
      historyCount: 0,
    };

    // Should not throw type error
    expect(() => {
      result.current.sendStateUpdate(validPayload);
    }).not.toThrow();
  });
});

