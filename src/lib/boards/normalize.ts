/**
 * Board Normalization Utilities
 *
 * Handles parsing and validation of board data from the generator.
 *
 * @module lib/boards/normalize
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1A
 */

import {
  type BoardSize,
  type BoardDefinition,
  type BoardsManifest,
  type BoardGenerationStats,
  isBoardSize,
  formatBoardSize,
  BOARD_SIZE_PRESETS,
} from "../types/boards";

// ============================================================================
// ITEM ID EXTRACTION
// ============================================================================

/**
 * Regex pattern for extracting numeric ID from formatted item string.
 * Matches patterns like "03 BOLLO DE MAÍZ" where "03" is the ID.
 */
const ITEM_ID_PATTERN = /^(\d{2})\s+/;

/**
 * Extracts the numeric ID from a formatted item string.
 *
 * @param item - Item string, either formatted ("03 BOLLO DE MAÍZ") or plain ("03")
 * @returns The extracted ID, or the original string if no ID found
 *
 * @example
 * extractItemId("03 BOLLO DE MAÍZ") // "03"
 * extractItemId("03")               // "03"
 * extractItemId("BOLLO DE MAÍZ")    // "BOLLO DE MAÍZ" (passthrough)
 */
export function extractItemId(item: string): string {
  const match = item.match(ITEM_ID_PATTERN);
  if (match) {
    return match[1];
  }
  // If no pattern match, check if it's already a numeric ID
  if (/^\d{2}$/.test(item)) {
    return item;
  }
  // Return original string as fallback (for non-standard formats)
  return item.toUpperCase().trim();
}

/**
 * Extracts the display name from a formatted item string.
 *
 * @param item - Item string, either formatted ("03 BOLLO DE MAÍZ") or plain
 * @returns The extracted name, or the original string if no ID prefix found
 *
 * @example
 * extractItemName("03 BOLLO DE MAÍZ") // "BOLLO DE MAÍZ"
 * extractItemName("BOLLO DE MAÍZ")    // "BOLLO DE MAÍZ"
 */
export function extractItemName(item: string): string {
  const match = item.match(ITEM_ID_PATTERN);
  if (match) {
    return item.slice(match[0].length).trim();
  }
  return item.trim();
}

// ============================================================================
// BOARD SIZE NORMALIZATION
// ============================================================================

/**
 * Normalizes a board size string to the canonical "RxC" format.
 * Handles variations like uppercase X, spaces, and multiplication sign.
 *
 * @param size - Raw board size string
 * @returns Normalized BoardSize, or null if invalid format
 *
 * @example
 * normalizeBoardSize("4X4")   // "4x4"
 * normalizeBoardSize("4 x 4") // "4x4"
 * normalizeBoardSize("3×5")   // "3x5"
 */
export function normalizeBoardSize(size: string): BoardSize | null {
  // Normalize separator to lowercase 'x'
  const normalized = size
    .toLowerCase()
    .replace(/\s+/g, "") // Remove spaces
    .replace(/×/g, "x"); // Replace multiplication sign

  if (isBoardSize(normalized)) {
    return normalized;
  }
  return null;
}

/**
 * Infers board size from a 2D grid.
 *
 * Note: Cannot reliably infer from flat arrays since asymmetric dimensions
 * are ambiguous (e.g., 12 items could be 3x4, 4x3, 2x6, 6x2, etc.).
 * For flat arrays, use inferBoardSizeFromItems with a hint.
 *
 * @param grid - 2D grid array
 * @returns Inferred BoardSize, or null if invalid grid
 */
export function inferBoardSizeFromGrid(
  grid: readonly (readonly string[])[]
): BoardSize | null {
  if (!grid || grid.length === 0) return null;
  if (!Array.isArray(grid[0]) || grid[0].length === 0) return null;

  const rows = grid.length;
  const cols = grid[0].length;

  return formatBoardSize(rows, cols);
}

