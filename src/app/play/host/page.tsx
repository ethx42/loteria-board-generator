"use client";

/**
 * Host Page
 *
 * Main game host that:
 * 1. Creates a room and displays QR for pairing
 * 2. Connects to Partykit WebSocket as "host" role
 * 3. Manages game state and broadcasts to controller
 * 4. Can play standalone or with connected controller
 *
 * @see SRD §5.1 Host Display Layout
 * @see SRD §5.9 Session Entry & QR Pairing UI
 */

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { HostDisplay } from "../_components/host-display";
import { QRPairing } from "../_components/qr-pairing";
import { loadDemoDeck } from "@/lib/game/deck-loader";
import { useGameSocket } from "@/lib/realtime/partykit-client";
import { isGameCommand } from "@/lib/realtime/types";
import { createDevLogger } from "@/lib/utils/dev-logger";
import type { GameSession, DeckDefinition, GameStatus, ItemDefinition } from "@/lib/types/game";

// Dev-only logger
const log = createDevLogger("HostPage");

// ============================================================================
// TYPES
// ============================================================================

type HostPageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "pairing"; session: GameSession }
  | { status: "playing"; session: GameSession };

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

function seededShuffle<T>(array: readonly T[], seed: number): T[] {
  const result = [...array];
  let currentSeed = seed;

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

function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}

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
// LOADING COMPONENT
// ============================================================================

function HostPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-950">
      <div className="text-center">
        <div className="mb-4 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="font-serif text-xl text-amber-200">Setting up game...</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CONTENT
// ============================================================================

