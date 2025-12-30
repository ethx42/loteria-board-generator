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
 * Calculate expected pairwise overlap between boards
 * 
 * Formula: E[overlap] ≈ S² / N
 * Where S = slots per board, N = total items
 * 
 * This is based on hypergeometric distribution:
 * When selecting S items from N twice, expected intersection ≈ S²/N
 */
export function calculateExpectedOverlap(boardSize: number, numItems: number): number {
  if (numItems <= 0) return boardSize;
  return (boardSize * boardSize) / numItems;
}

/**
 * Calculate minimum items needed for a target max overlap percentage
 * 
 * For a board of size S with max overlap of X% (e.g., 0.5 for 50%):
 * N ≥ S / X
 * 
 * @param boardSize - Number of slots per board
 * @param targetOverlapPercent - Target max overlap as decimal (0.5 = 50%)
 * @returns Minimum number of items needed
 */
export function calculateMinItemsForOverlap(
  boardSize: number,
  targetOverlapPercent: number
): number {
  if (targetOverlapPercent <= 0) return boardSize * 10; // Unrealistic
  return Math.ceil(boardSize / targetOverlapPercent);
}

/**
 * Quality tiers for board diversity
 */
export type DiversityTier = "excellent" | "good" | "fair" | "poor";

export interface DiversityAnalysis {
  tier: DiversityTier;
  expectedOverlap: number;
  expectedOverlapPercent: number;
  minItemsForGood: number;
  minItemsForExcellent: number;
  recommendation: string | null;
}

/**
 * Analyze diversity quality for a configuration
 * 
 * Tiers based on expected overlap percentage:
 * - Excellent: < 30% overlap
 * - Good: 30-50% overlap  
 * - Fair: 50-70% overlap
 * - Poor: > 70% overlap
 */
export function analyzeDiversity(
  boardSize: number,
  numItems: number
): DiversityAnalysis {
  const expectedOverlap = calculateExpectedOverlap(boardSize, numItems);
  const expectedOverlapPercent = expectedOverlap / boardSize;
  
  // Calculate items needed for better tiers
  const minItemsForGood = calculateMinItemsForOverlap(boardSize, 0.5); // 50%
  const minItemsForExcellent = calculateMinItemsForOverlap(boardSize, 0.3); // 30%
  
  let tier: DiversityTier;
  let recommendation: string | null = null;
  
  if (expectedOverlapPercent < 0.30) {
    tier = "excellent";
  } else if (expectedOverlapPercent < 0.50) {
    tier = "good";
  } else if (expectedOverlapPercent < 0.70) {
    tier = "fair";
    const itemsToAdd = minItemsForGood - numItems;
    if (itemsToAdd > 0) {
      recommendation = `Add ${itemsToAdd} more items (${minItemsForGood} total) for better diversity`;
    }
  } else {
    tier = "poor";
    const itemsToAdd = minItemsForGood - numItems;
    if (itemsToAdd > 0) {
      recommendation = `Add at least ${itemsToAdd} more items (${minItemsForGood} total) for acceptable diversity`;
    }
  }
  
  return {
    tier,
    expectedOverlap,
    expectedOverlapPercent,
    minItemsForGood,
    minItemsForExcellent,
    recommendation,
  };
}

// ============================================================================
// GAME EXPERIENCE CALCULATIONS
// ============================================================================

/**
 * Experience tier based on what fraction of players mark each item
 */
export type ExperienceTier = "chaotic" | "competitive" | "balanced" | "diverse";

/**
 * Game experience analysis based on players, grid, and items
 * 
 * The key insight: when an item is called, what fraction of players mark it?
 * This is the most intuitive measure of game quality.
 * 
 * Formula: markingFraction = S / N (simplified from frequency/B)
 * Where S = slots per board, N = total items
 */
export interface GameExperienceAnalysis {
  /** Number of players/boards */
  players: number;
  /** Slots per board */
  slots: number;
  /** Total items in the pool */
  items: number;
  /** How many times each item appears across all boards */
  itemFrequency: number;
  /** What fraction of players mark when an item is called (0-1) */
  markingFraction: number;
  /** Approximate number of players who mark each item */
  playersWhoMark: number;
  /** Experience quality tier */
  tier: ExperienceTier;
  /** Human-readable description */
  description: string;
}

/**
 * Analyze game experience based on the three key variables
 */
export function analyzeGameExperience(
  players: number,
  slots: number,
  items: number
): GameExperienceAnalysis {
  // Frequency = how many boards each item appears in
  const itemFrequency = items > 0 ? (players * slots) / items : players;
  
  // Marking fraction = what % of players mark when an item is called
  const markingFraction = items > 0 ? slots / items : 1;
  
  // Approximate players who mark
  const playersWhoMark = Math.round(markingFraction * players * 10) / 10;
  
  // Determine tier based on marking fraction
  let tier: ExperienceTier;
  let description: string;
  
  if (markingFraction >= 0.5) {
    tier = "chaotic";
    description = "Too many players mark each item - games end too quickly";
  } else if (markingFraction >= 0.33) {
    tier = "competitive";
    description = "High competition - multiple players race for each item";
  } else if (markingFraction >= 0.2) {
    tier = "balanced";
    description = "Ideal balance - enough competition with variety";
  } else {
    tier = "diverse";
    description = "Maximum variety - items feel unique to each player";
  }
  
  return {
    players,
    slots,
    items,
    itemFrequency,
    markingFraction,
    playersWhoMark,
    tier,
    description,
  };
}

/**
 * Recommendations for item counts based on players and grid
 */
