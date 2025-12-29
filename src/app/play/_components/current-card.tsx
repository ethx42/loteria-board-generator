"use client";

/**
 * CurrentCard Component
 *
 * Displays the current card in the game with a 2:3 aspect ratio.
 * Supports 3D flip animation to reveal longText content.
 *
 * @see SRD §5.1 Host Display Layout
 * @see FR-030 through FR-034
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { ItemDefinition } from "@/lib/types/game";

// ============================================================================
// TYPES
// ============================================================================

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
}

// ============================================================================
// ANIMATION VARIANTS (SRD §5.4)
// ============================================================================

const cardEntranceVariants = {
  initial: {
    rotateY: -90,
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    rotateY: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
    },
  },
  exit: {
    rotateY: 90,
    opacity: 0,
    scale: 0.8,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
    },
  },
};

const reducedMotionVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const flipVariants = {
  front: {
    rotateY: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  back: {
    rotateY: 180,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function CurrentCard({
  item,
  currentNumber,
  totalCards,
  showCounter = true,
  reducedMotion = false,
  className = "",
}: CurrentCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip state when item changes
  const handleItemChange = useCallback(() => {
    setIsFlipped(false);
  }, []);

  // Toggle flip on click (FR-034)
  const handleClick = useCallback(() => {
    if (item?.longText) {
      setIsFlipped((prev) => !prev);
    }
  }, [item?.longText]);

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

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      style={{ perspective: "1000px" }}
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
              animate={isFlipped ? "back" : "front"}
              variants={flipVariants}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Card Front */}
              <div
                className="relative w-[280px] md:w-[320px] lg:w-[380px]"
                style={{
                  aspectRatio: "2/3",
                  backfaceVisibility: "hidden",
                }}
              >
                {/* Card Image (FR-030) */}
                <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 shadow-2xl ring-1 ring-black/10">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 280px, (max-width: 1024px) 320px, 380px"
                    priority
                  />

                  {/* Gradient overlay for text legibility */}
                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

                  {/* Card Name (FR-031) */}
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                    <h2
                      className="text-center font-serif text-2xl font-bold text-white drop-shadow-lg md:text-3xl lg:text-4xl"
                      style={{
                        textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                      }}
                    >
                      {item.name}
                    </h2>
                  </div>

                  {/* Theme Color Accent */}
                  {item.themeColor && (
                    <div
                      className="absolute right-3 top-3 h-3 w-3 rounded-full ring-2 ring-white/50"
                      style={{ backgroundColor: item.themeColor }}
                      aria-hidden="true"
                    />
                  )}

                  {/* Flip indicator */}
                  {item.longText && (
                    <div className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Back (FR-034) */}
              <div
                className="absolute inset-0 w-[280px] md:w-[320px] lg:w-[380px]"
                style={{
                  aspectRatio: "2/3",
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-800 to-amber-950 p-6 shadow-2xl ring-1 ring-white/10">
                  {/* Card Name on Back */}
                  <h3 className="mb-4 font-serif text-xl font-bold text-amber-100 md:text-2xl">
                    {item.name}
                  </h3>

                  {/* Long Text */}
                  <p className="text-center font-serif text-base leading-relaxed text-amber-50/90 md:text-lg">
                    {item.longText || "No additional information available."}
                  </p>

                  {/* Flip back hint */}
                  <div className="mt-6 text-sm text-amber-200/60">
                    Tap to flip back
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full w-[280px] flex-col items-center justify-center rounded-2xl border-4 border-dashed border-amber-200/30 bg-amber-50/10 md:w-[320px] lg:w-[380px]"
            style={{ aspectRatio: "2/3" }}
          >
            <div className="text-center text-amber-200/60">
              <svg
                className="mx-auto mb-4 h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="font-serif text-lg">Draw a card to begin</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Counter (FR-033) */}
      {showCounter && totalCards > 0 && (
        <div className="mt-4 text-center">
          <span className="rounded-full bg-amber-900/80 px-4 py-2 font-mono text-lg text-amber-100 backdrop-blur-sm">
            {currentNumber} / {totalCards}
          </span>
        </div>
      )}
    </div>
  );
}

export default CurrentCard;
