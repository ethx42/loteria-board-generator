/**
 * Tabula Game Types
 *
 * Core type definitions for the Tabula game system.
 * These types are designed to work alongside the existing Generator types
 * while providing the additional functionality needed for gameplay.
 *
 * @module lib/types/game
 * @see SRD §3 Data Models
 */

// ============================================================================
// CORE GAME TYPES (SRD §3.1)
// ============================================================================

/**
 * ItemDefinition
 *
 * Represents a single card in the Tabula deck.
 * Extends the basic Item concept with educational content and theming.
 *
 * @example
 * ```ts
 * const item: ItemDefinition = {
 *   id: "01",
 *   name: "El Sol",
 *   imageUrl: "/decks/universal/sol.png",
 *   shortText: "El sol sale para todos, pero no todos lo ven igual.",
 *   longText: "En muchas culturas antiguas...",
 *   category: "Naturaleza",
 * };
 * ```
 *
 * @see SRD §3.1 Core Types
 */
export interface ItemDefinition {
  /** Unique identifier (e.g., "01", "sol-01") */
  readonly id: string;

  /** Display name (e.g., "El Sol") */
  readonly name: string;

  /** Path to card image. Next.js Image handles optimization. */
  readonly imageUrl: string;

  /** Short educational text shown alongside the card (required for gameplay) */
  readonly shortText: string;

  /** Extended text shown on card flip (optional) */
  readonly longText?: string;

  /** Category for grouping (optional) */
  readonly category?: string;

  /** Dominant color for UI accents (optional, can be extracted from image) */
  readonly themeColor?: string;
}

/**
 * DeckTheme
 *
 * Visual customization for the deck.
 * Applied via CSS variables at session start.
 *
 * @see SRD §3.1 Core Types, FR-017
 */
export interface DeckTheme {
  /** Primary accent color (hex format) */
  readonly primaryColor: string;

  /** Secondary accent color (optional) */
  readonly secondaryColor?: string;

  /** Custom font family for card names */
  readonly fontFamily?: string;

  /** Background image URL for the game display */
  readonly backgroundUrl?: string;
}

/**
 * DeckDefinition
 *
 * Complete deck configuration. Immutable during gameplay.
 * This is the primary data structure loaded at session start.
 *
 * @example
 * ```ts
 * const deck: DeckDefinition = {
 *   id: "tabula-universal",
 *   name: "Tabula Universal",
 *   language: "es",
 *   items: [...],
 *   theme: { primaryColor: "#8B4513" }
 * };
 * ```
 *
 * @see SRD §3.1 Core Types, §3.5 Example Deck JSON
 */
export interface DeckDefinition {
  /** Unique deck identifier */
  readonly id: string;

  /** Display name for the deck */
  readonly name: string;

  /** Optional description */
  readonly description?: string;

  /** Language code (ISO 639-1, e.g., "es", "en") */
  readonly language: string;

  /** Ordered array of items in the deck */
  readonly items: readonly ItemDefinition[];

  /** Visual theme (optional) */
  readonly theme?: DeckTheme;
}

/**
 * GameGeneratedBoard
 *
 * Board structure for gameplay. References items by ID only.
 * This is distinct from the Generator's GeneratedBoard which includes full Item objects.
 *
 * @see SRD §3.1 Core Types
 */
export interface GameGeneratedBoard {
  /** Unique board identifier */
  readonly id: string;

  /** Board number (1-indexed for display) */
  readonly boardNumber: number;

  /** Flat array of item IDs on this board */
  readonly itemIds: readonly string[];

  /** 2D grid representation (itemIds) for display */
  readonly grid: readonly (readonly string[])[];
}

// ============================================================================
// GAME SESSION TYPES (SRD §3.2)
// ============================================================================

/**
 * GameStatus
 *
 * Represents the current state of a game session.
 *
 * State transitions:
 * - waiting → ready (controller connects)
 * - ready → playing (first card drawn)
 * - playing → paused (pause command)
 * - paused → playing (resume command)
 * - playing → finished (all cards drawn)
 * - any → waiting (reset command)
 *
 * @see SRD §3.2 Game Session Types
 */
