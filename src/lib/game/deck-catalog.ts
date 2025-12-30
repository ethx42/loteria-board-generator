/**
 * Deck Catalog
 *
 * Manages loading and querying the deck catalog from R2 storage.
 * The catalog is a JSON file listing all available decks with metadata.
 *
 * Features:
 * - Automatic caching with localStorage (1 hour TTL)
 * - Retry logic for network failures
 * - Catalog structure validation
 * - Graceful fallback to demo deck
 *
 * @module lib/game/deck-catalog
 * @see ENTERPRISE_IMPLEMENTATION_PLAN.md
 */

import { loadDeckFromJson } from "./deck-loader";
import { isR2Configured } from "../storage/r2-client";
import type { DeckDefinition } from "../types/game";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Entry in the deck catalog.
 * Contains metadata about a deck without loading the full deck definition.
 */
export interface DeckCatalogEntry {
  /** Unique deck identifier */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /** Description of the deck */
  readonly description: string;

  /** Language code (ISO 639-1) */
  readonly language: string;

  /** Number of items in the deck */
  readonly itemCount: number;

  /** Category (e.g., "Ciudades", "Gastronomía") */
  readonly category?: string;

  /** Region (e.g., "Caribe", "Andina") */
  readonly region?: string;

  /** URL to thumbnail image */
  readonly thumbnailUrl?: string;

  /** URL to the deck manifest.json */
  readonly manifestUrl: string;

  /** Creation date (ISO 8601) */
  readonly createdAt: string;

  /** Tags for filtering/searching */
  readonly tags?: readonly string[];
}

/**
 * Complete deck catalog structure.
 */
export interface DeckCatalog {
  /** Catalog format version */
  readonly version: string;

  /** Last update timestamp (ISO 8601) */
  readonly lastUpdated: string;

  /** List of available decks */
  readonly decks: readonly DeckCatalogEntry[];
}

/**
 * Result type for catalog operations that may fail.
 */
export type CatalogResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Cache key for localStorage.
 */
const CACHE_KEY = "tabula:deck-catalog";

/**
 * Cache TTL in milliseconds (1 hour).
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Maximum number of retry attempts for network requests.
 */
const MAX_RETRIES = 3;

/**
 * Delay between retries in milliseconds.
 */
const RETRY_DELAY_MS = 1000;

/**
 * Gets the catalog URL based on environment configuration.
 * Priority:
 * 1. NEXT_PUBLIC_DECK_CATALOG_URL (explicit override)
 * 2. /api/catalog (API route that proxies R2, avoids CORS)
 * 3. /catalog.json (local fallback if R2 not configured)
 */
function getCatalogUrl(): string {
  // Explicit catalog URL override
  if (process.env.NEXT_PUBLIC_DECK_CATALOG_URL) {
    return process.env.NEXT_PUBLIC_DECK_CATALOG_URL;
  }

  // Use API route to proxy R2 (avoids CORS issues)
  // The API route will fetch from R2 server-side
  if (isR2Configured()) {
    return "/api/catalog";
  }

  // Fallback to local path
  return "/catalog.json";
}

/**
 * Cached catalog URL (computed once).
 */
const CATALOG_URL = getCatalogUrl();

// ============================================================================
// CACHING UTILITIES
// ============================================================================

/**
 * Cached catalog entry with timestamp.
 */
interface CachedCatalog {
  catalog: DeckCatalog;
  timestamp: number;
}

/**
 * Loads catalog from localStorage cache if valid.
 */
