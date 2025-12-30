"use client";

/**
 * CurrentCard Component - Enterprise Edition
 *
 * Premium card display with sophisticated visual effects:
 * - Glassmorphic frame with animated shine effect
 * - 3D flip animation with spring physics
 * - Discoverable flip indicator with pulsing animation
 * - Refined typography and spacing
 * - Desktop hover states with subtle depth
 *
 * Supports "Sync + Override" pattern for spectators:
 * - External flip state syncs from host
 * - Local interactions override temporarily
 * - Resets to synced state on card change
 *
 * @see SRD §5.1 Host Display Layout
 * @see FR-030 through FR-034
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { ItemDefinition } from "@/lib/types/game";
import { resolveImageUrl } from "@/lib/storage/image-url";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Card size variants for different contexts.
 */
type CardSize = "default" | "large" | "auto";

interface CurrentCardProps {
  /** The current item to display */
  item: ItemDefinition | null;

  /** Current card number (1-indexed) */
  currentNumber: number;

  /** Total number of cards in the deck */
  totalCards: number;

  /** Whether to show the card counter */
  showCounter?: boolean;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className for the container */
  className?: string;

  /** Card size variant */
  size?: CardSize;

  /** External flip state from host (for spectator sync) */
  hostFlipState?: boolean;

  /** Callback when flip state changes (for host to broadcast) */
  onFlipChange?: (isFlipped: boolean) => void;

  /** Whether to show the title overlay on the card front */
  showTitle?: boolean;

  /** Whether the spectator's local flip differs from host */
  isOutOfSync?: boolean;

  /** Text for the out-of-sync indicator (i18n) */
  outOfSyncText?: string;
}

// ============================================================================
// ANIMATION VARIANTS (SRD §5.4)
// ============================================================================

const cardEntranceVariants = {
  initial: {
    rotateY: -90,
    opacity: 0,
    scale: 0.85,
  },
  animate: {
    rotateY: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 180,
      damping: 22,
      mass: 1,
    },
  },
  exit: {
    rotateY: 90,
    opacity: 0,
    scale: 0.85,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 25,
    },
  },
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const flipVariants = {
  front: {
    rotateY: 0,
    transition: {
      type: "spring" as const,
      stiffness: 280,
      damping: 28,
    },
  },
  back: {
    rotateY: 180,
    transition: {
      type: "spring" as const,
      stiffness: 280,
      damping: 28,
    },
  },
};

// Shine animation that sweeps across the card
const shineAnimation = {
  initial: { x: "-100%", opacity: 0 },
  animate: {
    x: "200%",
    opacity: [0, 0.5, 0],
    transition: {
      duration: 1.5,
      ease: "easeInOut" as const,
      delay: 0.3,
    },
  },
};

// Flip indicator pulse animation
const flipIndicatorVariants = {
  idle: {
    scale: 1,
    boxShadow: "0 0 0 0 rgba(251, 191, 36, 0)",
  },
  pulse: {
    scale: [1, 1.1, 1],
    boxShadow: [
      "0 0 0 0 rgba(251, 191, 36, 0.4)",
      "0 0 0 8px rgba(251, 191, 36, 0)",
      "0 0 0 0 rgba(251, 191, 36, 0)",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

// ============================================================================
// SIZE CONFIGURATIONS
// ============================================================================

const sizeClasses: Record<CardSize, string> = {
  default: "w-[280px] md:w-[320px] lg:w-[380px]",
  large: "w-[320px] md:w-[400px] lg:w-[480px]",
  auto: "w-full max-w-[480px]",
};

const sizesAttr: Record<CardSize, string> = {
  default: "(max-width: 768px) 280px, (max-width: 1024px) 320px, 380px",
  large: "(max-width: 768px) 320px, (max-width: 1024px) 400px, 480px",
  auto: "(max-width: 768px) 100vw, 480px",
};

// ============================================================================
// DECORATIVE PATTERNS
// ============================================================================

/**
 * SVG pattern for the card back - traditional lotería-inspired design
 */
function CardBackPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.03]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="loteria-pattern"
          x="0"
          y="0"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
          <path
            d="M0 20h40M20 0v40"
            stroke="currentColor"
            strokeWidth="0.5"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#loteria-pattern)" />
    </svg>
  );
}

/**
 * Decorative corner flourishes for the card back
 */
