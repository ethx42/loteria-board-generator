/**
 * Spectator Page
 *
 * Server component that renders the spectator view for watching a game.
 * Spectators can see the current card and send emoji reactions.
 *
 * @see SRD §6.3 Spectator Mode
 */

import { Suspense } from "react";
import SpectatorPageClient from "./spectator-page-client";

// ============================================================================
// LOADING COMPONENT
// ============================================================================

function SpectatorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-950">
      <div className="text-center">
        <div className="mb-4 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="font-serif text-xl text-amber-200">Joining game...</p>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function SpectatorPage() {
  return (
    <Suspense fallback={<SpectatorLoading />}>
      <SpectatorPageClient />
    </Suspense>
  );
}

