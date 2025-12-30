/**
 * Play Landing Page (Internationalized)
 *
 * Entry point for the game system.
 * Currently a wrapper that imports the existing play landing page.
 * Translations will be added incrementally.
 *
 * @module app/[locale]/play/page
 */

import { setRequestLocale } from "next-intl/server";
import PlayLandingContent from "./play-landing-content";

interface PlayPageProps {
  params: Promise<{ locale: string }>;
}

export default async function PlayPage({ params }: PlayPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <PlayLandingContent />;
}