/**
 * Tries to infer board size from a flat items array.
 *
 * Since asymmetric dimensions are ambiguous, this function:
 * 1. First checks common square presets (3x3, 4x4, 5x5)
 * 2. Falls back to a "square-ish" configuration if possible
 *
 * @param itemCount - Number of items
 * @returns Inferred BoardSize, or null if cannot determine
 */
export function inferBoardSizeFromItemCount(
  itemCount: number
): BoardSize | null {
  // Check common presets first
  for (const size of BOARD_SIZE_PRESETS) {
    const [r, c] = size.split("x").map(Number);
    if (r * c === itemCount) {
      return size;
    }
  }

  // Try perfect square
  const sqrt = Math.sqrt(itemCount);
  if (Number.isInteger(sqrt) && sqrt >= 1 && sqrt <= 99) {
    return formatBoardSize(sqrt, sqrt);
  }

  // Cannot infer reliably
  return null;
}

// ============================================================================
// BOARD NORMALIZATION
// ============================================================================

/**
 * Options for board normalization.
 */
export interface NormalizeOptions {
  /** Whether to extract IDs from formatted strings */
  extractIds?: boolean;

  /** Default board size if cannot be inferred */
  defaultSize?: BoardSize;
}

const DEFAULT_NORMALIZE_OPTIONS: Required<NormalizeOptions> = {
  extractIds: true,
  defaultSize: "4x4",
};

/**
 * Normalizes a single board from various input formats.
 *
 * @param data - Raw board data (can be various formats)
 * @param index - Board index (0-based, used for ID generation if not provided)
 * @param options - Normalization options
 * @returns Normalized BoardDefinition, or null if invalid
 */
export function normalizeBoard(
  data: unknown,
  index: number,
  options: NormalizeOptions = {}
): BoardDefinition | null {
  const opts = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };

  if (!data || typeof data !== "object") return null;

  const raw = data as Record<string, unknown>;

  // Extract or generate ID
  const id = typeof raw.id === "string" ? raw.id : `board-${index + 1}`;

  // Extract number (1-indexed)
  let number = typeof raw.number === "number" ? raw.number : index + 1;
  if (typeof raw.boardNumber === "number") {
    number = raw.boardNumber;
  }

  // Extract items array
  let items: string[] = [];

  if (Array.isArray(raw.items)) {
    items = raw.items
      .filter((item): item is string => typeof item === "string")
      .map((item) => (opts.extractIds ? extractItemId(item) : item));
  } else if (Array.isArray(raw.itemIds)) {
    // Support GameGeneratedBoard format with itemIds
    items = raw.itemIds.filter(
      (item): item is string => typeof item === "string"
    );
  }

  if (items.length === 0) return null;

  // Extract or build grid
  let grid: string[][] = [];

  if (
    Array.isArray(raw.grid) &&
    raw.grid.length > 0 &&
    Array.isArray(raw.grid[0])
  ) {
    grid = raw.grid.map((row) => {
      if (!Array.isArray(row)) return [];
      return row
        .filter((cell): cell is string => typeof cell === "string")
        .map((cell) => (opts.extractIds ? extractItemId(cell) : cell));
    });
  } else {
    // Build grid from items based on inferred or default size
    const size = inferBoardSizeFromItemCount(items.length) ?? opts.defaultSize;
    const { rows, cols } = parseBoardSizeInternal(size);

    grid = [];
    for (let r = 0; r < rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        row.push(items[idx] ?? "");
      }
      grid.push(row);
    }
  }

  return {
    id,
    number,
    items,
    grid,
  };
}

/**
 * Internal helper to parse board size without circular dependency.
 */
function parseBoardSizeInternal(size: BoardSize): {
  rows: number;
  cols: number;
} {
  const [rows, cols] = size.split("x").map(Number);
  return { rows, cols };
}

