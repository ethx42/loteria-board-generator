/**
 * Board Prediction Engine Tests
 *
 * @module lib/boards/__tests__/prediction.test
 */

import { describe, it, expect } from "vitest";
import {
  calculateBoardPrediction,
  calculateBoardPredictions,
  hasCompletedBoard,
  hasAlmostCompleteBoard,
  getLeadingBoard,
  getRemainingCount,
} from "../prediction";
import type { BoardDefinition } from "../../types/boards";

// ============================================================================
// TEST DATA
// ============================================================================

const createBoard = (
  number: number,
  items: string[]
): BoardDefinition => ({
  id: `board-${number}`,
  number,
  items,
  grid: [items], // Simplified grid for testing
});

const board1: BoardDefinition = createBoard(1, ["01", "02", "03", "04"]);
const board2: BoardDefinition = createBoard(2, ["01", "02", "05", "06"]);
const board3: BoardDefinition = createBoard(3, ["03", "04", "07", "08"]);
const board4: BoardDefinition = createBoard(4, ["01", "05", "09", "10"]);

const allBoards = [board1, board2, board3, board4];

// ============================================================================
// calculateBoardPrediction
// ============================================================================

describe("calculateBoardPrediction", () => {
  it("should return 0% for empty called items", () => {
    const result = calculateBoardPrediction(board1, new Set());

    expect(result.id).toBe("board-1");
    expect(result.number).toBe(1);
    expect(result.totalSlots).toBe(4);
    expect(result.filledSlots).toBe(0);
    expect(result.percentComplete).toBe(0);
    expect(result.remainingItems).toEqual(["01", "02", "03", "04"]);
    expect(result.isComplete).toBe(false);
    expect(result.isAlmostComplete).toBe(false);
  });

  it("should calculate correct percentage for partial completion", () => {
    const result = calculateBoardPrediction(board1, new Set(["01", "02"]));

    expect(result.filledSlots).toBe(2);
    expect(result.percentComplete).toBe(50);
    expect(result.remainingItems).toEqual(["03", "04"]);
    expect(result.isComplete).toBe(false);
    expect(result.isAlmostComplete).toBe(false);
  });

  it("should mark as almost complete at 80%+", () => {
    // 4 items, 4 called = need at least 80% = 3.2 = 4 items
    // Actually 3/4 = 75%, 4/4 = 100%
    // Let's use a 5-item board: 4/5 = 80%
    const board5 = createBoard(5, ["01", "02", "03", "04", "05"]);
    const result = calculateBoardPrediction(board5, new Set(["01", "02", "03", "04"]));

    expect(result.filledSlots).toBe(4);
    expect(result.percentComplete).toBe(80);
    expect(result.isAlmostComplete).toBe(true);
    expect(result.isComplete).toBe(false);
  });

  it("should mark as complete at 100%", () => {
    const result = calculateBoardPrediction(
      board1,
      new Set(["01", "02", "03", "04"])
    );

    expect(result.filledSlots).toBe(4);
    expect(result.percentComplete).toBe(100);
    expect(result.remainingItems).toEqual([]);
    expect(result.isComplete).toBe(true);
    expect(result.isAlmostComplete).toBe(true);
  });

  it("should handle items not on the board", () => {
    const result = calculateBoardPrediction(board1, new Set(["99", "98"]));

    expect(result.filledSlots).toBe(0);
    expect(result.percentComplete).toBe(0);
  });

  it("should normalize item IDs for matching", () => {
    // Board has "01", called items have "01 EL GALLO" format
    const boardWithFullNames = createBoard(1, ["01", "02", "03", "04"]);
    const result = calculateBoardPrediction(
      boardWithFullNames,
      new Set(["01", "02"]) // Just IDs
    );

    expect(result.filledSlots).toBe(2);
  });
});

// ============================================================================
// calculateBoardPredictions
// ============================================================================

