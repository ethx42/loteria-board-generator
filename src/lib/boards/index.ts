/**
 * Boards Module
 *
 * Board types, normalization, and prediction utilities.
 *
 * @module lib/boards
 */

// Normalization
export {
  extractItemId,
  extractItemName,
  normalizeBoard,
  normalizeBoards,
  normalizeBoardSize,
  normalizeItemId,
  inferBoardSizeFromGrid,
  inferBoardSizeFromItemCount,
  type NormalizeOptions,
} from "./normalize";

// Prediction
export {
  calculateBoardPrediction,
  calculateBoardPredictions,
  hasCompletedBoard,
  hasAlmostCompleteBoard,
  getLeadingBoard,
  getRemainingCount,
} from "./prediction";

// Hooks
export {
  useBoardPredictions,
  useCompletedBoardCount,
  useAlmostCompleteBoardCount,
} from "./use-board-predictions";

