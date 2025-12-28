/**
 * HiGHS ILP Solver for Board Generation
 *
 * This is the core solver logic, extracted for direct testing.
 * Uses Integer Linear Programming to generate diverse boards.
 */

import type {
  GeneratorConfig,
  GeneratedBoard,
  GenerationResult,
  GenerationStats,
  Item,
} from "@/lib/types";
import { getBoardSize } from "@/lib/types";
import { calculateFrequencies } from "@/lib/constraints/engine";
import { createDevLogger } from "@/lib/utils/dev-logger";

const log = createDevLogger("HiGHS");

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Simple seeded random number generator (Mulberry32)
 * Provides deterministic randomness when a seed is provided
 */
function createSeededRandom(seed?: number): () => number {
  if (seed === undefined) {
    return Math.random;
  }
  
  let state = seed;
  return function() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Module-level random function (can be seeded for tests)
let randomFn: () => number = Math.random;

/**
 * Set a seed for deterministic generation (useful for tests)
 * Call with undefined to reset to Math.random
 */
export function setSeed(seed?: number): void {
  randomFn = createSeededRandom(seed);
}

/**
 * Reset to non-deterministic random
 */
export function resetSeed(): void {
  randomFn = Math.random;
}

interface SolverResult {
  success: boolean;
  assignment: number[][];
  maxOverlap: number;
  solveTimeMs: number;
  solverUsed: "highs" | "greedy";
}

/**
 * Fisher-Yates shuffle using seeded random
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build HiGHS LP format model
 */
function buildModel(N: number, B: number, S: number, freq: number[]): string {
  const lines: string[] = [];

  lines.push("Minimize");
  lines.push(" obj: 0");
  lines.push("");
  lines.push("Subject To");

  for (let i = 0; i < N; i++) {
    const terms: string[] = [];
    for (let b = 0; b < B; b++) {
      terms.push(`x_${i}_${b}`);
    }
    lines.push(` freq_${i}: ${terms.join(" + ")} = ${freq[i]}`);
  }

  for (let b = 0; b < B; b++) {
    const terms: string[] = [];
    for (let i = 0; i < N; i++) {
      terms.push(`x_${i}_${b}`);
    }
    lines.push(` board_${b}: ${terms.join(" + ")} = ${S}`);
  }

  lines.push("");
  lines.push("Binary");
  for (let i = 0; i < N; i++) {
    for (let b = 0; b < B; b++) {
      lines.push(` x_${i}_${b}`);
    }
  }

  lines.push("");
  lines.push("End");

  return lines.join("\n");
}

/**
 * Local search optimization to reduce overlap
 */
function localSearchOptimization(
  assignment: number[][],
  boardItems: Set<number>[],
  N: number,
  B: number
): void {
  const maxIterations = 50;
  const maxSwapAttempts = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    let currentMaxOverlap = 0;
    let worstPair: [number, number] = [-1, -1];

    for (let b1 = 0; b1 < B; b1++) {
      for (let b2 = b1 + 1; b2 < B; b2++) {
        let overlap = 0;
        for (let i = 0; i < N; i++) {
          if (assignment[i][b1] === 1 && assignment[i][b2] === 1) overlap++;
        }
        if (overlap > currentMaxOverlap) {
          currentMaxOverlap = overlap;
          worstPair = [b1, b2];
        }
      }
    }

    if (currentMaxOverlap <= 6 || worstPair[0] === -1) break;

    const [b1, b2] = worstPair;
    let improved = false;
    let attempts = 0;

    const sharedItems: number[] = [];
    for (let i = 0; i < N; i++) {
      if (assignment[i][b1] === 1 && assignment[i][b2] === 1) {
        sharedItems.push(i);
      }
    }

    outerLoop: for (const item of sharedItems) {
      if (improved || attempts >= maxSwapAttempts) break;

      for (const sourceBoard of [b1, b2]) {
        if (improved || attempts >= maxSwapAttempts) break;

        for (let targetBoard = 0; targetBoard < B; targetBoard++) {
          if (improved || attempts >= maxSwapAttempts) break;
          if (targetBoard === b1 || targetBoard === b2) continue;
          if (assignment[item][targetBoard] === 1) continue;

          let swapCount = 0;
          for (const swapItem of boardItems[targetBoard]) {
            if (swapCount >= 3) break;
            if (assignment[swapItem][sourceBoard] === 1) continue;

            attempts++;
            swapCount++;

            assignment[item][sourceBoard] = 0;
            assignment[item][targetBoard] = 1;
            assignment[swapItem][targetBoard] = 0;
            assignment[swapItem][sourceBoard] = 1;

            boardItems[sourceBoard].delete(item);
            boardItems[sourceBoard].add(swapItem);
            boardItems[targetBoard].delete(swapItem);
            boardItems[targetBoard].add(item);

            let newOverlap = 0;
            for (let i = 0; i < N; i++) {
              if (assignment[i][b1] === 1 && assignment[i][b2] === 1)
                newOverlap++;
            }

            if (newOverlap < currentMaxOverlap) {
              improved = true;
              break outerLoop;
            }

            // Revert
            assignment[item][sourceBoard] = 1;
            assignment[item][targetBoard] = 0;
            assignment[swapItem][targetBoard] = 1;
            assignment[swapItem][sourceBoard] = 0;

            boardItems[sourceBoard].add(item);
            boardItems[sourceBoard].delete(swapItem);
            boardItems[targetBoard].add(swapItem);
            boardItems[targetBoard].delete(item);
          }
        }
      }
    }

    if (!improved) break;
  }
}

