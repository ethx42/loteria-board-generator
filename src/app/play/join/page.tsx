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
import { createDevLogger } from "@/lib/utils/dev-logger";
import type { GameStatus, ItemDefinition } from "@/lib/types/game";

// Dev-only logger
const log = createDevLogger("JoinPage");

// ============================================================================
// DEBUG LOG CAPTURE (temporary for debugging)
// ============================================================================
const debugLogs: string[] = [];
const MAX_DEBUG_LOGS = 50;

function captureLog(message: string) {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.unshift(`[${timestamp}] ${message}`);
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.pop();
  }
}

// Override console methods to capture logs (only in dev)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;
  const originalInfo = console.info;
  
  console.log = (...args) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    if (msg.includes(">>>") || msg.includes("GameSocket") || msg.includes("JoinPage")) {
      captureLog(msg);
    }
    originalLog.apply(console, args);
  };
  
  console.warn = (...args) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    captureLog(`⚠️ ${msg}`);
    originalWarn.apply(console, args);
  };
  
  console.error = (...args) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    captureLog(`❌ ${msg}`);
    originalError.apply(console, args);
  };
  
  console.debug = (...args) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    if (msg.includes(">>>") || msg.includes("GameSocket") || msg.includes("JoinPage")) {
      captureLog(`🔍 ${msg}`);
    }
    originalDebug.apply(console, args);
  };
  
  console.info = (...args) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    if (msg.includes(">>>") || msg.includes("GameSocket") || msg.includes("JoinPage")) {
      captureLog(`ℹ️ ${msg}`);
    }
    originalInfo.apply(console, args);
  };
}

