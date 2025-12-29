/**
 * Game Synchronization Hook
 *
 * Integrates the game store with Partykit WebSocket for real-time
 * state synchronization between Host and Controller.
 *
 * @module lib/game/use-game-sync
 * @see SRD §3.4 Realtime Protocol
 */

import { useEffect, useCallback, useRef } from "react";
import { useGameStore } from "@/stores/game-store";
import {
  useGameSocket,
  type ConnectionStatus as SocketConnectionStatus,
} from "@/lib/realtime/partykit-client";
import type { WSMessage, StateUpdatePayload } from "@/lib/realtime/types";
import type { GameSession } from "@/lib/types/game";

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

interface UseGameSyncOptions {
  /** Room ID to connect to */
  roomId: string;

  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;

  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

interface GameSyncActions {
  /** Draw the next card */
  drawCard: () => void;

  /** Pause the game */
  pauseGame: () => void;

  /** Resume the game */
  resumeGame: () => void;

  /** Reset the game */
  resetGame: () => void;

  /** Manually connect to the server */
  connect: () => void;

  /** Manually disconnect from the server */
  disconnect: () => void;
}

interface GameSyncState {
  /** Current connection status */
  connectionStatus: ConnectionStatus;

  /** Whether the socket is connected */
  isConnected: boolean;

  /** Current session state */
  session: GameSession | null;

  /** Any error that occurred */
  error: string | null;
}

export type UseGameSyncReturn = GameSyncState & GameSyncActions;

// ============================================================================
// HELPER
// ============================================================================

function mapConnectionStatus(status: SocketConnectionStatus): ConnectionStatus {
  switch (status) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting";
    case "reconnecting":
      return "reconnecting";
    case "disconnected":
    default:
      return "disconnected";
  }
}

// ============================================================================
// HOST SYNC HOOK
// ============================================================================

/**
 * Hook for Host to sync game state with connected Controllers.
 *
 * The Host is the source of truth for game state.
 * It broadcasts state updates to all connected Controllers.
 *
 * @example
 * ```tsx
 * function HostPage() {
 *   const { session, drawCard, connectionStatus } = useHostSync({
 *     roomId: 'ABCD',
 *   });
 *
 *   return <HostDisplay session={session} onDrawCard={drawCard} />;
 * }
 * ```
 */
export function useHostSync(options: UseGameSyncOptions): UseGameSyncReturn {
  const { roomId, onConnectionChange, onError } = options;

  // Store state
  const session = useGameStore((state) => state.session);
  const drawCardStore = useGameStore((state) => state.drawCard);
  const pauseGameStore = useGameStore((state) => state.pauseGame);
  const resumeGameStore = useGameStore((state) => state.resumeGame);
  const resetSessionStore = useGameStore((state) => state.resetSession);
  const updateConnection = useGameStore((state) => state.updateConnection);
  const storeError = useGameStore((state) => state.error);
  const setError = useGameStore((state) => state.setError);

  // WebSocket connection
  const socket = useGameSocket({
    roomId,
    role: "host",
  });

  const prevSessionRef = useRef<GameSession | null>(null);

  // Handle incoming messages from Controller
  useEffect(() => {
    const unsubscribe = socket.onMessage((message: WSMessage) => {
      switch (message.type) {
        case "CONTROLLER_CONNECTED":
          updateConnection(true, true, message.controllerId);
          break;

        case "CONTROLLER_DISCONNECTED":
          updateConnection(true, false, null);
          break;

        case "DRAW_CARD":
          drawCardStore();
          break;

        case "PAUSE_GAME":
          pauseGameStore();
          break;

        case "RESUME_GAME":
          resumeGameStore();
          break;

        case "RESET_GAME":
          resetSessionStore();
          break;
      }
    });

    return unsubscribe;
  }, [
    socket,
    drawCardStore,
    pauseGameStore,
    resumeGameStore,
    resetSessionStore,
    updateConnection,
  ]);

  // Broadcast state updates when session changes
  useEffect(() => {
    if (!session || socket.status !== "connected") return;

    // Only send if session actually changed
    if (prevSessionRef.current === session) return;
    prevSessionRef.current = session;

    // Create state update payload (matches StateUpdatePayload interface)
    const stateUpdate: StateUpdatePayload = {
      currentItem: session.currentItem,
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      status: session.status,
      historyCount: session.history.length,
    };

    socket.sendStateUpdate(stateUpdate);
  }, [session, socket]);

  // Track connection changes
  useEffect(() => {
    const isConnected = socket.status === "connected";
    onConnectionChange?.(isConnected);
  }, [socket.status, onConnectionChange]);

  // Error handling
  useEffect(() => {
    if (socket.error) {
      const error = new Error(socket.error);
      setError(socket.error);
      onError?.(error);
    }
  }, [socket.error, setError, onError]);

  // Actions (Host performs directly, then broadcasts)
  const drawCard = useCallback(() => {
    drawCardStore();
  }, [drawCardStore]);

  const pauseGame = useCallback(() => {
    pauseGameStore();
  }, [pauseGameStore]);

  const resumeGame = useCallback(() => {
    resumeGameStore();
  }, [resumeGameStore]);

  const resetGame = useCallback(() => {
    resetSessionStore();
  }, [resetSessionStore]);

  const connectionStatus = mapConnectionStatus(socket.status);

  return {
    session,
    connectionStatus,
    isConnected: socket.status === "connected",
    error: storeError,
    drawCard,
    pauseGame,
    resumeGame,
    resetGame,
    connect: socket.connect,
    disconnect: socket.disconnect,
  };
}

