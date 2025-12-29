"use client";

/**
 * DrawButton Component
 *
 * Giant, thumb-friendly button for drawing cards on mobile controller.
 * Features haptic feedback and visual press states.
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see SRD Appendix B: Haptic Feedback
 */

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Pause, Play, Check } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface DrawButtonProps {
  /** Callback when button is pressed */
  onDraw: () => void;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Current game state */
  gameState?: "waiting" | "ready" | "playing" | "paused" | "finished";

  /** Whether this is the first card */
  isFirstCard?: boolean;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className */
  className?: string;
}

// ============================================================================
// HAPTIC FEEDBACK (SRD Appendix B)
// ============================================================================

type HapticStyle = "light" | "medium" | "heavy";

function triggerHaptic(style: HapticStyle = "medium") {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const patterns: Record<HapticStyle, number[]> = {
      light: [10],
      medium: [30],
      heavy: [50, 30, 50],
    };
    try {
      navigator.vibrate(patterns[style]);
    } catch {
      // Vibration API may not be available
    }
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DrawButton({
  onDraw,
  disabled = false,
  gameState = "ready",
  isFirstCard = false,
  reducedMotion = false,
  className = "",
}: DrawButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = useCallback(() => {
    if (disabled) return;

    setIsPressed(true);
    triggerHaptic("heavy");
    onDraw();

    // Reset press state after animation
    setTimeout(() => setIsPressed(false), 150);
  }, [disabled, onDraw]);

  // Determine button state and content
  const isFinished = gameState === "finished";
  const isPaused = gameState === "paused";

  const getButtonContent = () => {
    if (isFinished) {
      return {
        icon: Check,
        text: "Game Complete",
        subtext: "All cards drawn",
      };
    }
    if (isPaused) {
      return {
        icon: Pause,
        text: "Paused",
        subtext: "Game is paused",
      };
    }
    if (isFirstCard) {
      return {
        icon: Play,
        text: "Start Game",
        subtext: "Draw first card",
      };
    }
    return {
      icon: ChevronRight,
      text: "Draw Card",
      subtext: "Tap to continue",
    };
  };

  const content = getButtonContent();
  const Icon = content.icon;

  return (
    <motion.button
      onClick={handlePress}
      disabled={disabled || isFinished}
      className={`
        relative overflow-hidden rounded-[2rem]
        ${
          disabled || isFinished
            ? "bg-amber-900/50 cursor-not-allowed"
            : isPaused
              ? "bg-yellow-700/80"
              : "bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700"
        }
        w-full max-w-[280px] aspect-square
        shadow-2xl shadow-amber-900/50
        transition-all duration-200
        focus:outline-none focus:ring-4 focus:ring-amber-400/50
        touch-manipulation
        ${className}
      `}
      style={{
        // Ensure minimum touch target of 44x44px (§5.12)
        minWidth: "180px",
        minHeight: "180px",
      }}
      whileTap={!reducedMotion && !disabled ? { scale: 0.95 } : undefined}
      animate={
        isPressed && !reducedMotion
          ? { scale: [1, 0.95, 1] }
          : undefined
      }
      aria-label={content.text}
      aria-disabled={disabled || isFinished}
    >
      {/* Background glow effect */}
      {!disabled && !isFinished && !isPaused && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-transparent"
          animate={
            !reducedMotion
              ? {
                  opacity: [0.3, 0.6, 0.3],
                }
              : undefined
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Press ripple effect */}
      {isPressed && !reducedMotion && (
        <motion.div
          className="absolute inset-0 bg-white/20 rounded-[2rem]"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
        {/* Icon */}
        <div
          className={`
            mb-4 rounded-full p-4
            ${
              disabled || isFinished
                ? "bg-amber-800/50"
                : isPaused
                  ? "bg-yellow-800/50"
                  : "bg-amber-800/30"
            }
          `}
        >
          <Icon
            className={`
              h-12 w-12 md:h-16 md:w-16
              ${
                disabled || isFinished
                  ? "text-amber-400/50"
                  : isPaused
                    ? "text-yellow-200"
                    : "text-amber-100"
              }
            `}
            strokeWidth={2.5}
          />
        </div>

        {/* Text */}
        <span
          className={`
            text-xl md:text-2xl font-bold
            ${
              disabled || isFinished
                ? "text-amber-400/50"
                : isPaused
                  ? "text-yellow-100"
                  : "text-amber-50"
            }
          `}
        >
          {content.text}
        </span>

        <span
          className={`
            mt-1 text-sm
            ${
              disabled || isFinished
                ? "text-amber-500/50"
                : isPaused
                  ? "text-yellow-200/70"
                  : "text-amber-200/80"
            }
          `}
        >
          {content.subtext}
        </span>
      </div>

      {/* Border highlight */}
      {!disabled && !isFinished && !isPaused && (
        <div className="absolute inset-0 rounded-[2rem] ring-2 ring-inset ring-amber-400/20" />
      )}
    </motion.button>
  );
}

export default DrawButton;

