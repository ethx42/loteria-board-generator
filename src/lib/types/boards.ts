/**
 * Tabula Boards Types
 *
 * Unified type definitions for board manifests and predictions.
 *
 * ## Two Data Sources
 *
 * Tabula uses two separate JSON files with distinct purposes:
 *
 * 1. **Deck Manifest** (`DeckDefinition` in `game.ts`):
 *    - Contains items with images, educational text, categories
 *    - Used for gameplay: displaying cards, reading content
 *    - Located in `/public/decks/{deck}/manifest.json`
 *
 * 2. **Boards Manifest** (`BoardsManifest` in this file):
 *    - Contains only item distribution across boards
 *    - Output of the generator, used for board tracking/prediction
 *    - Link: `BoardsManifest.boards[].items[]` → `DeckDefinition.items[].id`
 *
 * @module lib/types/boards
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1A
 */

// ============================================================================
// BOARD DIMENSIONS
// ============================================================================

/**
 * Board dimensions as "RxC" string format.
 *
 * Supports asymmetric dimensions (e.g., "3x4", "4x7", "5x3").
 * The generator allows rows and columns from 1-10.
 *
 * @example "3x3" | "4x4" | "3x5" | "4x7"
 */
export type BoardSize = `${number}x${number}`;

/**
 * Common presets for quick selection in UI.
 * These are suggestions, not restrictions.
 */
export const BOARD_SIZE_PRESETS: readonly BoardSize[] = [
  "3x3",
  "4x4",
  "5x5",
] as const;

/**
 * Type guard for BoardSize.
 * Validates the format "RxC" where R and C are positive integers (1-99).
 *
 * @example
 * isBoardSize("4x4")  // true
 * isBoardSize("3x5")  // true
 * isBoardSize("10x7") // true
 * isBoardSize("abc")  // false
 * isBoardSize("0x4")  // false (rows must be >= 1)
 */
export function isBoardSize(value: unknown): value is BoardSize {
  if (typeof value !== "string") return false;

  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return false;

  const rows = parseInt(match[1], 10);
  const cols = parseInt(match[2], 10);

  // Validate reasonable bounds (1-99 for practical use)
  return rows >= 1 && rows <= 99 && cols >= 1 && cols <= 99;
}

/**
 * Format dimensions from rows and columns into BoardSize string.
 *
 * @param rows - Number of rows (must be integer 1-99)
 * @param cols - Number of columns (must be integer 1-99)
 * @returns Formatted BoardSize string
 * @throws Error if dimensions are invalid
 *
 * @example
 * formatBoardSize(4, 4)  // "4x4"
 * formatBoardSize(3, 5)  // "3x5"
 * formatBoardSize(0, 4)  // throws Error
 */
export function formatBoardSize(rows: number, cols: number): BoardSize {
  // Validate rows
  if (!Number.isInteger(rows) || rows < 1 || rows > 99) {
    throw new Error(
      `Invalid rows: ${rows}. Must be an integer between 1 and 99.`
    );
  }

  // Validate cols
  if (!Number.isInteger(cols) || cols < 1 || cols > 99) {
    throw new Error(
      `Invalid cols: ${cols}. Must be an integer between 1 and 99.`
    );
  }

  return `${rows}x${cols}` as BoardSize;
}

/**
 * Extract rows and columns from a BoardSize string.
 *
 * @example
 * parseBoardSize("4x4") // { rows: 4, cols: 4 }
 * parseBoardSize("3x5") // { rows: 3, cols: 5 }
 */
export function parseBoardSize(size: BoardSize): {
  rows: number;
  cols: number;
} {
  const [rows, cols] = size.split("x").map(Number);
  return { rows, cols };
}

/**
 * Calculate total slots from a BoardSize.
 *
 * @example
 * getBoardSlots("4x4") // 16
 * getBoardSlots("3x5") // 15
 */
export function getBoardSlots(size: BoardSize): number {
  const { rows, cols } = parseBoardSize(size);
  return rows * cols;
}

