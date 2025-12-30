/**
 * Routing Configuration for next-intl
 *
 * Defines locale routing behavior and path handling.
 *
 * @module i18n/routing
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1B
 */

import { defineRouting } from "next-intl/routing";
import { locales, defaultLocale } from "./config";

/**
 * Routing configuration for internationalized navigation.
 *
 * Using 'as-needed' locale prefix strategy:
 * - Default locale (es) URLs don't have prefix: /play/host
 * - Non-default locales have prefix: /en/play/host
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always show locale prefix in URL for consistency
  // This prevents hydration mismatches between cookie and URL
  localePrefix: "always",
});

