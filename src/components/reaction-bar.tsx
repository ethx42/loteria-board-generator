"use client";

/**
 * ReactionBar Component
 *
 * Displays emoji reaction buttons for spectators.
 * Implements client-side batching to minimize server calls while
 * providing immediate visual feedback.
 *
 * Strategy:
 * - User can click rapidly (low visual cooldown: 150ms)
 * - Clicks are batched and sent to server every 400ms
 * - This reduces server load while maintaining responsiveness
 *
 * UX Features:
 * - Keyboard shortcuts (1-6) with tooltip hints on hover
 * - Tooltips only appear on desktop (hidden on touch devices)
 *
 * @module components/reaction-bar
 * @see SRD §6.3 Spectator Mode
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Keyboard } from "lucide-react";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/realtime/types";
import { cn } from "@/lib/utils";
import { createDevLogger } from "@/lib/utils/dev-logger";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const log = createDevLogger("ReactionBar");

// ============================================================================
// TYPES
// ============================================================================

interface ReactionBarProps {
  /** Callback when reaction is sent to server (with optional count) */
  onReact: (emoji: ReactionEmoji, count?: number) => void;
  /** Batch interval: how often to send accumulated reactions (ms) */
  batchIntervalMs?: number;
  /** Minimum delay between clicks for visual feedback (ms) */
  clickCooldownMs?: number;
  /** Whether reactions are enabled (e.g., game is active) */
  isEnabled?: boolean;
  /** Custom className for the container */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** How often to flush batched reactions to server */
const DEFAULT_BATCH_INTERVAL_MS = 400;
/** Minimum time between visual feedback on same button */
const DEFAULT_CLICK_COOLDOWN_MS = 150;

// ============================================================================
// COMPONENT
// ============================================================================

export function ReactionBar({
  onReact,
  batchIntervalMs = DEFAULT_BATCH_INTERVAL_MS,
  clickCooldownMs = DEFAULT_CLICK_COOLDOWN_MS,
  isEnabled = true,
  className,
}: ReactionBarProps) {
  const t = useTranslations("spectator");

  // Track pending reactions to batch
  const pendingReactionsRef = useRef<Map<ReactionEmoji, number>>(new Map());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track last click time per emoji for visual cooldown
  const lastClickRef = useRef<Map<ReactionEmoji, number>>(new Map());

  // Track which emoji was just pressed for ring animation (with unique key for animation reset)
  const [pressedState, setPressedState] = useState<{
    emoji: ReactionEmoji;
    key: number;
  } | null>(null);
  const pressedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyCounterRef = useRef(0);

  // Flush pending reactions to server
  const flushReactions = useCallback(() => {
    const pending = pendingReactionsRef.current;
    if (pending.size === 0) return;

    // Send one message per emoji type with the accumulated count
    for (const [emoji, count] of pending.entries()) {
      log.info(`Flushing ${count}x ${emoji} to server`);
      onReact(emoji, count);
    }

    pending.clear();
    batchTimerRef.current = null;
  }, [onReact]);

  // Schedule a batch flush
  const scheduleBatchFlush = useCallback(() => {
    if (batchTimerRef.current) return; // Already scheduled

    batchTimerRef.current = setTimeout(() => {
      flushReactions();
    }, batchIntervalMs);
  }, [batchIntervalMs, flushReactions]);

  const handleReact = useCallback(
    (emoji: ReactionEmoji) => {
      if (!isEnabled) return;

      // Always show visual feedback immediately (no cooldown for visuals)
      keyCounterRef.current += 1;
      setPressedState({ emoji, key: keyCounterRef.current });
      if (pressedTimeoutRef.current) {
        clearTimeout(pressedTimeoutRef.current);
      }
      pressedTimeoutRef.current = setTimeout(() => setPressedState(null), 150);

      // Check cooldown only for queueing reactions
      const now = Date.now();
      const lastClick = lastClickRef.current.get(emoji) ?? 0;
      if (now - lastClick < clickCooldownMs) {
        // Visual feedback shown, but don't queue duplicate
        return;
      }

      lastClickRef.current.set(emoji, now);

      // Add to pending batch
      const currentCount = pendingReactionsRef.current.get(emoji) ?? 0;
      pendingReactionsRef.current.set(emoji, currentCount + 1);
      log.debug(`Queued ${emoji} (total pending: ${currentCount + 1})`);

      // Schedule batch flush
      scheduleBatchFlush();
    },
    [isEnabled, clickCooldownMs, scheduleBatchFlush]
  );

  // Keyboard shortcuts (1-6 for emojis)
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const keyNum = parseInt(e.key, 10);
      if (keyNum >= 1 && keyNum <= REACTION_EMOJIS.length) {
        e.preventDefault();
        const emoji = REACTION_EMOJIS[keyNum - 1];
        handleReact(emoji);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEnabled, handleReact]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        // Flush any pending on unmount
        flushReactions();
      }
      if (pressedTimeoutRef.current) {
        clearTimeout(pressedTimeoutRef.current);
      }
    };
  }, [flushReactions]);

  return (
    <TooltipProvider delayDuration={400}>
      <footer
        className={cn(
          "fixed bottom-0 inset-x-0 z-40 safe-area-inset-bottom",
          "bg-linear-to-t from-amber-950/60 to-amber-950/30", // Same as history strip (no border)
          "pt-3 pb-3 px-4",
          className
        )}
      >
        {/* Reaction buttons with tooltip hints */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {REACTION_EMOJIS.map((emoji, index) => (
            <Tooltip key={emoji}>
              <TooltipTrigger asChild>
                <motion.button
                  onClick={() => handleReact(emoji)}
                  disabled={!isEnabled}
                  whileTap={isEnabled ? { scale: 0.85 } : undefined}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: pressedState?.emoji === emoji ? 1.12 : 1,
                  }}
                  transition={{
                    delay: index * 0.05,
                    scale: { duration: 0.1 },
                  }}
                  className={cn(
                    "relative text-2xl sm:text-3xl p-2 sm:p-3 rounded-full",
                    "transition-colors duration-100",
                    "focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 focus:ring-offset-amber-950",
                    isEnabled
                      ? "hover:bg-amber-800/50 cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  )}
                  style={{
                    textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                  }}
                  aria-label={t("reactWith", { emoji })}
                  aria-disabled={!isEnabled}
                >
                  {emoji}

                  {/* Ripple ring on press */}
                  <AnimatePresence>
                    {pressedState?.emoji === emoji && (
                      <motion.div
                        key={`ring-${pressedState.key}`}
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.4, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute inset-0 rounded-full border-2 border-amber-400 pointer-events-none"
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              </TooltipTrigger>

              {/* Keyboard shortcut tooltip - only shows on hover (desktop) */}
              <TooltipContent
                side="top"
                className="hidden sm:flex items-center gap-1.5"
              >
                <Keyboard className="h-3 w-3 text-amber-300" />
                <span className="font-mono">{index + 1}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </footer>
    </TooltipProvider>
  );
}

export default ReactionBar;