/**
 * Validate that a board's items match its expected dimensions.
 *
 * @example
 * validateBoardDimensions(16, "4x4") // true
 * validateBoardDimensions(12, "3x4") // true
 * validateBoardDimensions(15, "4x4") // false (expected 16)
 */
export function validateBoardDimensions(
  itemCount: number,
  size: BoardSize
): boolean {
  return itemCount === getBoardSlots(size);
}

// ============================================================================
// GENERATION STATISTICS
// ============================================================================

/**
 * Statistics from board generation.
 * Optional in manifest (only present for generated boards).
 */
export interface BoardGenerationStats {
  /** Maximum item overlap between any two boards */
  readonly maxOverlap: number;

  /** Average item overlap across all board pairs */
  readonly avgOverlap: number;

  /** Solver used for generation */
  readonly solver: string;

  /** Time taken to generate in milliseconds */
  readonly generationTimeMs: number;
}

/**
 * Type guard for BoardGenerationStats.
 */
export function isBoardGenerationStats(
  value: unknown
): value is BoardGenerationStats {
  if (!value || typeof value !== "object") return false;

  const stats = value as Record<string, unknown>;

  return (
    typeof stats.maxOverlap === "number" &&
    typeof stats.avgOverlap === "number" &&
    typeof stats.solver === "string" &&
    typeof stats.generationTimeMs === "number"
  );
}

// ============================================================================
// BOARD DEFINITION
// ============================================================================

/**
 * Single board definition from generator output.
 *
 * @example
 * ```ts
 * const board: BoardDefinition = {
 *   id: "board-1",
 *   number: 1,
 *   items: ["01", "03", "05", "08", ...],
 *   grid: [
 *     ["01", "03", "05", "08"],
 *     ["10", "12", "15", "17"],
 *     ["20", "22", "25", "27"],
 *     ["30", "32", "35", "36"],
 *   ],
 * };
 * ```
 */
export interface BoardDefinition {
  /** Unique identifier (e.g., "board-1") */
  readonly id: string;

  /** Display number (1-indexed) */
  readonly number: number;

  /** Flat array of item identifiers */
  readonly items: readonly string[];

  /** 2D grid layout for visual display */
  readonly grid: readonly (readonly string[])[];
}

/**
 * Type guard for BoardDefinition.
 * Validates structure and dimensional consistency:
 * - items.length must equal grid rows × cols
 * - All grid rows must have the same column count
 */
export function isBoardDefinition(value: unknown): value is BoardDefinition {
  if (!value || typeof value !== "object") return false;

  const board = value as Record<string, unknown>;

  // Check required fields
  if (typeof board.id !== "string" || board.id.length === 0) return false;
  if (typeof board.number !== "number" || board.number < 1) return false;
  if (!Array.isArray(board.items) || board.items.length === 0) return false;
  if (!Array.isArray(board.grid) || board.grid.length === 0) return false;

  // Validate items are strings
  for (const item of board.items) {
    if (typeof item !== "string") return false;
  }

  // Validate grid is 2D string array with consistent column count
  const firstRowLength = Array.isArray(board.grid[0])
    ? (board.grid[0] as unknown[]).length
    : 0;
  if (firstRowLength === 0) return false;

  for (const row of board.grid) {
    if (!Array.isArray(row)) return false;
    if (row.length !== firstRowLength) return false; // All rows same width
    for (const cell of row) {
      if (typeof cell !== "string") return false;
    }
  }

  // Validate dimensional consistency: items.length === rows × cols
  const rows = board.grid.length;
  const cols = firstRowLength;
  const expectedItemCount = rows * cols;

  if ((board.items as unknown[]).length !== expectedItemCount) {
    return false;
  }

  return true;
}

/**
 * Infer BoardSize from a BoardDefinition's grid.
 */
export function inferBoardSize(board: BoardDefinition): BoardSize {
  const rows = board.grid.length;
  const cols = board.grid[0]?.length ?? 0;
  return formatBoardSize(rows, cols);
}

