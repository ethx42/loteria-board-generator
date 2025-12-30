/**
 * Generator Page (Internationalized)
 *
 * Board generator wizard page.
 *
 * @module app/[locale]/generator/page
 */

import { setRequestLocale } from "next-intl/server";
import GeneratorPageClient from "./generator-page-client";

interface GeneratorPageProps {
  params: Promise<{ locale: string }>;
}

export default async function GeneratorPage({ params }: GeneratorPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <GeneratorPageClient />;
}

