/**
 * Unit Tests: Deck Catalog
 *
 * Tests for catalog loading, caching, validation, and querying.
 *
 * @see ENTERPRISE_IMPLEMENTATION_PLAN.md
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadDeckCatalog,
  getDeckEntry,
  loadDeckFromCatalog,
  loadDeckFromManifestUrl,
  getDecksByCategory,
  getDecksByRegion,
  searchDecks,
  getAllCategories,
  getAllRegions,
  clearCatalogCache,
  type DeckCatalog,
  type DeckCatalogEntry,
} from "../deck-catalog";
import { loadDeckFromJson } from "../deck-loader";
import type { DeckDefinition } from "../../types/game";

// Mock the deck-loader module
vi.mock("../deck-loader", () => ({
  loadDeckFromJson: vi.fn(),
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockCatalogEntry: DeckCatalogEntry = {
  id: "demo-barranquilla",
  name: "Tabula de Barranquilla",
  description: "Un recorrido por la cultura, gastronomía e historia...",
  language: "es",
  itemCount: 36,
  category: "Ciudades",
  region: "Caribe",
  thumbnailUrl: "https://pub-xxxxx.r2.dev/decks/demo-barranquilla/thumbnail.png",
  manifestUrl: "https://pub-xxxxx.r2.dev/decks/demo-barranquilla/manifest.json",
  createdAt: "2024-01-01T00:00:00Z",
  tags: ["barranquilla", "caribe", "gastronomía"],
};

const mockCatalogEntry2: DeckCatalogEntry = {
  id: "bogota-centro",
  name: "Tabula de Bogotá - Centro Histórico",
  description: "Explora el centro histórico de Bogotá...",
  language: "es",
  itemCount: 36,
  category: "Ciudades",
  region: "Andina",
  thumbnailUrl: "https://pub-xxxxx.r2.dev/decks/bogota-centro/thumbnail.png",
  manifestUrl: "https://pub-xxxxx.r2.dev/decks/bogota-centro/manifest.json",
  createdAt: "2024-01-10T00:00:00Z",
  tags: ["bogotá", "centro", "historia"],
};

const mockCatalog: DeckCatalog = {
  version: "1.0",
  lastUpdated: "2024-01-15T10:30:00Z",
  decks: [mockCatalogEntry, mockCatalogEntry2],
};

const mockDeck: DeckDefinition = {
  id: "demo-barranquilla",
  name: "Tabula de Barranquilla",
  description: "Un recorrido por la cultura...",
  language: "es",
  items: [
    {
      id: "01",
      name: "Patacón",
      imageUrl: "/decks/demo-barranquilla/01.png",
      shortText: "El patacón es...",
    },
  ],
};

// ============================================================================
// MOCK SETUP
// ============================================================================

// Store original fetch and localStorage
const originalFetch = global.fetch;
const originalLocalStorage = global.localStorage;

beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  (loadDeckFromJson as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeck);

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  global.localStorage = localStorageMock as unknown as Storage;

  // Mock fetch
  global.fetch = vi.fn();
});

afterEach(() => {
  // Restore originals
  global.fetch = originalFetch;
  global.localStorage = originalLocalStorage;
  vi.restoreAllMocks();
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mockFetchSuccess(data: unknown): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify(data),
    json: async () => data,
  } as Response);
}

function mockFetchError(status: number, statusText: string): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: false,
    status,
    statusText,
    text: async () => "",
  } as Response);
}

function mockFetchNetworkError(): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error("Network error")
  );
}

// ============================================================================
// TESTS: loadDeckCatalog
// ============================================================================

describe("loadDeckCatalog", () => {
  it("should load catalog from network successfully", async () => {
    mockFetchSuccess(mockCatalog);

    const result = await loadDeckCatalog();

    expect(result).toEqual(mockCatalog);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should cache catalog in localStorage", async () => {
    mockFetchSuccess(mockCatalog);

    await loadDeckCatalog();

    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "tabula:deck-catalog",
      expect.stringContaining('"version":"1.0"')
    );
  });

  it("should return cached catalog if valid", async () => {
    const cached = {
      catalog: mockCatalog,
      timestamp: Date.now() - 1000, // 1 second ago
    };
    (global.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(cached)
    );

    const result = await loadDeckCatalog();

    expect(result).toEqual(mockCatalog);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should ignore expired cache", async () => {
    const expiredCache = {
      catalog: mockCatalog,
      timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    };
    (global.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(expiredCache)
    );
    mockFetchSuccess(mockCatalog);

    const result = await loadDeckCatalog();

    expect(result).toEqual(mockCatalog);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should force refresh when forceRefresh is true", async () => {
    const cached = {
      catalog: mockCatalog,
      timestamp: Date.now() - 1000,
    };
    (global.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(cached)
    );
    mockFetchSuccess(mockCatalog);

    await loadDeckCatalog({ forceRefresh: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should retry on network failure", async () => {
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockCatalog,
      } as Response);
    });

    const result = await loadDeckCatalog();

    expect(result).toEqual(mockCatalog);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("should throw error on invalid JSON", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "invalid json {",
    } as Response);

    await expect(loadDeckCatalog()).rejects.toThrow("Failed to parse deck catalog");
  });

  it("should throw error on invalid catalog structure", async () => {
    const invalidCatalog = {
      version: "1.0",
      // missing lastUpdated and decks
    };
    mockFetchSuccess(invalidCatalog);

    await expect(loadDeckCatalog()).rejects.toThrow("Invalid catalog structure");
  });

  it("should throw error on 4xx status without retry", async () => {
    mockFetchError(404, "Not Found");

    await expect(loadDeckCatalog()).rejects.toThrow("Failed to load catalog: 404");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// TESTS: getDeckEntry
// ============================================================================

describe("getDeckEntry", () => {
  it("should return deck entry by ID", async () => {
    mockFetchSuccess(mockCatalog);

    const entry = await getDeckEntry("demo-barranquilla");

    expect(entry).toEqual(mockCatalogEntry);
  });

  it("should return null for non-existent deck", async () => {
    mockFetchSuccess(mockCatalog);

    const entry = await getDeckEntry("non-existent");

    expect(entry).toBeNull();
  });

  it("should return null for invalid deckId", async () => {
    const entry = await getDeckEntry("");

    expect(entry).toBeNull();
  });

  it("should use cached catalog if available", async () => {
    const cached = {
      catalog: mockCatalog,
      timestamp: Date.now() - 1000,
    };
    (global.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify(cached)
    );

    const entry = await getDeckEntry("demo-barranquilla");

    expect(entry).toEqual(mockCatalogEntry);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: loadDeckFromCatalog
// ============================================================================

describe("loadDeckFromCatalog", () => {
  it("should load deck from catalog entry", async () => {
    mockFetchSuccess(mockCatalog);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockDeck),
    } as Response);

    const deck = await loadDeckFromCatalog("demo-barranquilla");

    expect(deck).toEqual(mockDeck);
    expect(loadDeckFromJson).toHaveBeenCalled();
  });

  it("should throw error if deck not found", async () => {
    mockFetchSuccess(mockCatalog);

    await expect(loadDeckFromCatalog("non-existent")).rejects.toThrow(
      'Deck "non-existent" not found in catalog'
    );
  });

  it("should retry manifest fetch on failure", async () => {
    mockFetchSuccess(mockCatalog);
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("catalog.json")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockCatalog,
        } as Response);
      }
      // Manifest fetch
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockDeck),
      } as Response);
    });

    const deck = await loadDeckFromCatalog("demo-barranquilla");

    expect(deck).toEqual(mockDeck);
  });
});

// ============================================================================
// TESTS: loadDeckFromManifestUrl
// ============================================================================

describe("loadDeckFromManifestUrl", () => {
  it("should load deck from manifest URL", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockDeck),
    } as Response);

    const deck = await loadDeckFromManifestUrl(
      "https://example.com/manifest.json"
    );

    expect(deck).toEqual(mockDeck);
    expect(loadDeckFromJson).toHaveBeenCalled();
  });

  it("should throw error on invalid URL", async () => {
    await expect(loadDeckFromManifestUrl("")).rejects.toThrow("Invalid manifest URL");
  });

  it("should retry on network failure", async () => {
    let callCount = 0;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockDeck),
      } as Response);
    });

    const deck = await loadDeckFromManifestUrl("https://example.com/manifest.json");

    expect(deck).toEqual(mockDeck);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("should not retry on 4xx errors", async () => {
    mockFetchError(404, "Not Found");

    await expect(
      loadDeckFromManifestUrl("https://example.com/manifest.json")
    ).rejects.toThrow("Failed to load deck manifest: 404");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// TESTS: getDecksByCategory
// ============================================================================

describe("getDecksByCategory", () => {
  it("should filter decks by category", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await getDecksByCategory("Ciudades");

    expect(decks).toHaveLength(2);
    expect(decks.every((d) => d.category === "Ciudades")).toBe(true);
  });

  it("should return empty array for non-existent category", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await getDecksByCategory("NonExistent");

    expect(decks).toHaveLength(0);
  });

  it("should return empty array for invalid category", async () => {
    const decks = await getDecksByCategory("");

    expect(decks).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: getDecksByRegion
// ============================================================================

describe("getDecksByRegion", () => {
  it("should filter decks by region", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await getDecksByRegion("Caribe");

    expect(decks).toHaveLength(1);
    expect(decks[0]?.region).toBe("Caribe");
  });

  it("should return empty array for non-existent region", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await getDecksByRegion("NonExistent");

    expect(decks).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: searchDecks
// ============================================================================

describe("searchDecks", () => {
  it("should search decks by name", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await searchDecks("Barranquilla");

    expect(decks).toHaveLength(1);
    expect(decks[0]?.name).toContain("Barranquilla");
  });

  it("should search decks by description", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await searchDecks("centro histórico");

    expect(decks).toHaveLength(1);
    expect(decks[0]?.id).toBe("bogota-centro");
  });

  it("should search decks by tags", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await searchDecks("gastronomía");

    expect(decks).toHaveLength(1);
    expect(decks[0]?.tags).toContain("gastronomía");
  });

  it("should be case-insensitive", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await searchDecks("BARRANQUILLA");

    expect(decks).toHaveLength(1);
  });

  it("should return empty array for no matches", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await searchDecks("nonexistent");

    expect(decks).toHaveLength(0);
  });

  it("should return empty array for empty query", async () => {
    const decks = await searchDecks("");

    expect(decks).toHaveLength(0);
  });

  it("should trim whitespace from query", async () => {
    mockFetchSuccess(mockCatalog);

    const decks = await searchDecks("  Barranquilla  ");

    expect(decks).toHaveLength(1);
  });
});

// ============================================================================
// TESTS: getAllCategories
// ============================================================================

describe("getAllCategories", () => {
  it("should return all unique categories", async () => {
    mockFetchSuccess(mockCatalog);

    const categories = await getAllCategories();

    expect(categories).toEqual(["Ciudades"]);
  });

  it("should return sorted categories", async () => {
    const catalogWithMultipleCategories: DeckCatalog = {
      ...mockCatalog,
      decks: [
        ...mockCatalog.decks,
        {
          ...mockCatalogEntry,
          id: "test-3",
          category: "Gastronomía",
        },
      ],
    };
    mockFetchSuccess(catalogWithMultipleCategories);

    const categories = await getAllCategories();

    expect(categories).toEqual(["Ciudades", "Gastronomía"]);
  });

  it("should exclude decks without category", async () => {
    const catalogWithoutCategory: DeckCatalog = {
      ...mockCatalog,
      decks: [
        {
          ...mockCatalogEntry,
          category: undefined,
        },
      ],
    };
    mockFetchSuccess(catalogWithoutCategory);

    const categories = await getAllCategories();

    expect(categories).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: getAllRegions
// ============================================================================

describe("getAllRegions", () => {
  it("should return all unique regions", async () => {
    mockFetchSuccess(mockCatalog);

    const regions = await getAllRegions();

    expect(regions).toEqual(["Andina", "Caribe"]);
  });

  it("should return sorted regions", async () => {
    const regions = await getAllRegions();

    expect(regions).toEqual(["Andina", "Caribe"]);
  });
});

// ============================================================================
// TESTS: clearCatalogCache
// ============================================================================

describe("clearCatalogCache", () => {
  it("should remove cache from localStorage", () => {
    clearCatalogCache();

    expect(global.localStorage.removeItem).toHaveBeenCalledWith("tabula:deck-catalog");
  });

  it("should not throw in SSR environment", () => {
    // @ts-expect-error - Testing SSR environment
    global.window = undefined;

    expect(() => clearCatalogCache()).not.toThrow();
  });
});

