"use client";

/**
 * ControllerCurrentCard Component
 *
 * Enterprise-grade current card display for the Remote Controller.
 * Features a rich, expandable design that provides full card information
 * while maintaining controller functionality.
 *
 * UX Principles Applied:
 * - Progressive disclosure: Show essential info, expand for more
 * - Visual hierarchy: Card image prominent, text secondary
 * - Touch-friendly: Large tap targets, smooth animations
 * - Accessibility: ARIA labels, keyboard support
 *
 * @see SRD §5.2 Remote Controller Layout
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronDown, ChevronUp, Sparkles, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ItemDefinition } from "@/lib/types/game";
import { resolveImageUrl } from "@/lib/storage/image-url";

// ============================================================================
// TYPES
// ============================================================================

interface ControllerCurrentCardProps {
  /** Current item to display */
  item: ItemDefinition | null;
  /** Current card number (1-indexed) */
  cardNumber: number;
  /** Total cards in deck */
  totalCards: number;
  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const cardVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
};

const expandVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: { type: "spring" as const, stiffness: 300, damping: 30 },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
};

const placeholderVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ControllerCurrentCard({
  item,
  cardNumber,
  totalCards,
  reducedMotion = false,
}: ControllerCurrentCardProps) {
  const t = useTranslations("game");
  const tHistory = useTranslations("history");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Reset expanded state when card changes
  const handleCardChange = useCallback(() => {
    setIsExpanded(false);
  }, []);

  return (
    <div
      className="w-full max-w-sm mx-auto"
      role="region"
      aria-label={t("card.current")}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" onExitComplete={handleCardChange}>
        {item ? (
          <motion.div
            key={item.id}
            variants={reducedMotion ? placeholderVariants : cardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            {/* Card Container - Tappable */}
            <button
              onClick={handleToggleExpand}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950 rounded-2xl"
              aria-expanded={isExpanded}
              aria-label={`${item.name}. ${isExpanded ? tHistory("tapToCollapse") : tHistory("tapForDetails")}`}
            >
              {/* Main Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-800/60 to-amber-900/60 shadow-xl ring-2 ring-amber-400/50 backdrop-blur-sm">
                {/* Image Section */}
                <div className="relative">
                  {/* Card Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    {/* Skeleton loader */}
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-amber-800/50 to-amber-900/50" />
                    <Image
                      src={resolveImageUrl(item.imageUrl)}
                      alt={item.name}
                      fill
                      className="object-cover transition-opacity duration-300"
                      sizes="(max-width: 640px) 100vw, 384px"
                      priority
                    />
                    
                    {/* Gradient overlay for text legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </div>

                  {/* Floating Badge - Card Number */}
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      {t("card.current")}
                    </span>
                  </div>

                  {/* Card Counter */}
                  <div className="absolute top-3 right-3">
                    <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-mono text-white backdrop-blur-sm">
                      {cardNumber} / {totalCards}
                    </span>
                  </div>

                  {/* Card Name - Overlaid on Image */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h2 className="font-serif text-2xl font-bold text-white drop-shadow-lg">
                      {item.name}
                    </h2>
                    {item.category && (
                      <span className="mt-1 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4">
                  {/* Short Text - Always Visible */}
                  <p className={`text-sm leading-relaxed text-amber-100/90 ${isExpanded ? "" : "line-clamp-2"}`}>
                    {item.shortText}
                  </p>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && item.longText && (
                      <motion.div
                        variants={expandVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="overflow-hidden"
                      >
                        <div className="mt-4 flex items-start gap-2 border-l-2 border-amber-500/50 pl-3">
                          <BookOpen className="h-4 w-4 text-amber-400/70 shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed text-amber-200/80 italic">
                            {item.longText}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expand/Collapse Indicator */}
                  <div className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-400/70">
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        <span>{tHistory("tapToCollapse")}</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        <span>{tHistory("tapForDetails")}</span>
                        {item.longText && (
                          <span className="ml-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                            +info
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            variants={placeholderVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full"
          >
            {/* Placeholder Card */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-700/40 bg-amber-900/20 p-8">
              <div className="flex flex-col items-center justify-center text-center">
                {/* Icon */}
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-800/30">
                  <svg
                    className="h-8 w-8 text-amber-500/50"
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
                
                {/* Text */}
                <p className="font-serif text-lg font-medium text-amber-300/60">
                  {t("card.noCard")}
                </p>
                <p className="mt-1 text-sm text-amber-400/40">
                  {t("card.draw")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ControllerCurrentCard;

