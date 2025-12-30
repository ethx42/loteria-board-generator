"use client";

/**
 * DetailedTextAccordion Component
 *
 * A minimal expandable section for deep-dive content.
 * Designed to be unobtrusive - its presence communicates availability.
 *
 * Features:
 * - Minimal design with book icon
 * - Smooth expand/collapse animation
 * - stopPropagation to prevent parent click interference
 * - Sync state indicators for spectators
 *
 * @see SRD §5.1.4 Detailed Text Display
 */

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, BookOpen } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface DetailedTextAccordionProps {
  /** The detailed text content to display */
  detailedText: string;

  /** Whether the accordion is expanded */
  isExpanded: boolean;

  /** Callback when expansion state changes */
  onToggle: () => void;

  /** Theme color for accent styling */
  themeColor?: string;

  /** Whether this state was synced from controller (for UI indicator) */
  isSyncedFromController?: boolean;

  /** Whether spectator has locally overridden (for UI indicator) */
  isLocalOverride?: boolean;

  /** i18n text for "Read more" */
  expandText?: string;

  /** i18n text for "Show less" */
  collapseText?: string;

  /** i18n text for "Synced from controller" */
  syncedText?: string;

  /** i18n text for "Personal view" */
  overrideText?: string;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: 0.25,
        ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.15 },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1] as [number, number, number, number],
      },
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
};

const chevronVariants = {
  collapsed: { rotate: 0 },
  expanded: { rotate: 180 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function DetailedTextAccordion({
  detailedText,
  isExpanded,
  onToggle,
  themeColor = "#d97706",
  isSyncedFromController = false,
  isLocalOverride = false,
  expandText = "Read more",
  collapseText = "Show less",
  syncedText = "Synced from controller",
  overrideText = "Personal view",
}: DetailedTextAccordionProps) {
  // Handle click with stopPropagation to prevent parent interactions
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle();
    },
    [onToggle]
  );

  // Handle keyboard with stopPropagation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }
    },
    [onToggle]
  );

  return (
    <div className="mt-4 w-full" onClick={(e) => e.stopPropagation()}>
      {/* Subtle divider */}
      <div className="mb-3 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

      {/* Trigger Button - Minimal */}
      <button
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-amber-800/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        aria-expanded={isExpanded}
        aria-controls="detailed-content"
      >
        <div className="flex items-center gap-2">
          <BookOpen
            className="h-4 w-4 text-amber-400/70"
            strokeWidth={1.5}
          />
          <span className="text-sm font-medium text-amber-200/80">
            {isExpanded ? collapseText : expandText}
          </span>
          {/* Sync/Override Status - Small badge */}
          {(isSyncedFromController || isLocalOverride) && (
            <span className="text-[10px] text-amber-400/50">
              ({isLocalOverride ? overrideText : syncedText})
            </span>
          )}
        </div>

        <motion.div
          variants={chevronVariants}
          animate={isExpanded ? "expanded" : "collapsed"}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown
            className="h-4 w-4 text-amber-400/60"
            strokeWidth={1.5}
          />
        </motion.div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            id="detailed-content"
            variants={contentVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 pt-3">
              {/* Accent border on left */}
              <div
                className="border-l-2 pl-3"
                style={{ borderColor: `${themeColor}60` }}
              >
                <p className="text-sm leading-relaxed text-amber-100/80">
                  {detailedText}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DetailedTextAccordion;
