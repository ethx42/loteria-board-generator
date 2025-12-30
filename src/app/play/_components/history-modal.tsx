"use client";

/**
 * HistoryModal Component
 *
 * Full-screen modal displaying all called cards with enterprise UX:
 * - Most recent card prominently displayed at top (hero section)
 * - Reverse chronological order (newest first)
 * - Clear visual hierarchy with recency indicators
 * - Responsive grid layout
 * - Click to expand and show educational text
 *
 * @see SRD §5.7 History Modal
 * @see FR-040 through FR-045
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Clock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ItemDefinition } from "@/lib/types/game";
import { resolveImageUrl } from "@/lib/storage/image-url";

// ============================================================================
// TYPES
// ============================================================================

interface HistoryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;

  /** Callback to close the modal */
  onClose: () => void;

  /** All called cards in chronological order (oldest first) */
  history: readonly ItemDefinition[];

  /** Current item (for highlighting) */
  currentItem: ItemDefinition | null;

  /** Whether reduced motion is preferred */
  reducedMotion?: boolean;
}

interface HistoryCardProps {
  item: ItemDefinition;
  /** Position in reverse order (0 = most recent) */
  reverseIndex: number;
  /** Original chronological position */
  originalIndex: number;
  /** Total number of cards */
  total: number;
  isCurrent: boolean;
  isExpanded: boolean;
  onClick: () => void;
  reducedMotion?: boolean;
}

interface HeroCardProps {
  item: ItemDefinition;
  total: number;
  isExpanded: boolean;
  onClick: () => void;
  reducedMotion?: boolean;
}

// ============================================================================
// RECENCY HELPERS
// ============================================================================

/**
 * Get translation key for recency label
 */
function getRecencyKey(reverseIndex: number): { key: string; count?: number } {
  switch (reverseIndex) {
    case 0:
      return { key: "justCalled" };
    case 1:
      return { key: "previous" };
    default:
      return { key: "cardsAgo", count: reverseIndex };
  }
}

/**
 * Get visual prominence based on recency (0 = most recent)
 */
function getRecencyStyles(reverseIndex: number): {
  opacity: number;
  scale: number;
  ring: string;
} {
  if (reverseIndex === 0) {
    return { opacity: 1, scale: 1, ring: "ring-2 ring-amber-400" };
  }
  if (reverseIndex === 1) {
    return { opacity: 0.95, scale: 1, ring: "ring-1 ring-amber-500/50" };
  }
  if (reverseIndex < 5) {
    return { opacity: 0.9, scale: 1, ring: "ring-1 ring-white/20" };
  }
  return { opacity: 0.8, scale: 1, ring: "ring-1 ring-white/10" };
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: {
      duration: 0.2,
    },
  },
};

