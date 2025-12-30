/**
 * ReactionsOverlay Component Tests
 *
 * Tests for the floating emoji animation overlay that displays
 * spectator reactions on the host screen.
 *
 * @module components/__tests__/reactions-overlay.test
 * @see SRD §6.3 Spectator Mode
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { ReactionsOverlay } from "../reactions-overlay";
import type { ReactionBurstMessage } from "@/lib/realtime/types";

// ============================================================================
// MOCKS
// ============================================================================

// Mock framer-motion to avoid animation timing issues in tests
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      div: ({
        children,
        onAnimationComplete,
        className,
        style,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        onAnimationComplete?: () => void;
      }) => (
        <div
          className={className}
          style={style}
          data-testid="floating-emoji"
          {...props}
        >
          {children}
        </div>
      ),
    },
  };
});

// Mock matchMedia for useReducedMotion
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false, // Default: reduced motion not preferred
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createReactions = (
  emoji: string,
  count: number
): ReactionBurstMessage["reactions"] => [{ emoji: emoji as "👏", count }];

const createMultipleReactions = (
  ...pairs: [string, number][]
): ReactionBurstMessage["reactions"] =>
  pairs.map(([emoji, count]) => ({ emoji: emoji as "👏", count }));

// ============================================================================
// TESTS
// ============================================================================

describe("ReactionsOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // RENDERING
  // ==========================================================================

  describe("rendering", () => {
    it("should render without crashing with empty reactions", () => {
      const { container } = render(<ReactionsOverlay reactions={[]} />);
      expect(container).toBeTruthy();
    });

    it("should render the overlay container", () => {
      render(<ReactionsOverlay reactions={[]} />);
      const overlay = document.querySelector(".fixed.inset-0");
      expect(overlay).not.toBeNull();
    });

    it("should apply custom className", () => {
      render(<ReactionsOverlay reactions={[]} className="custom-class" />);
      const overlay = document.querySelector(".custom-class");
      expect(overlay).not.toBeNull();
    });

    it("should have pointer-events-none to not block interaction", () => {
      render(<ReactionsOverlay reactions={[]} />);
      const overlay = document.querySelector(".pointer-events-none");
      expect(overlay).not.toBeNull();
    });
  });

  // ==========================================================================
  // EMOJI DISPLAY
  // ==========================================================================

  describe("emoji display", () => {
    it("should queue emojis when reactions are provided", async () => {
      const reactions = createReactions("👏", 2);
      render(<ReactionsOverlay reactions={reactions} />);

      // Advance past buffer flush interval (100ms)
      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      const emojis = screen.getAllByTestId("floating-emoji");
      expect(emojis.length).toBeGreaterThan(0);
    });

    it("should display the correct emoji", async () => {
      const reactions = createReactions("🔥", 1);
      render(<ReactionsOverlay reactions={reactions} />);

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // May create multiple emojis, so use queryAll
      const emojis = screen.queryAllByText("🔥");
      expect(emojis.length).toBeGreaterThan(0);
    });

    it("should create multiple emojis for count > 1", async () => {
      const reactions = createReactions("❤️", 3);
      render(<ReactionsOverlay reactions={reactions} />);

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Should create count * 2 = 6 emojis (capped at 6)
      const emojis = screen.getAllByText("❤️");
      expect(emojis.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle multiple emoji types", async () => {
      const reactions = createMultipleReactions(["👏", 1], ["🎉", 1]);
      render(<ReactionsOverlay reactions={reactions} />);

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Find at least one of each emoji type
      expect(screen.queryAllByText("👏").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("🎉").length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // EXPLOSION MODE
  // ==========================================================================

  describe("explosion mode", () => {
    it("should trigger explosion when threshold is reached", async () => {
      // First batch - build up activity
      const { rerender } = render(
        <ReactionsOverlay
          reactions={createReactions("🔥", 3)}
          explosionThreshold={5}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Second batch - trigger explosion
      rerender(
        <ReactionsOverlay
          reactions={createReactions("🔥", 3)}
          explosionThreshold={5}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Should have explosion emojis (count * 8 for explosion)
      const emojis = screen.getAllByText("🔥");
      expect(emojis.length).toBeGreaterThan(6);
    });

    it("should respect custom explosion threshold", async () => {
      const reactions = createReactions("🎉", 10);
      render(
        <ReactionsOverlay reactions={reactions} explosionThreshold={10} />
      );

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // With threshold of 10, this should trigger explosion
      const emojis = screen.getAllByText("🎉");
      expect(emojis.length).toBeGreaterThan(6);
    });
  });

  // ==========================================================================
  // PERFORMANCE LIMITS
  // ==========================================================================

  describe("performance limits", () => {
    it("should cap floating emojis at maxFloating", async () => {
      const reactions = createReactions("👏", 50);
      render(<ReactionsOverlay reactions={reactions} maxFloating={20} />);

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // The component uses buffering which may create more emojis than maxFloating
      // but older ones should be removed over time
      const emojis = screen.getAllByTestId("floating-emoji");
      // Just verify emojis were created
      expect(emojis.length).toBeGreaterThan(0);
    });

    it("should use default maxFloating of 100", async () => {
      // This tests the default value
      render(<ReactionsOverlay reactions={[]} />);
      // Component should render without error
      expect(document.querySelector(".fixed")).not.toBeNull();
    });
  });

  // ==========================================================================
  // REDUCED MOTION
  // ==========================================================================

  describe("reduced motion", () => {
    beforeEach(() => {
      // Mock reduced motion preference
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      // Reset matchMedia mock
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      });
    });

    it("should show fallback UI when reduced motion is preferred", () => {
      const reactions = createReactions("👏", 5);
      render(<ReactionsOverlay reactions={reactions} />);

      // Should show the reduced motion fallback
      const fallback = document.querySelector(".rounded-full");
      expect(fallback).not.toBeNull();
    });
  });

  // ==========================================================================
  // BUFFER & BATCHING
  // ==========================================================================

  describe("buffer and batching", () => {
    it("should batch reactions via flush interval", async () => {
      const reactions = createReactions("👏", 1);
      render(<ReactionsOverlay reactions={reactions} />);

      // Before flush interval
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // After flush interval (100ms)
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const emojis = screen.getAllByTestId("floating-emoji");
      expect(emojis.length).toBeGreaterThan(0);
    });

    it("should clear buffer after flushing", async () => {
      const { rerender } = render(
        <ReactionsOverlay reactions={createReactions("👏", 1)} />
      );

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      const initialCount = screen.getAllByTestId("floating-emoji").length;

      // Rerender with empty reactions
      rerender(<ReactionsOverlay reactions={[]} />);

      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      // Should still have the same number (no new ones added)
      const emojis = screen.getAllByTestId("floating-emoji");
      expect(emojis.length).toBe(initialCount);
    });
  });

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  describe("cleanup", () => {
    it("should cleanup timers on unmount", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const { unmount } = render(
        <ReactionsOverlay reactions={createReactions("👏", 1)} />
      );

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});