// ============================================================================
// CONTROLLER SYNC HOOK
// ============================================================================

/**
 * Hook for Controller to send commands and receive state updates.
 *
 * The Controller sends commands to the Host and receives state updates.
 * It does not modify local state directly - all changes come from Host.
 *
 * @example
 * ```tsx
 * function ControllerPage() {
 *   const { session, drawCard, connectionStatus } = useControllerSync({
 *     roomId: 'ABCD',
 *   });
 *
 *   return <RemoteController session={session} onDrawCard={drawCard} />;
 * }
 * ```
 */
export function useControllerSync(options: UseGameSyncOptions): UseGameSyncReturn {
  const { roomId, onConnectionChange, onError } = options;

  // Store state
  const session = useGameStore((state) => state.session);
  const loadSession = useGameStore((state) => state.loadSession);
  const storeError = useGameStore((state) => state.error);
  const setError = useGameStore((state) => state.setError);

  // WebSocket connection
  const socket = useGameSocket({
    roomId,
    role: "controller",
  });

  // Handle incoming state updates from Host
  useEffect(() => {
    const unsubscribe = socket.onMessage((message: WSMessage) => {
      if (message.type === "STATE_UPDATE" && session) {
        const { payload } = message;

        // Update local session with Host state
        // Note: Controller keeps its own history locally for now
        // Full history sync happens via FULL_STATE_SYNC on reconnect
        loadSession({
          ...session,
          currentIndex: payload.currentIndex,
          currentItem: payload.currentItem,
          status: payload.status,
          totalItems: payload.totalItems,
        });
      }

      // Handle full state sync (includes history)
      if (message.type === "FULL_STATE_SYNC" && session) {
        const { payload } = message;

        loadSession({
          ...session,
          currentIndex: payload.currentIndex,
          currentItem: payload.currentItem,
          status: payload.status,
          totalItems: payload.totalItems,
          history: payload.history,
        });
      }
    });

    return unsubscribe;
  }, [socket, session, loadSession]);

  // Track connection changes
  useEffect(() => {
    const isConnected = socket.status === "connected";
    onConnectionChange?.(isConnected);
  }, [socket.status, onConnectionChange]);

  // Error handling
  useEffect(() => {
    if (socket.error) {
      const error = new Error(socket.error);
      setError(socket.error);
      onError?.(error);
    }
  }, [socket.error, setError, onError]);

  // Actions (Controller sends commands to Host)
  const drawCard = useCallback(() => {
    socket.drawCard();
  }, [socket]);

  const pauseGame = useCallback(() => {
    socket.pauseGame();
  }, [socket]);

  const resumeGame = useCallback(() => {
    socket.resumeGame();
  }, [socket]);

  const resetGame = useCallback(() => {
    socket.resetGame();
  }, [socket]);

  const connectionStatus = mapConnectionStatus(socket.status);

  return {
    session,
    connectionStatus,
    isConnected: socket.status === "connected",
    error: storeError,
    drawCard,
    pauseGame,
    resumeGame,
    resetGame,
    connect: socket.connect,
    disconnect: socket.disconnect,
  };
}

// ============================================================================
// COMBINED HOOK
// ============================================================================

interface UseGameSyncOptionsWithRole extends UseGameSyncOptions {
  /** Role: host or controller */
  role: "host" | "controller";
}

/**
 * Combined hook that handles both Host and Controller roles.
 *
 * @param options - Configuration including role
 * @returns State and actions appropriate for the role
 */
export function useGameSync(options: UseGameSyncOptionsWithRole): UseGameSyncReturn {
  const { role, ...rest } = options;

  // We have to use conditional logic here, but both hooks are always called
  // to satisfy React's rules of hooks
  const hostResult = useHostSync(rest);
  const controllerResult = useControllerSync(rest);

  return role === "host" ? hostResult : controllerResult;
}
