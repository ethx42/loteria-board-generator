"use client";

/**
 * Host Page Client Component
 *
 * Main game host that:
 * 1. Creates a room and displays QR for pairing
 * 2. Connects to Partykit WebSocket as "host" role
 * 3. Manages game state and broadcasts to controller
 * 4. Can play standalone or with connected controller
 *
 * Uses useSoundSync hook as single source of truth for sound state.
 *
 * @see SRD §5.1 Host Display Layout
 * @see SRD §5.9 Session Entry & QR Pairing UI
 */

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { HostDisplay } from "@/app/play/_components/host-display";
import { QRPairing } from "@/app/play/_components/qr-pairing";
import { DeckSelector } from "@/app/play/_components/deck-selector";
import { useGameSocket } from "@/lib/realtime/partykit-client";
import { useSoundSync, SoundSource } from "@/lib/audio";
import { isGameCommand, type ReactionBurstMessage } from "@/lib/realtime/types";
import { createDevLogger } from "@/lib/utils/dev-logger";
import type {
  GameSession,
  DeckDefinition,
  GameStatus,
  ItemDefinition,
} from "@/lib/types/game";
import type { BoardsManifest } from "@/lib/types/boards";
import type { PendingSoundSync } from "@/lib/audio/use-sound-sync";
import { loadBoardsForDeck } from "@/lib/game/deck-loader";

// Dev-only logger
const log = createDevLogger("HostPage");

// ============================================================================
// TYPES
// ============================================================================

