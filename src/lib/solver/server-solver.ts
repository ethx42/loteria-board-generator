"use server";

/**
 * Server-side Solver using javascript-lp-solver (ILP)
 * Pure JavaScript implementation - works in any environment
 */

import type { GeneratorConfig, GeneratedBoard, GenerationResult, GenerationStats, Item } from "@/lib/types";
import { getBoardSize } from "@/lib/types";
import { calculateFrequencies } from "@/lib/constraints/engine";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const solver = require("javascript-lp-solver");

interface SolverResult {
  success: boolean;
  assignment: number[][];
  maxOverlap: number;
  solveTimeMs: number;
  solverUsed: "ilp" | "greedy";
}

/**
 * Generate boards using ILP solver
 * Uses Integer Linear Programming to minimize maximum pairwise overlap
 */
export async function generateBoardsServer(
  config: GeneratorConfig
): Promise<GenerationResult> {
  const startTime = performance.now();

  const N = config.items.length;
  const B = config.numBoards;
  const S = getBoardSize(config.boardConfig);
  const frequencies = calculateFrequencies(N, B, S, config.distribution);

  // Try ILP first
  let solverResult = solveWithILP(N, B, S, frequencies);

  // Fallback to greedy if ILP fails
  if (!solverResult.success) {
    console.log("ILP failed, using greedy solver with local optimization");
    solverResult = solveGreedyOptimized(N, B, S, frequencies);
  }

  if (!solverResult.success) {
    return {
      success: false,
      boards: [],
      stats: createEmptyStats(config),
      errors: ["Failed to generate boards"],
    };
  }

  // Convert assignment to boards
  const boards = assignmentToBoards(solverResult.assignment, config);

  // Calculate stats
  const stats = calculateStats(
    boards,
    config,
    frequencies,
    solverResult.solverUsed,
    solverResult.maxOverlap,
    performance.now() - startTime
  );

  return {
    success: true,
    boards,
    stats,
  };
}

/**
 * Solve using javascript-lp-solver ILP
 * For small/medium problems, attempts to minimize overlap
 */
function solveWithILP(
  N: number,
  B: number,
  S: number,
  frequencies: number[]
): SolverResult {
  const startTime = performance.now();

  try {
    // Build the model
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model: any = {
      optimize: "z",
      opType: "min",
      constraints: {},
      variables: {},
      ints: {},
    };

    // Variables: x_i_b for item i on board b (binary)
    for (let i = 0; i < N; i++) {
      for (let b = 0; b < B; b++) {
        const varName = `x_${i}_${b}`;
        model.variables[varName] = { z: 0 };
        model.ints[varName] = 1;
      }
    }

    // Constraint 1: Each item appears exactly freq[i] times
    for (let i = 0; i < N; i++) {
      const constraintName = `freq_${i}`;
      model.constraints[constraintName] = { equal: frequencies[i] };
      for (let b = 0; b < B; b++) {
        model.variables[`x_${i}_${b}`][constraintName] = 1;
      }
    }

    // Constraint 2: Each board has exactly S items
    for (let b = 0; b < B; b++) {
      const constraintName = `board_${b}`;
      model.constraints[constraintName] = { equal: S };
      for (let i = 0; i < N; i++) {
        model.variables[`x_${i}_${b}`][constraintName] = 1;
      }
    }

    // For overlap minimization, we need auxiliary variables
    // This makes the problem much larger, so only do for small problems
    const useOverlapOptimization = N * B <= 400 && B <= 15;

    if (useOverlapOptimization) {
      // Variable z for max overlap
      model.variables["z"] = { z: 1 };
      model.ints["z"] = 1;
      model.constraints["z_bound"] = { max: S };
      model.variables["z"]["z_bound"] = 1;

      // For each pair of boards, constraint: z >= overlap(b1, b2)
      // overlap = sum_i (x_i_b1 * x_i_b2)
      // Linearize: o_i_b1_b2 = x_i_b1 AND x_i_b2
      for (let b1 = 0; b1 < B; b1++) {
        for (let b2 = b1 + 1; b2 < B; b2++) {
          const overlapConstraint = `overlap_${b1}_${b2}`;
          model.constraints[overlapConstraint] = { min: 0 };
          model.variables["z"][overlapConstraint] = 1;

          for (let i = 0; i < N; i++) {
            const oVar = `o_${i}_${b1}_${b2}`;
            model.variables[oVar] = { z: 0 };
            model.variables[oVar][overlapConstraint] = -1;
            model.ints[oVar] = 1;

            // o <= x_b1: o - x_b1 <= 0
            const c1 = `and1_${i}_${b1}_${b2}`;
            model.constraints[c1] = { max: 0 };
            model.variables[oVar][c1] = 1;
            model.variables[`x_${i}_${b1}`][c1] = -1;

            // o <= x_b2: o - x_b2 <= 0
            const c2 = `and2_${i}_${b1}_${b2}`;
            model.constraints[c2] = { max: 0 };
            model.variables[oVar][c2] = 1;
            model.variables[`x_${i}_${b2}`][c2] = -1;

            // o >= x_b1 + x_b2 - 1: -o + x_b1 + x_b2 <= 1
            const c3 = `and3_${i}_${b1}_${b2}`;
            model.constraints[c3] = { max: 1 };
            model.variables[oVar][c3] = -1;
            model.variables[`x_${i}_${b1}`][c3] = 1;
            model.variables[`x_${i}_${b2}`][c3] = 1;
          }
        }
      }
    }

    // Solve
    const result = solver.Solve(model);

    if (!result.feasible) {
      console.log("ILP: No feasible solution found");
      return { success: false, assignment: [], maxOverlap: -1, solveTimeMs: 0, solverUsed: "ilp" };
    }

    // Parse solution
    const assignment: number[][] = Array.from({ length: N }, () => Array(B).fill(0));
    for (let i = 0; i < N; i++) {
      for (let b = 0; b < B; b++) {
        const val = result[`x_${i}_${b}`];
        if (val !== undefined && val > 0.5) {
          assignment[i][b] = 1;
        }
      }
    }

    // Calculate max overlap
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
      solverUsed: "ilp",
    };
  } catch (error) {
    console.error("ILP error:", error);
    return { success: false, assignment: [], maxOverlap: -1, solveTimeMs: 0, solverUsed: "ilp" };
  }
}