function CornerFlourish({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const rotations = {
    tl: "rotate-0",
    tr: "rotate-90",
    bl: "-rotate-90",
    br: "rotate-180",
  };

  const positions = {
    tl: "top-3 left-3",
    tr: "top-3 right-3",
    bl: "bottom-3 left-3",
    br: "bottom-3 right-3",
  };

  return (
    <svg
      className={`absolute h-6 w-6 text-amber-400/30 ${positions[position]} ${rotations[position]}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 12C3 7.02944 7.02944 3 12 3" />
      <path d="M3 3v9h9" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CurrentCard({
  item,
  currentNumber,
  totalCards,
  showCounter = true,
  reducedMotion: forcedReducedMotion,
  className = "",
  size = "default",
  hostFlipState,
  onFlipChange,
  showTitle = true,
  isOutOfSync = false,
  outOfSyncText = "Personal view",
}: CurrentCardProps) {
  // Internal flip state
  const [internalFlipState, setInternalFlipState] = useState(false);

  // Use Framer Motion's reduced motion detection as fallback
  const systemReducedMotion = useReducedMotion();
  const reducedMotion = forcedReducedMotion ?? systemReducedMotion ?? false;

  // Track if we should show the shine animation (only on new card)
  const [showShine, setShowShine] = useState(false);

  // Determine if we're in "spectator mode"
  const isSpectatorMode = hostFlipState !== undefined;

  // Effective flip state
  const effectiveFlipState = internalFlipState;

  // Sync internal state with host state when it changes (spectator mode)
  useEffect(() => {
    if (isSpectatorMode && hostFlipState !== undefined) {
      setInternalFlipState(hostFlipState);
    }
  }, [hostFlipState, isSpectatorMode]);

  // Reset flip state and trigger shine when item changes
  const handleItemChange = useCallback(() => {
    setInternalFlipState(false);
    setShowShine(true);
  }, []);

  // Reset shine after animation completes
  useEffect(() => {
    if (showShine && !reducedMotion) {
      const timer = setTimeout(() => setShowShine(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showShine, reducedMotion]);

  // Trigger shine when item changes
  useEffect(() => {
    if (item && !reducedMotion) {
      setShowShine(true);
    }
  }, [item?.id, reducedMotion]);

  // Toggle flip on click
  const handleClick = useCallback(() => {
    if (item?.longText) {
      const newState = !effectiveFlipState;
      setInternalFlipState(newState);

      if (onFlipChange) {
        onFlipChange(newState);
      }
    }
  }, [item?.longText, effectiveFlipState, onFlipChange]);

  // Handle keyboard interaction
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  const variants = reducedMotion ? reducedMotionVariants : cardEntranceVariants;

  // Memoize theme color for performance
  const themeColor = useMemo(
    () => item?.themeColor || "#f59e0b",
    [item?.themeColor]
  );

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      style={{ perspective: "1200px" }}
    >
      <AnimatePresence mode="wait" onExitComplete={handleItemChange}>
        {item ? (
          <motion.div
            key={item.id}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Flip Container */}
            <motion.div
              className="relative cursor-pointer"
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              tabIndex={item.longText ? 0 : -1}
              role={item.longText ? "button" : undefined}
              aria-label={
                item.longText
                  ? `${item.name}. Click to reveal more information`
                  : item.name
              }
              animate={effectiveFlipState ? "back" : "front"}
              variants={flipVariants}
              style={{ transformStyle: "preserve-3d" }}
              whileHover={
                !reducedMotion && item.longText
                  ? { scale: 1.02, transition: { duration: 0.2 } }
                  : undefined
              }
            >
              {/* ============ CARD FRONT ============ */}
              <div
                className={`relative ${sizeClasses[size]}`}
                style={{
                  aspectRatio: "4/5",
                  backfaceVisibility: "hidden",
                }}
              >
                {/* Premium Card Frame */}
                <div className="absolute -inset-1 rounded-[20px] bg-gradient-to-br from-amber-300/20 via-amber-500/10 to-amber-700/20 opacity-80 blur-sm" />

                {/* Card Image Container */}
                <div className="relative h-full w-full overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20">
                  {/* Skeleton loader */}
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-amber-800/50 to-amber-900/50" />

                  {/* Main Image */}
                  <Image
                    src={resolveImageUrl(item.imageUrl)}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes={sizesAttr[size]}
                    priority
                  />

                  {/* Shine effect on new card */}
                  {showShine && !reducedMotion && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      style={{ transform: "skewX(-20deg)" }}
                      variants={shineAnimation}
                      initial="initial"
                      animate="animate"
                    />
                  )}

                  {/* Gradient overlay for text legibility */}
                  {showTitle && (
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  )}

                  {/* Card Name */}
                  {showTitle && (
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="text-center font-serif text-2xl font-bold tracking-wide text-white drop-shadow-lg md:text-3xl lg:text-4xl"
                        style={{
                          textShadow:
                            "0 2px 10px rgba(0,0,0,0.6), 0 4px 20px rgba(0,0,0,0.4)",
                        }}
                      >
                        {item.name}
                      </motion.h2>
                    </div>
                  )}

                  {/* Theme Color Accent Bar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: themeColor }}
                  />

                  {/* Flip Indicator - Enhanced with pulse animation */}
                  {item.longText && (
                    <motion.div
                      className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md"
                      variants={flipIndicatorVariants}
                      initial="idle"
                      animate="pulse"
                    >
                      <svg
                        className="h-4 w-4 text-amber-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                        />
                      </svg>
                      <span className="text-xs font-medium text-amber-100">
                        Tap to flip
                      </span>
                    </motion.div>
                  )}

                  {/* Out-of-sync indicator (spectator mode only) */}
                  {isOutOfSync && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-md">
                      <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                      <span className="text-[10px] font-medium text-white/80">
                        {outOfSyncText}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ============ CARD BACK ============ */}
              <div
                className={`absolute inset-0 ${sizeClasses[size]}`}
                style={{
                  aspectRatio: "4/5",
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div
                  className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20"
                  style={{
                    background: `linear-gradient(145deg, 
                      ${themeColor}15 0%, 
                      rgba(120, 53, 15, 0.95) 30%, 
                      rgba(69, 26, 3, 0.98) 70%, 
                      ${themeColor}10 100%)`,
                  }}
                >
                  {/* Decorative Pattern */}
                  <CardBackPattern />

                  {/* Corner Flourishes */}
                  <CornerFlourish position="tl" />
                  <CornerFlourish position="tr" />
                  <CornerFlourish position="bl" />
                  <CornerFlourish position="br" />

                  {/* Content Container - Fully Scrollable */}
                  <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
                    {/* Scroll fade at top */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-6 bg-gradient-to-b from-amber-950/80 to-transparent" />

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-none px-6 py-6 md:px-8 md:py-8">
                      <div className="flex flex-col items-center text-center">
                        {/* Card Number Badge */}
                        <div
                          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full font-mono text-sm font-bold text-white md:h-12 md:w-12 md:text-base"
                          style={{ backgroundColor: `${themeColor}90` }}
                        >
                          {currentNumber}
                        </div>

                        {/* Card Name */}
                        <h3 className="mb-3 font-serif text-xl font-bold tracking-wide text-amber-50 md:text-2xl lg:text-3xl">
                          {item.name}
                        </h3>

                        {/* Decorative Divider */}
                        <div className="mb-4 flex items-center justify-center gap-2">
                          <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-400/50" />
                          <div
                            className="h-2 w-2 rotate-45 rounded-sm"
                            style={{ backgroundColor: themeColor }}
                          />
                          <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-400/50" />
                        </div>

                        {/* Long Text */}
                        <p className="font-serif text-base leading-relaxed text-amber-50/90 md:text-lg lg:text-xl">
                          {item.longText ||
                            "No additional information available."}
                        </p>
                      </div>
                    </div>

                    {/* Scroll fade at bottom */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-gradient-to-t from-amber-950/80 to-transparent" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          /* Placeholder State */
          <motion.div
            key="placeholder"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`flex ${sizeClasses[size]} flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/20 bg-gradient-to-br from-amber-900/20 to-amber-950/30 backdrop-blur-sm`}
            style={{ aspectRatio: "4/5" }}
          >
            <div className="text-center text-amber-200/50">
              {/* Animated deck icon */}
              <motion.div
                animate={{
                  y: [0, -8, 0],
                  rotate: [0, 3, -3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="mx-auto mb-4"
              >
                <svg
                  className="h-16 w-16 md:h-20 md:w-20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </motion.div>
              <p className="font-serif text-lg md:text-xl">
                Draw a card to begin
              </p>
              <p className="mt-2 text-sm text-amber-300/40">
                {totalCards} cards in the deck
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Counter - Clean Design */}
      {showCounter && totalCards > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="flex items-center justify-center rounded-full bg-black/30 px-5 py-2.5 backdrop-blur-md ring-1 ring-white/10">
            <span className="font-mono text-base font-medium tracking-wider text-amber-100 md:text-lg">
              <span className="text-amber-300">{currentNumber}</span>
              <span className="text-amber-500/60"> / </span>
              <span className="text-amber-200/70">{totalCards}</span>
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default CurrentCard;
