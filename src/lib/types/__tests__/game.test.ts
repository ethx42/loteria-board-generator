/**
 * Unit Tests: Game Types
 *
 * Tests for type guards, factory functions, and validation logic
 * defined in lib/types/game.ts
 *
 * @see SRD §3.1-3.3 Data Models
 */

import { describe, it, expect } from "vitest";
import {
  isItemDefinition,
  isDeckTheme,
  isDeckDefinition,
  isGameStatus,
  isValidLanguageCode,
  createConnectionState,
  createHostUIState,
  INITIAL_HOST_UI_STATE,
  type ItemDefinition,
  type DeckDefinition,
  type DeckTheme,
  type GameStatus,
} from "../game";

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
  longText: "Extended text about the moon and its cultural significance.",
  category: "Naturaleza",
  themeColor: "#C0C0C0",
};

const validTheme: DeckTheme = {
  primaryColor: "#8B4513",
  secondaryColor: "#D4A574",
  fontFamily: "Recoleta, serif",
  backgroundUrl: "/backgrounds/vintage.jpg",
};

const minimalTheme: DeckTheme = {
  primaryColor: "#000000",
};

const validDeck: DeckDefinition = {
  id: "demo-deck",
  name: "Demo Tabula",
  language: "es",
  items: [validItem, validItemWithOptionals],
  description: "A demo deck for testing",
  theme: validTheme,
};

const minimalDeck: DeckDefinition = {
  id: "minimal",
  name: "Minimal Deck",
  language: "en",
  items: [validItem],
};

// ============================================================================
// ItemDefinition Tests
// ============================================================================

describe("isItemDefinition", () => {
  describe("valid items", () => {
    it("should return true for item with required fields only", () => {
      expect(isItemDefinition(validItem)).toBe(true);
    });

    it("should return true for item with all optional fields", () => {
      expect(isItemDefinition(validItemWithOptionals)).toBe(true);
    });

    it("should return true for item with some optional fields", () => {
      const item = {
        ...validItem,
        category: "Test Category",
      };
      expect(isItemDefinition(item)).toBe(true);
    });
  });

  describe("invalid items - missing required fields", () => {
    it("should return false when id is missing", () => {
      const item = { ...validItem };
      delete (item as Record<string, unknown>).id;
      expect(isItemDefinition(item)).toBe(false);
    });

    it("should return false when name is missing", () => {
      const item = { ...validItem };
      delete (item as Record<string, unknown>).name;
      expect(isItemDefinition(item)).toBe(false);
    });

    it("should return false when imageUrl is missing", () => {
      const item = { ...validItem };
      delete (item as Record<string, unknown>).imageUrl;
      expect(isItemDefinition(item)).toBe(false);
    });

    it("should return false when shortText is missing", () => {
      const item = { ...validItem };
      delete (item as Record<string, unknown>).shortText;
      expect(isItemDefinition(item)).toBe(false);
    });
  });

  describe("invalid items - wrong types", () => {
    it("should return false when id is not a string", () => {
      expect(isItemDefinition({ ...validItem, id: 123 })).toBe(false);
    });

    it("should return false when id is empty string", () => {
      expect(isItemDefinition({ ...validItem, id: "" })).toBe(false);
    });

    it("should return false when name is not a string", () => {
      expect(isItemDefinition({ ...validItem, name: null })).toBe(false);
    });

    it("should return false when imageUrl is not a string", () => {
      expect(isItemDefinition({ ...validItem, imageUrl: {} })).toBe(false);
    });

    it("should return false when shortText is not a string", () => {
      expect(isItemDefinition({ ...validItem, shortText: 42 })).toBe(false);
    });

    it("should return false when optional longText is wrong type", () => {
      expect(isItemDefinition({ ...validItem, longText: 123 })).toBe(false);
    });

    it("should return false when optional category is wrong type", () => {
      expect(isItemDefinition({ ...validItem, category: [] })).toBe(false);
    });

    it("should return false when optional themeColor is wrong type", () => {
      expect(isItemDefinition({ ...validItem, themeColor: true })).toBe(false);
    });
  });

  describe("invalid items - edge cases", () => {
    it("should return false for null", () => {
      expect(isItemDefinition(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isItemDefinition(undefined)).toBe(false);
    });

    it("should return false for primitive values", () => {
      expect(isItemDefinition("string")).toBe(false);
      expect(isItemDefinition(123)).toBe(false);
      expect(isItemDefinition(true)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isItemDefinition([validItem])).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isItemDefinition({})).toBe(false);
    });
  });
});

