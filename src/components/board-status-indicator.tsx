"use client";

/**
 * BoardStatusIndicator Component
 *
 * Collapsible panel showing board completion predictions.
 * Displays boards that are complete or nearly complete.
 *
 * Features:
 * - Collapse/expand animation
 * - Winner celebration on 100% completion
 * - Shows remaining items for each board
 * - Hidden when controller is connected (paired mode)
 *
 * @module components/board-status-indicator
 * @see TABULA_V4_DEVELOPMENT_PLAN §5 Phase 2C
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { BarChart3, ChevronDown, Trophy, Target } from "lucide-react";
import type { PredictionSummary, BoardPrediction } from "@/lib/types/boards";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface BoardStatusIndicatorProps {
  /** Prediction summary from useBoardPredictions hook */
  predictions: PredictionSummary | null;

  /** Whether the indicator should be visible */
  isVisible?: boolean;

  /** Position on screen */
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";

  /** Additional CSS classes */
  className?: string;
}

interface BoardRowProps {
  prediction: BoardPrediction;
  isFirst?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Single board row in the expanded view.
 */
function BoardRow({ prediction, isFirst }: BoardRowProps) {
  const t = useTranslations("boards");

  const progressBarColor = prediction.isComplete
    ? "bg-green-500"
    : prediction.isAlmostComplete
      ? "bg-amber-400"
      : "bg-amber-600";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: isFirst ? 0 : 0.05 }}
      className="py-2 border-b border-amber-800/20 last:border-0"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-amber-100">
          {prediction.isComplete ? (
            <Trophy className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Target className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span>#{prediction.number}</span>
        </span>
        <span className="text-xs font-mono text-amber-300">
          {prediction.percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", progressBarColor)}
          initial={{ width: 0 }}
          animate={{ width: `${prediction.percentComplete}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Remaining count */}
      {!prediction.isComplete && prediction.remainingItems.length <= 3 && (
        <p className="mt-1 text-xs text-amber-400/70">
          {t("remaining", { count: prediction.remainingItems.length })}
        </p>
      )}
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Board status indicator component.
 *
 * Shows a collapsible panel with board completion status.
 * Only visible when there are notable boards (complete or almost complete).
 *
 * @example
 * ```tsx
 * function HostDisplay({ session, boardsManifest }) {
 *   const predictions = useBoardPredictions(
 *     boardsManifest?.boards,
 *     session.history
 *   );
 *
 *   return (
 *     <BoardStatusIndicator
 *       predictions={predictions}
 *       isVisible={!session.connection.controllerConnected}
 *     />
 *   );
 * }
 * ```
 */
export function BoardStatusIndicator({
  predictions,
  isVisible = true,
  position = "bottom-left",
  className,
}: BoardStatusIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("boards");

  // Don't render if not visible or no predictions
  if (!isVisible || !predictions) return null;

  const { completedBoards, almostCompleteBoards, topBoards } = predictions;
  const hasNotableBoards = completedBoards.length > 0 || almostCompleteBoards.length > 0;

  // Don't render if no notable boards
  if (!hasNotableBoards) return null;

  // Position classes
  const positionClasses = {
    "bottom-left": "bottom-20 left-4",
    "bottom-right": "bottom-20 right-4",
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
  };

  // Determine header text
  const headerText = completedBoards.length > 0
    ? `🎉 ${t("complete", { count: completedBoards.length })}`
    : t("almostComplete", { count: almostCompleteBoards.length });

  // Boards to show in expanded view (prioritize complete, then almost)
  const displayBoards = [
    ...completedBoards.slice(0, 3),
    ...almostCompleteBoards.slice(0, 3 - completedBoards.length),
  ];

  return (
    <div
      className={cn(
        "fixed z-30",
        positionClasses[position],
        className
      )}
    >
      <motion.div
        layout
        className={cn(
          "rounded-xl bg-amber-950/80 backdrop-blur-sm",
          "border border-amber-800/30 overflow-hidden",
          "max-w-xs shadow-xl"
        )}
      >
        {/* Header (always visible) */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full px-4 py-2.5 flex items-center justify-between",
            "text-amber-200 hover:bg-amber-900/50 transition-colors cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-400"
          )}
          aria-expanded={isExpanded}
          aria-label={t("status")}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            {headerText}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-amber-800/30"
            >
              <div className="px-4 py-2 max-h-48 overflow-y-auto">
                {displayBoards.map((board, index) => (
                  <BoardRow
                    key={board.id}
                    prediction={board}
                    isFirst={index === 0}
                  />
                ))}
              </div>

              {/* Total boards info */}
              <div className="px-4 py-2 text-xs text-amber-400/60 border-t border-amber-800/20">
                {predictions.totalBoards} boards total
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Winner celebration overlay */}
      <AnimatePresence>
        {completedBoards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-2 -right-2"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-sm">
              {completedBoards.length}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BoardStatusIndicator;

