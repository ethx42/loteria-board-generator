/**
 * Tabula Game - Core Types
 * Complete type definitions for board generation and gameplay
 */

// Re-export game types from the game module for convenience
export type {
  ItemDefinition,
  DeckDefinition,
  DeckTheme,
  GameGeneratedBoard,
  GameStatus,
  ConnectionState,
  GameSession,
  HostUIMode,
  HostUIState,
  HostUIEvent,
} from "./game";

export {
  isItemDefinition,
  isDeckDefinition,
  isDeckTheme,
  isGameStatus,
  isValidLanguageCode,
  createConnectionState,
  createHostUIState,
  INITIAL_HOST_UI_STATE,
} from "./game";

// ============================================================================
// ITEM TYPES
// ============================================================================

/** Single item in the Tabula game */
export interface Item {
  id: string;
  name: string;
  image?: string;
}

// ============================================================================
// BOARD CONFIGURATION
// ============================================================================

/** Board grid configuration */
export interface BoardConfig {
  rows: number;
  cols: number;
}

/** Computed board size */
export function getBoardSize(config: BoardConfig): number {
  return config.rows * config.cols;
}

// ============================================================================
// FREQUENCY & DISTRIBUTION
// ============================================================================

/** Frequency configuration for a single item */
export interface ItemFrequency {
  itemId: string;
  frequency: number;
}

/** Group of items with same frequency */
export interface FrequencyGroup {
  startIndex: number;
  endIndex: number; // inclusive
  frequency: number;
}

/** Distribution strategy types */
export type DistributionStrategy =
  | { type: "uniform" }
  | { type: "grouped"; groups: FrequencyGroup[] }
  | { type: "custom"; frequencies: ItemFrequency[] };

// ============================================================================
// GENERATOR CONFIGURATION
// ============================================================================

/** Complete generator configuration */
export interface GeneratorConfig {
  items: Item[];
  numBoards: number;
  boardConfig: BoardConfig;
  distribution: DistributionStrategy;
  /** Optional seed for reproducible generation */
  seed?: number;
}

/** Default Tabula items (Barranquilla edition) */
export const DEFAULT_ITEMS: Item[] = [
  { id: "01", name: "PATACÓN DE GUINEO VERDE" },
  { id: "02", name: "ALEGRÍA DE COCO Y ANÍS" },
  { id: "03", name: "BOLLO DE MAÍZ" },
  { id: "04", name: "CABALLITO DE PAPAYA" },
  { id: "05", name: "SANCOCHO DE PESCADO" },
  { id: "06", name: "MAZAMORRA DE GUINEO" },
  { id: "07", name: "COCADA DE PANELA Y COCO" },
  { id: "08", name: "MOJARRA FRITA" },
  { id: "09", name: "TINAJERO" },
  { id: "10", name: "PIEDRA DE FILTRAR" },
  { id: "11", name: "TINAJA DE BARRO" },
  { id: "12", name: "PONCHERA" },
  { id: "13", name: "MECEDORA DE MIMBRE" },
  { id: "14", name: "FOGÓN DE LEÑA" },
  { id: "15", name: "TOTUMA Y CUCHARA DE PALO" },
  { id: "16", name: "MANTEL DE HULE" },
  { id: "17", name: "ESTACIÓN DEL FERROCARRIL" },
  { id: "18", name: "TRANVÍA DE BARRANQUILLA" },
  { id: "19", name: "EL VAPOR DAVID ARANGO" },
  { id: "20", name: "ROBLE MORADO EN FLOR" },
  { id: "21", name: "MANGLARES DE LA CIÉNAGA" },
  { id: "22", name: "BOSQUE SECO TROPICAL" },
  { id: "23", name: "BOCAS DE CENIZA" },
  { id: "24", name: "CALLES DE BARRIO ABAJO" },
  { id: "25", name: "LA MARIMONDA" },
  { id: "26", name: "LA PALENQUERA" },
  { id: "27", name: "VENDEDOR DE AGUACATES" },
  { id: "28", name: "LA NOVIA DE BARRANQUILLA" },
  { id: "29", name: "ALEJANDRO OBREGÓN" },
  { id: "30", name: "ENRIQUE GRAU" },
  { id: "31", name: "PESCADOR DE ATARRAYA" },
  { id: "32", name: "AZAFATE" },
  { id: "33", name: "AJIACO SANTAFEREÑO" },
  { id: "34", name: "TRANVÍA DE BOGOTÁ" },
  { id: "35", name: "OLLETA Y MOLINILLO" },
  { id: "36", name: "TAMAL SANTAFEREÑO" },
];