/**
 * Solve using HiGHS ILP solver
 */
async function solveWithHiGHS(
  N: number,
  B: number,
  S: number,
  frequencies: number[]
): Promise<SolverResult> {
  const startTime = performance.now();

  try {
    const highs = await import("highs");
    const solver = await highs.default();

    const model = buildModel(N, B, S, frequencies);
    const result = solver.solve(model);

    if (result.Status !== "Optimal") {
      return {
        success: false,
        assignment: [],
        maxOverlap: -1,
        solveTimeMs: 0,
        solverUsed: "highs",
      };
    }

    const assignment: number[][] = Array.from({ length: N }, () =>
      Array(B).fill(0)
    );
    const boardItems: Set<number>[] = Array.from(
      { length: B },
      () => new Set()
    );

    for (const [name, col] of Object.entries(result.Columns)) {
      if (name.startsWith("x_")) {
        const parts = name.split("_");
        const i = parseInt(parts[1]);
        const b = parseInt(parts[2]);
        const primal = (col as { Primal: number }).Primal;
        if (i < N && b < B && primal > 0.5) {
          assignment[i][b] = 1;
          boardItems[b].add(i);
        }
      }
    }

    // Apply local search
    localSearchOptimization(assignment, boardItems, N, B);

    // Calculate final max overlap
    let maxOverlap = 0;
    for (let b1 = 0; b1 < B; b1++) {
      for (let b2 = b1 + 1; b2 < B; b2++) {
        let overlap = 0;
        for (let i = 0; i < N; i++) {
          if (assignment[i][b1] === 1 && assignment[i][b2] === 1) {
            overlap++;
          }
        }
        maxOverlap = Math.max(maxOverlap, overlap);
      }
    }

    return {
      success: true,
      assignment,
      maxOverlap,
      solveTimeMs: performance.now() - startTime,
      solverUsed: "highs",
    };
  } catch (error) {
    log.error("Solver error", error);
    return {
      success: false,
      assignment: [],
      maxOverlap: -1,
      solveTimeMs: 0,
      solverUsed: "highs",
    };
  }
}

/**
 * Greedy fallback solver
 */
