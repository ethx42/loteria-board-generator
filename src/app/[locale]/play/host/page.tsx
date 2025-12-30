/**
 * Host Page (Internationalized)
 *
 * Wrapper for the host display page.
 * The actual implementation is in the shared _components folder.
 *
 * @module app/[locale]/play/host/page
 */

import { setRequestLocale } from "next-intl/server";
import HostPageClient from "./host-page-client";

interface HostPageProps {
  params: Promise<{ locale: string }>;
}

export default async function HostPage({ params }: HostPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <HostPageClient />;
}

