"use client";

/**
 * Join Page (Controller)
 *
 * Mobile-optimized controller that:
 * 1. Shows a form to enter room code manually
 * 2. Auto-joins if ?room=XXXX is in URL (from QR scan)
 * 3. Connects via WebSocket to receive state updates from host
 * 4. Sends game commands to host
 *
 * @see SRD §5.2 Remote Controller Layout
 * @see SRD §5.9 Session Entry Options
 */

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RemoteController } from "../_components/remote-controller";
import { useGameSocket } from "@/lib/realtime/partykit-client";
import type { GameStatus, ItemDefinition } from "@/lib/types/game";

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
      return { status: "connecting", roomId: roomFromUrl };
    }
    return { status: "entering" };
  });

  const hasAutoConnected = useRef(false);

  // Determine current room ID for WebSocket
  const currentRoomId =
    state.status === "connecting" || state.status === "connected"
      ? state.roomId
      : state.status === "error" && state.roomId
      ? state.roomId
      : null;

  // WebSocket connection
  const {
    status: connectionStatus,
    lastStateUpdate,
    connect,
    disconnect,
    drawCard,
    pauseGame,
    resumeGame,
    resetGame,
  } = useGameSocket({
    roomId: currentRoomId || "pending",
    role: "controller",
    debug: true,
  });

  // Handle connection status changes
  useEffect(() => {
    if (state.status !== "connecting") return;

    // Show controller UI as soon as WebSocket is connected
    if (connectionStatus === "connected") {
      setState({
        status: "connected",
        roomId: state.roomId,
        gameState: {
          currentItem: null,
          currentIndex: -1,
          totalItems: 0,
          status: "ready",
          historyCount: 0,
        },
      });
    } else if (connectionStatus === "disconnected") {
      const timeout = setTimeout(() => {
        setState({
          status: "error",
          message: "Could not connect to room. Please check the code.",
          roomId: state.roomId,
        });
      }, 5000); // Give more time for connection
      return () => clearTimeout(timeout);
    }
  }, [connectionStatus, state]);

  // Handle state updates from host
  useEffect(() => {
    if (!lastStateUpdate) return;

    setState((prev) => {
      if (prev.status !== "connected") return prev;
      return {
        ...prev,
        gameState: lastStateUpdate,
      };
    });
  }, [lastStateUpdate]);

  // Manual join handler
  const handleJoin = useCallback(
    (roomCode: string) => {
      // Update URL without full navigation (for bookmarking/sharing)
      window.history.replaceState(null, "", `/play/join?room=${roomCode}`);
      // Set state to trigger connect
      setState({ status: "connecting", roomId: roomCode });
    },
    []
  );

  // Track the room we're trying to connect to
  const connectingRoomRef = useRef<string | null>(null);

  // Effect to connect when we enter "connecting" state with a new room
  useEffect(() => {
    if (state.status === "connecting") {
      const roomId = state.roomId;
      // Only connect if this is a new room we haven't tried yet
      if (connectingRoomRef.current !== roomId) {
        connectingRoomRef.current = roomId;
        // Small delay to allow the config ref to update with new roomId
        const timeout = setTimeout(() => {
          connect();
        }, 100);
        return () => clearTimeout(timeout);
      }
    }
  }, [state, connect, currentRoomId]);

  const handleRetryConnection = useCallback(() => {
    if (state.status === "error" && state.roomId) {
      setState({ status: "connecting", roomId: state.roomId });
      connect();
    }
  }, [state, connect]);

  const handleTryDifferentCode = useCallback(() => {
    disconnect();
    hasAutoConnected.current = false;
    setState({ status: "entering" });
    router.push("/play/join");
  }, [disconnect, router]);

  // Render based on state
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

  // Connected - show RemoteController
  return (
    <RemoteController
      roomId={state.roomId}
      gameState={state.gameState}
      connectionStatus={connectionStatus === "connected" ? "connected" : "reconnecting"}
      onDrawCard={drawCard}
      onPause={pauseGame}
      onResume={resumeGame}
      onReset={resetGame}
      onRetryConnection={handleRetryConnection}
      onDisconnect={handleTryDifferentCode}
    />
  );
}

// ============================================================================
// PAGE EXPORT
// ============================================================================

export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <JoinPageContent />
    </Suspense>
  );
}
