/**
 * Locale Persistence Utilities
 *
 * Handles storing and retrieving locale preferences across sessions.
 * Uses localStorage for client-side persistence and cookies for SSR consistency.
 *
 * @module lib/i18n/persistence
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1B
 */

import { type Locale, defaultLocale, locales, isLocale } from "../../i18n/config";

/**
 * localStorage key for locale preference.
 */
const LOCALE_STORAGE_KEY = "tabula:locale";

/**
 * Cookie name used by next-intl middleware.
 */
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Cookie expiration in seconds (1 year).
 */
const COOKIE_MAX_AGE = 31536000;

/**
 * Determines if we're in a secure context (HTTPS).
 * Used to set the Secure flag on cookies.
 */
function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

/**
 * Gets the stored locale from localStorage.
 *
 * @returns The stored locale, or null if not found/invalid
 */
export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) {
      return stored;
    }
  } catch {
    // localStorage might be unavailable (private browsing, etc.)
  }

  return null;
}

/**
 * Stores the locale preference in localStorage and sets a cookie.
 *
 * @param locale - The locale to store
 */
export function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);

    // Build cookie with secure settings
    const cookieParts = [
      `${LOCALE_COOKIE_NAME}=${locale}`,
      "path=/",
      `max-age=${COOKIE_MAX_AGE}`,
      "samesite=lax",
    ];

    // Add Secure flag in production (HTTPS)
    if (isSecureContext() && window.location.protocol === "https:") {
      cookieParts.push("secure");
    }

    document.cookie = cookieParts.join(";");
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Clears the stored locale preference.
 */
export function clearStoredLocale(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    // Clear cookie by setting expired date
    document.cookie = `${LOCALE_COOKIE_NAME}=;path=/;max-age=0`;
  } catch {
    // Silently fail if storage is unavailable
  }
}

/**
 * Detects the user's preferred locale from browser settings.
 *
 * @returns The detected locale, or the default if detection fails
 */
export function detectSystemLocale(): Locale {
  if (typeof navigator === "undefined") return defaultLocale;

  try {
    // navigator.language returns full locale (e.g., "es-CO", "en-US")
    const browserLang = navigator.language.split("-")[0].toLowerCase();

    if (isLocale(browserLang)) {
      return browserLang;
    }

    // Try navigator.languages array as fallback
    for (const lang of navigator.languages || []) {
      const code = lang.split("-")[0].toLowerCase();
      if (isLocale(code)) {
        return code;
      }
    }
  } catch {
    // Silently fail and return default
  }

  return defaultLocale;
}

/**
 * Gets the best locale for the user based on stored preference or detection.
 *
 * Priority:
 * 1. Stored preference (localStorage)
 * 2. Browser language detection
 * 3. Default locale
 *
 * @returns The resolved locale
 */
export function resolveLocale(): Locale {
  // Check stored preference first
  const stored = getStoredLocale();
  if (stored) return stored;

  // Fall back to browser detection
  return detectSystemLocale();
}

