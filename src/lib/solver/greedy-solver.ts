/**
 * Greedy Solver
 * Fallback algorithm when HiGHS is not available
 *
 * Uses a balanced greedy approach with diversity optimization:
 * 1. Assign items to boards prioritizing those with lower frequency (harder to place)
 * 2. For each item, select boards that minimize overlap with already-assigned items
 * 3. Repair any duplicate boards via swapping
 */

export interface GreedySolverResult {
  success: boolean;
  assignment: number[][];
  maxOverlap: number;
}

/**
 * Solve using greedy algorithm with overlap minimization
 */
export function solveGreedy(
  N: number,
  B: number,
  S: number,
  frequencies: number[]
): GreedySolverResult {
  // Initialize assignment matrix
  const assignment: number[][] = Array.from({ length: N }, () =>
    Array(B).fill(0)
  );

  // Track board capacities
  const boardCapacity = new Array(B).fill(S);

  // Track which items are on each board (for overlap calculation)
  const boardItems: Set<number>[] = Array.from({ length: B }, () => new Set());

  // Sort items by frequency (ascending) - harder to place first
  const itemOrder = Array.from({ length: N }, (_, i) => i).sort(
    (a, b) => frequencies[a] - frequencies[b]
  );

  // Assign each item
  for (const item of itemOrder) {
    const freq = frequencies[item];
    if (freq <= 0) continue;

    // Find best boards for this item
    const availableBoards = [];
    for (let b = 0; b < B; b++) {
      if (boardCapacity[b] > 0 && assignment[item][b] === 0) {
        const overlapScore = calculateOverlapScore(item, b, boardItems, assignment);
        availableBoards.push({ board: b, capacity: boardCapacity[b], overlap: overlapScore });
      }
    }

    // Sort by overlap (ascending), then by capacity (descending)
    availableBoards.sort((a, b) => {
      if (a.overlap !== b.overlap) return a.overlap - b.overlap;
      return b.capacity - a.capacity;
    });

    if (availableBoards.length < freq) {
      // Cannot satisfy constraints
      console.error(`Cannot place item ${item} with frequency ${freq}`);
      return { success: false, assignment: [], maxOverlap: -1 };
    }

    // Assign to best boards
    for (let i = 0; i < freq; i++) {
      const b = availableBoards[i].board;
      assignment[item][b] = 1;
      boardCapacity[b]--;
      boardItems[b].add(item);
    }
  }

  // Repair duplicate boards
  repairDuplicates(assignment, boardItems, N, B);

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

  return { success: true, assignment, maxOverlap };
}

/**
 * Calculate overlap score for adding item to board
 * Lower is better (means less overlap with other boards)
 */
function calculateOverlapScore(
  item: number,
  board: number,
  boardItems: Set<number>[],
  assignment: number[][]
): number {
  let maxOverlap = 0;

  for (let other = 0; other < boardItems.length; other++) {
    if (other === board) continue;

    // Current overlap between board and other
    let overlap = 0;
    for (const i of boardItems[board]) {
      if (boardItems[other].has(i)) overlap++;
    }

    // Would adding this item increase overlap with other?
    if (assignment[item][other] === 1) {
      overlap++;
    }

    maxOverlap = Math.max(maxOverlap, overlap);
  }

  return maxOverlap;
}

/**
 * Repair duplicate boards by swapping items
 */
function repairDuplicates(
  assignment: number[][],
  boardItems: Set<number>[],
  N: number,
  B: number
): void {
  const maxIterations = 100;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Find duplicates
    const boardSets = boardItems.map((items) =>
      Array.from(items).sort().join(",")
    );
    const duplicates: [number, number][] = [];

    for (let b1 = 0; b1 < B; b1++) {
      for (let b2 = b1 + 1; b2 < B; b2++) {
        if (boardSets[b1] === boardSets[b2]) {
          duplicates.push([b1, b2]);
        }
      }
    }

    if (duplicates.length === 0) return;

    // Fix first duplicate
    const [b1, b2] = duplicates[0];
    let fixed = false;

    // Try to swap an item from b2 with an item from another board b3
    for (const itemInB2 of boardItems[b2]) {
      if (fixed) break;

      for (let b3 = 0; b3 < B; b3++) {
        if (b3 === b1 || b3 === b2) continue;

        for (const itemInB3 of boardItems[b3]) {
          // Check if we can swap
          if (
            !boardItems[b3].has(itemInB2) &&
            !boardItems[b2].has(itemInB3)
          ) {
            // Check that after swap, b2 won't equal b1
            const newB2 = new Set(boardItems[b2]);
            newB2.delete(itemInB2);
            newB2.add(itemInB3);

            if (!setsEqual(newB2, boardItems[b1])) {
              // Perform swap
              assignment[itemInB2][b2] = 0;
              assignment[itemInB2][b3] = 1;
              assignment[itemInB3][b3] = 0;
              assignment[itemInB3][b2] = 1;

              boardItems[b2].delete(itemInB2);
              boardItems[b2].add(itemInB3);
              boardItems[b3].delete(itemInB3);
              boardItems[b3].add(itemInB2);

              fixed = true;
              break;
            }
          }
        }

        if (fixed) break;
      }
    }

    if (!fixed) {
      console.warn(`Could not repair duplicate boards ${b1} and ${b2}`);
      return;
    }
  }
}

/**
 * Check if two sets are equal
 */
function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