/** Default board configuration */
export const DEFAULT_BOARD_CONFIG: BoardConfig = {
  rows: 4,
  cols: 4,
};

/** Default number of boards */
export const DEFAULT_NUM_BOARDS = 15;

/** Default generator configuration */
export const DEFAULT_CONFIG: GeneratorConfig = {
  items: DEFAULT_ITEMS,
  numBoards: DEFAULT_NUM_BOARDS,
  boardConfig: DEFAULT_BOARD_CONFIG,
  distribution: { type: "uniform" },
};

// ============================================================================
// GENERATED BOARDS
// ============================================================================

/** A single generated board */
export interface GeneratedBoard {
  id: string;
  boardNumber: number;
  items: Item[];
  grid: Item[][]; // 2D representation for display
}

/** Statistics about the generation */
export interface GenerationStats {
  totalSlots: number;
  totalItems: number;
  minOverlap: number;
  maxOverlap: number;
  avgOverlap: number;
  generationTimeMs: number;
  solverUsed: "highs" | "greedy";
  frequencies: Record<string, number>;
  /** Seed used for this generation (save to reproduce) */
  seedUsed: number;
}

/** Complete generation result */
export interface GenerationResult {
  success: boolean;
  boards: GeneratedBoard[];
  stats: GenerationStats;
  errors?: string[];
}

// ============================================================================
// CONSTRAINT TYPES
// ============================================================================

/** Severity levels for constraint validation */
export type ConstraintSeverity = "error" | "warning" | "info";

/** Constraint types */
export type ConstraintType =
  | "SLOT_BALANCE"
  | "MIN_ITEMS"
  | "MIN_FREQUENCY"
  | "MAX_FREQUENCY"
  | "FEASIBILITY"
  | "UNIQUE_BOARDS"
  | "OVERLAP_QUALITY";

/** Single constraint validation result */
export interface ConstraintValidation {
  isValid: boolean;
  constraint: ConstraintType;
  message: string;
  severity: ConstraintSeverity;
  details?: {
    expected?: number;
    actual?: number;
  };
}

/** System constraints (computed values) */
export interface SystemConstraints {
  N: number; // Total items
  B: number; // Total boards
  S: number; // Board size (R × C)
  T: number; // Total slots (B × S)
  R: number; // Rows
  C: number; // Columns
  frequencies: number[]; // Frequency per item
  sumFrequencies: number;
  minPossibleSlots: number; // N
  maxPossibleSlots: number; // N × B
  possibleUniqueBoards: number; // C(N, S)
}

// ============================================================================
// WIZARD STATE
// ============================================================================

/** Wizard step IDs */
export type WizardStep = "items" | "board" | "distribution" | "preview" | "export";

/** Wizard state */
export interface WizardState {
  currentStep: WizardStep;
  config: GeneratorConfig;
  result: GenerationResult | null;
  validations: ConstraintValidation[];
  isGenerating: boolean;
  error: string | null;
}

// ============================================================================
// GAME TYPES (Phase 3 - To be implemented)
// ============================================================================
// Game types will be added when implementing the game play functionality

// ============================================================================
// PARSER TYPES
// ============================================================================

/** Parse warning (non-fatal issue) */
export interface ParseWarning {
  type: "duplicate" | "empty" | "quote_fixed" | "whitespace";
  message: string;
  line?: number;
}

/** Parse error (fatal issue) */
export interface ParseError {
  type: "syntax" | "validation";
  message: string;
  line?: number;
}

/** Parse result from text input */
export interface ParseResult {
  success: boolean;
  items: string[];
  warnings: ParseWarning[];
  errors: ParseError[];
  rawCount: number;
  uniqueCount: number;
}

