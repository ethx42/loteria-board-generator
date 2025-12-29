/**
 * Unit Tests: Deck Loader & Validator
 *
 * Tests for deck validation, loading, and theme application.
 *
 * @see SRD §7.4 Deck Validator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateDeck,
  loadDeckFromJson,
  applyDeckTheme,
  clearDeckTheme,
  getItemById,
  getItemsByIds,
  createItemLookup,
  type ValidationResult,
} from "../deck-loader";
import type { DeckDefinition, ItemDefinition } from "../../types/game";

// ============================================================================
// TEST FIXTURES
// ============================================================================

const validItem: ItemDefinition = {
  id: "01",
  name: "El Sol",
  imageUrl: "/decks/demo/sol.png",
  shortText: "El sol sale para todos.",
};

const validItemWithOptionals: ItemDefinition = {
  id: "02",
  name: "La Luna",
  imageUrl: "/decks/demo/luna.png",
  shortText: "La luna ilumina la noche.",
  longText: "Extended text about the moon and its significance.",
  category: "Naturaleza",
  themeColor: "#C0C0C0",
};

const validDeck: DeckDefinition = {
  id: "test-deck",
  name: "Test Tabula",
  language: "es",
  items: [validItem, validItemWithOptionals],
  description: "A test deck",
  theme: {
    primaryColor: "#8B4513",
    secondaryColor: "#D4A574",
    fontFamily: "Georgia, serif",
  },
};

const minimalDeck = {
  id: "minimal",
  name: "Minimal Deck",
  language: "en",
  items: [
    {
      id: "01",
      name: "Card One",
      imageUrl: "/card.png",
      shortText: "Educational text.",
    },
  ],
};

// ============================================================================
// Validation Tests
// ============================================================================

describe("validateDeck", () => {
  describe("valid decks", () => {
    it("should validate a complete deck", () => {
      const result = validateDeck(validDeck);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate a minimal deck", () => {
      const result = validateDeck(minimalDeck);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate deck without theme", () => {
      const deck = { ...validDeck, theme: undefined };
      const result = validateDeck(deck);
      expect(result.valid).toBe(true);
    });

    it("should validate deck without description", () => {
      const deck = { ...validDeck, description: undefined };
      const result = validateDeck(deck);
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid decks - structure", () => {
    it("should reject null", () => {
      const result = validateDeck(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe("root");
    });

    it("should reject undefined", () => {
      const result = validateDeck(undefined);
      expect(result.valid).toBe(false);
    });

    it("should reject primitives", () => {
      expect(validateDeck("string").valid).toBe(false);
      expect(validateDeck(123).valid).toBe(false);
      expect(validateDeck(true).valid).toBe(false);
    });

    it("should reject arrays", () => {
      const result = validateDeck([validDeck]);
      expect(result.valid).toBe(false);
    });
  });

  describe("invalid decks - required fields", () => {
    it("should reject missing id", () => {
      const deck = { ...validDeck, id: undefined };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "id")).toBe(true);
    });

    it("should reject empty id", () => {
      const deck = { ...validDeck, id: "" };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
    });

    it("should reject missing name", () => {
      const deck = { ...validDeck, name: undefined };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "name")).toBe(true);
    });

    it("should reject missing language", () => {
      const deck = { ...validDeck, language: undefined };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "language")).toBe(true);
    });

    it("should reject missing items", () => {
      const deck = { ...validDeck, items: undefined };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "items")).toBe(true);
    });

    it("should reject empty items array", () => {
      const deck = { ...validDeck, items: [] };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
    });
  });

  describe("language validation", () => {
    it("should accept valid ISO 639-1 codes", () => {
      const codes = ["es", "en", "pt", "fr", "de"];
      for (const code of codes) {
        const deck = { ...validDeck, language: code };
        const result = validateDeck(deck);
        expect(result.valid).toBe(true);
      }
    });

    it("should reject uppercase language codes", () => {
      const deck = { ...validDeck, language: "ES" };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "language")).toBe(true);
    });

    it("should reject 3-letter language codes", () => {
      const deck = { ...validDeck, language: "spa" };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
    });

    it("should warn about uncommon language codes", () => {
      const deck = { ...validDeck, language: "zz" };
      const result = validateDeck(deck);
      expect(result.valid).toBe(true); // Valid format
      expect(result.warnings.some((w) => w.field === "language")).toBe(true);
    });
  });

  describe("item validation", () => {
    it("should reject items without id", () => {
      const deck = {
        ...validDeck,
        items: [{ name: "Test", imageUrl: "/test.png", shortText: "Text" }],
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes("id"))).toBe(true);
    });

    it("should reject items without name", () => {
      const deck = {
        ...validDeck,
        items: [{ id: "01", imageUrl: "/test.png", shortText: "Text" }],
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes("name"))).toBe(true);
    });

    it("should reject items without imageUrl", () => {
      const deck = {
        ...validDeck,
        items: [{ id: "01", name: "Test", shortText: "Text" }],
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes("imageUrl"))).toBe(true);
    });

    it("should reject items without shortText", () => {
      const deck = {
        ...validDeck,
        items: [{ id: "01", name: "Test", imageUrl: "/test.png" }],
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field.includes("shortText"))).toBe(true);
    });

    it("should reject duplicate item IDs", () => {
      const deck = {
        ...validDeck,
        items: [
          { ...validItem, id: "01" },
          { ...validItem, id: "01" }, // Duplicate
        ],
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("Duplicate"))).toBe(true);
    });

    it("should warn about duplicate item names", () => {
      const deck = {
        ...validDeck,
        items: [
          { ...validItem, id: "01", name: "Same Name" },
          { ...validItem, id: "02", name: "Same Name" },
        ],
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(true); // Names can be duplicated, just warning
      expect(result.warnings.some((w) => w.message.includes("duplicate name"))).toBe(true);
    });
  });

  describe("theme validation", () => {
    it("should validate complete theme", () => {
      const result = validateDeck(validDeck);
      expect(result.valid).toBe(true);
    });

    it("should validate minimal theme (primaryColor only)", () => {
      const deck = {
        ...validDeck,
        theme: { primaryColor: "#FF0000" },
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(true);
    });

    it("should reject theme without primaryColor", () => {
      const deck = {
        ...validDeck,
        theme: { secondaryColor: "#FF0000" },
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === "theme.primaryColor")).toBe(true);
    });

    it("should reject invalid color format", () => {
      const deck = {
        ...validDeck,
        theme: { primaryColor: "red" },
      };
      const result = validateDeck(deck);
      expect(result.valid).toBe(false);
    });

    it("should accept valid hex colors", () => {
      const colors = ["#FF0000", "#00ff00", "#0000FF", "#AbCdEf"];
      for (const color of colors) {
        const deck = { ...validDeck, theme: { primaryColor: color } };
        const result = validateDeck(deck);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe("error messages", () => {
    it("should provide actionable error messages", () => {
      const deck = { name: "Test" }; // Missing many fields
      const result = validateDeck(deck);

      expect(result.valid).toBe(false);
      // All errors should have suggestions
      for (const error of result.errors) {
        expect(error.message.length).toBeGreaterThan(10);
      }
    });

    it("should include item ID in item errors", () => {
      const deck = {
        ...validDeck,
        items: [
          { id: "bad-item", name: "Test", imageUrl: "/test.png" }, // Missing shortText
        ],
      };
      const result = validateDeck(deck);
      expect(result.errors.some((e) => e.itemId === "bad-item")).toBe(true);
    });
  });
});

// ============================================================================
// Loading Tests
// ============================================================================

describe("loadDeckFromJson", () => {
  it("should load valid JSON deck", async () => {
    const json = JSON.stringify(minimalDeck);
    const deck = await loadDeckFromJson(json);

    expect(deck.id).toBe("minimal");
    expect(deck.name).toBe("Minimal Deck");
    expect(deck.items).toHaveLength(1);
  });

  it("should throw on invalid JSON", async () => {
    await expect(loadDeckFromJson("not json")).rejects.toThrow("Invalid JSON");
  });

  it("should throw on invalid deck structure", async () => {
    const json = JSON.stringify({ name: "Missing fields" });
    await expect(loadDeckFromJson(json)).rejects.toThrow("Invalid deck");
  });

  it("should include error details in throw message", async () => {
    const json = JSON.stringify({ name: "Test" });
    await expect(loadDeckFromJson(json)).rejects.toThrow("id");
  });
});

// ============================================================================
// Theme Application Tests
// ============================================================================

describe("applyDeckTheme", () => {
  // Mock document for theme tests
  let originalDocument: typeof document;

  beforeEach(() => {
    // Simple mock for documentElement.style
    const styleProperties: Record<string, string> = {};

    originalDocument = globalThis.document;
    globalThis.document = {
      documentElement: {
        style: {
          setProperty: vi.fn((name: string, value: string) => {
            styleProperties[name] = value;
          }),
          removeProperty: vi.fn((name: string) => {
            delete styleProperties[name];
          }),
          getPropertyValue: vi.fn((name: string) => styleProperties[name] || ""),
        },
      },
    } as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it("should set primary color CSS variable", () => {
    applyDeckTheme({ primaryColor: "#FF0000" });

    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      "--deck-primary-color",
      "#FF0000"
    );
  });

  it("should set all theme CSS variables", () => {
    applyDeckTheme({
      primaryColor: "#FF0000",
      secondaryColor: "#00FF00",
      fontFamily: "Georgia",
      backgroundUrl: "/bg.jpg",
    });

    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      "--deck-primary-color",
      "#FF0000"
    );
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      "--deck-secondary-color",
      "#00FF00"
    );
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      "--deck-font-family",
      "Georgia"
    );
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith(
      "--deck-background-url",
      "url(/bg.jpg)"
    );
  });

  it("should remove optional properties when not provided", () => {
    applyDeckTheme({ primaryColor: "#FF0000" });

    expect(document.documentElement.style.removeProperty).toHaveBeenCalledWith(
      "--deck-secondary-color"
    );
    expect(document.documentElement.style.removeProperty).toHaveBeenCalledWith(
      "--deck-font-family"
    );
  });

  it("should clear all variables when theme is undefined", () => {
    applyDeckTheme(undefined);

    expect(document.documentElement.style.removeProperty).toHaveBeenCalled();
  });

  it("clearDeckTheme should clear all variables", () => {
    clearDeckTheme();

    expect(document.documentElement.style.removeProperty).toHaveBeenCalled();
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe("getItemById", () => {
  it("should find item by ID", () => {
    const item = getItemById(validDeck, "01");
    expect(item).toBeDefined();
    expect(item?.name).toBe("El Sol");
  });

  it("should return undefined for non-existent ID", () => {
    const item = getItemById(validDeck, "non-existent");
    expect(item).toBeUndefined();
  });
});

describe("getItemsByIds", () => {
  it("should return items in order of provided IDs", () => {
    const items = getItemsByIds(validDeck, ["02", "01"]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("02");
    expect(items[1].id).toBe("01");
  });

  it("should skip non-existent IDs", () => {
    const items = getItemsByIds(validDeck, ["01", "non-existent", "02"]);
    expect(items).toHaveLength(2);
  });

  it("should return empty array for all non-existent IDs", () => {
    const items = getItemsByIds(validDeck, ["a", "b", "c"]);
    expect(items).toHaveLength(0);
  });

  it("should handle empty IDs array", () => {
    const items = getItemsByIds(validDeck, []);
    expect(items).toHaveLength(0);
  });
});

describe("createItemLookup", () => {
  it("should create a map for fast lookup", () => {
    const lookup = createItemLookup(validDeck);

    expect(lookup.size).toBe(2);
    expect(lookup.get("01")?.name).toBe("El Sol");
    expect(lookup.get("02")?.name).toBe("La Luna");
  });

  it("should return undefined for non-existent keys", () => {
    const lookup = createItemLookup(validDeck);
    expect(lookup.get("non-existent")).toBeUndefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
  it("should validate and load a complete deck workflow", async () => {
    // First validate
    const validation = validateDeck(validDeck);
    expect(validation.valid).toBe(true);

    // Then load from JSON
    const json = JSON.stringify(validDeck);
    const loaded = await loadDeckFromJson(json);

    expect(loaded.id).toBe(validDeck.id);
    expect(loaded.items).toHaveLength(validDeck.items.length);

    // Create lookup for gameplay
    const lookup = createItemLookup(loaded);
    expect(lookup.size).toBe(loaded.items.length);
  });
});

