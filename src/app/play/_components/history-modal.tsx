"use client";

/**
 * HistoryModal Component
 *
 * Full-screen modal displaying all called cards in a responsive grid.
 * Features:
 * - Responsive columns (6/4/3 based on screen size)
 * - Chronological order (first called at top-left)
 * - Current card highlighted
 * - Click to expand and show shortText
 *
 * @see SRD §5.7 History Modal
 * @see FR-040 through FR-045
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X } from "lucide-react";
import type { ItemDefinition } from "@/lib/types/game";

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
  index: number;
  isCurrent: boolean;
  isExpanded: boolean;
  onClick: () => void;
  reducedMotion?: boolean;
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

const cardVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.02,
      duration: 0.2,
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
// HISTORY CARD COMPONENT
// ============================================================================

function HistoryCard({
  item,
  index,
  isCurrent,
  isExpanded,
  onClick,
  reducedMotion,
}: HistoryCardProps) {
  return (
    <motion.button
      custom={index}
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
        ${isCurrent ? "ring-2 ring-amber-400" : "ring-1 ring-white/10"}
        ${isExpanded ? "col-span-1 md:col-span-2" : ""}
      `}
    >
      {/* Card Image */}
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <Image
          src={item.imageUrl}
          alt={item.name}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-105"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw"
        />

        {/* Current indicator */}
        {isCurrent && (
          <div className="absolute right-2 top-2">
            <span className="rounded-full bg-amber-400 px-2 py-1 text-xs font-bold text-amber-950">
              Current
            </span>
          </div>
        )}

        {/* Card number */}
        <div className="absolute bottom-2 left-2">
          <span className="rounded-full bg-black/50 px-2 py-1 text-xs font-mono text-white backdrop-blur-sm">
            #{index + 1}
          </span>
        </div>

        {/* Name overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <h3 className="font-serif text-sm font-bold text-white md:text-base">
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

            {/* Long text hint */}
            {item.longText && (
              <p className="mt-2 text-xs italic text-amber-300/60">
                Has additional information
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Handle card click (FR-045)
  // Note: expandedId resets naturally when modal reopens due to fresh render
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
            className="relative my-8 w-full max-w-6xl rounded-2xl bg-gradient-to-br from-amber-950 to-amber-900 p-4 shadow-2xl ring-1 ring-white/10 md:p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-modal-title"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2
                  id="history-modal-title"
                  className="font-serif text-2xl font-bold text-amber-100 md:text-3xl"
                >
                  Card History
                </h2>
                <p className="mt-1 text-sm text-amber-300/70">
                  {history.length} cards called
                </p>
              </div>

              <button
                onClick={onClose}
                className="rounded-full bg-amber-800/50 p-2 text-amber-200 transition-colors hover:bg-amber-700/60 focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="Close history modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Cards Grid (FR-040, FR-044) */}
            {history.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {history.map((item, index) => (
                  <HistoryCard
                    key={item.id}
                    item={item}
                    index={index}
                    isCurrent={currentItem?.id === item.id}
                    isExpanded={expandedId === item.id}
                    onClick={() => handleCardClick(item.id)}
                    reducedMotion={reducedMotion}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-center font-serif text-lg text-amber-300/50">
                  No cards have been called yet
                </p>
              </div>
            )}

            {/* Footer hint */}
            <div className="mt-6 text-center text-sm text-amber-400/50">
              Click a card to see its educational text
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default HistoryModal;