function DebugPanel() {
  const [, forceUpdate] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 500);
    return () => clearInterval(interval);
  }, []);
  
  if (process.env.NODE_ENV !== "development") return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 text-xs text-green-400 font-mono">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-1 bg-gray-800 text-white"
      >
        {isExpanded ? "▼ Hide Debug" : "▲ Show Debug"} ({debugLogs.length} logs)
      </button>
      {isExpanded && (
        <div className="max-h-48 overflow-y-auto p-2">
          {debugLogs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            debugLogs.map((log, i) => (
              <div key={i} className="border-b border-gray-800 py-0.5 break-all">
                {log}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-amber-950 via-amber-900 to-amber-950 p-6">
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
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-amber-950 via-amber-900 to-amber-950">
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

  // Track component mount/unmount
  useEffect(() => {
    log.info("JoinPageContent MOUNTED");
    return () => {
      log.warn("JoinPageContent UNMOUNTING");
    };
  }, []);

  const hasAutoConnected = useRef(false);
  
  // Track if we've ever attempted a connection (to know when disconnected is a failure vs initial state)
  const hasAttemptedConnection = useRef(false);

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

  // Handle connection status changes - transition to connected when WebSocket connects
  useEffect(() => {
    log.debug(`Connection status: ${connectionStatus}, page state: ${state.status}`, { 
      hasAttemptedConnection: hasAttemptedConnection.current,
    });

    // Track that we're attempting/have attempted connection
    if (connectionStatus === "connecting") {
      hasAttemptedConnection.current = true;
    }

    // Show controller UI as soon as WebSocket is connected
    if (connectionStatus === "connected") {
      log.log("WebSocket connected!");
      hasAttemptedConnection.current = true;
      
      // Only transition if we're still in connecting state
      setState((current) => {
        if (current.status !== "connecting") {
          log.debug("Already transitioned, skipping");
          return current;
        }
        log.log("Transitioning to connected state");
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
    } else if (connectionStatus === "disconnected" && hasAttemptedConnection.current) {
      // Only treat as error if we already tried to connect and got disconnected
      setState((current) => {
        if (current.status !== "connecting") return current;
        log.warn("Disconnected after connection attempt, transitioning to error");
        return {
          status: "error",
          message: "Connection lost. The host may have disconnected.",
          roomId: current.roomId,
        };
      });
    }
  }, [connectionStatus]); // Only depend on connectionStatus, use functional setState

  // Timeout for initial connection attempt
  useEffect(() => {
    if (state.status !== "connecting") return;

    log.debug("Starting connection timeout (10s)");
    const timeout = setTimeout(() => {
      // Only error if we're still in connecting state
      setState((current) => {
        if (current.status !== "connecting") return current;
        log.error("Connection timeout - transitioning to error state");
        return {
          status: "error",
          message: "Could not connect to room. Please check the code and try again.",
          roomId: current.roomId,
        };
      });
    }, 10000); // 10 seconds timeout for initial connection

    return () => clearTimeout(timeout);
  }, [state.status, state.status === "connecting" ? (state as { roomId: string }).roomId : null]);

  // Handle state updates from host
  useEffect(() => {
    if (!lastStateUpdate) return;

    log.log("Received state update from host", { 
      currentIndex: lastStateUpdate.currentIndex,
      status: lastStateUpdate.status,
    });

    setState((prev) => {
      if (prev.status !== "connected") return prev;
      return {
        ...prev,
        gameState: lastStateUpdate,
      };
    });
  }, [lastStateUpdate]);

  // Effect to connect when we enter "connecting" state
  // IMPORTANT: Define refs BEFORE they're used in callbacks
  const connectRef = useRef(connect);
  connectRef.current = connect;
  
  const hasCalledConnectRef = useRef(false);

  // Manual join handler - defined AFTER refs it uses
  const handleJoin = useCallback((roomCode: string) => {
    log.log(`>>> handleJoin called for: ${roomCode}`);
    // Reset connection tracking for new room
    hasAttemptedConnection.current = false;
    hasCalledConnectRef.current = false;
    log.debug(`>>> hasCalledConnectRef reset to false`);
    // Update URL without full navigation (for bookmarking/sharing)
    window.history.replaceState(null, "", `/play/join?room=${roomCode}`);
    // Set state to trigger connect
    setState({ status: "connecting", roomId: roomCode });
    log.debug(`>>> setState called with connecting/${roomCode}`);
  }, []);
  
  useEffect(() => {
    log.warn(`>>> Connect useEffect running - status: ${state.status}, hasCalledConnect: ${hasCalledConnectRef.current}`);
    
    // Not in connecting state - reset tracking
    if (state.status !== "connecting") {
      log.warn(`>>> Not connecting status (${state.status}), resetting hasCalledConnectRef`);
      hasCalledConnectRef.current = false;
      return;
    }
    
    // Already called connect for this session - skip
    if (hasCalledConnectRef.current) {
      log.warn(`>>> Already called connect, skipping`);
      return;
    }
    
    const roomId = state.roomId;
    log.warn(`>>> Initiating connection to room: ${roomId}`);
    hasCalledConnectRef.current = true;
    
    // Call connect immediately - no delay needed
    log.warn(`>>> Calling connect() NOW for ${roomId}`);
    connectRef.current();
    
    return () => {
      log.warn(`>>> Connect useEffect CLEANUP`);
      // Reset so next mount will try again
      hasCalledConnectRef.current = false;
    };
  }, [state.status, state.status === "connecting" ? (state as { roomId: string }).roomId : null]);

  const handleRetryConnection = useCallback(() => {
    if (state.status === "error" && state.roomId) {
      setState({ status: "connecting", roomId: state.roomId });
      connect();
    }
  }, [state, connect]);

  const handleTryDifferentCode = useCallback(() => {
    disconnect();
    hasAutoConnected.current = false;
    hasAttemptedConnection.current = false;
    hasCalledConnectRef.current = false;
    setState({ status: "entering" });
    router.push("/play/join");
  }, [disconnect, router]);

  // Render based on state
  if (state.status === "entering") {
    return <JoinForm onJoin={handleJoin} />;
  }

  if (state.status === "connecting") {
    return (
      <>
        <LoadingScreen message={`Connecting to ${state.roomId}...`} />
        <DebugPanel />
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-amber-950 via-amber-900 to-amber-950 p-6 pb-52">
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
        <DebugPanel />
      </>
    );
  }

  // Connected - show RemoteController
  return (
    <RemoteController
      roomId={state.roomId}
      gameState={state.gameState}
      connectionStatus={
        connectionStatus === "connected" ? "connected" : "reconnecting"
      }
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
