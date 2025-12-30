/**
 * ReactionBar Component Tests
 *
 * Tests for the emoji reaction button bar used by spectators.
 * Verifies batching, cooldown, and visual feedback behavior.
 *
 * @module components/__tests__/reaction-bar.test
 * @see SRD §6.3 Spectator Mode
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ReactionBar } from "../reaction-bar";
import { REACTION_EMOJIS } from "@/lib/realtime/types";
import { NextIntlClientProvider } from "next-intl";

// ============================================================================
// MOCKS
// ============================================================================

// Mock framer-motion
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
    motion: {
      button: ({
        children,
        onClick,
        disabled,
        className,
        "aria-label": ariaLabel,
        style,
        whileTap,
        initial,
        animate,
        transition,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        whileTap?: unknown;
        initial?: unknown;
        animate?: unknown;
        transition?: unknown;
      }) => (
        <button
          onClick={onClick}
          disabled={disabled}
          className={className}
          aria-label={ariaLabel}
          style={style}
          {...props}
        >
          {children}
        </button>
      ),
      div: ({
        children,
        className,
        ...props
      }: React.HTMLAttributes<HTMLDivElement>) => (
        <div className={className} {...props}>
          {children}
        </div>
      ),
    },
  };
});

// ============================================================================
// TEST WRAPPER
// ============================================================================

const messages = {
  spectator: {
    reactWith: "React with {emoji}",
    react: "React!",
    cooldown: "Wait a moment...",
  },
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, { wrapper: TestWrapper });
}

// ============================================================================
// TESTS
// ============================================================================

describe("ReactionBar", () => {
  let mockOnReact: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnReact = vi.fn();
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
    it("should render all reaction emojis", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} />);

      for (const emoji of REACTION_EMOJIS) {
        expect(screen.getByText(emoji)).toBeTruthy();
      }
    });

    it("should render exactly 6 emoji buttons", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(REACTION_EMOJIS.length);
      expect(buttons).toHaveLength(6);
    });

    it("should apply custom className", () => {
      renderWithI18n(
        <ReactionBar onReact={mockOnReact} className="custom-class" />
      );

      const footer = document.querySelector("footer.custom-class");
      expect(footer).not.toBeNull();
    });

    it("should have accessible aria-labels", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} />);

      for (const emoji of REACTION_EMOJIS) {
        const button = screen.getByLabelText(`React with ${emoji}`);
        expect(button).toBeTruthy();
      }
    });
  });

  // ==========================================================================
  // CLICK HANDLING
  // ==========================================================================

  describe("click handling", () => {
    it("should queue reaction on click", async () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} />);

      const button = screen.getByText("👏");
      fireEvent.click(button);

      // Wait for batch flush (400ms default)
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockOnReact).toHaveBeenCalledWith("👏", 1);
    });

    it("should batch multiple clicks into one call", async () => {
      renderWithI18n(
        <ReactionBar
          onReact={mockOnReact}
          clickCooldownMs={50}
          batchIntervalMs={400}
        />
      );

      const button = screen.getByText("👏");

      // Click multiple times with delays
      fireEvent.click(button);
      await act(async () => {
        vi.advanceTimersByTime(60);
      });

      fireEvent.click(button);
      await act(async () => {
        vi.advanceTimersByTime(60);
      });

      fireEvent.click(button);

      // Wait for batch flush
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      // Should be called with count = 3
      expect(mockOnReact).toHaveBeenCalledWith("👏", 3);
      expect(mockOnReact).toHaveBeenCalledTimes(1);
    });

    it("should handle clicks on different emojis", async () => {
      renderWithI18n(
        <ReactionBar onReact={mockOnReact} batchIntervalMs={400} />
      );

      fireEvent.click(screen.getByText("👏"));
      fireEvent.click(screen.getByText("🎉"));

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockOnReact).toHaveBeenCalledWith("👏", 1);
      expect(mockOnReact).toHaveBeenCalledWith("🎉", 1);
    });
  });

  // ==========================================================================
  // COOLDOWN
  // ==========================================================================

  describe("cooldown", () => {
    it("should respect click cooldown between same button clicks", async () => {
      renderWithI18n(
        <ReactionBar
          onReact={mockOnReact}
          clickCooldownMs={200}
          batchIntervalMs={500}
        />
      );

      const button = screen.getByText("👏");

      // First click
      fireEvent.click(button);

      // Second click within cooldown (should be ignored)
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.click(button);

      // Wait for batch
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Only 1 reaction should be counted
      expect(mockOnReact).toHaveBeenCalledWith("👏", 1);
    });

    it("should allow click after cooldown expires", async () => {
      renderWithI18n(
        <ReactionBar
          onReact={mockOnReact}
          clickCooldownMs={100}
          batchIntervalMs={500}
        />
      );

      const button = screen.getByText("👏");

      fireEvent.click(button);

      // Wait past cooldown
      await act(async () => {
        vi.advanceTimersByTime(150);
      });

      fireEvent.click(button);

      // Wait for batch
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Should have 2 clicks
      expect(mockOnReact).toHaveBeenCalledWith("👏", 2);
    });
  });

  // ==========================================================================
  // DISABLED STATE
  // ==========================================================================

  describe("disabled state", () => {
    it("should not call onReact when disabled", async () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} isEnabled={false} />);

      const button = screen.getByText("👏");
      fireEvent.click(button);

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockOnReact).not.toHaveBeenCalled();
    });

    it("should show disabled styling when isEnabled=false", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} isEnabled={false} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.className).toContain("opacity-50");
        expect(button.className).toContain("cursor-not-allowed");
      });
    });

    it("should set aria-disabled when disabled", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} isEnabled={false} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.getAttribute("aria-disabled")).toBe("true");
      });
    });
  });

  // ==========================================================================
  // BATCHING
  // ==========================================================================

  describe("batching", () => {
    it("should use custom batch interval", async () => {
      renderWithI18n(
        <ReactionBar onReact={mockOnReact} batchIntervalMs={200} />
      );

      fireEvent.click(screen.getByText("👏"));

      // Before batch interval
      await act(async () => {
        vi.advanceTimersByTime(150);
      });
      expect(mockOnReact).not.toHaveBeenCalled();

      // After batch interval
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      expect(mockOnReact).toHaveBeenCalled();
    });

    it("should flush remaining reactions on unmount", async () => {
      const { unmount } = renderWithI18n(
        <ReactionBar onReact={mockOnReact} batchIntervalMs={1000} />
      );

      fireEvent.click(screen.getByText("👏"));

      // Unmount before batch interval
      unmount();

      expect(mockOnReact).toHaveBeenCalledWith("👏", 1);
    });
  });

  // ==========================================================================
  // KEYBOARD ACCESSIBILITY
  // ==========================================================================

  describe("keyboard accessibility", () => {
    it("should be focusable", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        // Buttons should not have tabindex=-1 (which would make them unfocusable)
        expect(button.getAttribute("tabindex")).not.toBe("-1");
      });
    });

    it("should show keyboard hints on desktop", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} />);

      // Keyboard hints are hidden on mobile (sm:flex)
      const hints = document.querySelector(".hidden.sm\\:flex");
      expect(hints).not.toBeNull();
    });
  });

  // ==========================================================================
  // VISUAL FEEDBACK
  // ==========================================================================

  describe("visual feedback", () => {
    it("should have hover styles when enabled", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} isEnabled={true} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.className).toContain("hover:bg-amber-800/50");
      });
    });

    it("should not have hover styles when disabled", () => {
      renderWithI18n(<ReactionBar onReact={mockOnReact} isEnabled={false} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.className).not.toContain("hover:bg-amber-800/50");
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe("edge cases", () => {
    it("should handle rapid clicks without error", async () => {
      renderWithI18n(
        <ReactionBar onReact={mockOnReact} clickCooldownMs={10} />
      );

      const button = screen.getByText("👏");

      // Rapid fire clicks
      for (let i = 0; i < 20; i++) {
        fireEvent.click(button);
        await act(async () => {
          vi.advanceTimersByTime(15);
        });
      }

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockOnReact).toHaveBeenCalled();
    });

    it("should handle multiple emoji clicks in same batch", async () => {
      renderWithI18n(
        <ReactionBar
          onReact={mockOnReact}
          clickCooldownMs={10}
          batchIntervalMs={500}
        />
      );

      // Click each emoji once
      for (const emoji of REACTION_EMOJIS) {
        fireEvent.click(screen.getByText(emoji));
        await act(async () => {
          vi.advanceTimersByTime(15);
        });
      }

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // Each emoji should have been sent
      expect(mockOnReact).toHaveBeenCalledTimes(REACTION_EMOJIS.length);
    });
  });
});

