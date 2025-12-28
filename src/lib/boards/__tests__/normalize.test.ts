/**
 * Board Normalization Tests
 *
 * Tests for board data normalization utilities.
 *
 * @module lib/boards/__tests__/normalize.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  extractItemId,
  extractItemName,
  normalizeBoardSize,
  inferBoardSizeFromGrid,
  inferBoardSizeFromItemCount,
  normalizeBoard,
  normalizeBoards,
  normalizeItemId,
} from "../normalize";
import type { BoardSize } from "../../types/boards";

// ============================================================================
// extractItemId
// ============================================================================

describe("extractItemId", () => {
  it("extracts ID from formatted string with number prefix", () => {
    expect(extractItemId("03 BOLLO DE MAÍZ")).toBe("03");
    expect(extractItemId("15 TOTUMA Y CUCHARA DE PALO")).toBe("15");
    expect(extractItemId("01 Patacón")).toBe("01");
  });

  it("returns ID as-is when already a 2-digit number", () => {
    expect(extractItemId("03")).toBe("03");
    expect(extractItemId("15")).toBe("15");
    expect(extractItemId("99")).toBe("99");
  });

  it("handles names without ID prefix by uppercasing", () => {
    expect(extractItemId("BOLLO DE MAÍZ")).toBe("BOLLO DE MAÍZ");
    expect(extractItemId("patacón")).toBe("PATACÓN");
  });

  it("handles edge cases", () => {
    expect(extractItemId("")).toBe("");
    expect(extractItemId("  ")).toBe("");
    expect(extractItemId("1 Item")).toBe("1 ITEM"); // Not 2-digit, passthrough
    expect(extractItemId("123 Item")).toBe("123 ITEM"); // Not 2-digit, passthrough
  });
});

// ============================================================================
// extractItemName
// ============================================================================

describe("extractItemName", () => {
  it("extracts name from formatted string", () => {
    expect(extractItemName("03 BOLLO DE MAÍZ")).toBe("BOLLO DE MAÍZ");
    expect(extractItemName("15 TOTUMA Y CUCHARA DE PALO")).toBe(
      "TOTUMA Y CUCHARA DE PALO"
    );
  });

  it("returns original when no ID prefix", () => {
    expect(extractItemName("BOLLO DE MAÍZ")).toBe("BOLLO DE MAÍZ");
    expect(extractItemName("patacón")).toBe("patacón");
  });

  it("trims whitespace", () => {
    expect(extractItemName("  BOLLO  ")).toBe("BOLLO");
    expect(extractItemName("03   BOLLO  ")).toBe("BOLLO");
  });
});

// ============================================================================
// normalizeBoardSize
// ============================================================================

describe("normalizeBoardSize", () => {
  it("normalizes valid board sizes", () => {
    expect(normalizeBoardSize("4x4")).toBe("4x4");
    expect(normalizeBoardSize("3x3")).toBe("3x3");
    expect(normalizeBoardSize("5x5")).toBe("5x5");
    expect(normalizeBoardSize("6x6")).toBe("6x6");
  });

  it("handles asymmetric dimensions", () => {
    expect(normalizeBoardSize("3x4")).toBe("3x4");
    expect(normalizeBoardSize("4x7")).toBe("4x7");
    expect(normalizeBoardSize("5x3")).toBe("5x3");
    expect(normalizeBoardSize("10x8")).toBe("10x8");
  });

  it("handles uppercase 'X'", () => {
    expect(normalizeBoardSize("4X4")).toBe("4x4");
    expect(normalizeBoardSize("5X5")).toBe("5x5");
    expect(normalizeBoardSize("3X5")).toBe("3x5");
  });

  it("handles spaces", () => {
    expect(normalizeBoardSize("4 x 4")).toBe("4x4");
    expect(normalizeBoardSize("4  x  4")).toBe("4x4");
    expect(normalizeBoardSize("3 x 5")).toBe("3x5");
  });

  it("handles multiplication sign", () => {
    expect(normalizeBoardSize("4×4")).toBe("4x4");
    expect(normalizeBoardSize("3×5")).toBe("3x5");
  });

  it("returns null for invalid format", () => {
    expect(normalizeBoardSize("abc")).toBeNull();
    expect(normalizeBoardSize("")).toBeNull();
    expect(normalizeBoardSize("4")).toBeNull();
    expect(normalizeBoardSize("x4")).toBeNull();
    expect(normalizeBoardSize("4x")).toBeNull();
    expect(normalizeBoardSize("0x4")).toBeNull(); // 0 rows invalid
    expect(normalizeBoardSize("4x0")).toBeNull(); // 0 cols invalid
  });
});

// ============================================================================
// inferBoardSizeFromGrid / inferBoardSizeFromItemCount
// ============================================================================

describe("inferBoardSizeFromGrid", () => {
  it("infers size from 2D grid", () => {
    const grid3x3 = [
      ["a", "b", "c"],
      ["d", "e", "f"],
      ["g", "h", "i"],
    ];
    expect(inferBoardSizeFromGrid(grid3x3)).toBe("3x3");

    const grid4x4 = [
      ["a", "b", "c", "d"],
      ["e", "f", "g", "h"],
      ["i", "j", "k", "l"],
      ["m", "n", "o", "p"],
    ];
    expect(inferBoardSizeFromGrid(grid4x4)).toBe("4x4");
  });

  it("infers asymmetric sizes from 2D grid", () => {
    const grid3x4 = [
      ["a", "b", "c", "d"],
      ["e", "f", "g", "h"],
      ["i", "j", "k", "l"],
    ];
    expect(inferBoardSizeFromGrid(grid3x4)).toBe("3x4");

    const grid4x7 = [
      ["a", "b", "c", "d", "e", "f", "g"],
      ["h", "i", "j", "k", "l", "m", "n"],
      ["o", "p", "q", "r", "s", "t", "u"],
      ["v", "w", "x", "y", "z", "1", "2"],
    ];
    expect(inferBoardSizeFromGrid(grid4x7)).toBe("4x7");
  });

  it("returns null for invalid grids", () => {
    expect(inferBoardSizeFromGrid([])).toBeNull();
    expect(inferBoardSizeFromGrid([[]])).toBeNull();
  });
});

describe("inferBoardSizeFromItemCount", () => {
  it("infers common square sizes", () => {
    expect(inferBoardSizeFromItemCount(9)).toBe("3x3");
    expect(inferBoardSizeFromItemCount(16)).toBe("4x4");
    expect(inferBoardSizeFromItemCount(25)).toBe("5x5");
  });

  it("infers perfect squares not in presets", () => {
    expect(inferBoardSizeFromItemCount(36)).toBe("6x6");
    expect(inferBoardSizeFromItemCount(49)).toBe("7x7");
    expect(inferBoardSizeFromItemCount(64)).toBe("8x8");
  });

  it("returns null for ambiguous non-square counts", () => {
    // 12 could be 3x4, 4x3, 2x6, 6x2, 1x12, 12x1 - ambiguous
    expect(inferBoardSizeFromItemCount(12)).toBeNull();
    expect(inferBoardSizeFromItemCount(10)).toBeNull();
    expect(inferBoardSizeFromItemCount(15)).toBeNull();
  });
});

// ============================================================================
// normalizeBoard
// ============================================================================

describe("normalizeBoard", () => {
  it("normalizes board with all fields present", () => {
    const raw = {
      id: "board-5",
      number: 5,
      items: ["01", "03", "05", "08"],
      grid: [
        ["01", "03"],
        ["05", "08"],
      ],
    };

    const result = normalizeBoard(raw, 4);

    expect(result).toEqual({
      id: "board-5",
      number: 5,
      items: ["01", "03", "05", "08"],
      grid: [
        ["01", "03"],
        ["05", "08"],
      ],
    });
  });

  it("generates ID and number when missing", () => {
    const raw = {
      items: ["01", "02", "03", "04"],
    };

    const result = normalizeBoard(raw, 2);

    expect(result?.id).toBe("board-3"); // index 2 + 1
    expect(result?.number).toBe(3);
  });

  it("extracts IDs from formatted strings", () => {
    const raw = {
      items: ["03 BOLLO DE MAÍZ", "08 MOJARRA FRITA"],
      grid: [["03 BOLLO DE MAÍZ", "08 MOJARRA FRITA"]],
    };

    const result = normalizeBoard(raw, 0);

    expect(result?.items).toEqual(["03", "08"]);
    expect(result?.grid).toEqual([["03", "08"]]);
  });

  it("builds grid from items when grid is missing", () => {
    const raw = {
      items: ["01", "02", "03", "04", "05", "06", "07", "08", "09"],
    };

    const result = normalizeBoard(raw, 0);

    expect(result?.grid).toEqual([
      ["01", "02", "03"],
      ["04", "05", "06"],
      ["07", "08", "09"],
    ]);
  });

  it("supports GameGeneratedBoard format with itemIds", () => {
    const raw = {
      id: "board-1",
      boardNumber: 1,
      itemIds: ["01", "02", "03", "04"],
    };

    const result = normalizeBoard(raw, 0);

    expect(result?.number).toBe(1);
    expect(result?.items).toEqual(["01", "02", "03", "04"]);
  });

  it("returns null for invalid input", () => {
    expect(normalizeBoard(null, 0)).toBeNull();
    expect(normalizeBoard(undefined, 0)).toBeNull();
    expect(normalizeBoard("string", 0)).toBeNull();
    expect(normalizeBoard({ items: [] }, 0)).toBeNull();
  });

  it("respects extractIds option", () => {
    const raw = {
      items: ["03 BOLLO DE MAÍZ"],
    };

    const withExtract = normalizeBoard(raw, 0, { extractIds: true });
    expect(withExtract?.items).toEqual(["03"]);

    const withoutExtract = normalizeBoard(raw, 0, { extractIds: false });
    expect(withoutExtract?.items).toEqual(["03 BOLLO DE MAÍZ"]);
  });
});

// ============================================================================
// normalizeBoards (manifest)
// ============================================================================

describe("normalizeBoards", () => {
  it("normalizes generator format manifest", () => {
    const raw = {
      game: "tabula-barranquilla",
      totalBoards: 2,
      boardSize: "4x4",
      generatedAt: "2024-12-28T10:00:00Z",
      algorithm: "highs",
      stats: {
        maxOverlap: 3,
        avgOverlap: 1.5,
        solver: "highs",
        generationTimeMs: 150,
      },
      boards: [
        {
          id: "board-1",
          number: 1,
          items: Array(16).fill("01"),
          grid: [
            ["01", "01", "01", "01"],
            ["01", "01", "01", "01"],
            ["01", "01", "01", "01"],
            ["01", "01", "01", "01"],
          ],
        },
        {
          id: "board-2",
          number: 2,
          items: Array(16).fill("02"),
          grid: [
            ["02", "02", "02", "02"],
            ["02", "02", "02", "02"],
            ["02", "02", "02", "02"],
            ["02", "02", "02", "02"],
          ],
        },
      ],
    };

    const result = normalizeBoards(raw);

    expect(result.game).toBe("tabula-barranquilla");
    expect(result.totalBoards).toBe(2);
    expect(result.boardSize).toBe("4x4");
    expect(result.algorithm).toBe("highs");
    expect(result.generatedAt).toBe("2024-12-28T10:00:00Z");
    expect(result.stats?.maxOverlap).toBe(3);
    expect(result.boards.length).toBe(2);
  });

  it("infers board size from first board grid when not specified", () => {
    const raw = {
      game: "inferred-size",
      boards: [
        {
          items: ["01", "02", "03", "04", "05", "06", "07", "08", "09"],
          grid: [
            ["01", "02", "03"],
            ["04", "05", "06"],
            ["07", "08", "09"],
          ],
        },
      ],
    };

    const result = normalizeBoards(raw);

    expect(result.boardSize).toBe("3x3");
  });

  it("throws error for missing game field", () => {
    const raw = {
      boards: [{ items: ["01"] }],
    };

    expect(() => normalizeBoards(raw)).toThrow("missing game field");
  });

  it("throws error for missing boards array", () => {
    const raw = {
      game: "test",
    };

    expect(() => normalizeBoards(raw)).toThrow("missing or empty boards array");
  });

  it("throws error for empty boards array", () => {
    const raw = {
      game: "test",
      boards: [],
    };

    expect(() => normalizeBoards(raw)).toThrow("missing or empty boards array");
  });

  it("throws error for null input", () => {
    expect(() => normalizeBoards(null)).toThrow("expected an object");
  });

  it("filters out invalid boards", () => {
    const raw = {
      game: "test",
      boards: [
        { items: ["01", "02", "03", "04"] }, // Valid
        null, // Invalid
        { items: [] }, // Invalid (empty)
        { items: ["05", "06", "07", "08"] }, // Valid
      ],
    };

    const result = normalizeBoards(raw);

    expect(result.boards.length).toBe(2);
    expect(result.boards[0].items).toEqual(["01", "02", "03", "04"]);
    expect(result.boards[1].items).toEqual(["05", "06", "07", "08"]);
  });

  it("throws error when all boards are invalid", () => {
    const raw = {
      game: "test",
      boards: [null, { items: [] }, "invalid"],
    };

    expect(() => normalizeBoards(raw)).toThrow("no valid boards found");
  });

  it("defaults totalBoards to boards array length", () => {
    const raw = {
      game: "test",
      boards: [
        { items: ["01", "02", "03", "04"] },
        { items: ["05", "06", "07", "08"] },
        { items: ["09", "10", "11", "12"] },
      ],
    };

    const result = normalizeBoards(raw);

    expect(result.totalBoards).toBe(3);
  });
});

// ============================================================================
// normalizeItemId
// ============================================================================

describe("normalizeItemId", () => {
  it("extracts numeric ID from formatted string", () => {
    expect(normalizeItemId("03 BOLLO DE MAÍZ")).toBe("03");
    expect(normalizeItemId("15 TOTUMA")).toBe("15");
  });

  it("passes through 2-digit IDs", () => {
    expect(normalizeItemId("03")).toBe("03");
    expect(normalizeItemId("99")).toBe("99");
  });

  it("uppercases names without IDs", () => {
    expect(normalizeItemId("BOLLO DE MAÍZ")).toBe("BOLLO DE MAÍZ");
    expect(normalizeItemId("bollo")).toBe("BOLLO");
  });

  it("trims whitespace", () => {
    expect(normalizeItemId("  03  ")).toBe("03");
    expect(normalizeItemId("  BOLLO  ")).toBe("BOLLO");
  });
});

// ============================================================================
// TYPE GUARDS (from types/boards.ts)
// ============================================================================

import {
  isBoardSize,
  formatBoardSize,
  parseBoardSize,
  getBoardSlots,
  validateBoardDimensions,
  isBoardGenerationStats,
  isBoardDefinition,
  isBoardsManifest,
} from "../../types/boards";

describe("Board dimension utilities", () => {
  describe("formatBoardSize", () => {
    it("formats valid dimensions", () => {
      expect(formatBoardSize(3, 3)).toBe("3x3");
      expect(formatBoardSize(4, 4)).toBe("4x4");
      expect(formatBoardSize(3, 5)).toBe("3x5");
      expect(formatBoardSize(10, 7)).toBe("10x7");
      expect(formatBoardSize(1, 1)).toBe("1x1");
      expect(formatBoardSize(99, 99)).toBe("99x99");
    });

    it("throws for zero or negative rows", () => {
      expect(() => formatBoardSize(0, 4)).toThrow("Invalid rows: 0");
      expect(() => formatBoardSize(-1, 4)).toThrow("Invalid rows: -1");
      expect(() => formatBoardSize(-5, 4)).toThrow("Invalid rows: -5");
    });

    it("throws for zero or negative cols", () => {
      expect(() => formatBoardSize(4, 0)).toThrow("Invalid cols: 0");
      expect(() => formatBoardSize(4, -1)).toThrow("Invalid cols: -1");
      expect(() => formatBoardSize(4, -10)).toThrow("Invalid cols: -10");
    });

    it("throws for rows > 99", () => {
      expect(() => formatBoardSize(100, 4)).toThrow("Invalid rows: 100");
      expect(() => formatBoardSize(999, 4)).toThrow("Invalid rows: 999");
    });

    it("throws for cols > 99", () => {
      expect(() => formatBoardSize(4, 100)).toThrow("Invalid cols: 100");
      expect(() => formatBoardSize(4, 999)).toThrow("Invalid cols: 999");
    });

    it("throws for non-integer values", () => {
      expect(() => formatBoardSize(3.5, 4)).toThrow("Invalid rows: 3.5");
      expect(() => formatBoardSize(4, 3.5)).toThrow("Invalid cols: 3.5");
      expect(() => formatBoardSize(NaN, 4)).toThrow("Invalid rows: NaN");
      expect(() => formatBoardSize(4, Infinity)).toThrow("Invalid cols: Infinity");
    });
  });

  describe("parseBoardSize", () => {
    it("parses valid board sizes", () => {
      expect(parseBoardSize("3x3")).toEqual({ rows: 3, cols: 3 });
      expect(parseBoardSize("4x4")).toEqual({ rows: 4, cols: 4 });
      expect(parseBoardSize("3x5")).toEqual({ rows: 3, cols: 5 });
      expect(parseBoardSize("10x7")).toEqual({ rows: 10, cols: 7 });
    });
  });

  describe("getBoardSlots", () => {
    it("calculates total slots correctly", () => {
      expect(getBoardSlots("3x3")).toBe(9);
      expect(getBoardSlots("4x4")).toBe(16);
      expect(getBoardSlots("3x5")).toBe(15);
      expect(getBoardSlots("10x7")).toBe(70);
    });
  });

  describe("validateBoardDimensions", () => {
    it("returns true when item count matches slots", () => {
      expect(validateBoardDimensions(16, "4x4")).toBe(true);
      expect(validateBoardDimensions(9, "3x3")).toBe(true);
      expect(validateBoardDimensions(15, "3x5")).toBe(true);
    });

    it("returns false when item count does not match", () => {
      expect(validateBoardDimensions(15, "4x4")).toBe(false);
      expect(validateBoardDimensions(17, "4x4")).toBe(false);
      expect(validateBoardDimensions(0, "3x3")).toBe(false);
    });
  });
});

describe("Type guards", () => {
  describe("isBoardSize", () => {
    it("returns true for valid square sizes", () => {
      expect(isBoardSize("3x3")).toBe(true);
      expect(isBoardSize("4x4")).toBe(true);
      expect(isBoardSize("5x5")).toBe(true);
      expect(isBoardSize("6x6")).toBe(true);
      expect(isBoardSize("7x7")).toBe(true);
      expect(isBoardSize("10x10")).toBe(true);
    });

    it("returns true for valid asymmetric sizes", () => {
      expect(isBoardSize("3x4")).toBe(true);
      expect(isBoardSize("4x7")).toBe(true);
      expect(isBoardSize("5x3")).toBe(true);
      expect(isBoardSize("10x8")).toBe(true);
      expect(isBoardSize("1x1")).toBe(true);
      expect(isBoardSize("99x99")).toBe(true);
    });

    it("returns false for invalid format", () => {
      expect(isBoardSize("4X4")).toBe(false); // Wrong case (uppercase X)
      expect(isBoardSize("4")).toBe(false);
      expect(isBoardSize(4)).toBe(false);
      expect(isBoardSize(null)).toBe(false);
      expect(isBoardSize("abc")).toBe(false);
      expect(isBoardSize("0x4")).toBe(false); // 0 rows invalid
      expect(isBoardSize("4x0")).toBe(false); // 0 cols invalid
      expect(isBoardSize("100x4")).toBe(false); // > 99 invalid
    });
  });

  describe("isBoardGenerationStats", () => {
    it("validates correct stats object", () => {
      expect(
        isBoardGenerationStats({
          maxOverlap: 3,
          avgOverlap: 1.5,
          solver: "highs",
          generationTimeMs: 150,
        })
      ).toBe(true);
    });

    it("rejects invalid stats", () => {
      expect(isBoardGenerationStats(null)).toBe(false);
      expect(isBoardGenerationStats({})).toBe(false);
      expect(isBoardGenerationStats({ maxOverlap: 3 })).toBe(false);
      expect(
        isBoardGenerationStats({
          maxOverlap: "3",
          avgOverlap: 1.5,
          solver: "highs",
          generationTimeMs: 150,
        })
      ).toBe(false);
    });
  });

  describe("isBoardDefinition", () => {
    it("validates correct board definition", () => {
      expect(
        isBoardDefinition({
          id: "board-1",
          number: 1,
          items: ["01", "02"],
          grid: [["01", "02"]],
        })
      ).toBe(true);
    });

    it("validates board with multi-row grid", () => {
      expect(
        isBoardDefinition({
          id: "board-1",
          number: 1,
          items: ["01", "02", "03", "04"],
          grid: [
            ["01", "02"],
            ["03", "04"],
          ],
        })
      ).toBe(true);
    });

    it("rejects board with mismatched items/grid dimensions", () => {
      // 3 items but grid is 2x2 = 4 slots
      expect(
        isBoardDefinition({
          id: "board-1",
          number: 1,
          items: ["01", "02", "03"],
          grid: [
            ["01", "02"],
            ["03", "04"],
          ],
        })
      ).toBe(false);
    });

    it("rejects board with inconsistent row lengths", () => {
      expect(
        isBoardDefinition({
          id: "board-1",
          number: 1,
          items: ["01", "02", "03", "04", "05"],
          grid: [
            ["01", "02", "03"],
            ["04", "05"], // Different length
          ],
        })
      ).toBe(false);
    });

    it("rejects invalid board definitions", () => {
      expect(isBoardDefinition(null)).toBe(false);
      expect(isBoardDefinition({ id: "board-1" })).toBe(false);
      expect(
        isBoardDefinition({ id: "", number: 1, items: ["01"], grid: [["01"]] })
      ).toBe(false); // Empty id
      expect(
        isBoardDefinition({ id: "b", number: 0, items: ["01"], grid: [["01"]] })
      ).toBe(false); // number < 1
      expect(
        isBoardDefinition({ id: "b", number: 1, items: [], grid: [["01"]] })
      ).toBe(false); // Empty items
      expect(
        isBoardDefinition({ id: "b", number: 1, items: ["01"], grid: [] })
      ).toBe(false); // Empty grid
      expect(
        isBoardDefinition({ id: "b", number: 1, items: ["01"], grid: [[]] })
      ).toBe(false); // Empty first row
    });
  });

  describe("isBoardsManifest", () => {
    it("validates correct manifest with matching dimensions", () => {
      expect(
        isBoardsManifest({
          game: "test",
          totalBoards: 1,
          boardSize: "2x2",
          boards: [
            {
              id: "board-1",
              number: 1,
              items: ["01", "02", "03", "04"],
              grid: [
                ["01", "02"],
                ["03", "04"],
              ],
            },
          ],
        })
      ).toBe(true);
    });

    it("validates manifest with asymmetric dimensions", () => {
      expect(
        isBoardsManifest({
          game: "test",
          totalBoards: 1,
          boardSize: "2x3",
          boards: [
            {
              id: "board-1",
              number: 1,
              items: ["01", "02", "03", "04", "05", "06"],
              grid: [
                ["01", "02", "03"],
                ["04", "05", "06"],
              ],
            },
          ],
        })
      ).toBe(true);
    });

    it("rejects manifest with mismatched dimensions", () => {
      // Declares 4x4 but board has 2x2 grid
      expect(
        isBoardsManifest({
          game: "test",
          totalBoards: 1,
          boardSize: "4x4",
          boards: [
            {
              id: "board-1",
              number: 1,
              items: ["01", "02", "03", "04"],
              grid: [
                ["01", "02"],
                ["03", "04"],
              ],
            },
          ],
        })
      ).toBe(false);
    });

    it("rejects manifest with mismatched board count", () => {
      expect(
        isBoardsManifest({
          game: "test",
          totalBoards: 2, // Says 2 but only has 1
          boardSize: "2x2",
          boards: [
            {
              id: "board-1",
              number: 1,
              items: ["01", "02", "03", "04"],
              grid: [
                ["01", "02"],
                ["03", "04"],
              ],
            },
          ],
        })
      ).toBe(false);
    });

    it("rejects invalid manifest", () => {
      expect(isBoardsManifest(null)).toBe(false);
      expect(isBoardsManifest({ game: "" })).toBe(false);
      expect(
        isBoardsManifest({ game: "test", totalBoards: 0, boardSize: "4x4" })
      ).toBe(false);
      expect(
        isBoardsManifest({
          game: "test",
          totalBoards: 1,
          boardSize: "abc", // Invalid format
          boards: [],
        })
      ).toBe(false);
    });
  });
});

