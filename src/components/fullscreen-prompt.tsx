"use client";

/**
 * FullscreenPrompt Component
 *
 * A contextual toast notification that prompts users to enter fullscreen mode.
 * Designed to appear when a controller connects, since browsers require user
 * gesture to enter fullscreen (cannot be triggered programmatically from WebSocket).
 *
 * Features:
 * - Auto-dismisses after configurable duration
 * - Manual close button
 * - Click-to-action (enters fullscreen)
 * - Animated entrance/exit
 * - Accessible with ARIA attributes
 *
 * @module components/fullscreen-prompt
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { useTranslations } from "next-intl";

// ============================================================================
// TYPES
// ============================================================================

interface FullscreenPromptProps {
  /** Whether the prompt should be visible */
  isVisible: boolean;

  /** Callback when user clicks to enter fullscreen */
  onEnterFullscreen: () => void;

  /** Callback when prompt is dismissed (closed or auto-hidden) */
  onDismiss: () => void;

  /** Auto-dismiss duration in ms (default: 6000) */
  autoDismissMs?: number;

  /** Whether to show the arrow pointer (default: true) */
  showArrow?: boolean;

  /** Additional className */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_AUTO_DISMISS_MS = 6000;

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const promptVariants = {
  hidden: {
    opacity: 0,
    y: 10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // Custom ease for a polished feel
    },
  },
  exit: {
    opacity: 0,
    y: -5,
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: "easeIn" as const,
    },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function FullscreenPrompt({
  isVisible,
  onEnterFullscreen,
  onDismiss,
  autoDismissMs = DEFAULT_AUTO_DISMISS_MS,
  showArrow = true,
  className = "",
}: FullscreenPromptProps) {
  const t = useTranslations("host");
  const [progress, setProgress] = useState(100);

  // Auto-dismiss timer with progress indicator
  useEffect(() => {
    if (!isVisible) {
      // Reset progress when hidden (deferred to avoid sync setState in effect)
      queueMicrotask(() => setProgress(100));
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + autoDismissMs;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const newProgress = (remaining / autoDismissMs) * 100;
      setProgress(newProgress);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isVisible, autoDismissMs, onDismiss]);

  const handleClick = useCallback(() => {
    onEnterFullscreen();
    onDismiss();
  }, [onEnterFullscreen, onDismiss]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss();
    },
    [onDismiss]
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={promptVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="alert"
          aria-live="polite"
          className={`
            fixed z-[60]
            cursor-pointer
            ${className}
          `}
          onClick={handleClick}
        >
          {/* Main prompt container */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-800/95 via-amber-900/95 to-amber-950/95 shadow-2xl shadow-amber-950/50 backdrop-blur-md border border-amber-600/30">
            {/* Progress bar at top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-950/50">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                initial={{ width: "100%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>

            <div className="flex items-center gap-3 px-4 py-3 pt-4">
              {/* Icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                <Maximize2 className="h-5 w-5 text-amber-300" />
              </div>

              {/* Text */}
              <div className="flex-1 pr-2">
                <p className="font-medium text-amber-100 text-sm">
                  {t("controllerConnected")}
                </p>
                <p className="text-xs text-amber-300/70 mt-0.5">
                  {t("clickForFullscreen")}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/30 text-amber-300/70 hover:bg-amber-700/50 hover:text-amber-200 transition-colors"
                aria-label={t("dismissPrompt")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Subtle glow effect */}
            <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-amber-400/10 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Pointer arrow pointing down to button (optional) */}
          {showArrow && (
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
              <div className="w-4 h-4 bg-amber-900/95 border-r border-b border-amber-600/30 transform rotate-45" />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FullscreenPrompt;

