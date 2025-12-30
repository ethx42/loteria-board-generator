/**
 * Next.js Proxy for Internationalization
 *
 * Handles locale detection and routing for all requests.
 * Runs on the edge for optimal performance.
 *
 * @module proxy
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1B
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Middleware configuration for next-intl.
 *
 * Detection order:
 * 1. Cookie (NEXT_LOCALE) - returning user preference
 * 2. Accept-Language header - browser preference
 * 3. Default locale (es)
 */
export default createMiddleware(routing);

/**
 * Matcher configuration.
 *
 * Match all paths except:
 * - /api routes
 * - /_next static files
 * - Assets with extensions (images, fonts, etc.)
 */
export const config = {
  matcher: [
    // Match all pathnames except for
    // - API routes
    // - Next.js internals
    // - Static files
    "/((?!api|_next|.*\\..*).*)",
  ],
};

