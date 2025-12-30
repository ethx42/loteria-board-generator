/**
 * Cloudflare R2 Storage Configuration
 *
 * Minimal configuration for reading public files from R2.
 * Only requires NEXT_PUBLIC_R2_PUBLIC_URL environment variable.
 *
 * @module lib/storage/r2-client
 */

/**
 * Public URL for R2 bucket.
 * Example: "https://pub-xxxxx.r2.dev"
 */
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "";

/**
 * Check if R2 is configured for reading public files.
 */
export function isR2Configured(): boolean {
  return !!R2_PUBLIC_URL;
}
