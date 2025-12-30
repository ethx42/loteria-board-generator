/**
 * Storage Module
 *
 * Centralized exports for image storage functionality.
 *
 * @module lib/storage
 */

export { R2_PUBLIC_URL, isR2Configured } from "./r2-client";

export { getImageUrl, resolveImageUrl, isR2Url } from "./image-url";
