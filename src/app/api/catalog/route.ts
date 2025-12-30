/**
 * Catalog API Route
 *
 * Proxies the deck catalog from R2 to avoid CORS issues.
 * Falls back to local catalog if R2 is not configured.
 */

import { NextResponse } from "next/server";

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

export async function GET() {
  try {
    // Try R2 first if configured
    if (R2_PUBLIC_URL) {
      const response = await fetch(`${R2_PUBLIC_URL}/catalog.json`, {
        next: { revalidate: 3600 }, // Cache for 1 hour
      });

      if (response.ok) {
        const catalog = await response.json();
        return NextResponse.json(catalog);
      }
    }

    // Fallback: return error if R2 fails
    return NextResponse.json(
      { error: "Failed to load catalog from R2" },
      { status: 502 }
    );
  } catch (error) {
    console.error("Failed to fetch catalog:", error);
    return NextResponse.json(
      { error: "Failed to load catalog" },
      { status: 500 }
    );
  }
}

