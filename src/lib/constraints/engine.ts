/**
 * Constraints Engine
 * Validates generator configurations against mathematical constraints
 */

import type {
  GeneratorConfig,
  ConstraintValidation,
  SystemConstraints,
  DistributionStrategy,
  FrequencyGroup,
} from "@/lib/types";
import { getBoardSize } from "@/lib/types";

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Calculate binomial coefficient C(n, k) = n! / (k! × (n-k)!)
 * Uses iterative approach to avoid overflow
 */
export function binomial(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k > n - k) k = n - k; // Optimize: C(n,k) = C(n, n-k)

  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Format large numbers with appropriate suffix
 */
export function formatNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

// ============================================================================
// FREQUENCY CALCULATION
// ============================================================================

/**
 * Calculate frequencies for each item based on distribution strategy
 */
export function calculateFrequencies(
  numItems: number,
  numBoards: number,
  boardSize: number,
  strategy: DistributionStrategy
): number[] {
  const totalSlots = numBoards * boardSize;

  switch (strategy.type) {
    case "uniform": {
      // Distribute as evenly as possible
      const baseFreq = Math.floor(totalSlots / numItems);
      const remainder = totalSlots % numItems;

      return Array.from({ length: numItems }, (_, i) =>
        i < remainder ? baseFreq + 1 : baseFreq
      );
    }

    case "grouped": {
      // Apply frequency to each group
      const frequencies = new Array(numItems).fill(0);

      for (const group of strategy.groups) {
        for (let i = group.startIndex; i <= group.endIndex && i < numItems; i++) {
          frequencies[i] = group.frequency;
        }
      }

      return frequencies;
    }

    case "custom": {
      // Use provided frequencies
      const frequencies = new Array(numItems).fill(0);

      for (const { itemId, frequency } of strategy.frequencies) {
        const index = parseInt(itemId) - 1;
        if (index >= 0 && index < numItems) {
          frequencies[index] = frequency;
        }
      }

      return frequencies;
    }

    default:
      return new Array(numItems).fill(0);
  }
}

/**
 * Auto-calculate optimal distribution
 * Returns frequencies and whether they're valid
 */
export function autoDistribute(
  numItems: number,
  numBoards: number,
  boardSize: number
): {
  frequencies: number[];
  isValid: boolean;
  suggestion?: string;
  groups?: FrequencyGroup[];
} {
  const totalSlots = numBoards * boardSize;
  const baseFreq = Math.floor(totalSlots / numItems);
  const remainder = totalSlots % numItems;

  const frequencies = Array.from({ length: numItems }, (_, i) =>
    i < remainder ? baseFreq + 1 : baseFreq
  );

  // Check constraints
  const maxFreq = Math.max(...frequencies);
  const minFreq = Math.min(...frequencies);

  if (maxFreq > numBoards) {
    return {
      frequencies,
      isValid: false,
      suggestion: `Max frequency (${maxFreq}) exceeds boards (${numBoards}). Add more items or reduce board size.`,
    };
  }

  if (minFreq < 1) {
    return {
      frequencies,
      isValid: false,
      suggestion: `Some items would not appear. Reduce boards or increase board size.`,
    };
  }

  // Build groups for display
  const groups: FrequencyGroup[] = [];
  if (remainder > 0) {
    groups.push({
      startIndex: 0,
      endIndex: remainder - 1,
      frequency: baseFreq + 1,
    });
  }
  if (remainder < numItems) {
    groups.push({
      startIndex: remainder,
      endIndex: numItems - 1,
      frequency: baseFreq,
    });
  }

  return {
    frequencies,
    isValid: true,
    groups,
  };
}

// ============================================================================
// SYSTEM CONSTRAINTS CALCULATION
// ============================================================================

/**
 * Compute all system constraints from configuration
 */
export function computeConstraints(config: GeneratorConfig): SystemConstraints {
  const N = config.items.length;
  const B = config.numBoards;
  const R = config.boardConfig.rows;
  const C = config.boardConfig.cols;
  const S = getBoardSize(config.boardConfig);
  const T = B * S;

  const frequencies = calculateFrequencies(N, B, S, config.distribution);
  const sumFrequencies = frequencies.reduce((a, b) => a + b, 0);

  return {
    N,
    B,
    S,
    T,
    R,
    C,
    frequencies,
    sumFrequencies,
    minPossibleSlots: N,
    maxPossibleSlots: N * B,
    possibleUniqueBoards: binomial(N, S),
  };
}

// ============================================================================
// CONSTRAINT VALIDATION
// ============================================================================

