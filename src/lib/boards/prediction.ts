/**
 * Board Prediction Engine
 *
 * Calculates board completion predictions based on called items.
 * Used for the board tracking feature in v4.0.
 *
 * @complexity O(B × I) where B=boards, I=items per board
 *
 * @module lib/boards/prediction
 * @see TABULA_V4_DEVELOPMENT_PLAN §5 Phase 2C
 */

import type {
  BoardDefinition,
  BoardPrediction,
  PredictionSummary,
} from "../types/boards";
import { normalizeItemId } from "./normalize";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for "almost complete" status (percentage) */
const ALMOST_COMPLETE_THRESHOLD = 80;

/** Maximum boards to show in top boards list */
const TOP_BOARDS_LIMIT = 5;

// ============================================================================
// CORE PREDICTION FUNCTIONS
// ============================================================================

/**
 * Calculates completion prediction for a single board.
 *
 * @param board - Board definition to analyze
 * @param calledItemIds - Set of called item IDs (normalized)
 * @returns Prediction for this board
 */
export function calculateBoardPrediction(
  board: BoardDefinition,
  calledItemIds: ReadonlySet<string>
): BoardPrediction {
  const totalSlots = board.items.length;

  // Count filled slots by matching called items
  let filledSlots = 0;
  const remainingItems: string[] = [];

  for (const item of board.items) {
    const normalizedId = normalizeItemId(item);
    if (calledItemIds.has(normalizedId)) {
      filledSlots++;
    } else {
      remainingItems.push(item);
    }
  }

  const percentComplete = totalSlots > 0
    ? Math.round((filledSlots / totalSlots) * 100)
    : 0;

  return {
    id: board.id,
    number: board.number,
    totalSlots,
    filledSlots,
    percentComplete,
    remainingItems,
    isComplete: percentComplete === 100,
    isAlmostComplete: percentComplete >= ALMOST_COMPLETE_THRESHOLD,
  };
}

/**
 * Calculates completion predictions for all boards.
 *
 * @param boards - All board definitions
 * @param calledItems - Array of called item IDs or items with id property
 * @returns Summary of all predictions with categorization
 *
 * @example
 * ```ts
 * const predictions = calculateBoardPredictions(
 *   manifest.boards,
 *   history.map(item => item.id)
 * );
 *
 * if (predictions.completedBoards.length > 0) {
 *   // Show winner celebration!
 * }
 * ```
 */
export function calculateBoardPredictions(
  boards: readonly BoardDefinition[],
  calledItems: readonly (string | { id: string })[]
): PredictionSummary {
  // Build set of normalized called item IDs
  const calledItemIds = new Set<string>();
  for (const item of calledItems) {
    const id = typeof item === "string" ? item : item.id;
    calledItemIds.add(normalizeItemId(id));
  }

  // Calculate predictions for each board
  const predictions = boards.map((board) =>
    calculateBoardPrediction(board, calledItemIds)
  );

  // Sort by completion percentage descending
  const sorted = [...predictions].sort(
    (a, b) => b.percentComplete - a.percentComplete
  );

  // Categorize boards
  const completedBoards = sorted.filter((p) => p.isComplete);
  const almostCompleteBoards = sorted.filter(
    (p) => p.isAlmostComplete && !p.isComplete
  );
  const topBoards = sorted.slice(0, TOP_BOARDS_LIMIT);

  return {
    totalBoards: boards.length,
    completedBoards,
    almostCompleteBoards,
    topBoards,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Checks if any board is complete.
 * Useful for triggering winner celebrations.
 *
 * @param summary - Prediction summary
 * @returns True if at least one board is 100% complete
 */
export function hasCompletedBoard(summary: PredictionSummary): boolean {
  return summary.completedBoards.length > 0;
}

/**
 * Checks if any board is close to completion.
 *
 * @param summary - Prediction summary
 * @returns True if any board is at least 80% complete
 */
export function hasAlmostCompleteBoard(summary: PredictionSummary): boolean {
  return summary.almostCompleteBoards.length > 0 || summary.completedBoards.length > 0;
}

/**
 * Gets the board closest to completion (but not yet complete).
 *
 * @param summary - Prediction summary
 * @returns Prediction for the leading board, or null if all complete or empty
 */
export function getLeadingBoard(summary: PredictionSummary): BoardPrediction | null {
  for (const board of summary.topBoards) {
    if (!board.isComplete) {
      return board;
    }
  }
  return null;
}

/**
 * Calculates how many more items are needed for a board to win.
 *
 * @param prediction - Single board prediction
 * @returns Number of remaining items needed
 */
export function getRemainingCount(prediction: BoardPrediction): number {
  return prediction.remainingItems.length;
}