function HostPageContent() {
  const searchParams = useSearchParams();

  // Generate or use existing room ID
  const [roomId] = useState<string>(() => {
    const roomFromUrl = searchParams?.get("room");
    return roomFromUrl || generateRoomId();
  });

  const [state, setState] = useState<HostPageState>({ status: "loading" });

  // Track if we've sent initial state to controller
  const hasSentInitialState = useRef(false);
  
  // Track if session has been initialized (prevent duplicate init)
  const hasInitialized = useRef(false);

  // WebSocket connection
  const {
    status: connectionStatus,
    controllerConnected,
    connect,
    sendStateUpdate,
    onMessage,
  } = useGameSocket({
    roomId,
    role: "host",
    debug: true,
  });

  // Ref to track current session for message handlers
  const sessionRef = useRef<GameSession | null>(null);
  useEffect(() => {
    if (state.status === "pairing" || state.status === "playing") {
      sessionRef.current = state.session;
    }
  }, [state]);

  // Helper to broadcast state
  const broadcastState = useCallback(
    (session: GameSession) => {
      if (connectionStatus !== "connected" || !controllerConnected) {
        log.debug("Not broadcasting - no controller connected");
        return;
      }

      log.log("Broadcasting state to controller", {
        currentIndex: session.currentIndex,
        status: session.status,
      });

      sendStateUpdate({
        currentItem: session.currentItem,
        currentIndex: session.currentIndex,
        totalItems: session.totalItems,
        status: session.status,
        historyCount: session.history.length,
      });
    },
    [connectionStatus, controllerConnected, sendStateUpdate]
  );

  // Game action implementations
  const doDrawCard = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "pairing" && prev.status !== "playing") return prev;

      const { session } = prev;
      const nextIndex = session.currentIndex + 1;

      if (nextIndex >= session.totalItems) {
        const newSession = {
          ...session,
          status: "finished" as const,
        };
        setTimeout(() => broadcastState(newSession), 0);
        return { status: "playing", session: newSession };
      }

      const nextItemId = session.shuffledDeck[nextIndex];
      const nextItem = session.deck.items.find((i) => i.id === nextItemId) || null;

      const newHistory: ItemDefinition[] =
        session.currentItem !== null
          ? [...session.history, session.currentItem]
          : [...session.history];

      const newStatus: GameStatus =
        nextIndex === session.totalItems - 1 ? "finished" : "playing";

      const newSession = {
        ...session,
        currentIndex: nextIndex,
        currentItem: nextItem,
        history: newHistory,
        status: newStatus,
      };

      setTimeout(() => broadcastState(newSession), 0);
      return { status: "playing", session: newSession };
    });
  }, [broadcastState]);

  const doPause = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "playing") return prev;
      const newSession = { ...prev.session, status: "paused" as const };
      setTimeout(() => broadcastState(newSession), 0);
      return { status: "playing", session: newSession };
    });
  }, [broadcastState]);

  const doResume = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "playing") return prev;
      const newSession = { ...prev.session, status: "playing" as const };
      setTimeout(() => broadcastState(newSession), 0);
      return { status: "playing", session: newSession };
    });
  }, [broadcastState]);

  const doReset = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "playing" && prev.status !== "pairing") return prev;

      const newSeed = generateSeed();
      const shuffledItemIds = seededShuffle(
        prev.session.deck.items.map((item) => item.id),
        newSeed
      );

      const newSession = {
        ...prev.session,
        shuffledDeck: shuffledItemIds,
        currentIndex: -1,
        currentItem: null,
        history: [] as ItemDefinition[],
        shuffleSeed: newSeed,
        status: "ready" as const,
      };

      setTimeout(() => broadcastState(newSession), 0);
      return { status: "playing", session: newSession };
    });
  }, [broadcastState]);

  // Store action refs for message handler
  const actionsRef = useRef({ doDrawCard, doPause, doResume, doReset });
  useEffect(() => {
    actionsRef.current = { doDrawCard, doPause, doResume, doReset };
  }, [doDrawCard, doPause, doResume, doReset]);

  // Subscribe to incoming messages from controller
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (isGameCommand(message)) {
        log.log(`Received command from controller: ${message.type}`);
        switch (message.type) {
          case "DRAW_CARD":
            actionsRef.current.doDrawCard();
            break;
          case "PAUSE_GAME":
            actionsRef.current.doPause();
            break;
          case "RESUME_GAME":
            actionsRef.current.doResume();
            break;
          case "RESET_GAME":
            actionsRef.current.doReset();
            break;
        }
      }
    });

    return unsubscribe;
  }, [onMessage]);

  // Initialize session (runs once)
  useEffect(() => {
    // Guard against multiple initializations
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    async function initSession() {
      try {
        log.info(`Initializing session for room: ${roomId}`);
        const deck = await loadDemoDeck();
        const session = createInitialSession(deck, roomId);
        log.log("Session created", { deckItems: deck.items.length });
        setState({ status: "pairing", session });
        connect();
      } catch (error) {
        log.error("Failed to initialize session", error);
        hasInitialized.current = false; // Allow retry on error
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load deck",
        });
      }
    }

    initSession();
  }, [roomId, connect]);

  // Handle controller connection status
  useEffect(() => {
    if (state.status !== "pairing" && state.status !== "playing") return;

    log.debug(`Controller connected status: ${controllerConnected}`);

    setState((prev) => {
      if (prev.status !== "pairing" && prev.status !== "playing") return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          connection: {
            ...prev.session.connection,
            controllerConnected,
          },
        },
      };
    });

    // When controller connects, enter game mode (FR-004)
    if (controllerConnected && state.status === "pairing") {
      log.log("Controller connected! Transitioning to playing mode");
      setState((prev) => {
        if (prev.status !== "pairing") return prev;
        return { status: "playing", session: prev.session };
      });
    }
  }, [controllerConnected, state.status]);

  // Send state when controller first connects
  useEffect(() => {
    if (
      controllerConnected &&
      !hasSentInitialState.current &&
      (state.status === "pairing" || state.status === "playing")
    ) {
      broadcastState(state.session);
      hasSentInitialState.current = true;
    }
    if (!controllerConnected) {
      hasSentInitialState.current = false;
    }
  }, [controllerConnected, state, broadcastState]);

  const handleDisconnect = useCallback(() => {
    window.location.href = "/play";
  }, []);

  const handlePlayStandalone = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "pairing") return prev;
      return { status: "playing", session: prev.session };
    });
  }, []);

  // Render based on state
  if (state.status === "loading") {
    return <HostPageLoading />;
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

  if (state.status === "pairing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 p-6">
        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10 w-full max-w-md text-center">
          <h1 className="mb-2 font-serif text-4xl font-bold text-amber-100">
            Tabula
          </h1>
          <p className="mb-8 text-amber-300/70">Connect your controller</p>

          <QRPairing
            roomCode={roomId}
            onPlayStandalone={handlePlayStandalone}
            isControllerConnected={controllerConnected}
          />

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-amber-400/50">
            <div
              className={`h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-green-500"
                  : connectionStatus === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span>
              {connectionStatus === "connected"
                ? "Room ready"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HostDisplay
      session={state.session}
      onDrawCard={doDrawCard}
      onPause={doPause}
      onResume={doResume}
      onReset={doReset}
      onDisconnect={handleDisconnect}
    />
  );
}

// ============================================================================
// PAGE EXPORT
// ============================================================================

export default function HostPage() {
  return (
    <Suspense fallback={<HostPageLoading />}>
      <HostPageContent />
    </Suspense>
  );
}
