"use client";

/**
 * Play Page
 *
 * Main game page that handles:
 * - Session initialization
 * - WebSocket connection to Partykit
 * - Game state management
 * - Host Display rendering
 *
 * @see SRD §5.1 Host Display
 */

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { HostDisplay } from "./_components/host-display";
import { loadDemoDeck } from "@/lib/game/deck-loader";
import type { GameSession, DeckDefinition, GameStatus } from "@/lib/types/game";

// ============================================================================
// TYPES
// ============================================================================

type PlayPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: GameSession };

// ============================================================================
// SHUFFLE UTILITY
// ============================================================================

/**
 * Fisher-Yates shuffle with seed for reproducibility
 */
function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const result = [...array];
  let currentSeed = seed;

  // Simple seeded random number generator (mulberry32)
  const random = () => {
    currentSeed = (currentSeed + 0x6d2b79f5) | 0;
    let t = Math.imul(currentSeed ^ (currentSeed >>> 15), 1 | currentSeed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Generate a random seed
 */
function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

// ============================================================================
// SESSION FACTORY
// ============================================================================

function createInitialSession(
  deck: DeckDefinition,
  roomId: string
): GameSession {
  const seed = generateSeed();
  const shuffledItemIds = seededShuffle(
    deck.items.map((item) => item.id),
    seed
  );

  return {
    id: roomId,
    deck,
    boards: [],
    shuffledDeck: shuffledItemIds,
    currentIndex: -1,
    currentItem: null,
    history: [],
    totalItems: deck.items.length,
    shuffleSeed: seed,
    status: "ready",
    connection: {
      hostConnected: true,
      controllerConnected: false,
      controllerId: null,
      lastPing: Date.now(),
    },
  };
}

// ============================================================================
// LOADING FALLBACK
// ============================================================================

function PlayPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-950">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto" />
        <p className="font-serif text-xl text-amber-200">Loading game...</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT (uses useSearchParams, must be wrapped in Suspense)
// ============================================================================

function PlayPageContent() {
  const searchParams = useSearchParams();
  
  // IMPORTANT: Generate roomId only once using lazy initialization
  // This prevents infinite re-renders when no room param is provided
  const [roomId] = useState<string>(() => {
    const roomFromUrl = searchParams?.get("room");
    return roomFromUrl || generateRoomId();
  });

  const [state, setState] = useState<PlayPageState>({ status: "loading" });

  // Initialize session
  useEffect(() => {
    async function initSession() {
      try {
        const deck = await loadDemoDeck();
        const session = createInitialSession(deck, roomId);
        setState({ status: "ready", session });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load deck",
        });
      }
    }

    initSession();
  }, [roomId]);

  // Game actions
  const handleDrawCard = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;

      const { session } = prev;
      const nextIndex = session.currentIndex + 1;

      if (nextIndex >= session.totalItems) {
        return {
          status: "ready" as const,
          session: {
            ...session,
            status: "finished" as const,
          },
        };
      }

      const nextItemId = session.shuffledDeck[nextIndex];
      const nextItem = session.deck.items.find((i) => i.id === nextItemId) || null;

      const newHistory =
        session.currentItem !== null
          ? [...session.history, session.currentItem]
          : session.history;

      const newStatus: GameStatus =
        nextIndex === session.totalItems - 1 ? "finished" : "playing";

      return {
        status: "ready" as const,
        session: {
          ...session,
          currentIndex: nextIndex,
          currentItem: nextItem,
          history: newHistory,
          status: newStatus,
        },
      };
    });
  }, []);

  const handlePause = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        status: "ready",
        session: {
          ...prev.session,
          status: "paused",
        },
      };
    });
  }, []);

  const handleResume = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      return {
        status: "ready",
        session: {
          ...prev.session,
          status: "playing",
        },
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "ready") return prev;

      const newSeed = generateSeed();
      const shuffledItemIds = seededShuffle(
        prev.session.deck.items.map((item) => item.id),
        newSeed
      );

      return {
        status: "ready",
        session: {
          ...prev.session,
          shuffledDeck: shuffledItemIds,
          currentIndex: -1,
          currentItem: null,
          history: [],
          shuffleSeed: newSeed,
          status: "ready",
        },
      };
    });
  }, []);

  const handleDisconnect = useCallback(() => {
    // In a real app, this would close the WebSocket connection
    // and navigate back to the home page
    window.location.href = "/";
  }, []);

  // Render based on state
  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mx-auto" />
          <p className="font-serif text-xl text-amber-200">Loading deck...</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-950">
        <div className="max-w-md rounded-2xl bg-red-900/50 p-6 text-center">
          <h1 className="mb-4 font-serif text-2xl font-bold text-red-200">
            Error Loading Game
          </h1>
          <p className="text-red-300">{state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-full bg-amber-500 px-6 py-2 font-semibold text-amber-950"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <HostDisplay
      session={state.session}
      onDrawCard={handleDrawCard}
      onPause={handlePause}
      onResume={handleResume}
      onReset={handleReset}
      onDisconnect={handleDisconnect}
    />
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// PAGE EXPORT (Wrapped in Suspense for useSearchParams)
// ============================================================================

export default function PlayPage() {
  return (
    <Suspense fallback={<PlayPageLoading />}>
      <PlayPageContent />
    </Suspense>
  );
}