/**
 * Validate all constraints for a configuration
 * Returns array of validation results
 */
export function validateConstraints(
  config: GeneratorConfig
): ConstraintValidation[] {
  const validations: ConstraintValidation[] = [];
  const c = computeConstraints(config);

  // 1. SLOT_BALANCE: ∑fᵢ = B × S
  const slotBalanceValid = c.sumFrequencies === c.T;
  validations.push({
    isValid: slotBalanceValid,
    constraint: "SLOT_BALANCE",
    message: slotBalanceValid
      ? `Slot balance: ${c.sumFrequencies} = ${c.B} × ${c.S}`
      : `Slot imbalance: ∑fᵢ = ${c.sumFrequencies}, but B × S = ${c.T}. Difference: ${Math.abs(c.sumFrequencies - c.T)}`,
    severity: slotBalanceValid ? "info" : "error",
    details: { expected: c.T, actual: c.sumFrequencies },
  });

  // 2. MIN_ITEMS: N ≥ S
  const minItemsValid = c.N >= c.S;
  validations.push({
    isValid: minItemsValid,
    constraint: "MIN_ITEMS",
    message: minItemsValid
      ? `Items (${c.N}) ≥ board size (${c.S})`
      : `Need at least ${c.S} items to fill a board, only have ${c.N}`,
    severity: minItemsValid ? "info" : "error",
    details: { expected: c.S, actual: c.N },
  });

  // 3. MIN_FREQUENCY: All fᵢ ≥ 1
  const minFreq = Math.min(...c.frequencies);
  const minFreqValid = minFreq >= 1;
  validations.push({
    isValid: minFreqValid,
    constraint: "MIN_FREQUENCY",
    message: minFreqValid
      ? `All items appear at least once (min: ${minFreq})`
      : `Some items have frequency < 1 (min: ${minFreq})`,
    severity: minFreqValid ? "info" : "error",
    details: { expected: 1, actual: minFreq },
  });

  // 4. MAX_FREQUENCY: All fᵢ ≤ B
  const maxFreq = Math.max(...c.frequencies);
  const maxFreqValid = maxFreq <= c.B;
  validations.push({
    isValid: maxFreqValid,
    constraint: "MAX_FREQUENCY",
    message: maxFreqValid
      ? `All frequencies ≤ ${c.B} boards (max: ${maxFreq})`
      : `Some items exceed max frequency: ${maxFreq} > ${c.B} boards`,
    severity: maxFreqValid ? "info" : "error",
    details: { expected: c.B, actual: maxFreq },
  });

  // 5. FEASIBILITY: N ≤ T ≤ N × B
  const feasibilityValid = c.T >= c.minPossibleSlots && c.T <= c.maxPossibleSlots;
  validations.push({
    isValid: feasibilityValid,
    constraint: "FEASIBILITY",
    message: feasibilityValid
      ? `Feasible: ${c.minPossibleSlots} ≤ ${c.T} ≤ ${c.maxPossibleSlots}`
      : `Infeasible: need ${c.minPossibleSlots} ≤ T ≤ ${c.maxPossibleSlots}, but T = ${c.T}`,
    severity: feasibilityValid ? "info" : "error",
    details: { expected: c.minPossibleSlots, actual: c.T },
  });

  // 6. UNIQUE_BOARDS: C(N, S) ≥ B
  const uniqueBoardsValid = c.possibleUniqueBoards >= c.B;
  validations.push({
    isValid: uniqueBoardsValid,
    constraint: "UNIQUE_BOARDS",
    message: uniqueBoardsValid
      ? `${formatNumber(c.possibleUniqueBoards)} possible boards ≥ ${c.B} required`
      : `Only ${formatNumber(c.possibleUniqueBoards)} possible boards, need ${c.B}`,
    severity: uniqueBoardsValid ? "info" : "error",
    details: { expected: c.B, actual: c.possibleUniqueBoards },
  });

  return validations;
}

/**
 * Check if all constraints are satisfied
 */
export function isConfigValid(config: GeneratorConfig): boolean {
  const validations = validateConstraints(config);
  return validations.every((v) => v.isValid);
}

/**
 * Get only error validations
 */
export function getErrors(
  validations: ConstraintValidation[]
): ConstraintValidation[] {
  return validations.filter((v) => !v.isValid && v.severity === "error");
}

/**
 * Get only warning validations
 */
export function getWarnings(
  validations: ConstraintValidation[]
): ConstraintValidation[] {
  return validations.filter((v) => !v.isValid && v.severity === "warning");
}