export interface ItemRecommendations {
  /** Minimum items to fill one board */
  minimum: number;
  /** Items for competitive experience (~33% mark) */
  competitive: number;
  /** Items for balanced experience (~25% mark) - RECOMMENDED */
  balanced: number;
  /** Items for diverse experience (~20% mark) */
  diverse: number;
  /** Players who would mark at each tier */
  playersAtTier: {
    competitive: number;
    balanced: number;
    diverse: number;
  };
}

/**
 * Calculate item recommendations for a given player count and grid
 */
export function calculateItemRecommendations(
  players: number,
  slots: number
): ItemRecommendations {
  return {
    minimum: slots,
    competitive: Math.ceil(slots / 0.33),  // ~33% mark = 1/3 of players
    balanced: Math.ceil(slots / 0.25),      // ~25% mark = 1/4 of players
    diverse: Math.ceil(slots / 0.20),       // ~20% mark = 1/5 of players
    playersAtTier: {
      competitive: Math.round(players * 0.33),
      balanced: Math.round(players * 0.25),
      diverse: Math.round(players * 0.20),
    },
  };
}

/**
 * Get the recommended item count for a target experience tier
 */
export function getRecommendedItems(
  players: number,
  slots: number,
  targetTier: ExperienceTier = "balanced"
): number {
  const recs = calculateItemRecommendations(players, slots);
  
  switch (targetTier) {
    case "chaotic":
      return recs.minimum;
    case "competitive":
      return recs.competitive;
    case "balanced":
      return recs.balanced;
    case "diverse":
      return recs.diverse;
    default:
      return recs.balanced;
  }
}

/**
 * Format large numbers with appropriate suffix
 */
function formatNumber(n: number): string {
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
  
  // Generate helpful suggestions when invalid
  let uniqueBoardsMessage: string;
  if (uniqueBoardsValid) {
    uniqueBoardsMessage = `${formatNumber(c.possibleUniqueBoards)} possible boards ≥ ${c.B} required`;
  } else {
    const suggestions: string[] = [];
    
    // Suggestion 1: Add more items
    // Find minimum items needed for C(N, S) >= B
    let minItemsNeeded = c.N;
    while (binomial(minItemsNeeded, c.S) < c.B && minItemsNeeded < c.S * 3) {
      minItemsNeeded++;
    }
    if (minItemsNeeded > c.N && binomial(minItemsNeeded, c.S) >= c.B) {
      suggestions.push(`add ${minItemsNeeded - c.N} more items (${minItemsNeeded} total)`);
    }
    
    // Suggestion 2: Reduce board size
    let smallerBoardSize = c.S - 1;
    while (smallerBoardSize > 0 && binomial(c.N, smallerBoardSize) < c.B) {
      smallerBoardSize--;
    }
    if (smallerBoardSize > 0 && smallerBoardSize < c.S) {
      const rows = Math.floor(Math.sqrt(smallerBoardSize));
      const cols = Math.ceil(smallerBoardSize / rows);
      suggestions.push(`use smaller boards (${rows}×${cols} = ${smallerBoardSize} slots)`);
    }
    
    // Suggestion 3: Reduce number of boards
    if (c.possibleUniqueBoards > 0) {
      suggestions.push(`reduce to ${c.possibleUniqueBoards} boards`);
    }
    
    const suggestionText = suggestions.length > 0 
      ? ` Try: ${suggestions.join(", or ")}.`
      : "";
    
    uniqueBoardsMessage = `Only ${formatNumber(c.possibleUniqueBoards)} possible unique boards, need ${c.B}.${suggestionText}`;
  }
  
  validations.push({
    isValid: uniqueBoardsValid,
    constraint: "UNIQUE_BOARDS",
    message: uniqueBoardsMessage,
    severity: uniqueBoardsValid ? "info" : "error",
    details: { expected: c.B, actual: c.possibleUniqueBoards },
  });

  // 7. OVERLAP_QUALITY: Use diversity analysis for better recommendations
  const diversity = analyzeDiversity(c.S, c.N);
  
  // Consider "good" and "excellent" as valid
  const overlapQualityGood = diversity.tier === "excellent" || diversity.tier === "good";
  
  let overlapMessage: string;
  const overlapPercent = Math.round(diversity.expectedOverlapPercent * 100);
  const expectedOverlapRounded = Math.round(diversity.expectedOverlap * 10) / 10;
  
  switch (diversity.tier) {
    case "excellent":
      overlapMessage = `🌟 Excellent diversity: ~${expectedOverlapRounded} items overlap expected (${overlapPercent}% of board)`;
      break;
    case "good":
      overlapMessage = `✅ Good diversity: ~${expectedOverlapRounded} items overlap expected (${overlapPercent}% of board)`;
      break;
    case "fair":
      overlapMessage = `⚠️ Fair diversity: ~${expectedOverlapRounded} items overlap expected (${overlapPercent}% of board). ${diversity.recommendation || ""}`;
      break;
    case "poor":
      overlapMessage = `❌ Poor diversity: ~${expectedOverlapRounded} items overlap expected (${overlapPercent}% of board). ${diversity.recommendation || "Boards will be very similar."}`;
      break;
  }
  
  validations.push({
    isValid: overlapQualityGood,
    constraint: "OVERLAP_QUALITY",
    message: overlapMessage,
    severity: overlapQualityGood ? "info" : "warning",
    details: { 
      expected: diversity.minItemsForGood,
      actual: c.N,
      tier: diversity.tier,
      expectedOverlap: diversity.expectedOverlap,
      expectedOverlapPercent: diversity.expectedOverlapPercent,
    },
  });

  return validations;
}