type HostPageState =
  | { status: "selecting-deck" }
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

  // ===========================================================================
  // WEBSOCKET CONNECTION
  // ===========================================================================

  const socket = useGameSocket({
    roomId,
    role: "host",
    debug: true,
  });

  // Stable ref to socket.connect - useLayoutEffect guarantees
  // the ref is updated before other effects run
  const connectRef = useRef(socket.connect);
  useLayoutEffect(() => {
    connectRef.current = socket.connect;
  });

  // ===========================================================================
  // SOUND SYNC (Single Source of Truth)
  // ===========================================================================

  // Track pending sound command from Controller
  const [pendingSoundSync, setPendingSoundSync] =
    useState<PendingSoundSync | null>(null);

  // v4.0: Track spectator state
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [reactions, setReactions] = useState<ReactionBurstMessage["reactions"]>(
    []
  );

  // v4.0: Track card flip state (for spectator sync)
  const [isFlipped, setIsFlipped] = useState(false);

  // v4.0: Track detailed text expansion state (for spectator sync)
  const [isDetailedExpanded, setIsDetailedExpanded] = useState(false);
  // v4.0: Track if detailed state came from controller
  const [isDetailedSyncedFromController, setIsDetailedSyncedFromController] =
    useState(false);

  // v4.0: Board Prediction Engine - boards manifest for the selected deck
  const [boardsManifest, setBoardsManifest] = useState<BoardsManifest | null>(
    null
  );

  const clearPendingSoundSync = useCallback(() => {
    setPendingSoundSync(null);
  }, []);

  // useSoundSync is the single source of truth for all sound state/actions
  const sound = useSoundSync({
    role: "host",
    socket: {
      sendSoundPreference: socket.sendSoundPreference,
    },
    externalPendingSync: pendingSoundSync,
    onClearExternalPendingSync: clearPendingSoundSync,
  });

  // Track previous index to play sound on card draw
  const prevIndexRef = useRef(-1);

  // ===========================================================================
  // SESSION REF FOR CALLBACKS
  // ===========================================================================

  const sessionRef = useRef<GameSession | null>(null);
  useEffect(() => {
    if (state.status === "pairing" || state.status === "playing") {
      sessionRef.current = state.session;
    }
  }, [state]);

  // ===========================================================================
  // BROADCAST STATE
  // ===========================================================================

  const broadcastState = useCallback(
    (session: GameSession, flipState?: boolean) => {
      // Always broadcast if connected - spectators need state updates too
      if (socket.status !== "connected") {
        log.debug("Not broadcasting - socket not connected");
        return;
      }

      log.log("Broadcasting state", {
        currentIndex: session.currentIndex,
        status: session.status,
        hasController: socket.controllerConnected,
        isFlipped: flipState ?? isFlipped,
      });

      socket.sendStateUpdate({
        currentItem: session.currentItem,
        currentIndex: session.currentIndex,
        totalItems: session.totalItems,
        status: session.status,
        historyCount: session.history.length,
        history: session.history,
        isFlipped: flipState ?? isFlipped,
      });
    },
    [socket, isFlipped]
  );

  // ===========================================================================
  // GAME ACTIONS
  // ===========================================================================

  const doDrawCard = useCallback(() => {
    // Reset flip state and detailed state when drawing a new card
    setIsFlipped(false);
    setIsDetailedExpanded(false);
    setIsDetailedSyncedFromController(false);

    setState((prev) => {
      if (prev.status !== "pairing" && prev.status !== "playing") return prev;

      const { session } = prev;
      const nextIndex = session.currentIndex + 1;

      if (nextIndex >= session.totalItems) {
        const newSession = {
          ...session,
          status: "finished" as const,
        };
        // Broadcast with isFlipped: false (new card)
        setTimeout(() => broadcastState(newSession, false), 0);
        return { status: "playing", session: newSession };
      }

      const nextItemId = session.shuffledDeck[nextIndex];
      const nextItem =
        session.deck.items.find((i) => i.id === nextItemId) || null;

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

      // Broadcast with isFlipped: false (new card)
      setTimeout(() => broadcastState(newSession, false), 0);
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

  // Handle flip state change (for spectator sync)
  const handleFlipChange = useCallback(
    (newFlipState: boolean) => {
      setIsFlipped(newFlipState);
      // Broadcast immediately with the new flip state
      if (sessionRef.current) {
        broadcastState(sessionRef.current, newFlipState);
      }
    },
    [broadcastState]
  );

  // Handle detailed text expansion change (for spectator sync)
  const handleDetailedChange = useCallback(
    (newState: boolean) => {
      setIsDetailedExpanded(newState);
      setIsDetailedSyncedFromController(false); // Host is toggling locally
      // Broadcast to spectators via socket
      socket.toggleDetailed(newState);
    },
    [socket]
  );

  // Store action refs for message handler
  const actionsRef = useRef({ doDrawCard, doPause, doResume, doReset });
  useEffect(() => {
    actionsRef.current = { doDrawCard, doPause, doResume, doReset };
  }, [doDrawCard, doPause, doResume, doReset]);

  // ===========================================================================
  // MESSAGE HANDLERS
  // ===========================================================================

  // Subscribe to incoming messages from controller
  useEffect(() => {
    const unsubscribe = socket.onMessage((message) => {
      // Game commands
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
          case "FLIP_CARD":
            // Controller is flipping the card - update host state and broadcast
            handleFlipChange(message.isFlipped);
            break;
        }
      }

      // v4.0: Toggle detailed text from Controller
      if (message.type === "TOGGLE_DETAILED") {
        log.log(
          `Received detailed toggle from controller: isExpanded=${message.isExpanded}`
        );
        setIsDetailedExpanded(message.isExpanded);
        setIsDetailedSyncedFromController(true);
      }

      // Sound preference from Controller (scope: host_only or both)
      if (
        message.type === "SOUND_PREFERENCE" &&
        message.source === SoundSource.CONTROLLER
      ) {
        log.log(
          `Received sound command from controller: enabled=${message.enabled}, scope=${message.scope}`
        );
        setPendingSoundSync({
          enabled: message.enabled,
          source: SoundSource.CONTROLLER,
          scope: message.scope,
        });
      }

      // v4.0: Spectator count updates
      if (message.type === "SPECTATOR_COUNT") {
        log.debug(`Spectator count updated: ${message.count}`);
        setSpectatorCount(message.count);
      }

      // v4.0: Reaction burst from spectators
      if (message.type === "REACTION_BURST") {
        log.info(
          `🎉 Received REACTION_BURST: ${JSON.stringify(message.reactions)}`
        );
        setReactions(message.reactions);
        // Clear reactions after animation starts (longer delay for RAF)
        setTimeout(() => {
          log.debug("Clearing reactions state");
          setReactions([]);
        }, 200);
      }
    });

    return unsubscribe;
  }, [socket]);

  // Handle sound command from Controller (execute silently and send ACK)
  useEffect(() => {
    if (
      pendingSoundSync &&
      pendingSoundSync.source === SoundSource.CONTROLLER
    ) {
      log.log(
        `Executing Controller sound command: enabled=${pendingSoundSync.enabled}`
      );
      sound.setEnabled(pendingSoundSync.enabled);

      // Send ACK back to Controller so it knows Host's new state
      log.log(
        `Sending ACK to Controller: enabled=${
          pendingSoundSync.enabled
        }, hasAckFn=${typeof socket.sendSoundPreferenceAck}`
      );
      if (socket.sendSoundPreferenceAck) {
        socket.sendSoundPreferenceAck(
          pendingSoundSync.enabled,
          pendingSoundSync.scope
        );
      } else {
        log.error("sendSoundPreferenceAck is not defined on socket!");
      }

      clearPendingSoundSync();
    }
  }, [pendingSoundSync, sound, clearPendingSoundSync, socket]);

  // Play sound when card is drawn
  useEffect(() => {
    if (state.status !== "pairing" && state.status !== "playing") return;

    const currentIndex = state.session.currentIndex;
    log.debug(
      `[Sound Effect] currentIndex: ${currentIndex}, prevIndex: ${prevIndexRef.current}`
    );
    if (currentIndex > prevIndexRef.current && currentIndex >= 0) {
      log.log("[Sound Effect] Playing card sound");
      sound.playCardSound();
    }
    prevIndexRef.current = currentIndex;
  }, [state, sound]);

  // ===========================================================================
  // SESSION INITIALIZATION
  // ===========================================================================

  // Initialize with deck selection state
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    setState({ status: "selecting-deck" });
  }, []);

  // Handle deck selection
  const handleDeckSelect = useCallback(
    async (deck: DeckDefinition, manifestUrl?: string) => {
      try {
        log.info(`Initializing session with deck: ${deck.id}`, {
          roomId,
          deckItems: deck.items.length,
        });
        const session = createInitialSession(deck, roomId);
        log.log("Session created", { deckItems: deck.items.length });
        setState({ status: "pairing", session });
        // Use ref to avoid socket in dependencies (prevents reconnection loop)
        connectRef.current();

        // v4.0: Load boards for Board Prediction Engine (non-blocking)
        if (manifestUrl) {
          loadBoardsForDeck(manifestUrl)
            .then((boards) => {
              if (boards) {
                log.info(
                  `Loaded ${boards.totalBoards} boards for prediction engine`
                );
                setBoardsManifest(boards);
              } else {
                log.debug("No boards.json found for this deck");
              }
            })
            .catch((error) => {
              log.warn("Failed to load boards (non-critical):", error);
            });
        }
      } catch (error) {
        log.error("Failed to initialize session", error);
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to initialize session",
        });
      }
    },
    [roomId]
  );

  // ===========================================================================
  // CONTROLLER CONNECTION
  // ===========================================================================

  useEffect(() => {
    if (state.status !== "pairing" && state.status !== "playing") return;

    log.debug(`Controller connected status: ${socket.controllerConnected}`);

    setState((prev) => {
      if (prev.status !== "pairing" && prev.status !== "playing") return prev;
      return {
        ...prev,
        session: {
          ...prev.session,
          connection: {
            ...prev.session.connection,
            controllerConnected: socket.controllerConnected,
          },
        },
      };
    });

    // When controller connects, enter game mode (FR-004)
    if (socket.controllerConnected && state.status === "pairing") {
      log.log("Controller connected! Transitioning to playing mode");
      setState((prev) => {
        if (prev.status !== "pairing") return prev;
        return { status: "playing", session: prev.session };
      });
    }
  }, [socket.controllerConnected, state.status]);

  // Send state when controller first connects
  useEffect(() => {
    if (
      socket.controllerConnected &&
      !hasSentInitialState.current &&
      (state.status === "pairing" || state.status === "playing")
    ) {
      broadcastState(state.session);

      // Also send current sound state so Controller knows Host's sound preference
      log.log(
        `Sending initial sound state to controller: enabled=${sound.isEnabled}`
      );
      socket.sendSoundPreferenceAck?.(sound.isEnabled, "local");

      hasSentInitialState.current = true;
    }
    if (!socket.controllerConnected) {
      hasSentInitialState.current = false;
    }
  }, [
    socket.controllerConnected,
    state,
    broadcastState,
    socket,
    sound.isEnabled,
  ]);

  // ===========================================================================
  // PAGE HANDLERS
  // ===========================================================================

  const handleDisconnect = useCallback(() => {
    // Properly close the WebSocket before navigating
    // This triggers onClose on the server, which notifies controller and spectators
    socket.disconnect();
    window.location.href = "/play";
  }, [socket]);

  const handlePlayStandalone = useCallback(() => {
    setState((prev) => {
      if (prev.status !== "pairing") return prev;
      // Broadcast initial state for spectators
      setTimeout(() => broadcastState(prev.session), 0);
      return { status: "playing", session: prev.session };
    });
  }, [broadcastState]);

  // Wrap draw card with audio init
  const handleDrawCard = useCallback(async () => {
    await sound.initAudio();
    doDrawCard();
  }, [sound, doDrawCard]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (state.status === "selecting-deck") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950 p-6">
        <div className="w-full max-w-6xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 font-serif text-4xl font-bold text-amber-100">
              Tabula
            </h1>
            <p className="text-amber-300/70">Select a deck to begin</p>
          </div>
          <DeckSelector
            onDeckSelect={handleDeckSelect}
            showUploadOption={true}
            defaultDeckId="demo-barranquilla"
          />
        </div>
      </div>
    );
  }

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
            isControllerConnected={socket.controllerConnected}
          />

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-amber-400/50">
            <div
              className={`h-2 w-2 rounded-full ${
                socket.status === "connected"
                  ? "bg-green-500"
                  : socket.status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-red-500"
              }`}
            />
            <span>
              {socket.status === "connected"
                ? "Room ready"
                : socket.status === "connecting"
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
      onDrawCard={handleDrawCard}
      onPause={doPause}
      onResume={doResume}
      onReset={doReset}
      onDisconnect={handleDisconnect}
      isSoundEnabled={sound.isEnabled}
      onSoundToggle={sound.hostToggle}
      spectatorCount={spectatorCount}
      reactions={reactions}
      isFlipped={isFlipped}
      onFlipChange={handleFlipChange}
      isDetailedExpanded={isDetailedExpanded}
      onDetailedChange={handleDetailedChange}
      isDetailedSyncedFromController={isDetailedSyncedFromController}
      boardsManifest={boardsManifest ?? undefined}
    />
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default function HostPageClient() {
  return (
    <Suspense fallback={<HostPageLoading />}>
      <HostPageContent />
    </Suspense>
  );
}
