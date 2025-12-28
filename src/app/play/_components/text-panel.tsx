"use client";

/**
 * TextPanel Component
 *
 * Displays the educational shortText alongside the current card.
 * Animates in from the right with a delayed entrance.
 *
 * @see SRD §5.1 Host Display Layout
 * @see SRD §5.4 Animation Specifications
 * @see FR-032, FR-033
 */

import { motion, AnimatePresence } from "framer-motion";
import type { ItemDefinition } from "@/lib/types/game";

// ============================================================================
// TYPES
// ============================================================================

interface TextPanelProps {
  /** The current item to display text for */
  item: ItemDefinition | null;

  /** Current card number (1-indexed) */
  currentNumber?: number;

  /** Total number of cards in the deck */
  totalCards?: number;

  /** Whether to show the card counter embedded in panel */
  showCounter?: boolean;

  /** Whether to show the category badge */
  showCategory?: boolean;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;

  /** Custom className for the container */
  className?: string;
}

// ============================================================================
// ANIMATION VARIANTS (SRD §5.4)
// ============================================================================

const panelVariants = {
  initial: {
    opacity: 0,
    x: 50,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
      delay: 0.3,
    },
  },
  exit: {
    opacity: 0,
    x: 50,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { delay: 0.3 } },
  exit: { opacity: 0 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TextPanel({
  item,
  currentNumber,
  totalCards,
  showCounter = false,
  showCategory = true,
  reducedMotion = false,
  className = "",
}: TextPanelProps) {
  const variants = reducedMotion ? reducedMotionVariants : panelVariants;

  return (
    <div className={`flex flex-col ${className}`}>
      <AnimatePresence mode="wait">
        {item ? (
          <motion.div
            key={item.id}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="rounded-2xl bg-gradient-to-br from-amber-900/90 to-amber-950/95 p-6 shadow-xl ring-1 ring-white/10 backdrop-blur-sm md:p-8 lg:p-10"
          >
            {/* Header with name and optional category */}
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-serif text-2xl font-bold text-amber-100 md:text-3xl lg:text-4xl">
                {item.name}
              </h2>

              {showCategory && item.category && (
                <span className="shrink-0 rounded-full bg-amber-800/50 px-3 py-1 text-sm font-medium text-amber-200">
                  {item.category}
                </span>
              )}
            </div>

            {/* Theme color accent line */}
            <div
              className="mb-6 h-1 w-16 rounded-full"
              style={{
                backgroundColor: item.themeColor || "#b45309",
              }}
              aria-hidden="true"
            />

            {/* Educational short text (FR-032) */}
            <p className="font-serif text-lg leading-relaxed text-amber-50/90 md:text-xl lg:text-2xl">
              {item.shortText}
            </p>

            {/* Optional hint for long text */}
            {item.longText && (
              <p className="mt-4 text-sm italic text-amber-200/60">
                Tap the card to learn more
              </p>
            )}

            {/* Embedded counter (FR-033) */}
            {showCounter && currentNumber && totalCards && (
              <div className="mt-6 flex items-center justify-between border-t border-amber-700/30 pt-4">
                <span className="text-sm text-amber-300/70">Card</span>
                <span className="font-mono text-lg font-semibold text-amber-100">
                  {currentNumber} of {totalCards}
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-amber-200/20 bg-amber-950/30 p-6"
          >
            <p className="text-center font-serif text-lg text-amber-200/40">
              Draw a card to see its story
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TextPanel;

