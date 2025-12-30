/**
 * Board Predictions Hook
 *
 * React hook for calculating and tracking board completion predictions.
 * Memoized for performance with large board sets.
 *
 * @module lib/boards/use-board-predictions
 * @see TABULA_V4_DEVELOPMENT_PLAN §5 Phase 2C
 */

import { useMemo } from "react";
import type { BoardDefinition, PredictionSummary } from "../types/boards";
import type { ItemDefinition } from "../types/game";
import { calculateBoardPredictions } from "./prediction";

// ============================================================================
// TYPES
// ============================================================================

export interface UseBoardPredictionsOptions {
  /**
   * Whether to include detailed remaining items in predictions.
   * Set to false for better performance when not needed.
   * @default true
   */
  includeRemaining?: boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook for calculating board completion predictions.
 *
 * Memoized to prevent recalculation on every render.
 * Only recalculates when boards or history change.
 *
 * @param boards - All board definitions (from manifest)
 * @param history - Called items in order (from game session)
 * @param options - Optional configuration
 * @returns Prediction summary or null if no boards
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
 *     <>
 *       {predictions?.completedBoards.length > 0 && (
 *         <WinnerCelebration />
 *       )}
 *       <BoardStatusIndicator predictions={predictions} />
 *     </>
 *   );
 * }
 * ```
 */
export function useBoardPredictions(
  boards: readonly BoardDefinition[] | undefined,
  history: readonly ItemDefinition[]
): PredictionSummary | null {
  return useMemo(() => {
    // Return null if no boards to track
    if (!boards || boards.length === 0) {
      return null;
    }

    // Return initial state if no history yet
    if (history.length === 0) {
      return {
        totalBoards: boards.length,
        completedBoards: [],
        almostCompleteBoards: [],
        topBoards: boards.slice(0, 5).map((board) => ({
          id: board.id,
          number: board.number,
          totalSlots: board.items.length,
          filledSlots: 0,
          percentComplete: 0,
          remainingItems: [...board.items],
          isComplete: false,
          isAlmostComplete: false,
        })),
      };
    }

    // Calculate predictions
    return calculateBoardPredictions(boards, history);
  }, [boards, history]);
}

/**
 * Hook for tracking just the completed board count.
 * Lighter weight than full predictions if only counting needed.
 *
 * @param boards - All board definitions
 * @param history - Called items
 * @returns Number of completed boards
 */
export function useCompletedBoardCount(
  boards: readonly BoardDefinition[] | undefined,
  history: readonly ItemDefinition[]
): number {
  const predictions = useBoardPredictions(boards, history);
  return predictions?.completedBoards.length ?? 0;
}

/**
 * Hook for tracking just the "almost complete" board count.
 *
 * @param boards - All board definitions
 * @param history - Called items
 * @returns Number of boards at ≥80% completion
 */
export function useAlmostCompleteBoardCount(
  boards: readonly BoardDefinition[] | undefined,
  history: readonly ItemDefinition[]
): number {
  const predictions = useBoardPredictions(boards, history);
  return (
    (predictions?.almostCompleteBoards.length ?? 0) +
    (predictions?.completedBoards.length ?? 0)
  );
}

export default useBoardPredictions;

