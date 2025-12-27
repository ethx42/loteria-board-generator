/**
 * Board Generator - Solver Facade
 * Uses HiGHS for optimal distribution or falls back to greedy algorithm
 */

import type {
  GeneratorConfig,
  GeneratedBoard,
  GenerationResult,
  GenerationStats,
  Item,
} from "@/lib/types";
import { getBoardSize } from "@/lib/types";
import { calculateFrequencies, isConfigValid, validateConstraints } from "@/lib/constraints/engine";
import { solveWithHiGHS, isHiGHSAvailable } from "./highs-solver";
import { solveGreedy } from "./greedy-solver";

/**
 * Generate boards using the best available algorithm
 *
 * @param config Generator configuration
 * @returns Generation result with boards and stats
 */
export async function generateBoards(
  config: GeneratorConfig
): Promise<GenerationResult> {
  const startTime = performance.now();

  // Validate configuration first
  const validations = validateConstraints(config);
  if (!isConfigValid(config)) {
    const errors = validations
      .filter((v) => !v.isValid)
      .map((v) => v.message);

    return {
      success: false,
      boards: [],
      stats: createEmptyStats(config),
      errors,
    };
  }

  const N = config.items.length;
  const B = config.numBoards;
  const S = getBoardSize(config.boardConfig);
  const frequencies = calculateFrequencies(N, B, S, config.distribution);

  let assignment: number[][] | null = null;
  let solverUsed: "highs" | "greedy" = "greedy";
  let maxOverlap = 0;

  // Try HiGHS first for optimal results
  if (await isHiGHSAvailable()) {
    try {
      const result = await solveWithHiGHS(N, B, S, frequencies);
      if (result.success) {
        assignment = result.assignment;
        maxOverlap = result.maxOverlap;
        solverUsed = "highs";
      }
    } catch {
      console.warn("HiGHS solver failed, falling back to greedy");
    }
  }

  // Fallback to greedy if HiGHS unavailable or failed
  if (!assignment) {
    const result = solveGreedy(N, B, S, frequencies);
    assignment = result.assignment;
    maxOverlap = result.maxOverlap;
    solverUsed = "greedy";
  }

  // Convert assignment matrix to boards
  const boards = assignmentToBoards(assignment, config);

  // Calculate stats
  const stats = calculateStats(
    boards,
    config,
    frequencies,
    solverUsed,
    maxOverlap,
    performance.now() - startTime
  );

  return {
    success: true,
    boards,
    stats,
  };
}

/**
 * Convert assignment matrix to GeneratedBoard objects
 */
function assignmentToBoards(
  assignment: number[][],
  config: GeneratorConfig
): GeneratedBoard[] {
  const B = config.numBoards;
  const { rows, cols } = config.boardConfig;
  const boards: GeneratedBoard[] = [];

  for (let b = 0; b < B; b++) {
    const boardItems: Item[] = [];

    // Find all items assigned to this board
    for (let i = 0; i < config.items.length; i++) {
      if (assignment[i][b] === 1) {
        boardItems.push(config.items[i]);
      }
    }

    // Create 2D grid
    const grid: Item[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Item[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < boardItems.length) {
          row.push(boardItems[idx]);
        }
      }
      grid.push(row);
    }

    boards.push({
      id: `board-${b + 1}`,
      boardNumber: b + 1,
      items: boardItems,
      grid,
    });
  }

  return boards;
}

/**
 * Calculate generation statistics
 */
function calculateStats(
  boards: GeneratedBoard[],
  config: GeneratorConfig,
  frequencies: number[],
  solverUsed: "highs" | "greedy",
  maxOverlap: number,
  timeMs: number
): GenerationStats {
  // Calculate pairwise overlaps
  const overlaps: number[] = [];
  for (let i = 0; i < boards.length; i++) {
    const setI = new Set(boards[i].items.map((item) => item.id));
    for (let j = i + 1; j < boards.length; j++) {
      const setJ = new Set(boards[j].items.map((item) => item.id));
      let overlap = 0;
      for (const id of setI) {
        if (setJ.has(id)) overlap++;
      }
      overlaps.push(overlap);
    }
  }

  const minOverlap = overlaps.length > 0 ? Math.min(...overlaps) : 0;
  const avgOverlap =
    overlaps.length > 0
      ? overlaps.reduce((a, b) => a + b, 0) / overlaps.length
      : 0;

  // Create frequency map
  const freqMap = new Map<string, number>();
  config.items.forEach((item, idx) => {
    freqMap.set(item.id, frequencies[idx]);
  });

  return {
    totalSlots: config.numBoards * getBoardSize(config.boardConfig),
    totalItems: config.items.length,
    minOverlap,
    maxOverlap: overlaps.length > 0 ? Math.max(...overlaps) : maxOverlap,
    avgOverlap,
    generationTimeMs: timeMs,
    solverUsed,
    frequencies: freqMap,
  };
}

/**
 * Create empty stats for error cases
 */
function createEmptyStats(config: GeneratorConfig): GenerationStats {
  return {
    totalSlots: 0,
    totalItems: config.items.length,
    minOverlap: 0,
    maxOverlap: 0,
    avgOverlap: 0,
    generationTimeMs: 0,
    solverUsed: "greedy",
    frequencies: new Map(),
  };
}

// Re-export solver types
export type { SolverResult } from "./highs-solver";

