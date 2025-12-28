"use client";

/**
 * Join Page Client Component
 *
 * Mobile-optimized controller that:
 * 1. Shows a form to enter room code manually
 * 2. Auto-joins if ?room=XXXX is in URL (from QR scan)
 * 3. Connects via WebSocket to receive state updates from host
 * 4. Sends game commands to host
 *
 * Uses useSoundSync hook as single source of truth for sound state.
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see SRD §5.9 Session Entry Options
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
import { RemoteController } from "@/app/play/_components/remote-controller";
import { useGameSocket } from "@/lib/realtime/partykit-client";
import { useSoundSync, SoundSource } from "@/lib/audio";
import { useRouter } from "@/i18n/navigation";
import { createDevLogger } from "@/lib/utils/dev-logger";
import type { GameStatus, ItemDefinition } from "@/lib/types/game";
import type { PendingSoundSync } from "@/lib/audio/use-sound-sync";

// Dev-only logger
const log = createDevLogger("JoinPage");

// ============================================================================
// TYPES
// ============================================================================

type JoinPageState =
  | { status: "entering" }
  | { status: "connecting"; roomId: string }
  | { status: "connected"; roomId: string; gameState: ControllerGameState }
  | { status: "error"; message: string; roomId?: string };

interface ControllerGameState {
  currentItem: ItemDefinition | null;
  currentIndex: number;
  totalItems: number;
  status: GameStatus;
  historyCount: number;
}

// ============================================================================
// JOIN FORM COMPONENT
// ============================================================================

interface JoinFormProps {
  onJoin: (roomCode: string) => void;
  isLoading?: boolean;
  error?: string;
}

function JoinForm({ onJoin, isLoading, error }: JoinFormProps) {
  const [roomCode, setRoomCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.length === 4 && !isLoading) {
      onJoin(roomCode.toUpperCase());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    setRoomCode(value.slice(0, 4));
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 p-6">
      <div className="w-full max-w-sm">
        {/* Logo/Title */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-bold text-amber-100">
            Tabula
          </h1>
          <p className="mt-2 text-amber-300/70">Join a game session</p>
        </div>

        {/* Join Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="room-code"
              className="mb-2 block text-sm font-medium text-amber-200"
            >
              Room Code
            </label>
            <input
              id="room-code"
              type="text"
              value={roomCode}
              onChange={handleInputChange}
              placeholder="ABCD"
              maxLength={4}
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
              disabled={isLoading}
              className="w-full rounded-xl border-2 border-amber-700/50 bg-amber-900/50 px-4 py-4 text-center font-mono text-3xl tracking-[0.5em] text-amber-100 placeholder-amber-600/50 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/50 p-3 text-center text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={roomCode.length < 4 || isLoading}
            className="w-full rounded-xl bg-amber-500 py-4 text-lg font-bold text-amber-950 transition-colors hover:bg-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:bg-amber-700/50 disabled:text-amber-400/50"
          >
            {isLoading ? "Connecting..." : "Join Game"}
          </button>
        </form>

        {/* Help text */}
        <p className="mt-6 text-center text-sm text-amber-400/60">
          Enter the 4-character code shown on the host screen
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING SCREEN
// ============================================================================

