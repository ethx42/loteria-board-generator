/**
 * Server Request Configuration for next-intl
 *
 * Configures how the locale is resolved on the server.
 *
 * @module i18n/request
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1B
 */

import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // Get the locale from the request (set by middleware)
  let locale = await requestLocale;

  // Validate locale, fallback to default if invalid
  if (!locale || !routing.locales.includes(locale as typeof routing.locales[number])) {
    locale = routing.defaultLocale;
  }

  // Load messages for the resolved locale
  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});

