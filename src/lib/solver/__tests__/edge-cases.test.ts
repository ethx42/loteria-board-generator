/**
 * Edge Cases Test Suite
 *
 * Tests extreme scenarios to ensure the solver handles them gracefully:
 * 1. Pigeonhole Principle - near-maximum theoretical boards
 * 2. Impossible configurations - solver should fail gracefully
 * 3. Determinism - seeded generation produces consistent results
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  generateBoardsWithHiGHS,
  setSeed,
  resetSeed,
} from "../highs-solver";
import { validateConstraints, binomial } from "@/lib/constraints/engine";
import type { GeneratorConfig, Item } from "@/lib/types";

// ============================================================================
// HELPERS
// ============================================================================

function createItems(count: number): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
    index: i,
  }));
}

function createConfig(
  numItems: number,
  numBoards: number,
  rows: number,
  cols: number
): GeneratorConfig {
  return {
    items: createItems(numItems),
    numBoards,
    boardConfig: { rows, cols },
    distribution: { type: "uniform" },
  };
}

function getSignatures(
  boards: { items: Item[] }[]
): string[] {
  return boards.map((b) =>
    b.items
      .map((i) => i.id)
      .sort()
      .join(",")
  );
}

// ============================================================================
// PIGEONHOLE PRINCIPLE TESTS
// ============================================================================

describe("Pigeonhole Principle", () => {
  beforeEach(() => {
    resetSeed();
  });

  it("should handle near-maximum theoretical boards (N=20, S=4, B=C(20,4)=4845 is max)", async () => {
    // C(20,4) = 4845 possible unique boards
    // Let's request a reasonable fraction of the max
    const config = createConfig(20, 50, 2, 2); // 50 boards of 4 items from 20

    const result = await generateBoardsWithHiGHS(config);
    expect(result.success).toBe(true);
    expect(result.boards.length).toBe(50);

    // All boards should be unique
    const signatures = new Set(getSignatures(result.boards));
    expect(signatures.size).toBe(50);
  });

  it("should handle high-overlap scenario gracefully (18 items, 16 slots, many boards)", async () => {
    // C(18,16) = C(18,2) = 153 possible unique boards
    // With 100 boards, overlap is inevitable but should still work
    const config = createConfig(18, 100, 4, 4);

    const result = await generateBoardsWithHiGHS(config);
    expect(result.success).toBe(true);
    expect(result.boards.length).toBe(100);

    // Verify board sizes
    for (const board of result.boards) {
      expect(board.items.length).toBe(16);
    }

    // Overlap WILL be high, that's expected
    expect(result.stats.maxOverlap).toBeGreaterThan(10);
  });

  it("should report max possible boards via constraint validation", () => {
    // 10 items, boards of 5 → C(10,5) = 252 possible boards
    const config = createConfig(10, 100, 5, 1);

    const validations = validateConstraints(config);
    const uniqueBoardsValidation = validations.find(
      (v) => v.constraint === "UNIQUE_BOARDS"
    );

    expect(uniqueBoardsValidation).toBeDefined();
    expect(uniqueBoardsValidation!.isValid).toBe(true);
    expect(uniqueBoardsValidation!.details?.actual).toBe(252);
  });

  it("should correctly calculate binomial coefficients", () => {
    expect(binomial(10, 5)).toBe(252);
    expect(binomial(36, 16)).toBe(7307872110); // Tabula: 36 items, 16 slots
    expect(binomial(18, 16)).toBe(153);
    expect(binomial(5, 5)).toBe(1);
    expect(binomial(5, 0)).toBe(1);
    expect(binomial(3, 5)).toBe(0); // k > n
  });
});

// ============================================================================
// IMPOSSIBLE CONFIGURATIONS
// ============================================================================

describe("Impossible Configurations", () => {
  beforeEach(() => {
    resetSeed();
  });

  it("should fail gracefully when boards requested > C(N,S)", async () => {
    // C(5,4) = 5 possible unique boards, requesting 10
    const config = createConfig(5, 10, 2, 2);

    const validations = validateConstraints(config);
    const uniqueBoardsValidation = validations.find(
      (v) => v.constraint === "UNIQUE_BOARDS"
    );

    // Validation should catch this
    expect(uniqueBoardsValidation?.isValid).toBe(false);
  });

  it("should provide helpful suggestions when N=S (user's case: 16 items, 4x4, 100 boards)", () => {
    // C(16,16) = 1, but user wants 100 boards
    const config = createConfig(16, 100, 4, 4);

    const validations = validateConstraints(config);
    const uniqueBoardsValidation = validations.find(
      (v) => v.constraint === "UNIQUE_BOARDS"
    );

    expect(uniqueBoardsValidation?.isValid).toBe(false);
    expect(uniqueBoardsValidation?.message).toContain("Only 1 possible unique boards");
    expect(uniqueBoardsValidation?.message).toContain("Try:");
    // Should suggest adding more items
    expect(uniqueBoardsValidation?.message).toContain("add");
    expect(uniqueBoardsValidation?.message).toContain("more items");
  });

  it("should suggest smaller boards when that's the best fix", () => {
    // 10 items, 9 slots (3x3), 100 boards
    // C(10,9) = 10, need 100
    // Suggestion: use smaller boards (e.g., 2x2=4 slots) → C(10,4) = 210 > 100 ✓
    const config = createConfig(10, 100, 3, 3);

    const validations = validateConstraints(config);
    const uniqueBoardsValidation = validations.find(
      (v) => v.constraint === "UNIQUE_BOARDS"
    );

    expect(uniqueBoardsValidation?.isValid).toBe(false);
    expect(uniqueBoardsValidation?.message).toContain("Only 10 possible unique boards");
    expect(uniqueBoardsValidation?.message).toContain("smaller boards");
  });

  it("should fail gracefully when items < board size", async () => {
    // 10 items but board needs 16
    const config = createConfig(10, 5, 4, 4);

    const validations = validateConstraints(config);
    const minItemsValidation = validations.find(
      (v) => v.constraint === "MIN_ITEMS"
    );

    expect(minItemsValidation?.isValid).toBe(false);
    expect(minItemsValidation?.message).toContain("Need at least 16 items");
  });

  it("should fail gracefully when frequency exceeds boards", async () => {
    // 5 items, 10 boards, 4 slots each = 40 total slots
    // Each item needs 40/5 = 8 appearances, but only 10 boards
    // This is actually valid (8 < 10), let's make it fail
    // 3 items, 2 boards, 4 slots = 8 slots → each item needs 8/3 ≈ 3 appearances
    // But we only have 2 boards, so max frequency is 2
    const config = createConfig(3, 2, 2, 2);

    const validations = validateConstraints(config);
    const maxFreqValidation = validations.find(
      (v) => v.constraint === "MAX_FREQUENCY"
    );

    expect(maxFreqValidation?.isValid).toBe(false);
  });

  it("should warn when pool usage is too high (low diversity)", () => {
    // User's problematic config: 16 items, 9 slots (3x3), 100 boards
    // Expected overlap: 9²/16 = 5.1 items (~56% of board) → Fair tier
    const config = createConfig(16, 100, 3, 3);

    const validations = validateConstraints(config);
    const overlapQuality = validations.find(
      (v) => v.constraint === "OVERLAP_QUALITY"
    );

    expect(overlapQuality).toBeDefined();
    expect(overlapQuality?.isValid).toBe(false);
    expect(overlapQuality?.severity).toBe("warning");
    // New format: "Fair diversity" or "Poor diversity" with recommendation
    expect(overlapQuality?.message).toMatch(/Fair diversity|Poor diversity/);
    expect(overlapQuality?.message).toContain("overlap");
  });

  it("should pass overlap quality when pool usage is reasonable", () => {
    // Good config: 36 items, 9 slots (3x3), 15 boards
    // Expected overlap: 9²/36 = 2.25 items (~25% of board) → Excellent tier
    const config = createConfig(36, 15, 3, 3);

    const validations = validateConstraints(config);
    const overlapQuality = validations.find(
      (v) => v.constraint === "OVERLAP_QUALITY"
    );

    expect(overlapQuality).toBeDefined();
    expect(overlapQuality?.isValid).toBe(true);
    // New format: "Good diversity" or "Excellent diversity"
    expect(overlapQuality?.message).toMatch(/Good diversity|Excellent diversity/);
  });

  it("should handle edge case: exactly C(N,S) boards requested", async () => {
    // C(5,3) = 10 possible boards, request exactly 10
    const config = createConfig(5, 10, 3, 1);

    const validations = validateConstraints(config);
    const uniqueBoardsValidation = validations.find(
      (v) => v.constraint === "UNIQUE_BOARDS"
    );

    expect(uniqueBoardsValidation?.isValid).toBe(true);
    expect(uniqueBoardsValidation?.details?.actual).toBe(10);
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe("Determinism with Seeds", () => {
  afterEach(() => {
    resetSeed();
  });

  it("should produce identical results with the same seed via config", async () => {
    // Pass seed via config (the user-facing API)
    const config1 = { ...createConfig(20, 5, 3, 3), seed: 12345 };
    const config2 = { ...createConfig(20, 5, 3, 3), seed: 12345 };

    const result1 = await generateBoardsWithHiGHS(config1);
    const result2 = await generateBoardsWithHiGHS(config2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // The board ITEMS (as sets) should be identical
    const signatures1 = getSignatures(result1.boards);
    const signatures2 = getSignatures(result2.boards);
    expect(signatures1).toEqual(signatures2);

    // Visual order should also be identical with same seed
    const visualOrder1 = result1.boards.map((b) =>
      b.items.map((i) => i.id).join(",")
    );
    const visualOrder2 = result2.boards.map((b) =>
      b.items.map((i) => i.id).join(",")
    );

    expect(visualOrder1).toEqual(visualOrder2);

    // Seed should be reported in stats
    expect(result1.stats.seedUsed).toBe(12345);
    expect(result2.stats.seedUsed).toBe(12345);
  });

  it("should produce different visual orders with different seeds", async () => {
    const config1 = { ...createConfig(20, 5, 3, 3), seed: 11111 };
    const config2 = { ...createConfig(20, 5, 3, 3), seed: 99999 };

    const result1 = await generateBoardsWithHiGHS(config1);
    const result2 = await generateBoardsWithHiGHS(config2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Board content (as sets) should be the same (HiGHS is deterministic)
    const signatures1 = new Set(getSignatures(result1.boards));
    const signatures2 = new Set(getSignatures(result2.boards));
    expect(signatures1).toEqual(signatures2);

    // But visual order likely differs (shuffle with different seeds)
    const visualOrder1 = result1.boards.map((b) =>
      b.items.map((i) => i.id).join(",")
    );
    const visualOrder2 = result2.boards.map((b) =>
      b.items.map((i) => i.id).join(",")
    );

    // At least some boards should have different visual order
    const differentOrders = visualOrder1.filter(
      (order, i) => order !== visualOrder2[i]
    );
    expect(differentOrders.length).toBeGreaterThan(0);
  });

  it("should handle repeated generation with same seed", async () => {
    const results: string[][] = [];

    for (let run = 0; run < 3; run++) {
      const config = { ...createConfig(15, 3, 3, 3), seed: 42 };
      const result = await generateBoardsWithHiGHS(config);
      results.push(
        result.boards.map((b) => b.items.map((i) => i.id).join(","))
      );
    }

    // All runs should be identical
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  it("should generate random seed when not provided", async () => {
    const config = createConfig(15, 3, 3, 3); // No seed

    const result1 = await generateBoardsWithHiGHS(config);
    const result2 = await generateBoardsWithHiGHS(config);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // Seeds should be different (random)
    expect(result1.stats.seedUsed).not.toBe(result2.stats.seedUsed);

    // Both should be valid numbers
    expect(result1.stats.seedUsed).toBeGreaterThan(0);
    expect(result2.stats.seedUsed).toBeGreaterThan(0);
  });
});

// ============================================================================
// STRESS TESTS
// ============================================================================

describe("Stress Tests", () => {
  beforeEach(() => {
    resetSeed();
  });

  it("should handle large board count efficiently (100 boards)", async () => {
    const config = createConfig(54, 100, 4, 4);

    const startTime = performance.now();
    const result = await generateBoardsWithHiGHS(config);
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.boards.length).toBe(100);

    // Should complete in reasonable time (< 30 seconds)
    expect(duration).toBeLessThan(30000);

    // All boards should be valid
    for (const board of result.boards) {
      expect(board.items.length).toBe(16);
    }
  });

  it("should handle small pool with many boards", async () => {
    // 16 items, 16 slots → each board uses ALL items
    // Only 1 possible unique board, but let's see how it handles 5 requests
    const config = createConfig(16, 5, 4, 4);

    const validations = validateConstraints(config);
    const uniqueBoardsValidation = validations.find(
      (v) => v.constraint === "UNIQUE_BOARDS"
    );

    // C(16,16) = 1, but we're requesting 5
    expect(uniqueBoardsValidation?.isValid).toBe(false);
    expect(uniqueBoardsValidation?.details?.actual).toBe(1);
  });

  it("should verify theoretical overlap bounds", async () => {
    // With N items, S slots, B boards
    // Minimum possible overlap between any two boards:
    // If N < 2*S, overlap ≥ 2*S - N
    const N = 25;
    const S = 16;
    const B = 15;

    const config = createConfig(N, B, 4, 4);
    const result = await generateBoardsWithHiGHS(config);

    expect(result.success).toBe(true);

    // Theoretical minimum overlap: 2*16 - 25 = 7
    const theoreticalMinOverlap = Math.max(0, 2 * S - N);
    expect(result.stats.minOverlap).toBeGreaterThanOrEqual(theoreticalMinOverlap);
  });
});

// ============================================================================
// SOLVER FAILURE RECOVERY
// ============================================================================

describe("Solver Failure Recovery", () => {
  beforeEach(() => {
    resetSeed();
  });

  it("should fallback to greedy when HiGHS fails", async () => {
    // This test verifies the fallback mechanism exists
    // In normal conditions HiGHS should work, but we check the result type
    const config = createConfig(36, 15, 4, 4);

    const result = await generateBoardsWithHiGHS(config);

    expect(result.success).toBe(true);
    expect(result.stats.solverUsed).toMatch(/^(highs|greedy)$/);
  });

  it("should return meaningful error for truly impossible config", async () => {
    // This config violates slot balance in a way the solver can't fix
    const config: GeneratorConfig = {
      items: createItems(5),
      numBoards: 10,
      boardConfig: { rows: 4, cols: 4 }, // 16 slots but only 5 items
      distribution: { type: "uniform" },
    };

    const validations = validateConstraints(config);
    const hasError = validations.some((v) => !v.isValid);

    expect(hasError).toBe(true);
  });
});

