"use client";

/**
 * ReactionsOverlay Component
 *
 * High-performance floating emoji animations for spectator reactions.
 * Google Meet style: single reactions float up, bursts explode like confetti.
 *
 * Performance Optimizations (for 50+ reactions/second):
 * - Buffer + Batching: Reactions are queued in a ref and flushed every 100ms
 * - Memoization: Particle component is memoized to prevent unnecessary re-renders
 * - Sanity Cap: Maximum 100 simultaneous emojis to prevent DOM overload
 * - GPU Layers: will-change: transform promotes elements to GPU layers
 *
 * @module components/reactions-overlay
 * @see SRD §6.3 Spectator Mode
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
  memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactionEmoji, ReactionBurstMessage } from "@/lib/realtime/types";
import { createDevLogger } from "@/lib/utils/dev-logger";

const log = createDevLogger("ReactionsOverlay");

// ============================================================================
// TYPES
// ============================================================================

interface FloatingReaction {
  readonly id: string;
  readonly emoji: ReactionEmoji;
  /** X position (0-100% of viewport width) */
  readonly x: number;
  /** Size multiplier */
  readonly scale: number;
  /** Animation duration in seconds */
  readonly duration: number;
  /** Horizontal drift in pixels */
  readonly driftX: number;
}

interface ReactionsOverlayProps {
  readonly reactions: ReactionBurstMessage["reactions"];
  readonly explosionThreshold?: number;
  readonly maxFloating?: number;
  readonly className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** How many reactions in 2 seconds triggers explosion */
const DEFAULT_EXPLOSION_THRESHOLD = 5;
/** Max simultaneous floating emojis (Sanity Cap) */
const DEFAULT_MAX_FLOATING = 100;
/** Activity tracking window in ms */
const ACTIVITY_WINDOW_MS = 2000;
/** Buffer flush interval in ms (max 10 renders/sec) */
const FLUSH_INTERVAL_MS = 100;
/** Vertical travel distance in pixels (85% of original 700px) */
const TRAVEL_DISTANCE_PX = -255;

// ============================================================================
// HOOKS
// ============================================================================

function useReducedMotion(): boolean {
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const subscribe = useCallback((callback: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

// ============================================================================
// UTILITIES
// ============================================================================

let idCounter = 0;
function generateId(): string {
  return `r-${Date.now()}-${idCounter++}`;
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// ============================================================================
// MEMOIZED PARTICLE COMPONENT
// ============================================================================

/**
 * Single floating emoji particle.
 * MEMOIZED to prevent re-renders when parent state changes.
 * Existing particles continue their GPU animation undisturbed.
 */
interface ParticleProps {
  readonly id: string;
  readonly emoji: ReactionEmoji;
  readonly x: number;
  readonly scale: number;
  readonly duration: number;
  readonly driftX: number;
  readonly onComplete: (id: string) => void;
}

const Particle = memo(function Particle({
  id,
  emoji,
  x,
  scale,
  duration,
  driftX,
  onComplete,
}: ParticleProps) {
  return (
    <motion.div
      initial={{
        y: 0,
        x: 0,
        opacity: 1,
        scale: 0.5,
      }}
      animate={{
        y: TRAVEL_DISTANCE_PX,
        x: driftX,
        opacity: 0,
        scale: scale * 1.2,
        rotate: randomBetween(-15, 15),
      }}
      exit={{ opacity: 0 }}
      transition={{
        duration,
        ease: "easeOut",
      }}
      onAnimationComplete={() => onComplete(id)}
      className="absolute select-none pointer-events-none will-change-transform"
      style={{
        left: `${x}%`,
        bottom: "5%",
        fontSize: `${1.8 + scale}rem`,
        textShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {emoji}
    </motion.div>
  );
});

// ============================================================================
// COMPONENT
// ============================================================================

export function ReactionsOverlay({
  reactions,
  explosionThreshold = DEFAULT_EXPLOSION_THRESHOLD,
  maxFloating = DEFAULT_MAX_FLOATING,
  className,
}: ReactionsOverlayProps) {
  // Render list: Only this triggers React re-renders
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // BUFFER: Incoming reactions are queued here without triggering renders
  const bufferRef = useRef<FloatingReaction[]>([]);
  // Track recent activity for explosion detection
  const activityRef = useRef<number[]>([]);
  // Pending flash flag
  const pendingFlashRef = useRef(false);

  // Queue reactions to buffer (no render)
  useEffect(() => {
    if (reactions.length === 0) return;

    const now = Date.now();
    const currentCount = reactions.reduce((sum, r) => sum + r.count, 0);

    // Track activity for explosion detection
    activityRef.current.push(...Array(currentCount).fill(now));
    activityRef.current = activityRef.current.filter(
      (t) => now - t < ACTIVITY_WINDOW_MS
    );

    const recentTotal = activityRef.current.length;
    const isExplosion = recentTotal >= explosionThreshold;

    log.info(
      `Queuing: ${currentCount} reactions, Recent: ${recentTotal}, Explosion: ${isExplosion}`
    );

    // Create particles and add to buffer (NO setState here)
    if (isExplosion) {
      pendingFlashRef.current = true;
      for (const { emoji, count } of reactions) {
        const emojiCount = Math.min(count * 8, 40);
        for (let i = 0; i < emojiCount; i++) {
          bufferRef.current.push({
            id: generateId(),
            emoji,
            x: randomBetween(10, 90),
            scale: randomBetween(0.7, 1.2),
            duration: randomBetween(6.0, 9.0),
            driftX: randomBetween(-120, 120),
          });
        }
      }
    } else {
      for (const { emoji, count } of reactions) {
        const emojiCount = Math.min(count * 2, 6);
        for (let i = 0; i < emojiCount; i++) {
          bufferRef.current.push({
            id: generateId(),
            emoji,
            x: randomBetween(10, 90),
            scale: randomBetween(0.8, 1.1),
            duration: randomBetween(7.0, 10.0),
            driftX: randomBetween(-60, 60),
          });
        }
      }
    }
  }, [reactions, explosionThreshold]);

  // FLUSH LOOP: Batch buffer to state every 100ms (max 10 renders/sec)
  useEffect(() => {
    const interval = setInterval(() => {
      if (bufferRef.current.length === 0) return;

      // Copy and clear buffer
      const batch = [...bufferRef.current];
      bufferRef.current = [];
      const shouldFlash = pendingFlashRef.current;
      pendingFlashRef.current = false;

      log.info(`Flushing ${batch.length} emojis to render`);

      setFloating((prev) => {
        // SANITY CAP: Keep only the most recent maxFloating items
        const combined = [...prev, ...batch];
        if (combined.length > maxFloating) {
          return combined.slice(combined.length - maxFloating);
        }
        return combined;
      });

      if (shouldFlash) {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 600);
      }
    }, FLUSH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [maxFloating]);

  // Remove completed animations
  const handleAnimationComplete = useCallback((id: string) => {
    setFloating((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Reduced motion fallback
  if (prefersReducedMotion && reactions.length > 0) {
    const total = reactions.reduce((sum, r) => sum + r.count, 0);
    return (
      <div className="fixed bottom-32 right-4 z-50">
        <div className="rounded-full bg-amber-800/80 px-4 py-2 text-sm text-amber-100">
          {reactions[0].emoji} +{total}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-visible ${
        className ?? ""
      }`}
      style={{ zIndex: 9999 }}
    >
      {/* Cannon flash - from bottom center */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0.6, scaleY: 0.5 }}
            animate={{ opacity: 0, scaleY: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top, rgba(251,191,36,0.4) 0%, rgba(251,146,60,0.2) 40%, transparent 100%)",
              transformOrigin: "bottom center",
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating emojis - Google Meet style with memoized particles */}
      <AnimatePresence>
        {floating.map((r) => (
          <Particle
            key={r.id}
            id={r.id}
            emoji={r.emoji}
            x={r.x}
            scale={r.scale}
            duration={r.duration}
            driftX={r.driftX}
            onComplete={handleAnimationComplete}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export default ReactionsOverlay;
