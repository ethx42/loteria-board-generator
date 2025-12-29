/**
 * Crypto Shuffle Tests
 *
 * Tests for the CSPRNG shuffle algorithm and seeded reproducibility.
 *
 * @see SRD §7.1 Shuffle Algorithm
 */

import { describe, it, expect } from "vitest";
import {
  cryptoShuffle,
  seededShuffle,
  generateCryptoSeed,
  validateShuffle,
} from "../crypto-shuffle";

describe("Crypto Shuffle", () => {
  const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  describe("cryptoShuffle", () => {
    it("should return all items from original array", () => {
      const { shuffled } = cryptoShuffle(testArray);

      expect(shuffled).toHaveLength(testArray.length);
      expect(new Set(shuffled)).toEqual(new Set(testArray));
    });

    it("should return a different order than input (statistical test)", () => {
      // Run multiple times to ensure randomness
      const results = Array.from({ length: 10 }, () =>
        cryptoShuffle(testArray)
      );

      // At least some results should be different from input
      const differentFromInput = results.filter(
        (r) => JSON.stringify(r.shuffled) !== JSON.stringify(testArray)
      );

      expect(differentFromInput.length).toBeGreaterThan(0);
    });

    it("should return a seed", () => {
      const { seedUsed } = cryptoShuffle(testArray);

      expect(typeof seedUsed).toBe("number");
      expect(seedUsed).toBeGreaterThanOrEqual(0);
    });

    it("should produce different results on multiple calls", () => {
      const results = Array.from({ length: 5 }, () =>
        cryptoShuffle(testArray)
      );

      const uniqueResults = new Set(
        results.map((r) => JSON.stringify(r.shuffled))
      );

      // With 5 shuffles of 10 items, very unlikely to get duplicates
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it("should not modify the original array", () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];

      cryptoShuffle(original);

      expect(original).toEqual(copy);
    });
  });

  describe("seededShuffle", () => {
    const seed = 12345;

    it("should produce same result with same seed", () => {
      const result1 = seededShuffle(testArray, seed);
      const result2 = seededShuffle(testArray, seed);

      expect(result1.shuffled).toEqual(result2.shuffled);
      expect(result1.seedUsed).toBe(seed);
      expect(result2.seedUsed).toBe(seed);
    });

    it("should produce different results with different seeds", () => {
      const result1 = seededShuffle(testArray, 12345);
      const result2 = seededShuffle(testArray, 54321);

      expect(result1.shuffled).not.toEqual(result2.shuffled);
    });

    it("should return all items from original array", () => {
      const { shuffled } = seededShuffle(testArray, seed);

      expect(shuffled).toHaveLength(testArray.length);
      expect(new Set(shuffled)).toEqual(new Set(testArray));
    });

    it("should work with empty array", () => {
      const { shuffled } = seededShuffle([], seed);

      expect(shuffled).toEqual([]);
    });

    it("should work with single element", () => {
      const { shuffled } = seededShuffle([42], seed);

      expect(shuffled).toEqual([42]);
    });

    it("should work with strings", () => {
      const strings = ["a", "b", "c", "d", "e"];
      const { shuffled } = seededShuffle(strings, seed);

      expect(shuffled).toHaveLength(strings.length);
      expect(new Set(shuffled)).toEqual(new Set(strings));
    });

    it("should work with objects", () => {
      const objects = [
        { id: 1, name: "one" },
        { id: 2, name: "two" },
        { id: 3, name: "three" },
      ];
      const { shuffled } = seededShuffle(objects, seed);

      expect(shuffled).toHaveLength(objects.length);
      objects.forEach((obj) => {
        expect(shuffled).toContainEqual(obj);
      });
    });
  });

  describe("generateCryptoSeed", () => {
    it("should return a number", () => {
      const seed = generateCryptoSeed();

      expect(typeof seed).toBe("number");
    });

    it("should return different values on multiple calls", () => {
      const seeds = Array.from({ length: 10 }, () => generateCryptoSeed());
      const uniqueSeeds = new Set(seeds);

      // With 10 calls, very unlikely to get duplicates
      expect(uniqueSeeds.size).toBe(10);
    });

    it("should return non-negative integers", () => {
      const seeds = Array.from({ length: 100 }, () => generateCryptoSeed());

      seeds.forEach((seed) => {
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(seed)).toBe(true);
      });
    });
  });

  describe("validateShuffle", () => {
    it("should return true for valid shuffle", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = [3, 1, 5, 2, 4];

      expect(validateShuffle(original, shuffled)).toBe(true);
    });

    it("should return false for different lengths", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = [1, 2, 3, 4];

      expect(validateShuffle(original, shuffled)).toBe(false);
    });

    it("should return false for missing elements", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = [1, 2, 3, 4, 6];

      expect(validateShuffle(original, shuffled)).toBe(false);
    });

    it("should return false for duplicate elements", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = [1, 2, 3, 3, 5];

      expect(validateShuffle(original, shuffled)).toBe(false);
    });

    it("should work with empty arrays", () => {
      expect(validateShuffle([], [])).toBe(true);
    });
  });

  describe("Fisher-Yates uniformity", () => {
    it("should produce uniform distribution (statistical test)", () => {
      const smallArray = [1, 2, 3];
      const positionCounts: number[][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];

      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const { shuffled } = cryptoShuffle(smallArray);
        shuffled.forEach((value, position) => {
          positionCounts[value - 1][position]++;
        });
      }

      // Each element should appear in each position roughly 1/3 of the time
      const expectedCount = iterations / 3;
      const tolerance = expectedCount * 0.15; // 15% tolerance

      positionCounts.forEach((elementCounts) => {
        elementCounts.forEach((count) => {
          expect(count).toBeGreaterThan(expectedCount - tolerance);
          expect(count).toBeLessThan(expectedCount + tolerance);
        });
      });
    });
  });

  describe("Mulberry32 PRNG determinism", () => {
    it("should produce identical sequences with same seed", () => {
      const array1 = Array.from({ length: 100 }, (_, i) => i);
      const array2 = Array.from({ length: 100 }, (_, i) => i);

      const seed = 987654321;

      const result1 = seededShuffle(array1, seed);
      const result2 = seededShuffle(array2, seed);

      expect(result1.shuffled).toEqual(result2.shuffled);
    });

    it("should be sensitive to seed differences", () => {
      const array = Array.from({ length: 100 }, (_, i) => i);

      const result1 = seededShuffle(array, 1);
      const result2 = seededShuffle(array, 2);

      expect(result1.shuffled).not.toEqual(result2.shuffled);
    });
  });
});

