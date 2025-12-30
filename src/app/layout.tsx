/**
 * Root Layout
 *
 * Minimal root layout that passes through to locale-specific layouts.
 * The actual <html> and <body> tags are in [locale]/layout.tsx
 * to support dynamic lang attribute based on locale.
 *
 * Note: This layout is required by Next.js but should be minimal.
 * All HTML structure is handled by [locale]/layout.tsx.
 */

import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Just pass through - [locale]/layout.tsx handles html/body
  return children;
}
