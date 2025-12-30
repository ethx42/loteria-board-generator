"use client";

/**
 * HistoryStrip Component - Enterprise Edition
 *
 * Premium history display with storytelling elements:
 * - Number badges on each card for quick reference
 * - Visual hierarchy with newest cards prominent
 * - Animated connectors between cards (visual narrative)
 * - Glassmorphic design with refined aesthetics
 * - Auto-scroll with smooth animation
 *
 * @see SRD §5.6 History Strip Component
 * @see FR-035a, FR-035b, FR-035c
 */

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import Image from "next/image";
import type { ItemDefinition } from "@/lib/types/game";
import { cn } from "@/lib/utils";
import { resolveImageUrl } from "@/lib/storage/image-url";

// ============================================================================
// TYPES
// ============================================================================

interface HistoryStripProps {
  /** Array of previously called items (oldest first, newest last) */
  history: readonly ItemDefinition[];

  /** Currently displayed item (for highlighting) */
  currentItem: ItemDefinition | null;

  /** Callback when clicking a history card */
  onCardClick?: (item: ItemDefinition, index: number) => void;

  /** Callback to open full history modal */
  onOpenModal?: () => void;

  /** Maximum number of cards to display (ignored when scrollable=true) */
  maxCards?: number;

  /** Whether to use vertical layout (auto-detected by default) */
  forceVertical?: boolean;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className for the container */
  className?: string;

  /** Enable scrollable container */
  scrollable?: boolean;

  /** Show fade effect at the edge */
  fadeEdge?: boolean;

  /** Auto-scroll to newest card */
  autoScrollToNewest?: boolean;
}

interface HistoryCardProps {
  item: ItemDefinition;
  index: number;
  displayIndex: number;
  total: number;
  isNewest: boolean;
  onClick?: () => void;
  reducedMotion?: boolean;
  isVertical: boolean;
  themeColor?: string;
}

// ============================================================================
// VISUAL HIERARCHY CALCULATIONS
// ============================================================================

/**
 * Calculate visual properties based on position in history.
 * Premium tier system: newest items are most prominent.
 */
function getVisualHierarchy(displayIndex: number) {
  // displayIndex 0 = newest (most prominent)
  // Higher = older (less prominent)

  const hierarchies = [
    { opacity: 1.0, scale: 1.0, ring: true }, // Newest
    { opacity: 0.9, scale: 0.96, ring: false }, // 2nd
    { opacity: 0.8, scale: 0.92, ring: false }, // 3rd
    { opacity: 0.7, scale: 0.88, ring: false }, // 4th
  ];

  if (displayIndex < 4) {
    return hierarchies[displayIndex];
  }

  // Fade for older items
  const fadeProgress = Math.min((displayIndex - 3) / 6, 1);
  return {
    opacity: 0.7 - fadeProgress * 0.35,
    scale: 0.88 - fadeProgress * 0.08,
    ring: false,
  };
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const cardEnterVariants = {
  initial: {
    scale: 0.5,
    opacity: 0,
    x: -30,
  },
  animate: {
    scale: 1,
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
      mass: 0.8,
    },
  },
  exit: {
    scale: 0.7,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn" as const,
    },
  },
};

const cardEnterVariantsVertical = {
  initial: {
    scale: 0.5,
    opacity: 0,
    y: -30,
  },
  animate: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
      mass: 0.8,
    },
  },
  exit: {
    scale: 0.7,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: "easeIn" as const,
    },
  },
};

const reducedMotionCardVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const layoutTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 35,
  mass: 0.8,
};

// ============================================================================
// HISTORY CARD COMPONENT
// ============================================================================

