/**
 * Image URL Resolution
 *
 * Provides utilities for resolving image URLs from various sources:
 * - R2 storage (production)
 * - Local public folder (development)
 * - External URLs (placeholders, etc.)
 *
 * URL Structure in R2:
 * - Base URL: https://pub-xxxxx.r2.dev
 * - Path: /decks/{deck-id}/{filename}.webp
 * - Full: https://pub-xxxxx.r2.dev/decks/{deck-id}/{filename}.webp
 *
 * Note: R2 public URL maps directly to the bucket root,
 * so bucket name is NOT included in the URL path.
 *
 * @module lib/storage/image-url
 */

import { R2_PUBLIC_URL, isR2Configured } from "./r2-client";

/**
 * Generates the public URL for an image stored in R2.
 *
 * @param deckId - Deck identifier
 * @param itemId - Item identifier
 * @param extension - File extension (default: "webp")
 * @returns Public URL for the image
 *
 * @example
 * ```ts
 * const url = getImageUrl("demo-barranquilla", "01");
 * // Returns: "https://pub-xxxxx.r2.dev/decks/demo-barranquilla/01.webp"
 * ```
 */
export function getImageUrl(
  deckId: string,
  itemId: string,
  extension: string = "webp"
): string {
  if (!isR2Configured()) {
    // Fallback to local path if R2 not configured
    return `/decks/${deckId}/${itemId}.${extension}`;
  }

  // R2 URL structure: {publicUrl}/decks/{deckId}/{itemId}.{ext}
  // Note: bucket name is NOT in the URL path
  return `${R2_PUBLIC_URL}/decks/${deckId}/${itemId}.${extension}`;
}

/**
 * Resolves an image URL from various formats.
 *
 * Supports:
 * - Full URLs (http://, https://) - returned as-is
 * - R2 paths (/decks/...) - converted to R2 public URL if configured
 * - Local paths - returned as-is (for development)
 *
 * @param imageUrl - Image URL or path to resolve
 * @returns Resolved image URL
 *
 * @example
 * ```ts
 * resolveImageUrl("https://example.com/image.png") // Returns as-is
 * resolveImageUrl("/decks/demo/01.webp") // Returns R2 URL if configured
 * resolveImageUrl("/local/image.png") // Returns as-is
 * ```
 */
export function resolveImageUrl(imageUrl: string): string {
  // If already a full URL, return as-is
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  // If it's a deck path and R2 is configured, use R2 URL
  if (imageUrl.startsWith("/decks/") && isR2Configured()) {
    // Extract deck-id and filename from path like "/decks/demo-barranquilla/01.webp"
    // or "/decks/demo-barranquilla/01-patacon.webp"
    const match = imageUrl.match(
      /^\/decks\/([^/]+)\/([^/]+)\.(png|jpg|jpeg|webp|gif)$/i
    );
    if (match) {
      const [, deckId, filename, ext] = match;
      // Return full R2 URL (bucket name NOT in path)
      return `${R2_PUBLIC_URL}/decks/${deckId}/${filename}.${ext}`;
    }
  }

  // Fallback: return as-is (for local development or other paths)
  return imageUrl;
}

/**
 * Checks if an image URL is from R2 storage.
 *
 * @param imageUrl - Image URL to check
 * @returns True if URL is from R2
 */
export function isR2Url(imageUrl: string): boolean {
  return isR2Configured() && !!R2_PUBLIC_URL && imageUrl.startsWith(R2_PUBLIC_URL);
}

/**
 * Builds a full R2 URL from a relative path.
 *
 * @param relativePath - Path relative to bucket root (e.g., "/decks/demo/manifest.json")
 * @returns Full R2 URL or null if R2 not configured
 *
 * @example
 * ```ts
 * buildR2Url("/catalog.json")
 * // Returns: "https://pub-xxxxx.r2.dev/catalog.json"
 * ```
 */
export function buildR2Url(relativePath: string): string | null {
  if (!isR2Configured()) {
    return null;
  }

  // Ensure path starts with /
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;

  // R2 public URL maps directly to bucket root, no bucket name in path
  return `${R2_PUBLIC_URL}${path}`;
}