// ============================================================================
// MANIFEST NORMALIZATION
// ============================================================================

/**
 * Raw board manifest data from the generator.
 */
interface RawBoardsManifest {
  game?: string;
  totalBoards?: number;
  boardSize?: string;
  algorithm?: string;
  generatedAt?: string;
  stats?: unknown;
  boards?: unknown[];
}

/**
 * Parses and normalizes a boards manifest from generator output.
 *
 * @param data - Raw manifest data from generator
 * @param options - Normalization options
 * @returns Normalized BoardsManifest
 * @throws Error if required data is missing or invalid
 *
 * @example
 * ```ts
 * const manifest = normalizeBoards({
 *   game: "tabula-barranquilla",
 *   totalBoards: 15,
 *   boardSize: "4x4",
 *   boards: [...],
 * });
 * ```
 */
export function normalizeBoards(
  data: unknown,
  options: NormalizeOptions = {}
): BoardsManifest {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid manifest data: expected an object");
  }

  const raw = data as RawBoardsManifest;
  const opts = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };

  // Extract game name
  if (!raw.game || typeof raw.game !== "string") {
    throw new Error("Invalid manifest: missing game field");
  }
  const game = raw.game;

  // Extract and normalize boards array
  if (!Array.isArray(raw.boards) || raw.boards.length === 0) {
    throw new Error("Invalid manifest: missing or empty boards array");
  }

  const boards: BoardDefinition[] = [];
  for (let i = 0; i < raw.boards.length; i++) {
    const board = normalizeBoard(raw.boards[i], i, opts);
    if (board) {
      boards.push(board);
    }
  }

  if (boards.length === 0) {
    throw new Error("Invalid manifest: no valid boards found");
  }

  // Extract or infer board size
  let boardSize: BoardSize = opts.defaultSize;

  if (raw.boardSize) {
    const normalized = normalizeBoardSize(raw.boardSize);
    if (normalized) {
      boardSize = normalized;
    }
  } else if (boards[0]?.grid) {
    const inferred = inferBoardSizeFromGrid(boards[0].grid);
    if (inferred) {
      boardSize = inferred;
    }
  }

  // Extract total boards (use array length as fallback)
  const totalBoards = raw.totalBoards ?? boards.length;

  // Extract optional stats
  let stats: BoardGenerationStats | undefined;
  if (raw.stats && typeof raw.stats === "object") {
    const rawStats = raw.stats as Record<string, unknown>;
    if (
      typeof rawStats.maxOverlap === "number" &&
      typeof rawStats.avgOverlap === "number"
    ) {
      stats = {
        maxOverlap: rawStats.maxOverlap,
        avgOverlap: rawStats.avgOverlap,
        solver:
          typeof rawStats.solver === "string" ? rawStats.solver : "unknown",
        generationTimeMs:
          typeof rawStats.generationTimeMs === "number"
            ? rawStats.generationTimeMs
            : 0,
      };
    }
  }

  return {
    game,
    totalBoards,
    boardSize,
    algorithm: raw.algorithm,
    generatedAt: raw.generatedAt,
    stats,
    boards,
  };
}

// ============================================================================
// ITEM ID NORMALIZATION FOR COMPARISON
// ============================================================================

/**
 * Normalizes an item identifier for comparison purposes.
 * Handles both "03 BOLLO DE MAÍZ" and "03" formats, as well as name-only.
 *
 * Used by the board prediction engine to match called items to board slots.
 *
 * @param item - Item identifier in any format
 * @returns Normalized identifier for comparison
 */
export function normalizeItemId(item: string): string {
  // Try to extract numeric ID first
  const match = item.match(ITEM_ID_PATTERN);
  if (match) {
    return match[1];
  }

  // If it's already a 2-digit number, use it
  if (/^\d{2}$/.test(item)) {
    return item;
  }

  // Otherwise use uppercase trimmed name as key
  return item.toUpperCase().trim();
}
