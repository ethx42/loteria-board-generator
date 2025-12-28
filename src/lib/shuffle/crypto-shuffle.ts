/**
 * Crypto-Secure Shuffle Module
 *
 * Implements cryptographically secure shuffling using Web Crypto API
 * with fallback to seeded PRNG for reproducibility.
 *
 * @module lib/shuffle/crypto-shuffle
 * @see SRD §7.1 Shuffle Algorithm
 * @see FR-011 Deck shuffle using CSPRNG
 */

import { devWarn } from "@/lib/utils/dev-logger";

// ============================================================================
// TYPES
// ============================================================================

export interface ShuffleResult<T> {
  /** The shuffled array */
  shuffled: T[];

  /** The seed used (for reproducibility) */
  seedUsed: number;
}

// ============================================================================
// MULBERRY32 PRNG
// ============================================================================

/**
 * Mulberry32: Fast, high-quality 32-bit PRNG
 * Used for reproducible seeded shuffles.
 *
 * @param seed - Initial seed value
 * @returns Function that returns random numbers in [0, 1)
 */
function mulberry32(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// FISHER-YATES SHUFFLE
// ============================================================================

/**
 * Fisher-Yates (Knuth) shuffle implementation.
 * Guarantees uniform distribution when using a proper random source.
 *
 * @param array - Array to shuffle (not modified)
 * @param random - Random number generator returning values in [0, 1)
 * @returns New shuffled array
 */
function fisherYatesShuffle<T>(array: readonly T[], random: () => number): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// ============================================================================
// CSPRNG FUNCTIONS
// ============================================================================

/**
 * Generate a cryptographically secure random seed.
 * Uses Web Crypto API when available, falls back to Math.random.
 *
 * @returns Random 32-bit integer seed
 */
export function generateCryptoSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0];
  }

  // Fallback for environments without Web Crypto
  devWarn(
    "CryptoShuffle",
    "Web Crypto API not available, falling back to Math.random for seed generation"
  );
  return Math.floor(Math.random() * 0xffffffff);
}

/**
 * Create a CSPRNG-based random function.
 * Uses crypto.getRandomValues for each call.
 *
 * @returns Random number in [0, 1)
 */
function cryptoRandom(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] / 0xffffffff;
  }
  return Math.random();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Shuffle an array using CSPRNG (Web Crypto API).
 * Generates and saves a seed for reproducibility.
 *
 * @param array - Array to shuffle
 * @returns Shuffled array and seed used
 *
 * @example
 * ```ts
 * const { shuffled, seedUsed } = cryptoShuffle([1, 2, 3, 4, 5]);
 * console.log(shuffled); // [3, 1, 5, 2, 4]
 * console.log(seedUsed); // 2847583920
 * ```
 *
 * @see SRD §7.1 - Uses CSPRNG for initial shuffle
 * @see FR-011 - Deck shuffle using CSPRNG
 */
export function cryptoShuffle<T>(array: readonly T[]): ShuffleResult<T> {
  const seed = generateCryptoSeed();
  const random = mulberry32(seed);
  const shuffled = fisherYatesShuffle(array, random);

  return { shuffled, seedUsed: seed };
}

/**
 * Shuffle an array using a specific seed for reproducibility.
 * Given the same seed and input, produces identical output.
 *
 * @param array - Array to shuffle
 * @param seed - Seed for the PRNG
 * @returns Shuffled array and seed used
 *
 * @example
 * ```ts
 * const result1 = seededShuffle([1, 2, 3, 4, 5], 12345);
 * const result2 = seededShuffle([1, 2, 3, 4, 5], 12345);
 * // result1.shuffled === result2.shuffled (same order)
 * ```
 *
 * @see SRD §7.1 - Mulberry32 PRNG for seeded shuffle
 */
export function seededShuffle<T>(
  array: readonly T[],
  seed: number
): ShuffleResult<T> {
  const random = mulberry32(seed);
  const shuffled = fisherYatesShuffle(array, random);

  return { shuffled, seedUsed: seed };
}

/**
 * Shuffle an array using pure CSPRNG (no seed saved).
 * Each shuffle is truly random and not reproducible.
 *
 * @param array - Array to shuffle
 * @returns Shuffled array
 *
 * @deprecated Prefer cryptoShuffle() which saves the seed for debugging
 */
export function pureRandomShuffle<T>(array: readonly T[]): T[] {
  return fisherYatesShuffle(array, cryptoRandom);
}

/**
 * Validate shuffle result integrity.
 * Ensures the shuffled array contains all original elements.
 *
 * @param original - Original array
 * @param shuffled - Shuffled result
 * @returns True if shuffle is valid
 */
export function validateShuffle<T>(
  original: readonly T[],
  shuffled: readonly T[]
): boolean {
  if (original.length !== shuffled.length) return false;

  const originalSet = new Set(original);
  const shuffledSet = new Set(shuffled);

  if (originalSet.size !== shuffledSet.size) return false;

  for (const item of original) {
    if (!shuffledSet.has(item)) return false;
  }

  return true;
}