// ============================================================================
// BOARDS MANIFEST
// ============================================================================

/**
 * Complete boards manifest.
 * Primary data structure for board tracking features.
 *
 * @example
 * ```ts
 * const manifest: BoardsManifest = {
 *   game: "tabula-barranquilla",
 *   totalBoards: 15,
 *   boardSize: "4x4",
 *   generatedAt: "2024-12-28T10:00:00Z",
 *   boards: [...],
 * };
 * ```
 */
export interface BoardsManifest {
  /** Game/deck name */
  readonly game: string;

  /** Total boards in set */
  readonly totalBoards: number;

  /** Board dimensions */
  readonly boardSize: BoardSize;

  /** Generation algorithm used (optional) */
  readonly algorithm?: string;

  /** Generation timestamp ISO 8601 (optional) */
  readonly generatedAt?: string;

  /** Generation statistics (optional) */
  readonly stats?: BoardGenerationStats;

  /** Board definitions */
  readonly boards: readonly BoardDefinition[];
}

/**
 * Type guard for BoardsManifest.
 * Validates:
 * - Required fields and types
 * - Each board's structure
 * - Dimensional consistency: each board matches declared boardSize
 * - Count consistency: boards.length === totalBoards
 */
export function isBoardsManifest(value: unknown): value is BoardsManifest {
  if (!value || typeof value !== "object") return false;

  const manifest = value as Record<string, unknown>;

  // Check required fields
  if (typeof manifest.game !== "string" || manifest.game.length === 0)
    return false;
  if (typeof manifest.totalBoards !== "number" || manifest.totalBoards < 1)
    return false;
  if (!isBoardSize(manifest.boardSize)) return false;
  if (!Array.isArray(manifest.boards)) return false;

  // Validate count consistency
  if (manifest.boards.length !== manifest.totalBoards) {
    return false;
  }

  // Get expected slots from declared boardSize
  const expectedSlots = getBoardSlots(manifest.boardSize as BoardSize);
  const { rows: expectedRows, cols: expectedCols } = parseBoardSize(
    manifest.boardSize as BoardSize
  );

  // Validate each board
  for (const board of manifest.boards) {
    if (!isBoardDefinition(board)) return false;

    // Validate this board matches the manifest's declared boardSize
    const boardDef = board as BoardDefinition;
    const actualRows = boardDef.grid.length;
    const actualCols = boardDef.grid[0]?.length ?? 0;

    if (actualRows !== expectedRows || actualCols !== expectedCols) {
      return false;
    }

    if (boardDef.items.length !== expectedSlots) {
      return false;
    }
  }

  // Validate optional stats
  if (manifest.stats !== undefined && !isBoardGenerationStats(manifest.stats)) {
    return false;
  }

  return true;
}

// ============================================================================
// BOARD PREDICTION TYPES (for Phase 2C)
// ============================================================================

/**
 * Prediction state for a single board.
 * Used by the board completion tracking feature.
 */
export interface BoardPrediction {
  /** Board identifier */
  readonly id: string;

  /** Board display number */
  readonly number: number;

  /** Total slots on the board */
  readonly totalSlots: number;

  /** Number of slots that have been called */
  readonly filledSlots: number;

  /** Completion percentage (0-100) */
  readonly percentComplete: number;

  /** Items not yet called */
  readonly remainingItems: readonly string[];

  /** Whether board is 100% complete */
  readonly isComplete: boolean;

  /** Whether board is ≥80% complete */
  readonly isAlmostComplete: boolean;
}

/**
 * Summary of all board predictions.
 */
export interface PredictionSummary {
  /** Total number of boards being tracked */
  readonly totalBoards: number;

  /** Boards that are 100% complete */
  readonly completedBoards: readonly BoardPrediction[];

  /** Boards that are ≥80% complete but not finished */
  readonly almostCompleteBoards: readonly BoardPrediction[];

  /** Top 5 boards by completion percentage */
  readonly topBoards: readonly BoardPrediction[];
}
