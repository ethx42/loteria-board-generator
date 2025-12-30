/**
 * Internationalization Configuration
 *
 * Defines available locales and default settings for the i18n system.
 *
 * @module i18n/config
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1B
 */

/**
 * Available locales in the application.
 * Spanish is the primary language (Barranquilla-based game).
 */
export const locales = ["es", "en"] as const;

/**
 * Locale type derived from the locales array.
 */
export type Locale = (typeof locales)[number];

/**
 * Default locale (Spanish for the Barranquilla edition).
 */
export const defaultLocale: Locale = "es";

/**
 * Human-readable locale names.
 */
export const localeNames: Record<Locale, string> = {
  es: "Español",
  en: "English",
};

/**
 * Flag emojis for locale display.
 */
export const localeFlags: Record<Locale, string> = {
  es: "🇨🇴", // Colombian flag for Barranquilla edition
  en: "🇬🇧",
};

/**
 * Type guard to check if a string is a valid locale.
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