function solveGreedy(
  N: number,
  B: number,
  S: number,
  frequencies: number[]
): SolverResult {
  const startTime = performance.now();
  const assignment: number[][] = Array.from({ length: N }, () =>
    Array(B).fill(0)
  );
  const boardItems: Set<number>[] = Array.from({ length: B }, () => new Set());
  const itemUsage: number[] = Array(N).fill(0);

  for (let b = 0; b < B; b++) {
    const candidates = Array.from({ length: N }, (_, i) => i).filter(
      (i) => itemUsage[i] < frequencies[i]
    );

    candidates.sort((a, b) => {
      const needA = frequencies[a] - itemUsage[a];
      const needB = frequencies[b] - itemUsage[b];
      return needB - needA;
    });

    const selected = candidates.slice(0, S);
    for (const item of selected) {
      assignment[item][b] = 1;
      boardItems[b].add(item);
      itemUsage[item]++;
    }
  }

  // Calculate max overlap
  let maxOverlap = 0;
  for (let b1 = 0; b1 < B; b1++) {
    for (let b2 = b1 + 1; b2 < B; b2++) {
      let overlap = 0;
      for (let i = 0; i < N; i++) {
        if (assignment[i][b1] === 1 && assignment[i][b2] === 1) overlap++;
      }
      maxOverlap = Math.max(maxOverlap, overlap);
    }
  }

  return {
    success: true,
    assignment,
    maxOverlap,
    solveTimeMs: performance.now() - startTime,
    solverUsed: "greedy",
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
    const boardItemsList: Item[] = [];
    for (let i = 0; i < config.items.length; i++) {
      if (assignment[i][b] === 1) {
        boardItemsList.push(config.items[i]);
      }
    }

    // Shuffle items for visual diversity
    const shuffledItems = shuffleArray(boardItemsList);

    const grid: Item[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Item[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < shuffledItems.length) {
          row.push(shuffledItems[idx]);
        }
      }
      grid.push(row);
    }

    boards.push({
      id: `board-${b + 1}`,
      boardNumber: b + 1,
      items: shuffledItems,
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
  timeMs: number,
  seedUsed: number
): GenerationStats {
  const B = boards.length;
  const S = getBoardSize(config.boardConfig);

  // Calculate pairwise overlaps
  let minOverlap = S;
  let totalOverlap = 0;
  let pairCount = 0;

  for (let i = 0; i < B; i++) {
    const items1 = new Set(boards[i].items.map((item) => item.id));
    for (let j = i + 1; j < B; j++) {
      let overlap = 0;
      for (const item of boards[j].items) {
        if (items1.has(item.id)) overlap++;
      }
      minOverlap = Math.min(minOverlap, overlap);
      maxOverlap = Math.max(maxOverlap, overlap);
      totalOverlap += overlap;
      pairCount++;
    }
  }

  const freqMap: Record<string, number> = {};
  config.items.forEach((item, i) => {
    freqMap[item.id] = frequencies[i];
  });

  return {
    totalSlots: B * S,
    totalItems: config.items.length,
    minOverlap,
    maxOverlap,
    avgOverlap: pairCount > 0 ? totalOverlap / pairCount : 0,
    generationTimeMs: timeMs,
    solverUsed,
    frequencies: freqMap,
    seedUsed,
  };
}

/**
 * Generate a random seed
 */
function generateRandomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

/**
 * Main entry point - Generate boards with HiGHS solver
 */
export async function generateBoardsWithHiGHS(
  config: GeneratorConfig
): Promise<GenerationResult> {
  const startTime = performance.now();

  // Use provided seed or generate a random one
  const seedUsed = config.seed ?? generateRandomSeed();
  setSeed(seedUsed);

  const N = config.items.length;
  const B = config.numBoards;
  const S = getBoardSize(config.boardConfig);
  const frequencies = calculateFrequencies(N, B, S, config.distribution);

  // Try HiGHS first
  let solverResult = await solveWithHiGHS(N, B, S, frequencies);

  // Fallback to greedy
  if (!solverResult.success) {
    solverResult = solveGreedy(N, B, S, frequencies);
  }

  if (!solverResult.success) {
    resetSeed();
    return {
      success: false,
      boards: [],
      stats: {
        totalSlots: 0,
        totalItems: 0,
        minOverlap: 0,
        maxOverlap: 0,
        avgOverlap: 0,
        generationTimeMs: 0,
        solverUsed: "greedy",
        frequencies: {},
        seedUsed,
      },
      errors: ["Failed to generate boards"],
    };
  }

  const boards = assignmentToBoards(solverResult.assignment, config);
  const stats = calculateStats(
    boards,
    config,
    frequencies,
    solverResult.solverUsed,
    solverResult.maxOverlap,
    performance.now() - startTime,
    seedUsed
  );

  // Reset to non-deterministic for future calls
  resetSeed();

  return { success: true, boards, stats };
}