export type GameStatus =
  | "waiting" // Waiting for controller to connect
  | "ready" // Controller connected, game not started
  | "playing" // Game in progress
  | "paused" // Game paused
  | "finished"; // All cards have been drawn

/**
 * ConnectionState
 *
 * Tracks WebSocket connection status for Host and Controller.
 *
 * @see SRD §3.2 Game Session Types
 */
export interface ConnectionState {
  /** Whether the host display is connected to the room */
  readonly hostConnected: boolean;

  /** Whether a controller is currently connected */
  readonly controllerConnected: boolean;

  /** Connection ID of the current controller (null if disconnected) */
  readonly controllerId: string | null;

  /** Timestamp of last ping (for connection health monitoring) */
  readonly lastPing: number;
}

/**
 * GameSession
 *
 * Runtime state during active gameplay.
 * Managed by the Host, synchronized to Controller via WebSocket.
 *
 * This is the central state object that represents a complete game session.
 *
 * @example
 * ```ts
 * const session: GameSession = {
 *   id: "ABCD",
 *   deck: myDeck,
 *   boards: [],
 *   shuffledDeck: ["03", "01", "02", ...],
 *   currentIndex: 5,
 *   currentItem: deck.items[0],
 *   history: [...],
 *   totalItems: 36,
 *   shuffleSeed: 12345678,
 *   status: "playing",
 *   connection: { hostConnected: true, controllerConnected: true, ... }
 * };
 * ```
 *
 * @see SRD §3.2 Game Session Types
 */
export interface GameSession {
  /** Unique session/room identifier (4-char code, e.g., "ABCD") */
  readonly id: string;

  /** Complete deck data loaded at session start */
  readonly deck: DeckDefinition;

  /** Generated boards (empty if playing without printed boards) */
  readonly boards: readonly GameGeneratedBoard[];

  /** Shuffled item IDs representing the draw pile order */
  readonly shuffledDeck: readonly string[];

  /** Current position in the shuffled deck (-1 before first draw) */
  readonly currentIndex: number;

  /** Currently displayed item (null before first draw or after finish) */
  readonly currentItem: ItemDefinition | null;

  /** Previously called items in order (oldest first) */
  readonly history: readonly ItemDefinition[];

  /** Total number of items in the deck */
  readonly totalItems: number;

  /** Seed used for shuffle (saved for reproducibility) */
  readonly shuffleSeed: number;

  /** Current session status */
  readonly status: GameStatus;

  /** WebSocket connection state */
  readonly connection: ConnectionState;
}

// ============================================================================
// UI STATE MACHINE TYPES (SRD §3.3)
// ============================================================================

/**
 * HostUIMode
 *
 * The two primary UI modes for the Host Display.
 *
 * @see SRD §2.4 Host UI State Machine Diagram
 */
export type HostUIMode = "standalone" | "paired";

/**
 * HostUIState
 *
 * State machine state for Host Display UI modes.
 * Controls fullscreen behavior and control bar visibility.
 *
 * @see SRD §3.3 UI State Types, §2.4 State Machine Diagram
 */
export interface HostUIState {
  /** Current UI mode */
  readonly mode: HostUIMode;

  /** Whether display is in fullscreen mode */
  readonly isFullscreen: boolean;

  /** Whether control bar is currently visible */
  readonly controlsVisible: boolean;

  /** Whether controls are temporarily shown (will auto-hide) */
  readonly controlsTemporary: boolean;
}

/**
 * HostUIEvent
 *
 * Events that trigger Host UI state transitions.
 * Implements a discriminated union for type-safe event handling.
 *
 * @see SRD §3.3 UI State Types
 */