function getCachedCatalog(): DeckCatalog | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedCatalog = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.catalog;
  } catch {
    // Invalid cache, remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Saves catalog to localStorage cache.
 */
function setCachedCatalog(catalog: DeckCatalog): void {
  if (typeof window === "undefined") return;

  try {
    const cached: CachedCatalog = {
      catalog,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Clears the catalog cache.
 */
export function clearCatalogCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that an object matches the DeckCatalogEntry structure.
 */
function isValidCatalogEntry(value: unknown): value is DeckCatalogEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Record<string, unknown>;

  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.name === "string" &&
    entry.name.length > 0 &&
    typeof entry.description === "string" &&
    typeof entry.language === "string" &&
    /^[a-z]{2}$/.test(entry.language) &&
    typeof entry.itemCount === "number" &&
    entry.itemCount > 0 &&
    typeof entry.manifestUrl === "string" &&
    entry.manifestUrl.length > 0 &&
    typeof entry.createdAt === "string" &&
    (entry.category === undefined || typeof entry.category === "string") &&
    (entry.region === undefined || typeof entry.region === "string") &&
    (entry.thumbnailUrl === undefined ||
      typeof entry.thumbnailUrl === "string") &&
    (entry.tags === undefined ||
      (Array.isArray(entry.tags) &&
        entry.tags.every((tag) => typeof tag === "string")))
  );
}

/**
 * Validates that an object matches the DeckCatalog structure.
 */
function isValidCatalog(value: unknown): value is DeckCatalog {
  if (!value || typeof value !== "object") return false;

  const catalog = value as Record<string, unknown>;

  return (
    typeof catalog.version === "string" &&
    typeof catalog.lastUpdated === "string" &&
    Array.isArray(catalog.decks) &&
    catalog.decks.every(isValidCatalogEntry)
  );
}

// ============================================================================
// NETWORK UTILITIES
// ============================================================================

/**
 * Fetches with retry logic.
 */
async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        // Use Next.js cache revalidation for server-side
        ...(typeof window === "undefined" && { next: { revalidate: 3600 } }),
      });

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(
          `Failed to load catalog: ${response.status} ${response.statusText}`
        );
      }

      lastError = new Error(
        `Failed to load catalog: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Network error");
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1))
      );
    }
  }

  throw lastError || new Error("Failed to load catalog after retries");
}

// ============================================================================
// CATALOG LOADING
// ============================================================================

/**
 * Loads the deck catalog from R2 or cache.
 *
 * Strategy:
 * 1. Check localStorage cache (if valid, return immediately)
 * 2. Fetch from network with retry logic
 * 3. Validate structure
 * 4. Cache result
 * 5. Return catalog
 *
 * @param options - Loading options
 * @param options.forceRefresh - Skip cache and force network fetch
 * @returns Promise resolving to the deck catalog
 * @throws Error if the catalog cannot be loaded, parsed, or validated
 *
 * @example
 * ```ts
 * const catalog = await loadDeckCatalog();
 * console.log(`Found ${catalog.decks.length} decks`);
 *
 * // Force refresh
 * const fresh = await loadDeckCatalog({ forceRefresh: true });
 * ```
 */
export async function loadDeckCatalog(options?: {
  forceRefresh?: boolean;
}): Promise<DeckCatalog> {
  // Check cache first (unless forcing refresh)
  if (!options?.forceRefresh) {
    const cached = getCachedCatalog();
    if (cached) {
      return cached;
    }
  }

  // Fetch from network
  const response = await fetchWithRetry(CATALOG_URL);
  const json = await response.text();

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `Failed to parse deck catalog: ${
        error instanceof Error ? error.message : "Parse error"
      }`
    );
  }

  // Validate structure
  if (!isValidCatalog(parsed)) {
    throw new Error(
      "Invalid catalog structure: missing required fields or invalid types"
    );
  }

  // Cache result
  setCachedCatalog(parsed);

  return parsed;
}

/**
 * Gets a deck entry by ID from the catalog.
 *
 * @param deckId - Deck identifier to find
 * @param options - Loading options
 * @returns Promise resolving to the deck entry, or null if not found
 *
 * @example
 * ```ts
 * const entry = await getDeckEntry("demo-barranquilla");
 * if (entry) {
 *   console.log(`Found deck: ${entry.name}`);
 * }
 * ```
 */
export async function getDeckEntry(
  deckId: string,
  options?: { forceRefresh?: boolean }
): Promise<DeckCatalogEntry | null> {
  if (!deckId || typeof deckId !== "string") {
    return null;
  }

  const catalog = await loadDeckCatalog(options);
  return catalog.decks.find((deck) => deck.id === deckId) || null;
}

/**
 * Loads a deck by its catalog entry.
 * Fetches the manifest.json and validates it.
 *
 * @param deckId - Deck identifier
 * @param options - Loading options
 * @returns Promise resolving to the full deck definition
 * @throws Error if deck not found or manifest invalid
 *
 * @example
 * ```ts
 * const deck = await loadDeckFromCatalog("demo-barranquilla");
 * console.log(`Loaded deck with ${deck.items.length} items`);
 * ```
 */
export async function loadDeckFromCatalog(
  deckId: string,
  options?: { forceRefresh?: boolean }
): Promise<DeckDefinition> {
  const entry = await getDeckEntry(deckId, options);

  if (!entry) {
    throw new Error(`Deck "${deckId}" not found in catalog`);
  }

  return loadDeckFromManifestUrl(entry.manifestUrl);
}

/**
 * Loads a deck from a manifest URL directly.
 * Useful for loading decks that aren't in the catalog yet.
 *
 * @param manifestUrl - URL to the manifest.json file
 * @returns Promise resolving to the deck definition
 * @throws Error if manifest cannot be loaded or is invalid
 *
 * @example
 * ```ts
 * const deck = await loadDeckFromManifestUrl("https://.../manifest.json");
 * ```
 */
export async function loadDeckFromManifestUrl(
  manifestUrl: string
): Promise<DeckDefinition> {
  if (!manifestUrl || typeof manifestUrl !== "string") {
    throw new Error("Invalid manifest URL");
  }

  let lastError: Error | null = null;

  // Retry logic for manifest loading
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(manifestUrl);

      if (!response.ok) {
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `Failed to load deck manifest: ${response.status} ${response.statusText}`
          );
        }
        lastError = new Error(
          `Failed to load deck manifest: ${response.status} ${response.statusText}`
        );
      } else {
        const json = await response.text();
        return loadDeckFromJson(json);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Network error");
    }

    // Wait before retrying
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1))
      );
    }
  }

  throw lastError || new Error("Failed to load deck manifest after retries");
}

/**
 * Filters decks by category.
 *
 * @param category - Category to filter by
 * @param options - Loading options
 * @returns Promise resolving to filtered deck entries
 *
 * @example
 * ```ts
 * const cityDecks = await getDecksByCategory("Ciudades");
 * ```
 */
export async function getDecksByCategory(
  category: string,
  options?: { forceRefresh?: boolean }
): Promise<readonly DeckCatalogEntry[]> {
  if (!category || typeof category !== "string") {
    return [];
  }

  const catalog = await loadDeckCatalog(options);
  return catalog.decks.filter((deck) => deck.category === category);
}

/**
 * Filters decks by region.
 *
 * @param region - Region to filter by
 * @param options - Loading options
 * @returns Promise resolving to filtered deck entries
 *
 * @example
 * ```ts
 * const caribbeanDecks = await getDecksByRegion("Caribe");
 * ```
 */
export async function getDecksByRegion(
  region: string,
  options?: { forceRefresh?: boolean }
): Promise<readonly DeckCatalogEntry[]> {
  if (!region || typeof region !== "string") {
    return [];
  }

  const catalog = await loadDeckCatalog(options);
  return catalog.decks.filter((deck) => deck.region === region);
}

/**
 * Searches decks by name, description, or tags.
 * Case-insensitive partial matching.
 *
 * @param query - Search query
 * @param options - Loading options
 * @returns Promise resolving to matching deck entries
 *
 * @example
 * ```ts
 * const results = await searchDecks("barranquilla");
 * ```
 */
export async function searchDecks(
  query: string,
  options?: { forceRefresh?: boolean }
): Promise<readonly DeckCatalogEntry[]> {
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return [];
  }

  const catalog = await loadDeckCatalog(options);
  const lowerQuery = query.toLowerCase().trim();

  return catalog.decks.filter(
    (deck) =>
      deck.name.toLowerCase().includes(lowerQuery) ||
      deck.description.toLowerCase().includes(lowerQuery) ||
      deck.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Gets all unique categories from the catalog.
 *
 * @param options - Loading options
 * @returns Promise resolving to array of unique category names
 */
export async function getAllCategories(options?: {
  forceRefresh?: boolean;
}): Promise<readonly string[]> {
  const catalog = await loadDeckCatalog(options);
  const categories = new Set<string>();

  for (const deck of catalog.decks) {
    if (deck.category) {
      categories.add(deck.category);
    }
  }

  return Array.from(categories).sort();
}

/**
 * Gets all unique regions from the catalog.
 *
 * @param options - Loading options
 * @returns Promise resolving to array of unique region names
 */
export async function getAllRegions(options?: {
  forceRefresh?: boolean;
}): Promise<readonly string[]> {
  const catalog = await loadDeckCatalog(options);
  const regions = new Set<string>();

  for (const deck of catalog.decks) {
    if (deck.region) {
      regions.add(deck.region);
    }
  }

  return Array.from(regions).sort();
}