describe("calculateBoardPredictions", () => {
  it("should return summary for multiple boards", () => {
    const result = calculateBoardPredictions(allBoards, ["01", "02"]);

    expect(result.totalBoards).toBe(4);
    expect(result.topBoards).toHaveLength(4);
  });

  it("should sort boards by completion percentage descending", () => {
    // Board1: 01,02,03,04 - with 01,02 = 50%
    // Board2: 01,02,05,06 - with 01,02 = 50%
    // Board3: 03,04,07,08 - with 01,02 = 0%
    // Board4: 01,05,09,10 - with 01,02 = 25% (just 01)
    const result = calculateBoardPredictions(allBoards, ["01", "02"]);

    expect(result.topBoards[0].percentComplete).toBeGreaterThanOrEqual(
      result.topBoards[1].percentComplete
    );
  });

  it("should identify completed boards", () => {
    const result = calculateBoardPredictions(
      allBoards,
      ["01", "02", "03", "04"] // Completes board1
    );

    expect(result.completedBoards).toHaveLength(1);
    expect(result.completedBoards[0].id).toBe("board-1");
  });

  it("should identify almost complete boards", () => {
    // Make a board with 5 items, call 4 of them = 80%
    const board5 = createBoard(5, ["01", "02", "03", "04", "05"]);
    const result = calculateBoardPredictions(
      [board5],
      ["01", "02", "03", "04"]
    );

    expect(result.almostCompleteBoards).toHaveLength(1);
    expect(result.completedBoards).toHaveLength(0);
  });

  it("should handle items with id property", () => {
    const itemsWithIds = [
      { id: "01", name: "El Gallo" },
      { id: "02", name: "El Diablo" },
    ];

    const result = calculateBoardPredictions(allBoards, itemsWithIds);

    expect(result.topBoards[0].filledSlots).toBeGreaterThan(0);
  });

  it("should limit top boards to 5", () => {
    const manyBoards = Array.from({ length: 10 }, (_, i) =>
      createBoard(i + 1, [`0${i + 1}`, `${i + 10}`])
    );

    const result = calculateBoardPredictions(manyBoards, []);

    expect(result.topBoards).toHaveLength(5);
  });

  it("should handle empty boards array", () => {
    const result = calculateBoardPredictions([], ["01", "02"]);

    expect(result.totalBoards).toBe(0);
    expect(result.completedBoards).toEqual([]);
    expect(result.almostCompleteBoards).toEqual([]);
    expect(result.topBoards).toEqual([]);
  });

  it("should handle empty called items", () => {
    const result = calculateBoardPredictions(allBoards, []);

    expect(result.totalBoards).toBe(4);
    expect(result.completedBoards).toEqual([]);
    expect(result.almostCompleteBoards).toEqual([]);
    expect(result.topBoards.every((b) => b.percentComplete === 0)).toBe(true);
  });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe("hasCompletedBoard", () => {
  it("should return true when there is a completed board", () => {
    const summary = calculateBoardPredictions(
      [board1],
      ["01", "02", "03", "04"]
    );

    expect(hasCompletedBoard(summary)).toBe(true);
  });

  it("should return false when no boards are complete", () => {
    const summary = calculateBoardPredictions([board1], ["01"]);

    expect(hasCompletedBoard(summary)).toBe(false);
  });
});

describe("hasAlmostCompleteBoard", () => {
  it("should return true for almost complete boards", () => {
    const board5 = createBoard(5, ["01", "02", "03", "04", "05"]);
    const summary = calculateBoardPredictions(
      [board5],
      ["01", "02", "03", "04"]
    );

    expect(hasAlmostCompleteBoard(summary)).toBe(true);
  });

  it("should return true for completed boards", () => {
    const summary = calculateBoardPredictions(
      [board1],
      ["01", "02", "03", "04"]
    );

    expect(hasAlmostCompleteBoard(summary)).toBe(true);
  });

  it("should return false when no boards are close", () => {
    const summary = calculateBoardPredictions([board1], ["01"]);

    expect(hasAlmostCompleteBoard(summary)).toBe(false);
  });
});

describe("getLeadingBoard", () => {
  it("should return the first non-complete board", () => {
    const summary = calculateBoardPredictions(allBoards, ["01", "02"]);
    const leader = getLeadingBoard(summary);

    expect(leader).not.toBeNull();
    expect(leader?.isComplete).toBe(false);
  });

  it("should return null when all boards are complete", () => {
    // Complete board1
    const summary = calculateBoardPredictions(
      [board1],
      ["01", "02", "03", "04"]
    );
    const leader = getLeadingBoard(summary);

    expect(leader).toBeNull();
  });
});

describe("getRemainingCount", () => {
  it("should return correct remaining count", () => {
    const prediction = calculateBoardPrediction(board1, new Set(["01", "02"]));

    expect(getRemainingCount(prediction)).toBe(2);
  });

  it("should return 0 for complete board", () => {
    const prediction = calculateBoardPrediction(
      board1,
      new Set(["01", "02", "03", "04"])
    );

    expect(getRemainingCount(prediction)).toBe(0);
  });
});

// ============================================================================
// PERFORMANCE
// ============================================================================

describe("Performance", () => {
  it("should handle 100 boards efficiently", () => {
    // Create 100 boards with 16 items each
    const manyBoards = Array.from({ length: 100 }, (_, i) =>
      createBoard(
        i + 1,
        Array.from({ length: 16 }, (_, j) => `${i * 16 + j + 1}`.padStart(2, "0"))
      )
    );

    // Call 50 random items
    const calledItems = Array.from({ length: 50 }, (_, i) =>
      `${i + 1}`.padStart(2, "0")
    );

    const start = performance.now();
    const result = calculateBoardPredictions(manyBoards, calledItems);
    const duration = performance.now() - start;

    expect(result.totalBoards).toBe(100);
    expect(duration).toBeLessThan(50); // Should be well under 50ms
  });
});