// ============================================================================
// DeckTheme Tests
// ============================================================================

describe("isDeckTheme", () => {
  describe("valid themes", () => {
    it("should return true for complete theme", () => {
      expect(isDeckTheme(validTheme)).toBe(true);
    });

    it("should return true for minimal theme (primaryColor only)", () => {
      expect(isDeckTheme(minimalTheme)).toBe(true);
    });

    it("should return true for theme with some optional fields", () => {
      const theme = {
        primaryColor: "#FF0000",
        fontFamily: "Arial",
      };
      expect(isDeckTheme(theme)).toBe(true);
    });
  });

  describe("invalid themes", () => {
    it("should return false when primaryColor is missing", () => {
      expect(isDeckTheme({ secondaryColor: "#FFF" })).toBe(false);
    });

    it("should return false when primaryColor is empty", () => {
      expect(isDeckTheme({ primaryColor: "" })).toBe(false);
    });

    it("should return false when primaryColor is wrong type", () => {
      expect(isDeckTheme({ primaryColor: 123 })).toBe(false);
    });

    it("should return false for null", () => {
      expect(isDeckTheme(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDeckTheme(undefined)).toBe(false);
    });
  });
});

// ============================================================================
// DeckDefinition Tests
// ============================================================================

describe("isDeckDefinition", () => {
  describe("valid decks", () => {
    it("should return true for complete deck", () => {
      expect(isDeckDefinition(validDeck)).toBe(true);
    });

    it("should return true for minimal deck", () => {
      expect(isDeckDefinition(minimalDeck)).toBe(true);
    });

    it("should return true for deck without theme", () => {
      const deck = { ...validDeck };
      delete (deck as Record<string, unknown>).theme;
      expect(isDeckDefinition(deck)).toBe(true);
    });

    it("should return true for deck without description", () => {
      const deck = { ...validDeck };
      delete (deck as Record<string, unknown>).description;
      expect(isDeckDefinition(deck)).toBe(true);
    });
  });

  describe("invalid decks - missing required fields", () => {
    it("should return false when id is missing", () => {
      const deck = { ...validDeck };
      delete (deck as Record<string, unknown>).id;
      expect(isDeckDefinition(deck)).toBe(false);
    });

    it("should return false when name is missing", () => {
      const deck = { ...validDeck };
      delete (deck as Record<string, unknown>).name;
      expect(isDeckDefinition(deck)).toBe(false);
    });

    it("should return false when language is missing", () => {
      const deck = { ...validDeck };
      delete (deck as Record<string, unknown>).language;
      expect(isDeckDefinition(deck)).toBe(false);
    });

    it("should return false when items is missing", () => {
      const deck = { ...validDeck };
      delete (deck as Record<string, unknown>).items;
      expect(isDeckDefinition(deck)).toBe(false);
    });
  });

  describe("invalid decks - items validation", () => {
    it("should return false when items is empty array", () => {
      expect(isDeckDefinition({ ...validDeck, items: [] })).toBe(false);
    });

    it("should return false when items contains invalid item", () => {
      expect(
        isDeckDefinition({
          ...validDeck,
          items: [validItem, { id: "bad", name: "Missing fields" }],
        })
      ).toBe(false);
    });

    it("should return false when items has duplicate IDs", () => {
      const duplicateItems = [
        validItem,
        { ...validItemWithOptionals, id: validItem.id }, // Same ID!
      ];
      expect(isDeckDefinition({ ...validDeck, items: duplicateItems })).toBe(
        false
      );
    });
  });

  describe("invalid decks - theme validation", () => {
    it("should return false when theme is invalid", () => {
      expect(isDeckDefinition({ ...validDeck, theme: { color: "red" } })).toBe(
        false
      );
    });

    it("should return false when theme is wrong type", () => {
      expect(isDeckDefinition({ ...validDeck, theme: "invalid" })).toBe(false);
    });
  });

  describe("invalid decks - edge cases", () => {
    it("should return false for null", () => {
      expect(isDeckDefinition(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isDeckDefinition(undefined)).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isDeckDefinition({})).toBe(false);
    });
  });
});

// ============================================================================
// GameStatus Tests
// ============================================================================

describe("isGameStatus", () => {
  describe("valid statuses", () => {
    const validStatuses: GameStatus[] = [
      "waiting",
      "ready",
      "playing",
      "paused",
      "finished",
    ];

    it.each(validStatuses)('should return true for "%s"', (status) => {
      expect(isGameStatus(status)).toBe(true);
    });
  });

  describe("invalid statuses", () => {
    it("should return false for unknown string", () => {
      expect(isGameStatus("running")).toBe(false);
      expect(isGameStatus("stopped")).toBe(false);
      expect(isGameStatus("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isGameStatus(null)).toBe(false);
      expect(isGameStatus(undefined)).toBe(false);
      expect(isGameStatus(1)).toBe(false);
      expect(isGameStatus({})).toBe(false);
    });
  });
});

// ============================================================================
// Language Code Validation Tests
// ============================================================================

describe("isValidLanguageCode", () => {
  describe("valid codes (ISO 639-1)", () => {
    const validCodes = ["es", "en", "pt", "fr", "de", "it", "zh", "ja"];

    it.each(validCodes)('should return true for "%s"', (code) => {
      expect(isValidLanguageCode(code)).toBe(true);
    });
  });

  describe("invalid codes", () => {
    it("should return false for uppercase codes", () => {
      expect(isValidLanguageCode("ES")).toBe(false);
      expect(isValidLanguageCode("En")).toBe(false);
    });

    it("should return false for 3-letter codes (ISO 639-2)", () => {
      expect(isValidLanguageCode("spa")).toBe(false);
      expect(isValidLanguageCode("eng")).toBe(false);
    });

    it("should return false for 1-letter codes", () => {
      expect(isValidLanguageCode("e")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidLanguageCode("")).toBe(false);
    });

    it("should return false for codes with numbers", () => {
      expect(isValidLanguageCode("e1")).toBe(false);
    });

    it("should return false for codes with special characters", () => {
      expect(isValidLanguageCode("e-")).toBe(false);
      expect(isValidLanguageCode("e_")).toBe(false);
    });
  });
});

// ============================================================================
// Factory Functions Tests
// ============================================================================

describe("createConnectionState", () => {
  it("should create default connection state", () => {
    const state = createConnectionState();

    expect(state.hostConnected).toBe(false);
    expect(state.controllerConnected).toBe(false);
    expect(state.controllerId).toBeNull();
    expect(typeof state.lastPing).toBe("number");
    expect(state.lastPing).toBeGreaterThan(0);
  });

  it("should allow overriding individual properties", () => {
    const state = createConnectionState({
      hostConnected: true,
      controllerId: "ctrl-123",
    });

    expect(state.hostConnected).toBe(true);
    expect(state.controllerConnected).toBe(false); // Default
    expect(state.controllerId).toBe("ctrl-123");
  });

  it("should allow full override", () => {
    const now = Date.now();
    const state = createConnectionState({
      hostConnected: true,
      controllerConnected: true,
      controllerId: "ctrl-456",
      lastPing: now,
    });

    expect(state.hostConnected).toBe(true);
    expect(state.controllerConnected).toBe(true);
    expect(state.controllerId).toBe("ctrl-456");
    expect(state.lastPing).toBe(now);
  });
});

describe("createHostUIState", () => {
  it("should create default host UI state", () => {
    const state = createHostUIState();

    expect(state.mode).toBe("standalone");
    expect(state.isFullscreen).toBe(false);
    expect(state.controlsVisible).toBe(true);
    expect(state.controlsTemporary).toBe(false);
  });

  it("should match INITIAL_HOST_UI_STATE constant", () => {
    const state = createHostUIState();

    expect(state).toEqual(INITIAL_HOST_UI_STATE);
  });

  it("should allow overriding properties", () => {
    const state = createHostUIState({
      mode: "paired",
      isFullscreen: true,
      controlsVisible: false,
    });

    expect(state.mode).toBe("paired");
    expect(state.isFullscreen).toBe(true);
    expect(state.controlsVisible).toBe(false);
    expect(state.controlsTemporary).toBe(false); // Default
  });
});

// ============================================================================
// Type Inference Tests (compile-time verification)
// ============================================================================

describe("Type Inference", () => {
  it("should narrow types correctly with type guards", () => {
    const unknownValue: unknown = validItem;

    if (isItemDefinition(unknownValue)) {
      // TypeScript should infer ItemDefinition here
      const _id: string = unknownValue.id;
      const _name: string = unknownValue.name;
      expect(_id).toBe(validItem.id);
      expect(_name).toBe(validItem.name);
    }
  });

  it("should work with deck validation and access items", () => {
    const unknownDeck: unknown = validDeck;

    if (isDeckDefinition(unknownDeck)) {
      // TypeScript should infer DeckDefinition here
      const _itemCount: number = unknownDeck.items.length;
      const _firstItem = unknownDeck.items[0];
      expect(_itemCount).toBe(2);
      expect(_firstItem.id).toBe(validItem.id);
    }
  });
});