const heroVariants = {
  initial: { opacity: 0, scale: 0.9, y: -10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const cardVariants = {
  initial: { opacity: 0, scale: 0.8, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.03, // Stagger after hero
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  }),
};

const expandedVariants = {
  collapsed: {
    height: "auto",
  },
  expanded: {
    height: "auto",
    transition: {
      duration: 0.3,
    },
  },
};

// ============================================================================
// HERO CARD COMPONENT (Most Recent)
// ============================================================================

function HeroCard({ item, total, isExpanded, onClick, reducedMotion }: HeroCardProps) {
  const t = useTranslations("history");
  
  return (
    <motion.button
      variants={reducedMotion ? undefined : heroVariants}
      initial="initial"
      animate="animate"
      layout
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-amber-800/80 to-amber-900/80 text-left shadow-xl ring-2 ring-amber-400 backdrop-blur-sm transition-transform hover:scale-[1.005] focus:outline-none focus:ring-4 focus:ring-amber-400/50"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="relative aspect-[4/5] w-full sm:aspect-square sm:w-48 md:w-56 shrink-0">
          <Image
            src={resolveImageUrl(item.imageUrl)}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 224px"
            priority
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-amber-900/90 sm:block hidden" />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-center p-4 sm:p-6">
          {/* Badge */}
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
              <Sparkles className="h-3 w-3" />
              {t("latestCard")}
            </span>
            <span className="text-xs text-amber-300/70">
              #{total} / {total}
            </span>
          </div>

          {/* Name */}
          <h3 className="font-serif text-xl font-bold text-amber-100 sm:text-2xl md:text-3xl">
            {item.name}
          </h3>

          {/* Category */}
          {item.category && (
            <span className="mt-2 inline-block w-fit rounded-full bg-amber-700/50 px-3 py-1 text-xs text-amber-200">
              {item.category}
            </span>
          )}

          {/* Short text - show full when expanded */}
          <p className={`mt-3 text-sm leading-relaxed text-amber-100/80 sm:text-base ${isExpanded ? "" : "line-clamp-2 sm:line-clamp-3"}`}>
            {item.shortText}
          </p>

          {/* Expanded: Long text */}
          <AnimatePresence>
            {isExpanded && item.longText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-3 text-sm leading-relaxed text-amber-200/70 italic border-l-2 border-amber-500/50 pl-3">
                  {item.longText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tap hint with expand indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs text-amber-400/60">
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                <span>{t("tapToCollapse")}</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                <span>{t("tapForDetails")}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================================
// HISTORY CARD COMPONENT (Previous Cards)
// ============================================================================

function HistoryCard({
  item,
  reverseIndex,
  originalIndex,
  total,
  isCurrent,
  isExpanded,
  onClick,
  reducedMotion,
}: HistoryCardProps) {
  const t = useTranslations("history");
  const recencyStyles = getRecencyStyles(reverseIndex);
  const recency = getRecencyKey(reverseIndex);
  
  // Get translated recency label
  const recencyLabel = recency.count !== undefined
    ? t("recency.cardsAgo", { count: recency.count })
    : t(`recency.${recency.key}`);

  return (
    <motion.button
      custom={reverseIndex}
      variants={reducedMotion ? undefined : cardVariants}
      initial="initial"
      animate="animate"
      layout
      onClick={onClick}
      className={`
        group relative flex flex-col overflow-hidden rounded-xl
        bg-amber-900/50 text-left
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-amber-950
        ${recencyStyles.ring}
        ${isExpanded ? "col-span-1 md:col-span-2" : ""}
      `}
      style={{ opacity: recencyStyles.opacity }}
    >
      {/* Card Image */}
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Image
          src={resolveImageUrl(item.imageUrl)}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-105"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
        />

        {/* Recency indicator (top-left) */}
        <div className="absolute left-2 top-2">
          <span className={`
            inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm
            ${reverseIndex === 0 
              ? "bg-amber-400 text-amber-950" 
              : reverseIndex < 3 
                ? "bg-amber-700/80 text-amber-100" 
                : "bg-black/50 text-white/80"
            }
          `}>
            <Clock className="h-2.5 w-2.5" />
            {recencyLabel}
          </span>
        </div>

        {/* Card number (top-right) */}
        <div className="absolute right-2 top-2">
          <span className="rounded-full bg-black/60 px-2 py-1 text-xs font-mono text-white/90 backdrop-blur-sm">
            #{originalIndex + 1}
          </span>
        </div>

        {/* Name overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <h3 className="font-serif text-sm font-bold text-white md:text-base line-clamp-2">
            {item.name}
          </h3>
        </div>
      </div>

      {/* Expanded content (FR-045) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={expandedVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="border-t border-amber-700/30 p-3"
          >
            {/* Category */}
            {item.category && (
              <span className="mb-2 inline-block rounded-full bg-amber-800/50 px-2 py-0.5 text-xs text-amber-200">
                {item.category}
              </span>
            )}

            {/* Short text */}
            <p className="text-sm leading-relaxed text-amber-100/90">
              {item.shortText}
            </p>

            {/* Long text */}
            {item.longText && (
              <p className="mt-2 text-xs italic text-amber-300/70 border-l-2 border-amber-500/30 pl-2">
                {item.longText}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HistoryModal({
  isOpen,
  onClose,
  history,
  currentItem,
  reducedMotion = false,
}: HistoryModalProps) {
  const t = useTranslations("history");
  const tCommon = useTranslations("common");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reverse history for display (newest first)
  const reversedHistory = useMemo(() => [...history].reverse(), [history]);
  
  // Get the most recent card (hero) and the rest
  const mostRecentCard = reversedHistory[0] ?? null;
  const previousCards = reversedHistory.slice(1);

  // Handle card click (FR-045)
  const handleCardClick = useCallback((itemId: string) => {
    setExpandedId((prev) => (prev === itemId ? null : itemId));
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset expanded state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setExpandedId(null);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={onClose}
        >
          {/* Modal Content */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative my-4 sm:my-8 w-full max-w-4xl rounded-2xl bg-gradient-to-br from-amber-950 to-amber-900 p-4 shadow-2xl ring-1 ring-white/10 md:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            {/* Header */}
            <div className="mb-4 sm:mb-6 flex items-center justify-between">
              <div>
                <h2
                  id="history-modal-title"
                  className="font-serif text-xl sm:text-2xl font-bold text-amber-100 md:text-3xl"
                >
                  {t("title")}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-amber-300/70">
                  {t("cardsPlayed", { count: history.length })} • {t("newestFirst")}
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full bg-amber-800/50 p-2 text-amber-200 transition-colors hover:bg-amber-700/60 focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label={tCommon("close")}
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>

            {history.length > 0 ? (
              <div className="space-y-6">
                {/* Hero Section: Most Recent Card */}
                {mostRecentCard && (
                  <section aria-label={t("latestCard")}>
                    <HeroCard
                      item={mostRecentCard}
                      total={history.length}
                      isExpanded={expandedId === mostRecentCard.id}
                      onClick={() => handleCardClick(mostRecentCard.id)}
                      reducedMotion={reducedMotion}
                    />
                  </section>
                )}

                {/* Previous Cards Section */}
                {previousCards.length > 0 && (
                  <section aria-label={t("previousCards")}>
                    <div className="mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400/70" />
                      <h3 className="text-sm font-medium text-amber-300/80">
                        {t("previousCards")}
                      </h3>
                      <span className="text-xs text-amber-400/50">
                        ({previousCards.length})
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-4 md:grid-cols-5">
                      {previousCards.map((item, displayIndex) => {
                        // reverseIndex: 0 = most recent (but hero is index 0, so these start at 1)
                        const reverseIndex = displayIndex + 1;
                        // originalIndex: position in original chronological order
                        const originalIndex = history.length - 1 - reverseIndex;
                        
                        return (
                          <HistoryCard
                            key={item.id}
                            item={item}
                            reverseIndex={reverseIndex}
                            originalIndex={originalIndex}
                            total={history.length}
                            isCurrent={currentItem?.id === item.id}
                            isExpanded={expandedId === item.id}
                            onClick={() => handleCardClick(item.id)}
                            reducedMotion={reducedMotion}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-800/30">
                    <Clock className="h-8 w-8 text-amber-400/50" />
                  </div>
                  <p className="font-serif text-lg text-amber-300/50">
                    {t("empty.title")}
                  </p>
                  <p className="mt-2 text-sm text-amber-400/40">
                    {t("empty.description")}
                  </p>
                </div>
              </div>
            )}

            {/* Footer hint */}
            {history.length > 0 && (
              <div className="mt-6 text-center text-xs sm:text-sm text-amber-400/50">
                {t("tapForDetails")}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default HistoryModal;

