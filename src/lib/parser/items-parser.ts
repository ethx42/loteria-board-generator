/**
 * Items Parser
 * Intelligent parsing of plain text item lists
 */

import type { ParseResult, ParseWarning, ParseError } from "@/lib/types";

/**
 * Parse items from a plain text input
 *
 * Supported formats:
 * - One item per line
 * - Comma-separated: item1, item2, item3
 * - Semicolon-separated: item1; item2; item3
 * - Quoted strings: "item 1", 'item 2'
 * - Numbered lists: 1. item, 2) item, 1- item
 * - Mixed formats
 *
 * @param text Raw text input
 * @returns ParseResult with items, warnings, and errors
 */
export function parseItemsFromText(text: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const rawItems: string[] = [];

  if (!text.trim()) {
    return {
      success: false,
      items: [],
      warnings: [],
      errors: [{ type: "validation", message: "Input is empty" }],
      rawCount: 0,
      uniqueCount: 0,
    };
  }

  // Step 1: Fix unbalanced quotes
  const { text: fixedText, wasFixed } = fixQuotes(text);
  if (wasFixed) {
    warnings.push({
      type: "quote_fixed",
      message: "Unbalanced quotes were automatically corrected",
    });
  }

  // Step 2: Split by lines first
  const lines = fixedText.split(/\r?\n/);

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum].trim();

    if (!line) continue;

    // Step 3: Parse each line
    const lineItems = parseLine(line, lineNum + 1, warnings);
    rawItems.push(...lineItems);
  }

  // Step 4: Clean and deduplicate
  const cleanedItems = rawItems
    .map((item) => sanitizeString(item))
    .filter((item) => item.length > 0);

  // Track duplicates
  const seen = new Set<string>();
  const uniqueItems: string[] = [];

  for (const item of cleanedItems) {
    const normalized = item.toLowerCase().trim();
    if (seen.has(normalized)) {
      warnings.push({
        type: "duplicate",
        message: `Duplicate item removed: "${item}"`,
      });
    } else {
      seen.add(normalized);
      uniqueItems.push(item);
    }
  }

  // Check for empty items after cleaning
  const emptyCount = rawItems.length - cleanedItems.length;
  if (emptyCount > 0) {
    warnings.push({
      type: "empty",
      message: `${emptyCount} empty item(s) were removed`,
    });
  }

  return {
    success: errors.length === 0 && uniqueItems.length > 0,
    items: uniqueItems,
    warnings,
    errors,
    rawCount: rawItems.length,
    uniqueCount: uniqueItems.length,
  };
}

/**
 * Parse a single line, handling various formats
 */
function parseLine(
  line: string,
  lineNum: number,
  warnings: ParseWarning[]
): string[] {
  const items: string[] = [];

  // Remove numbered list prefixes: "1.", "1)", "1-", "(1)", etc.
  const cleanedLine = line.replace(/^(?:\d+[.)\-]|\(\d+\))\s*/, "");

  // Check if line contains separators
  const hasSeparators = /[,;]/.test(cleanedLine);

  if (hasSeparators) {
    // Parse as separated list, respecting quotes
    items.push(...parseWithQuotes(cleanedLine));
  } else {
    // Single item line
    items.push(cleanedLine);
  }

  return items;
}

/**
 * Parse a line with comma/semicolon separators, respecting quoted strings
 */
function parseWithQuotes(line: string): string[] {
  const items: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = "";
      continue;
    }

    if ((char === "," || char === ";") && !inQuotes) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  // Don't forget the last item
  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

/**
 * Fix unbalanced quotes in text
 */
function fixQuotes(text: string): { text: string; wasFixed: boolean } {
  let wasFixed = false;

  // Count quotes
  const doubleQuotes = (text.match(/"/g) || []).length;
  const singleQuotes = (text.match(/'/g) || []).length;

  let result = text;

  // Fix unbalanced double quotes
  if (doubleQuotes % 2 !== 0) {
    // Find the last unmatched quote and remove it
    result = removeLastUnmatchedQuote(result, '"');
    wasFixed = true;
  }

  // Fix unbalanced single quotes
  if (singleQuotes % 2 !== 0) {
    result = removeLastUnmatchedQuote(result, "'");
    wasFixed = true;
  }

  return { text: result, wasFixed };
}

/**
 * Remove the last unmatched quote
 */
function removeLastUnmatchedQuote(text: string, quoteChar: string): string {
  let count = 0;
  let lastIndex = -1;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === quoteChar) {
      count++;
      lastIndex = i;
    }
  }

  if (count % 2 !== 0 && lastIndex !== -1) {
    return text.slice(0, lastIndex) + text.slice(lastIndex + 1);
  }

  return text;
}

/**
 * Sanitize a string: trim whitespace, normalize spaces, remove control characters
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Convert items array back to text format
 */
export function itemsToText(items: string[]): string {
  // Use quoted format if any item contains commas or special chars
  const needsQuotes = items.some(
    (item) => /[,;"\n]/.test(item) || item.includes("'")
  );

  if (needsQuotes) {
    return items.map((item) => `"${item.replace(/"/g, '\\"')}"`).join("\n");
  }

  return items.join("\n");
}

/**
 * Validate items meet minimum requirements
 */
export function validateItems(
  items: string[],
  minCount: number = 1
): { valid: boolean; error?: string } {
  if (items.length === 0) {
    return { valid: false, error: "No items provided" };
  }

  if (items.length < minCount) {
    return {
      valid: false,
      error: `Need at least ${minCount} items, got ${items.length}`,
    };
  }

  // Check for very short items
  const shortItems = items.filter((item) => item.length < 2);
  if (shortItems.length > 0) {
    return {
      valid: false,
      error: `Some items are too short: ${shortItems.join(", ")}`,
    };
  }

  return { valid: true };
}