export type HostUIEvent =
  | { readonly type: "CONTROLLER_CONNECTED" }
  | { readonly type: "CONTROLLER_DISCONNECTED" }
  | { readonly type: "ENTER_FULLSCREEN" }
  | { readonly type: "EXIT_FULLSCREEN" }
  | { readonly type: "TOGGLE_FULLSCREEN" }
  | { readonly type: "TOGGLE_CONTROLS" }
  | { readonly type: "SHOW_CONTROLS" }
  | { readonly type: "HIDE_CONTROLS" }
  | { readonly type: "HOVER_BOTTOM" }
  | { readonly type: "HOVER_TIMEOUT" };

/**
 * Initial state for the Host UI state machine.
 * Starts in standalone mode with controls visible.
 */
export const INITIAL_HOST_UI_STATE: HostUIState = {
  mode: "standalone",
  isFullscreen: false,
  controlsVisible: true,
  controlsTemporary: false,
} as const;

// ============================================================================
// TYPE GUARDS & VALIDATION
// ============================================================================

/**
 * Type guard to check if an object is a valid ItemDefinition.
 * Validates all required fields are present and correctly typed.
 */
export function isItemDefinition(value: unknown): value is ItemDefinition {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.name === "string" &&
    item.name.length > 0 &&
    typeof item.imageUrl === "string" &&
    item.imageUrl.length > 0 &&
    typeof item.shortText === "string" &&
    item.shortText.length > 0 &&
    (item.longText === undefined || typeof item.longText === "string") &&
    (item.category === undefined || typeof item.category === "string") &&
    (item.themeColor === undefined || typeof item.themeColor === "string")
  );
}

/**
 * Type guard to check if an object is a valid DeckTheme.
 */
export function isDeckTheme(value: unknown): value is DeckTheme {
  if (!value || typeof value !== "object") return false;

  const theme = value as Record<string, unknown>;

  return (
    typeof theme.primaryColor === "string" &&
    theme.primaryColor.length > 0 &&
    (theme.secondaryColor === undefined ||
      typeof theme.secondaryColor === "string") &&
    (theme.fontFamily === undefined || typeof theme.fontFamily === "string") &&
    (theme.backgroundUrl === undefined ||
      typeof theme.backgroundUrl === "string")
  );
}

/**
 * Type guard to check if an object is a valid DeckDefinition.
 */
export function isDeckDefinition(value: unknown): value is DeckDefinition {
  if (!value || typeof value !== "object") return false;

  const deck = value as Record<string, unknown>;

  // Check required fields
  if (typeof deck.id !== "string" || deck.id.length === 0) return false;
  if (typeof deck.name !== "string" || deck.name.length === 0) return false;
  if (typeof deck.language !== "string" || deck.language.length === 0)
    return false;

  // Check items array
  if (!Array.isArray(deck.items) || deck.items.length === 0) return false;

  // Validate each item
  for (const item of deck.items) {
    if (!isItemDefinition(item)) return false;
  }

  // Check for duplicate IDs
  const ids = new Set<string>();
  for (const item of deck.items as ItemDefinition[]) {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
  }

  // Validate optional theme
  if (deck.theme !== undefined && !isDeckTheme(deck.theme)) return false;

  return true;
}

/**
 * Type guard to check if a string is a valid GameStatus.
 */
export function isGameStatus(value: unknown): value is GameStatus {
  return (
    value === "waiting" ||
    value === "ready" ||
    value === "playing" ||
    value === "paused" ||
    value === "finished"
  );
}

/**
 * Type guard to check if a string is a valid ISO 639-1 language code.
 * Common codes used in Tabula: es (Spanish), en (English), pt (Portuguese)
 */
export function isValidLanguageCode(value: string): boolean {
  // ISO 639-1 is always 2 lowercase letters
  return /^[a-z]{2}$/.test(value);
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a new ConnectionState with default values.
 */
export function createConnectionState(
  overrides?: Partial<ConnectionState>
): ConnectionState {
  return {
    hostConnected: false,
    controllerConnected: false,
    controllerId: null,
    lastPing: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a new HostUIState with default values.
 */
export function createHostUIState(
  overrides?: Partial<HostUIState>
): HostUIState {
  return {
    ...INITIAL_HOST_UI_STATE,
    ...overrides,
  };
}

