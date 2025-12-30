/**
 * Internationalized Navigation
 *
 * Exports locale-aware navigation components and hooks.
 *
 * @module i18n/navigation
 * @see TABULA_V4_DEVELOPMENT_PLAN §4 Phase 1B
 */

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives.
 *
 * These should be used instead of Next.js's built-in Link, redirect, etc.
 * They automatically handle locale prefixing.
 */
export const {
  Link,
  redirect,
  usePathname,
  useRouter,
  getPathname,
} = createNavigation(routing);