/**
 * Greedy solver with local search optimization (simulated annealing-like)
 */
function solveGreedyOptimized(N: number, B: number, S: number, frequencies: number[]): SolverResult {
  const startTime = performance.now();

  const assignment: number[][] = Array.from({ length: N }, () => Array(B).fill(0));
  const boardCapacity = new Array(B).fill(S);
  const boardItems: Set<number>[] = Array.from({ length: B }, () => new Set());

  // Sort items by frequency (ascending) - harder to place first
  const itemOrder = Array.from({ length: N }, (_, i) => i).sort(
    (a, b) => frequencies[a] - frequencies[b]
  );

  // Initial greedy assignment
  for (const item of itemOrder) {
    const freq = frequencies[item];
    if (freq <= 0) continue;

    const availableBoards: { board: number; overlap: number }[] = [];

    for (let b = 0; b < B; b++) {
      if (boardCapacity[b] > 0 && assignment[item][b] === 0) {
        let overlapScore = 0;
        for (let other = 0; other < B; other++) {
          if (other !== b) {
            let overlap = 0;
            for (const existingItem of boardItems[b]) {
              if (boardItems[other].has(existingItem)) overlap++;
            }
            if (assignment[item][other] === 1) overlap++;
            overlapScore = Math.max(overlapScore, overlap);
          }
        }
        availableBoards.push({ board: b, overlap: overlapScore });
      }
    }

    availableBoards.sort((a, b) => a.overlap - b.overlap);

    if (availableBoards.length < freq) {
      return { success: false, assignment: [], maxOverlap: -1, solveTimeMs: 0, solverUsed: "greedy" };
    }

    for (let i = 0; i < freq; i++) {
      const b = availableBoards[i].board;
      assignment[item][b] = 1;
      boardCapacity[b]--;
      boardItems[b].add(item);
    }
  }

  // Repair duplicates
  repairDuplicates(assignment, boardItems, B);

  // Local search to reduce max overlap (hill climbing)
  const maxIterations = 2000;
  for (let iter = 0; iter < maxIterations; iter++) {
    const currentMaxOverlap = calculateMaxOverlap(assignment, N, B);
    if (currentMaxOverlap <= 5) break; // Good enough

    // Find pairs with max overlap
    const worstPairs: [number, number][] = [];
    for (let b1 = 0; b1 < B; b1++) {
      for (let b2 = b1 + 1; b2 < B; b2++) {
        let overlap = 0;
        for (let i = 0; i < N; i++) {
          if (assignment[i][b1] === 1 && assignment[i][b2] === 1) overlap++;
        }
        if (overlap === currentMaxOverlap) {
          worstPairs.push([b1, b2]);
        }
      }
    }

    if (worstPairs.length === 0) break;

    // Try to improve a random worst pair
    const [b1, b2] = worstPairs[Math.floor(Math.random() * worstPairs.length)];
    let improved = false;

    // Find shared items
    const sharedItems: number[] = [];
    for (let i = 0; i < N; i++) {
      if (assignment[i][b1] === 1 && assignment[i][b2] === 1) {
        sharedItems.push(i);
      }
    }

    // Try to move a shared item from one board to another
    for (const item of sharedItems) {
      if (improved) break;

      for (const sourceBoard of [b1, b2]) {
        if (improved) break;

        for (let targetBoard = 0; targetBoard < B; targetBoard++) {
          if (targetBoard === b1 || targetBoard === b2) continue;
          if (assignment[item][targetBoard] === 1) continue;

          // Find an item in targetBoard to swap
          for (const swapItem of boardItems[targetBoard]) {
            if (assignment[swapItem][sourceBoard] === 1) continue;

            // Perform swap
            assignment[item][sourceBoard] = 0;
            assignment[item][targetBoard] = 1;
            assignment[swapItem][targetBoard] = 0;
            assignment[swapItem][sourceBoard] = 1;

            boardItems[sourceBoard].delete(item);
            boardItems[sourceBoard].add(swapItem);
            boardItems[targetBoard].delete(swapItem);
            boardItems[targetBoard].add(item);

            // Check if improved
            const newMaxOverlap = calculateMaxOverlap(assignment, N, B);
            if (newMaxOverlap < currentMaxOverlap) {
              improved = true;
              break;
            } else {
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
    }
  }

  const maxOverlap = calculateMaxOverlap(assignment, N, B);

  return {
    success: true,
    assignment,
    maxOverlap,
    solveTimeMs: performance.now() - startTime,
    solverUsed: "greedy",
  };
}

function calculateMaxOverlap(assignment: number[][], N: number, B: number): number {
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
  return maxOverlap;
}

function repairDuplicates(
  assignment: number[][],
  boardItems: Set<number>[],
  B: number
): void {
  for (let iter = 0; iter < 100; iter++) {
    const boardSets = boardItems.map((items) => Array.from(items).sort().join(","));
    let hasDuplicate = false;

    for (let b1 = 0; b1 < B && !hasDuplicate; b1++) {
      for (let b2 = b1 + 1; b2 < B && !hasDuplicate; b2++) {
        if (boardSets[b1] === boardSets[b2]) {
          for (const itemInB2 of boardItems[b2]) {
            let fixed = false;
            for (let b3 = 0; b3 < B && !fixed; b3++) {
              if (b3 === b1 || b3 === b2) continue;
              for (const itemInB3 of boardItems[b3]) {
                if (!boardItems[b3].has(itemInB2) && !boardItems[b2].has(itemInB3)) {
                  const newB2 = new Set(boardItems[b2]);
                  newB2.delete(itemInB2);
                  newB2.add(itemInB3);
                  if (Array.from(newB2).sort().join(",") !== boardSets[b1]) {
                    assignment[itemInB2][b2] = 0;
                    assignment[itemInB2][b3] = 1;
                    assignment[itemInB3][b3] = 0;
                    assignment[itemInB3][b2] = 1;
                    boardItems[b2].delete(itemInB2);
                    boardItems[b2].add(itemInB3);
                    boardItems[b3].delete(itemInB3);
                    boardItems[b3].add(itemInB2);
                    fixed = true;
                    hasDuplicate = true;
                    break;
                  }
                }
              }
            }
            if (fixed) break;
          }
        }
      }
    }
    if (!hasDuplicate) break;
  }
}

function assignmentToBoards(assignment: number[][], config: GeneratorConfig): GeneratedBoard[] {
  const B = config.numBoards;
  const { rows, cols } = config.boardConfig;
  const boards: GeneratedBoard[] = [];

  for (let b = 0; b < B; b++) {
    const boardItems: Item[] = [];
    for (let i = 0; i < config.items.length; i++) {
      if (assignment[i][b] === 1) {
        boardItems.push(config.items[i]);
      }
    }

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

function calculateStats(
  boards: GeneratedBoard[],
  config: GeneratorConfig,
  frequencies: number[],
  solverUsed: "ilp" | "greedy",
  maxOverlap: number,
  timeMs: number
): GenerationStats {
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

  const freqMap = new Map<string, number>();
  config.items.forEach((item, idx) => {
    freqMap.set(item.id, frequencies[idx]);
  });

  return {
    totalSlots: config.numBoards * getBoardSize(config.boardConfig),
    totalItems: config.items.length,
    minOverlap: overlaps.length > 0 ? Math.min(...overlaps) : 0,
    maxOverlap: overlaps.length > 0 ? Math.max(...overlaps) : maxOverlap,
    avgOverlap: overlaps.length > 0 ? overlaps.reduce((a, b) => a + b, 0) / overlaps.length : 0,
    generationTimeMs: timeMs,
    solverUsed,
    frequencies: freqMap,
  };
}

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
