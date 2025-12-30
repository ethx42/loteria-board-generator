/**
 * Image Preloader
 *
 * Preloads upcoming card images to ensure smooth transitions.
 * Maintains a cache of loaded images and handles errors gracefully.
 *
 * @module lib/game/image-preloader
 * @see SRD §7.3 Image Preloader
 * @see FR-016 Image preloading
 */

import { useEffect, useMemo } from "react";
import type { ItemDefinition } from "@/lib/types/game";
import { resolveImageUrl } from "@/lib/storage/image-url";

// ============================================================================
// TYPES
// ============================================================================

interface PreloadedImage {
  url: string;
  status: "loading" | "loaded" | "error";
  image?: HTMLImageElement;
  error?: Error;
}

interface ImagePreloaderState {
  cache: Map<string, PreloadedImage>;
  preloadAhead: number;
}

// ============================================================================
// IMAGE PRELOADER CLASS
// ============================================================================

/**
 * Image preloader for card images.
 * Preloads upcoming cards to ensure smooth transitions.
 *
 * @example
 * ```ts
 * const preloader = new ImagePreloader(3); // Preload 3 ahead
 * preloader.preloadUpcoming(items, shuffledIds, currentIndex);
 *
 * if (preloader.isReady('card-01')) {
 *   // Image is ready for display
 * }
 * ```
 */
export class ImagePreloader {
  private cache: Map<string, PreloadedImage> = new Map();
  private preloadAhead: number;

  constructor(preloadAhead: number = 3) {
    this.preloadAhead = preloadAhead;
  }

  /**
   * Preload upcoming cards based on current position.
   *
   * @param items - All items in the deck
   * @param shuffledIds - IDs in shuffled order
   * @param currentIndex - Current position in the deck (-1 means before first draw)
   */
  preloadUpcoming(
    items: readonly ItemDefinition[],
    shuffledIds: readonly string[],
    currentIndex: number
  ): void {
    // When currentIndex is -1 (before first draw), start preloading from index 0
    const startIndex = Math.max(0, currentIndex + 1);
    const endIndex = Math.min(
      startIndex + this.preloadAhead,
      shuffledIds.length
    );

    if (process.env.NODE_ENV === "development" && startIndex < endIndex) {
      const idsToPreload = shuffledIds.slice(startIndex, endIndex);
      console.log(
        `[Preloader] currentIndex=${currentIndex}, preloading indices ${startIndex}-${endIndex - 1}:`,
        idsToPreload
      );
    }

    for (let i = startIndex; i < endIndex; i++) {
      const itemId = shuffledIds[i];
      const item = items.find((it) => it.id === itemId);

      if (item && !this.cache.has(item.id)) {
        this.preloadImage(item.id, item.imageUrl);
      }
    }

    // Also preload current card if not already loaded
    if (currentIndex >= 0 && currentIndex < shuffledIds.length) {
      const currentId = shuffledIds[currentIndex];
      const currentItem = items.find((it) => it.id === currentId);

      if (currentItem && !this.cache.has(currentItem.id)) {
        this.preloadImage(currentItem.id, currentItem.imageUrl);
      }
    }
  }

  /**
   * Preload a single image by ID and URL.
   * Uses Next.js Image optimization URL format to share cache with <Image> component.
   * Preloads multiple sizes to maximize cache hits across different components.
   */
  private preloadImage(id: string, url: string): void {
    // Resolve relative URLs to full R2 URLs
    const resolvedUrl = resolveImageUrl(url);
    
    // Preload multiple widths to cover different use cases:
    // - 256: HistoryStrip small cards (64-96px * 2x-3x retina)
    // - 384: MiniCard (120px * 2x-3x retina)
    // - 828: CurrentCard main display (380px * 2x retina)
    const widths = [256, 384, 828];
    
    const entry: PreloadedImage = {
      url: resolvedUrl,
      status: "loading",
    };

    this.cache.set(id, entry);

    let loadedCount = 0;
    const totalToLoad = widths.length;

    widths.forEach((w) => {
      const nextImageUrl = `/_next/image?url=${encodeURIComponent(resolvedUrl)}&w=${w}&q=75`;
      const img = new Image();

      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalToLoad) {
          const cached = this.cache.get(id);
          if (cached) {
            cached.status = "loaded";
            cached.image = img;
            if (process.env.NODE_ENV === "development") {
              console.log(`[Preloader] ✓ Loaded: ${url.split("/").pop()}`);
            }
          }
        }
      };

      img.onerror = () => {
        const cached = this.cache.get(id);
        if (cached && cached.status !== "loaded") {
          cached.status = "error";
          cached.error = new Error(`Failed to load image: ${resolvedUrl}`);
          if (process.env.NODE_ENV === "development") {
            console.warn(`[Preloader] ✗ Failed: ${url.split("/").pop()}`);
          }
        }
      };

      img.src = nextImageUrl;
    });
  }

  /**
   * Check if an image is ready for display.
   *
   * @param id - Item ID to check
   * @returns True if image is loaded
   */
  isReady(id: string): boolean {
    const entry = this.cache.get(id);
    return entry?.status === "loaded";
  }

  /**
   * Get the loading status of an image.
   *
   * @param id - Item ID to check
   * @returns Loading status or undefined if not in cache
   */
  getStatus(id: string): "loading" | "loaded" | "error" | undefined {
    return this.cache.get(id)?.status;
  }

  /**
   * Clear the entire cache.
   * Call this when ending a session to free memory.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for debugging.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get all loaded image IDs.
   */
  getLoadedIds(): string[] {
    return Array.from(this.cache.entries())
      .filter(([, entry]) => entry.status === "loaded")
      .map(([id]) => id);
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

/**
 * React hook for image preloading.
 * Automatically preloads upcoming card images as the game progresses.
 *
 * @param items - All items in the deck
 * @param shuffledIds - IDs in shuffled order
 * @param currentIndex - Current position in the deck
 * @param preloadAhead - Number of images to preload ahead (default: 3)
 * @returns Preloader instance with utility methods
 *
 * @example
 * ```tsx
 * function HostDisplay({ session }) {
 *   const preloader = useImagePreloader(
 *     session.deck.items,
 *     session.shuffledDeck,
 *     session.currentIndex
 *   );
 *
 *   const isNextReady = preloader.isReady(
 *     session.shuffledDeck[session.currentIndex + 1]
 *   );
 * }
 * ```
 */
export function useImagePreloader(
  items: readonly ItemDefinition[],
  shuffledIds: readonly string[],
  currentIndex: number,
  preloadAhead: number = 3
): ImagePreloader {
  // Use useMemo for stable initialization (safe during render)
  const preloader = useMemo(
    () => new ImagePreloader(preloadAhead),
    [preloadAhead]
  );

  // Preload when index changes
  useEffect(() => {
    preloader.preloadUpcoming(items, shuffledIds, currentIndex);
  }, [preloader, items, shuffledIds, currentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloader.clear();
    };
  }, [preloader]);

  return preloader;
}

// ============================================================================
// STANDALONE PRELOAD FUNCTION
// ============================================================================

/**
 * Preload a single image and return a promise.
 * Useful for ensuring an image is ready before displaying.
 *
 * @param url - Image URL to preload
 * @returns Promise that resolves when image is loaded
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Preload multiple images in parallel.
 *
 * @param urls - Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
export async function preloadImages(
  urls: string[]
): Promise<PromiseSettledResult<HTMLImageElement>[]> {
  return Promise.allSettled(urls.map(preloadImage));
}

