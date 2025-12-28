"use client";

/**
 * HistoryStrip Component
 *
 * Displays previously called cards with adaptive layout:
 * - Vertical layout on wide screens (≥1400px)
 * - Horizontal layout on standard screens (<1400px)
 *
 * Features visual hierarchy based on recency:
 * - Newest: full opacity, full scale, accent border
 * - Older: decreasing opacity and scale
 *
 * @see SRD §5.6 History Strip Component
 * @see FR-035a, FR-035b, FR-035c
 */

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import Image from "next/image";
import type { ItemDefinition } from "@/lib/types/game";

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

  /** Maximum number of cards to display */
  maxCards?: number;

  /** Whether to use vertical layout (auto-detected by default) */
  forceVertical?: boolean;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className for the container */
  className?: string;
}

interface HistoryCardProps {
  item: ItemDefinition;
  index: number;
  total: number;
  isNewest: boolean;
  onClick?: () => void;
  reducedMotion?: boolean;
  isVertical: boolean;
}

// ============================================================================
// VISUAL HIERARCHY CALCULATIONS (SRD §5.6)
// ============================================================================

/**
 * Calculate visual properties based on position in history.
 * Newest items are most prominent, older items fade.
 */
function getVisualHierarchy(index: number, total: number) {
  const position = total - index; // 1 = newest, higher = older

  // Hierarchy values per SRD §5.6
  const hierarchies = [
    { opacity: 1.0, scale: 1.0, borderWidth: 2 }, // Newest
    { opacity: 0.85, scale: 0.95, borderWidth: 1 }, // 2nd
    { opacity: 0.7, scale: 0.9, borderWidth: 1 }, // 3rd
  ];

  if (position <= 3) {
    return hierarchies[position - 1];
  }

  // Linear fade for 4th+ items
  const fadeProgress = Math.min((position - 3) / (total - 3), 1);
  return {
    opacity: 0.7 - fadeProgress * 0.3, // Fade to 0.4
    scale: 0.9 - fadeProgress * 0.1, // Scale to 0.8
    borderWidth: 0,
  };
}

// ============================================================================
// ANIMATION VARIANTS (SRD §5.4)
// ============================================================================

const cardEnterVariants = {
  initial: {
    scale: 0,
    opacity: 0,
  },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

const reducedMotionCardVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// HISTORY CARD COMPONENT
// ============================================================================

function HistoryCard({
  item,
  index,
  total,
  isNewest,
  onClick,
  reducedMotion,
  isVertical,
}: HistoryCardProps) {
  const hierarchy = getVisualHierarchy(index, total);
  const variants = reducedMotion ? reducedMotionCardVariants : cardEnterVariants;

  return (
    <motion.button
      layout
      layoutId={item.id}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={onClick}
      className={`
        group relative shrink-0 overflow-hidden rounded-lg
        transition-transform duration-200 hover:z-10 hover:scale-105
        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950
        ${isVertical ? "w-20 md:w-24" : "h-20 w-14 md:h-24 md:w-16"}
      `}
      style={{
        opacity: hierarchy.opacity,
        transform: `scale(${hierarchy.scale})`,
        boxShadow: isNewest
          ? "0 0 0 2px var(--accent-color, #f59e0b)"
          : hierarchy.borderWidth > 0
            ? "0 0 0 1px rgba(255,255,255,0.2)"
            : "none",
        aspectRatio: isVertical ? "2/3" : undefined,
      }}
      aria-label={`${item.name}, card ${total - index} of ${total}`}
    >
      {/* Card Image */}
      <Image
        src={item.imageUrl}
        alt={item.name}
        fill
        className="object-cover"
        sizes={isVertical ? "96px" : "64px"}
      />

      {/* Hover overlay with name */}
      <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <span className="w-full truncate px-1 pb-1 text-center text-[10px] font-medium text-white">
          {item.name}
        </span>
      </div>

      {/* Newest badge */}
      {isNewest && (
        <div className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-amber-400 ring-2 ring-amber-950" />
      )}
    </motion.button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HistoryStrip({
  history,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentItem,
  onCardClick,
  onOpenModal,
  maxCards = 10,
  forceVertical,
  reducedMotion = false,
  className = "",
}: HistoryStripProps) {
  // State for detecting layout
  const [isWideScreen, setIsWideScreen] = useState(false);

  // Check screen width for layout decision
  const checkWidth = useCallback(() => {
    if (typeof window !== "undefined") {
      setIsWideScreen(window.innerWidth >= 1400);
    }
  }, []);

  // Initialize on mount
  useMemo(() => {
    checkWidth();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", checkWidth);
      return () => window.removeEventListener("resize", checkWidth);
    }
  }, [checkWidth]);

  const isVertical = forceVertical ?? isWideScreen;

  // Get visible cards (most recent first for display)
  const visibleHistory = useMemo(() => {
    return [...history].reverse().slice(0, maxCards);
  }, [history, maxCards]);

  const hasMoreCards = history.length > maxCards;

  if (history.length === 0) {
    return null;
  }

  return (
    <div
      className={`
        flex items-center gap-2
        ${
          isVertical
            ? "h-full flex-col justify-start py-4"
            : "w-full flex-row justify-center px-4"
        }
        ${className}
      `}
      role="region"
      aria-label="Previously called cards"
    >
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {visibleHistory.map((item, displayIndex) => {
            // Calculate actual position in original history
            const actualIndex = history.length - 1 - displayIndex;

            return (
              <HistoryCard
                key={item.id}
                item={item}
                index={actualIndex}
                total={history.length}
                isNewest={displayIndex === 0}
                onClick={onCardClick ? () => onCardClick(item, actualIndex) : undefined}
                reducedMotion={reducedMotion}
                isVertical={isVertical}
              />
            );
          })}
        </AnimatePresence>
      </LayoutGroup>

      {/* "View all" button */}
      {hasMoreCards && onOpenModal && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onOpenModal}
          className={`
            flex shrink-0 items-center justify-center rounded-lg
            bg-amber-900/50 text-amber-200 backdrop-blur-sm
            transition-colors hover:bg-amber-800/60
            focus:outline-none focus:ring-2 focus:ring-amber-400
            ${isVertical ? "w-20 py-2 md:w-24" : "h-16 px-3 md:h-20"}
          `}
          aria-label={`View all ${history.length} cards`}
        >
          <span className="text-xs font-medium">
            +{history.length - maxCards} more
          </span>
        </motion.button>
      )}
    </div>
  );
}

export default HistoryStrip;

