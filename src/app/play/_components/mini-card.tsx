"use client";

/**
 * MiniCard Component
 *
 * Compact card preview for the Remote Controller.
 * Shows current card image and name in a smaller format.
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see FR-042 Mini card sync
 */

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { ItemDefinition } from "@/lib/types/game";
import { resolveImageUrl } from "@/lib/storage/image-url";

// ============================================================================
// TYPES
// ============================================================================

interface MiniCardProps {
  /** Current item to display */
  item: ItemDefinition | null;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className */
  className?: string;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const cardVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 10,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -10,
    transition: {
      duration: 0.15,
    },
  },
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MiniCard({
  item,
  reducedMotion = false,
  className = "",
}: MiniCardProps) {
  const variants = reducedMotion ? reducedMotionVariants : cardVariants;

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      role="region"
      aria-label="Current card preview"
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {item ? (
          <motion.div
            key={item.id}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center"
          >
            {/* Card Image Container */}
            <div
              className="relative overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10"
              style={{
                width: "120px",
                aspectRatio: "4/5",
              }}
            >
              {/* Skeleton loader */}
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-amber-800/50 to-amber-900/50" />
              <Image
                src={resolveImageUrl(item.imageUrl)}
                alt={item.name}
                fill
                className="object-cover transition-opacity duration-300"
                sizes="120px"
              />

              {/* Theme color accent */}
              {item.themeColor && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ backgroundColor: item.themeColor }}
                />
              )}
            </div>

            {/* Card Name */}
            <h3 className="mt-3 max-w-[150px] truncate text-center font-serif text-lg font-bold text-amber-100">
              {item.name}
            </h3>

            {/* Category badge (optional) */}
            {item.category && (
              <span className="mt-1 rounded-full bg-amber-800/50 px-2 py-0.5 text-xs text-amber-300">
                {item.category}
              </span>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            {/* Placeholder card */}
            <div
              className="flex items-center justify-center rounded-xl border-2 border-dashed border-amber-700/40 bg-amber-900/20"
              style={{
                width: "120px",
                aspectRatio: "4/5",
              }}
            >
              <div className="text-center text-amber-500/50">
                <svg
                  className="mx-auto h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            <p className="mt-3 text-center text-sm text-amber-400/60">
              Waiting for card...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MiniCard;

