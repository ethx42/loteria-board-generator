/**
 * Deck Loader & Validator
 *
 * Handles loading, validation, and theme application for DeckDefinition.
 * Provides actionable error messages for invalid deck configurations.
 *
 * @module lib/game/deck-loader
 * @see SRD §7.4 Deck Validator
 * @see SRD §3.1 Core Types
 */

import type { DeckDefinition, DeckTheme, ItemDefinition } from "../types/game";

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * A single validation error with actionable information.
 */
export interface ValidationError {
  /** Field or path that failed validation */
  field: string;
  /** Human-readable error message with fix suggestion */
  message: string;
  /** Item ID if error is related to a specific item */
  itemId?: string;
}

/**
 * Result of deck validation.
 */
export interface ValidationResult {
  /** Whether the deck is valid */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
  /** Warnings that don't prevent loading but should be addressed */
  warnings: ValidationError[];
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/** Minimum number of items required in a deck */
const MIN_ITEMS = 1;

/** Maximum number of items supported */
const MAX_ITEMS = 100;

/** Maximum length for item names */
const MAX_NAME_LENGTH = 100;

/** Maximum length for shortText */
const MAX_SHORT_TEXT_LENGTH = 500;

/** Maximum length for longText */
const MAX_LONG_TEXT_LENGTH = 2000;

/** Valid ISO 639-1 language codes (common ones) */
const COMMON_LANGUAGE_CODES = new Set([
  "es", "en", "pt", "fr", "de", "it", "ja", "zh", "ko", "ru",
  "ar", "hi", "bn", "pa", "mr", "te", "ta", "vi", "th", "nl",
]);

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a DeckDefinition and returns detailed error information.
 *
 * @example
 * ```ts
 * const result = validateDeck(unknownData);
 * if (!result.valid) {
 *   console.error("Validation errors:", result.errors);
 * }
 * ```
 *
 * @see SRD §7.4 Deck Validator
 */
export function validateDeck(deck: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check basic structure
  if (!deck || typeof deck !== "object") {
    return {
      valid: false,
      errors: [
        {
          field: "root",
          message: "Deck must be a valid JSON object. Check that the file is valid JSON.",
        },
      ],
      warnings: [],
    };
  }

  const d = deck as Record<string, unknown>;

  // Validate required fields
  validateRequiredField(d, "id", "string", errors, "Deck ID is required. Add an 'id' field with a unique identifier.");
  validateRequiredField(d, "name", "string", errors, "Deck name is required. Add a 'name' field with a display name.");
  validateRequiredField(d, "language", "string", errors, "Language code is required. Add a 'language' field (e.g., 'es' for Spanish).");

  // Validate language code format
  if (typeof d.language === "string") {
    if (!/^[a-z]{2}$/.test(d.language)) {
      errors.push({
        field: "language",
        message: `Invalid language code "${d.language}". Use ISO 639-1 format (2 lowercase letters, e.g., "es", "en").`,
      });
    } else if (!COMMON_LANGUAGE_CODES.has(d.language)) {
      warnings.push({
        field: "language",
        message: `Language code "${d.language}" is uncommon. Common codes: es, en, pt, fr, de.`,
      });
    }
  }

  // Validate items array
  if (!Array.isArray(d.items)) {
    errors.push({
      field: "items",
      message: "Deck must have an 'items' array containing the card definitions.",
    });
    return { valid: false, errors, warnings };
  }

  if (d.items.length === 0) {
    errors.push({
      field: "items",
      message: "Deck must have at least one item. Add items to the 'items' array.",
    });
    return { valid: false, errors, warnings };
  }

  if (d.items.length > MAX_ITEMS) {
    errors.push({
      field: "items",
      message: `Deck has ${d.items.length} items, maximum is ${MAX_ITEMS}. Remove some items.`,
    });
  }

  // Validate each item and check for duplicates
  const itemIds = new Set<string>();
  const itemNames = new Set<string>();

  for (let i = 0; i < d.items.length; i++) {
    validateItem(d.items[i], i, itemIds, itemNames, errors, warnings);
  }

  // Validate optional theme
  if (d.theme !== undefined) {
    validateTheme(d.theme, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a required field exists and has correct type.
 */
function validateRequiredField(
  obj: Record<string, unknown>,
  field: string,
  type: "string" | "number" | "boolean",
  errors: ValidationError[],
  message: string
): void {
  if (obj[field] === undefined || obj[field] === null) {
    errors.push({ field, message });
  } else if (typeof obj[field] !== type) {
    errors.push({
      field,
      message: `Field '${field}' must be a ${type}, got ${typeof obj[field]}.`,
    });
  } else if (type === "string" && (obj[field] as string).trim() === "") {
    errors.push({
      field,
      message: `Field '${field}' cannot be empty.`,
    });
  }
}

/**
 * Validates a single item in the deck.
 */
function validateItem(
  item: unknown,
  index: number,
  itemIds: Set<string>,
  itemNames: Set<string>,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const prefix = `items[${index}]`;

  if (!item || typeof item !== "object") {
    errors.push({
      field: prefix,
      message: `Item at index ${index} must be an object.`,
    });
    return;
  }

  const it = item as Record<string, unknown>;

  // Validate id
  if (typeof it.id !== "string" || it.id.trim() === "") {
    errors.push({
      field: `${prefix}.id`,
      message: `Item at index ${index} must have a non-empty 'id' field.`,
    });
  } else {
    if (itemIds.has(it.id)) {
      errors.push({
        field: `${prefix}.id`,
        message: `Duplicate item ID "${it.id}". Each item must have a unique ID.`,
        itemId: it.id,
      });
    }
    itemIds.add(it.id);
  }

  const itemId = typeof it.id === "string" ? it.id : `index-${index}`;

  // Validate name
  if (typeof it.name !== "string" || it.name.trim() === "") {
    errors.push({
      field: `${prefix}.name`,
      message: `Item "${itemId}" must have a non-empty 'name' field.`,
      itemId,
    });
  } else {
    if (it.name.length > MAX_NAME_LENGTH) {
      errors.push({
        field: `${prefix}.name`,
        message: `Item "${itemId}" name is too long (${it.name.length} chars). Maximum is ${MAX_NAME_LENGTH}.`,
        itemId,
      });
    }
    if (itemNames.has(it.name.toLowerCase())) {
      warnings.push({
        field: `${prefix}.name`,
        message: `Item "${itemId}" has duplicate name "${it.name}". Consider using unique names.`,
        itemId,
      });
    }
    itemNames.add((it.name as string).toLowerCase());
  }

  // Validate imageUrl
  if (typeof it.imageUrl !== "string" || it.imageUrl.trim() === "") {
    errors.push({
      field: `${prefix}.imageUrl`,
      message: `Item "${itemId}" must have an 'imageUrl' field pointing to the card image.`,
      itemId,
    });
  }

  // Validate shortText (required for educational content)
  if (typeof it.shortText !== "string" || it.shortText.trim() === "") {
    errors.push({
      field: `${prefix}.shortText`,
      message: `Item "${itemId}" must have a 'shortText' field with educational content.`,
      itemId,
    });
  } else if (it.shortText.length > MAX_SHORT_TEXT_LENGTH) {
    errors.push({
      field: `${prefix}.shortText`,
      message: `Item "${itemId}" shortText is too long (${it.shortText.length} chars). Maximum is ${MAX_SHORT_TEXT_LENGTH}.`,
      itemId,
    });
  }

  // Validate optional longText
  if (it.longText !== undefined) {
    if (typeof it.longText !== "string") {
      errors.push({
        field: `${prefix}.longText`,
        message: `Item "${itemId}" longText must be a string if provided.`,
        itemId,
      });
    } else if (it.longText.length > MAX_LONG_TEXT_LENGTH) {
      errors.push({
        field: `${prefix}.longText`,
        message: `Item "${itemId}" longText is too long (${it.longText.length} chars). Maximum is ${MAX_LONG_TEXT_LENGTH}.`,
        itemId,
      });
    }
  }

  // Validate optional category
  if (it.category !== undefined && typeof it.category !== "string") {
    errors.push({
      field: `${prefix}.category`,
      message: `Item "${itemId}" category must be a string if provided.`,
      itemId,
    });
  }

  // Validate optional themeColor
  if (it.themeColor !== undefined) {
    if (typeof it.themeColor !== "string") {
      errors.push({
        field: `${prefix}.themeColor`,
        message: `Item "${itemId}" themeColor must be a string if provided.`,
        itemId,
      });
    } else if (!/^#[0-9A-Fa-f]{6}$/.test(it.themeColor)) {
      warnings.push({
        field: `${prefix}.themeColor`,
        message: `Item "${itemId}" themeColor "${it.themeColor}" should be a hex color (e.g., "#FF5500").`,
        itemId,
      });
    }
  }
}

/**
 * Validates deck theme configuration.
 */
function validateTheme(theme: unknown, errors: ValidationError[]): void {
  if (typeof theme !== "object" || theme === null) {
    errors.push({
      field: "theme",
      message: "Theme must be an object if provided.",
    });
    return;
  }

  const t = theme as Record<string, unknown>;

  // primaryColor is required if theme is provided
  if (typeof t.primaryColor !== "string" || t.primaryColor.trim() === "") {
    errors.push({
      field: "theme.primaryColor",
      message: "Theme must have a 'primaryColor' field (e.g., \"#8B4513\").",
    });
  } else if (!/^#[0-9A-Fa-f]{6}$/.test(t.primaryColor)) {
    errors.push({
      field: "theme.primaryColor",
      message: `Invalid primaryColor "${t.primaryColor}". Use hex format (e.g., "#8B4513").`,
    });
  }

  // Validate optional fields
  if (t.secondaryColor !== undefined) {
    if (typeof t.secondaryColor !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(t.secondaryColor)) {
      errors.push({
        field: "theme.secondaryColor",
        message: `Invalid secondaryColor. Use hex format (e.g., "#D4A574").`,
      });
    }
  }

  if (t.fontFamily !== undefined && typeof t.fontFamily !== "string") {
    errors.push({
      field: "theme.fontFamily",
      message: "Theme fontFamily must be a string if provided.",
    });
  }

  if (t.backgroundUrl !== undefined && typeof t.backgroundUrl !== "string") {
    errors.push({
      field: "theme.backgroundUrl",
      message: "Theme backgroundUrl must be a string if provided.",
    });
  }
}

// ============================================================================
// DECK LOADING
// ============================================================================

/**
 * Loads and validates a deck from a JSON string.
 *
 * @throws Error if JSON parsing fails or validation fails
 */
export async function loadDeckFromJson(json: string): Promise<DeckDefinition> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Invalid JSON: ${e instanceof Error ? e.message : "Parse error"}. Check for syntax errors.`
    );
  }

  const result = validateDeck(parsed);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `  • ${e.field}: ${e.message}`).join("\n");
    throw new Error(`Invalid deck:\n${errorMessages}`);
  }

  return parsed as DeckDefinition;
}

/**
 * Loads the built-in demo deck.
 * The demo deck is bundled with the application.
 */
export async function loadDemoDeck(): Promise<DeckDefinition> {
  const response = await fetch("/decks/demo/manifest.json");

  if (!response.ok) {
    throw new Error(`Failed to load demo deck: ${response.status} ${response.statusText}`);
  }

  const json = await response.text();
  return loadDeckFromJson(json);
}

/**
 * Loads a deck from a File object (e.g., from file input).
 */
export async function loadDeckFromFile(file: File): Promise<DeckDefinition> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const json = reader.result as string;
        const deck = await loadDeckFromJson(json);
        resolve(deck);
      } catch (e) {
        reject(e);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file. Check that the file is accessible."));
    };

    reader.readAsText(file);
  });
}

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * CSS variable names for deck theme.
 */
const THEME_CSS_VARS = {
  primaryColor: "--deck-primary-color",
  secondaryColor: "--deck-secondary-color",
  fontFamily: "--deck-font-family",
  backgroundUrl: "--deck-background-url",
} as const;

/**
 * Applies a deck theme to the document via CSS variables.
 *
 * @see SRD FR-017
 */
export function applyDeckTheme(theme: DeckTheme | undefined): void {
  const root = document.documentElement;

  if (!theme) {
    // Clear theme variables
    Object.values(THEME_CSS_VARS).forEach((varName) => {
      root.style.removeProperty(varName);
    });
    return;
  }

  // Apply theme variables
  root.style.setProperty(THEME_CSS_VARS.primaryColor, theme.primaryColor);

  if (theme.secondaryColor) {
    root.style.setProperty(THEME_CSS_VARS.secondaryColor, theme.secondaryColor);
  } else {
    root.style.removeProperty(THEME_CSS_VARS.secondaryColor);
  }

  if (theme.fontFamily) {
    root.style.setProperty(THEME_CSS_VARS.fontFamily, theme.fontFamily);
  } else {
    root.style.removeProperty(THEME_CSS_VARS.fontFamily);
  }

  if (theme.backgroundUrl) {
    root.style.setProperty(THEME_CSS_VARS.backgroundUrl, `url(${theme.backgroundUrl})`);
  } else {
    root.style.removeProperty(THEME_CSS_VARS.backgroundUrl);
  }
}

/**
 * Clears any applied deck theme.
 */
export function clearDeckTheme(): void {
  applyDeckTheme(undefined);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets an item from a deck by ID.
 */
export function getItemById(
  deck: DeckDefinition,
  itemId: string
): ItemDefinition | undefined {
  return deck.items.find((item) => item.id === itemId);
}

/**
 * Gets multiple items from a deck by their IDs.
 * Returns items in the order of the provided IDs.
 */
export function getItemsByIds(
  deck: DeckDefinition,
  itemIds: readonly string[]
): ItemDefinition[] {
  const itemMap = new Map(deck.items.map((item) => [item.id, item]));
  return itemIds
    .map((id) => itemMap.get(id))
    .filter((item): item is ItemDefinition => item !== undefined);
}

/**
 * Creates a lookup map for fast item access by ID.
 */
export function createItemLookup(
  deck: DeckDefinition
): Map<string, ItemDefinition> {
  return new Map(deck.items.map((item) => [item.id, item]));
}

