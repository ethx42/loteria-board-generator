"use client";

/**
 * DrawButton Component
 *
 * Giant, thumb-friendly button for drawing cards on mobile controller.
 * Features haptic feedback, visual press states, and 1-second debounce.
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see SRD Appendix B: Haptic Feedback
 */

import { useCallback, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Pause, Play, Check, Loader2 } from "lucide-react";

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

  /** Debounce duration in milliseconds (default: 1000ms) */
  debounceDuration?: number;
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
  debounceDuration = 1000,
}: DrawButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [isDebounced, setIsDebounced] = useState(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || isDebounced) return;

    setIsPressed(true);
    triggerHaptic("heavy");
    onDraw();

    // Start debounce cooldown
    setIsDebounced(true);
    debounceTimeoutRef.current = setTimeout(() => {
      setIsDebounced(false);
    }, debounceDuration);

    // Reset press state after animation
    setTimeout(() => setIsPressed(false), 150);
  }, [disabled, isDebounced, onDraw, debounceDuration]);

  // Determine button state and content
  const isFinished = gameState === "finished";
  const isPaused = gameState === "paused";

  const getButtonContent = () => {
    // Show cooldown state when debounced
    if (isDebounced) {
      return {
        icon: Loader2,
        text: "Wait...",
        subtext: "Ready in a moment",
        isLoading: true,
      };
    }
    if (isFinished) {
      return {
        icon: Check,
        text: "Game Complete",
        subtext: "All cards drawn",
        isLoading: false,
      };
    }
    if (isPaused) {
      return {
        icon: Pause,
        text: "Paused",
        subtext: "Game is paused",
        isLoading: false,
      };
    }
    if (isFirstCard) {
      return {
        icon: Play,
        text: "Start Game",
        subtext: "Draw first card",
        isLoading: false,
      };
    }
    return {
      icon: ChevronRight,
      text: "Draw Card",
      subtext: "Tap to continue",
      isLoading: false,
    };
  };

  const content = getButtonContent();
  const Icon = content.icon;

  // Button is effectively disabled when debounced
  const effectivelyDisabled = disabled || isFinished || isDebounced;

  return (
    <motion.button
      onClick={handlePress}
      disabled={effectivelyDisabled}
      className={`
        relative overflow-hidden rounded-[2rem]
        ${
          effectivelyDisabled
            ? isDebounced
              ? "bg-gradient-to-br from-amber-600/70 via-amber-700/70 to-amber-800/70 cursor-wait"
              : "bg-amber-900/50 cursor-not-allowed"
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
      {!effectivelyDisabled && !isPaused && (
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
              effectivelyDisabled
                ? isDebounced
                  ? "bg-amber-800/40"
                  : "bg-amber-800/50"
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
                effectivelyDisabled
                  ? isDebounced
                    ? "text-amber-300/70 animate-spin"
                    : "text-amber-400/50"
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
              effectivelyDisabled
                ? isDebounced
                  ? "text-amber-200/70"
                  : "text-amber-400/50"
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
              effectivelyDisabled
                ? isDebounced
                  ? "text-amber-300/60"
                  : "text-amber-500/50"
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
      {!effectivelyDisabled && !isPaused && (
        <div className="absolute inset-0 rounded-[2rem] ring-2 ring-inset ring-amber-400/20" />
      )}

      {/* Cooldown progress ring */}
      {isDebounced && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg
            className="h-full w-full animate-[spin_1s_linear]"
            style={{ animationDuration: `${debounceDuration}ms` }}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(251, 191, 36, 0.3)"
              strokeWidth="4"
              strokeDasharray="289"
              strokeDashoffset="0"
              strokeLinecap="round"
              className="animate-[dash_1s_ease-out_forwards]"
              style={{
                animationDuration: `${debounceDuration}ms`,
              }}
            />
          </svg>
        </div>
      )}
    </motion.button>
  );
}

export default DrawButton;

