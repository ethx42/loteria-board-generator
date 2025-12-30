/**
 * Join Page (Internationalized)
 *
 * Wrapper for the controller join page.
 * The actual implementation is in the client component.
 *
 * @module app/[locale]/play/join/page
 */

import { setRequestLocale } from "next-intl/server";
import JoinPageClient from "./join-page-client";

interface JoinPageProps {
  params: Promise<{ locale: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <JoinPageClient />;
}