function LoadingScreen({ message = "Connecting..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950">
      <div className="text-center">
        <div className="mb-4 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="font-serif text-xl text-amber-200">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CONTENT
// ============================================================================

function JoinPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomFromUrl = searchParams?.get("room")?.toUpperCase() || null;

  const [state, setState] = useState<JoinPageState>(() => {
    if (roomFromUrl) {
      log.info(`Initial state: connecting to ${roomFromUrl}`);
      return { status: "connecting", roomId: roomFromUrl };
    }
    return { status: "entering" };
  });

  const hasAutoConnected = useRef(false);
  const hasAttemptedConnection = useRef(false);

  // Determine current room ID for WebSocket
  const currentRoomId =
    state.status === "connecting" || state.status === "connected"
      ? state.roomId
      : state.status === "error" && state.roomId
      ? state.roomId
      : null;

  // ===========================================================================
  // WEBSOCKET CONNECTION
  // ===========================================================================

  const socket = useGameSocket({
    roomId: currentRoomId || "pending",
    role: "controller",
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

  // Track pending sound sync from Host
  const [pendingSoundSync, setPendingSoundSync] =
    useState<PendingSoundSync | null>(null);

  // Track Host's sound state (received via ACK or sync messages)
  const [hostSoundEnabled, setHostSoundEnabled] = useState<boolean | null>(
    null
  );

  const clearPendingSoundSync = useCallback(() => {
    setPendingSoundSync(null);
  }, []);

  // useSoundSync is the single source of truth for all sound state/actions
  const sound = useSoundSync({
    role: "controller",
    socket: {
      sendSoundPreference: socket.sendSoundPreference,
    },
    externalPendingSync: pendingSoundSync,
    onClearExternalPendingSync: clearPendingSoundSync,
  });

  // Track previous index to play sound on card draw
  const prevIndexRef = useRef(-1);

  // ===========================================================================
  // MESSAGE HANDLERS
  // ===========================================================================

  // Handle connection status changes
  useEffect(() => {
    log.debug(
      `Connection status: ${socket.status}, page state: ${state.status}`
    );

    if (socket.status === "connecting") {
      hasAttemptedConnection.current = true;
    }

    if (socket.status === "connected") {
      log.log("WebSocket connected!");
      hasAttemptedConnection.current = true;

      setState((current) => {
        if (current.status !== "connecting") return current;
        return {
          status: "connected",
          roomId: current.roomId,
          gameState: {
            currentItem: null,
            currentIndex: -1,
            totalItems: 0,
            status: "ready",
            historyCount: 0,
          },
        };
      });
    } else if (
      socket.status === "disconnected" &&
      hasAttemptedConnection.current
    ) {
      setState((current) => {
        if (current.status !== "connecting") return current;
        return {
          status: "error",
          message: "Connection lost. The host may have disconnected.",
          roomId: current.roomId,
        };
      });
    }
  }, [socket.status, state.status]);

  // Handle state updates from host
  useEffect(() => {
    if (!socket.lastStateUpdate) return;

    setState((prev) => {
      if (prev.status !== "connected") return prev;
      return {
        ...prev,
        gameState: socket.lastStateUpdate!,
      };
    });
  }, [socket.lastStateUpdate]);

  // Listen for sound preference messages from Host
  useEffect(() => {
    const unsubscribe = socket.onMessage((message) => {
      // Log all sound-related messages for debugging
      if (
        message.type === "SOUND_PREFERENCE" ||
        message.type === "SOUND_PREFERENCE_ACK"
      ) {
        log.log(
          `[Sound Message] type=${message.type}, full=${JSON.stringify(
            message
          )}`
        );
      }

      // Sound preference change from Host (Host initiated the change)
      if (
        message.type === "SOUND_PREFERENCE" &&
        message.source === SoundSource.HOST
      ) {
        // Update our knowledge of Host's sound state
        setHostSoundEnabled(message.enabled);
        // Show sync modal
        setPendingSoundSync({
          enabled: message.enabled,
          source: SoundSource.HOST,
          scope: message.scope,
        });
      }

      // ACK from Host confirming sound state (response to our command OR initial state)
      if (message.type === "SOUND_PREFERENCE_ACK") {
        setHostSoundEnabled(message.enabled);
      }
    });

    return unsubscribe;
  }, [socket]);

  // Play sound when card is drawn
  useEffect(() => {
    if (state.status !== "connected") return;

    const currentIndex = state.gameState.currentIndex;
    log.debug(
      `[Sound Effect] currentIndex: ${currentIndex}, prevIndex: ${prevIndexRef.current}`
    );
    if (currentIndex > prevIndexRef.current && currentIndex >= 0) {
      log.log("[Sound Effect] Playing card sound");
      sound.playCardSound();
    }
    prevIndexRef.current = currentIndex;
  }, [state, sound]);

  // Extract roomId for dependency arrays (used by multiple effects)
  const connectingRoomId = state.status === "connecting" ? state.roomId : null;

  // Timeout for initial connection
  useEffect(() => {
    if (state.status !== "connecting") return;

    const timeout = setTimeout(() => {
      setState((current) => {
        if (current.status !== "connecting") return current;
        return {
          status: "error",
          message:
            "Could not connect to room. Please check the code and try again.",
          roomId: current.roomId,
        };
      });
    }, 10000);

    return () => clearTimeout(timeout);
  }, [state.status, connectingRoomId]);

  // ===========================================================================
  // CONNECTION HANDLERS
  // ===========================================================================

  const hasCalledConnectRef = useRef(false);

  const handleJoin = useCallback((roomCode: string) => {
    hasAttemptedConnection.current = false;
    hasCalledConnectRef.current = false;
    window.history.replaceState(null, "", `/play/join?room=${roomCode}`);
    setState({ status: "connecting", roomId: roomCode });
  }, []);

  useEffect(() => {
    if (state.status !== "connecting") {
      hasCalledConnectRef.current = false;
      return;
    }

    if (hasCalledConnectRef.current) return;

    hasCalledConnectRef.current = true;
    // Use ref to avoid socket in dependencies (prevents reconnection loop)
    connectRef.current();

    // No cleanup that resets hasCalledConnectRef - only reset on state change
  }, [state.status, connectingRoomId]);

  const handleRetryConnection = useCallback(() => {
    if (state.status === "error" && state.roomId) {
      setState({ status: "connecting", roomId: state.roomId });
      socket.connect();
    }
  }, [state, socket]);

  const handleTryDifferentCode = useCallback(() => {
    socket.disconnect();
    hasAutoConnected.current = false;
    hasAttemptedConnection.current = false;
    hasCalledConnectRef.current = false;
    setState({ status: "entering" });
    router.push("/play/join");
  }, [socket, router]);

  // ===========================================================================
  // GAME ACTIONS (wrapped with audio init)
  // ===========================================================================

  const handleDrawCard = useCallback(async () => {
    await sound.initAudio(); // Safe to call multiple times
    socket.drawCard();
  }, [socket, sound]);

  // Toggle Host sound - invert current known state (default to true if unknown)
  // Optimistically update local state for immediate UI feedback
  const handleToggleHost = useCallback(() => {
    const currentHostState = hostSoundEnabled ?? true; // Assume enabled if unknown
    const newHostState = !currentHostState;

    log.log(`Toggle Host: ${currentHostState} -> ${newHostState}`);

    // Optimistically update UI before server confirms
    setHostSoundEnabled(newHostState);

    // Send command to Host
    sound.controllerSetHostOnly(newHostState);
  }, [hostSoundEnabled, sound]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (state.status === "entering") {
    return <JoinForm onJoin={handleJoin} />;
  }

  if (state.status === "connecting") {
    return <LoadingScreen message={`Connecting to ${state.roomId}...`} />;
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-950 via-amber-900 to-amber-950 p-6">
        <div className="max-w-md rounded-2xl bg-red-900/50 p-6 text-center">
          <h1 className="mb-4 font-serif text-2xl font-bold text-red-200">
            Connection Error
          </h1>
          <p className="text-red-300">{state.message}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={handleTryDifferentCode}
              className="rounded-full bg-amber-800/50 px-4 py-2 font-medium text-amber-200"
            >
              Try Different Code
            </button>
            <button
              onClick={handleRetryConnection}
              className="rounded-full bg-amber-500 px-4 py-2 font-semibold text-amber-950"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RemoteController
      roomId={state.roomId}
      gameState={state.gameState}
      connectionStatus={
        socket.status === "connected" ? "connected" : "reconnecting"
      }
      onDrawCard={handleDrawCard}
      onPause={socket.pauseGame}
      onResume={socket.resumeGame}
      onReset={socket.resetGame}
      onRetryConnection={handleRetryConnection}
      onDisconnect={handleTryDifferentCode}
      sound={{
        isLocalEnabled: sound.isEnabled,
        isHostEnabled: hostSoundEnabled,
        hasPendingSync: sound.hasPendingSync,
        pendingSync: sound.pendingSync,
      }}
      soundActions={{
        onToggleLocal: sound.controllerToggleLocal,
        onToggleHost: handleToggleHost,
        onToggleBoth: sound.controllerToggleBoth,
        onAcceptSync: sound.acceptSync,
        onDeclineSync: sound.declineSync,
        onDismissSync: sound.dismissSyncForSession,
      }}
    />
  );
}

// ============================================================================
// EXPORT
// ============================================================================

export default function JoinPageClient() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <JoinPageContent />
    </Suspense>
  );
}