function HistoryCard({
  item,
  index,
  displayIndex,
  total,
  isNewest,
  onClick,
  reducedMotion,
  isVertical,
  themeColor = "#f59e0b",
}: HistoryCardProps) {
  const hierarchy = getVisualHierarchy(displayIndex);
  const cardNumber = total - displayIndex; // Card number (1 = first drawn, total = last drawn)

  const variants = reducedMotion
    ? reducedMotionCardVariants
    : isVertical
      ? cardEnterVariantsVertical
      : cardEnterVariants;

  return (
    <motion.div
      layout
      layoutId={item.id}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={layoutTransition}
      className="relative shrink-0"
    >
      {/* Card Button */}
      <motion.button
        onClick={onClick}
        className={cn(
          "group relative overflow-hidden rounded-xl",
          "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950",
          "transition-shadow duration-200",
          isVertical ? "w-20 md:w-24" : "h-20 w-14 md:h-24 md:w-16"
        )}
        style={{
          opacity: hierarchy.opacity,
          aspectRatio: isVertical ? "4/5" : undefined,
          boxShadow: hierarchy.ring
            ? `0 0 0 2px ${themeColor}, 0 4px 20px ${themeColor}40`
            : isNewest
              ? `0 0 0 2px ${themeColor}80`
              : "0 2px 10px rgba(0,0,0,0.3)",
        }}
        whileHover={{
          scale: 1.1,
          zIndex: 20,
          transition: { duration: 0.2 },
        }}
        whileTap={{ scale: 0.95 }}
        aria-label={`${item.name}, card ${cardNumber} of ${total}`}
      >
        {/* Skeleton */}
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-amber-800/50 to-amber-900/50" />

        {/* Image */}
        <Image
          src={resolveImageUrl(item.imageUrl)}
          alt={item.name}
          fill
          className="object-cover"
          sizes={isVertical ? "96px" : "64px"}
        />

        {/* Number Badge - Always visible */}
        <div
          className={cn(
            "absolute flex items-center justify-center font-mono text-xs font-bold text-white",
            "shadow-lg",
            isNewest
              ? "left-1/2 top-1 h-5 w-5 -translate-x-1/2 rounded-full md:h-6 md:w-6 md:text-sm"
              : "right-0.5 top-0.5 h-4 w-4 rounded-md text-[10px] md:h-5 md:w-5 md:text-xs"
          )}
          style={{
            backgroundColor: isNewest ? themeColor : "rgba(0,0,0,0.6)",
          }}
        >
          {cardNumber}
        </div>

        {/* Hover overlay with gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        {/* Name on hover */}
        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-1.5 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <span className="block truncate text-center text-[9px] font-medium text-white md:text-[10px]">
            {item.name}
          </span>
        </div>

        {/* Newest indicator glow */}
        {isNewest && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              boxShadow: `inset 0 0 20px ${themeColor}30`,
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
// CONNECTOR COMPONENT (Visual storytelling)
// ============================================================================

function Connector({ isVertical }: { isVertical: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 opacity-30",
        isVertical
          ? "flex h-3 w-full items-center justify-center"
          : "flex h-full w-3 flex-col items-center justify-center"
      )}
    >
      <div
        className={cn(
          "rounded-full bg-gradient-to-r from-amber-600/50 to-amber-400/50",
          isVertical ? "h-0.5 w-4" : "h-4 w-0.5"
        )}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HistoryStrip({
  history,
  currentItem,
  onCardClick,
  onOpenModal,
  maxCards = 10,
  forceVertical,
  reducedMotion = false,
  className = "",
  scrollable = false,
  fadeEdge = false,
  autoScrollToNewest = false,
}: HistoryStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isWideScreen, setIsWideScreen] = useState(false);

  // Screen width detection
  const checkWidth = useCallback(() => {
    if (typeof window !== "undefined") {
      setIsWideScreen(window.innerWidth >= 1400);
    }
  }, []);

  useEffect(() => {
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, [checkWidth]);

  const isVertical = forceVertical ?? isWideScreen;

  // Get theme color from current or most recent item
  const themeColor = useMemo(() => {
    return currentItem?.themeColor || history[history.length - 1]?.themeColor || "#f59e0b";
  }, [currentItem, history]);

  // Prepare visible history (newest first)
  const visibleHistory = useMemo(() => {
    const reversed = [...history].reverse();
    return scrollable ? reversed : reversed.slice(0, maxCards);
  }, [history, maxCards, scrollable]);

  const hasMoreCards = !scrollable && history.length > maxCards;

  // Auto-scroll to newest
  useEffect(() => {
    if (autoScrollToNewest && scrollRef.current && history.length > 0) {
      scrollRef.current.scrollTo({
        [isVertical ? "top" : "left"]: 0,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  }, [history.length, autoScrollToNewest, isVertical, reducedMotion]);

  if (history.length === 0) {
    return null;
  }

  // Scrollable CSS
  const scrollableClasses = scrollable
    ? cn(
        isVertical ? "overflow-y-auto" : "overflow-x-auto",
        "scrollbar-none scroll-smooth"
      )
    : "";

  // Fade edge styles
  const fadeStyles: React.CSSProperties = fadeEdge
    ? {
        maskImage: isVertical
          ? "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)"
          : "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
        WebkitMaskImage: isVertical
          ? "linear-gradient(to bottom, black 0%, black 85%, transparent 100%)"
          : "linear-gradient(to right, black 0%, black 85%, transparent 100%)",
      }
    : {};

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex items-center",
        isVertical
          ? "h-full flex-col justify-start gap-1 py-4"
          : scrollable
            ? "flex-row justify-start gap-2 px-4"
            : "w-full flex-row justify-center gap-2 px-4",
        scrollableClasses,
        className
      )}
      style={fadeStyles}
      role="region"
      aria-label={`History: ${history.length} cards called`}
    >
      {/* Header for vertical layout */}
      {isVertical && (
        <div className="mb-3 flex w-full flex-col items-center px-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/60">
            History
          </span>
          <span className="mt-0.5 font-mono text-lg font-bold text-amber-200">
            {history.length}
          </span>
        </div>
      )}

      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {visibleHistory.map((item, displayIndex) => {
            const actualIndex = history.length - 1 - displayIndex;

            return (
              <motion.div
                key={item.id}
                className={cn(
                  "flex shrink-0",
                  isVertical ? "w-full flex-col items-center" : "flex-row items-center"
                )}
              >
                {/* Connector (not before first card) */}
                {displayIndex > 0 && !reducedMotion && (
                  <Connector isVertical={isVertical} />
                )}

                <HistoryCard
                  item={item}
                  index={actualIndex}
                  displayIndex={displayIndex}
                  total={history.length}
                  isNewest={displayIndex === 0}
                  onClick={onCardClick ? () => onCardClick(item, actualIndex) : undefined}
                  reducedMotion={reducedMotion}
                  isVertical={isVertical}
                  themeColor={themeColor}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </LayoutGroup>

      {/* "View all" button */}
      {hasMoreCards && onOpenModal && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={onOpenModal}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl",
            "bg-amber-900/60 backdrop-blur-sm",
            "ring-1 ring-amber-700/40",
            "transition-all duration-200 hover:bg-amber-800/70 hover:ring-amber-600/50",
            "focus:outline-none focus:ring-2 focus:ring-amber-400",
            isVertical ? "mt-2 w-20 py-3 md:w-24" : "ml-2 h-20 px-4 md:h-24"
          )}
          aria-label={`View all ${history.length} cards`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-mono text-sm font-bold text-amber-300">
              +{history.length - maxCards}
            </span>
            <span className="text-[10px] text-amber-400/70">more</span>
          </div>
        </motion.button>
      )}
    </div>
  );
}

export default HistoryStrip;
