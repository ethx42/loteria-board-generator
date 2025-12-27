# 🎴 Lotería Game - Implementation Plan

> **Complete TypeScript/Next.js Migration & Implementation Guide**  
> Version: 1.0 | Last Updated: December 2024

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [Mathematical Constraints](#mathematical-constraints)
4. [Architecture](#architecture)
5. [Phase 1: Foundation](#phase-1-foundation)
6. [Phase 2: Generator Route](#phase-2-generator-route)
7. [Phase 3: Game Route](#phase-3-game-route)
8. [Phase 4: Polish & Deploy](#phase-4-polish--deploy)
9. [File Structure](#file-structure)
10. [API Reference](#api-reference)

---

## Project Overview

### Vision
A modern, elegant web application for creating and playing the traditional Lotería game. The system generates optimally distributed game boards and provides a real-time multiplayer game experience.

### Key Features
- **Board Generator**: Configurable wizard to create optimally distributed boards
- **Game Play**: Real-time Lotería game with multiple players
- **Optimization**: Mathematical optimization using HiGHS solver
- **Modern UI**: Minimalist, elegant design with smooth animations

---

## Technical Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js | 16+ |
| Runtime | React | 19+ |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui | latest |
| Primitives | Radix UI | latest |
| Icons | Lucide React | latest |
| Animations | Framer Motion | 11+ |
| Solver | highs-solver (WASM) | latest |
| State | Zustand | 5.x |
| Forms | React Hook Form + Zod | latest |
| Database | SQLite (Turso) | optional |

---

## Mathematical Constraints

### System Variables

| Symbol | Name | Description | Constraints |
|--------|------|-------------|-------------|
| `N` | Total Items | Number of unique items in the pool | `N ≥ S` |
| `B` | Total Boards | Number of boards to generate | `B ≥ 1` |
| `S` | Board Size | Items per board (grid) | `S = R × C` |
| `R` | Rows | Rows per board | `R ≥ 1` |
| `C` | Columns | Columns per board | `C ≥ 1` |
| `T` | Total Slots | Total item placements | `T = B × S` |
| `fᵢ` | Frequency | Times item `i` appears | `fᵢ ≥ 1` |

### Core Equations

#### 1. Slot Balance Equation (Fundamental Constraint)
```
∑(fᵢ) = B × S
 i=1..N

Sum of all item frequencies MUST equal total slots available.
```

**Example:**
- 36 items, 15 boards, 4×4 grid (16 items/board)
- Total slots: 15 × 16 = 240
- Required: f₁ + f₂ + ... + f₃₆ = 240

#### 2. Minimum Frequency Constraint
```
fᵢ ≥ 1  for all i ∈ [1, N]

Every item must appear at least once.
```

#### 3. Maximum Frequency Constraint
```
fᵢ ≤ B  for all i ∈ [1, N]

No item can appear more times than there are boards.
```

#### 4. Board Capacity Constraint
```
Each board contains exactly S unique items.
No duplicates within a board.
```

#### 5. Board Uniqueness Constraint
```
For all boards bₓ, bᵧ where x ≠ y:
Set(bₓ) ≠ Set(bᵧ)

No two boards can have identical item sets.
```

#### 6. Feasibility Check
```
Minimum possible slots: N × 1 = N     (each item once)
Maximum possible slots: N × B         (each item on every board)

For valid configuration:
N ≤ B × S ≤ N × B
```

### Frequency Distribution Strategies

#### Strategy A: Uniform Distribution
```typescript
// All items appear the same number of times
const baseFrequency = Math.floor(totalSlots / numItems);
const remainder = totalSlots % numItems;

// First 'remainder' items get baseFrequency + 1
// Rest get baseFrequency
```

#### Strategy B: Grouped Distribution (Default for Lotería)
```typescript
// Items divided into groups with different frequencies
// Example: First 24 items × 7, Last 12 items × 6
// (24 × 7) + (12 × 6) = 168 + 72 = 240 ✓
```

#### Strategy C: Custom Distribution
```typescript
// User defines exact frequency for each item
// System validates: sum(frequencies) === B × S
```

### Validation Rules

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// Required validations:
const validations = [
  'SLOT_BALANCE',        // ∑fᵢ = B × S
  'MIN_FREQUENCY',       // All fᵢ ≥ 1
  'MAX_FREQUENCY',       // All fᵢ ≤ B
  'MIN_ITEMS',          // N ≥ S (enough items to fill a board)
  'UNIQUE_BOARDS',      // Theoretical possibility check
  'FEASIBILITY',        // N ≤ B×S ≤ N×B
];
```

### Combinatorial Feasibility

```
Number of possible unique boards = C(N, S)
Required: C(N, S) ≥ B

Where C(n, k) = n! / (k! × (n-k)!)
```

**Example Calculation:**
- N = 36 items, S = 16 items per board
- C(36, 16) = 7,307,872,110 possible boards
- B = 15 required boards
- 7.3 billion >> 15 ✓ (easily feasible)

### Optimization Objective

```
Minimize: max(overlap(bᵢ, bⱼ)) for all i < j

Where overlap(bᵢ, bⱼ) = |Set(bᵢ) ∩ Set(bⱼ)|
```

The HiGHS solver will find an assignment that minimizes the maximum overlap between any two boards, ensuring diverse gameplay.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   /generator        │    │   /play                     │ │
│  │                     │    │                             │ │
│  │  ┌───────────────┐  │    │  ┌───────────────────────┐  │ │
│  │  │ Wizard Steps  │  │    │  │ Game Controller       │  │ │
│  │  │ - Items       │  │    │  │ - Card Caller         │  │ │
│  │  │ - Board Size  │  │    │  │ - Player Boards       │  │ │
│  │  │ - Frequency   │  │    │  │ - Winner Detection    │  │ │
│  │  │ - Preview     │  │    │  └───────────────────────┘  │ │
│  │  └───────────────┘  │    │                             │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      Core Library                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Constraints  │  │  Solver      │  │  Validator       │  │
│  │ Engine       │  │  (HiGHS)     │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation

### Milestone 1.1: Project Setup
**Duration:** 1 day

| Task | Description | Priority |
|------|-------------|----------|
| 1.1.1 | Initialize Next.js 16 with TypeScript | 🔴 Critical |
| 1.1.2 | Configure Tailwind CSS 4 | 🔴 Critical |
| 1.1.3 | Install and configure shadcn/ui | 🔴 Critical |
| 1.1.4 | Set up Lucide icons | 🟡 High |
| 1.1.5 | Configure Framer Motion | 🟡 High |
| 1.1.6 | Set up ESLint + Prettier | 🟢 Medium |
| 1.1.7 | Configure path aliases | 🟢 Medium |
| 1.1.8 | Remove all Python files | 🔴 Critical |

**Commands:**
```bash
# Remove Python artifacts
rm -rf venv/ dist/ *.py requirements.txt loteria_boards.json

# Initialize Next.js
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Install dependencies
npm install lucide-react framer-motion zustand zod react-hook-form @hookform/resolvers

# Install HiGHS solver
npm install highs

# Initialize shadcn
npx shadcn@latest init
```

### Milestone 1.2: Core Types & Interfaces
**Duration:** 0.5 days

```typescript
// lib/types/index.ts

/** Single item in the Lotería */
export interface Item {
  id: string;
  name: string;
  image?: string;
}

/** Board configuration */
export interface BoardConfig {
  rows: number;
  cols: number;
  size: number; // rows × cols (computed)
}

/** Frequency configuration for an item */
export interface ItemFrequency {
  itemId: string;
  frequency: number;
}

/** Distribution strategy */
export type DistributionStrategy = 
  | { type: 'uniform' }
  | { type: 'grouped'; groups: FrequencyGroup[] }
  | { type: 'custom'; frequencies: ItemFrequency[] };

export interface FrequencyGroup {
  startIndex: number;
  endIndex: number;
  frequency: number;
}

/** Generator configuration */
export interface GeneratorConfig {
  items: Item[];
  numBoards: number;
  boardConfig: BoardConfig;
  distribution: DistributionStrategy;
}

/** Generated board */
export interface GeneratedBoard {
  id: string;
  boardNumber: number;
  items: Item[];
  grid: Item[][]; // 2D representation
}

/** Generation result */
export interface GenerationResult {
  success: boolean;
  boards: GeneratedBoard[];
  stats: GenerationStats;
  errors?: string[];
}

/** Statistics about the generation */
export interface GenerationStats {
  totalSlots: number;
  minOverlap: number;
  maxOverlap: number;
  avgOverlap: number;
  generationTimeMs: number;
  solverUsed: 'highs' | 'greedy';
}
```

### Milestone 1.3: Constraints Engine
**Duration:** 1 day

```typescript
// lib/constraints/engine.ts

export interface ConstraintValidation {
  isValid: boolean;
  constraint: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface SystemConstraints {
  totalItems: number;         // N
  totalBoards: number;        // B
  boardSize: number;          // S = R × C
  totalSlots: number;         // T = B × S
  frequencies: number[];      // fᵢ for each item
}

export function validateConstraints(config: GeneratorConfig): ConstraintValidation[] {
  const validations: ConstraintValidation[] = [];
  
  const N = config.items.length;
  const B = config.numBoards;
  const S = config.boardConfig.size;
  const T = B * S;
  
  // Calculate frequencies based on distribution strategy
  const frequencies = calculateFrequencies(config);
  const sumFrequencies = frequencies.reduce((a, b) => a + b, 0);
  
  // 1. Slot Balance: ∑fᵢ = B × S
  validations.push({
    isValid: sumFrequencies === T,
    constraint: 'SLOT_BALANCE',
    message: sumFrequencies === T 
      ? `Slot balance OK: ${sumFrequencies} = ${B} × ${S}`
      : `Slot imbalance: ∑fᵢ = ${sumFrequencies}, but B × S = ${T}`,
    severity: sumFrequencies === T ? 'info' : 'error'
  });
  
  // 2. Minimum Items: N ≥ S
  validations.push({
    isValid: N >= S,
    constraint: 'MIN_ITEMS',
    message: N >= S
      ? `Sufficient items: ${N} ≥ ${S}`
      : `Need at least ${S} items to fill a board, only have ${N}`,
    severity: N >= S ? 'info' : 'error'
  });
  
  // 3. Min Frequency: All fᵢ ≥ 1
  const hasZeroFreq = frequencies.some(f => f < 1);
  validations.push({
    isValid: !hasZeroFreq,
    constraint: 'MIN_FREQUENCY',
    message: !hasZeroFreq
      ? 'All items appear at least once'
      : 'Some items have frequency < 1',
    severity: !hasZeroFreq ? 'info' : 'error'
  });
  
  // 4. Max Frequency: All fᵢ ≤ B
  const exceedsMax = frequencies.some(f => f > B);
  validations.push({
    isValid: !exceedsMax,
    constraint: 'MAX_FREQUENCY',
    message: !exceedsMax
      ? `All frequencies within bounds (≤ ${B})`
      : `Some items exceed max frequency of ${B}`,
    severity: !exceedsMax ? 'info' : 'error'
  });
  
  // 5. Feasibility: N ≤ T ≤ N × B
  const minSlots = N;
  const maxSlots = N * B;
  const isFeasible = T >= minSlots && T <= maxSlots;
  validations.push({
    isValid: isFeasible,
    constraint: 'FEASIBILITY',
    message: isFeasible
      ? `Feasible configuration: ${minSlots} ≤ ${T} ≤ ${maxSlots}`
      : `Infeasible: need ${minSlots} ≤ T ≤ ${maxSlots}, but T = ${T}`,
    severity: isFeasible ? 'info' : 'error'
  });
  
  // 6. Unique Boards: C(N, S) ≥ B
  const possibleBoards = binomial(N, S);
  const canBeUnique = possibleBoards >= B;
  validations.push({
    isValid: canBeUnique,
    constraint: 'UNIQUE_BOARDS',
    message: canBeUnique
      ? `${formatNumber(possibleBoards)} possible unique boards ≥ ${B} required`
      : `Only ${formatNumber(possibleBoards)} possible boards, need ${B}`,
    severity: canBeUnique ? 'info' : 'error'
  });
  
  return validations;
}

function binomial(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}
```

### Milestone 1.4: HiGHS Solver Integration
**Duration:** 1.5 days

```typescript
// lib/solver/highs-solver.ts

import highs from 'highs';

export interface SolverResult {
  success: boolean;
  assignment: number[][]; // assignment[item][board] = 0 or 1
  maxOverlap: number;
  solveTimeMs: number;
}

export async function solveOptimalDistribution(
  numItems: number,
  numBoards: number,
  boardSize: number,
  frequencies: number[]
): Promise<SolverResult> {
  const startTime = performance.now();
  
  // Initialize HiGHS
  const solver = await highs();
  
  // Build the ILP model
  const model = buildModel(numItems, numBoards, boardSize, frequencies);
  
  // Solve
  const result = solver.solve(model);
  
  if (result.Status !== 'Optimal') {
    return {
      success: false,
      assignment: [],
      maxOverlap: -1,
      solveTimeMs: performance.now() - startTime
    };
  }
  
  // Parse solution
  const assignment = parseAssignment(result, numItems, numBoards);
  const maxOverlap = result.ObjectiveValue;
  
  return {
    success: true,
    assignment,
    maxOverlap,
    solveTimeMs: performance.now() - startTime
  };
}

function buildModel(
  N: number, 
  B: number, 
  S: number, 
  freq: number[]
): string {
  let lp = 'Minimize\n obj: z\n\nSubject To\n';
  
  // Variable x_i_b = 1 if item i is on board b
  // Constraint 1: Each item appears exactly freq[i] times
  for (let i = 0; i < N; i++) {
    const terms = [];
    for (let b = 0; b < B; b++) {
      terms.push(`x_${i}_${b}`);
    }
    lp += ` freq_${i}: ${terms.join(' + ')} = ${freq[i]}\n`;
  }
  
  // Constraint 2: Each board has exactly S items
  for (let b = 0; b < B; b++) {
    const terms = [];
    for (let i = 0; i < N; i++) {
      terms.push(`x_${i}_${b}`);
    }
    lp += ` board_${b}: ${terms.join(' + ')} = ${S}\n`;
  }
  
  // Constraint 3: Minimize max overlap
  // For each pair of boards, count shared items
  for (let b1 = 0; b1 < B; b1++) {
    for (let b2 = b1 + 1; b2 < B; b2++) {
      const terms = [];
      for (let i = 0; i < N; i++) {
        terms.push(`o_${i}_${b1}_${b2}`);
      }
      // z >= overlap(b1, b2)
      lp += ` overlap_${b1}_${b2}: z - ${terms.join(' - ')} >= 0\n`;
      
      // o_i_b1_b2 = x_i_b1 AND x_i_b2 (linearized)
      for (let i = 0; i < N; i++) {
        lp += ` and1_${i}_${b1}_${b2}: o_${i}_${b1}_${b2} - x_${i}_${b1} <= 0\n`;
        lp += ` and2_${i}_${b1}_${b2}: o_${i}_${b1}_${b2} - x_${i}_${b2} <= 0\n`;
        lp += ` and3_${i}_${b1}_${b2}: x_${i}_${b1} + x_${i}_${b2} - o_${i}_${b1}_${b2} <= 1\n`;
      }
    }
  }
  
  // Bounds
  lp += '\nBounds\n';
  lp += ` 0 <= z <= ${S}\n`;
  
  // Binary variables
  lp += '\nBinary\n';
  for (let i = 0; i < N; i++) {
    for (let b = 0; b < B; b++) {
      lp += ` x_${i}_${b}\n`;
    }
  }
  for (let b1 = 0; b1 < B; b1++) {
    for (let b2 = b1 + 1; b2 < B; b2++) {
      for (let i = 0; i < N; i++) {
        lp += ` o_${i}_${b1}_${b2}\n`;
      }
    }
  }
  
  lp += '\nEnd\n';
  return lp;
}
```

---

## Phase 2: Generator Route

### Milestone 2.1: Wizard Layout & Navigation
**Duration:** 1 day

| Task | Description | Priority |
|------|-------------|----------|
| 2.1.1 | Create `/generator` route | 🔴 Critical |
| 2.1.2 | Implement wizard state machine | 🔴 Critical |
| 2.1.3 | Create step indicator component | 🟡 High |
| 2.1.4 | Add navigation controls (back/next) | 🔴 Critical |
| 2.1.5 | Add progress animations | 🟢 Medium |

**Wizard Steps:**
```typescript
const WIZARD_STEPS = [
  { id: 'items', title: 'Items', icon: 'List' },
  { id: 'board', title: 'Board Size', icon: 'Grid3X3' },
  { id: 'distribution', title: 'Distribution', icon: 'BarChart3' },
  { id: 'preview', title: 'Preview', icon: 'Eye' },
  { id: 'export', title: 'Export', icon: 'Download' },
] as const;
```

### Milestone 2.2: Step 1 - Items Input
**Duration:** 1.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 2.2.1 | Create items input component | 🔴 Critical |
| 2.2.2 | Implement text parser with validation | 🔴 Critical |
| 2.2.3 | Add real-time item count display | 🟡 High |
| 2.2.4 | Create item preview chips | 🟡 High |
| 2.2.5 | Add default items loader | 🟡 High |
| 2.2.6 | Implement error/warning display | 🔴 Critical |

**Parser Features:**
```typescript
// Intelligent text parsing
const parseResults = parseItemsFromText(`
  "El Gallo"
  La Dama
  'El Sol', "La Luna"
  El Mundo; La Estrella
  1. El Corazón
  2) La Campana
`);

// Handles:
// - Quoted strings (single/double)
// - Comma, semicolon, newline separators
// - Numbered lists (1., 1), etc.)
// - Whitespace normalization
// - Quote balancing/correction
// - Duplicate detection
// - Empty string filtering
```

### Milestone 2.3: Step 2 - Board Configuration
**Duration:** 0.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 2.3.1 | Create grid size selector | 🔴 Critical |
| 2.3.2 | Add board count input | 🔴 Critical |
| 2.3.3 | Display calculated total slots | 🟡 High |
| 2.3.4 | Real-time constraint validation | 🔴 Critical |

**Presets:**
```typescript
const BOARD_PRESETS = [
  { name: '3×3', rows: 3, cols: 3, size: 9 },
  { name: '4×4', rows: 4, cols: 4, size: 16 },  // Default
  { name: '5×5', rows: 5, cols: 5, size: 25 },
  { name: 'Custom', rows: null, cols: null, size: null },
];
```

### Milestone 2.4: Step 3 - Distribution Strategy
**Duration:** 1 day

| Task | Description | Priority |
|------|-------------|----------|
| 2.4.1 | Auto-calculate uniform distribution | 🔴 Critical |
| 2.4.2 | Display frequency breakdown | 🟡 High |
| 2.4.3 | Show constraint validations | 🔴 Critical |
| 2.4.4 | Add suggestion system | 🟢 Medium |

**Auto-Distribution Logic:**
```typescript
function calculateAutoDistribution(
  numItems: number,
  numBoards: number,
  boardSize: number
): { frequencies: number[]; isValid: boolean; suggestion?: string } {
  const totalSlots = numBoards * boardSize;
  const baseFreq = Math.floor(totalSlots / numItems);
  const remainder = totalSlots % numItems;
  
  const frequencies = new Array(numItems).fill(baseFreq);
  for (let i = 0; i < remainder; i++) {
    frequencies[i]++;
  }
  
  // Validate
  const maxAllowed = numBoards;
  const exceedsMax = frequencies.some(f => f > maxAllowed);
  
  return {
    frequencies,
    isValid: !exceedsMax,
    suggestion: exceedsMax 
      ? `Reduce boards to ${Math.max(...frequencies)} or add more items`
      : undefined
  };
}
```

### Milestone 2.5: Step 4 - Board Preview
**Duration:** 1.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 2.5.1 | Generate boards on step entry | 🔴 Critical |
| 2.5.2 | Create board grid component | 🔴 Critical |
| 2.5.3 | Implement pagination (12 per page) | 🟡 High |
| 2.5.4 | Add board hover/focus states | 🟢 Medium |
| 2.5.5 | Display generation stats | 🟡 High |
| 2.5.6 | Add regenerate button | 🟢 Medium |

**Preview Grid Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Stats: 15 boards | Max overlap: 8 | Generated in 45ms  │
├─────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │   │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│ │  7  │ │  8  │ │  9  │ │ 10  │ │ 11  │ │ 12  │   │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
├─────────────────────────────────────────────────────┤
│               ← 1 2 3 ... →                         │
└─────────────────────────────────────────────────────┘
```

### Milestone 2.6: Step 5 - Export
**Duration:** 0.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 2.6.1 | Export as JSON | 🔴 Critical |
| 2.6.2 | Export as PDF (printable) | 🟡 High |
| 2.6.3 | Copy to clipboard | 🟢 Medium |
| 2.6.4 | Save to browser storage | 🟡 High |
| 2.6.5 | Generate shareable link | 🟢 Medium |

---

## Phase 3: Game Route

### Milestone 3.1: Game Setup
**Duration:** 1 day

| Task | Description | Priority |
|------|-------------|----------|
| 3.1.1 | Create `/play` route | 🔴 Critical |
| 3.1.2 | Load boards from storage/import | 🔴 Critical |
| 3.1.3 | Assign boards to players | 🟡 High |
| 3.1.4 | Create game state machine | 🔴 Critical |

### Milestone 3.2: Card Caller Interface
**Duration:** 1.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 3.2.1 | Create card display component | 🔴 Critical |
| 3.2.2 | Implement shuffle algorithm | 🔴 Critical |
| 3.2.3 | Add "call next" button | 🔴 Critical |
| 3.2.4 | Show called cards history | 🟡 High |
| 3.2.5 | Add auto-play mode (timer) | 🟢 Medium |
| 3.2.6 | Add card flip animation | 🟡 High |

### Milestone 3.3: Player Board View
**Duration:** 1 day

| Task | Description | Priority |
|------|-------------|----------|
| 3.3.1 | Display player's board | 🔴 Critical |
| 3.3.2 | Mark called items on board | 🔴 Critical |
| 3.3.3 | Add item click interaction | 🟡 High |
| 3.3.4 | Show progress indicator | 🟡 High |
| 3.3.5 | Add "¡Lotería!" button | 🔴 Critical |

### Milestone 3.4: Winner Detection
**Duration:** 0.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 3.4.1 | Detect winning patterns | 🔴 Critical |
| 3.4.2 | Validate winner claims | 🔴 Critical |
| 3.4.3 | Show winner celebration | 🟡 High |
| 3.4.4 | Reset game option | 🟡 High |

**Winning Patterns:**
```typescript
type WinPattern = 
  | 'full'       // All 16 items marked
  | 'row'        // Any complete row
  | 'column'     // Any complete column
  | 'diagonal'   // Main or anti-diagonal
  | 'corners';   // 4 corners

const DEFAULT_WIN_PATTERN: WinPattern = 'full';
```

---

## Phase 4: Polish & Deploy

### Milestone 4.1: UI Polish
**Duration:** 1.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 4.1.1 | Add page transitions | 🟡 High |
| 4.1.2 | Implement loading states | 🟡 High |
| 4.1.3 | Add micro-interactions | 🟢 Medium |
| 4.1.4 | Optimize for mobile | 🔴 Critical |
| 4.1.5 | Add keyboard navigation | 🟡 High |
| 4.1.6 | Implement dark mode | 🟢 Medium |

### Milestone 4.2: Testing
**Duration:** 1 day

| Task | Description | Priority |
|------|-------------|----------|
| 4.2.1 | Unit tests for constraints engine | 🔴 Critical |
| 4.2.2 | Unit tests for solver | 🔴 Critical |
| 4.2.3 | Integration tests for wizard | 🟡 High |
| 4.2.4 | E2E tests for game flow | 🟡 High |
| 4.2.5 | Edge case testing | 🔴 Critical |

### Milestone 4.3: Documentation
**Duration:** 0.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 4.3.1 | Update README | 🔴 Critical |
| 4.3.2 | Add usage examples | 🟡 High |
| 4.3.3 | Document API | 🟢 Medium |
| 4.3.4 | Add contribution guide | 🟢 Low |

### Milestone 4.4: Deployment
**Duration:** 0.5 days

| Task | Description | Priority |
|------|-------------|----------|
| 4.4.1 | Configure Vercel | 🔴 Critical |
| 4.4.2 | Set up environment variables | 🟡 High |
| 4.4.3 | Configure caching | 🟢 Medium |
| 4.4.4 | Add analytics | 🟢 Low |
| 4.4.5 | Set up error monitoring | 🟡 High |

---

## File Structure

```
loteria-game/
├── docs/
│   └── IMPLEMENTATION_PLAN.md     # This document
│
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home/landing
│   │   ├── globals.css            # Global styles
│   │   │
│   │   ├── generator/
│   │   │   ├── page.tsx           # Generator route
│   │   │   ├── loading.tsx        # Loading state
│   │   │   └── _components/
│   │   │       ├── wizard.tsx
│   │   │       ├── step-items.tsx
│   │   │       ├── step-board.tsx
│   │   │       ├── step-distribution.tsx
│   │   │       ├── step-preview.tsx
│   │   │       ├── step-export.tsx
│   │   │       ├── board-grid.tsx
│   │   │       └── constraint-display.tsx
│   │   │
│   │   └── play/
│   │       ├── page.tsx           # Game route
│   │       ├── loading.tsx
│   │       └── _components/
│   │           ├── game-controller.tsx
│   │           ├── card-caller.tsx
│   │           ├── player-board.tsx
│   │           ├── called-cards.tsx
│   │           └── winner-modal.tsx
│   │
│   ├── components/
│   │   └── ui/                    # shadcn components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── dialog.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── types/
│   │   │   └── index.ts           # All TypeScript types
│   │   │
│   │   ├── constraints/
│   │   │   ├── engine.ts          # Constraint validation
│   │   │   ├── calculator.ts      # Frequency calculations
│   │   │   └── validator.ts       # Board validation
│   │   │
│   │   ├── solver/
│   │   │   ├── highs-solver.ts    # HiGHS integration
│   │   │   ├── greedy-solver.ts   # Fallback solver
│   │   │   └── index.ts           # Solver facade
│   │   │
│   │   ├── parser/
│   │   │   └── items-parser.ts    # Text parsing logic
│   │   │
│   │   ├── game/
│   │   │   ├── state.ts           # Game state machine
│   │   │   ├── patterns.ts        # Win pattern detection
│   │   │   └── shuffle.ts         # Card shuffling
│   │   │
│   │   └── utils/
│   │       ├── math.ts            # Binomial, etc.
│   │       ├── format.ts          # Number formatting
│   │       └── storage.ts         # LocalStorage helpers
│   │
│   └── stores/
│       ├── generator-store.ts     # Wizard state
│       └── game-store.ts          # Game state
│
├── public/
│   ├── cards/                     # Card images (optional)
│   └── fonts/                     # Custom fonts
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## API Reference

### Generator API

```typescript
// Generate boards with full configuration
async function generateBoards(config: GeneratorConfig): Promise<GenerationResult>

// Quick generate with defaults
async function quickGenerate(
  items: string[],
  numBoards: number
): Promise<GenerationResult>

// Validate configuration before generating
function validateConfig(config: GeneratorConfig): ConstraintValidation[]

// Calculate auto-distribution
function autoDistribute(
  numItems: number,
  numBoards: number,
  boardSize: number
): { frequencies: number[]; isValid: boolean }
```

### Game API

```typescript
// Initialize game with boards
function initializeGame(boards: GeneratedBoard[]): GameState

// Call next card
function callNextCard(state: GameState): { card: Item; newState: GameState }

// Mark item on player board
function markItem(
  state: GameState,
  playerId: string,
  itemId: string
): GameState

// Check for winner
function checkWinner(
  state: GameState,
  playerId: string,
  pattern: WinPattern
): { isWinner: boolean; winningItems?: string[] }
```

---

## Timeline Summary

| Phase | Duration | Milestone Count |
|-------|----------|-----------------|
| Phase 1: Foundation | 4 days | 4 |
| Phase 2: Generator | 6 days | 6 |
| Phase 3: Game | 4 days | 4 |
| Phase 4: Polish | 3.5 days | 4 |
| **Total** | **17.5 days** | **18** |

---

## Success Criteria

### Generator Route
- [ ] All constraint validations pass
- [ ] Boards generated in < 5 seconds for typical configs
- [ ] Max overlap minimized (verified via stats)
- [ ] Export works in all formats
- [ ] Mobile responsive

### Game Route
- [ ] Smooth card calling experience
- [ ] Accurate winner detection
- [ ] Works offline after load
- [ ] Accessible (keyboard, screen reader)

### Performance
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] No layout shifts
- [ ] 60fps animations

---

*Document created: December 2024*  
*Status: Ready for Implementation*

